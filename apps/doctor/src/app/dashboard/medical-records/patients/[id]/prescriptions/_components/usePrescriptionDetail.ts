'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { redirect } from 'next/navigation';
import { practiceConfirm } from '@/lib/practice-confirm';
import type { PrescriptionDetails } from './prescription-types';

export function usePrescriptionDetail() {
  const params = useParams();
  const router = useRouter();
  const patientId = params.id as string;
  const prescriptionId = params.prescriptionId as string;

  const { status } = useSession({
    required: true,
    onUnauthenticated() {
      redirect('/login');
    },
  });

  const [prescription, setPrescription] = useState<PrescriptionDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState('');
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [cancellationReason, setCancellationReason] = useState('');

  useEffect(() => {
    fetchPrescription();
  }, [patientId, prescriptionId]);

  const fetchPrescription = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(
        `/api/medical-records/patients/${patientId}/prescriptions/${prescriptionId}`
      );

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || 'Error al cargar prescripción');
      }

      const data = await res.json();
      setPrescription(data.data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleIssue = async () => {
    const confirmed = await practiceConfirm(
      '¿Está seguro de emitir esta prescripción? No podrá editarla después.'
    );
    if (!confirmed) return;

    setActionLoading(true);
    setError('');
    try {
      const res = await fetch(
        `/api/medical-records/patients/${patientId}/prescriptions/${prescriptionId}/issue`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({}),
        }
      );

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || 'Error al emitir prescripción');
      }

      await fetchPrescription();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleCancel = async () => {
    if (!cancellationReason.trim()) {
      setError('Debe proporcionar un motivo de cancelación');
      return;
    }

    setActionLoading(true);
    setError('');
    try {
      const res = await fetch(
        `/api/medical-records/patients/${patientId}/prescriptions/${prescriptionId}/cancel`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ cancellationReason }),
        }
      );

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || 'Error al cancelar prescripción');
      }

      setShowCancelModal(false);
      await fetchPrescription();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleDelete = async () => {
    const confirmed = await practiceConfirm(
      '¿Está seguro de eliminar esta prescripción? Esta acción no se puede deshacer.'
    );
    if (!confirmed) return;

    setActionLoading(true);
    setError('');
    try {
      const res = await fetch(
        `/api/medical-records/patients/${patientId}/prescriptions/${prescriptionId}`,
        { method: 'DELETE' }
      );

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || 'Error al eliminar prescripción');
      }

      router.push(`/dashboard/medical-records/patients/${patientId}/prescriptions`);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleDownloadPDF = () => {
    window.open(
      `/api/medical-records/patients/${patientId}/prescriptions/${prescriptionId}/pdf`,
      '_blank'
    );
  };

  return {
    // Route
    patientId,
    prescriptionId,
    sessionStatus: status,
    // Data
    prescription,
    // Loading / error
    loading,
    actionLoading,
    error,
    // Cancel modal
    showCancelModal, setShowCancelModal,
    cancellationReason, setCancellationReason,
    // Actions
    handleIssue,
    handleCancel,
    handleDelete,
    handleDownloadPDF,
  };
}
