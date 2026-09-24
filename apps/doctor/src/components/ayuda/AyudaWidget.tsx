'use client';

/**
 * AyudaWidget — el botón flotante de Ayuda (docs/DESDE JUNIO/AYUDA WIDGET/).
 *
 * Contesta cómo se usa la app desde el manual del doctor (`lib/ayuda/`). Toma el lugar del
 * `llm-assistant/ChatWidget` —el chat RAG sobre los docs de desarrollo, apagado desde
 * 2026-08-27— y reusa su `ChatInput` y su posición en la pila flotante. Los mensajes se
 * pintan aquí (`Burbuja`): el `ChatMessage` viejo le quita el número a los pasos y deja la
 * numeración al contador CSS, que sigue contando a través de listas distintas. Lo que cambia es de dónde sale la respuesta y qué se enseña debajo:
 * la SECCIÓN del manual que la respalda y enlaces a pantallas reales.
 *
 * No guarda la conversación: vive en el estado del componente y se pierde al recargar
 * (01-ARQUITECTURA §Fase 2: menos superficie, nada que proteger).
 */

import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { HelpCircle, X, Trash2, Loader2, BookOpen, ArrowRight, AlertCircle, Bot, User } from 'lucide-react';
import { ChatInput } from '@/components/llm-assistant/ChatInput';
import { usePermissions } from '@/lib/permissions-client';

interface Enlace {
  ruta: string;
  etiqueta: string;
}

interface Mensaje {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  seccion?: string | null;
  /** La frase del manual en la que se basó. No se pinta: sólo vuelve en la historia. */
  cita?: string | null;
  enlaces?: Enlace[];
  /** Un error no es parte de la conversación: se pinta, pero no viaja al servidor. */
  error?: boolean;
}

const SUGERENCIAS = [
  '¿Cómo agendo una cita?',
  '¿Cómo reagendo una cita?',
  '¿Cómo cobro una consulta?',
];

let contador = 0;
const nuevoId = () => `m${Date.now()}-${contador++}`;

export function AyudaWidget() {
  // El toggle `ayuda` (el mismo que gatea /dashboard/ayuda). NO se pide `ia`: el widget
  // está en todos los planes. Mientras los permisos cargan no se pinta nada.
  const { can, loading: permsLoading } = usePermissions();
  const pathname = usePathname();
  const [abierto, setAbierto] = useState(false);
  const [mensajes, setMensajes] = useState<Mensaje[]>([]);
  const [cargando, setCargando] = useState(false);
  const finRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    finRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [mensajes, cargando]);

  const enviar = async (texto: string) => {
    const pregunta: Mensaje = { id: nuevoId(), role: 'user', content: texto };
    const historial = [...mensajes.filter((m) => !m.error), pregunta];
    setMensajes((prev) => [...prev, pregunta]);
    setCargando(true);
    try {
      const res = await fetch('/api/ayuda/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          // Los turnos del asistente viajan como el JSON que el modelo produjo, no como
          // texto plano: si no, Claude (sin modo JSON) imita sus turnos "en texto" y a la
          // tercera pregunta deja de citar y de enlazar.
          messages: historial.map((m) =>
            m.role === 'assistant'
              ? {
                  role: m.role,
                  content: JSON.stringify({
                    respuesta: m.content,
                    cita: m.cita ?? null,
                    seccion: m.seccion ?? null,
                    enlaces: (m.enlaces ?? []).map((e) => e.ruta),
                  }),
                }
              : { role: m.role, content: m.content }
          ),
          pathname,
        }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.success) {
        // Sólo se enseñan los mensajes que escribe ESTA ruta (objeto con `message`). Los de
        // auth/permisos llegan como string crudo ("PERMISSION_BLOCKED") y pintarlos tal cual
        // fue un bug real en el widget viejo (ChatWidget, 2026-07-21).
        const mensaje =
          (typeof data?.error === 'object' && data.error?.message) ||
          'No pude contestar ahora. Intenta de nuevo en un momento.';
        setMensajes((prev) => [...prev, { id: nuevoId(), role: 'assistant', content: mensaje, error: true }]);
        return;
      }
      setMensajes((prev) => [
        ...prev,
        {
          id: nuevoId(),
          role: 'assistant',
          content: data.data.respuesta,
          seccion: data.data.seccion,
          cita: data.data.cita ?? null,
          enlaces: data.data.enlaces,
        },
      ]);
    } catch {
      setMensajes((prev) => [
        ...prev,
        { id: nuevoId(), role: 'assistant', content: 'No pude conectarme. Revisa tu conexión e intenta de nuevo.', error: true },
      ]);
    } finally {
      setCargando(false);
    }
  };

  // El return condicional va DESPUÉS de todos los hooks (ver la nota en ChatWidget).
  if (permsLoading || !can('ayuda')) return null;

  return (
    <>
      {!abierto && (
        <button
          onClick={() => setAbierto(true)}
          className="
            fixed bottom-20 right-4 sm:bottom-6 sm:right-6 lg:right-[calc(1.5rem+var(--agent-dock,0px))] z-50
            w-12 h-12 sm:w-14 sm:h-14 rounded-full
            bg-blue-600 hover:bg-blue-700
            text-white shadow-lg hover:shadow-xl
            flex items-center justify-center
            transition-all active:scale-95
          "
          title="Ayuda: cómo se usa la plataforma"
          aria-label="Abrir ayuda"
        >
          <HelpCircle className="w-6 h-6 sm:w-7 sm:h-7" />
        </button>
      )}

      {abierto && (
        <div
          className="
            fixed z-50
            inset-0 sm:inset-auto
            sm:bottom-6 sm:right-6 lg:right-[calc(1.5rem+var(--agent-dock,0px))]
            w-full sm:w-[380px]
            h-full sm:h-auto sm:max-h-[600px]
            bg-white sm:rounded-2xl shadow-2xl
            flex flex-col overflow-hidden
            border-0 sm:border border-gray-200
          "
        >
          <div className="flex items-center justify-between px-4 py-3 bg-blue-600 text-white safe-area-top">
            <div className="flex items-center gap-2">
              <HelpCircle className="w-5 h-5" />
              <span className="font-medium text-sm">Ayuda</span>
            </div>
            <div className="flex items-center gap-1">
              {mensajes.length > 0 && (
                <button
                  onClick={() => setMensajes([])}
                  // Mientras hay respuesta en camino no se puede: llegaría a la conversación
                  // NUEVA, huérfana de su pregunta.
                  disabled={cargando}
                  className="p-1.5 rounded-lg hover:bg-blue-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  title="Empezar de nuevo"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
              <button
                onClick={() => setAbierto(false)}
                className="p-1.5 rounded-lg hover:bg-blue-500 transition-colors"
                title="Cerrar"
              >
                <X className="w-5 h-5 sm:w-4 sm:h-4" />
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-3 sm:p-4 space-y-3 sm:space-y-4 min-h-0 sm:min-h-[300px] sm:max-h-[440px]">
            {mensajes.length === 0 ? (
              <Vacio onSugerencia={enviar} />
            ) : (
              <>
                {mensajes.map((m) =>
                  m.error ? (
                    <div key={m.id} className="flex items-start gap-2 text-xs text-red-700 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
                      <AlertCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                      <span>{m.content}</span>
                    </div>
                  ) : (
                    <div key={m.id}>
                      <Burbuja role={m.role} content={m.content} />
                      {m.role === 'assistant' && (m.seccion || (m.enlaces && m.enlaces.length > 0)) && (
                        <div className="ml-9 sm:ml-11 mt-1.5 space-y-1.5">
                          {m.seccion && (
                            <p className="flex items-center gap-1 text-[11px] text-gray-400">
                              <BookOpen className="w-3 h-3 shrink-0" />
                              Manual: {m.seccion}
                            </p>
                          )}
                          {m.enlaces && m.enlaces.length > 0 && (
                            <div className="flex flex-wrap gap-1.5">
                              {m.enlaces.map((e) => (
                                <Link
                                  key={e.ruta}
                                  href={e.ruta}
                                  className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-md bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-100"
                                >
                                  Ir a {e.etiqueta}
                                  <ArrowRight className="w-3 h-3" />
                                </Link>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )
                )}
                {cargando && (
                  <div className="flex gap-2 sm:gap-3">
                    <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-gray-100 flex items-center justify-center shrink-0">
                      <Loader2 className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-gray-600 animate-spin" />
                    </div>
                  </div>
                )}
                <div ref={finRef} />
              </>
            )}
          </div>

          <div className="safe-area-bottom">
            <ChatInput onSend={enviar} disabled={cargando} placeholder="¿Cómo se hace…?" />
          </div>
        </div>
      )}
    </>
  );
}

function Vacio({ onSugerencia }: { onSugerencia: (texto: string) => void }) {
  return (
    <div className="flex flex-col items-center justify-center h-full text-center px-4 sm:px-6 py-6 sm:py-8">
      <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-blue-50 flex items-center justify-center mb-2 sm:mb-3">
        <HelpCircle className="w-5 h-5 sm:w-6 sm:h-6 text-blue-600" />
      </div>
      <h3 className="text-sm font-medium text-gray-900 mb-1">¿En qué te ayudo?</h3>
      <p className="text-xs text-gray-500 mb-3 sm:mb-4">
        Pregúntame cómo se usa la plataforma. Por ahora conozco Citas y Expedientes.
      </p>
      <div className="space-y-2 w-full max-w-xs sm:max-w-none">
        {SUGERENCIAS.map((s) => (
          <button
            key={s}
            onClick={() => onSugerencia(s)}
            className="w-full text-left px-3 py-2 rounded-lg text-xs text-gray-600 bg-gray-50 hover:bg-blue-50 hover:text-blue-700 transition-colors border border-gray-100"
          >
            {s}
          </button>
        ))}
      </div>
    </div>
  );
}

/**
 * `**negritas**`, viñetas con "- " y pasos numerados. Los números se conservan TAL CUAL los
 * escribió el modelo: son los pasos del manual, y renumerarlos con CSS los desalinearía.
 */
function renderizar(texto: string) {
  return texto.split(/\r?\n/).map((linea, i) => {
    const partes = linea.split(/(\*\*[^*]+\*\*)/g).map((p, j) =>
      p.startsWith('**') && p.endsWith('**') ? <strong key={j}>{p.slice(2, -2)}</strong> : p
    );
    const limpia = linea.trim();
    if (limpia === '') return <div key={i} className="h-1.5" />;
    const sangria = linea.length - linea.trimStart().length > 0 ? 'ml-3' : '';
    if (/^[-*]\s/.test(limpia)) {
      return (
        <p key={i} className={`flex gap-1.5 ${sangria}`}>
          <span aria-hidden>•</span>
          <span>{partes.map((p) => (typeof p === 'string' ? p.replace(/^\s*[-*]\s/, '') : p))}</span>
        </p>
      );
    }
    const num = /^(\d+\.)\s/.exec(limpia);
    if (num) {
      return (
        <p key={i} className={`flex gap-1.5 ${sangria}`}>
          <span className="shrink-0 font-medium">{num[1]}</span>
          <span>{partes.map((p) => (typeof p === 'string' ? p.replace(/^\s*\d+\.\s/, '') : p))}</span>
        </p>
      );
    }
    return <p key={i}>{partes}</p>;
  });
}

function Burbuja({ role, content }: { role: 'user' | 'assistant'; content: string }) {
  const esDoctor = role === 'user';
  return (
    <div className={`flex gap-2 sm:gap-3 ${esDoctor ? 'flex-row-reverse' : ''}`}>
      <div
        className={`w-7 h-7 sm:w-8 sm:h-8 rounded-full flex items-center justify-center shrink-0 ${
          esDoctor ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600'
        }`}
      >
        {esDoctor ? <User className="w-3.5 h-3.5 sm:w-4 sm:h-4" /> : <Bot className="w-3.5 h-3.5 sm:w-4 sm:h-4" />}
      </div>
      <div
        className={`max-w-[85%] px-3 sm:px-4 py-2 sm:py-2.5 rounded-2xl text-sm leading-relaxed space-y-0.5 ${
          esDoctor ? 'bg-blue-600 text-white rounded-br-md' : 'bg-gray-100 text-gray-800 rounded-bl-md'
        }`}
      >
        {renderizar(content)}
      </div>
    </div>
  );
}
