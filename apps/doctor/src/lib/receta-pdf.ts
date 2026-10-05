/**
 * La receta en PDF (jsPDF) — UNA sola función que la dibuja, para la DESCARGA (detalle de la receta) y
 * para la VISTA PREVIA en vivo de «Receta PDF». Si cada uno dibujara la suya, la vista previa dejaría de
 * parecerse a lo que se imprime. El código de dibujo se movió TAL CUAL desde `usePrescriptionDetail.ts`
 * (2026-10-01); `scripts/receta/receta-pdf-probe.ts` compara el PDF de antes y el de ahora byte por byte.
 * (Desde el bloque de identidad, 2026-10-05, la receta cambió a propósito: esa sonda ya no da iguales.)
 */
import type { jsPDF as JsPDF } from 'jspdf';
import { RX_PAGE_FORMATS, type PdfSettings, type RxPageSize } from '@/types/pdf-settings';
import { resolveRecetaCustomContent } from '@/lib/receta-custom-content';
import type { PrescriptionDetails } from '@/app/dashboard/medical-records/patients/[id]/prescriptions/_components/prescription-types';

/** Lo que el dibujo lee de una receta (la de verdad, o la de ejemplo de la vista previa). */
export type RecetaParaPdf = Pick<
  PrescriptionDetails,
  | 'prescriptionDate' | 'expiresAt' | 'diagnosis' | 'clinicalNotes'
  | 'doctorFullName' | 'doctorLicense' | 'doctorCredentials' | 'patient'
  | 'medications' | 'imagingStudies' | 'labStudies' | 'customData' | 'template'
>;

/** Logo y firma ya en base64 (null = no se dibujan) y el color. */
export interface DisenoReceta {
  colorScheme: string;
  logoB64: string | null;
  sigB64: string | null;
}

/** Los ajustes de impresión del doctor, ya combinados con los defaults y con los márgenes acotados. */
export function ajustesRx(settings: PdfSettings) {
  return {
    showHeader: settings.rxShowHeader ?? true,
    showFooter: settings.rxShowFooter ?? true,
    showPatientBox: settings.rxShowPatientBox ?? true,
    showDiagnosis: settings.rxShowDiagnosis ?? true,
    showClinicalNotes: settings.rxShowClinicalNotes ?? true,
    showLogo: settings.rxShowLogo ?? true,
    showSignature: settings.rxShowSignature ?? true,
    pageSize: (settings.rxPageSize ?? 'a4') as RxPageSize,
    orientation: (settings.rxOrientation === 'landscape' ? 'landscape' : 'portrait') as 'portrait' | 'landscape',
    topMarginMm: Math.max(0, Math.min(80, settings.rxTopMarginMm ?? 0)),
    bottomMarginMm: Math.max(0, Math.min(80, settings.rxBottomMarginMm ?? 0)),
  };
}
export type AjustesRx = ReturnType<typeof ajustesRx>;

export const COLOR_MAP: Record<string, [number, number, number]> = {
  blue:   [30, 64, 175],
  green:  [21, 128, 61],
  purple: [124, 58, 237],
  red:    [185, 28, 28],
  gray:   [55, 65, 81],
};

/**
 * `prescriptionDate`/`expiresAt` are calendar days stored as UTC midnight
 * (`2026-10-03T00:00:00.000Z` — all 74 prod rows, 2026-10-03). Parsing that as an instant
 * rendered it in local time — the evening BEFORE in Mexico — so every PDF printed the previous
 * day (H-027). Only the date part matters; noon keeps any local timezone on the same day.
 */
export const formatDate = (iso: string) =>
  new Date(`${iso.slice(0, 10)}T12:00:00`)
    .toLocaleDateString('es-MX', { day: '2-digit', month: '2-digit', year: 'numeric' });

/**
 * El renglón de identidad cuando la hoja va SIN encabezado: «Dr. … · Céd. … · 22 oct 2026», en gris,
 * partido en renglones si no cabe. Devuelve dónde sigue el cuerpo. Lo usan la receta y la hoja compartida (`pdf-documento.ts`).
 */
export function renglonIdentidad(
  doc: JsPDF, doctorFullName: string, credLines: string[], fecha: string | undefined,
  margin: number, colW: number, y: number,
  /** With the footer band on, name and cédulas are already there on every page: only the date here. */
  conPie = false,
): number {
  const partes = (conPie ? [fecha] : [doctorFullName?.trim(), ...credLines, fecha]).filter(Boolean) as string[];
  if (partes.length === 0) return y;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(70, 70, 70);
  const lineas = doc.splitTextToSize(partes.join('  ·  '), colW) as string[];
  doc.text(lineas, margin, y);
  doc.setTextColor(0, 0, 0);
  return y + lineas.length * 3.8 + 3;
}

/** Una imagen (logo, firma) como data URL base64 para jsPDF; null si no se pudo bajar. */
export async function imagenABase64(url: string): Promise<string | null> {
  try {
    const res = await fetch(url);
    // An HTTP error (expired signed URL, deleted object) is "no image", not its error page as base64:
    // jsPDF's addImage would throw on it inside a silent try/catch anyway (2026-10-02).
    if (!res.ok) return null;
    const blob = await res.blob();
    return await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  } catch { return null; }
}

/** El nombre del archivo que baja: `receta_Nombre_Apellido_DD-MM-AAAA.pdf`. */
export function nombreArchivoReceta(prescription: RecetaParaPdf) {
  const safeName = `${prescription.patient.firstName}_${prescription.patient.lastName}`.replace(/\s+/g, '_');
  const dateStr = formatDate(prescription.prescriptionDate).replace(/\//g, '-');
  return `receta_${safeName}_${dateStr}.pdf`;
}

/** Dibuja la receta y devuelve el documento (la descarga hace `.save`, la vista previa `.output`). */
export function dibujarReceta(jsPDF: typeof JsPDF, prescription: RecetaParaPdf, diseno: DisenoReceta, rx: AjustesRx): JsPDF {
  const { colorScheme, logoB64, sigB64 } = diseno;
  const noColor = colorScheme === 'none';
  const [cr, cg, cb] = noColor ? [0, 0, 0] : (COLOR_MAP[colorScheme] ?? COLOR_MAP.blue);

  const doc = new jsPDF({ unit: 'mm', format: RX_PAGE_FORMATS[rx.pageSize] ?? 'a4', orientation: rx.orientation });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 14;
  const colW = pageW - margin * 2;
  const footerH = rx.showFooter ? 22 : 0;

  // Guard: letterhead margins (up to 80mm each) on small/landscape pages
  // must never leave a zero/negative content area — checkPage would call
  // addPage() forever and hang the tab. Scale both down proportionally so
  // at least ~30mm of content fits per page.
  const bandTop = rx.showHeader ? 40 : 14;
  let topMarginMm = rx.topMarginMm;
  let bottomMarginMm = rx.bottomMarginMm;
  const availForMargins = pageH - bandTop - footerH - 30 - 6;
  if (topMarginMm + bottomMarginMm > availForMargins) {
    const scale = Math.max(0, availForMargins) / (topMarginMm + bottomMarginMm || 1);
    topMarginMm = Math.floor(topMarginMm * scale);
    bottomMarginMm = Math.floor(bottomMarginMm * scale);
  }

  const footerY = pageH - footerH - bottomMarginMm;
  const maxContentY = footerY - 6;
  const topReset = topMarginMm + 14;
  let y = 0;

  // Credential lines, ONCE for header, footer and the no-band identity line. Without credentials nor a
  // license: nothing (it used to print «Cédula Profesional: undefined»).
  const credLines = (prescription.doctorCredentials?.length
    ? prescription.doctorCredentials.map((c) => `${c.titulo} — Céd. ${c.cedula}`)
    : prescription.doctorLicense ? [`Cédula Profesional: ${prescription.doctorLicense}`] : []
  ).slice(0, 4);

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

    // Narrow pages (media carta / A5): smaller logo + title so they don't crowd
    const narrow = pageW < 180;
    if (logoB64) {
      try {
        const fmt = logoB64.startsWith('data:image/png') ? 'PNG' : 'JPEG';
        const logoSize = narrow ? 18 : 25;
        doc.addImage(logoB64, fmt, margin, narrow ? 8 : 5, logoSize, logoSize);
      } catch {}
    }

    doc.setTextColor(noColor ? 30 : 255, noColor ? 30 : 255, noColor ? 30 : 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(narrow ? 13 : 18);
    doc.text('RECETA MÉDICA', pageW / 2, 15, { align: 'center' });
    // Bloque de identidad: la fecha también en la banda (si el doctor apaga la caja del paciente, era
    // el único lugar con la fecha).
    doc.setFont('helvetica', 'normal');
    // Abajo a la izquierda de la banda (debajo del logo), donde no hay nada: centrada chocaba con el
    // nombre y las cédulas de la derecha (en media carta siempre; en hoja ancha con cédulas largas).
    doc.setFontSize(7.5);
    doc.text(formatDate(prescription.prescriptionDate), margin, 32);
    doc.setFont('helvetica', 'bold');

    doc.setFontSize(9);
    doc.text(prescription.doctorFullName, pageW - margin, 18, { align: 'right' });
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    // Credentials list (titulo + cédula each); fallback: legacy single cédula
    // header band (35mm) fits 4 lines: last baseline 32.1
    credLines.forEach((line, i) => {
      doc.text(line, pageW - margin, 22.5 + i * 3.2, { align: 'right' });
    });
    y = 40 + topMarginMm;
  } else {
    y = topReset;
    // Bloque de identidad sin banda (hoja membretada): médico · cédula(s) · fecha, siempre — con
    // encabezado, pie y caja del paciente apagados, la receta salía sin ninguno de los tres.
    y = renglonIdentidad(doc, prescription.doctorFullName, credLines, formatDate(prescription.prescriptionDate), margin, colW, y, rx.showFooter);
  }

  // ── PATIENT BOX ────────────────────────────────────────────────────────

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

  // ── TEMPLATE RECETA CONTENT (custom fields replace medication rows) ────
  const customContent = resolveRecetaCustomContent(
    prescription.customData,
    prescription.template?.customFields
  );
  if (customContent.length > 0) {
    drawSectionTitle((prescription.template?.name || 'PRESCRIPCIÓN').toUpperCase());

    // Replicate the template's on-screen layout: half/third fields share a
    // row (packed left-to-right until the width fractions fill it), and
    // section changes get a light subtitle (only when >1 section exists).
    const WIDTH_FRACTION = { full: 1, half: 0.5, third: 1 / 3 } as const;
    const gutter = 4;
    const sections = new Set(customContent.map((c) => c.section || 'General'));
    const showSectionTitles = sections.size > 1;

    type Measured = { label: string[]; value: string[]; x: number; w: number; h: number };

    let currentSection: string | undefined;
    let idx = 0;
    while (idx < customContent.length) {
      const item = customContent[idx];
      const itemSection = item.section || 'General';
      if (showSectionTitles && itemSection !== currentSection) {
        currentSection = itemSection;
        checkPage(9);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(8.5);
        doc.setTextColor(cr, cg, cb);
        doc.text(currentSection, margin, y);
        doc.setDrawColor(220, 220, 220);
        doc.line(margin, y + 1.5, margin + colW, y + 1.5);
        y += 6;
      }

      // Pack a row: consecutive items of the SAME section while fractions fit
      const row: typeof customContent = [];
      let used = 0;
      while (idx < customContent.length) {
        const next = customContent[idx];
        if ((next.section || 'General') !== itemSection) break;
        const frac = WIDTH_FRACTION[next.width] ?? 1;
        if (row.length > 0 && used + frac > 1.001) break;
        row.push(next);
        used += frac;
        idx++;
      }

      // Measure columns (label + wrapped value), row height = tallest
      let x = margin;
      const cols: Measured[] = row.map((c) => {
        const frac = WIDTH_FRACTION[c.width] ?? 1;
        const w = frac * colW - (frac < 1 ? gutter : 0);
        // Measure with the same font used to draw (bold runs wider)
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(8);
        const label = doc.splitTextToSize(c.label, w) as string[];
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(9);
        const value = doc.splitTextToSize(c.value, w - 2) as string[];
        const h = label.length * 3.8 + value.length * 4.5 + 2;
        const col = { label, value, x, w, h };
        x += frac * colW;
        return col;
      });
      const rowH = Math.max(...cols.map((c) => c.h));

      checkPage(rowH + 2);
      for (const col of cols) {
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(8);
        doc.setTextColor(cr, cg, cb);
        doc.text(col.label, col.x, y);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(9);
        doc.setTextColor(30, 30, 30);
        doc.text(col.value, col.x + 1, y + col.label.length * 3.8 + 3.2);
      }
      y += rowH + 3;
    }
  }

  // ── MEDICATIONS ────────────────────────────────────────────────────────
  if (prescription.medications.length > 0) {
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
  }

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
      doc.text(prescription.doctorFullName, margin, footerY + 7);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(6.5);
      // footer band (22mm) fits 4 lines: last baseline 19.2
      credLines.forEach((line, i) => {
        doc.text(line, margin, footerY + 10.5 + i * 2.9);
      });

      if (sigB64) {
        doc.setFontSize(7);
        doc.setFont('helvetica', 'italic');
        doc.text('Firma del médico', pageW - margin, footerY + 20.5, { align: 'right' });
      }
    }
  }

  return doc;
}
