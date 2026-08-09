'use client';

/**
 * EL VISOR — el formato de la aseguradora, tal cual, con las cajas de captura
 * encima de sus blancos.
 *
 * La página del PDF se pinta en un `<canvas>` y sobre ella van `<input>`s
 * absolutos, uno por campo del diccionario. **Se teclea en HTML, nunca en el
 * PDF**: el valor viaja al mismo JSON de respuestas que la lista de campos, así
 * que las dos vistas son dos caras del mismo dato (02-PLAN §4b).
 *
 * Aquí SÍ los colores están vivos: son CSS, no pintura sobre la hoja. Por eso
 * escribir en una caja azul la pone verde al instante — que es justo lo que el
 * PDF descargado no puede hacer.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { Loader2, AlertTriangle } from 'lucide-react';
import type { PDFDocumentProxy, RenderTask } from 'pdfjs-dist';

export interface Caja {
  clave: string;
  etiqueta: string;
  nombrePdf: string;
  pagina: number;
  x: number;
  y: number;
  ancho: number;
  alto: number;
  tipo: 'texto' | 'casilla';
  multilinea: boolean;
  /** Casillas: el on-state de ESTE recuadro. El valor guardado dice cuál del
   * grupo está marcado, así que un recuadro se pinta marcado sólo si el valor
   * es el SUYO — antes todos compartían el valor del campo y se marcaban los
   * cuatro a la vez. */
  onState?: string;
}
export interface Geometria {
  paginas: Array<{ ancho: number; alto: number }>;
  cajas: Caja[];
  sinUbicar: Array<{ clave: string; nombrePdf: string; motivo: string }>;
}
export interface ValorVisor { value: string; origin: string }

/** Color por PROCEDENCIA, no por "tiene texto": es la señal que 01-FUENTES §4
 * pide para que el doctor lea con cuidado donde hay riesgo. */
/**
 * El error de una respuesta que puede NO ser JSON: un 401 devuelve el HTML del
 * login y un 502 el del proxy, y `.json()` truena — el doctor acabaría leyendo
 * "Unexpected token '<'" en vez de "se venció la sesión".
 */
async function mensajeDeError(r: Response, porDefecto: string): Promise<string> {
  if (r.status === 401) return 'Se venció la sesión. Vuelve a entrar.';
  try {
    if (r.headers.get('content-type')?.includes('application/json')) {
      return ((await r.json()) as { error?: string }).error ?? porDefecto;
    }
  } catch { /* cae al mensaje por defecto */ }
  return porDefecto;
}

function estiloDe(origin: string | undefined, hayTexto: boolean): string {
  if (!hayTexto) return 'bg-blue-100/70 border-blue-300 focus:bg-blue-50';
  switch (origin) {
    case 'deterministic': return 'bg-green-100/70 border-green-400';
    case 'llm':
    case 'voice': return 'bg-amber-100/80 border-amber-400';
    default: return 'bg-sky-100/70 border-sky-400'; // manual
  }
}

interface Props {
  formId: string;
  valores: Record<string, ValorVisor>;
  soloLectura: boolean;
  /** Devuelve `true` si el servidor aceptó el cambio. */
  onGuardar: (clave: string, valor: string) => Promise<boolean>;
}

export default function InformeVisor({ formId, valores, soloLectura, onGuardar }: Props) {
  const [geo, setGeo] = useState<Geometria | null>(null);
  const [escala, setEscala] = useState(1.3);
  const [error, setError] = useState<string | null>(null);
  const [cargando, setCargando] = useState(true);
  const [borradores, setBorradores] = useState<Record<string, string>>({});
  /** Sube cuando el documento queda cargado: dispara el primer render sin
   * meter el objeto de pdf.js (que es un ref, no estado) en las dependencias. */
  const [listo, setListo] = useState(0);
  const contenedor = useRef<HTMLDivElement>(null);
  const lienzos = useRef<Array<HTMLCanvasElement | null>>([]);
  const doc = useRef<PDFDocumentProxy | null>(null);
  const tareas = useRef<Array<RenderTask | null>>([]);

  // ── 1) CARGA: una sola vez por formato ────────────────────────────────────
  // 🔴 Separada del render a propósito. Con la carga y el render en el mismo
  // efecto dependiente de `escala`, cada clic del zoom volvía a bajar la hoja
  // (~330KB) y a construir un documento nuevo de pdf.js.
  useEffect(() => {
    let cancelado = false;

    (async () => {
      try {
        const pdfjs = await import('pdfjs-dist');
        // 🔴 El worker se sirve de `public/pdfjs/` (lo copia `prebuild`). Dejar
        // que el bundler resuelva el import dinámico del "fake worker" es lo que
        // ya tronó una vez en la ruta desplegada.
        pdfjs.GlobalWorkerOptions.workerSrc = '/pdfjs/pdf.worker.min.mjs';

        const [rg, rp] = await Promise.all([
          fetch(`/api/medical-records/insurance-forms/${formId}/geometria`),
          fetch(`/api/medical-records/insurance-forms/${formId}/pdf`),
        ]);
        if (!rg.ok) throw new Error(await mensajeDeError(rg, 'No se pudo leer la geometría'));
        if (!rp.ok) throw new Error('No se pudo bajar el formato');
        const g: Geometria = await rg.json();
        const bytes = new Uint8Array(await rp.arrayBuffer());
        if (cancelado) return;

        const documento = await pdfjs.getDocument({ data: bytes }).promise;
        if (cancelado) { documento.destroy().catch(() => {}); return; }
        doc.current = documento;
        setGeo(g);
        setListo((n) => n + 1);
      } catch (e) {
        if (!cancelado) { setError(e instanceof Error ? e.message : 'No se pudo mostrar el formato'); setCargando(false); }
      }
    })();

    return () => {
      cancelado = true;
      doc.current?.destroy().catch(() => {});
      doc.current = null;
    };
  }, [formId]);

  // ── 2) RENDER: cada vez que cambia el zoom ────────────────────────────────
  useEffect(() => {
    if (!doc.current || !geo) return;
    let cancelado = false;

    (async () => {
      try {
        for (let n = 1; n <= doc.current!.numPages; n++) {
          if (cancelado) return;
          const page = await doc.current!.getPage(n);
          const viewport = page.getViewport({ scale: escala });
          const canvas = lienzos.current[n - 1];
          if (!canvas) continue;
          const ctx = canvas.getContext('2d');
          if (!ctx) continue;

          // Pantallas HiDPI: el lienzo se pinta al doble de resolución y se
          // muestra al tamaño lógico. Sin esto un formulario a 100% se ve
          // borroso justo donde hay que leer letra chica.
          // Se acota `escala × dpr`: a 250% con dpr 2 cada página son ~12M px
          // (~48MB) y las seis juntas ~290MB. Safari/iPadOS tira el backing
          // store al pasarse y las páginas se ponen BLANCAS sin ningún error —
          // idéntico al síntoma del bug de arriba.
          const dpr = Math.max(1, Math.min(window.devicePixelRatio || 1, 2, 3 / escala));
          canvas.width = Math.floor(viewport.width * dpr);
          canvas.height = Math.floor(viewport.height * dpr);
          ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

          // 🔴 Un render en curso sobre el mismo lienzo truena con "Cannot use
          // the same canvas during multiple render() operations". Dos clics
          // rápidos del zoom bastaban.
          tareas.current[n - 1]?.cancel();
          const tarea = page.render({ canvasContext: ctx, viewport, canvas });
          tareas.current[n - 1] = tarea;
          try {
            await tarea.promise;
          } catch (e) {
            // Cancelar es lo normal aquí, no un fallo que reportar.
            if ((e as { name?: string })?.name !== 'RenderingCancelledException') throw e;
          }
        }
      } catch (e) {
        if (!cancelado) setError(e instanceof Error ? e.message : 'No se pudo dibujar el formato');
      } finally {
        if (!cancelado) setCargando(false);
      }
    })();

    return () => {
      cancelado = true;
      for (const t of tareas.current) t?.cancel();
    };
  }, [escala, geo, listo]);

  const guardar = useCallback(async (clave: string, valor: string) => {
    const ok = await onGuardar(clave, valor);
    // 🔴 Sólo se suelta lo tecleado si el servidor lo aceptó. Si falla y se
    // borra igual, la caja se revierte al valor viejo y lo que escribió el
    // doctor desaparece — con el aviso hasta arriba de una hoja de 6 páginas,
    // o sea fuera de la pantalla.
    if (ok) setBorradores((b) => { const n = { ...b }; delete n[clave]; return n; });
  }, [onGuardar]);

  // 🔴 El gate es `!geo`, NO `cargando`. Con `cargando` los `<canvas>` no
  // estaban montados cuando corría el efecto de render: los 6 se saltaban por
  // `if (!canvas) continue`, el efecto no volvía a correr, y la hoja quedaba EN
  // BLANCO con las cajas flotando encima hasta que alguien tocaba el zoom.
  if (!error && !geo) {
    return (
      <div className="flex items-center justify-center py-20 text-gray-500">
        <Loader2 className="h-6 w-6 animate-spin mr-2" /> Cargando el formato…
      </div>
    );
  }
  if (error || !geo) {
    return (
      <div className="rounded-lg bg-red-50 border border-red-200 p-4 text-sm text-red-800">
        <p className="font-medium flex items-center gap-2"><AlertTriangle className="h-4 w-4" /> No se pudo mostrar el formato</p>
        <p className="mt-1">{error}</p>
        <p className="mt-2 text-red-700">
          Usa la pestaña <strong>Lista de campos</strong>: llena y emite igual, sólo sin ver la hoja.
        </p>
      </div>
    );
  }

  return (
    <div ref={contenedor}>
      <div className="flex items-center gap-3 mb-3 text-sm">
        <span className="text-gray-600">Zoom</span>
        <button onClick={() => setEscala((s) => Math.max(0.6, +(s - 0.2).toFixed(2)))} className="border rounded px-2 py-1">−</button>
        <span className="tabular-nums w-12 text-center">{Math.round(escala * 100)}%</span>
        <button onClick={() => setEscala((s) => Math.min(2.5, +(s + 0.2).toFixed(2)))} className="border rounded px-2 py-1">+</button>
        <span className="ml-4 flex items-center gap-3 text-xs text-gray-600">
          <span className="inline-flex items-center gap-1"><i className="w-3 h-3 rounded-sm bg-blue-100 border border-blue-300 inline-block" /> puedes escribir</span>
          <span className="inline-flex items-center gap-1"><i className="w-3 h-3 rounded-sm bg-green-100 border border-green-400 inline-block" /> del expediente</span>
          <span className="inline-flex items-center gap-1"><i className="w-3 h-3 rounded-sm bg-sky-100 border border-sky-400 inline-block" /> lo escribiste tú</span>
        </span>
      </div>

      {geo.sinUbicar.length > 0 && (
        <div className="mb-3 rounded-lg bg-amber-50 border border-amber-200 p-3 text-xs text-amber-900">
          {geo.cajas.length === 0
            ? 'No se pudo ubicar ningún campo sobre esta hoja (puede venir rotada o recortada). '
            : `${geo.sinUbicar.length} campo(s) no se pudieron ubicar sobre la hoja y no aparecen aquí. `}
          Se llenan en la pestaña <strong>Lista de campos</strong>, y sí salen en el PDF.
        </div>
      )}

      {cargando && (
        <div className="mb-3 flex items-center gap-2 text-sm text-gray-500">
          <Loader2 className="h-4 w-4 animate-spin" /> Dibujando la hoja…
        </div>
      )}

      <div className="space-y-6">
        {geo.paginas.map((pag, i) => {
          const w = pag.ancho * escala;
          const h = pag.alto * escala;
          return (
            <div key={i} className="relative mx-auto shadow border bg-white" style={{ width: w, height: h }}>
              <canvas
                ref={(el) => { lienzos.current[i] = el; }}
                className="absolute inset-0"
                style={{ width: w, height: h }}
              />
              {geo.cajas.filter((c) => c.pagina === i && c.tipo === 'casilla').map((c) => {
                const guardado = (valores[c.clave]?.value ?? '').trim();
                // Un grupo es EXCLUYENTE: el PDF guarda un valor por campo. Si
                // el valor es el on-state de otro recuadro, éste va apagado.
                const marcada = c.onState ? guardado === c.onState : guardado !== '';
                return (
                  <input
                    key={`${c.clave}-${c.x}-${c.y}`}
                    type="checkbox"
                    title={c.etiqueta}
                    checked={marcada}
                    disabled={soloLectura}
                    // Una casilla no tiene borrador local: se guarda al instante
                    // porque no hay "terminar de escribir" que esperar.
                    onChange={(e) => guardar(c.clave, e.target.checked ? (c.onState ?? '1') : '')}
                    className={`absolute cursor-pointer accent-sky-600 ${marcada ? '' : 'opacity-70'}`}
                    style={{
                      left: c.x * escala,
                      top: (pag.alto - c.y - c.alto) * escala,
                      width: c.ancho * escala,
                      height: c.alto * escala,
                    }}
                  />
                );
              })}
              {geo.cajas.filter((c) => c.pagina === i && c.tipo === 'texto').map((c) => {
                const v = valores[c.clave];
                const texto = borradores[c.clave] ?? v?.value ?? '';
                const Comp = c.multilinea ? 'textarea' : 'input';
                return (
                  <Comp
                    key={`${c.clave}-${c.x}-${c.y}`}
                    title={c.etiqueta}
                    value={texto}
                    disabled={soloLectura}
                    onChange={(e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
                      setBorradores((b) => ({ ...b, [c.clave]: e.target.value }))
                    }
                    onBlur={(e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement>) => {
                      if (e.target.value !== (v?.value ?? '')) guardar(c.clave, e.target.value);
                    }}
                    className={`absolute border rounded-[2px] px-1 outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-80 ${estiloDe(v?.origin, texto.trim() !== '')}`}
                    style={{
                      // 🔴 LA conversión: el PDF mide desde ABAJO-izquierda en
                      // puntos; CSS desde ARRIBA-izquierda en píxeles. De ahí el
                      // `alto - y - altoCaja`. Está SÓLO aquí a propósito.
                      left: c.x * escala,
                      top: (pag.alto - c.y - c.alto) * escala,
                      width: c.ancho * escala,
                      height: c.alto * escala,
                      fontSize: Math.max(7, Math.min(12, c.alto * escala * 0.62)),
                      lineHeight: 1.1,
                      resize: 'none',
                    }}
                  />
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
}
