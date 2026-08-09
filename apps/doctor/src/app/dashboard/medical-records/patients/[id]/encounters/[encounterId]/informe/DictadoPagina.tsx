'use client';

/**
 * El micrófono de UNA página del formato (05-VOZ §9.1).
 *
 * 🔴 El alcance tiene que VERSE: el botón dice qué página y cuántos campos, y
 * mientras graba la página se resalta. Si no, el doctor dicta el informe entero
 * mirando la página 1, la mayor parte no aterriza y la pantalla se ve como si
 * hubiera funcionado.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { Mic, Square, Loader2 } from 'lucide-react';

export interface ResultadoDictado {
  escritos: string[];
  descartados: Array<{ clave: string; motivo: string; caracteres?: string[] }>;
  camposEnPagina: number;
}

interface Props {
  /** 1-based; `null` dicta sobre toda la hoja. */
  pagina: number | null;
  campos: number;
  deshabilitado: boolean;
  /** Manda el AUDIO. Devuelve `null` y un mensaje si falló. */
  onDictado: (audio: Blob, pagina: number | null) => Promise<{ r: ResultadoDictado | null; mensaje?: string }>;
  /** `true` mientras esta página graba O procesa: bloquea las demás. */
  onEstado: (ocupado: boolean) => void;
}

export default function DictadoPagina({ pagina, campos, deshabilitado, onDictado, onEstado }: Props) {
  const [estado, setEstado] = useState<'listo' | 'grabando' | 'procesando'>('listo');
  const [error, setError] = useState<string | null>(null);
  const [resumen, setResumen] = useState<string | null>(null);
  const rec = useRef<MediaRecorder | null>(null);
  const trozos = useRef<Blob[]>([]);
  /** El audio se conserva EN MEMORIA para reintentar sin volver a grabar si
   * falla el servidor (05-VOZ §10.7). No se persiste: al recargar se va. */
  const ultimoAudio = useRef<Blob | null>(null);

  // 🔴 Si el visor se desmonta grabando (cambiar de pestaña, navegar), el
  // `stop()` de `onstop` nunca corre y el MICRÓFONO SIGUE ABIERTO en un
  // consultorio donde se están hablando datos del paciente.
  useEffect(() => () => {
    try { rec.current?.stream?.getTracks().forEach((t) => t.stop()); } catch { /* ya cerrado */ }
    if (rec.current?.state === 'recording') { try { rec.current.stop(); } catch { /* noop */ } }
  }, []);

  const procesar = useCallback(async (audio: Blob) => {
    setEstado('procesando');
    onEstado(true);
    setError(null);
    try {
      const { r, mensaje } = await onDictado(audio, pagina);
      // 🔴 El error se guarda TAMBIÉN aquí, no sólo en el banner de la página:
      // el botón de "reintentar" depende de este estado, y sin él quedaba
      // inalcanzable justo cuando hacía falta.
      if (!r) { setError(mensaje ?? 'No se pudo procesar el dictado'); return; }
      if (r) {
        const partes = [`${r.escritos.length} campo(s) llenado(s)`];
        // Lo descartado NO se calla: si el doctor dictó algo y no aparece,
        // tiene que saber por qué.
        const fuera = r.descartados.filter((d) => d.motivo === 'campo-inexistente').length;
        const simbolos = r.descartados.filter((d) => d.motivo === 'caracteres-no-imprimibles');
        if (fuera > 0) partes.push(`${fuera} no pertenecen a esta página`);
        if (simbolos.length > 0) {
          partes.push(`${simbolos.length} con símbolos que no se imprimen (${simbolos.flatMap((s) => s.caracteres ?? []).join(' ')})`);
        }
        setResumen(partes.join(' · '));
      }
    } catch {
      // Sin `catch` esto era una promesa rechazada sin ninguna señal al usuario.
      setError('No se pudo procesar el dictado');
    } finally {
      setEstado('listo');
      onEstado(false);
    }
  }, [onDictado, onEstado, pagina]);

  async function alternar() {
    setError(null);
    setResumen(null);

    if (estado === 'grabando') {
      rec.current?.stop();
      return;
    }
    if (estado === 'procesando') return;

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr = new MediaRecorder(stream);
      trozos.current = [];
      mr.ondataavailable = (e) => { if (e.data.size > 0) trozos.current.push(e.data); };
      mr.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(trozos.current, { type: mr.mimeType || 'audio/webm' });
        ultimoAudio.current = blob;
        // El audio va DIRECTO al endpoint del informe, que transcribe y llena en
        // una sola llamada: `/api/voice/transcribe` es OWNER_ONLY y bloquearía a
        // un usuario secundario que sí puede hacer informes.
        await procesar(blob);
      };
      mr.start();
      rec.current = mr;
      setEstado('grabando');
      onEstado(true);
    } catch {
      setError('No se pudo acceder al micrófono');
    }
  }

  const etiqueta = pagina === null ? 'toda la hoja' : `página ${pagina}`;

  return (
    <div className="flex items-center gap-2 text-sm">
      <button
        onClick={alternar}
        disabled={deshabilitado || estado === 'procesando'}
        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md border text-xs font-medium disabled:opacity-40 ${
          estado === 'grabando' ? 'bg-red-600 text-white border-red-600 animate-pulse' : 'bg-white hover:bg-gray-50'
        }`}
        title={`Dictar sólo los campos de ${etiqueta}`}
      >
        {estado === 'procesando' ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
          : estado === 'grabando' ? <Square className="h-3.5 w-3.5" />
          : <Mic className="h-3.5 w-3.5" />}
        {estado === 'procesando' ? 'Procesando…'
          : estado === 'grabando' ? 'Detener y llenar'
          : `Dictar ${etiqueta} · ${campos} campos`}
      </button>

      {/* Reintento sin volver a grabar: la transcripción vive en memoria. */}
      {error && ultimoAudio.current && estado === 'listo' && (
        <button onClick={() => procesar(ultimoAudio.current!)} className="text-xs underline text-blue-700">
          reintentar sin regrabar
        </button>
      )}
      {error && <span className="text-xs text-red-700">{error}</span>}
      {resumen && <span className="text-xs text-gray-600">{resumen}</span>}
    </div>
  );
}
