'use client';

/**
 * Los controles de IMPRESIÓN de la receta (tamaño, orientación, encabezado/pie, logo/firma, márgenes,
 * secciones). Los usan DOS lugares, para que no se separen:
 *   · «Receta PDF» (sólo el titular), junto a la vista previa en vivo;
 *   · el diálogo «Configuración de impresión» de una receta, para los AYUDANTES con `expedientes`
 *     (la ruta `doctor/pdf-settings` es de `expedientes`; «Receta PDF» es OWNER_ONLY por la firma).
 */

import type { PdfSettings, RxPageSize } from '@/types/pdf-settings';
import { RX_PAGE_SIZES, notaMargenesSinUso } from '@/types/pdf-settings';

export function RecetaPrintSettingsFields({
  settings, onChange,
}: {
  settings: PdfSettings;
  onChange: (s: PdfSettings) => void;
}) {
  const toggle = (key: keyof PdfSettings) => onChange({ ...settings, [key]: !settings[key] });
  const setMargin = (key: 'rxTopMarginMm' | 'rxBottomMarginMm', value: string) =>
    onChange({ ...settings, [key]: Math.max(0, Math.min(80, Number(value) || 0)) });

  return (
    <div className="space-y-5">
      {/* Page size */}
      <div>
        <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">Tamaño de papel</p>
        <select
          value={settings.rxPageSize}
          onChange={(e) => onChange({ ...settings, rxPageSize: e.target.value as RxPageSize })}
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
              onChange={() => onChange({ ...settings, rxOrientation: 'portrait' })}
              className="w-4 h-4 text-blue-600 focus:ring-blue-500"
            />
            Vertical
          </label>
          <label className="flex items-center gap-1.5 text-sm text-gray-700 cursor-pointer">
            <input
              type="radio"
              name="rxOrientation"
              checked={settings.rxOrientation === 'landscape'}
              onChange={() => onChange({ ...settings, rxOrientation: 'landscape' })}
              className="w-4 h-4 text-blue-600 focus:ring-blue-500"
            />
            Horizontal
          </label>
        </div>
      </div>

      {/* Header & Footer */}
      <div>
        <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">Encabezado y pie de página</p>
        <div className="space-y-2">
          <CheckboxRow id="rxShowHeader" label="Mostrar encabezado (barra con RECETA MÉDICA)" checked={settings.rxShowHeader} onChange={() => toggle('rxShowHeader')} />
          <CheckboxRow id="rxShowLogo" label="Mostrar logo del consultorio (en el encabezado)" checked={settings.rxShowLogo} onChange={() => toggle('rxShowLogo')} />
          <CheckboxRow id="rxShowFooter" label="Mostrar pie de página (datos del doctor + firma)" checked={settings.rxShowFooter} onChange={() => toggle('rxShowFooter')} />
          <CheckboxRow id="rxShowSignature" label="Mostrar firma digital (en el pie de página)" checked={settings.rxShowSignature} onChange={() => toggle('rxShowSignature')} />
        </div>
      </div>

      {/* Margins */}
      <div>
        <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">Márgenes para papel membretado</p>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm text-gray-700 mb-1">Margen superior</label>
            <div className="flex items-center gap-1.5">
              <input type="number" min={0} max={80} value={settings.rxTopMarginMm}
                onChange={(e) => setMargin('rxTopMarginMm', e.target.value)}
                disabled={settings.rxShowHeader}
                className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100 disabled:text-gray-400" />
              <span className="text-xs text-gray-500">mm</span>
            </div>
          </div>
          <div>
            <label className="block text-sm text-gray-700 mb-1">Margen inferior</label>
            <div className="flex items-center gap-1.5">
              <input type="number" min={0} max={80} value={settings.rxBottomMarginMm}
                onChange={(e) => setMargin('rxBottomMarginMm', e.target.value)}
                disabled={settings.rxShowFooter}
                className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100 disabled:text-gray-400" />
              <span className="text-xs text-gray-500">mm</span>
            </div>
          </div>
        </div>
        <p className="text-xs text-gray-400 mt-1">Espacio en blanco para logo o datos preimpresos (0-80 mm)</p>
        {notaMargenesSinUso(settings.rxShowHeader, settings.rxShowFooter) && (
          <p className="text-xs text-amber-700 mt-1">{notaMargenesSinUso(settings.rxShowHeader, settings.rxShowFooter)}</p>
        )}
      </div>

      {/* Sections */}
      <div>
        <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">Secciones del documento</p>
        <div className="space-y-2">
          <CheckboxRow id="rxShowPatientBox" label="Datos del paciente" checked={settings.rxShowPatientBox} onChange={() => toggle('rxShowPatientBox')} />
          <CheckboxRow id="rxShowDiagnosis" label="Diagnóstico" checked={settings.rxShowDiagnosis} onChange={() => toggle('rxShowDiagnosis')} />
          <CheckboxRow id="rxShowClinicalNotes" label="Notas clínicas" checked={settings.rxShowClinicalNotes} onChange={() => toggle('rxShowClinicalNotes')} />
        </div>
      </div>
    </div>
  );
}

function CheckboxRow({ id, label, checked, onChange }: { id: string; label: string; checked: boolean; onChange: () => void }) {
  return (
    <div className="flex items-center gap-2">
      <input type="checkbox" id={id} checked={checked} onChange={onChange} className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500" />
      <label htmlFor={id} className="text-sm text-gray-700">{label}</label>
    </div>
  );
}

/** Lo que se manda a `PATCH /api/doctor/pdf-settings` (sólo los campos de la receta). */
export function camposRxParaGuardar(s: PdfSettings) {
  return {
    rxShowHeader: s.rxShowHeader, rxShowFooter: s.rxShowFooter, rxShowPatientBox: s.rxShowPatientBox,
    rxShowDiagnosis: s.rxShowDiagnosis, rxShowClinicalNotes: s.rxShowClinicalNotes, rxShowLogo: s.rxShowLogo,
    rxShowSignature: s.rxShowSignature, rxPageSize: s.rxPageSize, rxOrientation: s.rxOrientation,
    rxTopMarginMm: s.rxTopMarginMm, rxBottomMarginMm: s.rxBottomMarginMm,
  };
}
