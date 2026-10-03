'use client';

import { useMemo, useState } from 'react';
import { X } from 'lucide-react';
import { etiquetaSesion, type TratamientoDetalle } from '@/lib/tratamientos-ui';
import {
  FormularioDeFilas, ResultadosDeFilas, agendarFilas, useAgendaDeSesiones, type Fila, type Resultado,
} from './FilasDeSesiones';

/**
 * Qué agenda esta ventana (TRATAMIENTOS v2 · V4, 06-PLAN §3.1):
 *   · `pendientes` — «Agendar sesiones…»: todas las «Por agendar» (T5);
 *   · `sesion`     — «Agendar» desde la tarjeta de UNA sesión «Por agendar»;
 *   · `reagendar`  — «Reagendar» UNA sesión con cita activa: cita nueva como la agenda (`reagendaDe`)
 *                    y se cancela la vieja;
 *   · `nueva`      — «Agregar sesión»: la sesión nace con su servicio y precio y, si no es «después»,
 *                    su cita en el mismo paso.
 */
export type ModoAgendar =
  | { tipo: 'pendientes' }
  | { tipo: 'sesion'; sesionId: string }
  | { tipo: 'reagendar'; sesionId: string }
  | { tipo: 'nueva' };

const TITULO: Record<ModoAgendar['tipo'], string> = {
  pendientes: 'Agendar sesiones', sesion: 'Agendar sesión', reagendar: 'Reagendar sesión', nueva: 'Agregar sesión',
};

/**
 * T5 → v2 · V3/V4 — las sesiones como FILAS (servicio, precio, fecha, hora, «después», disponibilidad):
 * la misma pantalla y la misma maquinaria que «Nuevo tratamiento» (`FilasDeSesiones.tsx`). Antes de
 * crear la cita de una sesión existente se guarda lo que cambió de su servicio/precio (la cita NACE con
 * el precio de la sesión, V1); si eso falla, esa sesión NO se agenda.
 */
export function AgendarSesionesModal({ patientId, tratamiento, onClose, onListo, modo = { tipo: 'pendientes' }, puedeAgendar = true }: {
  patientId: string;
  tratamiento: TratamientoDetalle;
  onClose: () => void;
  /** Recarga el tratamiento (se llama al cerrar si algo se creó o cambió). */
  onListo: () => void;
  modo?: ModoAgendar;
  /** Permiso de citas Y tratamiento activo. Sin él, `nueva` sólo pide servicio y precio. */
  puedeAgendar?: boolean;
}) {
  const soloServicio = modo.tipo === 'nueva' && !puedeAgendar;
  const sesiones = useMemo(() => {
    if (modo.tipo === 'nueva') return [];
    if (modo.tipo === 'pendientes') {
      // V4 paso 2: también las que tienen su visita abierta, si es la de su cita (viaja a la nueva).
      return tratamiento.sesiones.filter((s) => s.estado === 'por_agendar' && !s.cancelada && (!s.visita || s.visitaViaja));
    }
    return tratamiento.sesiones.filter((s) => s.id === modo.sesionId);
  }, [tratamiento.sesiones, modo]);

  const siguienteNumero = Math.max(0, ...tratamiento.sesiones.map((s) => s.numero)) + 1;
  const filasIniciales = useMemo<Fila[]>(() => {
    if (modo.tipo === 'nueva') {
      return [{ key: 'nueva', numero: siguienteNumero, servicioId: '', servicioNombre: '', precio: '', fecha: '', hora: '', despues: soloServicio, tocada: false }];
    }
    return sesiones.map((s) => {
      const precioPropio = s.fuente === 'sesion' && s.precio != null ? s.precio : null;
      // Reagendar una sesión vieja (sin servicio/precio propios): la cita nueva sigue a la vieja — su
      // servicio (por nombre) y su precio —, no el primero de la lista.
      const deSuCita = modo.tipo === 'reagendar' && !s.servicioId;
      const precioInicial = precioPropio ?? (modo.tipo === 'reagendar' && s.precio != null ? s.precio : null);
      return {
        key: s.id, numero: s.numero, sesionId: s.id,
        servicioId: s.servicioId ?? '', servicioNombre: s.servicioNombre ?? (deSuCita ? s.cita?.servicio ?? '' : ''),
        precio: precioInicial !== null ? String(precioInicial) : '',
        fecha: '', hora: '', despues: false, tocada: false,
        original: { servicioId: s.servicioId, servicioNombre: s.servicioNombre, precio: precioPropio },
        ...(modo.tipo === 'reagendar' && s.cita ? { reagendaDe: s.cita.id } : {}),
      };
    });
  }, [sesiones, modo.tipo, siguienteNumero, soloServicio]);

  const a = useAgendaDeSesiones(patientId, filasIniciales, tratamiento.intervaloDias ?? null);
  const [enviando, setEnviando] = useState(false);
  const [resultados, setResultados] = useState<Resultado[] | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [cambio, setCambio] = useState(false);
  const planeadas = tratamiento.sesionesPlaneadas;
  const urlT = `/api/medical-records/patients/${patientId}/tratamientos/${tratamiento.id}`;

  const guardarFila = async (f: Fila): Promise<{ ok: true; sesionId: string } | { ok: false; error: string }> => {
    const precio = a.conFlujo && f.precio.trim() !== '' ? Number(f.precio) : null;
    // `nueva`: la sesión nace aquí, con su servicio y precio.
    if (!f.sesionId) {
      try {
        const res = await fetch(`${urlT}/sesiones`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            servicioId: f.servicioId || null, servicioNombre: f.servicioNombre || null,
            ...(a.conFlujo && precio !== null ? { precio } : {}),
          }),
        });
        const d = await res.json().catch(() => null);
        if (!res.ok || !d?.data?.id) return { ok: false, error: `no se pudo crear la sesión${d?.error ? ` (${d.error})` : ''}` };
        setCambio(true);
        return { ok: true, sesionId: d.data.id };
      } catch {
        return { ok: false, error: 'no se pudo crear la sesión (error de conexión)' };
      }
    }
    // Existente: sólo lo que cambió de su servicio/precio.
    const o = f.original;
    const body: Record<string, unknown> = {};
    if (o) {
      if ((f.servicioId || null) !== (o.servicioId ?? null)) body.servicioId = f.servicioId || null;
      if ((f.servicioNombre || null) !== (o.servicioNombre ?? null)) body.servicioNombre = f.servicioNombre || null;
      if (a.conFlujo && precio !== o.precio) body.precio = precio;
    }
    if (Object.keys(body).length === 0) return { ok: true, sesionId: f.sesionId };
    try {
      const res = await fetch(`${urlT}/sesiones/${f.sesionId}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
      });
      const d = await res.json().catch(() => null);
      if (!res.ok) return { ok: false, error: `no se pudo guardar su servicio/precio${d?.error ? ` (${d.error})` : ''}` };
      setCambio(true);
      return { ok: true, sesionId: f.sesionId };
    } catch {
      return { ok: false, error: 'no se pudo guardar su servicio/precio (error de conexión)' };
    }
  };

  const agendar = async () => {
    if (!a.listo || enviando) return;
    setEnviando(true);
    setResultados([]);

    // 1. Cada fila a su sesión (crearla o guardar lo que cambió). Si falla, esa fila NO se agenda: su
    // cita nacería con el precio viejo (o sin sesión) y la pantalla diría «agendada».
    const fallidas: Resultado[] = [];
    const listas: (Fila & { sesionId: string })[] = [];
    for (const f of a.filas) {
      const r = await guardarFila(f);
      if (!r.ok) {
        // Una sesión que no NACIÓ no «se queda por agendar»: el texto ya lo dice todo.
        fallidas.push({
          key: f.key, numero: f.numero, fecha: f.despues ? '' : f.fecha, hora: f.hora, ok: false, error: r.error,
          completo: f.despues || !f.sesionId,
        });
      } else if (!f.despues) {
        listas.push({ ...f, sesionId: r.sesionId });
      }
    }
    if (fallidas.length) setResultados([...fallidas]);

    // 2. Las citas (agendar o reagendar).
    const fin = await agendarFilas(a, patientId, listas, (hechas) => setResultados([...fallidas, ...hechas]));
    setResultados([...fallidas, ...fin.resultados]);
    setAviso(fin.aviso);

    // 3. El intervalo usado (si cambió): la próxima vez viene precargado.
    const n = Number(a.base.cada);
    // Sólo si se VIO: con una sola fila «Cada (días)» no se enseña y guardaría el 7 del default.
    if (modo.tipo === 'pendientes' && a.filas.length > 1 && a.cadaValido && n !== tratamiento.intervaloDias) {
      fetch(urlT, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ intervaloDias: n }),
      }).catch(() => {});
    }
    // `nueva` sin cita: no hubo nada que agendar; la sesión ya existe — se cierra solo.
    if (modo.tipo === 'nueva' && listas.length === 0 && fallidas.length === 0) {
      onListo();
      onClose();
      return;
    }
    setEnviando(false);
  };

  const cerrar = () => {
    if (enviando) return;
    if (cambio || resultados?.some((r) => r.ok)) onListo();
    onClose();
  };

  const vacio = modo.tipo !== 'nueva' && sesiones.length === 0;
  const titulo = modo.tipo === 'sesion' || modo.tipo === 'reagendar'
    ? `${TITULO[modo.tipo]} · ${sesiones[0] ? etiquetaSesion(sesiones[0].numero, planeadas) : ''}`
    : TITULO[modo.tipo];
  const textoBoton = modo.tipo === 'reagendar' ? 'Reagendar'
    : modo.tipo === 'nueva' ? (a.aAgendar.length ? 'Agregar y agendar' : 'Agregar sesión')
    : `Agendar ${a.aAgendar.length} ${a.aAgendar.length === 1 ? 'cita' : 'citas'}`;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-xl shadow-lg max-w-lg w-full max-h-[92vh] flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h2 className="text-lg font-semibold text-gray-900">{titulo}</h2>
          <button onClick={cerrar} disabled={enviando} className="p-1 rounded hover:bg-gray-100 text-gray-500" aria-label="Cerrar">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="px-5 py-4 space-y-4 overflow-y-auto">
          {resultados ? (
            <ResultadosDeFilas resultados={resultados} total={a.aAgendar.length} planeadas={planeadas} corriendo={enviando} aviso={aviso} />
          ) : vacio ? (
            <p className="text-sm text-gray-500">
              {modo.tipo === 'pendientes'
                ? 'No hay sesiones «Por agendar». Agrega una sesión o desliga la cita de alguna.'
                : 'Esa sesión ya no está disponible: recarga el tratamiento.'}
            </p>
          ) : (
            <>
              {modo.tipo === 'reagendar' && (
                <p className="text-sm text-gray-600">
                  Se crea la cita nueva y se cancela la anterior (con sus avisos al paciente, como en la agenda).
                </p>
              )}
              <FormularioDeFilas
                a={a} planeadas={planeadas} soloServicio={soloServicio}
                conDespues={modo.tipo === 'pendientes' || modo.tipo === 'nueva'}
              />
              {soloServicio && (
                <p className="text-xs text-gray-500">
                  La sesión queda «Por agendar»: para darle fecha se necesita el permiso de citas y el tratamiento activo.
                </p>
              )}
            </>
          )}
        </div>

        <div className="flex justify-end gap-2 px-5 py-4 border-t border-gray-100">
          {resultados ? (
            <button onClick={cerrar} disabled={enviando} className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50">
              {enviando ? 'Agendando…' : 'Cerrar'}
            </button>
          ) : (
            <>
              <button onClick={cerrar} className="px-4 py-2 text-sm border border-gray-200 text-gray-600 rounded-lg hover:bg-gray-50">Cancelar</button>
              <button
                onClick={agendar}
                disabled={!a.listo || vacio || (modo.tipo !== 'nueva' && a.aAgendar.length === 0)}
                className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 font-medium"
              >
                {textoBoton}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
