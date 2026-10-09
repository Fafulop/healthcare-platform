'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { CalendarPlus, Loader2, X } from 'lucide-react';
import { toast } from '@/lib/practice-toast';
import { tratamientoHref, type SesionDeLaVisita, type TratamientoDetalle } from '@/lib/tratamientos-ui';
import { AgendarSesionesModal } from './AgendarSesionesModal';
import {
  FormularioDeFilas, ResultadosDeFilas, agendarFilas, useAgendaDeSesiones, type Fila, type Resultado,
} from './FilasDeSesiones';

/**
 * VISITAS 07-PLAN P3a — «Agendar seguimiento» en la página de la visita: el seguimiento CREA su cita.
 *   · La visita ya es de un tratamiento activo → «Agregar sesión» de ese tratamiento, tal cual
 *     (`AgendarSesionesModal` modo `nueva`).
 *   · Visita suelta → `SeguimientoNuevo`: al confirmar nace «Seguimiento del <día>» (sesión 1 = esta
 *     visita, sesión 2 = el seguimiento) y se agenda la cita de la 2. Antes de confirmar no se crea nada.
 * Necesita permiso de `citas` (lo decide quien lo pinta).
 */
export function AgendarSeguimiento({ patientId, visitaId, sesion }: {
  patientId: string;
  visitaId: string;
  sesion: SesionDeLaVisita | null;
}) {
  const [cargando, setCargando] = useState(false);
  const [tratamiento, setTratamiento] = useState<TratamientoDetalle | null>(null);
  const [nuevo, setNuevo] = useState(false);

  const abrir = async () => {
    if (!sesion) { setNuevo(true); return; }
    setCargando(true);
    try {
      const res = await fetch(`/api/medical-records/patients/${patientId}/tratamientos/${sesion.tratamientoId}`);
      const d = await res.json().catch(() => null);
      if (!res.ok || !d?.data) throw new Error(d?.error);
      const t = d.data as TratamientoDetalle;
      if (t.estado !== 'activo') {
        toast.error(`«${t.nombre}» ya terminó o se canceló: reactívalo para agendar su seguimiento.`);
        return;
      }
      setTratamiento(t);
    } catch {
      toast.error('No se pudo cargar el tratamiento de esta visita. Intenta de nuevo.');
    } finally {
      setCargando(false);
    }
  };

  return (
    <>
      <button
        onClick={abrir} disabled={cargando}
        className="px-3 py-2 border border-blue-200 text-blue-700 rounded-md hover:bg-blue-50 disabled:opacity-50 flex items-center gap-1.5 text-sm self-start"
      >
        {cargando ? <Loader2 className="w-4 h-4 animate-spin" /> : <CalendarPlus className="w-4 h-4" />}
        Agendar seguimiento
      </button>
      {tratamiento && (
        <AgendarSesionesModal
          patientId={patientId} tratamiento={tratamiento} modo={{ tipo: 'nueva' }} puedeAgendar
          onListo={() => {}} onClose={() => setTratamiento(null)}
        />
      )}
      {nuevo && <SeguimientoNuevo patientId={patientId} visitaId={visitaId} onClose={() => setNuevo(false)} />}
    </>
  );
}

const FILA_SEGUIMIENTO: Fila = {
  key: 'seguimiento', numero: 2, servicioId: '', servicioNombre: '', precio: '', fecha: '', hora: '', despues: false, tocada: false,
};

/** Visita suelta: una fila (servicio · precio · fecha · hora · «libre») y, al confirmar, tratamiento + cita. */
function SeguimientoNuevo({ patientId, visitaId, onClose }: { patientId: string; visitaId: string; onClose: () => void }) {
  const router = useRouter();
  const a = useAgendaDeSesiones(patientId, [FILA_SEGUIMIENTO], null);
  const [guardando, setGuardando] = useState(false);
  const [creado, setCreado] = useState<string | null>(null);
  const [resultados, setResultados] = useState<Resultado[] | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [corriendo, setCorriendo] = useState(false);

  const confirmar = async () => {
    const f = a.filas[0];
    if (!f || !a.listo) return;
    setGuardando(true);
    try {
      const res = await fetch(`/api/medical-records/patients/${patientId}/tratamientos`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          desdeVisita: visitaId,
          sesion: {
            servicioId: f.servicioId || null,
            servicioNombre: f.servicioNombre || null,
            // El precio es dinero: sólo con `flujo` (sin él, la cita toma el del servicio).
            ...(a.conFlujo && f.precio.trim() !== '' ? { precio: Number(f.precio) } : {}),
          },
        }),
      });
      const data = await res.json().catch(() => null);
      const sesion2 = (data?.data?.sesiones ?? []).find((s: { numero: number }) => s.numero === 2) as { id: string } | undefined;
      if (!res.ok || !data?.data?.id || !sesion2) throw new Error(data?.error || 'No se pudo crear el seguimiento');
      setCreado(data.data.id);
      // La sesión ya existe: si la cita falla, queda «Sin fecha» con su «Agendar» (como «Nuevo tratamiento»).
      setResultados([]);
      setCorriendo(true);
      const fin = await agendarFilas(a, patientId, [{ ...f, sesionId: sesion2.id }], setResultados);
      setResultados(fin.resultados);
      setAviso(fin.aviso);
      setCorriendo(false);
    } catch (err: any) {
      toast.error(err.message || 'No se pudo crear el seguimiento');
      setGuardando(false);
    }
  };

  const cerrar = () => {
    if (corriendo || (guardando && !resultados)) return;
    if (creado) router.push(tratamientoHref(patientId, creado));
    else onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-xl shadow-lg max-w-lg w-full max-h-[92vh] flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h2 className="text-lg font-semibold text-gray-900">Agendar seguimiento</h2>
          <button onClick={cerrar} disabled={corriendo || (guardando && !resultados)} className="p-1 rounded hover:bg-gray-100 text-gray-500" aria-label="Cerrar">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="px-5 py-4 space-y-4 overflow-y-auto">
          {resultados ? (
            <ResultadosDeFilas resultados={resultados} total={1} planeadas={null} corriendo={corriendo} aviso={aviso} />
          ) : (
            <>
              <p className="text-sm text-gray-600">
                Se crea un tratamiento «Seguimiento del …» con esta visita como sesión 1 y la cita del seguimiento como
                sesión 2 (le cambias el nombre en «Editar»).
              </p>
              <FormularioDeFilas a={a} planeadas={null} conDespues={false} />
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
                onClick={confirmar} disabled={guardando || !a.listo}
                className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-1.5 font-medium"
              >
                {guardando && <Loader2 className="w-4 h-4 animate-spin" />}
                {guardando ? 'Agendando…' : 'Agendar seguimiento'}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
