/**
 * POST /api/ayuda/chat — el widget de Ayuda.
 *
 * Contesta CÓMO SE USA la plataforma, desde `lib/ayuda/manual-del-doctor.md`. Lo que NO
 * tiene es la mitad del diseño (AYUDA WIDGET/01-ARQUITECTURA §5): cero tools, cero lecturas
 * de la BD del doctor, cero escrituras. La única consulta a la BD es el tope diario.
 *
 * Request:  { messages: {role, content}[], pathname?: string }
 * Response: { success, data: { respuesta, seccion, enlaces } }
 *
 * Disponible en TODOS los planes (decisión 2026-09-22): quien no tiene soporte humano es
 * justo el plan barato. Por eso su regla en el route map NO lleva `feature: 'ia'`, y el
 * costo se acota con un tope diario de preguntas por doctor.
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@healthcare/database';
import { requireDoctorAuth } from '@/lib/medical-auth';
import { handleApiError } from '@/lib/api-error-handler';
import { logTokenUsage } from '@/lib/ai/log-token-usage';
import { mxTodayKey } from '@/lib/agenda-agent/dates';
import { cargarManual } from '@/lib/ayuda/manual';
import { promptEstable, promptVolatil } from '@/lib/ayuda/prompt';
import { pantallaActual } from '@/lib/ayuda/mapa-de-rutas';
import { responder, type MensajeAyuda } from '@/lib/ayuda/proveedor';
import { interpretarRespuesta } from '@/lib/ayuda/respuesta';

const ENDPOINT = 'ayuda-chat';
/** Una conversación de ayuda no necesita memoria infinita: sólo viajan los últimos. */
const MAX_MENSAJES = 20;
const MAX_CARACTERES = 2000;
/** Los turnos del asistente vuelven como el JSON que el modelo produjo (respuesta + sección +
 * enlaces): recortarlos a 2000 los dejaría como JSON roto en la historia que se le reenvía. */
const MAX_CARACTERES_ASISTENTE = 8000;
// Validado: `Number('60/día')` es NaN y `n >= NaN` es SIEMPRE false — un typo en Railway
// apagaría el tope en silencio para todos los doctores.
const TOPE_DIARIO = (() => {
  const n = Number(process.env.AYUDA_TOPE_DIARIO);
  return Number.isFinite(n) && n > 0 ? n : 60;
})();

/** Preguntas de hoy (día de México, no UTC). Cada pregunta contestada deja UNA fila. */
async function preguntasDeHoy(doctorId: string): Promise<number> {
  const inicioDelDia = new Date(mxTodayKey() + 'T00:00:00-06:00');
  return prisma.llmTokenUsage.count({
    where: { doctorId, endpoint: ENDPOINT, createdAt: { gte: inicioDelDia } },
  });
}

function limpiarMensajes(raw: unknown): MensajeAyuda[] | null {
  if (!Array.isArray(raw) || raw.length === 0) return null;
  const mensajes: MensajeAyuda[] = [];
  for (const m of raw) {
    if (!m || typeof m !== 'object') return null;
    const { role, content } = m as { role?: unknown; content?: unknown };
    if ((role !== 'user' && role !== 'assistant') || typeof content !== 'string' || !content.trim()) {
      return null;
    }
    mensajes.push({
      role,
      content: content.slice(0, role === 'assistant' ? MAX_CARACTERES_ASISTENTE : MAX_CARACTERES),
    });
  }
  const recortados = mensajes.slice(-MAX_MENSAJES);
  // El primero tiene que ser del doctor (Anthropic lo exige, y un historial que empieza
  // con una respuesta es un recorte a medias), y el último también: es la pregunta.
  while (recortados.length > 0 && recortados[0].role !== 'user') recortados.shift();
  if (recortados.length === 0 || recortados[recortados.length - 1].role !== 'user') return null;
  return recortados;
}

export async function POST(request: NextRequest) {
  try {
    const { doctorId } = await requireDoctorAuth(request);

    const body = await request.json().catch(() => null);
    const mensajes = limpiarMensajes(body?.messages);
    if (!mensajes) {
      return NextResponse.json(
        { success: false, error: { code: 'BAD_REQUEST', message: 'La conversación no es válida.' } },
        { status: 400 }
      );
    }

    if ((await preguntasDeHoy(doctorId)) >= TOPE_DIARIO) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'TOPE_DIARIO',
            message: `Llegaste al límite de ${TOPE_DIARIO} preguntas de hoy. Mañana puedes seguir preguntando.`,
          },
        },
        { status: 429 }
      );
    }

    const manual = cargarManual();
    const pathname = typeof body?.pathname === 'string' ? body.pathname : null;
    const resultado = await responder({
      estable: promptEstable(manual),
      volatil: promptVolatil(pantallaActual(pathname)),
      mensajes,
    });

    // Se registra ANTES de interpretar: la llamada ya costó, conteste bien o no, y esta
    // fila es también la que cuenta para el tope diario.
    logTokenUsage({
      doctorId,
      endpoint: ENDPOINT,
      model: resultado.modelo,
      provider: resultado.proveedor,
      usage: resultado.usage,
    });

    const r = interpretarRespuesta(resultado.texto, manual.secciones);
    if (r.descartado.seccion || r.descartado.enlaces.length > 0) {
      console.warn('[ayuda-chat] descartado por no existir:', JSON.stringify(r.descartado), 'modelo:', resultado.modelo);
    }
    if (!r.respuesta) {
      return NextResponse.json(
        { success: false, error: { code: 'RESPUESTA_VACIA', message: 'No pude generar una respuesta. Intenta de nuevo.' } },
        { status: 502 }
      );
    }

    return NextResponse.json({
      success: true,
      data: { respuesta: r.respuesta, seccion: r.seccion, enlaces: r.enlaces },
    });
  } catch (error) {
    return handleApiError(error, 'POST /api/ayuda/chat');
  }
}
