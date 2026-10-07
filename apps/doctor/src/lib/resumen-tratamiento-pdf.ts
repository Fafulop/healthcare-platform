/**
 * «Resumen de tratamiento» en PDF (jsPDF) — TRATAMIENTOS v2 · V5 (06-PLAN §7, decisión 7).
 *
 * Misma hoja que la nota de venta y la receta (`pdf-documento.ts`: logo, firma, color, cédulas,
 * ajustes de impresión). El cuerpo: el paciente y el tratamiento, una fila por sesión (las canceladas
 * en gris, sin importe), los totales de la CUENTA tal como los calcula el servidor
 * (`cuentaDelTratamiento` — aquí no se suma nada que el servidor no haya sumado, regla 0) y las ventas
 * de las visitas de sus sesiones APARTE (decisión 5). Es un documento informativo: no toca Flujo de
 * Dinero y no es un comprobante.
 *
 * UNA sola función de dibujo para la vista previa y la descarga (`DocumentoPdfModal`).
 */
import type { jsPDF as JsPDF } from 'jspdf';
import { type AjustesRx, type DisenoReceta } from '@/lib/receta-pdf';
import { formatCurrency, formatDateLong } from '@/lib/practice-utils';
import { abrirHoja, cerrarHoja, type EmisorNota } from '@/lib/pdf-documento';
import { formatoFechaVisita } from '@/lib/visitas-ui';

export interface ResumenTratamientoDatos {
  tratamiento: { nombre: string; estado: string; sesionesPlaneadas: number | null };
  paciente: string;
  /** 'YYYY-MM-DD' de hoy (México): la fecha del resumen. */
  fecha: string;
  sesiones: {
    etiqueta: string;
    /** 'YYYY-MM-DD' (la de su cita o su visita) o null. */
    fecha: string | null;
    hora: string | null;
    servicio: string | null;
    estado: string;
    cancelada: boolean;
    /** Lo cobrado, o su precio si aún no se cobra; null = sin precio. */
    importe: number | null;
    cobrada: boolean;
    pagado: number;
    folio: string | null;
  }[];
  cuenta: {
    total: number; pagado: number; pendiente: number; cobradoDeMas: number;
    cobradoEnCanceladas: number; sinPrecio: number;
  };
  ventas: { folio: string; fecha: string; total: number; pagado: number }[];
  ventasTotal: { total: number; pagado: number };
}

const ESTADO_TRATAMIENTO: Record<string, string> = { activo: 'Activo', terminado: 'Terminado', cancelado: 'Cancelado' };

export function nombreArchivoResumen(d: Pick<ResumenTratamientoDatos, 'tratamiento' | 'paciente'>) {
  const limpio = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^\w-]+/g, '_').slice(0, 40);
  return `resumen-tratamiento_${limpio(d.tratamiento.nombre)}_${limpio(d.paciente)}.pdf`;
}

/** 'YYYY-MM-DD' → «2 de octubre de 2026» (formatDateLong arma la fecha LOCAL: sin brinco de día). */
const fechaLarga = (d: string) => formatDateLong(d.slice(0, 10));
/** 'YYYY-MM-DD' → «2 oct 2026» (tablas: la columna es angosta). */
const fechaCorta = (d: string) => formatoFechaVisita(d.slice(0, 10));

export function dibujarResumenTratamiento(
  jsPDF: typeof JsPDF,
  autoTable: (doc: JsPDF, options: any) => void,
  d: ResumenTratamientoDatos,
  emisor: EmisorNota,
  diseno: DisenoReceta,
  rx: AjustesRx,
): JsPDF {
  // El nombre del tratamiento va en la caja (se parte en renglones): en el encabezado chocaba con el
  // nombre del médico en hoja angosta.
  const h = abrirHoja(jsPDF, emisor, diseno, rx, {
    grande: 'RESUMEN DE TRATAMIENTO', subtitulo: '', grandeAngosto: 'RESUMEN', subtituloAngosto: 'de tratamiento',
  });
  const { doc, pageW, pageH, margin, colW, narrow, noColor, maxContentY, topReset } = h;
  const [cr, cg, cb] = h.color;
  let y = h.y;
  const checkPage = (needed: number) => {
    if (y + needed > maxContentY) { doc.addPage(); y = topReset; }
  };

  // ── CAJA: paciente · tratamiento · fecha ────────────────────────────────
  const halfW = colW / 2 - 8;
  const midX = margin + colW / 2 + 4;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  const nombre = doc.splitTextToSize(d.paciente, halfW) as string[];
  const trat = doc.splitTextToSize(d.tratamiento.nombre, halfW) as string[];
  const alto = Math.max(nombre.length, trat.length) * 4.6;
  const planeadas = d.tratamiento.sesionesPlaneadas;
  // Como la pantalla: las canceladas aparte (si no, «7 sesiones de 6 planeadas»).
  const vivas = d.sesiones.filter((s) => !s.cancelada).length;
  const canceladas = d.sesiones.length - vivas;
  const estadoTxt = [ESTADO_TRATAMIENTO[d.tratamiento.estado] ?? d.tratamiento.estado,
    `${vivas} ${vivas === 1 ? 'sesión' : 'sesiones'}${planeadas ? ` de ${planeadas} planeadas` : ''}`
      + (canceladas ? ` (+${canceladas} ${canceladas === 1 ? 'cancelada' : 'canceladas'})` : '')].join(' · ');
  // Los renglones chicos también se parten: en media carta se salían de la caja.
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  const izq = doc.splitTextToSize(`Fecha del resumen: ${fechaLarga(d.fecha)}`, halfW) as string[];
  const der = doc.splitTextToSize(estadoTxt, halfW) as string[];
  const chicos = Math.max(izq.length, der.length) * 3.6;
  const boxH = Math.max(24, 16 + alto + chicos);
  checkPage(boxH + 6);
  doc.setFillColor(245, 247, 250);
  doc.roundedRect(margin, y, colW, boxH, 2, 2, 'F');
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(100, 100, 100);
  doc.text('Paciente', margin + 4, y + 6);
  doc.text('Tratamiento', midX, y + 6);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(20, 20, 20);
  doc.text(nombre, margin + 4, y + 12.5);
  doc.text(trat, midX, y + 12.5);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(100, 100, 100);
  doc.text(izq, margin + 4, y + 12.5 + alto + 1.5);
  doc.text(der, midX, y + 12.5 + alto + 1.5);
  y += boxH + 6;

  // ── SESIONES ────────────────────────────────────────────────────────────
  // Hoja angosta (media carta / A5): «Importe» y «Pagado» van en UNA columna y la sesión sólo con su
  // número — con 7 columnas el servicio quedaba de 1 cm y partía las palabras a la mitad.
  type Fila = ResumenTratamientoDatos['sesiones'][number];
  const importe = (s: Fila) =>
    s.cancelada ? '—' : s.importe === null ? 'Sin precio' : `${formatCurrency(s.importe)}${s.cobrada ? '' : '\n(precio)'}`;
  const pagado = (s: Fila) => (s.pagado > 0 ? formatCurrency(s.pagado) : '—');
  const head = narrow
    ? ['#', 'Fecha', 'Servicio', 'Estado', 'Importe / pagado', 'Nota']
    : ['Sesión', 'Fecha', 'Servicio', 'Estado', 'Importe', 'Pagado', 'Nota'];
  const body = d.sesiones.map((s, i) => [
    narrow ? String(i + 1) : s.etiqueta,
    s.fecha ? `${fechaCorta(s.fecha)}${s.hora ? `\n${s.hora}` : ''}` : '—',
    s.servicio || '—',
    s.estado,
    ...(narrow
      ? [s.pagado > 0 ? `${importe(s)}\npagado ${pagado(s)}` : importe(s)]
      : [importe(s), pagado(s)]),
    s.folio || '—',
  ]);
  const numericas = narrow ? [4] : [4, 5];
  const alinear = (i: number) => (numericas.includes(i) ? 'right' : 'left');
  autoTable(doc, {
    startY: y,
    head: [head.map((content, i) => ({ content, styles: { halign: alinear(i) } }))],
    body,
    margin: { left: margin, right: margin, top: topReset, bottom: pageH - maxContentY },
    styles: { fontSize: narrow ? 7 : 8, cellPadding: 1.8, textColor: [30, 30, 30] },
    headStyles: noColor
      ? { fillColor: [245, 245, 245], textColor: [30, 30, 30], fontStyle: 'bold' }
      : { fillColor: [cr, cg, cb], textColor: [255, 255, 255], fontStyle: 'bold' },
    columnStyles: narrow
      ? {
          0: { cellWidth: 8 },
          1: { cellWidth: 17 },
          3: { cellWidth: 17 },
          4: { halign: 'right', cellWidth: 23 },
          // H-072: en 17 mm el folio se partía a media palabra («ING-2026-3» / «96»); 22 mm caben a
          // 7 pt. La diferencia la cede el servicio, que se parte por palabras.
          5: { cellWidth: 22 },
        }
      : {
          0: { cellWidth: 22 },
          4: { halign: 'right', cellWidth: 24 },
          5: { halign: 'right', cellWidth: 22 },
          6: { cellWidth: 22 },
        },
    // Las canceladas, en gris: siguen en la historia, pero no cuentan.
    didParseCell: (data: any) => {
      if (data.section === 'body' && d.sesiones[data.row.index]?.cancelada) {
        data.cell.styles.textColor = [150, 150, 150];
        data.cell.styles.fontStyle = 'italic';
      }
    },
  });
  y = (doc as any).lastAutoTable.finalY + 8;

  // ── TOTALES (los de la cuenta, del servidor) ────────────────────────────
  const etiquetaX = pageW - margin - (narrow ? 75 : 80);
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
  const c = d.cuenta;
  checkPage(20); // total · pagado · pendiente, juntos
  renglon(narrow ? 'Total de las sesiones' : 'TOTAL DE LAS SESIONES', formatCurrency(c.total),
    { bold: true, size: narrow ? 10 : 11, color: noColor ? undefined : [cr, cg, cb] });
  renglon('Pagado', formatCurrency(c.pagado));
  if (c.cobradoDeMas > 0) renglon('Cobrado de más', formatCurrency(c.cobradoDeMas));
  else renglon('Pendiente', formatCurrency(c.pendiente), c.pendiente > 0.005 ? { color: [185, 28, 28] } : undefined);
  const notas: string[] = [];
  if (c.sinPrecio > 0) {
    notas.push(`${c.sinPrecio} ${c.sinPrecio === 1 ? 'sesión no tiene precio y no entra' : 'sesiones no tienen precio y no entran'} al total.`);
  }
  if (c.cobradoEnCanceladas > 0) {
    notas.push(`Cobrado en sesiones canceladas: ${formatCurrency(c.cobradoEnCanceladas)} (no se descuenta de lo pendiente).`);
  }
  notas.push('Importe = lo cobrado en las sesiones ya cobradas; su precio en las demás.');
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(100, 100, 100);
  for (const n of notas) {
    for (const line of doc.splitTextToSize(n, colW) as string[]) {
      checkPage(4.5);
      doc.text(line, margin, y);
      y += 3.8;
    }
  }
  y += 4;

  // ── VENTAS (aparte: no entran al total de las sesiones) ─────────────────
  if (d.ventas.length > 0) {
    checkPage(14);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(cr, cg, cb);
    doc.text('Ventas en las visitas del tratamiento', margin, y);
    y += 2;
    autoTable(doc, {
      startY: y,
      head: [['Folio', 'Fecha', { content: 'Total', styles: { halign: 'right' } }, { content: 'Pagado', styles: { halign: 'right' } }]],
      body: d.ventas.map((v) => [v.folio, fechaCorta(v.fecha), formatCurrency(v.total), v.pagado > 0 ? formatCurrency(v.pagado) : '—']),
      margin: { left: margin, right: margin, top: topReset, bottom: pageH - maxContentY },
      styles: { fontSize: narrow ? 7 : 8, cellPadding: 1.8, textColor: [30, 30, 30] },
      headStyles: { fillColor: [245, 245, 245], textColor: [30, 30, 30], fontStyle: 'bold' },
      columnStyles: { 2: { halign: 'right' }, 3: { halign: 'right' } },
    });
    y = (doc as any).lastAutoTable.finalY + 6;
    checkPage(14); // los dos renglones juntos (un «Pagado» solo en otra hoja no se entiende)
    renglon('Total de las ventas', formatCurrency(d.ventasTotal.total), { bold: true });
    renglon('Pagado', formatCurrency(d.ventasTotal.pagado));
    y += 2;
  }

  return cerrarHoja(h, y, 'Resumen informativo: no es un comprobante fiscal (CFDI) ni un recibo.', emisor, diseno, rx);
}
