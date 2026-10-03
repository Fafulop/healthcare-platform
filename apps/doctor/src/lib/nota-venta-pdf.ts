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
import { type AjustesRx, type DisenoReceta } from '@/lib/receta-pdf';
import { formatCurrency, formatDateLong } from '@/lib/practice-utils';
import { abrirHoja, cerrarHoja, type EmisorNota } from '@/lib/pdf-documento';

export type { EmisorNota } from '@/lib/pdf-documento';

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
  // Encabezado + consultorio: la hoja compartida con el resumen de tratamiento (`pdf-documento.ts`).
  const h = abrirHoja(jsPDF, emisor, diseno, rx, { grande: 'NOTA DE VENTA', subtitulo: `Folio ${venta.saleNumber}` });
  const { doc, pageW, margin, colW, narrow, noColor, maxContentY, topReset } = h;
  const [cr, cg, cb] = h.color;
  const pageH = h.pageH;
  let y = h.y;
  const checkPage = (needed: number) => {
    if (y + needed > maxContentY) { doc.addPage(); y = topReset; }
  };

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

  // ── NO ES CFDI + PIE ────────────────────────────────────────────────────
  return cerrarHoja(h, y, 'Este documento no es un comprobante fiscal (CFDI).', emisor, diseno, rx);
}
