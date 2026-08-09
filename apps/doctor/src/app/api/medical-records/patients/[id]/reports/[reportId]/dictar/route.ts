import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@healthcare/database';
import { requireDoctorAuth, logAudit } from '@/lib/medical-auth';
import { handleApiError } from '@/lib/api-error-handler';
import { getChatProvider } from '@/lib/ai';
import { logTokenUsage } from '@/lib/ai/log-token-usage';
import { dictParaRender, formatoDe } from '@/lib/informe-medico/formatos';
import { geometriaCacheada } from '@/lib/informe-medico/campos-del-informe';
import { etiquetaCanonica } from '@/lib/informe-medico/canonical';
import { capacidadDeCaja } from '@/lib/informe-medico/capacidad';
import { caracteresNoImprimibles } from '@/lib/informe-medico/winansi';
import { leerAnswers, type Answers } from '@/lib/informe-medico/types';
import { transcribirAudio } from '@/lib/voice/transcribir-audio';
import {
  promptSistemaDictado,
  promptUsuarioDictado,
  type CampoDictable,
} from '@/lib/informe-medico/prompt-dictado';

const MODEL = 'gpt-4o';
const MAX_TOKENS = 4096;
const TEMPERATURE = 0;

/** Lo que el modelo NO pudo colocar, para decirlo en vez de tragárselo. */
interface Descartado {
  clave: string;
  motivo: 'campo-inexistente' | 'caracteres-no-imprimibles' | 'no-es-texto';
  caracteres?: string[];
}

// POST /api/medical-records/patients/:id/reports/:reportId/dictar
//
// El doctor dicta mirando la hoja; el modelo coloca lo dictado en los campos de
// ESA página. Escribe DIRECTO en el borrador (05-VOZ §4): no hay card de
// confirmación porque el valor sale en ÁMBAR, nada se manda sin consentimiento y
// emitir es un acto aparte.
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; reportId: string }> }
) {
  try {
    const { doctorId, userId, role } = await requireDoctorAuth(request);
    const { id: patientId, reportId } = await params;
    // 🔴 El audio se transcribe AQUÍ, no en `/api/voice/transcribe`: esa ruta es
    // OWNER_ONLY y un usuario secundario con `expedientes` —que sí puede hacer
    // informes -- recibiría un PERMISSION_BLOCKED. Ver `transcribir-audio.ts`.
    // Acepta multipart (audio) o JSON (transcripción ya hecha, para reintentar
    // sin regrabar).
    let transcript = '';
    let pagina: number | null = null;
    let adjuntarEncounterIds: string[] = [];

    if (request.headers.get('content-type')?.includes('multipart/form-data')) {
      const fd = await request.formData();
      const audio = fd.get('audio');
      const p = fd.get('pagina');
      pagina = typeof p === 'string' && /^\d+$/.test(p) ? Number(p) : null;
      const adj = fd.get('adjuntarEncounterIds');
      if (typeof adj === 'string') {
        try {
          const arr = JSON.parse(adj);
          if (Array.isArray(arr)) adjuntarEncounterIds = arr.filter((x) => typeof x === 'string').slice(0, 5);
        } catch { /* sin adjuntos */ }
      }
      if (!(audio instanceof File)) {
        return NextResponse.json({ error: 'No se recibió el audio' }, { status: 400 });
      }
      const t = await transcribirAudio(audio);
      if (!t.ok) return NextResponse.json({ error: t.mensaje }, { status: 400 });
      transcript = t.transcript;
    } else {
      const body = await request.json();
      transcript = typeof body?.transcript === 'string' ? body.transcript.trim() : '';
      pagina = Number.isInteger(body?.pagina) ? body.pagina : null;
      adjuntarEncounterIds = Array.isArray(body?.adjuntarEncounterIds)
        ? body.adjuntarEncounterIds.filter((x: unknown) => typeof x === 'string').slice(0, 5)
        : [];
    }

    if (transcript === '') {
      return NextResponse.json({ error: 'No se recibió el dictado' }, { status: 400 });
    }

    const report = await prisma.medicalReport.findFirst({
      where: { id: reportId, patientId, doctorId },
      include: { form: true },
    });
    if (!report) return NextResponse.json({ error: 'Informe no encontrado' }, { status: 404 });

    // 🔴 Un informe emitido ya salió firmado. No se dicta encima.
    if (report.status === 'issued') {
      return NextResponse.json(
        { error: 'Este informe ya fue emitido. Genera uno nuevo para hacer cambios.' },
        { status: 409 }
      );
    }

    const formato = formatoDe(report.form);
    if (!formato) {
      return NextResponse.json({ error: 'Este build no sabe generar este formato' }, { status: 409 });
    }
    const dict = dictParaRender(formato, report.form.fieldDict);
    const geo = await geometriaCacheada(formato, dict, report.form.updatedAt.toISOString());
    if (!geo) return NextResponse.json({ error: 'No se pudo leer el formato' }, { status: 500 });

    // Sólo campos de TEXTO: las casillas no entran en el dictado v1 (05-VOZ §11).
    const enPagina = geo.cajas.filter(
      (c) => c.tipo === 'texto' && (pagina === null || c.pagina === pagina - 1)
    );
    if (enPagina.length === 0) {
      return NextResponse.json({ error: 'Esta página no tiene campos que se puedan dictar' }, { status: 400 });
    }

    // Un campo puede tener varios recuadros: se ofrece UNA vez, con el más grande.
    // Un campo puede tener varios recuadros: se ofrece UNA vez, con el más
    // grande de los MEDIBLES. Un recuadro inmensurable (muñón oculto) se ignora:
    // darle un tope inventado —antes 200— le decía al modelo que cabían 200
    // caracteres en una caja real de 14, y el PDF salía en 3 pt.
    const porClave = new Map<string, CampoDictable>();
    for (const c of enPagina) {
      const cap = capacidadDeCaja(c.ancho, c.alto, c.multilinea, 0);
      if (!Number.isFinite(cap.maximo)) continue;
      const previo = porClave.get(c.clave);
      if (!previo || cap.maximo > previo.maxCaracteres) {
        porClave.set(c.clave, { clave: c.clave, etiqueta: etiquetaCanonica(c.clave), maxCaracteres: cap.maximo });
      }
    }
    const campos = [...porClave.values()];
    if (campos.length === 0) {
      return NextResponse.json({ error: 'Esta página no tiene campos que se puedan dictar' }, { status: 400 });
    }
    const clavesValidas = new Set(campos.map((c) => c.clave));

    const answers = leerAnswers(report.answers);
    const yaLleno = campos
      .filter((c) => (answers[c.clave]?.value ?? '').trim() !== '')
      .map((c) => ({ etiqueta: c.etiqueta, valor: answers[c.clave].value }));

    // ── Adjuntos: consultas del MISMO paciente, con sus etiquetas ────────────
    const adjuntos: Array<{ titulo: string; contenido: string }> = [];
    if (adjuntarEncounterIds.length > 0) {
      const encs = await prisma.clinicalEncounter.findMany({
        where: { id: { in: adjuntarEncounterIds }, patientId, doctorId },
        include: { template: { select: { name: true, customFields: true } } },
      });
      for (const e of encs) {
        const partes: string[] = [];
        if (e.chiefComplaint) partes.push(`Motivo de consulta: ${e.chiefComplaint}`);
        for (const [k, v] of [
          ['Padecimiento actual', e.subjective], ['Exploración física', e.objective],
          ['Diagnóstico', e.assessment], ['Tratamiento', e.plan], ['Notas', e.clinicalNotes],
        ] as Array<[string, string | null]>) if (v) partes.push(`${k}: ${v}`);

        // `customData` con las ETIQUETAS de su plantilla, no con las claves crudas:
        // se le entrega al modelo "Motivo de Consulta: …", no "motivoConsulta: …".
        const campos = Array.isArray(e.template?.customFields) ? e.template.customFields : [];
        const etiquetaDe = new Map<string, string>();
        for (const f of campos as Array<{ name?: string; label?: string; labelEs?: string }>) {
          if (f?.name) etiquetaDe.set(f.name, f.labelEs || f.label || f.name);
        }
        const custom = (e.customData ?? {}) as Record<string, unknown>;
        for (const [k, v] of Object.entries(custom)) {
          if (v === null || v === undefined || v === '') continue;
          partes.push(`${etiquetaDe.get(k) ?? k}: ${Array.isArray(v) ? v.join(', ') : String(v)}`);
        }
        if (partes.length > 0) {
          adjuntos.push({
            titulo: `Consulta del ${e.encounterDate.toISOString().slice(0, 10)}${e.template?.name ? ` (${e.template.name})` : ''}`,
            contenido: partes.join('\n'),
          });
        }
      }
    }

    const ctx = { formato: `${report.form.insurer} — ${report.form.name}`, pagina, campos, yaLleno, adjuntos };
    const { content, usage } = await getChatProvider().chatCompletion(
      [
        { role: 'system', content: promptSistemaDictado(ctx) },
        { role: 'user', content: promptUsuarioDictado(transcript, ctx) },
      ],
      { model: MODEL, maxTokens: MAX_TOKENS, temperature: TEMPERATURE, jsonMode: true }
    );

    logTokenUsage({
      doctorId,
      endpoint: 'informe-dictado',
      model: MODEL,
      provider: process.env.LLM_PROVIDER || 'openai',
      usage,
    });

    let propuesto: Record<string, unknown>;
    try {
      propuesto = JSON.parse(content.replace(/^```(?:json)?\s*|\s*```$/g, '').trim());
    } catch {
      return NextResponse.json({ error: 'El modelo devolvió una respuesta que no se pudo leer' }, { status: 502 });
    }
    if (typeof propuesto !== 'object' || propuesto === null || Array.isArray(propuesto)) {
      return NextResponse.json({ error: 'El modelo no devolvió un objeto de campos' }, { status: 502 });
    }

    // ── 🔴 VALIDACIÓN SERVER-SIDE (regla 0) ─────────────────────────────────
    // No se le cree al modelo que un campo existe: se comprueba contra la hoja.
    const escritos: Answers = {};
    const descartados: Descartado[] = [];
    for (const [clave, bruto] of Object.entries(propuesto)) {
      if (bruto === null || bruto === undefined) continue;      // "no sé" — se respeta
      const valor = String(bruto).trim();
      if (valor === '') continue;                               // vacío NO borra (05-VOZ §9.4)

      if (!clavesValidas.has(clave)) {
        descartados.push({ clave, motivo: 'campo-inexistente' });
        continue;
      }
      // Un carácter no imprimible haría que el campo saliera VACÍO del PDF: se
      // descarta aquí en vez de dejarlo entrar y desaparecer al generar.
      const malos = caracteresNoImprimibles(valor);
      if (malos.length > 0) {
        descartados.push({ clave, motivo: 'caracteres-no-imprimibles', caracteres: malos });
        continue;
      }
      escritos[clave] = { value: valor, source: 'dictado', origin: 'voice' };
    }

    // 🔴 NO se escribe en la base. El dictado PROPONE: los valores viajan al
    // cliente, que los pinta PENDIENTES sobre la hoja, y el `PATCH` sale sólo
    // cuando el doctor aprieta Guardar (06-AGENTE §2, decisión 1B).
    //
    // Antes esto persistía de inmediato, y eso reintroducía justo la ambigüedad
    // que 1B vino a quitar: lo dictado guardado y lo tecleado no. De paso
    // desaparece la carrera con las ediciones manuales — no hay nada que pisar.

    await logAudit({
      patientId, doctorId, userId, userRole: role,
      action: 'VIEW', resourceType: 'MedicalReport', resourceId: reportId,
      changes: {
        via: 'dictado-propuesta', pagina,
        propuestos: Object.keys(escritos),
        descartados: descartados.length,
        adjuntos: adjuntarEncounterIds,   // qué se mandó al modelo (05-VOZ §7.5)
      },
      request,
    });

    return NextResponse.json({
      // `clave -> {value, source, origin}` para que el cliente los ponga
      // pendientes tal cual, con su procedencia.
      valores: escritos,
      escritos: Object.keys(escritos),
      // Se devuelve lo descartado, no se calla: si el doctor dictó algo y no
      // aparece, tiene que saber por qué (un campo de otra página, un símbolo).
      descartados,
      camposEnPagina: campos.length,
    });
  } catch (error) {
    return handleApiError(error, 'POST /api/medical-records/patients/:id/reports/:reportId/dictar');
  }
}
