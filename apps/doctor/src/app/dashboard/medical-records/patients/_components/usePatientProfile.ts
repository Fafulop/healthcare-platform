'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { redirect } from 'next/navigation';
import { calculateAge, formatDateLong } from '@/lib/practice-utils';
import { practiceConfirm } from '@/lib/practice-confirm';
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

  const handleArchive = async () => {
    const confirmed = await practiceConfirm(
      '¿Está seguro de archivar este paciente? El expediente se conservará pero el paciente quedará inactivo.'
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

  return {
    // Route
    patientId,
    sessionStatus: status,
    // Data
    patient,
    // Loading / error
    loading,
    error,
    isArchiving,
    // Helpers
    calculateAge,
    formatDate: formatDateLong,
    // Actions
    handleArchive,
  };
}
