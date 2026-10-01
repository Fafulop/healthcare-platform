'use client';

import Link from 'next/link';
import { AlertCircle, ChevronRight, ListChecks, Plus } from 'lucide-react';
import { ListaColapsable } from '@/components/medical-records/ListaColapsable';
import type { EstadoCarga } from '@/components/medical-records/visitas/useVisitasDelPaciente';
import {
  ESTADO_TRATAMIENTO, describirAvance, tratamientoHref, type TratamientoResumen,
} from '@/lib/tratamientos-ui';

interface Props {
  patientId: string;
  estado: EstadoCarga;
  tratamientos: TratamientoResumen[];
  onNuevo: () => void;
}

/** TRATAMIENTOS T3 — tarjeta del perfil del paciente, debajo de «Visitas». */
export function TratamientosCard({ patientId, estado, tratamientos, onNuevo }: Props) {
  return (
    <div className="bg-white rounded-lg shadow p-6">
      <div className="flex items-center justify-between gap-2 mb-4">
        <h2 className="text-xl font-semibold text-gray-900 flex items-center gap-2">
          <ListChecks className="w-5 h-5" />
          Tratamientos
        </h2>
        {/* Mismo botón arriba a la derecha que Visitas, Formularios y Notas (también sin tratamientos). */}
        {estado === 'ok' && (
          <button
            onClick={onNuevo}
            className="text-sm text-blue-600 hover:text-blue-800 flex items-center gap-1 px-2 py-1 rounded hover:bg-blue-50"
          >
            <Plus className="w-4 h-4" />Nuevo tratamiento
          </button>
        )}
      </div>

      {estado === 'cargando' ? (
        <p className="text-sm text-gray-400 text-center py-6">Cargando tratamientos…</p>
      ) : estado === 'error' ? (
        <div className="text-center py-6 text-gray-500">
          <AlertCircle className="w-8 h-8 text-amber-400 mx-auto mb-2" />
          <p className="text-sm">No se pudieron cargar los tratamientos. Recarga la página para intentar de nuevo.</p>
        </div>
      ) : tratamientos.length > 0 ? (
        <ListaColapsable className="space-y-2">
          {tratamientos.map((t) => {
            const chip = ESTADO_TRATAMIENTO[t.estado] ?? ESTADO_TRATAMIENTO.activo;
            return (
              <Link
                key={t.id}
                href={tratamientoHref(patientId, t.id)}
                className="flex items-center justify-between gap-3 p-4 border border-gray-200 rounded-lg transition-all hover:border-blue-300 hover:shadow-sm"
              >
                <div className="min-w-0">
                  <p className="font-medium text-gray-900 flex items-center gap-2 flex-wrap">
                    <span className="truncate">{t.nombre}</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-normal ${chip.clase}`}>{chip.texto}</span>
                  </p>
                  <p className="text-sm text-gray-600 mt-1">
                    {t.conteo && t.conteo.total > 0 ? describirAvance(t) : 'Sin sesiones'}
                  </p>
                </div>
                <ChevronRight className="w-5 h-5 text-gray-300 shrink-0" />
              </Link>
            );
          })}
        </ListaColapsable>
      ) : (
        <div className="text-center py-6 text-gray-500">
          <ListChecks className="w-10 h-10 text-gray-300 mx-auto mb-2" />
          <p className="text-sm">No hay tratamientos</p>
          <button onClick={onNuevo} className="text-blue-600 hover:text-blue-800 text-sm mt-2">
            Crear un tratamiento
          </button>
        </div>
      )}
    </div>
  );
}
