'use client';

/**
 * EL PANEL DE FUENTES (07-PLAN §7 paso 4).
 *
 * El informe se ancla a UNA consulta —la que da el pre-llenado 🟩 verde— y aquí
 * el doctor elige QUÉ MÁS lee el asistente: otras consultas, notas y recetas. Lo
 * que salga de ellas cae en 🟧 ámbar, porque lo interpretó un modelo y no lo
 * copió el sistema.
 *
 * 🔴 Arranca VACÍO a propósito (07-PLAN §10 #1): nada se adjunta solo. Que el
 * doctor elija ES la minimización de datos (06-AGENTE §7.3), no una excepción a
 * ella.
 *
 * 🔴 Cada casilla se GUARDA al marcarla. El chat lee las fuentes de la base, así
 * que una selección "pendiente" sería una que el doctor ve marcada y el modelo
 * nunca recibe — lo que se ve tiene que ser lo que se manda.
 */

import { useMemo, useState } from 'react';
import {
  AlertTriangle, ChevronRight, FileText, Loader2, NotebookPen, Pill, Sparkles,
} from 'lucide-react';
// 🔴 La zona depende de la CLASE de fecha de cada tipo de fuente, y esa decisión
// vive en un solo módulo. Formatear aquí a mano en hora de México corría un día
// las consultas y las recetas — que son días de calendario, no instantes.
import { fechaDeFuente, type TipoFuente } from '@/lib/informe-medico/fechas-de-fuente';

export interface FuenteDisponible {
  tipo: TipoFuente;
  id: string;
  fecha: string;
  actualizadoEn: string;
  titulo: string;
  resumen: string;
  tokensAprox: number;
  /** Lo que hay que saber ANTES de elegirla (hoy: "vencida el …"). */
  aviso?: string;
}

export interface FuenteElegida {
  tipo: TipoFuente;
  id: string;
  /** La fecha con la que se GUARDÓ. Es lo único que queda para nombrar una
   * fuente que ya no está en el expediente. */
  fecha?: string;
}

interface Props {
  disponibles: FuenteDisponible[];
  seleccion: FuenteElegida[];
  /** La consulta ANCLA: no se ofrece, porque ya entra sola. */
  anclaId: string | null;
  presupuestoTokens: number;
  /** `null` = ninguna en vuelo. Si no, la llave `tipo:id` que se está guardando. */
  guardando: string | null;
  soloLectura: boolean;
  /**
   * 🔴 ¿Hay un asistente vivo que pueda leer esto AHORA?
   *
   * `false` antes de generar el informe (lo marcado viaja en el POST y aún no se
   * guarda) y en un informe EMITIDO (el chat ni siquiera se monta). En esos dos
   * estados decir "el asistente la lee" es afirmar algo falso.
   */
  hayAsistente: boolean;
  /**
   * 🔴 EL DISPARADOR. Marcar una casilla no llena nada; lo que llena es un turno
   * del chat, y el doctor no tiene por qué adivinar que hay que escribirle un
   * mensaje —ni cuál—. Este botón manda ese turno por él.
   */
  onLlenarConLasFuentes: () => void;
  /** El chat está pensando o grabando: el botón no puede dispararse ahora. */
  chatOcupado: boolean;
  onAlternar: (f: FuenteElegida, marcar: boolean) => void;
}

const ICONO = {
  consulta: FileText,
  nota: NotebookPen,
  receta: Pill,
} as const;

const NOMBRE = {
  consulta: 'Consultas',
  nota: 'Notas',
  receta: 'Recetas',
} as const;

/** Para nombrar UNA fuente suelta: "Nota del 12/03/2026", no "Notas del…". */
const SINGULAR = {
  consulta: 'Consulta',
  nota: 'Nota',
  receta: 'Receta',
} as const;

export default function PanelFuentes({
  disponibles, seleccion, anclaId, presupuestoTokens, guardando, soloLectura,
  hayAsistente, onAlternar, onLlenarConLasFuentes, chatOcupado,
}: Props) {
  const elegidas = useMemo(
    () => new Set(seleccion.map((f) => `${f.tipo}:${f.id}`)),
    [seleccion]
  );

  // El ancla no se ofrece: ya entra sola y marcarla otra vez no añade nada.
  const lista = disponibles.filter((f) => !(f.tipo === 'consulta' && f.id === anclaId));
  const porLlave = useMemo(
    () => new Map(lista.map((f) => [`${f.tipo}:${f.id}`, f])),
    [lista]
  );

  /**
   * 🔴 HUÉRFANAS: elegidas que ya NO están en el catálogo — se borró la nota, la
   * receta volvió a borrador, la consulta se quedó sin contenido.
   *
   * Se pintan igual que las demás, marcadas y desmarcables. Si sólo se listara
   * el catálogo, esas fuentes seguirían guardadas y viajando en cada guardado
   * **sin una casilla que desmarcar**, y el panel enseñaría una lista más corta
   * que la que el informe de verdad tiene: la misma trampa de siempre —una lista
   * que se ve completa afirmando algo falso sobre el expediente.
   */
  const huerfanas = seleccion.filter(
    (f) => !porLlave.has(`${f.tipo}:${f.id}`) && !(f.tipo === 'consulta' && f.id === anclaId)
  );

  // El presupuesto se cuenta sobre la SELECCIÓN, no sobre el catálogo filtrado:
  // contando sólo lo que sigue en la lista, el marcador decía "2 fuentes · 0 de
  // 6000" y dejaba marcar de más hasta que el servidor lo rechazaba.
  const usados = seleccion.reduce(
    (t, f) => t + (porLlave.get(`${f.tipo}:${f.id}`)?.tokensAprox ?? 0), 0
  );
  const porcentaje = Math.min(100, Math.round((usados / presupuestoTokens) * 100));

  const porTipo = (['consulta', 'nota', 'receta'] as const)
    .map((tipo) => [tipo, lista.filter((f) => f.tipo === tipo)] as const)
    .filter(([, fs]) => fs.length > 0);

  /**
   * Qué grupos están abiertos.
   *
   * 🔴 Por defecto se abre el grupo que TIENE algo marcado, pero en cuanto el
   * doctor abre o cierra uno a mano, manda su decisión (`alternados`). Sin esa
   * distinción, la selección llega del servidor un instante después de montar y
   * volvería a abrir un grupo que él acababa de cerrar.
   */
  const [alternados, setAlternados] = useState<Partial<Record<TipoFuente, boolean>>>({});
  const tieneMarcadas = (tipo: TipoFuente) =>
    lista.some((f) => f.tipo === tipo && elegidas.has(`${f.tipo}:${f.id}`));
  const estaAbierto = (tipo: TipoFuente) => alternados[tipo] ?? tieneMarcadas(tipo);

  return (
    <div className="bg-white rounded-lg border p-4">
      <p className="text-sm font-semibold text-gray-900">Fuentes del expediente</p>
      {/* 🔴 Lo primero que hay que decir, porque es lo que se malentiende:
          marcar una casilla NO llena la hoja. El doctor marcó las cinco, no vio
          cambiar nada en el formato, y concluyó —con toda la razón— que estaba
          roto. Lo único que hace marcar es dárselo al asistente. */}
      {/* 🔴 El texto depende del estado, porque el botón no siempre existe: antes
          de generar el informe y en uno emitido NO hay asistente, y decir "aprieta
          el botón de abajo" señalaba a un botón que no está. */}
      <p className="mt-1 text-xs text-amber-900 bg-amber-50 border border-amber-200 rounded p-2">
        <strong>Marcar aquí no llena la hoja todavía.</strong>{' '}
        {hayAsistente ? (
          <>
            Marca lo que quieras que el asistente lea y luego aprieta el botón de abajo.
          </>
        ) : (
          <>
            Se guarda con el informe, y el asistente podrá usarlo en cuanto lo generes.
          </>
        )}{' '}
        Lo que ponga sale en <strong>ámbar</strong> para que lo revises, porque lo interpretó
        un modelo y no lo copió el sistema. Nada se guarda hasta que aprietes Guardar.
      </p>

      {/* 🔴 EL DISPARADOR, junto a las casillas y no escondido en el chat: aquí
          es donde el doctor marca y se queda esperando a que pase algo. Sin él,
          el único disparador era escribirle un mensaje al asistente — y había que
          adivinar que hacía falta, y qué escribir.
          Sólo se ofrece si hay ALGO que leer: con el expediente vacío mandaría un
          turno que le pide al modelo usar unas fuentes que no existen. */}
      {hayAsistente && (lista.length > 0 || anclaId !== null) && (
        <button
          onClick={onLlenarConLasFuentes}
          disabled={guardando !== null || chatOcupado}
          title={chatOcupado ? 'El asistente está trabajando; espera a que termine' : ''}
          className="mt-2 w-full inline-flex items-center justify-center gap-2 rounded-lg bg-blue-600
            px-3 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {chatOcupado
            ? <><Loader2 className="h-4 w-4 animate-spin" /> El asistente está trabajando…</>
            : <><Sparkles className="h-4 w-4" /> Llenar la hoja con lo que marqué</>}
        </button>
      )}
      <p className="mt-1 text-xs text-gray-500">
        La consulta de la que sale este informe la lee siempre, aunque no aparezca en esta lista.
      </p>

      {lista.length === 0 && huerfanas.length === 0 ? (
        <p className="mt-3 text-sm text-gray-600">
          Este paciente no tiene nada más en el expediente que se pueda usar como fuente.
        </p>
      ) : (
        <>
          <div className="mt-3">
            <div className="flex items-center justify-between text-[11px] text-gray-600">
              <span>
                {seleccion.length} fuente(s) · {usados} de {presupuestoTokens} de espacio
              </span>
              {porcentaje >= 100 && (
                <span className="text-red-700 font-medium">
                  Ya no cabe más: quita una para marcar otra.
                </span>
              )}
            </div>
            {/* 🔴 El presupuesto se ve. No es un límite técnico —el modelo admite
                muchísimo más— sino de CALIDAD: entre más historia arrastra, peor
                elige entre los 255 campos de la hoja (07-PLAN §11). */}
            <div className="mt-1 h-1.5 w-full rounded bg-gray-100">
              <div
                className={`h-1.5 rounded ${porcentaje >= 100 ? 'bg-red-500' : 'bg-blue-500'}`}
                style={{ width: `${porcentaje}%` }}
              />
            </div>
          </div>

          <div className="mt-3 space-y-4 max-h-96 overflow-y-auto">
            {porTipo.map(([tipo, fs]) => {
              const Icono = ICONO[tipo];
              const abierto = estaAbierto(tipo);
              const marcadasAqui = fs.filter((f) => elegidas.has(`${f.tipo}:${f.id}`)).length;
              return (
                <div key={tipo}>
                  {/* 🔴 El encabezado dice CUÁNTAS hay y cuántas están marcadas
                      aunque el grupo esté cerrado: si hubiera que abrirlo para
                      saberlo, plegarlo dejaría de ser un resumen y sería esconder
                      información. */}
                  <button
                    type="button"
                    onClick={() => setAlternados((a) => ({ ...a, [tipo]: !abierto }))}
                    aria-expanded={abierto}
                    className="flex w-full items-center gap-1.5 rounded px-1 py-1 text-xs font-semibold
                      text-gray-700 hover:bg-gray-50"
                  >
                    <ChevronRight
                      className={`h-3.5 w-3.5 shrink-0 text-gray-400 transition-transform ${abierto ? 'rotate-90' : ''}`}
                    />
                    <Icono className="h-3.5 w-3.5 shrink-0" />
                    <span>{NOMBRE[tipo]}</span>
                    <span className="font-normal text-gray-400">({fs.length})</span>
                    {marcadasAqui > 0 && (
                      <span className="ml-auto rounded bg-green-100 px-1.5 py-0.5 text-[11px] font-medium text-green-800">
                        {marcadasAqui} marcada{marcadasAqui > 1 ? 's' : ''}
                      </span>
                    )}
                  </button>
                  <div className={`mt-1 divide-y border rounded-lg ${abierto ? '' : 'hidden'}`}>
                    {fs.map((f) => {
                      const llave = `${f.tipo}:${f.id}`;
                      const marcada = elegidas.has(llave);
                      // No se puede marcar lo que ya no cabe; desmarcar SIEMPRE
                      // se puede, o el doctor quedaría atorado en el tope.
                      const noCabe = !marcada && usados + f.tokensAprox > presupuestoTokens;
                      return (
                        <label
                          key={llave}
                          className={`flex items-start gap-2 p-2 text-sm ${
                            soloLectura || noCabe ? 'opacity-50' : 'cursor-pointer hover:bg-gray-50'
                          }`}
                          title={noCabe ? 'No cabe: quita otra fuente primero' : ''}
                        >
                          <input
                            type="checkbox"
                            className="mt-1"
                            checked={marcada}
                            disabled={soloLectura || noCabe || guardando !== null}
                            onChange={(e) => {
                              // 🔴 Tocar una casilla FIJA el grupo abierto. Sin esto,
                              // desmarcar la última de un grupo lo hacía cerrarse solo
                              // debajo del cursor: el default "abierto si tiene
                              // marcadas" dejaba de cumplirse justo al desmarcar.
                              setAlternados((a) => ({ ...a, [f.tipo]: true }));
                              onAlternar({ tipo: f.tipo, id: f.id }, e.target.checked);
                            }}
                          />
                          <span className="min-w-0 flex-1">
                            <span className="block font-medium text-gray-800">
                              {f.titulo}
                              {guardando === llave && (
                                <Loader2 className="inline h-3 w-3 ml-1 animate-spin text-gray-400" />
                              )}
                              {/* Se guarda al marcarla, pero el spinner dura un
                                  parpadeo: sin esta marca no queda ninguna señal
                                  de que la selección quedó registrada.
                                  🔴 "la lee" SÓLO si hay un asistente que pueda
                                  leerla: antes de generar el informe esto todavía
                                  no está guardado, y en uno emitido el chat ni
                                  existe. Si no, dice sólo que quedó elegida. */}
                              {marcada && guardando !== llave && (
                                <span className="ml-1.5 text-[11px] font-normal text-green-700">
                                  {hayAsistente ? '✓ el asistente la lee' : '✓ elegida'}
                                </span>
                              )}
                            </span>
                            {/* 🔴 Sin esto el doctor cuenta 3 recetas aquí y 2 en
                                el ledger, y no hay forma de saber por qué. */}
                            {f.aviso && (
                              <span className="inline-block my-0.5 text-[11px] px-1.5 py-0.5 rounded bg-amber-100 text-amber-900">
                                {f.aviso}
                              </span>
                            )}
                            <span className="block text-xs text-gray-500 truncate">{f.resumen}</span>
                          </span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              );
            })}

            {huerfanas.length > 0 && (
              <div>
                <p className="flex items-center gap-1.5 text-xs font-semibold text-red-700">
                  <AlertTriangle className="h-3.5 w-3.5" /> Ya no están en el expediente
                </p>
                <p className="text-[11px] text-gray-500">
                  Las elegiste y ahora no se pueden leer. El asistente no las recibe: quítalas.
                </p>
                <div className="mt-1 divide-y border border-red-200 rounded-lg">
                  {huerfanas.map((f) => {
                    const llave = `${f.tipo}:${f.id}`;
                    return (
                      <label key={llave} className="flex items-start gap-2 p-2 text-sm cursor-pointer hover:bg-red-50">
                        <input
                          type="checkbox"
                          className="mt-1"
                          checked
                          disabled={soloLectura || guardando !== null}
                          onChange={() => onAlternar({ tipo: f.tipo, id: f.id }, false)}
                        />
                        <span className="min-w-0 flex-1">
                          <span className="block font-medium text-gray-800">
                            {SINGULAR[f.tipo]}
                            {fechaDeFuente(f.fecha, f.tipo) && ` del ${fechaDeFuente(f.fecha, f.tipo)}`}
                            {guardando === llave && (
                              <Loader2 className="inline h-3 w-3 ml-1 animate-spin text-gray-400" />
                            )}
                          </span>
                          <span className="block text-xs text-red-700">
                            borrada, cancelada o sin contenido
                          </span>
                        </span>
                      </label>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
