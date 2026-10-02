'use client';

/**
 * «Impresión» en Receta PDF: tamaño, orientación, encabezado/pie, márgenes y secciones — los MISMOS
 * controles que el diálogo de una receta (`RecetaPrintSettingsFields`), aquí junto a la vista previa.
 * Se guardan en `PATCH /api/doctor/pdf-settings`; la vista previa sigue lo que hay en pantalla.
 */

import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { DEFAULT_PDF_SETTINGS, type PdfSettings } from '@/types/pdf-settings';
import { RecetaPrintSettingsFields, camposRxParaGuardar } from '@/components/medical-records/RecetaPrintSettingsFields';

export function RecetaImpresionSection({ onCambio }: { onCambio?: (s: PdfSettings) => void }) {
  const [settings, setSettings] = useState<PdfSettings>(DEFAULT_PDF_SETTINGS);
  const [guardados, setGuardados] = useState<PdfSettings>(DEFAULT_PDF_SETTINGS);
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const r = await fetch('/api/doctor/pdf-settings');
        const d = await r.json();
        if (d.success) { setSettings(d.data); setGuardados(d.data); }
        else setError('No se pudo cargar la configuración de impresión');
      } catch {
        setError('No se pudo cargar la configuración de impresión');
      } finally {
        setCargando(false);
      }
    })();
  }, []);

  useEffect(() => { if (!cargando) onCambio?.(settings); }, [cargando, settings, onCambio]);

  const guardar = async () => {
    setGuardando(true);
    setError('');
    try {
      const r = await fetch('/api/doctor/pdf-settings', {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(camposRxParaGuardar(settings)),
      });
      const d = await r.json();
      if (d.success) { setSettings(d.data); setGuardados(d.data); }
      else setError(d.error || 'Error al guardar');
    } catch {
      setError('Error al guardar la configuración de impresión');
    } finally {
      setGuardando(false);
    }
  };

  if (cargando) {
    return <div className="flex items-center justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-blue-600" /></div>;
  }
  const cambios = JSON.stringify(camposRxParaGuardar(settings)) !== JSON.stringify(camposRxParaGuardar(guardados));

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-base font-semibold text-gray-900">Impresión</h2>
        <p className="text-sm text-gray-500 mt-1">Tamaño de papel, márgenes para hoja membretada y qué secciones lleva la receta.</p>
      </div>
      {error && <div className="p-2 bg-red-50 border border-red-200 rounded text-sm text-red-700">{error}</div>}
      <RecetaPrintSettingsFields settings={settings} onChange={setSettings} />
      <div className="flex items-center gap-3">
        <button
          onClick={guardar}
          disabled={guardando || !cambios}
          className={`flex items-center gap-1.5 px-4 py-2 text-sm rounded-lg font-medium ${cambios ? 'bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50' : 'bg-gray-100 text-gray-400 cursor-default'}`}
        >
          {guardando && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
          {guardando ? 'Guardando…' : cambios ? 'Guardar impresión' : 'Impresión guardada'}
        </button>
      </div>
    </div>
  );
}
