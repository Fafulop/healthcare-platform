'use client';

import { useMemo } from 'react';
import Link from 'next/link';
import { ArrowLeft, ChevronRight, FileText, ListChecks, Loader2, Plus } from 'lucide-react';
import { usePatientProfile } from '../../_components/usePatientProfile';
import { useVisitasDelPaciente } from '@/components/medical-records/visitas/useVisitasDelPaciente';
import { STATUS_COLORS, STATUS_LABELS } from '@/components/medical-records/EncounterCard';
import { tituloDePlantilla } from '@/lib/titulo-plantilla';
import { formatoFechaVisita, visitaHref } from '@/lib/visitas-ui';
import { etiquetaSesion, tratamientoHref } from '@/lib/tratamientos-ui';
import { useAlVolverALaPestana } from '@/lib/use-al-volver-a-la-pestana';

/**
 * 2026-10-12 (pedido del usuario) — «Plantillas» del expediente: TODAS las plantillas llenadas del paciente
 * en una lista (un libro, sólo de referencia), con dónde vive cada una: su visita, la sesión de un
 * tratamiento, o «Sin visita». Desde aquí también se crea una plantilla SIN visita (huérfana): es el único
 * lugar que lo permite (`encounters/new?sinVisita=1`); dentro de una visita se sigue creando en la visita.
 * No se edita nada aquí: cada renglón abre su plantilla.
 */
export default function PlantillasPage() {
  const { patientId, patient, loading, error, sessionStatus } = usePatientProfile();
  const pacienteHref = `/dashboard/medical-records/patients/${patientId}`;
  const lista = useVisitasDelPaciente(patientId, !!patientId);
  useAlVolverALaPestana(() => { lista.recargar(); });

  const visitaPorId = useMemo(() => new Map(lista.visitas.map((v) => [v.id, v])), [lista.visitas]);
  // Más reciente primero (la API ya las trae por fecha; se ordena aquí por si acaso).
  const plantillas = useMemo(
    () => [...lista.consultas].sort((a, b) => b.encounterDate.localeCompare(a.encounterDate)),
    [lista.consultas],
  );

  if (sessionStatus === 'loading' || loading) {
    return <div className="min-h-screen flex items-center justify-center bg-gray-50"><Loader2 className="h-10 w-10 animate-spin text-blue-600" /></div>;
  }
  if (error || !patient) {
    return (
      <div className="p-4 sm:p-6 max-w-3xl mx-auto">
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
          <p className="text-amber-900">No se pudo cargar el paciente. Recarga la página para intentar de nuevo.</p>
          <Link href={pacienteHref} className="text-amber-800 underline mt-2 inline-block">Volver al paciente</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 max-w-4xl mx-auto space-y-4">
      <Link href={pacienteHref} className="inline-flex items-center gap-2 text-gray-600 hover:text-gray-900">
        <ArrowLeft className="w-4 h-4" /> Volver al Paciente
      </Link>
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2"><FileText className="w-6 h-6 text-blue-600" />Plantillas</h1>
          <p className="text-gray-600 mt-1">{`${patient.firstName} ${patient.lastName ?? ''}`.trim()}</p>
        </div>
        <Link
          href={`${pacienteHref}/encounters/new?sinVisita=1`}
          className="px-3 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 flex items-center gap-1.5 text-sm"
        >
          <Plus className="w-4 h-4" /> Nueva plantilla sin visita
        </Link>
      </div>

      <div className="bg-white rounded-lg shadow">
        {lista.estado === 'cargando' ? (
          <p className="text-sm text-gray-400 text-center py-8">Cargando plantillas…</p>
        ) : lista.estado === 'error' ? (
          <p className="text-sm text-amber-700 text-center py-8">No se pudieron cargar las plantillas. Recarga la página para intentar de nuevo.</p>
        ) : plantillas.length === 0 ? (
          <p className="text-sm text-gray-500 text-center py-8">Este paciente todavía no tiene plantillas.</p>
        ) : (
          <ul className="divide-y divide-gray-100">
            {plantillas.map((c) => {
              const v = c.visitaId ? visitaPorId.get(c.visitaId) : undefined;
              return (
                <li key={c.id} className="flex items-center justify-between gap-3 p-4 hover:bg-gray-50">
                  <Link href={`${pacienteHref}/encounters/${c.id}?desde=plantillas`} className="min-w-0 flex-1">
                    <p className="font-medium text-gray-900 flex items-center gap-2 flex-wrap">
                      <span>{tituloDePlantilla(c)}</span>
                      {c.status && (
                        <span className={`text-xs font-normal px-1.5 py-0.5 rounded ${STATUS_COLORS[c.status] ?? 'bg-gray-100 text-gray-700'}`}>
                          {STATUS_LABELS[c.status] ?? c.status}
                        </span>
                      )}
                    </p>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {formatoFechaVisita(c.encounterDate, { day: 'numeric', month: 'long', year: 'numeric' })}
                    </p>
                  </Link>
                  {/* Dónde vive (un enlace aparte: la fila entera abre la plantilla). */}
                  <div className="text-xs shrink-0 text-right">
                    {!c.visitaId ? (
                      <span className="px-2 py-0.5 rounded bg-gray-100 text-gray-600">Sin visita</span>
                    ) : v?.sesion ? (
                      <Link href={tratamientoHref(patientId, v.sesion.tratamientoId)} className="text-teal-700 hover:underline inline-flex items-center gap-1">
                        <ListChecks className="w-3.5 h-3.5" />
                        {etiquetaSesion(v.sesion.numero, v.sesion.sesionesPlaneadas)} — {v.sesion.nombre}{v.sesion.cancelada ? ' (cancelada)' : ''}
                      </Link>
                    ) : v ? (
                      <Link href={visitaHref(patientId, v.id)} className="text-blue-600 hover:underline">
                        Visita del {formatoFechaVisita(v.fecha)}
                      </Link>
                    ) : (
                      <span className="text-gray-500">En una visita</span>
                    )}
                  </div>
                  <ChevronRight className="w-4 h-4 text-gray-300 shrink-0" />
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
