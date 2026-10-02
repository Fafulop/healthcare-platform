'use client';

/**
 * Vista previa EN VIVO de la receta en «Receta PDF»: dibuja con la MISMA función que la descarga
 * (`dibujarReceta`, lib/receta-pdf.ts) sobre una receta de EJEMPLO (paciente y medicamentos de ejemplo,
 * con el nombre y las cédulas reales del doctor), con el diseño y la impresión tal como están en
 * pantalla — sin guardar. Así lo que se ve aquí es exactamente lo que se imprime.
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { ajustesRx, dibujarReceta, imagenABase64, type RecetaParaPdf } from '@/lib/receta-pdf';
import type { PdfSettings } from '@/types/pdf-settings';
import { getClinicDateString } from '@/lib/dates';
import type { DisenoEnPantalla } from './PrescriptionTemplateSection';

function recetaDeEjemplo(d: DisenoEnPantalla): RecetaParaPdf {
  const hoy = getClinicDateString();
  const [y, m, dd] = hoy.split('-').map(Number);
  const vence = new Date(Date.UTC(y, m - 1, dd + 30)).toISOString().slice(0, 10);
  // La misma regla que «Guardar Plantilla»: sólo los renglones con título Y cédula.
  const creds = d.credentials
    .map((c) => ({ titulo: c.titulo.trim(), cedula: c.cedula.trim() }))
    .filter((c) => c.titulo && c.cedula);
  return {
    prescriptionDate: hoy,
    expiresAt: vence,
    diagnosis: 'Faringitis aguda (ejemplo)',
    clinicalNotes: 'Ejemplo de notas clínicas: evolución de 3 días, sin fiebre. Así se verán tus notas en la receta.',
    doctorFullName: d.doctorName || 'Tu nombre',
    doctorLicense: creds[0]?.cedula || '0000000',
    doctorCredentials: creds.length ? creds : null,
    patient: { id: 'ejemplo', firstName: 'Paciente', lastName: 'de Ejemplo', internalId: 'P0000', dateOfBirth: '1985-05-14', sex: 'Femenino' },
    medications: [
      { drugName: 'Paracetamol', presentation: 'Tabletas 500 mg', dosage: '1 tableta', frequency: 'cada 8 horas', duration: '5 días', quantity: '15', instructions: 'Tomar con alimentos.', warnings: '' },
      { drugName: 'Amoxicilina', presentation: 'Cápsulas 500 mg', dosage: '1 cápsula', frequency: 'cada 8 horas', duration: '7 días', quantity: '21', instructions: 'Completar el tratamiento aunque se sienta mejor.', warnings: 'Suspender si hay ronchas.' },
    ] as RecetaParaPdf['medications'],
    imagingStudies: [],
    labStudies: [],
    customData: null,
    template: null,
  };
}

export function RecetaVistaPrevia({ diseno, impresion }: { diseno: DisenoEnPantalla | null; impresion: PdfSettings | null }) {
  const [url, setUrl] = useState<string | null>(null);
  const [error, setError] = useState(false);
  const [dibujando, setDibujando] = useState(false);
  const imagenes = useRef(new Map<string, string | null>()); // url → base64 (no se vuelve a bajar)
  const urlAnterior = useRef<string | null>(null);

  // Lo que cambia la receta; el dibujo espera ~400 ms a que se dejen de mover los controles.
  const clave = useMemo(() => JSON.stringify({ diseno, impresion }), [diseno, impresion]);

  useEffect(() => {
    if (!diseno || !impresion) return;
    let vigente = true;
    const t = setTimeout(async () => {
      setDibujando(true);
      try {
        const rx = ajustesRx(impresion);
        const b64 = async (u: string | null) => {
          if (!u) return null;
          if (!imagenes.current.has(u)) imagenes.current.set(u, await imagenABase64(u));
          return imagenes.current.get(u) ?? null;
        };
        const [logoB64, sigB64] = await Promise.all([
          rx.showLogo ? b64(diseno.logoUrl) : Promise.resolve(null),
          rx.showSignature ? b64(diseno.signatureUrl) : Promise.resolve(null),
        ]);
        const { default: jsPDF } = await import('jspdf');
        const doc = dibujarReceta(jsPDF, recetaDeEjemplo(diseno), { colorScheme: diseno.colorScheme, logoB64, sigB64 }, rx);
        const nueva = URL.createObjectURL(doc.output('blob'));
        if (!vigente) { URL.revokeObjectURL(nueva); return; }
        if (urlAnterior.current) URL.revokeObjectURL(urlAnterior.current);
        urlAnterior.current = nueva;
        setUrl(nueva);
        setError(false);
      } catch {
        if (vigente) setError(true);
      } finally {
        if (vigente) setDibujando(false);
      }
    }, 400);
    return () => { vigente = false; clearTimeout(t); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clave]);

  useEffect(() => () => { if (urlAnterior.current) URL.revokeObjectURL(urlAnterior.current); }, []);

  return (
    <div className="rounded-lg border border-gray-200 bg-white overflow-hidden">
      <div className="flex items-center justify-between px-3 py-2 border-b border-gray-100 text-xs text-gray-500">
        <span>Vista previa — receta de ejemplo (aún sin guardar)</span>
        {dibujando && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
      </div>
      {error ? (
        <p className="p-6 text-sm text-red-700">No se pudo dibujar la vista previa. Revisa el logo o la firma (¿la imagen se puede abrir?).</p>
      ) : url ? (
        <>
          <iframe title="Vista previa de la receta" src={`${url}#toolbar=0&navpanes=0&view=FitH`} className="w-full h-[78vh] bg-gray-100" />
          {/* Chrome de Android no pinta un PDF dentro de la página (iOS sólo la 1.ª hoja): en otra pestaña sí. */}
          <a href={url} target="_blank" rel="noopener noreferrer" className="block px-3 py-2 text-xs text-blue-600 hover:underline border-t border-gray-100">
            Abrir en otra pestaña
          </a>
        </>
      ) : (
        <div className="flex h-[40vh] items-center justify-center"><Loader2 className="w-6 h-6 animate-spin text-blue-600" /></div>
      )}
    </div>
  );
}
