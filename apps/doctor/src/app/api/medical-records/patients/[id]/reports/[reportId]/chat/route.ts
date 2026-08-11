import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@healthcare/database';
import { requireDoctorAuth, logAudit } from '@/lib/medical-auth';
import { handleApiError } from '@/lib/api-error-handler';
import { getChatProvider, type ChatMessage } from '@/lib/ai';
import { logTokenUsage } from '@/lib/ai/log-token-usage';
import { dictParaRender, formatoDe, leerPdfBase } from '@/lib/informe-medico/formatos';
import { geometriaCacheada } from '@/lib/informe-medico/campos-del-informe';
import { camposDictables } from '@/lib/informe-medico/campos-dictables';
import { casillasParaElAgente, etiquetasCacheadas } from '@/lib/informe-medico/etiquetas-de-la-hoja';
import {
  consultasParaModelo, fuentesParaModelo, leerFuentes, PRESUPUESTO_TOKENS_FUENTES,
} from '@/lib/informe-medico/contexto-clinico';
import { caracteresNoImprimibles } from '@/lib/informe-medico/winansi';
import { leerAnswers, resolverClave, type Answers } from '@/lib/informe-medico/types';
import { transcribirAudio } from '@/lib/voice/transcribir-audio';
import { promptsSistemaChat } from '@/lib/informe-medico/prompt-chat';

const MODEL = 'gpt-4o';
const MAX_TOKENS = 2048;
const TEMPERATURE = 0;

/** Cuántos turnos de historial se le mandan al modelo. */
const MAX_MENSAJES = 16;
/** Tope por mensaje. Un dictado largo cabe; un pegado de 300 KB no. */
const MAX_CARACTERES_MENSAJE = 6000;

/** Lo que el modelo propuso y NO se pudo colocar, para decirlo en vez de tragárselo. */
interface Descartado {
  clave: string;
  motivo: 'campo-inexistente' | 'caracteres-no-imprimibles' | 'no-es-texto' | 'opcion-inexistente';
  caracteres?: string[];
  /** Sólo `opcion-inexistente`: qué se podía elegir de verdad. */
  opciones?: string[];
}

/** Para comparar la etiqueta que devuelve el modelo con la de la hoja sin que
 * un acento, una mayúscula o un espacio de más tire la propuesta. */
function normalizar(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();
}

interface MensajeCliente { role: 'user' | 'assistant'; content: string }

/** El historial que manda el cliente, saneado. No se le cree nada al navegador. */
function leerMensajes(bruto: unknown): MensajeCliente[] {
  if (!Array.isArray(bruto)) return [];
  const salida: MensajeCliente[] = [];
  for (const m of bruto) {
    if (typeof m !== 'object' || m === null) continue;
    const { role, content } = m as { role?: unknown; content?: unknown };
    // 🔴 `system` NO se acepta del cliente: dejaría que el navegador reescribiera
    // las reglas anti-invención desde la consola. Las de sistema las pone este
    // archivo y nadie más.
    if (role !== 'user' && role !== 'assistant') continue;
    if (typeof content !== 'string' || content.trim() === '') continue;
    salida.push({ role, content: content.slice(0, MAX_CARACTERES_MENSAJE) });
  }
  return salida.slice(-MAX_MENSAJES);
}

// POST /api/medical-records/patients/:id/reports/:reportId/chat
//
// El doctor CONVERSA con el formato (06-AGENTE). El agente ya conoce la hoja:
// dice qué falta, pregunta, y coloca lo que el doctor le cuenta.
//
// 🔴 ESTE ENDPOINT NO ESCRIBE NADA. Devuelve valores PROPUESTOS; el cliente los
// pinta pendientes sobre la hoja y el `PATCH` sale sólo cuando el doctor aprieta
// Guardar (06-AGENTE §3: propuesta → la hoja es el card → confirma → ejecuta el
// CLIENTE).
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; reportId: string }> }
) {
  try {
    const { doctorId, userId, role } = await requireDoctorAuth(request);
    const { id: patientId, reportId } = await params;

    // El mensaje puede llegar tecleado (JSON) o hablado (multipart). El audio se
    // transcribe AQUÍ y no en `/api/voice/transcribe`: esa ruta es OWNER_ONLY y
    // un usuario secundario con `expedientes` —que sí puede hacer informes—
    // recibiría un PERMISSION_BLOCKED. Ver `transcribir-audio.ts`.
    let mensaje = '';
    let transcript: string | null = null;
    let mensajes: MensajeCliente[] = [];
    let pendientes: Record<string, string> = {};

    const leerJson = (s: unknown): unknown => {
      if (typeof s !== 'string') return null;
      try { return JSON.parse(s); } catch { return null; }
    };

    if (request.headers.get('content-type')?.includes('multipart/form-data')) {
      const fd = await request.formData();
      const audio = fd.get('audio');
      if (!(audio instanceof File)) {
        return NextResponse.json({ error: 'No se recibió el audio' }, { status: 400 });
      }
      const t = await transcribirAudio(audio);
      if (!t.ok) return NextResponse.json({ error: t.mensaje }, { status: 400 });
      mensaje = t.transcript.trim();
      transcript = mensaje;
      mensajes = leerMensajes(leerJson(fd.get('mensajes')));
      const p = leerJson(fd.get('pendientes'));
      if (p && typeof p === 'object' && !Array.isArray(p)) pendientes = p as Record<string, string>;
    } else {
      const body = await request.json();
      mensaje = typeof body?.mensaje === 'string' ? body.mensaje.trim() : '';
      mensajes = leerMensajes(body?.mensajes);
      if (body?.pendientes && typeof body.pendientes === 'object' && !Array.isArray(body.pendientes)) {
        pendientes = body.pendientes as Record<string, string>;
      }
    }

    if (mensaje === '') {
      return NextResponse.json({ error: 'No se recibió el mensaje' }, { status: 400 });
    }
    mensaje = mensaje.slice(0, MAX_CARACTERES_MENSAJE);

    const report = await prisma.medicalReport.findFirst({
      where: { id: reportId, patientId, doctorId },
      include: { form: true },
    });
    if (!report) return NextResponse.json({ error: 'Informe no encontrado' }, { status: 404 });

    // 🔴 Un informe emitido ya salió firmado. No se conversa encima: el doctor
    // aceptaría propuestas que no puede guardar.
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

    // 🔴 Lo que la HOJA dice alrededor de cada campo. Sin esto el modelo recibía
    // `campo:Día_4` (que es la fecha de cirugía) y `Consultorio_2` (que es el
    // grupo Consultorio/Hospital/Gabinete/Otro): no podía elegir ninguno de los
    // dos, y por eso ni las fechas aterrizaban ni se marcaba una casilla.
    const { contexto, casillas: todasLasCasillas } = await etiquetasCacheadas(
      `${formato.insurer}|${formato.name}|${formato.version}|${report.form.updatedAt.toISOString()}`,
      dict,
      () => leerPdfBase(formato)
    );
    // 🔴 NO todas las casillas: quedan fuera los consentimientos del paciente,
    // las declaraciones de facturación y los grupos que no se pueden nombrar.
    // Esta MISMA lista alimenta el prompt y la validación, así que el modelo no
    // puede marcar algo que no se le ofreció.
    const casillas = casillasParaElAgente(todasLasCasillas);

    // La hoja ENTERA, no una página: el agente sólo puede decir "qué falta" si la
    // ve completa. Medido: los 255 campos de AXA son ~3,800 tokens (prompt-chat).
    const campos = camposDictables(geo, null, contexto);
    if (campos.length === 0) {
      return NextResponse.json({ error: 'Este formato no tiene campos que se puedan llenar' }, { status: 400 });
    }
    const clavesValidas = new Set(campos.map((c) => c.clave));

    // El estado que el doctor TIENE DELANTE: lo guardado con lo pendiente
    // encima. Sin los pendientes, el agente propone otra vez lo que él acaba de
    // aceptar hace dos turnos y todavía no guarda.
    const guardadas = leerAnswers(report.answers);
    const estado = new Map<string, string>();
    for (const c of campos) {
      const v = typeof pendientes[c.clave] === 'string'
        ? pendientes[c.clave]
        : (guardadas[c.clave]?.value ?? '');
      if (v.trim() !== '') estado.set(c.clave, v);
    }
    const yaLleno = campos
      .filter((c) => estado.has(c.clave))
      .map((c) => ({ clave: c.clave, etiqueta: c.etiqueta, valor: estado.get(c.clave)! }));

    // 🔴 Las CASILLAS ya marcadas también cuentan como "ya está escrito". Sin
    // esto el modelo era CIEGO a ellas: el doctor marcaba "Hospitalización",
    // preguntaba qué falta, y el agente la listaba como faltante y la volvía a
    // proponer cada turno — el bucle de re-propuesta que los `pendientes`
    // existen para evitar. Se reporta la ETIQUETA, no el on-state: `/H` no
    // significa nada para el modelo.
    for (const g of casillas) {
      const crudo = typeof pendientes[g.clave] === 'string'
        ? pendientes[g.clave]
        : (guardadas[g.clave]?.value ?? '');
      if (crudo.trim() === '') continue;
      const opcion = g.opciones.find((o) => o.onState === crudo);
      yaLleno.push({
        clave: g.clave,
        etiqueta: g.pregunta ?? g.clave,
        valor: opcion ? opcion.etiqueta : crudo,
      });
    }

    // 🔴 El alcance clínico (06-AGENTE §7.1 · 07-PLAN §4): entra la consulta
    // ANCLA —el doctor la eligió al crear el informe y el pre-llenado ya la
    // leyó— más las FUENTES que él marcó en el panel. Los ids salen de la
    // COLUMNA, no del navegador, y aun así se vuelven a acotar por paciente y
    // doctor en el `where`: la columna la escribió otra petición.
    const consultas = await consultasParaModelo(
      report.encounterId ? [report.encounterId] : [], patientId, doctorId
    );
    const { fuentes, faltantes, tokensAprox } = await fuentesParaModelo(
      leerFuentes(report.sources), patientId, doctorId, report.encounterId
    );

    // 🔴 Si lo elegido dejó de caber —una nota creció después de marcarla— NO se
    // recorta solo (07-PLAN §11): se le pide al doctor que deseleccione. Un
    // recorte callado es indistinguible de "el modelo lo ignoró", y él eligió
    // esas fuentes a propósito.
    if (tokensAprox > PRESUPUESTO_TOKENS_FUENTES) {
      return NextResponse.json({
        error: `Las fuentes que elegiste ya no caben en la conversación (${tokensAprox} de `
          + `${PRESUPUESTO_TOKENS_FUENTES}): alguna creció desde que la marcaste. Quita una `
          + `en "Fuentes del expediente" y vuelve a intentarlo.`,
      }, { status: 409 });
    }

    const ctx = {
      formato: `${report.form.insurer} — ${report.form.name}`,
      campos,
      casillas,
      yaLleno,
      consultas,
      fuentes,
    };
    const [estable, volatil] = promptsSistemaChat(ctx);

    const historial: ChatMessage[] = [
      { role: 'system', content: estable },
      { role: 'system', content: volatil },
      ...mensajes.map((m) => ({ role: m.role, content: m.content }) as ChatMessage),
      { role: 'user', content: mensaje },
    ];

    const { content, usage } = await getChatProvider().chatCompletion(historial, {
      model: MODEL, maxTokens: MAX_TOKENS, temperature: TEMPERATURE, jsonMode: true,
    });

    logTokenUsage({
      doctorId,
      endpoint: 'informe-chat',
      model: MODEL,
      provider: process.env.LLM_PROVIDER || 'openai',
      usage,
    });

    let respuesta: { mensaje?: unknown; campos?: unknown; casillas?: unknown };
    try {
      respuesta = JSON.parse(content.replace(/^```(?:json)?\s*|\s*```$/g, '').trim());
    } catch {
      return NextResponse.json({ error: 'El modelo devolvió una respuesta que no se pudo leer' }, { status: 502 });
    }
    if (typeof respuesta !== 'object' || respuesta === null || Array.isArray(respuesta)) {
      return NextResponse.json({ error: 'El modelo no devolvió una respuesta con la forma esperada' }, { status: 502 });
    }

    // ── 🔴 VALIDACIÓN SERVER-SIDE (regla 0) ─────────────────────────────────
    // No se le cree al modelo que un campo existe: se comprueba contra la hoja.
    const valores: Answers = {};
    const descartados: Descartado[] = [];
    const propuestos = (typeof respuesta.campos === 'object' && respuesta.campos !== null && !Array.isArray(respuesta.campos))
      ? respuesta.campos as Record<string, unknown>
      : {};

    const propuestasCasillas = (typeof respuesta.casillas === 'object' && respuesta.casillas !== null && !Array.isArray(respuesta.casillas))
      ? respuesta.casillas as Record<string, unknown>
      : {};

    // Los dos catálogos van en el mismo prompt, así que el modelo mete de vez en
    // cuando una casilla bajo `campos`. Se resuelve como casilla en vez de
    // decirle al doctor "no existe en esta hoja" de un grupo que SÍ existe.
    const porClave = new Map(casillas.map((g) => [g.clave, g]));
    const clavesDeCasillas = new Set(porClave.keys());

    for (const [devuelta, bruto] of Object.entries(propuestos)) {
      // 🔴 ANTES de juzgar nada: el modelo se come el prefijo `campo:` (medido
      // contra gpt-4o). Sin esto, todo lo que no sea una clave canónica se
      // descartaba en silencio, que es la mayor parte de la hoja.
      const clave = resolverClave(devuelta, clavesValidas)
        ?? resolverClave(devuelta, clavesDeCasillas)
        ?? devuelta;

      // Una casilla que llegó bajo `campos` (pasa, van los dos catálogos en el
      // mismo prompt) se manda a la rama de casillas en vez de mentir con
      // "no existe en esta hoja".
      if (porClave.has(clave)) {
        propuestasCasillas[clave] ??= bruto;
        continue;
      }
      if (bruto === null || bruto === undefined) continue;   // "no sé" — se respeta
      // 🔴 Sólo texto. `String(bruto)` convertía un objeto anidado —que el
      // modelo produce de vez en cuando bajo jsonMode, p.ej.
      // `{"diagnostico":{"cie10":"C50"}}`— en el literal `"[object Object]"`,
      // que pasa el resto de las comprobaciones, cae en ámbar sobre la hoja y se
      // puede guardar en un documento médico-legal.
      if (typeof bruto !== 'string' && typeof bruto !== 'number') {
        descartados.push({ clave, motivo: 'no-es-texto' });
        continue;
      }
      const valor = String(bruto).trim();
      if (valor === '') continue;                            // vacío NO borra

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
      valores[clave] = { value: valor, source: 'asistente', origin: 'llm' };
    }

    // ── Las CASILLAS: la etiqueta que devuelve el modelo → el on-state ──────
    //
    // 🔴 El modelo devuelve LO QUE DICE LA HOJA ("Hospitalización"), nunca un
    // on-state. El on-state (`/H`) lo resuelve el servidor contra el PDF: si el
    // modelo pudiera mandarlo, un `/2` inventado marcaría una opción que nadie
    // eligió en un documento que el médico firma.
    //
    // ⚠️ `casillas` YA viene filtrado (`casillasParaElAgente`): un grupo de
    // consentimiento no está aquí, así que cae en `campo-inexistente` — que es
    // el resultado correcto, no un hueco.
    for (const [devuelta, bruto] of Object.entries(propuestasCasillas)) {
      if (typeof bruto !== 'string' || bruto.trim() === '') continue;
      // Mismo problema del prefijo: el modelo devuelve `TE`, el catálogo dice
      // `campo:TE`. Medido: así se perdían LAS SEIS casillas de un turno bueno.
      const clave = resolverClave(devuelta, clavesDeCasillas) ?? devuelta;
      const grupo = porClave.get(clave);
      if (!grupo) {
        descartados.push({ clave, motivo: 'campo-inexistente' });
        continue;
      }
      const pedida = normalizar(bruto);
      const opcion = grupo.opciones.find((o) => normalizar(o.etiqueta) === pedida);
      if (!opcion) {
        // No se aproxima "la más parecida": marcar la opción equivocada de un
        // grupo excluyente es afirmarle algo falso a la aseguradora.
        descartados.push({ clave, motivo: 'opcion-inexistente', opciones: grupo.opciones.map((o) => o.etiqueta) });
        continue;
      }
      valores[clave] = { value: opcion.onState, source: 'asistente', origin: 'llm' };
    }

    const texto = typeof respuesta.mensaje === 'string' ? respuesta.mensaje.trim() : '';

    await logAudit({
      patientId, doctorId, userId, userRole: role,
      // VIEW y no UPDATE: este endpoint LEE el expediente y no escribe nada.
      action: 'VIEW', resourceType: 'MedicalReport', resourceId: reportId,
      changes: {
        via: 'chat-informe',
        turnos: mensajes.length + 1,
        propuestos: Object.keys(valores),
        descartados: descartados.length,
        // Qué se le mandó al modelo (05-VOZ §7.5). Con fuentes a nivel paciente
        // esto es lo que contesta "de dónde sacó eso" dentro de un año.
        consultas: report.encounterId ? [report.encounterId] : [],
        fuentes: fuentes.map((f) => `${f.tipo}:${f.id}`),
        porVoz: transcript !== null,
      },
      request,
    });

    return NextResponse.json({
      // Lo que el agente le dice al doctor. Si el modelo se olvidó del texto, se
      // dice algo en vez de dejar una burbuja vacía que parece un cuelgue.
      mensaje: texto || (Object.keys(valores).length > 0
        ? 'Puse lo que entendí en la hoja. Revísalo.'
        : 'No pude sacar nada de eso. ¿Me lo dices de otra forma?'),
      // `clave -> {value, source, origin}` para que el cliente los ponga
      // pendientes tal cual, con su procedencia.
      valores,
      // Lo descartado NO se calla: si el doctor dijo algo y no aparece en la
      // hoja, tiene que saber por qué.
      descartados,
      // 🔴 Fuentes que el doctor eligió y que ya NO se pudieron leer (se borró la
      // nota, la receta volvió a borrador, quedó vacía). Sin decirlo, el turno se
      // contesta sin ellas y se ve idéntico a uno completo.
      //
      // Va la FECHA guardada, no sólo el tipo: "nota · nota" no le dice al doctor
      // CUÁL falta, y sin saber cuál no puede ir a quitarla del panel.
      fuentesFaltantes: faltantes.map((f) => ({ tipo: f.tipo, fecha: f.fecha })),
      // Lo que se oyó, para que el doctor vea si Whisper lo entendió mal.
      transcript,
    });
  } catch (error) {
    return handleApiError(error, 'POST /api/medical-records/patients/:id/reports/:reportId/chat');
  }
}
