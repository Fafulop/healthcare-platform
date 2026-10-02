/**
 * La «Nota de venta» en PDF (jsPDF) — VENTAS PACIENTE paso 2 (docs/DESDE JUNIO/VENTAS PACIENTE/).
 *
 * UNA sola función de dibujo para la vista previa y la descarga, igual que `lib/receta-pdf.ts`: si cada
 * una dibujara la suya, la vista previa dejaría de parecerse a lo que se baja. Usa el MISMO diseño que
 * la receta (logo, firma, color, cédulas — «Receta PDF») y sus ajustes de impresión (tamaño de hoja,
 * orientación, márgenes de membrete, encabezado y pie); los interruptores propios de la receta
 * (diagnóstico, notas clínicas, caja del paciente) no aplican.
 *
 * NO es un CFDI: el pie lo dice, porque «factura» en esta app es la del SAT (Facturación).
 */
import type { jsPDF as JsPDF } from 'jspdf';
import { RX_PAGE_FORMATS } from '@/types/pdf-settings';
import { COLOR_MAP, type AjustesRx, type DisenoReceta } from '@/lib/receta-pdf';
import { formatCurrency, formatDateLong } from '@/lib/practice-utils';

/** Lo que el dibujo lee de una venta (montos como llegan de la API: strings decimales). */
export interface NotaVentaDatos {
  saleNumber: string;
  saleDate: string;
  status: string;
  paymentStatus: string;
  subtotal: string;
  tax: string | null;
  total: string;
  amountPaid: string;
  notes: string | null;
  termsAndConditions: string | null;
  deliveryDate?: string | null;
  /** Heading of the buyer box: «Paciente» (VENTAS PACIENTE paso 3) or «Cliente» (old sales). */
  etiquetaComprador?: string;
  client: {
    businessName: string;
    rfc: string | null;
    contactName?: string | null;
    email?: string | null;
    phone?: string | null;
    street?: string | null;
    city?: string | null;
    state?: string | null;
    postalCode?: string | null;
  };
  items: {
    description: string;
    sku: string | null;
    quantity: string;
    unit: string | null;
    unitPrice: string;
    discountRate: string | null;
    taxRate: string | null;
    subtotal: string;
  }[];
}

/** Quién firma y dónde: del diseño de la receta + el consultorio PRINCIPAL del perfil. */
export interface EmisorNota {
  doctorFullName: string;
  /** `[{ titulo, cedula }]` de «Receta PDF»; vacío → cae a `cedulaProfesional`. */
  credentials: { titulo: string; cedula: string }[];
  cedulaProfesional: string | null;
  clinicAddress: string | null;
  clinicPhone: string | null;
}

const PAGO: Record<string, string> = { PENDING: 'Pendiente', PARTIAL: 'Parcial', PAID: 'Pagada' };

/** `0.16` → `16%`; `0` → `0%` (la descarga vieja ponía «16%» a todo lo que fuera 0). */
const pct = (rate: string | null) => {
  const n = rate == null || rate === '' ? 0 : parseFloat(rate);
  return `${Number.isFinite(n) ? Math.round(n * 10000) / 100 : 0}%`;
};
/** `1.0000` → `1`; `2.5000` → `2.5`. */
const cantidad = (q: string) => String(parseFloat(q));

export function nombreArchivoNota(venta: Pick<NotaVentaDatos, 'saleNumber'>) {
  return `nota-de-venta_${venta.saleNumber.replace(/[^\w-]+/g, '_')}.pdf`;
}

/** Dibuja la nota y devuelve el documento (la descarga hace `.save`, la vista previa `.output`). */
export function dibujarNotaVenta(
  jsPDF: typeof JsPDF,
  autoTable: (doc: JsPDF, options: any) => void,
  venta: NotaVentaDatos,
  emisor: EmisorNota,
  diseno: DisenoReceta,
  rx: AjustesRx,
): JsPDF {
  const { colorScheme, logoB64, sigB64 } = diseno;
  const noColor = colorScheme === 'none';
  const [cr, cg, cb] = noColor ? [0, 0, 0] : (COLOR_MAP[colorScheme] ?? COLOR_MAP.blue);

  const doc = new jsPDF({ unit: 'mm', format: RX_PAGE_FORMATS[rx.pageSize] ?? 'a4', orientation: rx.orientation });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 14;
  const colW = pageW - margin * 2;
  const narrow = pageW < 180;
  const footerH = rx.showFooter ? 22 : 0;

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
  const checkPage = (needed: number) => {
    if (y + needed > maxContentY) { doc.addPage(); y = topReset; }
  };

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
    doc.text('NOTA DE VENTA', tituloX, 15, { align: tituloAlign });
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(narrow ? 8 : 9);
    doc.text(`Folio ${venta.saleNumber}`, tituloX, 21, { align: tituloAlign });

    // The right block may only use what the title leaves free; a long name or credential shrinks
    // (down to 6 pt) instead of running into the title on narrow pages.
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(narrow ? 13 : 18);
    // Only narrow pages: on wide ones the centered title sits ABOVE the name/credentials (no overlap).
    const libre = narrow ? pageW - margin - (tituloX + doc.getTextWidth('NOTA DE VENTA')) - 4 : Infinity;
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
    doc.text(`NOTA DE VENTA · Folio ${venta.saleNumber}`, margin, y);
    y += 8;
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

  // ── CAJA: cliente · fecha · pago ────────────────────────────────────────
  // The box grows with what it holds: the name WRAPS (never cut), then whatever contact data the
  // client has — the old «VENTA EN FIRME» export printed it, and B2B ventas still need it.
  const halfW = colW / 2 - 8;
  const midX = margin + colW / 2 + 4;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  const nombre = doc.splitTextToSize(venta.client.businessName, halfW) as string[];
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  const c = venta.client;
  const lugar = [c.street, c.city, c.state, c.postalCode].map((s) => s?.trim()).filter(Boolean).join(', ');
  const izquierda = [
    c.rfc && `RFC: ${c.rfc}`,
    c.contactName && `Contacto: ${c.contactName}`,
    c.phone && `Tel. ${c.phone}`,
    c.email,
    lugar,
  ].filter(Boolean).flatMap((s) => doc.splitTextToSize(s as string, halfW) as string[]);
  const cancelada = venta.status === 'CANCELLED';
  const derecha = [
    cancelada ? 'VENTA CANCELADA' : `Pago: ${PAGO[venta.paymentStatus] ?? venta.paymentStatus}`,
    venta.deliveryDate ? `Entrega: ${formatDateLong(venta.deliveryDate)}` : null,
  ].filter(Boolean) as string[];
  const nombreH = nombre.length * 4.6;
  const boxH = Math.max(22, 12.5 + nombreH + Math.max(izquierda.length, derecha.length) * 3.6);
  checkPage(boxH + 6);

  doc.setFillColor(245, 247, 250);
  doc.roundedRect(margin, y, colW, boxH, 2, 2, 'F');
  doc.setTextColor(100, 100, 100);
  doc.text(venta.etiquetaComprador ?? 'Cliente', margin + 4, y + 6);
  doc.text('Fecha', midX, y + 6);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(20, 20, 20);
  doc.text(nombre, margin + 4, y + 12.5);
  doc.text(formatDateLong(venta.saleDate), midX, y + 12.5);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(100, 100, 100);
  const baseY = y + 12.5 + nombreH + 1.5;
  izquierda.forEach((line, i) => doc.text(line, margin + 4, baseY + i * 3.6));
  derecha.forEach((line, i) => {
    if (cancelada && i === 0) doc.setTextColor(185, 28, 28);
    else doc.setTextColor(100, 100, 100);
    doc.text(line, midX, y + 12.5 + 4.6 + 1.5 + i * 3.6);
  });
  y += boxH + 6;

  // ── CONCEPTOS ───────────────────────────────────────────────────────────
  const conDescuento = venta.items.some((i) => parseFloat(i.discountRate || '0') > 0);
  const head = ['Concepto', 'Cant.', 'P. unit.', ...(conDescuento ? ['Desc.'] : []), 'IVA', 'Importe'];
  const body = venta.items.map((i) => [
    i.description + (i.sku ? `\nSKU: ${i.sku}` : ''),
    `${cantidad(i.quantity)}${i.unit ? ` ${i.unit}` : ''}`,
    formatCurrency(i.unitPrice),
    ...(conDescuento ? [pct(i.discountRate)] : []),
    pct(i.taxRate),
    formatCurrency(i.subtotal),
  ]);
  const ultima = head.length - 1;
  // Each heading aligned like its column (numbers right, short codes centered).
  const alinear = (i: number) => (i === 0 ? 'left' : i === 2 || i === ultima ? 'right' : 'center');
  autoTable(doc, {
    startY: y,
    head: [head.map((content, i) => ({ content, styles: { halign: alinear(i) } }))],
    body,
    // Las páginas que agregue la tabla respetan el membrete y el pie, igual que `checkPage`.
    margin: { left: margin, right: margin, top: topReset, bottom: pageH - maxContentY },
    styles: { fontSize: narrow ? 7.5 : 8.5, cellPadding: 2, textColor: [30, 30, 30] },
    headStyles: noColor
      ? { fillColor: [245, 245, 245], textColor: [30, 30, 30], fontStyle: 'bold' }
      : { fillColor: [cr, cg, cb], textColor: [255, 255, 255], fontStyle: 'bold' },
    columnStyles: {
      1: { halign: 'center', cellWidth: narrow ? 16 : 20 },
      2: { halign: 'right', cellWidth: narrow ? 20 : 26 },
      ...(conDescuento ? { 3: { halign: 'center', cellWidth: 12 } } : {}),
      [ultima - 1]: { halign: 'center', cellWidth: 12 },
      [ultima]: { halign: 'right', cellWidth: narrow ? 22 : 28 },
    },
  });
  y = (doc as any).lastAutoTable.finalY + 8;

  // ── TOTALES ─────────────────────────────────────────────────────────────
  const etiquetaX = pageW - margin - (narrow ? 52 : 70);
  const valorX = pageW - margin;
  const renglon = (label: string, value: string, opts?: { bold?: boolean; size?: number; color?: [number, number, number] }) => {
    checkPage(7);
    doc.setFont('helvetica', opts?.bold ? 'bold' : 'normal');
    doc.setFontSize(opts?.size ?? 9.5);
    doc.setTextColor(30, 30, 30);
    doc.text(label, etiquetaX, y);
    if (opts?.color) doc.setTextColor(...opts.color);
    doc.text(value, valorX, y, { align: 'right' });
    doc.setTextColor(30, 30, 30);
    y += opts?.size && opts.size > 10 ? 7 : 5.5;
  };
  renglon('Subtotal', formatCurrency(venta.subtotal));
  renglon('IVA', formatCurrency(venta.tax || 0));
  checkPage(8);
  doc.setDrawColor(200, 200, 200);
  doc.line(etiquetaX, y - 3, valorX, y - 3);
  y += 1.5;
  renglon('TOTAL', formatCurrency(venta.total), { bold: true, size: 12, color: noColor ? undefined : [cr, cg, cb] });
  const pagado = parseFloat(venta.amountPaid || '0');
  if (pagado > 0) {
    renglon('Pagado', formatCurrency(pagado));
    const saldo = parseFloat(venta.total) - pagado;
    renglon('Saldo', formatCurrency(saldo), saldo > 0.005 ? { color: [185, 28, 28] } : undefined);
  }
  y += 4;

  // ── NOTAS Y TÉRMINOS ────────────────────────────────────────────────────
  const bloque = (titulo: string, texto: string) => {
    checkPage(12);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(cr, cg, cb);
    doc.text(titulo, margin, y);
    y += 4.5;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(40, 40, 40);
    for (const line of doc.splitTextToSize(texto, colW) as string[]) {
      checkPage(5);
      doc.text(line, margin, y);
      y += 4;
    }
    y += 3;
  };
  if (venta.notes?.trim()) bloque('Notas', venta.notes.trim());
  if (venta.termsAndConditions?.trim()) bloque('Términos y condiciones', venta.termsAndConditions.trim());

  // ── NO ES CFDI ──────────────────────────────────────────────────────────
  checkPage(6);
  doc.setFont('helvetica', 'italic');
  doc.setFontSize(7);
  doc.setTextColor(120, 120, 120);
  doc.text('Este documento no es un comprobante fiscal (CFDI).', margin, y);

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
