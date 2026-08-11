'use client';

/**
 * INFORME MÉDICO a nivel PACIENTE (07-PLAN).
 *
 * El informe se crea desde el paciente y no desde una consulta suelta: se elige
 * la consulta ANCLA —la que da el pre-llenado 🟩 verde— y además las FUENTES del
 * expediente (otras consultas, notas, recetas) que el asistente va a leer.
 */

import { useParams } from 'next/navigation';
import PantallaInforme from '@/components/informe-medico/PantallaInforme';

export default function InformeDelPacientePage() {
  const params = useParams<{ id: string }>();

  return (
    <PantallaInforme
      patientId={params.id}
      volverHref={`/dashboard/medical-records/patients/${params.id}`}
      volverTexto="Volver al expediente"
    />
  );
}
