'use client';

/**
 * EL CHAT del informe (06-AGENTE).
 *
 * 🔴 **La HOJA es el card, no el chat.** Lo que el agente propone NO se enseña
 * aquí como una lista para aprobar: se pinta en ÁMBAR sobre el formato de la
 * aseguradora, en su casilla real, y el doctor lo corrige tecleando encima. Una
 * propuesta se juzga por si cabe en ESA casilla de ESA hoja, y eso no se puede
 * juzgar desde una lista abstracta (§2).
 *
 * Por eso este panel es angosto y flota: la superficie de revisión es la hoja
 * que tiene detrás, y taparla sería tapar el card.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { Bot, Loader2, Mic, Send, Square, X } from 'lucide-react';

export interface PropuestaChat {
  value: string;
  source: string | null;
  origin: string;
}

interface Mensaje {
  role: 'user' | 'assistant';
  content: string;
  /** Cuántos campos aterrizaron en la hoja con este turno. */
  colocados?: number;
  /** Lo que el modelo propuso y no se pudo colocar. */
  descartados?: Array<{ clave: string; motivo: string; caracteres?: string[] }>;
}

interface Props {
  /** `/api/medical-records/patients/:id/reports` */
  base: string;
  reportId: string;
  /** Lo que la hoja tiene AHORA (guardado + pendiente): `clave -> valor`. */
  estadoHoja: Record<string, string>;
  /** Las propuestas del agente entran como PENDIENTES sobre la hoja. */
  onPropuesta: (valores: Record<string, PropuestaChat>) => void;
}

const SALUDO =
  'Conozco este formato y tú no te lo sabes de memoria. Cuéntame el caso como se lo contarías ' +
  'a un colega y yo lo voy colocando en la hoja, o pregúntame qué le falta.';

async function mensajeDeError(r: Response, porDefecto: string): Promise<string> {
  if (r.status === 401) return 'Se venció la sesión. Vuelve a entrar.';
  try {
    if (r.headers.get('content-type')?.includes('application/json')) {
      return ((await r.json()) as { error?: string }).error ?? porDefecto;
    }
  } catch { /* cae al mensaje por defecto */ }
  return porDefecto;
}

// 🔴 El panel se MONTA sólo cuando el informe se puede editar (`page.tsx`). No
// se apaga con un `return null` desde dentro: eso no desmonta, y la limpieza que
// cierra el micrófono corre al desmontar — emitir mientras grababa dejaba el
// micrófono abierto.
export default function ChatInforme({ base, reportId, estadoHoja, onPropuesta }: Props) {
  const [abierto, setAbierto] = useState(false);
  const [mensajes, setMensajes] = useState<Mensaje[]>([]);
  const [texto, setTexto] = useState('');
  const [pensando, setPensando] = useState(false);
  const [grabando, setGrabando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fin = useRef<HTMLDivElement>(null);
  const rec = useRef<MediaRecorder | null>(null);
  const trozos = useRef<Blob[]>([]);

  /**
   * 🔴 El estado de la hoja se lee de un ref, no de la clausura.
   *
   * `enviar` se llama desde `onstop` del MediaRecorder, que se registró varios
   * segundos antes: con la clausura, lo que el doctor tecleó mientras grababa no
   * viajaba, y el agente volvía a proponer lo que él acababa de escribir.
   */
  const estadoRef = useRef(estadoHoja);
  estadoRef.current = estadoHoja;

  useEffect(() => {
    if (abierto) fin.current?.scrollIntoView({ behavior: 'smooth' });
  }, [mensajes, pensando, abierto]);

  // 🔴 Si el panel se desmonta grabando, el micrófono SIGUE ABIERTO en un
  // consultorio donde se están hablando datos del paciente.
  useEffect(() => () => {
    try { rec.current?.stream?.getTracks().forEach((t) => t.stop()); } catch { /* ya cerrado */ }
    if (rec.current?.state === 'recording') { try { rec.current.stop(); } catch { /* noop */ } }
  }, []);

  const enviar = useCallback(async (contenido: string | Blob) => {
    setError(null);
    setPensando(true);
    // El historial que viaja es el de ANTES de este turno: el mensaje nuevo va
    // aparte y el servidor lo pone al final.
    const historial = mensajes.map((m) => ({ role: m.role, content: m.content }));
    // `estadoHoja` ya viene filtrado por la página: los llenos MÁS los que el
    // doctor acaba de vaciar (ver el comentario de `estadoHoja` en `page.tsx`).
    // Aquí no se vuelve a filtrar — hacerlo tiraría justo los vacíos.
    const estado = estadoRef.current;

    // Lo tecleado se pinta ya; lo hablado espera a saber qué se oyó.
    if (typeof contenido === 'string') {
      setMensajes((m) => [...m, { role: 'user', content: contenido }]);
    }

    try {
      let r: Response;
      if (typeof contenido === 'string') {
        r = await fetch(`${base}/${reportId}/chat`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ mensaje: contenido, mensajes: historial, pendientes: estado }),
        });
      } else {
        const fd = new FormData();
        fd.append('audio', contenido, 'mensaje.webm');
        fd.append('mensajes', JSON.stringify(historial));
        fd.append('pendientes', JSON.stringify(estado));
        r = await fetch(`${base}/${reportId}/chat`, { method: 'POST', body: fd });
      }

      if (!r.ok) {
        setError(await mensajeDeError(r, 'No se pudo hablar con el asistente'));
        return;
      }
      const d = await r.json();

      // Lo hablado se pinta con lo que Whisper OYÓ, no con un "(audio)": si
      // entendió mal, el doctor tiene que poder verlo y decirlo.
      if (typeof d.transcript === 'string' && d.transcript.trim() !== '') {
        setMensajes((m) => [...m, { role: 'user', content: d.transcript }]);
      }

      const valores = (d.valores ?? {}) as Record<string, PropuestaChat>;
      const colocados = Object.keys(valores).length;
      if (colocados > 0) onPropuesta(valores);

      setMensajes((m) => [...m, {
        role: 'assistant',
        content: String(d.mensaje ?? ''),
        colocados,
        descartados: Array.isArray(d.descartados) ? d.descartados : [],
      }]);
    } catch {
      setError('No se pudo hablar con el asistente');
    } finally {
      setPensando(false);
    }
  }, [base, reportId, mensajes, onPropuesta]);

  function mandarTexto() {
    const t = texto.trim();
    if (t === '' || pensando) return;
    setTexto('');
    enviar(t);
  }

  async function alternarMicrofono() {
    setError(null);
    if (grabando) { rec.current?.stop(); return; }
    if (pensando) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr = new MediaRecorder(stream);
      trozos.current = [];
      mr.ondataavailable = (e) => { if (e.data.size > 0) trozos.current.push(e.data); };
      mr.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        setGrabando(false);
        await enviar(new Blob(trozos.current, { type: mr.mimeType || 'audio/webm' }));
      };
      mr.start();
      rec.current = mr;
      setGrabando(true);
    } catch {
      setError('No se pudo acceder al micrófono');
    }
  }

  if (!abierto) {
    return (
      <button
        onClick={() => setAbierto(true)}
        className="fixed bottom-5 right-5 z-30 inline-flex items-center gap-2 rounded-full bg-blue-600 text-white px-4 py-3 shadow-lg hover:bg-blue-700"
      >
        <Bot className="h-5 w-5" />
        <span className="text-sm font-medium">Conversar con el formato</span>
      </button>
    );
  }

  return (
    <div className="fixed bottom-4 right-4 z-30 flex flex-col w-[min(380px,calc(100vw-2rem))] h-[min(560px,calc(100vh-2rem))] rounded-xl border bg-white shadow-2xl">
      <div className="flex items-center justify-between border-b px-3 py-2">
        <span className="inline-flex items-center gap-2 text-sm font-semibold text-gray-900">
          <Bot className="h-4 w-4 text-blue-600" /> Conversar con el formato
        </span>
        <button onClick={() => setAbierto(false)} className="text-gray-400 hover:text-gray-700" title="Cerrar">
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-3 py-3 space-y-3 text-sm">
        <p className="rounded-lg bg-blue-50 text-blue-900 px-3 py-2">{SALUDO}</p>

        {mensajes.map((m, i) => (
          <div key={i} className={m.role === 'user' ? 'text-right' : ''}>
            <p className={`inline-block rounded-lg px-3 py-2 whitespace-pre-wrap text-left ${
              m.role === 'user' ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-900'
            }`}>
              {m.content}
            </p>
            {/* 🔴 Se dice CUÁNTOS aterrizaron y que están SIN GUARDAR. Sin esto
                el doctor lee la respuesta, no mira la hoja y cree que ya quedó. */}
            {m.colocados !== undefined && m.colocados > 0 && (
              <p className="mt-1 text-[11px] text-amber-700">
                {m.colocados} campo(s) puestos en la hoja en ámbar — revísalos y aprieta Guardar.
              </p>
            )}
            {m.descartados && m.descartados.length > 0 && (
              <p className="mt-1 text-[11px] text-red-700">
                {m.descartados.length} no se pudieron colocar
                {m.descartados.some((d) => d.motivo === 'caracteres-no-imprimibles')
                  ? ' (símbolos que el formato no imprime)'
                  : ' (no existen en esta hoja)'}.
              </p>
            )}
          </div>
        ))}

        {pensando && (
          <p className="inline-flex items-center gap-2 text-gray-500">
            <Loader2 className="h-4 w-4 animate-spin" /> Pensando…
          </p>
        )}
        {error && <p className="rounded-lg bg-red-50 text-red-800 px-3 py-2">{error}</p>}
        <div ref={fin} />
      </div>

      <div className="border-t p-2">
        <div className="flex items-end gap-2">
          <textarea
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            onKeyDown={(e) => {
              // Enter manda, Shift+Enter hace renglón: es lo que un relato largo
              // necesita y lo que el doctor ya espera de un chat.
              if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); mandarTexto(); }
            }}
            rows={2}
            disabled={pensando || grabando}
            placeholder={grabando ? 'Grabando…' : 'Cuéntame el caso, o pregunta qué falta'}
            className="flex-1 resize-none border rounded-lg px-2 py-1.5 text-sm disabled:bg-gray-50"
          />
          <button
            onClick={alternarMicrofono}
            disabled={pensando}
            title={grabando ? 'Detener y mandar' : 'Hablar en vez de teclear'}
            className={`shrink-0 rounded-lg border p-2 disabled:opacity-40 ${
              grabando ? 'bg-red-600 text-white border-red-600 animate-pulse' : 'hover:bg-gray-50'
            }`}
          >
            {grabando ? <Square className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
          </button>
          <button
            onClick={mandarTexto}
            disabled={pensando || grabando || texto.trim() === ''}
            className="shrink-0 rounded-lg bg-blue-600 text-white p-2 disabled:opacity-40"
            title="Mandar"
          >
            <Send className="h-4 w-4" />
          </button>
        </div>
        <p className="mt-1 text-[11px] text-gray-500">
          Lo que proponga queda <strong>sin guardar</strong> hasta que aprietes Guardar. No marca
          casillas: ésas se marcan a mano en la hoja.
        </p>
      </div>
    </div>
  );
}
