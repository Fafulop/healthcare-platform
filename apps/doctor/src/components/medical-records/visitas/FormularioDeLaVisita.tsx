'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { CheckCircle, ClipboardList, Clock } from 'lucide-react';
import { useAlVolverALaPestana } from '@/lib/use-al-volver-a-la-pestana';

// `createdAt` / `submittedAt` son TIMESTAMPS, no fechas @db.Date: se leen en la zona de la clínica
// (cortar el ISO en UTC pintaba el día siguiente a partir de las 18:00).
const fechaDeMomento = (iso: string) =>
  new Date(iso).toLocaleDateString('es-MX', { timeZone: 'America/Mexico_City', day: 'numeric', month: 'short', year: 'numeric' });

interface FormularioDeCita {
  id: string;
  status: 'PENDING' | 'SUBMITTED';
  templateName: string | null;
  createdAt: string;
  submittedAt: string | null;
}

/**
 * N12 (2026-10-12) — el formulario pre-consulta que se le mandó al paciente desde la cita, en la VISITA
 * de esa cita (visita y cita son el mismo evento): «Esperando respuesta» o «Recibido» con su enlace.
 * Se lee por la cita (sin columna nueva); al reagendar viaja con ella y con la visita. Sólo aparece si
 * la cita tiene uno — se crea desde la tarjeta de la cita (DOCUMENTOS). `version` lo vuelve a leer
 * después de una acción de la tarjeta (crear / quitar el formulario).
 */
export function FormularioDeLaVisita({ patientId, bookingId, version }: { patientId: string; bookingId: string; version: number }) {
  const [form, setForm] = useState<FormularioDeCita | null | 'error'>(null);
  // Sólo cuenta la ÚLTIMA lectura: dos que se cruzan (acción de la tarjeta + regresar a la pestaña) no
  // pueden pintar lo viejo encima de lo nuevo.
  const ultima = useRef(0);

  const cargar = useCallback(async (silencioso = false) => {
    const yo = ++ultima.current;
    try {
      const d = await fetch(`/api/medical-records/patients/${patientId}/formularios?bookingId=${encodeURIComponent(bookingId)}`)
        .then((r) => r.json());
      if (yo !== ultima.current) return;
      if (!d?.success) throw new Error();
      setForm(d.data ?? null);
    } catch {
      if (!silencioso && yo === ultima.current) setForm('error');
    }
  }, [patientId, bookingId]);

  useEffect(() => { cargar(); }, [cargar, version]);
  useAlVolverALaPestana(() => cargar(true));

  if (form === 'error') {
    return (
      <div className="bg-white rounded-lg shadow p-5">
        <p className="text-sm text-gray-500">No se pudo revisar si su cita tiene formulario pre-consulta. Recarga la página.</p>
      </div>
    );
  }
  if (!form) return null;

  const recibido = form.status === 'SUBMITTED';
  return (
    <div className="bg-white rounded-lg shadow p-5">
      <h2 className="text-base font-semibold text-gray-900 flex items-center gap-2 mb-3">
        <ClipboardList className="w-5 h-5 text-purple-600" />Formulario pre-consulta
      </h2>
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="min-w-0">
          <p className="text-sm text-gray-900">{form.templateName ?? 'Formulario'}</p>
          <p className="text-xs text-gray-500 mt-0.5 flex items-center gap-1">
            {recibido ? (
              <><CheckCircle className="w-3.5 h-3.5 text-green-600" /> Recibido{form.submittedAt ? ` el ${fechaDeMomento(form.submittedAt)}` : ''}</>
            ) : (
              <><Clock className="w-3.5 h-3.5 text-amber-600" /> Esperando respuesta del paciente (enviado el {fechaDeMomento(form.createdAt)})</>
            )}
          </p>
        </div>
        {recibido && (
          <Link
            href={`/dashboard/medical-records/formularios/${form.id}`}
            className="text-sm text-blue-600 hover:text-blue-800 px-2 py-1 rounded hover:bg-blue-50"
          >
            Ver respuestas
          </Link>
        )}
      </div>
    </div>
  );
}
