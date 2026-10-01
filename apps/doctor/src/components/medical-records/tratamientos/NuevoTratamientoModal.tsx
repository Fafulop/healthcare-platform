'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, X } from 'lucide-react';
import { toast } from '@/lib/practice-toast';
import { tratamientoHref } from '@/lib/tratamientos-ui';

interface Props {
  patientId: string;
  onClose: () => void;
}

/**
 * TRATAMIENTOS T3 — «Nuevo tratamiento». Con «Sesiones planeadas» el servidor crea esas sesiones
 * «por agendar» en la misma transacción. Sin precio (T6), intervalo (T5) ni plantilla sugerida
 * (T4: lo único que hace es pre-elegirse en «Agregar plantilla», y eso no está construido): un
 * campo que no hace nada promete algo falso.
 */
export function NuevoTratamientoModal({ patientId, onClose }: Props) {
  const router = useRouter();
  const [nombre, setNombre] = useState('');
  const [sesiones, setSesiones] = useState('');
  const [notas, setNotas] = useState('');
  const [guardando, setGuardando] = useState(false);

  const n = sesiones.trim() ? Number(sesiones) : null;
  const sesionesValidas = n === null || (Number.isInteger(n) && n >= 1 && n <= 100);

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
          ...(n !== null && { sesionesPlaneadas: n }),
          ...(notas.trim() && { notas: notas.trim() }),
        }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.data?.id) throw new Error(data?.error || 'No se pudo crear el tratamiento');
      router.push(tratamientoHref(patientId, data.data.id));
    } catch (err: any) {
      toast.error(err.message || 'No se pudo crear el tratamiento');
      setGuardando(false);
    }
  };

  const inputClass = 'w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent';

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-xl shadow-lg max-w-md w-full">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h2 className="text-lg font-semibold text-gray-900">Nuevo tratamiento</h2>
          <button onClick={onClose} className="p-1 rounded hover:bg-gray-100 text-gray-500" aria-label="Cerrar">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="px-5 py-4 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Nombre</label>
            <input
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              placeholder="Ej. Fisioterapia de rodilla"
              maxLength={200}
              className={inputClass}
              autoFocus
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Sesiones planeadas (opcional)</label>
            <input
              type="number" min={1} max={100}
              value={sesiones}
              onChange={(e) => setSesiones(e.target.value)}
              placeholder="Ej. 6"
              className={inputClass}
            />
            <p className="text-xs text-gray-500 mt-1">
              Se crean esas sesiones «por agendar». Vacío = sin número fijo; agregas sesiones cuando las necesites.
            </p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Notas (opcional)</label>
            <textarea value={notas} onChange={(e) => setNotas(e.target.value)} rows={3} maxLength={5000} className={inputClass} />
          </div>
        </div>

        <div className="flex justify-end gap-2 px-5 py-4 border-t border-gray-100">
          <button
            onClick={onClose}
            disabled={guardando}
            className="px-4 py-2 text-sm border border-gray-200 text-gray-600 rounded-lg hover:bg-gray-50"
          >
            Cancelar
          </button>
          <button
            onClick={confirmar}
            disabled={guardando || !nombre.trim()}
            className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-1.5 font-medium"
          >
            {guardando && <Loader2 className="w-4 h-4 animate-spin" />}
            {guardando ? 'Creando…' : 'Crear tratamiento'}
          </button>
        </div>
      </div>
    </div>
  );
}
