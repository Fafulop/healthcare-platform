'use client';

import { AlertCircle, FileText } from 'lucide-react';
import { EncounterCard, type Encounter } from '@/components/medical-records/EncounterCard';
import { ListaColapsable } from '@/components/medical-records/ListaColapsable';
import type { EstadoCarga } from './useVisitasDelPaciente';

interface Props {
  patientId: string;
  estado: EstadoCarga;
  /** Consultas «Sin visita» — nada se esconde (DISEÑO §7). */
  sueltas: Encounter[];
}

/**
 * VISITAS — las consultas registradas fuera de una visita, en su PROPIA tarjeta (antes iban dentro
 * de «Visitas», debajo de las visitas). Sin ninguna, no se pinta. Si la carga falló se DICE: sus
 * datos salen de la misma petición que las visitas, y sin ella no se sabe si hay sueltas.
 */
export function ConsultasSinVisitaCard({ patientId, estado, sueltas }: Props) {
  if (estado === 'cargando' || (estado === 'ok' && sueltas.length === 0)) return null;

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h2 className="text-xl font-semibold text-gray-900 flex items-center gap-2 mb-1">
        <FileText className="w-5 h-5" />
        Consultas sin visita
      </h2>
      {estado === 'error' ? (
        <div className="text-center py-6 text-gray-500">
          <AlertCircle className="w-8 h-8 text-amber-400 mx-auto mb-2" />
          <p className="text-sm">No se pudieron cargar las consultas. Recarga la página para intentar de nuevo.</p>
        </div>
      ) : (
        <>
          <p className="text-xs text-gray-500 mb-4">
            Registradas fuera de una visita. Si hay una visita del mismo día, desde ella puedes traerlas.
          </p>
          <ListaColapsable className="space-y-3">
            {sueltas.map((e) => <EncounterCard key={e.id} encounter={e} patientId={patientId} />)}
          </ListaColapsable>
        </>
      )}
    </div>
  );
}
