'use client';

/**
 * «Nota de venta» — preview of the REAL PDF + download. Both come from the same `dibujarNotaVenta`
 * (lib/nota-venta-pdf.ts) and the same jsPDF document, so what is previewed is what downloads.
 *
 * Design (logo, signature, color, credentials, main consultorio) comes from /api/prescription-template,
 * which is OWNER_ONLY on purpose (route-permissions: «Receta PDF identity — owner-only always»). A
 * helper gets the nota WITHOUT signature/logo/address — same as a receta they download — and the
 * modal says so instead of printing a silently different sheet.
 *
 * Two phases: LOAD once (template, print settings, images, jsPDF), then DRAW — again only if the
 * doctor's profile arrives later (a helper takes the doctor's name/phone from it when the template
 * 403s). The preview URL and the document swap only when the new drawing is ready, so «Descargar»
 * and «Abrir en otra pestaña» never act on a stale or revoked one.
 */
import { useEffect, useRef, useState } from 'react';
import { Download, Loader2, X } from 'lucide-react';
import type { jsPDF as JsPDF } from 'jspdf';
import { useDoctorProfile } from '@/contexts/DoctorProfileContext';
import { DEFAULT_PDF_SETTINGS, type PdfSettings } from '@/types/pdf-settings';
import { ajustesRx, imagenABase64, type AjustesRx } from '@/lib/receta-pdf';
import { dibujarNotaVenta, nombreArchivoNota, type EmisorNota, type NotaVentaDatos } from '@/lib/nota-venta-pdf';
import { toast } from '@/lib/practice-toast';

// url → base64 for the logo/signature, shared by every opening in this page session. A failed
// download (null — network error or HTTP error, see imagenABase64) is dropped so the next opening
// retries instead of printing without logo/signature until a reload.
const imagenes = new Map<string, Promise<string | null>>();
const imagen = (u: string) => {
  if (!imagenes.has(u)) {
    const p = imagenABase64(u);
    imagenes.set(u, p);
    p.then((b64) => { if (b64 === null) imagenes.delete(u); });
  }
  return imagenes.get(u)!;
};

interface Cargado {
  template: Record<string, any> | null;
  templateStatus: number | null;
  ajustesOk: boolean;
  rx: AjustesRx;
  logoB64: string | null;
  sigB64: string | null;
  jsPDF: typeof JsPDF;
  autoTable: (doc: JsPDF, options: any) => void;
}

export function NotaVentaModal({ venta, onClose }: { venta: NotaVentaDatos; onClose: () => void }) {
  const { doctorProfile } = useDoctorProfile();
  const [cargado, setCargado] = useState<Cargado | null>(null);
  const [url, setUrl] = useState<string | null>(null);
  const [error, setError] = useState(false);
  const docRef = useRef<JsPDF | null>(null);
  const urlActual = useRef<string | null>(null);

  // ── 1. LOAD (once) ───────────────────────────────────────────────────
  useEffect(() => {
    let vigente = true;
    (async () => {
      try {
        const [templateRes, settingsRes] = await Promise.all([
          fetch('/api/prescription-template').catch(() => null),
          fetch('/api/doctor/pdf-settings').catch(() => null),
        ]);
        const template = templateRes?.ok ? (await templateRes.json()).data ?? {} : null;
        const settingsJson = settingsRes?.ok ? await settingsRes.json() : null;
        const settings: PdfSettings = settingsJson?.success ? settingsJson.data : DEFAULT_PDF_SETTINGS;
        const rx = ajustesRx(settings);
        const logoUrl: string | null = template?.prescriptionLogoUrl || null;
        const sigUrl: string | null = template?.prescriptionSignatureUrl || null;
        const [logoB64, sigB64, { default: jsPDF }, { default: autoTable }] = await Promise.all([
          logoUrl && rx.showLogo ? imagen(logoUrl) : Promise.resolve(null),
          sigUrl && rx.showSignature ? imagen(sigUrl) : Promise.resolve(null),
          import('jspdf'),
          import('jspdf-autotable'),
        ]);
        if (!vigente) return;
        setCargado({
          template, templateStatus: templateRes?.status ?? null, ajustesOk: !!settingsJson?.success,
          rx, logoB64, sigB64, jsPDF, autoTable: autoTable as Cargado['autoTable'],
        });
      } catch (err) {
        console.error('Error loading nota de venta design:', err);
        if (vigente) setError(true);
      }
    })();
    return () => { vigente = false; };
    // The sale is fixed while the modal is open.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── 2. DRAW (after loading; again if the profile fallback changes) ───
  const nombrePerfil = doctorProfile?.doctorFullName || '';
  const telPerfil = doctorProfile?.clinicPhone || '';
  const emisor: EmisorNota | null = cargado && {
    doctorFullName: cargado.template?.doctorFullName || nombrePerfil,
    credentials: Array.isArray(cargado.template?.prescriptionCredentials)
      ? (cargado.template!.prescriptionCredentials as { titulo?: string; cedula?: string }[])
          .filter((c) => c?.titulo && c?.cedula)
          .map((c) => ({ titulo: String(c.titulo), cedula: String(c.cedula) }))
      : [],
    cedulaProfesional: cargado.template?.cedulaProfesional || null,
    clinicAddress: cargado.template?.clinicAddress || null,
    clinicPhone: cargado.template?.clinicPhone || telPerfil || null,
  };

  useEffect(() => {
    if (!cargado || !emisor) return;
    try {
      const doc = dibujarNotaVenta(
        cargado.jsPDF, cargado.autoTable, venta, emisor,
        { colorScheme: cargado.template?.prescriptionColorScheme || 'blue', logoB64: cargado.logoB64, sigB64: cargado.sigB64 },
        cargado.rx,
      );
      const nueva = URL.createObjectURL(doc.output('blob'));
      // Swap only now that the new one exists, then free the old one.
      const anterior = urlActual.current;
      urlActual.current = nueva;
      docRef.current = doc;
      setUrl(nueva);
      setError(false);
      if (anterior) URL.revokeObjectURL(anterior);
    } catch (err) {
      console.error('Error drawing nota de venta:', err);
      setError(true);
    }
    // `emisor` is derived from these; drawing on every render would redraw for nothing.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cargado, nombrePerfil, telPerfil]);

  useEffect(() => () => { if (urlActual.current) URL.revokeObjectURL(urlActual.current); }, []);

  const descargar = () => {
    if (!docRef.current) return;
    try {
      docRef.current.save(nombreArchivoNota(venta));
    } catch {
      toast.error('No se pudo descargar la nota de venta');
    }
  };

  // What the sheet is missing, said out loud (never a silently different document).
  const avisos: string[] = [];
  if (cargado && !cargado.template) {
    avisos.push(cargado.templateStatus === 403
      ? 'Sin logo, firma ni dirección: el diseño de «Receta PDF» sólo lo carga el titular de la cuenta.'
      : 'No se pudo cargar el diseño de «Receta PDF» (logo, firma, dirección): esta nota sale sin él. Cierra y vuelve a abrirla para reintentar.');
  }
  if (cargado && !cargado.ajustesOk) {
    avisos.push('No se cargaron los ajustes de impresión: la nota usa los de fábrica (A4, sin márgenes de membrete; logo y firma visibles si los hay). Si imprimes en hoja membretada, pídele al titular que la descargue.');
  }
  if (emisor && !emisor.doctorFullName) {
    avisos.push('No se pudo obtener el nombre del médico: la nota sale sin él.');
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-2 sm:p-4">
      <div className="bg-white rounded-xl shadow-lg w-full max-w-3xl h-[92vh] flex flex-col overflow-hidden">
        <div className="flex items-center justify-between gap-3 px-4 sm:px-5 py-3 border-b border-gray-100">
          <h2 className="text-lg font-semibold text-gray-900">Nota de venta · {venta.saleNumber}</h2>
          <div className="flex items-center gap-2">
            <button
              onClick={descargar}
              disabled={!url || error}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 text-sm font-semibold"
            >
              <Download className="w-4 h-4" />Descargar
            </button>
            <button onClick={onClose} className="p-1 rounded hover:bg-gray-100 text-gray-500" aria-label="Cerrar">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {avisos.map((aviso) => (
          <p key={aviso} className="mx-4 sm:mx-5 mt-3 text-sm text-amber-900 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
            {aviso}
          </p>
        ))}

        <div className="flex-1 min-h-0 p-3 sm:p-4 bg-gray-100 flex flex-col gap-2">
          {error ? (
            <p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
              No se pudo generar la nota de venta. Cierra y vuelve a intentarlo.
            </p>
          ) : url ? (
            <>
              <iframe src={`${url}#view=FitH`} title="Vista previa de la nota de venta" className="w-full flex-1 min-h-0 bg-white rounded border border-gray-200" />
              {/* Same fallback as the receta preview: Android Chrome doesn't render a PDF inside the page
                  (iOS shows only page 1); a new tab does. */}
              <a href={url} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-600 hover:underline">
                Abrir en otra pestaña
              </a>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center text-gray-500 gap-2">
              <Loader2 className="w-5 h-5 animate-spin" />Generando la nota…
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
