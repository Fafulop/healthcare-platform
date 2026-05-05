'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { redirect } from 'next/navigation';
import { practiceConfirm } from '@/lib/practice-confirm';
import { DEFAULT_PDF_SETTINGS, type PdfSettings } from '@/types/pdf-settings';
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

      // Merge and clamp rx margins
      const rx = {
        showHeader: settings.rxShowHeader ?? true,
        showFooter: settings.rxShowFooter ?? true,
        showPatientBox: settings.rxShowPatientBox ?? true,
        showDiagnosis: settings.rxShowDiagnosis ?? true,
        showClinicalNotes: settings.rxShowClinicalNotes ?? true,
        topMarginMm: Math.max(0, Math.min(80, settings.rxTopMarginMm ?? 0)),
        bottomMarginMm: Math.max(0, Math.min(80, settings.rxBottomMarginMm ?? 0)),
      };

      // 2. Color map
      const COLOR_MAP: Record<string, [number, number, number]> = {
        blue:   [30, 64, 175],
        green:  [21, 128, 61],
        purple: [124, 58, 237],
        red:    [185, 28, 28],
        gray:   [55, 65, 81],
      };
      const noColor = colorScheme === 'none';
      const [cr, cg, cb] = noColor ? [0, 0, 0] : (COLOR_MAP[colorScheme] ?? COLOR_MAP.blue);

      // 3. Load images as base64
      const toBase64 = async (url: string): Promise<string | null> => {
        try {
          const res = await fetch(url);
          const blob = await res.blob();
          return await new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result as string);
            reader.onerror = reject;
            reader.readAsDataURL(blob);
          });
        } catch { return null; }
      };

      const [logoB64, sigB64] = await Promise.all([
        logoUrl ? toBase64(logoUrl) : Promise.resolve(null),
        signatureUrl ? toBase64(signatureUrl) : Promise.resolve(null),
      ]);

      // 4. Generate PDF
      const { default: jsPDF } = await import('jspdf');
      const doc = new jsPDF({ unit: 'mm', format: 'a4' });
      const pageW = doc.internal.pageSize.getWidth();
      const pageH = doc.internal.pageSize.getHeight();
      const margin = 14;
      const colW = pageW - margin * 2;
      const footerH = rx.showFooter ? 22 : 0;
      const footerY = pageH - footerH - rx.bottomMarginMm;
      const maxContentY = footerY - 6;
      const topReset = rx.topMarginMm + 14;
      let y = 0;

      const checkPage = (needed: number) => {
        if (y + needed > maxContentY) {
          doc.addPage();
          y = topReset;
        }
      };

      const drawSectionTitle = (title: string) => {
        checkPage(12);
        if (noColor) {
          doc.setFillColor(245, 245, 245);
          doc.rect(margin, y, colW, 8, 'F');
          doc.setDrawColor(200, 200, 200);
          doc.rect(margin, y, colW, 8, 'S');
          doc.setFont('helvetica', 'bold');
          doc.setFontSize(9);
          doc.setTextColor(30, 30, 30);
        } else {
          doc.setFillColor(cr, cg, cb);
          doc.rect(margin, y, colW, 8, 'F');
          doc.setFont('helvetica', 'bold');
          doc.setFontSize(9);
          doc.setTextColor(255, 255, 255);
        }
        doc.text(title, margin + 4, y + 5.5);
        y += 12;
      };

      // ── HEADER ────────────────────────────────────────────────────────────
      if (rx.showHeader) {
        if (noColor) {
          doc.setDrawColor(180, 180, 180);
          doc.line(0, 35, pageW, 35);
        } else {
          doc.setFillColor(cr, cg, cb);
          doc.rect(0, 0, pageW, 35, 'F');
        }

        if (logoB64) {
          try {
            const fmt = logoB64.startsWith('data:image/png') ? 'PNG' : 'JPEG';
            doc.addImage(logoB64, fmt, margin, 5, 25, 25);
          } catch {}
        }

        doc.setTextColor(noColor ? 30 : 255, noColor ? 30 : 255, noColor ? 30 : 255);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(18);
        doc.text('RECETA MÉDICA', pageW / 2, 15, { align: 'center' });

        doc.setFontSize(9);
        doc.text(prescription.doctorFullName, pageW - margin, 23, { align: 'right' });
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8);
        doc.text(`Cédula Profesional: ${prescription.doctorLicense}`, pageW - margin, 30, { align: 'right' });
        y = 40 + rx.topMarginMm;
      } else {
        y = rx.topMarginMm + 14;
      }

      // ── PATIENT BOX ────────────────────────────────────────────────────────
      const formatDate = (iso: string) =>
        new Date(iso.includes('T') ? iso : `${iso}T12:00:00`)
          .toLocaleDateString('es-MX', { day: '2-digit', month: '2-digit', year: 'numeric' });

      if (rx.showPatientBox) {
        doc.setTextColor(0, 0, 0);
        doc.setFillColor(245, 247, 250);
        doc.roundedRect(margin, y, colW, 24, 2, 2, 'F');

        const midX = margin + colW / 2 + 4;

        // Left column
        doc.setFontSize(7.5);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(100, 100, 100);
        doc.text('Paciente', margin + 4, y + 7);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(20, 20, 20);
        doc.setFontSize(10);
        const patientName = `${prescription.patient.firstName} ${prescription.patient.lastName}`;
        doc.text(patientName, margin + 4, y + 14);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(7.5);
        doc.setTextColor(100, 100, 100);
        doc.text(`ID: ${prescription.patient.internalId}  •  Sexo: ${prescription.patient.sex}`, margin + 4, y + 20.5);

        // Right column
        doc.text('Fecha de prescripción', midX, y + 7);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(20, 20, 20);
        doc.setFontSize(10);
        doc.text(formatDate(prescription.prescriptionDate), midX, y + 14);
        if (prescription.expiresAt) {
          doc.setFont('helvetica', 'normal');
          doc.setFontSize(7.5);
          doc.setTextColor(100, 100, 100);
          doc.text(`Vigencia: ${formatDate(prescription.expiresAt)}`, midX, y + 20.5);
        }

        y += 30;
      }

      // ── DIAGNOSIS / NOTES ──────────────────────────────────────────────────
      if (rx.showDiagnosis && prescription.diagnosis) {
        checkPage(12);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(8);
        doc.setTextColor(cr, cg, cb);
        doc.text('Diagnóstico:', margin, y);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(30, 30, 30);
        doc.setFontSize(9);
        const diagLines = doc.splitTextToSize(prescription.diagnosis, colW - 36);
        doc.text(diagLines, margin + 34, y);
        y += Math.max(7, diagLines.length * 5);
      }

      if (rx.showClinicalNotes && prescription.clinicalNotes) {
        checkPage(14);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(8);
        doc.setTextColor(cr, cg, cb);
        doc.text('Notas clínicas:', margin, y);
        y += 5;
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8.5);
        doc.setTextColor(60, 60, 60);
        const noteLines = doc.splitTextToSize(prescription.clinicalNotes, colW);
        checkPage(noteLines.length * 4.5 + 4);
        doc.text(noteLines, margin, y);
        y += noteLines.length * 4.5 + 4;
      }

      y += 3;

      // ── MEDICATIONS ────────────────────────────────────────────────────────
      drawSectionTitle('MEDICAMENTOS');

      prescription.medications.forEach((med, idx) => {
        checkPage(20);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(9.5);
        doc.setTextColor(20, 20, 20);
        const medTitle = `${idx + 1}. ${med.drugName}${med.presentation ? ` (${med.presentation})` : ''}`;
        doc.text(medTitle, margin, y);
        y += 5.5;

        const dosageParts = [
          med.dosage     && `Dosis: ${med.dosage}`,
          med.frequency  && `Frecuencia: ${med.frequency}`,
          med.duration   && `Duración: ${med.duration}`,
          med.quantity   && `Cantidad: ${med.quantity}`,
        ].filter(Boolean).join('  |  ');

        if (dosageParts) {
          checkPage(6);
          doc.setFont('helvetica', 'normal');
          doc.setFontSize(8);
          doc.setTextColor(60, 60, 60);
          const dosLines = doc.splitTextToSize(dosageParts, colW - 6);
          doc.text(dosLines, margin + 4, y);
          y += dosLines.length * 4.5;
        }

        if (med.instructions) {
          checkPage(6);
          doc.setFont('helvetica', 'italic');
          doc.setFontSize(8);
          doc.setTextColor(80, 80, 80);
          const instrLines = doc.splitTextToSize(`Indicaciones: ${med.instructions}`, colW - 6);
          doc.text(instrLines, margin + 4, y);
          y += instrLines.length * 4.5;
        }

        if (med.warnings) {
          checkPage(6);
          doc.setFont('helvetica', 'bold');
          doc.setFontSize(7.5);
          doc.setTextColor(180, 100, 0);
          const warnLines = doc.splitTextToSize(`Advertencia: ${med.warnings}`, colW - 6);
          doc.text(warnLines, margin + 4, y);
          y += warnLines.length * 4.5;
        }

        y += 4;
      });

      // ── IMAGING STUDIES ────────────────────────────────────────────────────
      if (prescription.imagingStudies?.length > 0) {
        y += 2;
        drawSectionTitle('ESTUDIOS DE IMAGEN');

        prescription.imagingStudies.forEach((study, idx) => {
          checkPage(14);
          doc.setFont('helvetica', 'bold');
          doc.setFontSize(9.5);
          doc.setTextColor(20, 20, 20);
          const studyTitle = `${idx + 1}. ${study.studyName}${study.region ? ` — ${study.region}` : ''}`;
          doc.text(studyTitle, margin, y);
          y += 5.5;

          const parts = [
            study.indication && `Indicación: ${study.indication}`,
            study.urgency    && `Urgencia: ${study.urgency}`,
          ].filter(Boolean).join('  |  ');

          if (parts) {
            checkPage(6);
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(8);
            doc.setTextColor(60, 60, 60);
            doc.text(parts, margin + 4, y);
            y += 5;
          }

          if (study.notes) {
            checkPage(6);
            doc.setFont('helvetica', 'italic');
            doc.setFontSize(8);
            doc.setTextColor(80, 80, 80);
            const noteLines = doc.splitTextToSize(study.notes, colW - 6);
            doc.text(noteLines, margin + 4, y);
            y += noteLines.length * 4.5;
          }

          y += 3;
        });
      }

      // ── LAB STUDIES ────────────────────────────────────────────────────────
      if (prescription.labStudies?.length > 0) {
        y += 2;
        drawSectionTitle('ESTUDIOS DE LABORATORIO');

        prescription.labStudies.forEach((study, idx) => {
          checkPage(14);
          doc.setFont('helvetica', 'bold');
          doc.setFontSize(9.5);
          doc.setTextColor(20, 20, 20);
          doc.text(`${idx + 1}. ${study.studyName}`, margin, y);
          y += 5.5;

          const parts = [
            study.indication && `Indicación: ${study.indication}`,
            study.urgency    && `Urgencia: ${study.urgency}`,
            study.fasting    && `Ayuno: ${study.fasting}`,
          ].filter(Boolean).join('  |  ');

          if (parts) {
            checkPage(6);
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(8);
            doc.setTextColor(60, 60, 60);
            doc.text(parts, margin + 4, y);
            y += 5;
          }

          if (study.notes) {
            checkPage(6);
            doc.setFont('helvetica', 'italic');
            doc.setFontSize(8);
            doc.setTextColor(80, 80, 80);
            const noteLines = doc.splitTextToSize(study.notes, colW - 6);
            doc.text(noteLines, margin + 4, y);
            y += noteLines.length * 4.5;
          }

          y += 3;
        });
      }

      // ── FOOTER (all pages) ──────────────────────────────────────────────────
      if (rx.showFooter) {
        const totalPages = (doc as any).getNumberOfPages();
        for (let p = 1; p <= totalPages; p++) {
          doc.setPage(p);
          if (noColor) {
            doc.setDrawColor(180, 180, 180);
            doc.line(0, footerY, pageW, footerY);
          } else {
            doc.setFillColor(cr, cg, cb);
            doc.rect(0, footerY, pageW, footerH, 'F');
          }

          if (sigB64) {
            try {
              const fmt = sigB64.startsWith('data:image/png') ? 'PNG' : 'JPEG';
              doc.addImage(sigB64, fmt, pageW - margin - 42, footerY + 2, 40, 18);
            } catch {}
          }

          doc.setTextColor(noColor ? 30 : 255, noColor ? 30 : 255, noColor ? 30 : 255);
          doc.setFont('helvetica', 'bold');
          doc.setFontSize(9);
          doc.text(prescription.doctorFullName, margin, footerY + 10);
          doc.setFont('helvetica', 'normal');
          doc.setFontSize(8);
          doc.text(`Cédula Profesional: ${prescription.doctorLicense}`, margin, footerY + 17);

          if (sigB64) {
            doc.setFontSize(7);
            doc.setFont('helvetica', 'italic');
            doc.text('Firma del médico', pageW - margin, footerY + 20.5, { align: 'right' });
          }
        }
      }

      // 5. Save
      const safeName = `${prescription.patient.firstName}_${prescription.patient.lastName}`.replace(/\s+/g, '_');
      const dateStr = formatDate(prescription.prescriptionDate).replace(/\//g, '-');
      doc.save(`receta_${safeName}_${dateStr}.pdf`);
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
