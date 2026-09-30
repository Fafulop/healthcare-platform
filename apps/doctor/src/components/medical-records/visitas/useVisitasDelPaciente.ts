'use client';

import { useCallback, useEffect, useState } from 'react';
import type { Encounter } from '@/components/medical-records/EncounterCard';
import type { VisitaResumen } from '@/lib/visitas-ui';

export type ConsultaConVisita = Encounter & { visitaId?: string | null };

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
  // TODAS las consultas con su `visitaId`: D5 ofrece sólo las de la visita elegida.
  const [consultas, setConsultas] = useState<ConsultaConVisita[]>([]);

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
      setConsultas(de.data);
      setSueltas((de.data as ConsultaConVisita[]).filter((e) => !e.visitaId));
      setEstado('ok');
    } catch {
      setEstado('error');
    }
  }, [patientId, enabled]);

  useEffect(() => { cargar(); }, [cargar]);

  return { estado, visitas, sueltas, consultas, recargar: cargar };
}
