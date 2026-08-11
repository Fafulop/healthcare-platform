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

import { useMemo } from 'react';
import { AlertTriangle, FileText, Loader2, NotebookPen, Pill } from 'lucide-react';

/** `2026-03-12T…` → ` del 12/03/2026`. Vacío si se guardó sin fecha. */
function fechaCorta(iso: string | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return ` del ${d.toLocaleDateString('es-MX', { timeZone: 'America/Mexico_City' })}`;
}

export interface FuenteDisponible {
  tipo: 'consulta' | 'nota' | 'receta';
  id: string;
  fecha: string;
  actualizadoEn: string;
  titulo: string;
  resumen: string;
  tokensAprox: number;
}

export interface FuenteElegida {
  tipo: 'consulta' | 'nota' | 'receta';
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
  disponibles, seleccion, anclaId, presupuestoTokens, guardando, soloLectura, onAlternar,
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

  return (
    <div className="bg-white rounded-lg border p-4">
      <p className="text-sm font-semibold text-gray-900">Fuentes del expediente</p>
      <p className="mt-1 text-xs text-gray-500">
        El asistente lee la consulta de este informe siempre. Marca aquí lo demás que quieras
        que lea —otras consultas, notas, recetas— y te lo va a poder colocar en la hoja.{' '}
        <strong>Lo que salga de aquí queda en ámbar</strong>: lo interpretó el asistente, no
        lo copió el sistema.
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
              return (
                <div key={tipo}>
                  <p className="flex items-center gap-1.5 text-xs font-semibold text-gray-700">
                    <Icono className="h-3.5 w-3.5" /> {NOMBRE[tipo]}
                  </p>
                  <div className="mt-1 divide-y border rounded-lg">
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
                            onChange={(e) => onAlternar({ tipo: f.tipo, id: f.id }, e.target.checked)}
                          />
                          <span className="min-w-0 flex-1">
                            <span className="block font-medium text-gray-800">
                              {f.titulo}
                              {guardando === llave && (
                                <Loader2 className="inline h-3 w-3 ml-1 animate-spin text-gray-400" />
                              )}
                            </span>
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
                            {SINGULAR[f.tipo]}{fechaCorta(f.fecha)}
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
