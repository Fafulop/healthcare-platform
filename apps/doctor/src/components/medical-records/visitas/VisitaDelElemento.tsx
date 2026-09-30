'use client';

import Link from 'next/link';
import { formatoFechaVisita, visitaHref, type VisitaResumen } from '@/lib/visitas-ui';
import type { EstadoCarga } from './useVisitasDelPaciente';

interface Props {
  patientId: string;
  visitaId: string | null | undefined;
  visitas: VisitaResumen[];
  estado: EstadoCarga;
}

/**
 * VISITAS D5b — a qué visita pertenece una foto, receta o nota, en modo lectura: «Visita del 12 sep»
 * (link a la visita) o «Sin visita». Si las visitas no cargaron NO dice «Sin visita» (sería afirmar
 * algo falso de un elemento que sí tiene visita): dice que no se sabe.
 */
export function VisitaDelElemento({ patientId, visitaId, visitas, estado }: Props) {
  if (!visitaId) return <span className="text-sm text-gray-500">Sin visita</span>;
  const v = visitas.find((x) => x.id === visitaId);
  if (!v) {
    return (
      <span className="text-sm text-gray-400">
        {estado === 'cargando' ? 'Cargando…' : 'En una visita (no se pudo cargar cuál)'}
      </span>
    );
  }
  return (
    <Link href={visitaHref(patientId, v.id)} className="text-sm text-blue-600 hover:text-blue-800 underline">
      Visita del {formatoFechaVisita(v.fecha)}
    </Link>
  );
}
