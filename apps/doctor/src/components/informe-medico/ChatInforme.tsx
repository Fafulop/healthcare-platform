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
import { Bot, Loader2, Mic, Send, Sparkles, Square, User, X } from 'lucide-react';
// La zona de cada fecha depende del TIPO de fuente (día de calendario vs
// instante). Una sola tabla de verdad: `fechas-de-fuente.ts`.
import { fechaDeFuente, type TipoFuente } from '@/lib/informe-medico/fechas-de-fuente';

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
  descartados?: Array<{ clave: string; motivo: string; caracteres?: string[]; opciones?: string[] }>;
  /** 🔴 Fuentes que el doctor eligió y que el servidor ya no pudo leer (se borró
   * la nota, la receta volvió a borrador). Se dice: si no, este turno se contestó
   * sin ellas y se ve idéntico a uno completo. */
  fuentesFaltantes?: Array<{ tipo: TipoFuente; fecha: string }>;
}

interface Props {
  /** `/api/medical-records/patients/:id/reports` */
  base: string;
  reportId: string;
  /** Lo que la hoja tiene AHORA (guardado + pendiente): `clave -> valor`. */
  estadoHoja: Record<string, string>;
  /** Las propuestas del agente entran como PENDIENTES sobre la hoja. */
  onPropuesta: (valores: Record<string, PropuestaChat>) => void;
  /** 🔴 El abierto/cerrado vive en la PÁGINA: cuando el chat está abierto la
   * hoja deja de ir centrada en `max-w-4xl` y usa el ancho que queda. Si el
   * estado viviera aquí, la hoja no se enteraría. */
  abierto: boolean;
  onCerrar: () => void;
  /**
   * 🔴 Qué expediente tiene delante el asistente ahora mismo.
   *
   * Marcar una fuente **no llena la hoja**: lo único que hace es dársela a este
   * chat, y eso no se ve por ningún lado. El doctor marcaba cinco casillas, no
   * pasaba nada en el formato, y la conclusión razonable era "no sirven". Aquí se
   * dice con nombres para que se pueda COMPROBAR.
   */
  lectura: {
    /** La consulta ancla, SÓLO si el modelo la recibe de verdad. */
    ancla: string | null;
    /** Las fuentes que el asistente sí tiene. */
    fuentes: string[];
    /** Cuántas se eligieron y ya no se pueden leer. NO se cuentan como leídas. */
    noLegibles: number;
  };
  /**
   * 🔴 El disparo desde el panel de fuentes: un contador que sube cada vez que el
   * doctor aprieta "Llenar la hoja con lo que marqué".
   *
   * Es un CONTADOR y no un booleano a propósito: apretar el botón dos veces tiene
   * que mandar dos turnos, y con un booleano el segundo no cambiaría el prop.
   */
  disparoAutollenado: number;
  /**
   * Avisa cuando el chat está ocupado (pensando o grabando), para que el botón
   * del panel de fuentes se pueda deshabilitar. Sin esto, el botón se ve activo,
   * no pasa nada al apretarlo, y volvemos a "hago clic y no ocurre nada".
   */
  onOcupadoChange: (ocupado: boolean) => void;
}

/**
 * El mensaje que manda el botón. Va explícito al historial a propósito: el doctor
 * tiene que poder ver QUÉ se pidió en su nombre.
 *
 * 🔴 Corto y sin órdenes de más. Este mensaje **se queda en el historial** y viaja
 * en los 16 turnos siguientes, así que un "no me preguntes todavía" seguiría
 * dirigiendo turnos en los que el médico pregunta otra cosa. Lo que tiene que
 * hacer el modelo ya está en el prompt de sistema; aquí sólo se le pide que lo
 * haga ahora.
 */
const MENSAJE_AUTOLLENADO =
  'Llena la hoja con lo que haya en la consulta y en las fuentes del expediente.';

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
export default function ChatInforme({
  base, reportId, estadoHoja, onPropuesta, abierto, onCerrar, lectura, disparoAutollenado,
  onOcupadoChange,
}: Props) {
  const [mensajes, setMensajes] = useState<Mensaje[]>([]);
  const [texto, setTexto] = useState('');
  const [pensando, setPensando] = useState(false);
  const [grabando, setGrabando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fin = useRef<HTMLDivElement>(null);
  const rec = useRef<MediaRecorder | null>(null);
  const trozos = useRef<Blob[]>([]);
  const cajaTexto = useRef<HTMLTextAreaElement>(null);
  /**
   * 🔴 El cursor se perdía después de cada mensaje y había que volver a hacer
   * clic para escribir el segundo.
   *
   * No basta con enfocar al mandar: la caja se pone `disabled` mientras el
   * asistente piensa, y el navegador DESENFOCA un elemento deshabilitado (y no
   * lo devuelve al re-habilitarlo). Hay que volver a enfocar cuando el turno
   * termina. Sólo si el doctor estaba escribiendo aquí — si mandó por micrófono
   * o el turno lo disparó el botón de autollenado, robarle el foco lo sacaría de
   * donde esté.
   */
  const devolverFoco = useRef(false);
  /** Un turno de autollenado que sale en el mismo commit en que termina el anterior. */
  const turnoEncolado = useRef(false);

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
        fuentesFaltantes: Array.isArray(d.fuentesFaltantes) ? d.fuentesFaltantes : [],
      }]);
    } catch {
      setError('No se pudo hablar con el asistente');
    } finally {
      setPensando(false);
    }
  }, [base, reportId, mensajes, onPropuesta]);

  /**
   * El botón del panel de fuentes manda su turno por aquí.
   *
   * 🔴 `enviar` se recrea en cada render (depende de `mensajes`), así que NO puede
   * ir en las dependencias: el efecto correría en cada turno y mandaría el mensaje
   * en bucle. Lo que dispara es el contador, y sólo él; el `enviar` de ese momento
   * se lee de un ref.
   */
  const enviarRef = useRef(enviar);
  enviarRef.current = enviar;
  const ultimoDisparo = useRef(disparoAutollenado);
  useEffect(() => {
    if (disparoAutollenado === ultimoDisparo.current) return;
    // 🔴 El contador se consume SÓLO cuando de verdad se manda. Consumirlo antes
    // de esta guarda hacía que apretar el botón mientras el asistente pensaba se
    // tragara el disparo en silencio: el botón no hacía NADA, que es exactamente
    // la queja que este botón vino a arreglar. Así queda pendiente y sale solo
    // en cuanto termina el turno anterior (`pensando` está en las dependencias).
    if (pensando || grabando) return;
    // 🔴 Y NO se reanuda encima de un error. `pensando` también se apaga cuando el
    // turno anterior FALLA, y `enviar` arranca con `setError(null)`: el disparo en
    // cola borraba "Se venció la sesión" en el mismo frame en que aparecía, y
    // mandaba otro turno que iba a fallar igual. Con un error en pantalla, el
    // disparo se descarta y el doctor decide.
    if (error !== null) { ultimoDisparo.current = disparoAutollenado; return; }
    ultimoDisparo.current = disparoAutollenado;
    // 🔴 Este efecto corre ANTES que el del foco en el mismo commit, y el
    // `setPensando(true)` de `enviar` todavía no se ve desde allá: sin esta
    // señal, el efecto del foco cree que el turno terminó, enfoca una caja que
    // el turno nuevo va a deshabilitar y GASTA `devolverFoco` — el cursor no
    // volvía nunca después de un autollenado encolado.
    turnoEncolado.current = true;
    enviarRef.current(MENSAJE_AUTOLLENADO);
  }, [disparoAutollenado, pensando, grabando, error]);

  // El panel de fuentes necesita saberlo para deshabilitar su botón.
  useEffect(() => { onOcupadoChange(pensando || grabando); }, [pensando, grabando, onOcupadoChange]);

  // Ver `devolverFoco`: la caja vuelve de `disabled` sin foco, así que se lo
  // devolvemos en cuanto el turno termina (haya salido bien o con error).
  useEffect(() => {
    if (pensando || grabando) return;
    if (!devolverFoco.current) return;
    // Un turno encolado (autollenado) arranca en este mismo commit: no es el
    // final de nada. Se deja la bandera puesta para el turno de verdad.
    if (turnoEncolado.current) { turnoEncolado.current = false; return; }
    // 🔴 El foco se devuelve SÓLO si no hay nadie más usándolo. Mientras el
    // asistente piensa, lo NORMAL en esta pantalla es que el doctor esté
    // corrigiendo una casilla de la hoja; robarle el cursor a media palabra
    // (y en móvil, abrirle el teclado encima de la hoja) es peor que el bug
    // que esto vino a arreglar. Al deshabilitarse la caja, el navegador manda
    // el foco al `body`: ése es el único caso que hay que reparar.
    const dondeEstaElFoco = document.activeElement;
    if (dondeEstaElFoco !== null && dondeEstaElFoco !== document.body) {
      devolverFoco.current = false;
      return;
    }
    devolverFoco.current = false;
    cajaTexto.current?.focus();
  }, [pensando, grabando]);

  function mandarTexto() {
    const t = texto.trim();
    if (t === '' || pensando) return;
    setTexto('');
    devolverFoco.current = true;
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

  if (!abierto) return null;

  return (
    // 🔴 Mismo patrón que el panel del asistente (`AgendaAgentPanel`): en `lg`
    // deja de ser un overlay y pasa a ser un HERMANO FLEX (`lg:static`), así que
    // la hoja se encoge en vez de quedar tapada — que era la queja. Debajo de
    // `lg` cae a barra lateral fija, y en móvil a hoja inferior.
    <div
      className="flex flex-col shrink-0 bg-white border-gray-200 shadow-xl
        fixed z-[55] inset-x-0 bottom-0 h-[60vh] rounded-t-2xl border-t
        sm:inset-x-auto sm:right-0 sm:top-0 sm:bottom-0 sm:h-auto sm:w-96 sm:rounded-none sm:border-t-0 sm:border-l
        lg:static lg:shadow-none lg:border-l lg:h-full lg:min-h-0"
    >
      {/* 🔴 Mismas medidas que el encabezado del asistente de agenda
          (`AgendaAgentPanel`): px-4 py-3, ícono de 4, título text-sm
          font-semibold text-gray-800, botón de cerrar p-1.5. Lo ÚNICO que
          cambia entre los dos chats es el color de acento — azul aquí,
          esmeralda allá — para que se distingan sin parecer otro producto. */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 bg-blue-50">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-blue-600" />
          <span className="text-sm font-semibold text-gray-800">Conversar con el formato</span>
        </div>
        <button
          onClick={onCerrar}
          className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100"
          title="Cerrar"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* 🔴 LO QUE ESTOY LEYENDO — FUERA del contenedor con scroll, a propósito.
          Adentro se iba hacia arriba con cada turno (el panel hace `scrollIntoView`
          al final), y desaparecía justo cuando el doctor está conversando, que es
          el único momento en que quiere comprobarlo. Es la única superficie donde
          se ve que marcar una fuente sirvió de algo: en la hoja no pasa nada hasta
          que se conversa. */}
      <div className="shrink-0 border-b bg-gray-50 px-3 py-2 text-[12px] text-gray-700 max-h-32 overflow-y-auto">
        <p className="font-semibold text-gray-900">Estoy leyendo</p>
        <ul className="mt-1 space-y-0.5">
          {lectura.ancla && (
            <li>
              📗 {lectura.ancla}{' '}
              <span className="text-gray-500">— de aquí salió el pre-llenado</span>
            </li>
          )}
          {lectura.fuentes.map((f, i) => <li key={i}>📎 {f}</li>)}
        </ul>
        {lectura.ancla === null && lectura.fuentes.length === 0 && (
          <p className="mt-1 text-gray-500">
            Nada del expediente todavía. Márcame consultas, notas o recetas en{' '}
            <strong>Fuentes del expediente</strong> y vuelve a preguntarme.
          </p>
        )}
        {/* Lo elegido que NO se puede leer se dice aparte y NO cuenta como leído:
            el panel de fuentes ya lo declara ilegible y las dos cosas tienen que
            decir lo mismo. */}
        {lectura.noLegibles > 0 && (
          <p className="mt-1 text-red-700">
            ⚠️ {lectura.noLegibles} fuente(s) que elegiste ya no se pueden leer, así que{' '}
            <strong>no las recibo</strong>. Quítalas en Fuentes del expediente.
          </p>
        )}
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3 text-sm">
        <p className="rounded-lg bg-blue-50 text-blue-900 px-3 py-2">{SALUDO}</p>

        {/* 🔴 Misma burbuja que el asistente de agenda (`AgendaAgentPanel`):
            avatar redondo de 6, `rounded-2xl` con la esquina de la cola
            recortada, doctor en azul a la derecha, asistente en gris a la
            izquierda. Las anotaciones de este chat (campos colocados, fuentes
            que no se pudieron leer, descartes) cuelgan DEBAJO de la burbuja,
            alineadas con ella. */}
        {mensajes.map((m, i) => {
          const esDoctor = m.role === 'user';
          return (
            <div key={i} className={`flex gap-2 ${esDoctor ? 'flex-row-reverse' : 'flex-row'}`}>
              {/* Los dos avatares van en el color de acento del panel — azul
                  aquí, esmeralda en agenda. Se distinguen por el ícono y por el
                  lado, igual que en el asistente de agenda. */}
              <div className="flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center mt-1 bg-blue-600 text-white">
                {esDoctor ? <User className="w-3.5 h-3.5" /> : <Bot className="w-3.5 h-3.5" />}
              </div>
              <div className={`max-w-[85%] flex flex-col ${esDoctor ? 'items-end' : 'items-start'}`}>
                <div
                  className={`px-3 py-2 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap ${
                    esDoctor
                      ? 'bg-blue-600 text-white rounded-br-md'
                      : 'bg-gray-100 text-gray-800 rounded-bl-md'
                  }`}
                >
                  {m.content}
                </div>
                {/* 🔴 Se dice CUÁNTOS aterrizaron y que están SIN GUARDAR. Sin esto
                    el doctor lee la respuesta, no mira la hoja y cree que ya quedó. */}
                {m.colocados !== undefined && m.colocados > 0 && (
                  <p className="mt-1 px-1 text-[11px] text-amber-700">
                    {m.colocados} campo(s) puestos en la hoja en ámbar — revísalos y aprieta Guardar.
                  </p>
                )}
                {m.fuentesFaltantes && m.fuentesFaltantes.length > 0 && (
                  <p className="mt-1 px-1 text-[11px] text-red-700">
                    {m.fuentesFaltantes.length} fuente(s) que elegiste ya no se pudieron leer
                    ({m.fuentesFaltantes.map((f) => {
                      const d = fechaDeFuente(f.fecha, f.tipo);
                      return d ? `${f.tipo} del ${d}` : f.tipo;
                    }).join(' · ')}):
                    este turno se contestó sin ellas. Quítalas en “Fuentes del expediente”.
                  </p>
                )}
                {m.descartados && m.descartados.length > 0 && (
                  <div className="mt-1 px-1 text-[11px] text-red-700">
                    <p>{m.descartados.length} no se pudieron colocar:</p>
                    <ul className="list-disc pl-4">
                      {m.descartados.map((d, j) => (
                        <li key={j}>
                          {d.motivo === 'caracteres-no-imprimibles'
                            ? `símbolos que el formato no imprime (${(d.caracteres ?? []).join(' ')})`
                            : d.motivo === 'no-es-texto'
                            ? 'el modelo no devolvió texto'
                            : d.motivo === 'opcion-inexistente'
                            // 🔴 Se dicen las opciones REALES. Antes sólo se decía
                            // "no existe", que no le sirve de nada al doctor para
                            // volver a preguntar.
                            ? `esa opción no existe; hay: ${(d.opciones ?? []).join(' · ')}`
                            : 'ese campo no está en esta hoja'}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </div>
          );
        })}

        {pensando && (
          <p className="inline-flex items-center gap-2 text-gray-500">
            <Loader2 className="h-4 w-4 animate-spin" /> Pensando…
          </p>
        )}
        {error && <p className="rounded-lg bg-red-50 text-red-800 px-3 py-2">{error}</p>}
        <div ref={fin} />
      </div>

      <div className="border-t border-gray-200 p-3">
        <div className="flex items-end gap-2">
          <textarea
            ref={cajaTexto}
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
            className="flex-1 resize-none px-3 py-2 text-sm border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-50"
          />
          <button
            onClick={alternarMicrofono}
            disabled={pensando}
            title={grabando ? 'Detener y mandar' : 'Hablar en vez de teclear'}
            className={`shrink-0 rounded-xl border p-2 disabled:opacity-40 ${
              grabando
                ? 'bg-red-600 text-white border-red-600 animate-pulse'
                : 'border-gray-300 hover:bg-gray-50'
            }`}
          >
            {grabando ? <Square className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
          </button>
          <button
            onClick={mandarTexto}
            disabled={pensando || grabando || texto.trim() === ''}
            className="shrink-0 rounded-xl bg-blue-600 text-white p-2 disabled:opacity-40 hover:bg-blue-700"
            title="Mandar"
          >
            <Send className="h-4 w-4" />
          </button>
        </div>
        <p className="mt-1 text-[11px] text-gray-500">
          Lo que proponga queda <strong>sin guardar</strong> hasta que aprietes Guardar.
        </p>
      </div>
    </div>
  );
}
