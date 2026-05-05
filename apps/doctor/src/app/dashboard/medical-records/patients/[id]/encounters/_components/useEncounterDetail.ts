'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { redirect } from 'next/navigation';
import { practiceConfirm } from '@/lib/practice-confirm';
import { generateEncounterPDF } from '@/lib/pdf/encounter-pdf';
import type { PdfSettings } from '@/types/pdf-settings';
import type { Encounter } from './encounter-types';

export function useEncounterDetail() {
  const params = useParams();
  const router = useRouter();
  const patientId = params.id as string;
  const encounterId = params.encounterId as string;

  const { status } = useSession({
    required: true,
    onUnauthenticated() {
      redirect('/login');
    },
  });

  const [encounter, setEncounter] = useState<Encounter | null>(null);
  const [customTemplate, setCustomTemplate] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);
  const [exportingPDF, setExportingPDF] = useState(false);
  const [pdfSettings, setPdfSettings] = useState<PdfSettings | null>(null);
  const [showPdfSettings, setShowPdfSettings] = useState(false);

  useEffect(() => {
    fetchEncounter();
  }, [patientId, encounterId]);

  const fetchEncounter = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(
        `/api/medical-records/patients/${patientId}/encounters/${encounterId}`
      );

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || 'Error al cargar consulta');
      }

      const data = await res.json();

      if (!data?.data) {
        throw new Error('Invalid response format');
      }

      setEncounter(data.data);

      if (data.data.templateId) {
        fetchCustomTemplate(data.data.templateId);
      }
    } catch (err: any) {
      setError(err.message || 'Error loading encounter');
    } finally {
      setLoading(false);
    }
  };

  const fetchCustomTemplate = async (templateId: string) => {
    try {
      const res = await fetch(`/api/custom-templates/${templateId}`);
      if (res.ok) {
        const data = await res.json();
        if (data.success) setCustomTemplate(data.data);
      }
    } catch (err) {
      console.error('Error fetching custom template:', err);
    }
  };

  const fetchPdfSettings = async (): Promise<PdfSettings | null> => {
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
    return null;
  };

  const handleExportPDF = async () => {
    if (!encounter) return;
    setExportingPDF(true);
    try {
      const settings = await fetchPdfSettings();
      await generateEncounterPDF(encounter, customTemplate, settings);
    } catch (err) {
      console.error('Error generating PDF:', err);
    } finally {
      setExportingPDF(false);
    }
  };

  const handleDelete = async () => {
    const confirmed = await practiceConfirm(
      '¿Está seguro de eliminar esta consulta? Esta acción no se puede deshacer.'
    );
    if (!confirmed) return;

    setIsDeleting(true);
    try {
      const res = await fetch(
        `/api/medical-records/patients/${patientId}/encounters/${encounterId}`,
        { method: 'DELETE' }
      );
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Error al eliminar consulta');
      }
      router.push(`/dashboard/medical-records/patients/${patientId}`);
    } catch (err: any) {
      setError(err.message);
      setIsDeleting(false);
    }
  };

  return {
    // Route
    patientId,
    encounterId,
    sessionStatus: status,
    // Data
    encounter,
    customTemplate,
    // Loading / error
    loading,
    error,
    isDeleting,
    exportingPDF,
    // PDF settings
    pdfSettings,
    setPdfSettings,
    showPdfSettings,
    setShowPdfSettings,
    // Actions
    handleExportPDF,
    handleDelete,
  };
}
