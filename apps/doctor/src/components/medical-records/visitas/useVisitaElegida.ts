'use client';

import { useEffect, useRef, useState } from 'react';
import { getClinicDateString } from '@/lib/dates';
import { visitaSugerida } from '@/lib/visitas-ui';
import { useVisitasDelPaciente } from './useVisitasDelPaciente';

/**
 * VISITAS D5 — «¿A qué visita pertenece?» al crear algo FUERA de una visita (Docs y Galería,
 * Recetas, Notas). `activo` = la UI de visitas está encendida para el doctor Y no se llegó desde el
 * «+» de una visita (ahí la visita ya está fija y no se pregunta).
 *
 * La sugerencia (`visitaSugerida`, últimos 7 días) se pone UNA vez, cuando llegan las visitas, y
 * sólo si el doctor no eligió ya algo: la carga tarda y no puede pisar lo que escogió a mano.
 *
 * (Ya no devuelve `consultas`: recetas y archivos ya no se ligan a una consulta — N7/N9, 2026-10-12.)
 */
export function useVisitaElegida(patientId: string, activo: boolean) {
  const lista = useVisitasDelPaciente(patientId, activo);
  const [elegida, setElegida] = useState('');
  const tocada = useRef(false);
  const sugirio = useRef(false);

  useEffect(() => {
    if (!activo || lista.estado !== 'ok' || sugirio.current) return;
    sugirio.current = true;
    if (!tocada.current) setElegida(visitaSugerida(lista.visitas, getClinicDateString()));
  }, [activo, lista.estado, lista.visitas]);

  const elegir = (id: string) => {
    tocada.current = true;
    setElegida(id);
  };


  return { estado: lista.estado, visitas: lista.visitas, elegida, elegir };
}
