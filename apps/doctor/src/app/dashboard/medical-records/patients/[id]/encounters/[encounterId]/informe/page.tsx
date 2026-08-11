'use client';

/**
 * INFORME MÉDICO desde una CONSULTA — el atajo.
 *
 * Es la MISMA pantalla que la de nivel paciente: la única diferencia es que la
 * consulta desde la que se entró es el ANCLA y no se pregunta cuál (07-PLAN §7).
 */

import { useParams } from 'next/navigation';
import PantallaInforme from '@/components/informe-medico/PantallaInforme';

export default function InformeDesdeConsultaPage() {
  const params = useParams<{ id: string; encounterId: string }>();

  return (
    <PantallaInforme
      patientId={params.id}
      anclaFija={params.encounterId}
      volverHref={`/dashboard/medical-records/patients/${params.id}/encounters/${params.encounterId}`}
      volverTexto="Volver a la consulta"
    />
  );
}
