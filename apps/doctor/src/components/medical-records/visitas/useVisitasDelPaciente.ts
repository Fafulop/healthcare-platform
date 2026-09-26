'use client';

import { useCallback, useEffect, useState } from 'react';
import type { Encounter } from '@/components/medical-records/EncounterCard';
import type { VisitaResumen } from '@/lib/visitas-ui';

/** TRES estados: si la carga falla, una lista vacía NO puede decir "no hay visitas". */
export type EstadoCarga = 'cargando' | 'error' | 'ok';

/**
 * Las visitas del paciente y sus consultas «Sin visita».
 *
 * ⚠️ Las sueltas salen de `GET …/encounters` (TODAS), no de `patient.encounters`: la ruta del
 * paciente trae sólo las últimas 5, y con eso las más viejas desaparecerían sin decir nada.
 */
export function useVisitasDelPaciente(patientId: string, enabled: boolean) {
  const [estado, setEstado] = useState<EstadoCarga>('cargando');
  const [visitas, setVisitas] = useState<VisitaResumen[]>([]);
  const [sueltas, setSueltas] = useState<Encounter[]>([]);

  const cargar = useCallback(async () => {
    if (!enabled || !patientId) return;
    setEstado('cargando');
    try {
      const [rv, re] = await Promise.all([
        fetch(`/api/medical-records/patients/${patientId}/visitas`),
        fetch(`/api/medical-records/patients/${patientId}/encounters`),
      ]);
      const [dv, de] = await Promise.all([rv.json(), re.json()]);
      if (!rv.ok || !Array.isArray(dv?.data) || !re.ok || !Array.isArray(de?.data)) throw new Error();
      setVisitas(dv.data);
      setSueltas((de.data as (Encounter & { visitaId?: string | null })[]).filter((e) => !e.visitaId));
      setEstado('ok');
    } catch {
      setEstado('error');
    }
  }, [patientId, enabled]);

  useEffect(() => { cargar(); }, [cargar]);

  return { estado, visitas, sueltas, recargar: cargar };
}
