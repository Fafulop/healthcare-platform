import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@healthcare/database';
import { requireDoctorAuth, logAudit } from '@/lib/medical-auth';
import { handleApiError } from '@/lib/api-error-handler';
import { getChatProvider } from '@/lib/ai';
import { logTokenUsage } from '@/lib/ai/log-token-usage';
import { dictParaRender, formatoDe, leerPdfBase } from '@/lib/informe-medico/formatos';
import { geometriaCacheada } from '@/lib/informe-medico/campos-del-informe';
import { camposDictables } from '@/lib/informe-medico/campos-dictables';
import { etiquetasCacheadas } from '@/lib/informe-medico/etiquetas-de-la-hoja';
import { consultasParaModelo, MAX_CONSULTAS } from '@/lib/informe-medico/contexto-clinico';
import { caracteresNoImprimibles } from '@/lib/informe-medico/winansi';
import { leerAnswers, resolverClave, type Answers } from '@/lib/informe-medico/types';
import { transcribirAudio } from '@/lib/voice/transcribir-audio';
import { promptSistemaDictado, promptUsuarioDictado } from '@/lib/informe-medico/prompt-dictado';

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
// ESA página.
//
// 🔴 NO ESCRIBE. Devuelve valores PROPUESTOS y el cliente los pinta pendientes
// sobre la hoja; el `PATCH` sale al Guardar (06-AGENTE §2, decisión 1B). Esto
// REVIERTE lo que decía 05-VOZ §4 ("escribe directo en el borrador"): con el
// chat proponiendo encima, lo dictado guardado y lo tecleado sin guardar era
// justo la ambigüedad que 1B vino a quitar.
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
    /** Lo que el doctor tiene en pantalla y todavía no guarda (1B). */
    let pendientes: Record<string, string> = {};

    if (request.headers.get('content-type')?.includes('multipart/form-data')) {
      const fd = await request.formData();
      const audio = fd.get('audio');
      const p = fd.get('pagina');
      pagina = typeof p === 'string' && /^\d+$/.test(p) ? Number(p) : null;
      const adj = fd.get('adjuntarEncounterIds');
      if (typeof adj === 'string') {
        try {
          const arr = JSON.parse(adj);
          if (Array.isArray(arr)) adjuntarEncounterIds = arr.filter((x) => typeof x === 'string').slice(0, MAX_CONSULTAS);
        } catch { /* sin adjuntos */ }
      }
      const pend = fd.get('pendientes');
      if (typeof pend === 'string') {
        try {
          const o = JSON.parse(pend);
          if (o && typeof o === 'object' && !Array.isArray(o)) pendientes = o as Record<string, string>;
        } catch { /* sin pendientes */ }
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
        ? body.adjuntarEncounterIds.filter((x: unknown) => typeof x === 'string').slice(0, MAX_CONSULTAS)
        : [];
      if (body?.pendientes && typeof body.pendientes === 'object' && !Array.isArray(body.pendientes)) {
        pendientes = body.pendientes as Record<string, string>;
      }
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

    // Sólo campos de TEXTO, deduplicados por clave y con su capacidad real: la
    // MISMA lista que ve el chat (`campos-dictables.ts`), acotada a esta página.
    // Y con las etiquetas que dice la HOJA, para que `Día_4` se le presente al
    // modelo como "Fecha de cirugía:" igual que en el chat.
    const { contexto } = await etiquetasCacheadas(
      `${formato.insurer}|${formato.name}|${formato.version}|${report.form.updatedAt.toISOString()}`,
      dict,
      () => leerPdfBase(formato)
    );
    const campos = camposDictables(geo, pagina, contexto);
    if (campos.length === 0) {
      return NextResponse.json({ error: 'Esta página no tiene campos que se puedan dictar' }, { status: 400 });
    }
    const clavesValidas = new Set(campos.map((c) => c.clave));

    // 🔴 Lo guardado CON lo pendiente encima. Desde 1B nada se persiste hasta
    // que el doctor aprieta Guardar, así que `answers` a secas está siempre
    // atrasado: el doctor dicta la página 1, corrige dos campos a mano, vuelve a
    // dictar, y este bloque salía VACÍO — el modelo re-proponía los mismos
    // campos y pisaba las correcciones. Es el mismo `pendientes` que manda el
    // chat.
    const answers = leerAnswers(report.answers);
    const yaLleno = campos
      .map((c) => ({
        etiqueta: c.etiqueta,
        valor: typeof pendientes[c.clave] === 'string'
          ? pendientes[c.clave]
          : (answers[c.clave]?.value ?? ''),
      }))
      .filter((v) => v.valor.trim() !== '');

    // Adjuntos: consultas del MISMO paciente y doctor (lo comprueba el `where`
    // de `consultasParaModelo`, no se confía en los ids del cliente).
    const adjuntos = await consultasParaModelo(adjuntarEncounterIds, patientId, doctorId);

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
    for (const [devuelta, bruto] of Object.entries(propuesto)) {
      // 🔴 El modelo se come el prefijo `campo:` — devuelve `Día_4` donde el
      // catálogo dice `campo:Día_4`. Medido contra gpt-4o (2026-08-10). Con la
      // comprobación a secas se descartaba TODO lo que no fuera una clave
      // canónica, que es la mayor parte de la hoja: es la explicación más
      // probable del viejo "el dictado sólo sirve en las páginas simples".
      const clave = resolverClave(devuelta, clavesValidas) ?? devuelta;
      if (bruto === null || bruto === undefined) continue;      // "no sé" — se respeta
      // Sólo texto: un objeto anidado se volvía el literal "[object Object]" y
      // llegaba hasta el PDF. Mismo arreglo que en `chat/route.ts`.
      if (typeof bruto !== 'string' && typeof bruto !== 'number') {
        descartados.push({ clave, motivo: 'no-es-texto' });
        continue;
      }
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
