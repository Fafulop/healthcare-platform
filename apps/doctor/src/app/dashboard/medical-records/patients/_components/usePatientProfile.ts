'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { redirect } from 'next/navigation';
import { calculateAge, formatDateLong } from '@/lib/practice-utils';
import { practiceConfirm } from '@/lib/practice-confirm';
import { toast } from '@/lib/practice-toast';
import { mensajeSinCupo } from '@/lib/mensaje-cupo';
import type { Patient } from './patient-types';

export function usePatientProfile() {
  const params = useParams();
  const router = useRouter();
  const patientId = params.id as string;

  const { data: session, status } = useSession({
    required: true,
    onUnauthenticated() {
      redirect('/login');
    },
  });

  const [patient, setPatient] = useState<Patient | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [isArchiving, setIsArchiving] = useState(false);
  const [isReactivating, setIsReactivating] = useState(false);
  // Why the last «Reactivar» failed — stays on screen (a 4.5 s toast is too short for the plan message).
  const [avisoReactivar, setAvisoReactivar] = useState<string | null>(null);

  useEffect(() => {
    fetchPatient();
  }, [patientId]);

  const fetchPatient = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`/api/medical-records/patients/${patientId}`);

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || 'Error al cargar paciente');
      }

      const data = await res.json();

      if (!data?.data) {
        throw new Error('Invalid response format');
      }

      setPatient(data.data);
    } catch (err: any) {
      setError(err.message || 'Error loading patient');
    } finally {
      setLoading(false);
    }
  };

  const handleArchive = async (citasProximas: number | null = null) => {
    const confirmed = await practiceConfirm(
      '¿Está seguro de archivar este paciente? El expediente se conservará pero el paciente quedará inactivo.' +
        (citasProximas
          ? ` Tiene ${citasProximas} cita${citasProximas === 1 ? '' : 's'} próxima${citasProximas === 1 ? '' : 's'}; ` +
            `no se cancela${citasProximas === 1 ? '' : 'n'} sola${citasProximas === 1 ? '' : 's'}: cancélala${citasProximas === 1 ? '' : 's'} en «Mis Citas» si ya no va a venir.`
          : '')
    );
    if (!confirmed) return;

    setIsArchiving(true);
    try {
      const res = await fetch(`/api/medical-records/patients/${patientId}`, { method: 'DELETE' });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Error al archivar paciente');
      }
      router.push('/dashboard/medical-records');
    } catch (err: any) {
      setError(err.message);
      setIsArchiving(false);
    }
  };

  // H-041: un expediente archivado (o inactivo) vuelve a «activo». El servidor cuenta ese REGRESO contra
  // el cupo del plan (TIERS Q3, `assertPatientQuota` en el PUT); sin lugar, el mismo mensaje que
  // «Nuevo paciente» — en un aviso que se queda en la pantalla, no en lugar del perfil.
  const handleReactivate = async () => {
    const confirmed = await practiceConfirm(
      'Vuelve a tu lista de pacientes activos y cuenta para el cupo de tu plan.',
      '¿Reactivar este paciente?'
    );
    if (!confirmed) return;

    setIsReactivating(true);
    setAvisoReactivar(null);
    try {
      const res = await fetch(`/api/medical-records/patients/${patientId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'active' }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setAvisoReactivar(data.error === 'QUOTA_EXCEEDED' ? mensajeSinCupo(data) : (data.error || 'No se pudo reactivar al paciente.'));
        return;
      }
      toast.success('Paciente reactivado');
      await fetchPatient();
    } catch {
      setAvisoReactivar('No se pudo reactivar al paciente. Revisa tu conexión e inténtalo de nuevo.');
    } finally {
      setIsReactivating(false);
    }
  };

  return {
    // Route
    patientId,
    sessionStatus: status,
    doctorId: session?.user?.doctorId ?? null,
    // Data
    patient,
    // Loading / error
    loading,
    error,
    isArchiving,
    isReactivating,
    avisoReactivar,
    // Helpers
    calculateAge,
    formatDate: formatDateLong,
    // Actions
    handleArchive,
    handleReactivate,
    refreshPatient: fetchPatient,
  };
}
