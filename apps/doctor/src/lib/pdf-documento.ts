/**
 * La HOJA de los documentos del consultorio en PDF (jsPDF): encabezado, consultorio, leyenda y pie.
 * Salió de `nota-venta-pdf.ts` (TRATAMIENTOS v2 · V5, 2026-10-02) para que la «Nota de venta» y el
 * «Resumen de tratamiento» compartan EL MISMO diseño — el de la receta (logo, firma, color, cédulas,
 * ajustes de impresión de «Receta PDF») — sin copiarlo. Cada documento dibuja sólo su cuerpo.
 *
 * Uso: `const h = abrirHoja(...)` (dibuja encabezado + consultorio y deja `h.y` donde sigue el
 * cuerpo) → el cuerpo → `cerrarHoja(h, y, leyenda, ...)` (la leyenda y el pie en todas las hojas).
 *
 * BLOQUE DE IDENTIDAD (2026-10-05, a pedido del usuario): todo documento clínico lleva SIEMPRE el
 * nombre del médico, su(s) cédula(s) profesional(es) y la fecha del documento (`titulo.fecha`). Con
 * encabezado van en el encabezado; SIN encabezado (hoja membretada) van en un renglón al inicio del
 * cuerpo — antes se perdían con la banda (H-048). No se apaga desde los ajustes, y no se evita que
 * una plantilla repita esos datos: si lo hace, salen dos veces y el médico la corrige.
 */
import type { jsPDF as JsPDF } from 'jspdf';
import { RX_PAGE_FORMATS } from '@/types/pdf-settings';
import { COLOR_MAP, renglonIdentidad, type AjustesRx, type DisenoReceta } from '@/lib/receta-pdf';

/** Quién firma y dónde: del diseño de la receta + el consultorio PRINCIPAL del perfil. */
export interface EmisorNota {
  doctorFullName: string;
  /** `[{ titulo, cedula }]` de «Receta PDF»; vacío → cae a `cedulaProfesional`. */
  credentials: { titulo: string; cedula: string }[];
  cedulaProfesional: string | null;
  clinicAddress: string | null;
  clinicPhone: string | null;
}

export interface Hoja {
  doc: JsPDF;
  pageW: number;
  pageH: number;
  margin: number;
  colW: number;
  narrow: boolean;
  noColor: boolean;
  color: [number, number, number];
  footerY: number;
  footerH: number;
  maxContentY: number;
  topReset: number;
  credLines: string[];
  /** Dónde empieza el cuerpo (debajo del encabezado y del consultorio). */
  y: number;
}

/** Abre el documento y dibuja el encabezado (sólo en la primera hoja) y el consultorio. */
export function abrirHoja(
  jsPDF: typeof JsPDF,
  emisor: EmisorNota,
  diseno: DisenoReceta,
  rx: AjustesRx,
  titulo: {
    grande: string; subtitulo: string;
    /** Hoja angosta (media carta / A5): el título largo deja sin lugar al nombre del médico. */
    grandeAngosto?: string; subtituloAngosto?: string;
    /** La fecha DEL DOCUMENTO, ya formateada (la de la visita, la de la receta…); parte del bloque de identidad. */
    fecha?: string;
  },
): Hoja {
  const { colorScheme, logoB64 } = diseno;
  const noColor = colorScheme === 'none';
  const [cr, cg, cb] = noColor ? [0, 0, 0] : (COLOR_MAP[colorScheme] ?? COLOR_MAP.blue);

  const doc = new jsPDF({ unit: 'mm', format: RX_PAGE_FORMATS[rx.pageSize] ?? 'a4', orientation: rx.orientation });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 14;
  const colW = pageW - margin * 2;
  const narrow = pageW < 180;
  const footerH = rx.showFooter ? 22 : 0;
  const grande = narrow && titulo.grandeAngosto ? titulo.grandeAngosto : titulo.grande;
  const subtitulo = narrow && titulo.subtituloAngosto !== undefined ? titulo.subtituloAngosto : titulo.subtitulo;

  // Mismo guardia que la receta: márgenes de membrete grandes en hoja chica no deben dejar el área
  // de contenido en cero (addPage sin fin).
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

  const credLines = (emisor.credentials.length
    ? emisor.credentials.map((c) => `${c.titulo} — Céd. ${c.cedula}`)
    : emisor.cedulaProfesional ? [`Cédula Profesional: ${emisor.cedulaProfesional}`] : []
  ).slice(0, 4);

  // ── ENCABEZADO (sólo la primera hoja, como la receta) ───────────────────
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
        const logoSize = narrow ? 18 : 25;
        doc.addImage(logoB64, fmt, margin, narrow ? 8 : 5, logoSize, logoSize);
      } catch {}
    }
    const t = noColor ? 30 : 255;
    doc.setTextColor(t, t, t);
    doc.setFont('helvetica', 'bold');
    // Narrow pages (media carta / A5): a centered title runs into the doctor's name on the right
    // (seen in the half-letter render), so it goes left, after the logo.
    const tituloX = narrow ? margin + (logoB64 ? 22 : 0) : pageW / 2;
    const tituloAlign = narrow ? 'left' : 'center';
    doc.setFontSize(narrow ? 13 : 18);
    doc.text(grande, tituloX, 15, { align: tituloAlign });
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(narrow ? 8 : 9);
    if (subtitulo) doc.text(subtitulo, tituloX, 21, { align: tituloAlign });
    // Fecha abajo a la izquierda de la banda (debajo del logo): centrada chocaba con cédulas largas.
    if (titulo.fecha) { doc.setFontSize(7.5); doc.text(titulo.fecha, margin, 32); }

    // The right block may only use what the title leaves free; a long name or credential shrinks
    // (down to 6 pt) instead of running into the title on narrow pages.
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(narrow ? 13 : 18);
    // Only narrow pages: on wide ones the centered title sits ABOVE the name/credentials (no overlap).
    const libre = narrow ? pageW - margin - (tituloX + doc.getTextWidth(grande)) - 4 : Infinity;
    const ajustado = (text: string, size: number) => {
      doc.setFontSize(size);
      let s = size;
      while (s > 6 && doc.getTextWidth(text) > libre) doc.setFontSize((s -= 0.5));
    };
    doc.setFont('helvetica', 'bold');
    ajustado(emisor.doctorFullName, 9);
    doc.text(emisor.doctorFullName, pageW - margin, 18, { align: 'right' });
    doc.setFont('helvetica', 'normal');
    credLines.forEach((line, i) => {
      ajustado(line, 7);
      doc.text(line, pageW - margin, 22.5 + i * 3.2, { align: 'right' });
    });
    y = 40 + topMarginMm;
  } else {
    y = topReset;
    doc.setTextColor(cr, cg, cb);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    // Sin membrete el título va en el cuerpo: se parte en renglones si no cabe (un nombre largo de
    // tratamiento se salía de la hoja). Un texto que cabe se escribe igual que antes.
    const linea = subtitulo ? `${grande} · ${subtitulo}` : grande;
    const lineas = doc.splitTextToSize(linea, colW) as string[];
    doc.text(lineas.length > 1 ? lineas : linea, margin, y);
    y += 8 + (lineas.length - 1) * 6;
    // Bloque de identidad sin banda: médico · cédula(s) · fecha (con el pie puesto, sólo la fecha).
    y = renglonIdentidad(doc, emisor.doctorFullName, credLines, titulo.fecha, margin, colW, y, rx.showFooter);
  }

  // ── CONSULTORIO (el principal del perfil) ───────────────────────────────
  const consultorio = [emisor.clinicAddress?.trim(), emisor.clinicPhone?.trim() && `Tel. ${emisor.clinicPhone.trim()}`]
    .filter(Boolean).join('  ·  ');
  if (consultorio) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(90, 90, 90);
    const lines = doc.splitTextToSize(consultorio, colW);
    doc.text(lines, margin, y);
    y += lines.length * 3.6 + 3;
  }

  return {
    doc, pageW, pageH, margin, colW, narrow, noColor, color: [cr, cg, cb],
    footerY, footerH, maxContentY, topReset, credLines, y,
  };
}

/** La leyenda final (p. ej. «no es un CFDI») en `y`, y el pie con firma en TODAS las hojas. */
export function cerrarHoja(
  h: Hoja, y: number, leyenda: string, emisor: EmisorNota, diseno: DisenoReceta, rx: AjustesRx,
): JsPDF {
  const { doc, pageW, margin, noColor, footerY, footerH, credLines } = h;
  const [cr, cg, cb] = h.color;
  const { sigB64 } = diseno;

  // Sin leyenda no se escribe nada (y no se abre una hoja en blanco sólo para un texto vacío).
  if (leyenda) {
    if (y + 6 > h.maxContentY) { doc.addPage(); y = h.topReset; }
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(7);
    doc.setTextColor(120, 120, 120);
    doc.text(leyenda, margin, y);
  }

  // ── PIE (todas las hojas, como la receta) ───────────────────────────────
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
      const t = noColor ? 30 : 255;
      doc.setTextColor(t, t, t);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      doc.text(emisor.doctorFullName, margin, footerY + 7);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(6.5);
      credLines.forEach((line, i) => doc.text(line, margin, footerY + 10.5 + i * 2.9));
      if (sigB64) {
        doc.setFontSize(7);
        doc.setFont('helvetica', 'italic');
        doc.text('Firma del médico', pageW - margin, footerY + 20.5, { align: 'right' });
      }
    }
  }
  return doc;
}
