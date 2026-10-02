'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { X, Loader2, Eye } from 'lucide-react';
import type { PdfSettings } from '@/types/pdf-settings';
import { DEFAULT_PDF_SETTINGS } from '@/types/pdf-settings';
import { usePermissions } from '@/lib/permissions-client';
import { RecetaPrintSettingsFields, camposRxParaGuardar } from './RecetaPrintSettingsFields';

interface PrescriptionPdfSettingsDialogProps {
  open: boolean;
  onClose: () => void;
  onSettingsLoaded: (settings: PdfSettings) => void;
}

export function PrescriptionPdfSettingsDialog({ open, onClose, onSettingsLoaded }: PrescriptionPdfSettingsDialogProps) {
  const [settings, setSettings] = useState<PdfSettings>(DEFAULT_PDF_SETTINGS);
  // Last-persisted snapshot: the Guardar button only activates when the
  // current settings differ from it (otherwise it reads "Guardado", disabled).
  const [savedSettings, setSavedSettings] = useState<PdfSettings>(DEFAULT_PDF_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (open) {
      fetchSettings();
    }
  }, [open]);

  const fetchSettings = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/doctor/pdf-settings');
      const data = await res.json();
      if (data.success) {
        setSettings(data.data);
        setSavedSettings(data.data);
        onSettingsLoaded(data.data);
      }
    } catch {
      setError('Error al cargar configuracion');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    setError('');
    try {
      const res = await fetch('/api/doctor/pdf-settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(camposRxParaGuardar(settings)),
      });
      const data = await res.json();
      if (data.success) {
        setSettings(data.data);
        setSavedSettings(data.data);
        onSettingsLoaded(data.data);
      } else {
        setError(data.error || 'Error al guardar');
      }
    } catch {
      setError('Error al guardar configuracion');
    } finally {
      setSaving(false);
    }
  };

  const { isOwner, loading: cargandoPermisos } = usePermissions();

  if (!open) return null;
  // Mientras se sabe si es titular no se pinta ninguno de los dos (no enseñar algo y luego quitarlo).
  if (cargandoPermisos) return null;

  // El TITULAR cambia el diseño completo en «Receta PDF», con la vista previa en vivo. Los AYUDANTES
  // (que no entran a «Receta PDF»: es OWNER_ONLY por la firma) siguen cambiando aquí la impresión.
  if (isOwner) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-2 sm:p-4 z-50">
        <div className="bg-white rounded-xl shadow-lg max-w-md w-full">
          <div className="flex items-center justify-between p-4 border-b border-gray-200">
            <h2 className="text-base font-semibold text-gray-900">Diseño de la receta</h2>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
          </div>
          <div className="p-4 space-y-3 text-sm text-gray-700">
            <p>
              El tamaño, los márgenes, las secciones, el color, el logo y la firma se cambian en <strong>Receta PDF</strong>,
              viendo la receta mientras la ajustas.
            </p>
            <Link
              href="/dashboard/medical-records/receta"
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-sm font-medium"
            >
              <Eye className="w-4 h-4" />
              Cambiar el diseño de la receta
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-2 sm:p-4 z-50 overflow-y-auto">
      <div className="bg-white rounded-xl shadow-lg max-w-md w-full my-4">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200">
          <h2 className="text-base font-semibold text-gray-900">Configuracion de Impresion - Receta</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
          </div>
        ) : (
          <div className="p-4 space-y-5">
            {error && (
              <div className="p-2 bg-red-50 border border-red-200 rounded text-sm text-red-700">{error}</div>
            )}

            <RecetaPrintSettingsFields settings={settings} onChange={setSettings} />
          </div>
        )}

        {/* Footer buttons */}
        {!loading && (() => {
          const dirty = JSON.stringify(settings) !== JSON.stringify(savedSettings);
          return (
            <div className="flex items-center justify-end gap-3 p-4 border-t border-gray-200">
              {!dirty && !saving && (
                <span className="text-xs text-green-700">✓ Sin cambios pendientes</span>
              )}
              <button
                onClick={handleSave}
                disabled={saving || !dirty}
                className={`flex items-center gap-1.5 px-4 py-1.5 text-sm rounded-md ${
                  dirty
                    ? 'bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50'
                    : 'bg-gray-100 text-gray-400 cursor-default'
                }`}
              >
                {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
                {saving ? 'Guardando...' : dirty ? 'Guardar' : 'Guardado'}
              </button>
            </div>
          );
        })()}
      </div>
    </div>
  );
}
