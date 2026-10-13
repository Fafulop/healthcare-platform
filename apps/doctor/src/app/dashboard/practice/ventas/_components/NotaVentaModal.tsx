'use client';

/**
 * «Nota de venta» — preview of the REAL PDF + download, via the shared `DocumentoPdfModal` (the same
 * jsPDF document for both, from `dibujarNotaVenta`, lib/nota-venta-pdf.ts). Used by a venta's page and
 * by a cita's «Nota» (`NotaCitaButton`).
 */
import { DocumentoPdfModal, type EnvioDocumento } from '@/components/pdf/DocumentoPdfModal';
import { dibujarNotaVenta, nombreArchivoNota, type NotaVentaDatos } from '@/lib/nota-venta-pdf';

export function NotaVentaModal({ venta, envio, onClose }: { venta: NotaVentaDatos; envio?: EnvioDocumento; onClose: () => void }) {
  return (
    <DocumentoPdfModal
      titulo={`Nota de venta · ${venta.saleNumber}`}
      nombreArchivo={nombreArchivoNota(venta)}
      queEs="la nota de venta"
      dibujar={(jsPDF, autoTable, emisor, diseno, rx) => dibujarNotaVenta(jsPDF, autoTable, venta, emisor, diseno, rx)}
      envio={envio}
      onClose={onClose}
    />
  );
}
