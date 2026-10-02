'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, X } from 'lucide-react';
import { toast } from '@/lib/practice-toast';
import { tratamientoHref } from '@/lib/tratamientos-ui';
import {
  FormularioDeFilas, ResultadosDeFilas, agendarFilas, useAgendaDeSesiones, type Fila, type Resultado,
} from './FilasDeSesiones';

interface Props {
  patientId: string;
  onClose: () => void;
}

const filaNueva = (numero: number): Fila => ({
  key: `n${numero}`, numero, servicioId: '', servicioNombre: '', precio: '', fecha: '', hora: '', despues: false, tocada: false,
});

/**
 * «Nuevo tratamiento» — TRATAMIENTOS v2 · V3 (docs/DESDE JUNIO/VISITAS/06-PLAN-tratamientos-v2.md
 * §3.1): con N sesiones aparecen de inmediato N filas (servicio, precio, fecha, hora, «agendar
 * después», disponibilidad). Al confirmar: el tratamiento nace con sus sesiones (servicio y precio de
 * cada una) en UNA transacción, y luego se agendan las filas que no son «después» con la MISMA
 * maquinaria que «Agendar sesiones» (`agendarFilas`). Si una cita falla, su sesión queda «por agendar».
 * Sin número de sesiones = sin filas (se agregan después, como antes).
 */
export function NuevoTratamientoModal({ patientId, onClose }: Props) {
  const router = useRouter();
  const [nombre, setNombre] = useState('');
  const [sesiones, setSesiones] = useState('');
  const [notas, setNotas] = useState('');
  const [guardando, setGuardando] = useState(false);
  const [creado, setCreado] = useState<string | null>(null);
  const [resultados, setResultados] = useState<Resultado[] | null>(null);
  const [corriendo, setCorriendo] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);
  const a = useAgendaDeSesiones(patientId, [], 7);

  const n = sesiones.trim() ? Number(sesiones) : null;
  const sesionesValidas = n === null || (Number.isInteger(n) && n >= 1 && n <= 100);

  // N filas. Lo editado en cada fila se GUARDA aunque N baje un momento (al teclear «15» se pasa por
  // «1», o se borra el campo): al volver a subir, la fila regresa como estaba, no vacía.
  const memoria = useRef(new Map<number, Fila>());
  useEffect(() => { a.filas.forEach((f) => memoria.current.set(f.numero, f)); }, [a.filas]);
  useEffect(() => {
    if (n === null || !sesionesValidas) { a.setFilas([]); return; }
    // Las nuevas toman fecha, hora y servicio de la regla base en el hook (sus efectos siguen el largo).
    a.setFilas(Array.from({ length: n }, (_, i) => memoria.current.get(i + 1) ?? filaNueva(i + 1)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [n, sesionesValidas]);

  const confirmar = async () => {
    if (!nombre.trim()) { toast.error('Escribe el nombre del tratamiento'); return; }
    if (!sesionesValidas) { toast.error('Las sesiones planeadas van de 1 a 100'); return; }
    setGuardando(true);
    try {
      const res = await fetch(`/api/medical-records/patients/${patientId}/tratamientos`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nombre: nombre.trim(),
          ...(n !== null && { sesionesPlaneadas: n, intervaloDias: a.cadaValido ? Number(a.base.cada) : undefined }),
          ...(notas.trim() && { notas: notas.trim() }),
          ...(a.filas.length && {
            sesiones: a.filas.map((f) => ({
              servicioId: f.servicioId || null,
              servicioNombre: f.servicioNombre || null,
              // El precio es dinero: sólo con `flujo` (sin él, la cita toma el del servicio).
              ...(a.conFlujo && f.precio.trim() !== '' ? { precio: Number(f.precio) } : {}),
            })),
          }),
        }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.data?.id) throw new Error(data?.error || 'No se pudo crear el tratamiento');
      const tratamientoId: string = data.data.id;
      setCreado(tratamientoId);

      const idPorNumero = new Map<number, string>((data.data.sesiones ?? []).map((s: { id: string; numero: number }) => [s.numero, s.id]));
      const aAgendar = a.aAgendar.flatMap((f) => {
        const sesionId = idPorNumero.get(f.numero);
        return sesionId ? [{ ...f, sesionId }] : [];
      });
      if (!aAgendar.length) { router.push(tratamientoHref(patientId, tratamientoId)); return; }

      setResultados([]);
      setCorriendo(true);
      const fin = await agendarFilas(a, patientId, aAgendar, setResultados);
      setResultados(fin.resultados);
      setAviso(fin.aviso);
      setCorriendo(false);
    } catch (err: any) {
      toast.error(err.message || 'No se pudo crear el tratamiento');
      setGuardando(false);
    }
  };

  const listo = !guardando && !!nombre.trim() && sesionesValidas && (a.filas.length === 0 || a.listo);
  const inputClass = 'w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent';
  // Mientras se crea (o se agendan sus citas) no se cierra: si no, las citas se crearían sin que nadie
  // vea el resultado.
  const cerrar = () => {
    if (corriendo || guardando && !resultados) return;
    if (creado) router.push(tratamientoHref(patientId, creado));
    else onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-xl shadow-lg max-w-lg w-full max-h-[92vh] flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h2 className="text-lg font-semibold text-gray-900">Nuevo tratamiento</h2>
          <button onClick={cerrar} disabled={corriendo || (guardando && !resultados)} className="p-1 rounded hover:bg-gray-100 text-gray-500" aria-label="Cerrar">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="px-5 py-4 space-y-4 overflow-y-auto">
          {resultados ? (
            <ResultadosDeFilas resultados={resultados} total={a.aAgendar.length} planeadas={n} corriendo={corriendo} aviso={aviso} />
          ) : (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nombre</label>
                <input value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Ej. Fisioterapia de rodilla" maxLength={200} className={inputClass} autoFocus />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Sesiones planeadas (opcional)</label>
                <input type="number" min={1} max={100} value={sesiones} onChange={(e) => setSesiones(e.target.value)} placeholder="Ej. 3" className={inputClass} />
                <p className="text-xs text-gray-500 mt-1">
                  Con un número aparecen sus sesiones para elegir servicio, fecha y hora. Vacío = sin número fijo; agregas sesiones cuando las necesites.
                </p>
              </div>
              {a.filas.length > 0 && <FormularioDeFilas a={a} planeadas={n} />}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Notas (opcional)</label>
                <textarea value={notas} onChange={(e) => setNotas(e.target.value)} rows={2} maxLength={5000} className={inputClass} />
              </div>
            </>
          )}
        </div>

        <div className="flex justify-end gap-2 px-5 py-4 border-t border-gray-100">
          {resultados ? (
            <button onClick={cerrar} disabled={corriendo} className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50">
              {corriendo ? 'Agendando…' : 'Ir al tratamiento'}
            </button>
          ) : (
            <>
              <button onClick={onClose} disabled={guardando} className="px-4 py-2 text-sm border border-gray-200 text-gray-600 rounded-lg hover:bg-gray-50">
                Cancelar
              </button>
              <button
                onClick={confirmar}
                disabled={!listo}
                className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-1.5 font-medium"
              >
                {guardando && <Loader2 className="w-4 h-4 animate-spin" />}
                {guardando ? 'Creando…'
                  : a.aAgendar.length ? `Crear y agendar ${a.aAgendar.length} ${a.aAgendar.length === 1 ? 'cita' : 'citas'}`
                  : 'Crear tratamiento'}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
