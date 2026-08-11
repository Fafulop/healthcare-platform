import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@healthcare/database';
import { requireDoctorAuth, logAudit } from '@/lib/medical-auth';
import { handleApiError } from '@/lib/api-error-handler';
import { etiquetaCanonica } from '@/lib/informe-medico/canonical';
import { dictParaRender, formatoDe } from '@/lib/informe-medico/formatos';
import { clavesDelInforme, geometriaCacheada } from '@/lib/informe-medico/campos-del-informe';
import { cargarPrefill } from '@/lib/informe-medico/cargar-prefill';
import { leerFuentes, leerFuentesPedidas, resolverFuentesElegidas } from '@/lib/informe-medico/contexto-clinico';
import { leerAnswers, type Answers, type AnswerValue } from '@/lib/informe-medico/types';

/**
 * Los `origin` que puede escribir el CLIENTE.
 *
 * `voice` y `llm` entran porque el flujo es **propuesta → la hoja → Guardar**:
 * el servidor propone, pero **el que escribe es el cliente** cuando el doctor
 * confirma (06-AGENTE §3). Sin ellos, guardar una tanda dictada devolvería 400.
 *
 * 🔴 `deterministic` NO está, y es lo que importa: eso sólo lo pone el servidor
 * al pre-llenar. Si el cliente pudiera declararlo, se borraría la diferencia
 * entre "lo copió el sistema del expediente" y "alguien lo escribió" en un
 * documento médico-legal. Un campo que el doctor vacía queda en `empty`.
 */
const ORIGENES_DEL_CLIENTE = new Set(['manual', 'empty', 'voice', 'llm']);

/** `origin -> source`. El servidor la fija; el cliente no la manda. */
const FUENTE_POR_ORIGEN: Partial<Record<AnswerValue['origin'], string | null>> = {
  manual: 'doctor',
  voice: 'dictado',
  llm: 'asistente',
  empty: null,
};

function saneaAnswers(entrada: unknown): Answers | { error: string } {
  if (typeof entrada !== 'object' || entrada === null || Array.isArray(entrada)) {
    return { error: 'answers debe ser un objeto' };
  }
  const salida: Answers = {};
  for (const [clave, bruto] of Object.entries(entrada as Record<string, unknown>)) {
    if (typeof bruto !== 'object' || bruto === null) return { error: `answers.${clave} no es un objeto` };
    const v = bruto as Partial<AnswerValue>;
    if (typeof v.value !== 'string') return { error: `answers.${clave}.value debe ser string` };
    if (typeof v.origin !== 'string' || !ORIGENES_DEL_CLIENTE.has(v.origin)) {
      return {
        error: `answers.${clave}.origin debe ser uno de: ${[...ORIGENES_DEL_CLIENTE].join(', ')}`,
      };
    }
    salida[clave] = {
      value: v.value,
      // La fuente la fija el SERVIDOR según el origin, no se le cree al cliente:
      // decir "del expediente" sobre algo tecleado es justo lo que la
      // procedencia existe para impedir. Y `voice` y `llm` NO son lo mismo: lo
      // dictado lo dijo el médico con su boca; lo del chat lo redactó el modelo
      // a partir de la conversación. En un documento médico-legal, quién lo
      // escribió es la mitad del dato.
      source: FUENTE_POR_ORIGEN[v.origin as AnswerValue['origin']] ?? null,
      origin: v.origin as AnswerValue['origin'],
    };
  }
  return salida;
}

// GET /api/medical-records/patients/:id/reports/:reportId
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; reportId: string }> }
) {
  try {
    const { doctorId, userId, role } = await requireDoctorAuth(request);
    const { id: patientId, reportId } = await params;

    const report = await prisma.medicalReport.findFirst({
      where: { id: reportId, patientId, doctorId },
      include: { form: { select: { id: true, insurer: true, name: true, version: true, fieldDict: true, updatedAt: true } } },
    });
    if (!report) return NextResponse.json({ error: 'Informe no encontrado' }, { status: 404 });

    const formato = formatoDe(report.form);
    const answers = leerAnswers(report.answers);

    // Los campos llenables: la unión de la hoja, el diccionario y lo ya guardado
    // (ver `clavesDelInforme`). Recorrer sólo la hoja dejaba la lista VACÍA en un
    // formato con la página rotada, y escondía respuestas que sí se escriben en
    // el PDF.
    let claves: string[] = [];
    if (formato) {
      const dict = dictParaRender(formato, report.form.fieldDict);
      const geo = await geometriaCacheada(formato, dict, report.form.updatedAt.toISOString());
      claves = clavesDelInforme(geo, dict, answers);
    }

    // Los avisos se RECALCULAN, no se guardan. Si sólo viajaran en la respuesta
    // del POST, un doctor que pre-llena, recarga y emite al día siguiente nunca
    // vería "el apellido se partió a ojo" ni "hay 14 medicamentos y caben 10" —
    // que es exactamente lo que no debe pasar: firmar algo que nadie le advirtió.
    // Se recalculan del expediente ACTUAL a propósito: si el dato cambió, el
    // aviso que importa es el de ahora.
    let avisos: unknown[] = [];
    if (report.encounterId) {
      try {
        avisos = (await cargarPrefill({ doctorId, patientId, encounterId: report.encounterId })).avisos;
      } catch {
        // Si la consulta ya no se puede leer, el informe se sigue mostrando: los
        // avisos son una ayuda, no un requisito para abrir lo ya guardado.
        avisos = [];
      }
    }

    await logAudit({
      patientId, doctorId, userId, userRole: role,
      action: 'VIEW', resourceType: 'MedicalReport', resourceId: reportId, request,
    });

    return NextResponse.json({
      report: {
        id: report.id, status: report.status, encounterId: report.encounterId,
        consentGiven: report.consentGiven, consentAt: report.consentAt,
        issuedAt: report.issuedAt,
        // Las fuentes elegidas, para que el panel abra marcado lo que ya se eligió.
        sources: leerFuentes(report.sources),
        form: { id: report.form.id, insurer: report.form.insurer, name: report.form.name, version: report.form.version },
      },
      // 🔴 La lista muestra los MISMOS campos que el visor: todos los blancos
      // del formato, no sólo los 60 del diccionario. Si las dos vistas ofrecen
      // conjuntos distintos, el doctor llena algo en una y no lo encuentra en la
      // otra — que es justo el desajuste que había entre el visor y el borrador
      // descargado.
      campos: claves.map((clave) => ({
        clave,
        etiqueta: etiquetaCanonica(clave),
        valor: answers[clave] ?? { value: '', source: null, origin: 'empty' },
      })),
      avisos,
      generable: formato !== undefined,
    });
  } catch (error) {
    return handleApiError(error, 'GET /api/medical-records/patients/:id/reports/:reportId');
  }
}

// PATCH — las correcciones del doctor, el consentimiento y la emisión.
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; reportId: string }> }
) {
  try {
    const { doctorId, userId, role } = await requireDoctorAuth(request);
    const { id: patientId, reportId } = await params;
    const body = await request.json();

    const actual = await prisma.medicalReport.findFirst({
      where: { id: reportId, patientId, doctorId },
    });
    if (!actual) return NextResponse.json({ error: 'Informe no encontrado' }, { status: 404 });

    // 🔴 Un informe EMITIDO ya salió firmado hacia la aseguradora. Editarlo en
    // su lugar dejaría el archivo que ellos tienen y el que nosotros guardamos
    // diciendo cosas distintas, sin rastro. Se emite uno nuevo.
    // (01-FUENTES §8 #2 sigue abierta: versiones vs. inmutabilidad.)
    if (actual.status === 'issued') {
      return NextResponse.json(
        { error: 'Este informe ya fue emitido. Genera uno nuevo para hacer cambios.' },
        { status: 409 }
      );
    }

    const data: Record<string, unknown> = {};
    /** Fuentes que se pidieron y ya no se pudieron leer: se guardan SIN ellas y
     * se dicen. Rechazar el PATCH entero dejaba el informe atorado. */
    let fuentesDescartadas: unknown[] = [];

    if (body?.answers !== undefined) {
      const sane = saneaAnswers(body.answers);
      if ('error' in sane) return NextResponse.json({ error: sane.error }, { status: 400 });
      // Se fusiona sobre lo guardado: el cliente manda sólo lo que cambió, y un
      // PATCH parcial no debe borrar el pre-llenado que no tocó.
      data.answers = { ...leerAnswers(actual.answers), ...sane } as object;
    }

    // 🔴 Las FUENTES se pueden cambiar mientras el informe sea borrador; el
    // ANCLA no (07-PLAN §10 #3): cambiarla invalidaría el pre-llenado verde que
    // el doctor ya revisó, así que se genera un informe nuevo. Por eso este
    // PATCH no acepta `encounterId`.
    if (body?.sources !== undefined) {
      const pedidas = leerFuentesPedidas(body.sources);
      if ('error' in pedidas) return NextResponse.json({ error: pedidas.error }, { status: 400 });
      const resuelto = await resolverFuentesElegidas(pedidas, patientId, doctorId, actual.encounterId);
      if (!resuelto.ok) return NextResponse.json({ error: resuelto.error }, { status: 409 });
      // Se REEMPLAZA, no se fusiona: el panel manda la selección completa, y
      // fusionar haría imposible DESmarcar una fuente.
      data.sources = resuelto.fuentes as object;
      fuentesDescartadas = resuelto.descartadas;
    }

    if (body?.consentGiven !== undefined) {
      if (typeof body.consentGiven !== 'boolean') {
        return NextResponse.json({ error: 'consentGiven debe ser booleano' }, { status: 400 });
      }
      data.consentGiven = body.consentGiven;
      data.consentAt = body.consentGiven ? new Date() : null;
    }

    if (body?.status === 'issued') {
      // Mandar datos clínicos a una aseguradora es una transferencia a un
      // TERCERO bajo LFPDPPP: sin el consentimiento registrado no se emite.
      const consiente = body?.consentGiven ?? actual.consentGiven;
      if (!consiente) {
        return NextResponse.json(
          { error: 'Falta registrar el consentimiento del paciente antes de emitir.' },
          { status: 409 }
        );
      }
      data.status = 'issued';
      data.issuedAt = new Date();
    }

    if (Object.keys(data).length === 0) {
      return NextResponse.json({ error: 'Nada que actualizar' }, { status: 400 });
    }

    const report = await prisma.medicalReport.update({
      where: { id: reportId },
      data,
      select: {
        id: true, status: true, consentGiven: true, consentAt: true, issuedAt: true,
        sources: true,
      },
    });

    await logAudit({
      patientId, doctorId, userId, userRole: role,
      action: 'UPDATE', resourceType: 'MedicalReport', resourceId: reportId,
      changes: { camposTocados: Object.keys(data) }, request,
    });

    return NextResponse.json({
      report: { ...report, sources: leerFuentes(report.sources) },
      fuentesDescartadas,
    });
  } catch (error) {
    return handleApiError(error, 'PATCH /api/medical-records/patients/:id/reports/:reportId');
  }
}
