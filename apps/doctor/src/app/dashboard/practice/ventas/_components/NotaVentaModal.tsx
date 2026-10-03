'use client';

/**
 * «Nota de venta» — preview of the REAL PDF + download, via the shared `DocumentoPdfModal` (the same
 * jsPDF document for both, from `dibujarNotaVenta`, lib/nota-venta-pdf.ts). Used by a venta's page and
 * by a cita's «Nota» (`NotaCitaButton`).
 */
import { DocumentoPdfModal } from '@/components/pdf/DocumentoPdfModal';
import { dibujarNotaVenta, nombreArchivoNota, type NotaVentaDatos } from '@/lib/nota-venta-pdf';

export function NotaVentaModal({ venta, onClose }: { venta: NotaVentaDatos; onClose: () => void }) {
  return (
    <DocumentoPdfModal
      titulo={`Nota de venta · ${venta.saleNumber}`}
      nombreArchivo={nombreArchivoNota(venta)}
      queEs="la nota de venta"
      dibujar={(jsPDF, autoTable, emisor, diseno, rx) => dibujarNotaVenta(jsPDF, autoTable, venta, emisor, diseno, rx)}
      onClose={onClose}
    />
  );
}
