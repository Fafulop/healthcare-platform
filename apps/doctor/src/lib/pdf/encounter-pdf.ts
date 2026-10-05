// jsPDF is dynamically imported — safe for client-only use, no SSR issues
import type { jsPDF as JsPDF } from 'jspdf';
import { DEFAULT_PDF_SETTINGS, type PdfSettings } from '@/types/pdf-settings';
import { ajustesRx, sexoTexto, type AjustesRx, type DisenoReceta } from '@/lib/receta-pdf';
import { abrirHoja, cerrarHoja, type EmisorNota } from '@/lib/pdf-documento';
import { calcularEdad as calcAge } from '@/lib/edad';
import { sinValor, textoDeValor } from '@/lib/campo-archivo';

function formatLocalDate(dateString: string): string {
  try {
    const [year, month, day] = dateString.split('T')[0].split('-').map(Number);
    if (year && month && day) {
      return new Date(year, month - 1, day).toLocaleDateString('es-MX', {
        year: 'numeric', month: 'long', day: 'numeric',
      });
    }
    return dateString;
  } catch {
    return dateString;
  }
}

function encTypeLabel(t: string): string {
  return ({ consultation: 'Consulta', 'follow-up': 'Seguimiento', emergency: 'Emergencia', telemedicine: 'Telemedicina' }[t] ?? t);
}

function encStatusLabel(s: string): string {
  return ({ completed: 'Completada', draft: 'Borrador', amended: 'Enmendada' }[s] ?? s);
}

function addText(doc: any, text: string, x: number, y: number, maxW: number, lh: number): number {
  const lines = doc.splitTextToSize(text, maxW);
  doc.text(lines, x, y);
  return y + lines.length * lh;
}

function sectionHeader(doc: any, label: string, y: number, pageWidth: number): number {
  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(100, 116, 139);
  doc.text(label.toUpperCase(), 14, y);
  doc.setDrawColor(226, 232, 240);
  doc.line(14, y + 2, pageWidth - 14, y + 2);
  doc.setTextColor(0, 0, 0);
  return y + 8;
}

function pageBreakIfNeeded(doc: any, y: number, threshold = 255, topReset = 20): number {
  if (y > threshold) { doc.addPage(); return topReset; }
  return y;
}

// ─────────────────────────────────────────────────────────────────────────────
// Single encounter PDF — on the SHARED sheet (2026-10-05)
// ─────────────────────────────────────────────────────────────────────────────
// It had its own design (blue band «CONSULTA MÉDICA», no doctor, no cédula) and, with the band off
// for letterhead paper, it lost the date too (H-048). Now it is drawn on `abrirHoja`/`cerrarHoja`: the
// receta's design (logo, color, cédulas, signature) + the identity block (doctor · cédula · date of
// the consulta), with THIS document's own print settings (header, footer, margins, sections).

/** The visita PDF's print settings on the shared sheet's shape (+ its own section toggles). */
export function ajustesConsulta(settings: PdfSettings) {
  const s = { ...DEFAULT_PDF_SETTINGS, ...settings };
  return {
    // From «Receta PDF» (same logo/signature switches as every clinic document).
    ...ajustesRx(s),
    // The visita PDF's OWN settings («PDF de consulta»).
    showHeader: s.showHeader,
    showFooter: s.showFooter,
    showPatientBox: s.showPatientBox,
    pageSize: 'a4' as const,
    orientation: 'portrait' as const,
    topMarginMm: Math.max(0, Math.min(80, s.topMarginMm)),
    bottomMarginMm: Math.max(0, Math.min(80, s.bottomMarginMm)),
    showEncounterMeta: s.showEncounterMeta,
    showVitals: s.showVitals,
    showFollowUp: s.showFollowUp,
    showPageNumbers: s.showPageNumbers,
  };
}
export type AjustesConsulta = ReturnType<typeof ajustesConsulta>;

/** `consulta-AAAA-MM-DD-nombre-apellido.pdf` */
export function nombreArchivoConsulta(encounter: any): string {
  const pat = encounter.patient;
  const dateStr = String(encounter.encounterDate).split('T')[0];
  const slug = `${pat.firstName}-${pat.lastName}`.toLowerCase().replace(/\s+/g, '-');
  return `consulta-${dateStr}-${slug}.pdf`;
}

/** Draws the visita/plantilla PDF and returns the document (preview `.output`, download `.save`). */
export function dibujarConsulta(
  jsPDF: typeof JsPDF,
  emisor: EmisorNota,
  diseno: DisenoReceta,
  rxBase: AjustesRx,
  encounter: any,
  customTemplate?: any | null,
): JsPDF {
  // Missing section toggles (a caller that forgot `ajustesDe={ajustesConsulta}`) default to ON instead of
  // silently dropping vitals / follow-up / meta / page numbers.
  const settings = { showEncounterMeta: true, showVitals: true, showFollowUp: true, showPageNumbers: true, ...rxBase } as AjustesConsulta;
  const h = abrirHoja(jsPDF, emisor, diseno, settings, {
    grande: 'CONSULTA MÉDICA',
    subtitulo: encStatusLabel(encounter.status),
    fecha: formatLocalDate(encounter.encounterDate),
  });
  const { doc } = h;
  const W = h.pageW;
  const m = h.margin;
  const cw = h.colW;
  // Without a footer the page number goes at the bottom: keep the body 8 mm above it.
  const breakThreshold = h.maxContentY - (settings.showPageNumbers && !settings.showFooter ? 8 : 0);
  const topReset = h.topReset;
  let y = h.y;
  // Long texts (a SOAP note, a plantilla textarea) continue on the next page line by line: the footer
  // band is opaque now, so text running past it would be HIDDEN, not just near the edge. Shadows the
  // module-level `addText` (which does not paginate) — the body below uses this one.
  const textoPaginado = (d: any, text: string, x: number, y0: number, maxW: number, lh: number): number => {
    const lines: string[] = d.splitTextToSize(text, maxW);
    let yy = y0;
    for (const line of lines) {
      if (yy > breakThreshold) { d.addPage(); yy = topReset; }
      d.text(line, x, yy);
      yy += lh;
    }
    return yy;
  };

  // Patient box
  const pat = encounter.patient;
  if (settings.showPatientBox) {
    doc.setFillColor(248, 250, 252);
    doc.roundedRect(m, y, cw, 22, 2, 2, 'F');
    doc.setFontSize(7.5);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(100, 116, 139);
    doc.text('PACIENTE', m + 4, y + 6);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(0, 0, 0);
    doc.text(`${pat.firstName} ${pat.lastName}`, m + 4, y + 13);
    doc.setFontSize(8.5);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(80, 80, 80);
    const metaParts = [
      pat.internalId ? `ID: ${pat.internalId}` : null,
      sexoTexto(pat.sex) ? `Sexo: ${sexoTexto(pat.sex)}` : null,
      pat.dateOfBirth ? `Edad: ${calcAge(pat.dateOfBirth)} años` : null,
    ].filter(Boolean).join('   ');
    doc.text(metaParts, m + 4, y + 19);
    doc.setTextColor(0, 0, 0);
    y += 28;
  }
  // Encounter meta
  if (settings.showEncounterMeta) {
    doc.setFontSize(8.5);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(80, 80, 80);
    const metaLine = [
      `Tipo: ${encTypeLabel(encounter.encounterType)}`,
      encounter.location ? `Lugar: ${encounter.location}` : null,
    ].filter(Boolean).join('   •   ');
    doc.text(metaLine, m, y);
    doc.setTextColor(0, 0, 0);
    y += 10;
  }

  // Chief complaint (skip for pure custom templates where it's irrelevant)
  const isCustom = !!(encounter.templateId || encounter.customData);
  if (!isCustom && encounter.chiefComplaint) {
    y = sectionHeader(doc, 'Motivo de Consulta', y, W);
    doc.setFontSize(9.5);
    doc.setFont('helvetica', 'normal');
    y = textoPaginado(doc, encounter.chiefComplaint, m, y, cw, 5) + 6;
  }

  // Vitals
  const vitals = [
    encounter.vitalsBloodPressure ? `PA: ${encounter.vitalsBloodPressure} mmHg` : null,
    encounter.vitalsHeartRate ? `FC: ${encounter.vitalsHeartRate} lpm` : null,
    encounter.vitalsTemperature ? `Temp: ${encounter.vitalsTemperature} °C` : null,
    encounter.vitalsWeight ? `Peso: ${encounter.vitalsWeight} kg` : null,
    encounter.vitalsHeight ? `Talla: ${encounter.vitalsHeight} cm` : null,
    encounter.vitalsOxygenSat ? `SpO₂: ${encounter.vitalsOxygenSat}%` : null,
  ].filter(Boolean) as string[];

  if (settings.showVitals && vitals.length > 0) {
    // Header (8) + box (up to 18): the whole box must fit above the footer band.
    y = pageBreakIfNeeded(doc, y, breakThreshold - 26, topReset);
    y = sectionHeader(doc, 'Signos Vitales', y, W);
    const vitalsLine1 = vitals.slice(0, 3).join('   |   ');
    const vitalsLine2 = vitals.slice(3).join('   |   ');
    const vitalHeight = vitalsLine2 ? 18 : 11;
    doc.setFillColor(239, 246, 255);
    doc.roundedRect(m, y, cw, vitalHeight, 2, 2, 'F');
    doc.setFontSize(8.5);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(30, 64, 175);
    doc.text(vitalsLine1, m + 4, y + 7.5);
    if (vitalsLine2) doc.text(vitalsLine2, m + 4, y + 14);
    doc.setTextColor(0, 0, 0);
    y += vitalHeight + 5;
    if (encounter.vitalsOther) {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8.5);
      y = textoPaginado(doc, `Otros: ${encounter.vitalsOther}`, m, y, cw, 5) + 4;
    }
  }

  // SOAP
  const soapItems: { key: string; label: string; value: string | undefined; r: number; g: number; b: number }[] = [
    { key: 'S', label: 'Subjetivo', value: encounter.subjective, r: 59, g: 130, b: 246 },
    { key: 'O', label: 'Objetivo', value: encounter.objective, r: 22, g: 163, b: 74 },
    { key: 'A', label: 'Evaluación', value: encounter.assessment, r: 180, g: 130, b: 0 },
    { key: 'P', label: 'Plan', value: encounter.plan, r: 168, g: 85, b: 247 },
  ];
  const hasSOAP = soapItems.some(s => s.value);

  if (hasSOAP) {
    y = pageBreakIfNeeded(doc, y, breakThreshold - 15, topReset);
    y = sectionHeader(doc, 'Notas SOAP', y, W);
    for (const item of soapItems) {
      if (!item.value) continue;
      y = pageBreakIfNeeded(doc, y, breakThreshold, topReset);
      doc.setFillColor(item.r, item.g, item.b);
      doc.roundedRect(m, y - 1, 6, 6, 1, 1, 'F');
      doc.setFontSize(7);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(255, 255, 255);
      doc.text(item.key, m + 3, y + 3.5, { align: 'center' });
      doc.setTextColor(0, 0, 0);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      doc.text(item.label, m + 9, y + 3);
      y += 8;
      doc.setFont('helvetica', 'normal');
      y = textoPaginado(doc, item.value, m + 9, y, cw - 9, 5) + 5;
    }
  }

  // Clinical notes (only when no SOAP)
  if (encounter.clinicalNotes && !hasSOAP) {
    y = pageBreakIfNeeded(doc, y, breakThreshold - 5, topReset);
    y = sectionHeader(doc, 'Notas Clínicas', y, W);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    y = textoPaginado(doc, encounter.clinicalNotes, m, y, cw, 5) + 6;
  }

  // Custom template data
  if (isCustom && encounter.customData && Object.keys(encounter.customData).length > 0) {
    y = pageBreakIfNeeded(doc, y, breakThreshold - 15, topReset);
    const templateName = customTemplate?.name || 'Datos de la Consulta';
    y = sectionHeader(doc, templateName, y, W);

    const fields = customTemplate?.customFields as any[] | undefined;
    const entries: [string, any, string?][] = fields
      ? fields
          .filter((f: any) => f.showInPdf !== false)
          .map((f: any): [string, any, string?] => [f.labelEs || f.label || f.name, encounter.customData![f.name], f.type])
          .filter(([, v]) => !sinValor(v))
      : Object.entries(encounter.customData).filter(([, v]) => !sinValor(v)).map(([k, v]): [string, any, string?] => [k, v]);

    for (const [label, value, tipo] of entries) {
      y = pageBreakIfNeeded(doc, y, breakThreshold, topReset);
      doc.setFontSize(7.5);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(100, 116, 139);
      doc.text(String(label).toUpperCase(), m, y);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      doc.setTextColor(0, 0, 0);
      y += 5;
      const displayVal = textoDeValor(value, tipo);
      y = textoPaginado(doc, displayVal, m, y, cw, 5) + 4;
    }
    y += 2;
  }

  // Follow-up
  if (settings.showFollowUp && (encounter.followUpDate || encounter.followUpNotes)) {
    // Header (8) + box (up to 34): the whole box must fit above the footer band.
    y = pageBreakIfNeeded(doc, y, breakThreshold - 42, topReset);
    y = sectionHeader(doc, 'Seguimiento', y, W);
    doc.setFillColor(239, 246, 255);
    // Compute height dynamically so wrapped notes don't overflow the box
    let noteLines: string[] = [];
    if (encounter.followUpNotes) {
      doc.setFontSize(8.5);
      noteLines = doc.splitTextToSize(encounter.followUpNotes, cw - 8);
      if (noteLines.length > 4) noteLines = noteLines.slice(0, 4); // cap at 4 lines
    }
    const fuh = encounter.followUpDate
      ? (noteLines.length > 0 ? 10 + noteLines.length * 5 + 4 : 10)
      : (noteLines.length * 5 + 4);
    doc.roundedRect(m, y, cw, fuh, 2, 2, 'F');
    let ty = y + 7;
    if (encounter.followUpDate) {
      doc.setFontSize(9);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(30, 64, 175);
      doc.text(formatLocalDate(encounter.followUpDate), m + 4, ty);
      doc.setTextColor(0, 0, 0);
      ty += 7;
    }
    if (noteLines.length > 0) {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8.5);
      doc.text(noteLines, m + 4, ty);
    }
    y += fuh + 8;
  }

  cerrarHoja(h, y, '', emisor, diseno, settings);

  // Page numbers (the visita PDF's own switch): inside the footer band (centered, it has room there)
  // or, without footer, 8 mm above the bottom margin — never on the content nor at the paper's edge.
  if (settings.showPageNumbers) {
    const totalPages = (doc as any).internal.getNumberOfPages();
    for (let i = 1; i <= totalPages; i++) {
      doc.setPage(i);
      doc.setFontSize(7);
      doc.setFont('helvetica', 'normal');
      if (settings.showFooter) {
        const t = h.noColor ? 90 : 255;
        doc.setTextColor(t, t, t);
        doc.text(`Página ${i} de ${totalPages}`, W / 2, h.footerY + h.footerH - 3, { align: 'center' });
      } else {
        doc.setTextColor(160, 160, 160);
        doc.text(`Página ${i} de ${totalPages}`, W - m, h.footerY - 6, { align: 'right' });
      }
    }
  }
  return doc;
}

// ─────────────────────────────────────────────────────────────────────────────
// Full timeline PDF (encounters only)
// ─────────────────────────────────────────────────────────────────────────────
export async function generateTimelinePDF(
  encounters: any[],
  patient: { firstName: string; lastName: string; dateOfBirth?: string },
): Promise<void> {
  const { default: jsPDF } = await import('jspdf');
  const doc = new jsPDF();
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  const m = 14;
  const cw = W - m * 2;

  // Header
  doc.setFillColor(37, 99, 235);
  doc.rect(0, 0, W, 32, 'F');
  doc.setFontSize(15);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(255, 255, 255);
  doc.text('HISTORIAL CLÍNICO', m, 14);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text(`${patient.firstName} ${patient.lastName}`, m, 23);
  doc.setFontSize(8);
  doc.text(`${encounters.length} consulta${encounters.length !== 1 ? 's' : ''}`, W - m, 23, { align: 'right' });
  doc.setTextColor(0, 0, 0);
  let y = 40;

  // Patient summary box
  doc.setFillColor(248, 250, 252);
  doc.roundedRect(m, y, cw, 12, 2, 2, 'F');
  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(80, 80, 80);
  const ageLine = patient.dateOfBirth ? `${calcAge(patient.dateOfBirth)} años` : '';
  doc.text(ageLine, m + 4, y + 8);
  if (encounters.length > 0) {
    const oldest = encounters[encounters.length - 1];
    const newest = encounters[0];
    doc.text(
      `${formatLocalDate(oldest.encounterDate.split('T')[0])} — ${formatLocalDate(newest.encounterDate.split('T')[0])}`,
      W - m - 4,
      y + 8,
      { align: 'right' },
    );
  }
  doc.setTextColor(0, 0, 0);
  y += 18;

  for (let idx = 0; idx < encounters.length; idx++) {
    const enc = encounters[idx];
    y = pageBreakIfNeeded(doc, y, 250);

    // Encounter header row
    doc.setFillColor(240, 245, 255);
    doc.roundedRect(m, y, cw, 11, 2, 2, 'F');
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(37, 99, 235);
    doc.text(`${idx + 1}.  ${formatLocalDate(enc.encounterDate.split('T')[0])}`, m + 4, y + 7.5);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(100, 116, 139);
    doc.text(
      `${encTypeLabel(enc.encounterType)}   •   ${encStatusLabel(enc.status)}`,
      W - m - 4,
      y + 7.5,
      { align: 'right' },
    );
    doc.setTextColor(0, 0, 0);
    y += 15;

    // Description
    const isCustom = !!(enc.templateId || enc.customData);
    let description = '';
    if (isCustom && enc.customData) {
      const first = Object.values(enc.customData).find((v: any) => typeof v === 'string' && v.trim());
      description = (first as string) || enc.chiefComplaint || '';
    } else {
      description = enc.chiefComplaint || '';
    }
    if (description) {
      doc.setFontSize(9);
      doc.setFont('helvetica', 'bold');
      y = addText(doc, description, m + 4, y, cw - 8, 5) + 3;
    }

    // Assessment / clinical notes (brief)
    const summary = enc.assessment || enc.clinicalNotes || enc.subjective || '';
    if (summary) {
      doc.setFontSize(8.5);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(60, 60, 60);
      const truncated = summary.length > 220 ? summary.slice(0, 220) + '…' : summary;
      y = addText(doc, truncated, m + 4, y, cw - 8, 4.5) + 3;
      doc.setTextColor(0, 0, 0);
    }

    // Compact vitals
    const vitals = [
      enc.vitalsBloodPressure ? `PA ${enc.vitalsBloodPressure}` : null,
      enc.vitalsHeartRate ? `FC ${enc.vitalsHeartRate} lpm` : null,
      enc.vitalsTemperature ? `T ${enc.vitalsTemperature}°C` : null,
      enc.vitalsWeight ? `${enc.vitalsWeight} kg` : null,
      enc.vitalsHeight ? `${enc.vitalsHeight} cm` : null,
      enc.vitalsOxygenSat ? `SpO₂ ${enc.vitalsOxygenSat}%` : null,
    ].filter(Boolean) as string[];
    if (vitals.length > 0) {
      doc.setFontSize(7.5);
      doc.setFont('helvetica', 'italic');
      doc.setTextColor(100, 116, 139);
      doc.text(vitals.join('   '), m + 4, y);
      doc.setTextColor(0, 0, 0);
      y += 5;
    }

    // Follow-up date
    if (enc.followUpDate) {
      doc.setFontSize(8);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(30, 64, 175);
      doc.text(`↳ Seguimiento: ${formatLocalDate(enc.followUpDate.split('T')[0])}`, m + 4, y);
      doc.setTextColor(0, 0, 0);
      y += 5;
    }

    // Separator (not after last)
    if (idx < encounters.length - 1) {
      y += 5;
      doc.setDrawColor(226, 232, 240);
      doc.line(m, y, W - m, y);
      y += 8;
    }
  }

  // Footer on every page
  const totalPages = (doc as any).internal.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFontSize(7);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(160, 160, 160);
    doc.text(`tusalud.pro — Generado el ${new Date().toLocaleDateString('es-MX')}`, m, H - 8);
    doc.text(`Página ${i} de ${totalPages}`, W - m, H - 8, { align: 'right' });
  }

  const slug = `${patient.firstName}-${patient.lastName}`.toLowerCase().replace(/\s+/g, '-');
  doc.save(`historial-${slug}.pdf`);
}
