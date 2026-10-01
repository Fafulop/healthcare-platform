'use client';

import { useCallback, useEffect, useState } from 'react';
import type { EstadoCarga } from '@/components/medical-records/visitas/useVisitasDelPaciente';
import type { TratamientoResumen } from '@/lib/tratamientos-ui';

/**
 * Los tratamientos del paciente (activos primero). TRES estados como en visitas: si la carga
 * falla, una lista vacía NO puede decir "no hay".
 */
export function useTratamientosDelPaciente(patientId: string, enabled: boolean) {
  const [estado, setEstado] = useState<EstadoCarga>('cargando');
  const [tratamientos, setTratamientos] = useState<TratamientoResumen[]>([]);

  const cargar = useCallback(async () => {
    if (!enabled || !patientId) return;
    setEstado('cargando');
    try {
      const res = await fetch(`/api/medical-records/patients/${patientId}/tratamientos`);
      const d = await res.json().catch(() => null);
      if (!res.ok || !Array.isArray(d?.data)) throw new Error();
      setTratamientos(d.data);
      setEstado('ok');
    } catch {
      setEstado('error');
    }
  }, [patientId, enabled]);

  useEffect(() => { cargar(); }, [cargar]);

  return { estado, tratamientos, recargar: cargar };
}
