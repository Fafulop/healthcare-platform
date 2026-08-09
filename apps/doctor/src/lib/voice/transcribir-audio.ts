/**
 * Audio → texto con Whisper.
 *
 * Extraído de `/api/voice/transcribe` para que el dictado del INFORME pueda
 * transcribir sin pasar por esa ruta.
 *
 * 🔴 Por qué no se reusa la ruta: `/api/voice/*` está marcada **OWNER_ONLY** en
 * `route-permissions.ts`, mientras que `/api/medical-records/*` sólo pide el
 * toggle `expedientes`. Un usuario secundario con acceso a expedientes vería el
 * micrófono del informe, grabaría datos del paciente y recibiría un
 * `PERMISSION_BLOCKED` — o, peor, habría que aflojar `/api/voice/*` y cambiar en
 * silencio quién puede dictar en NOTAS y CONSULTAS, que nadie decidió.
 *
 * Decisión del usuario (2026-08-09): *"los informes los puede hacer cualquiera
 * que tenga acceso; el dueño le da el acceso a los demás usuarios"*. Compartir
 * el helper deja que el informe herede `expedientes` sin tocar el permiso de las
 * otras superficies de voz.
 */
import OpenAI, { toFile } from 'openai';

let _openai: OpenAI;
function getOpenAI(): OpenAI {
  if (!_openai) _openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  return _openai;
}

/** 25 MB es el límite de la API. */
export const MAX_AUDIO_BYTES = 25 * 1024 * 1024;
const MIN_SEGUNDOS = 1;

export type ResultadoTranscripcion =
  | { ok: true; transcript: string; duracion: number }
  | { ok: false; mensaje: string };

/** Adivina la extensión por los bytes mágicos; Whisper la necesita. */
function nombreDelAudio(bytes: Uint8Array): string {
  if (bytes[0] === 0x4f && bytes[1] === 0x67 && bytes[2] === 0x67) return 'recording.ogg';
  if (bytes[0] === 0x49 && bytes[1] === 0x44 && bytes[2] === 0x33) return 'recording.mp3';
  if (bytes[0] === 0xff && (bytes[1] === 0xfb || bytes[1] === 0xfa)) return 'recording.mp3';
  return 'recording.webm';
}

/**
 * Devuelve SIEMPRE un mensaje en español listo para enseñar, nunca un objeto:
 * un consumidor que hacía `setError(data.error)` con `{code, message}` tumbaba
 * la pantalla de React entera.
 */
export async function transcribirAudio(
  archivo: File,
  idioma = 'es'
): Promise<ResultadoTranscripcion> {
  if (archivo.size === 0) return { ok: false, mensaje: 'La grabación llegó vacía.' };
  if (archivo.size > MAX_AUDIO_BYTES) {
    return { ok: false, mensaje: `El audio excede el límite de ${MAX_AUDIO_BYTES / (1024 * 1024)} MB.` };
  }

  const buffer = await archivo.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  const file = await toFile(Buffer.from(buffer), nombreDelAudio(bytes));

  const t = await getOpenAI().audio.transcriptions.create({
    file,
    model: 'whisper-1',
    language: idioma,
    response_format: 'verbose_json',
  });

  const transcript = (t.text ?? '').trim();
  if (transcript === '') {
    return { ok: false, mensaje: 'No se pudo transcribir el audio. Habla más claro o más cerca del micrófono.' };
  }
  const duracion = t.duration ?? 0;
  if (duracion > 0 && duracion < MIN_SEGUNDOS) {
    return { ok: false, mensaje: 'La grabación es muy corta. Intenta de nuevo.' };
  }
  return { ok: true, transcript, duracion };
}
