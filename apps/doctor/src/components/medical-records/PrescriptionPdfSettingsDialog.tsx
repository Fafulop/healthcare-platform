'use client';

import { useState, useEffect } from 'react';
import { X, Loader2 } from 'lucide-react';
import type { PdfSettings, RxPageSize } from '@/types/pdf-settings';
import { DEFAULT_PDF_SETTINGS, RX_PAGE_SIZES } from '@/types/pdf-settings';

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
        body: JSON.stringify({
          rxShowHeader: settings.rxShowHeader,
          rxShowFooter: settings.rxShowFooter,
          rxShowPatientBox: settings.rxShowPatientBox,
          rxShowDiagnosis: settings.rxShowDiagnosis,
          rxShowClinicalNotes: settings.rxShowClinicalNotes,
          rxShowLogo: settings.rxShowLogo,
          rxShowSignature: settings.rxShowSignature,
          rxPageSize: settings.rxPageSize,
          rxOrientation: settings.rxOrientation,
          rxTopMarginMm: settings.rxTopMarginMm,
          rxBottomMarginMm: settings.rxBottomMarginMm,
        }),
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

  const toggle = (key: keyof PdfSettings) => {
    setSettings((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const setMargin = (key: 'rxTopMarginMm' | 'rxBottomMarginMm', value: string) => {
    const num = Math.max(0, Math.min(80, Number(value) || 0));
    setSettings((prev) => ({ ...prev, [key]: num }));
  };

  if (!open) return null;

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

            {/* Page size */}
            <div>
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">Tamaño de Papel</p>
              <select
                value={settings.rxPageSize}
                onChange={(e) => setSettings((prev) => ({ ...prev, rxPageSize: e.target.value as RxPageSize }))}
                className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {RX_PAGE_SIZES.map((s) => (
                  <option key={s.id} value={s.id}>{s.label}</option>
                ))}
              </select>
              <p className="text-xs text-gray-400 mt-1">
                Elige el tamaño de tu recetario si imprimes sobre hojas pre-impresas.
              </p>
              <div className="mt-2 flex items-center gap-4">
                <label className="flex items-center gap-1.5 text-sm text-gray-700 cursor-pointer">
                  <input
                    type="radio"
                    name="rxOrientation"
                    checked={settings.rxOrientation !== 'landscape'}
                    onChange={() => setSettings((prev) => ({ ...prev, rxOrientation: 'portrait' }))}
                    className="w-4 h-4 text-blue-600 focus:ring-blue-500"
                  />
                  Vertical
                </label>
                <label className="flex items-center gap-1.5 text-sm text-gray-700 cursor-pointer">
                  <input
                    type="radio"
                    name="rxOrientation"
                    checked={settings.rxOrientation === 'landscape'}
                    onChange={() => setSettings((prev) => ({ ...prev, rxOrientation: 'landscape' }))}
                    className="w-4 h-4 text-blue-600 focus:ring-blue-500"
                  />
                  Horizontal
                </label>
              </div>
            </div>

            {/* Header & Footer */}
            <div>
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">Encabezado y Pie de Pagina</p>
              <div className="space-y-2">
                <CheckboxRow
                  id="rxShowHeader"
                  label="Mostrar encabezado (barra con RECETA MEDICA)"
                  checked={settings.rxShowHeader}
                  onChange={() => toggle('rxShowHeader')}
                />
                <CheckboxRow
                  id="rxShowLogo"
                  label="Mostrar logo del consultorio (en el encabezado)"
                  checked={settings.rxShowLogo}
                  onChange={() => toggle('rxShowLogo')}
                />
                <CheckboxRow
                  id="rxShowFooter"
                  label="Mostrar pie de pagina (datos del doctor + firma)"
                  checked={settings.rxShowFooter}
                  onChange={() => toggle('rxShowFooter')}
                />
                <CheckboxRow
                  id="rxShowSignature"
                  label="Mostrar firma digital (en el pie de pagina)"
                  checked={settings.rxShowSignature}
                  onChange={() => toggle('rxShowSignature')}
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
                      value={settings.rxTopMarginMm}
                      onChange={(e) => setMargin('rxTopMarginMm', e.target.value)}
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
                      value={settings.rxBottomMarginMm}
                      onChange={(e) => setMargin('rxBottomMarginMm', e.target.value)}
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
                  id="rxShowPatientBox"
                  label="Datos del paciente"
                  checked={settings.rxShowPatientBox}
                  onChange={() => toggle('rxShowPatientBox')}
                />
                <CheckboxRow
                  id="rxShowDiagnosis"
                  label="Diagnostico"
                  checked={settings.rxShowDiagnosis}
                  onChange={() => toggle('rxShowDiagnosis')}
                />
                <CheckboxRow
                  id="rxShowClinicalNotes"
                  label="Notas clinicas"
                  checked={settings.rxShowClinicalNotes}
                  onChange={() => toggle('rxShowClinicalNotes')}
                />
              </div>
            </div>
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
