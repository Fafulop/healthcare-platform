'use client';

import { useMemo, useState } from 'react';
import { X } from 'lucide-react';
import { type TratamientoDetalle } from '@/lib/tratamientos-ui';
import {
  FormularioDeFilas, ResultadosDeFilas, agendarFilas, useAgendaDeSesiones, type Fila, type Resultado,
} from './FilasDeSesiones';

/**
 * TRATAMIENTOS T5 → v2 · V3 — «Agendar sesiones»: las sesiones «Por agendar» como FILAS (servicio,
 * precio, fecha, hora, «después», disponibilidad) — la misma pantalla y la misma maquinaria que
 * «Nuevo tratamiento» (`FilasDeSesiones.tsx`), así no se separan. Antes de crear la cita de cada
 * fila se guarda en la sesión lo que cambió de su servicio/precio (la cita NACE con el precio de la
 * sesión, V1). Reglas de T5 en `FilasDeSesiones.tsx`.
 */
export function AgendarSesionesModal({ patientId, tratamiento, onClose, onListo }: {
  patientId: string;
  tratamiento: TratamientoDetalle;
  onClose: () => void;
  /** Recarga el tratamiento (se llama al cerrar si algo se creó o cambió). */
  onListo: () => void;
}) {
  const porAgendar = useMemo(
    () => tratamiento.sesiones.filter((s) => s.estado === 'por_agendar' && !s.cancelada && !s.visita),
    [tratamiento.sesiones],
  );
  const filasIniciales = useMemo<Fila[]>(() => porAgendar.map((s) => {
    const precioPropio = s.fuente === 'sesion' && s.precio != null ? s.precio : null;
    return {
      key: s.id, numero: s.numero, sesionId: s.id,
      servicioId: s.servicioId ?? '', servicioNombre: s.servicioNombre ?? '',
      precio: precioPropio !== null ? String(precioPropio) : '',
      fecha: '', hora: '', despues: false, tocada: false,
      original: { servicioId: s.servicioId, servicioNombre: s.servicioNombre, precio: precioPropio },
    };
  }), [porAgendar]);
  const a = useAgendaDeSesiones(patientId, filasIniciales, tratamiento.intervaloDias ?? null);
  const [enviando, setEnviando] = useState(false);
  const [resultados, setResultados] = useState<Resultado[] | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [cambio, setCambio] = useState(false);
  const planeadas = tratamiento.sesionesPlaneadas;
  const urlT = `/api/medical-records/patients/${patientId}/tratamientos/${tratamiento.id}`;

  const agendar = async () => {
    if (!a.listo || enviando) return;
    setEnviando(true);
    setResultados([]);

    // 1. Lo que cambió de servicio/precio, a su sesión (todas: también las «después»). Si NO se pudo
    // guardar, esa sesión NO se agenda: su cita nacería con el precio viejo y la pantalla diría
    // «agendada». Se dice en su renglón.
    const noGuardadas: Resultado[] = [];
    for (const f of a.filas) {
      const o = f.original;
      if (!o || !f.sesionId) continue;
      const body: Record<string, unknown> = {};
      if ((f.servicioId || null) !== (o.servicioId ?? null)) body.servicioId = f.servicioId || null;
      if ((f.servicioNombre || null) !== (o.servicioNombre ?? null)) body.servicioNombre = f.servicioNombre || null;
      const p = f.precio.trim() === '' ? null : Number(f.precio);
      if (a.conFlujo && p !== o.precio) body.precio = p;
      if (Object.keys(body).length === 0) continue;
      let ok = false;
      let error = 'no se pudo guardar su servicio/precio';
      try {
        const res = await fetch(`${urlT}/sesiones/${f.sesionId}`, {
          method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
        });
        const d = await res.json().catch(() => null);
        ok = res.ok;
        if (!ok && d?.error) error = `no se pudo guardar su servicio/precio (${d.error})`;
      } catch { /* error de red: `ok` sigue en false */ }
      if (ok) setCambio(true);
      else if (!f.despues) noGuardadas.push({ key: f.key, numero: f.numero, fecha: f.fecha, hora: f.hora, ok: false, error });
    }
    if (noGuardadas.length) setResultados([...noGuardadas]);

    // 2. Las citas de las filas a agendar (menos las que no pudieron guardar su servicio/precio).
    const fallidas = new Set(noGuardadas.map((r) => r.key));
    const aAgendar = a.aAgendar.flatMap((f) => (f.sesionId && !fallidas.has(f.key) ? [{ ...f, sesionId: f.sesionId }] : []));
    const fin = await agendarFilas(a, patientId, aAgendar, (hechas) => setResultados([...noGuardadas, ...hechas]));
    setResultados([...noGuardadas, ...fin.resultados]);
    setAviso(fin.aviso);

    // 3. El intervalo usado (si cambió): la próxima vez viene precargado.
    const n = Number(a.base.cada);
    if (a.cadaValido && n !== tratamiento.intervaloDias) {
      fetch(urlT, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ intervaloDias: n }),
      }).catch(() => {});
    }
    setEnviando(false);
  };

  const cerrar = () => {
    if (enviando) return;
    if (cambio || resultados?.some((r) => r.ok)) onListo();
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-xl shadow-lg max-w-lg w-full max-h-[92vh] flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h2 className="text-lg font-semibold text-gray-900">Agendar sesiones</h2>
          <button onClick={cerrar} disabled={enviando} className="p-1 rounded hover:bg-gray-100 text-gray-500" aria-label="Cerrar">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="px-5 py-4 space-y-4 overflow-y-auto">
          {resultados ? (
            <ResultadosDeFilas resultados={resultados} total={a.aAgendar.length} planeadas={planeadas} corriendo={enviando} aviso={aviso} />
          ) : porAgendar.length === 0 ? (
            <p className="text-sm text-gray-500">No hay sesiones «Por agendar». Agrega una sesión o desliga la cita de alguna.</p>
          ) : (
            <FormularioDeFilas a={a} planeadas={planeadas} />
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
                disabled={!a.listo || a.aAgendar.length === 0}
                className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 font-medium"
              >
                Agendar {a.aAgendar.length} {a.aAgendar.length === 1 ? 'cita' : 'citas'}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
