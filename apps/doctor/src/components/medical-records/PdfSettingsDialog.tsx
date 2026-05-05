'use client';

import { useState, useEffect } from 'react';
import { X, Loader2, Eye } from 'lucide-react';
import type { PdfSettings } from '@/types/pdf-settings';
import { DEFAULT_PDF_SETTINGS } from '@/types/pdf-settings';

interface PdfSettingsDialogProps {
  open: boolean;
  onClose: () => void;
  onSettingsLoaded: (settings: PdfSettings) => void;
  /** When provided, generates a preview PDF using current settings */
  onPreview?: (settings: PdfSettings) => void;
}

export function PdfSettingsDialog({ open, onClose, onSettingsLoaded, onPreview }: PdfSettingsDialogProps) {
  const [settings, setSettings] = useState<PdfSettings>(DEFAULT_PDF_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (open) {
      fetchSettings();
      setSaved(false);
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
    setSaved(false);
    try {
      const res = await fetch('/api/doctor/pdf-settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings),
      });
      const data = await res.json();
      if (data.success) {
        onSettingsLoaded(data.data);
        setSaved(true);
        setTimeout(() => setSaved(false), 2000);
      } else {
        setError(data.error || 'Error al guardar');
      }
    } catch {
      setError('Error al guardar configuracion');
    } finally {
      setSaving(false);
    }
  };

  const toggle = (key: keyof PdfSettings) => {
    setSettings((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const setMargin = (key: 'topMarginMm' | 'bottomMarginMm', value: string) => {
    const num = Math.max(0, Math.min(80, Number(value) || 0));
    setSettings((prev) => ({ ...prev, [key]: num }));
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-2 sm:p-4 z-50 overflow-y-auto">
      <div className="bg-white rounded-xl shadow-lg max-w-md w-full my-4">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200">
          <h2 className="text-base font-semibold text-gray-900">Configuracion de Impresion PDF</h2>
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

            {/* Header & Footer */}
            <div>
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">Encabezado y Pie de Pagina</p>
              <div className="space-y-2">
                <CheckboxRow
                  id="showHeader"
                  label="Mostrar encabezado (barra azul)"
                  checked={settings.showHeader}
                  onChange={() => toggle('showHeader')}
                />
                <CheckboxRow
                  id="showFooter"
                  label="Mostrar pie de pagina (tusalud.pro)"
                  checked={settings.showFooter}
                  onChange={() => toggle('showFooter')}
                />
                <CheckboxRow
                  id="showPageNumbers"
                  label="Mostrar numeros de pagina"
                  checked={settings.showPageNumbers}
                  onChange={() => toggle('showPageNumbers')}
                />
              </div>
            </div>

            {/* Margins */}
            <div>
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">Margenes para Papel Membretado</p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm text-gray-700 mb-1">Margen superior</label>
                  <div className="flex items-center gap-1.5">
                    <input
                      type="number"
                      min={0}
                      max={80}
                      value={settings.topMarginMm}
                      onChange={(e) => setMargin('topMarginMm', e.target.value)}
                      className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <span className="text-xs text-gray-500">mm</span>
                  </div>
                </div>
                <div>
                  <label className="block text-sm text-gray-700 mb-1">Margen inferior</label>
                  <div className="flex items-center gap-1.5">
                    <input
                      type="number"
                      min={0}
                      max={80}
                      value={settings.bottomMarginMm}
                      onChange={(e) => setMargin('bottomMarginMm', e.target.value)}
                      className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <span className="text-xs text-gray-500">mm</span>
                  </div>
                </div>
              </div>
              <p className="text-xs text-gray-400 mt-1">Espacio en blanco para logo o datos pre-impresos (0-80 mm)</p>
            </div>

            {/* Sections */}
            <div>
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">Secciones del Documento</p>
              <div className="space-y-2">
                <CheckboxRow
                  id="showPatientBox"
                  label="Datos del paciente"
                  checked={settings.showPatientBox}
                  onChange={() => toggle('showPatientBox')}
                />
                <CheckboxRow
                  id="showEncounterMeta"
                  label="Tipo de consulta"
                  checked={settings.showEncounterMeta}
                  onChange={() => toggle('showEncounterMeta')}
                />
                <CheckboxRow
                  id="showVitals"
                  label="Signos vitales"
                  checked={settings.showVitals}
                  onChange={() => toggle('showVitals')}
                />
                <CheckboxRow
                  id="showFollowUp"
                  label="Seguimiento"
                  checked={settings.showFollowUp}
                  onChange={() => toggle('showFollowUp')}
                />
              </div>
            </div>
          </div>
        )}

        {/* Footer buttons */}
        {!loading && (
          <div className="flex items-center justify-between p-4 border-t border-gray-200">
            {onPreview ? (
              <button
                onClick={() => onPreview(settings)}
                className="flex items-center gap-1.5 px-3 py-1.5 text-sm border border-gray-300 rounded-md hover:bg-gray-50"
              >
                <Eye className="w-3.5 h-3.5" />
                Vista Previa
              </button>
            ) : (
              <div />
            )}
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex items-center gap-1.5 px-4 py-1.5 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
            >
              {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
              {saved ? 'Guardado' : saving ? 'Guardando...' : 'Guardar'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function CheckboxRow({ id, label, checked, onChange }: { id: string; label: string; checked: boolean; onChange: () => void }) {
  return (
    <div className="flex items-center gap-2">
      <input
        type="checkbox"
        id={id}
        checked={checked}
        onChange={onChange}
        className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
      />
      <label htmlFor={id} className="text-sm text-gray-700">{label}</label>
    </div>
  );
}
