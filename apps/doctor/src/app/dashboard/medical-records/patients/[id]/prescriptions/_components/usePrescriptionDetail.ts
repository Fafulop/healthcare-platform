'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { redirect } from 'next/navigation';
import { practiceConfirm } from '@/lib/practice-confirm';
import { DEFAULT_PDF_SETTINGS, type PdfSettings } from '@/types/pdf-settings';
import { ajustesRx, dibujarReceta, imagenABase64, nombreArchivoReceta } from '@/lib/receta-pdf';
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
  const [pdfSettings, setPdfSettings] = useState<PdfSettings | null>(null);
  const [showPdfSettings, setShowPdfSettings] = useState(false);

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

  const fetchPdfSettings = async (): Promise<PdfSettings> => {
    if (pdfSettings) return pdfSettings;
    try {
      const res = await fetch('/api/doctor/pdf-settings');
      const data = await res.json();
      if (data.success) {
        setPdfSettings(data.data);
        return data.data;
      }
    } catch {
      console.error('Error fetching PDF settings');
    }
    return DEFAULT_PDF_SETTINGS;
  };

  const handleDownloadPDF = async () => {
    if (!prescription) return;
    setActionLoading(true);
    try {
      // 1. Fetch template settings + PDF settings in parallel
      const [templateRes, settings] = await Promise.all([
        fetch('/api/prescription-template'),
        fetchPdfSettings(),
      ]);
      const templateData = templateRes.ok ? await templateRes.json() : {};
      const logoUrl: string | null = templateData.data?.prescriptionLogoUrl || null;
      const signatureUrl: string | null = templateData.data?.prescriptionSignatureUrl || null;
      const colorScheme: string = templateData.data?.prescriptionColorScheme || 'blue';

      // Merge and clamp rx margins (lib/receta-pdf.ts — lo mismo que usa la vista previa)
      const rx = ajustesRx(settings);

      // 3. Load images as base64
      const [logoB64, sigB64] = await Promise.all([
        logoUrl && rx.showLogo ? imagenABase64(logoUrl) : Promise.resolve(null),
        signatureUrl && rx.showSignature ? imagenABase64(signatureUrl) : Promise.resolve(null),
      ]);

      // 4. Generate PDF — la MISMA función que la vista previa en vivo de «Receta PDF».
      const { default: jsPDF } = await import('jspdf');
      const doc = dibujarReceta(jsPDF, prescription, { colorScheme, logoB64, sigB64 }, rx);

      // 5. Save
      doc.save(nombreArchivoReceta(prescription));
    } catch (err) {
      console.error('Error generating PDF:', err);
      setError('Error al generar el PDF. Intente de nuevo.');
    } finally {
      setActionLoading(false);
    }
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
    // PDF settings
    pdfSettings,
    setPdfSettings,
    showPdfSettings,
    setShowPdfSettings,
    // Actions
    handleIssue,
    handleCancel,
    handleDelete,
    handleDownloadPDF,
  };
}
