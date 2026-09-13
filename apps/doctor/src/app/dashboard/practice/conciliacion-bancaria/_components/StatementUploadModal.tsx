'use client';

import { useState, useRef } from 'react';
import { X, Upload, Loader2, FileSpreadsheet, FileText } from 'lucide-react';
import { BANK_OPTIONS, MONTH_NAMES } from './conciliacion-types';
import { usePermissions } from '@/lib/permissions-client';

type FileType = 'csv' | 'pdf';

interface Props {
  open: boolean;
  onClose: () => void;
  onUpload: (
    file: File,
    bank: string,
    accountNumber: string,
    periodMonth: number,
    periodYear: number,
  ) => Promise<number | null>;
  onUploadPdf: (
    file: File,
    bank: string,
    accountNumber: string,
    periodMonth: number,
    periodYear: number,
  ) => Promise<void>;
  uploading: boolean;
}

export function StatementUploadModal({ open, onClose, onUpload, onUploadPdf, uploading }: Props) {
  const [file, setFile] = useState<File | null>(null);
  const [fileType, setFileType] = useState<FileType>('pdf');
  const [bank, setBank] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [periodMonth, setPeriodMonth] = useState(new Date().getMonth() + 1);
  const [periodYear, setPeriodYear] = useState(new Date().getFullYear());
  const inputRef = useRef<HTMLInputElement>(null);
  // TIERS Q2b — de las DOS rutas de este modal, solo el PDF llama a un modelo
  // (`bank-statement-parse`); el CSV se procesa sin IA. Por eso el candado va
  // AQUÍ y no en el botón «Subir Estado de Cuenta» de la página: gatear el
  // botón le quitaría a un plan sin IA la importación por CSV, que sí le toca.
  // (Mismo error que el review cazó con el GET de `…/summary`.)
  // `!permsLoading`: mientras la sesión carga, permissions-client hace
  // fail-open (`isOwner ?? true`, `tier ?? PRO`), así que `can('ia')` sería
  // true en esa ventana y el PDF se aceptaría para acabar en un 403.
  const { can, loading: permsLoading } = usePermissions();
  const aiAllowed = !permsLoading && can('ia');

  if (!open) return null;

  // DERIVADO, nunca guardado: como estado se quedaba viejo si la sesión
  // resolvía DESPUÉS de elegir el archivo (o al refetch de NextAuth al volver
  // a la pestaña), y «Subir y Procesar» mandaba el PDF a un 403. Hallazgo del
  // review de Q2b.
  const pdfBloqueado = !aiAllowed && fileType === 'pdf';
  const canSubmit = file && bank && accountNumber.trim() && !uploading && !pdfBloqueado;

  const handleSubmit = async () => {
    if (!canSubmit) return;
    if (fileType === 'pdf') {
      await onUploadPdf(file, bank, accountNumber.trim(), periodMonth, periodYear);
      // Don't reset — the review table will show
    } else {
      const newId = await onUpload(file, bank, accountNumber.trim(), periodMonth, periodYear);
      if (newId) {
        setFile(null);
        setBank('');
        setAccountNumber('');
      }
    }
  };

  const handleFileChange = (f: File | null) => {
    const esPdf = Boolean(f && f.name.toLowerCase().endsWith('.pdf'));
    // Se acepta el archivo y el envío queda bloqueado con un motivo visible
    // (`pdfBloqueado`, derivado arriba): descartarlo en silencio haría que el
    // doctor eligiera el mismo PDF una y otra vez sin entender nada. El
    // selector ya filtra por `accept`, pero en varios SO se puede escoger
    // "todos los archivos" y saltárselo.
    setFile(f);
    if (f) {
      if (esPdf) setFileType('pdf');
      else setFileType('csv');
    }
  };

  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: currentYear - 2020 + 1 }, (_, i) => 2020 + i).reverse();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md mx-4 p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-gray-900">Subir Estado de Cuenta</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-4">
          {/* File picker */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {aiAllowed ? 'Archivo PDF o CSV' : 'Archivo CSV'}
            </label>
            <div
              onClick={() => inputRef.current?.click()}
              className="border-2 border-dashed border-gray-300 rounded-lg p-4 text-center cursor-pointer hover:border-blue-400 transition-colors"
            >
              <input
                ref={inputRef}
                type="file"
                accept={
                  aiAllowed
                    ? '.pdf,.csv,.txt,application/pdf,text/csv,text/plain,application/vnd.ms-excel'
                    : '.csv,.txt,text/csv,text/plain,application/vnd.ms-excel'
                }
                className="hidden"
                onChange={(e) => handleFileChange(e.target.files?.[0] || null)}
              />
              {file ? (
                <div className="flex items-center justify-center gap-2 text-green-700">
                  {fileType === 'pdf' ? <FileText className="w-5 h-5" /> : <FileSpreadsheet className="w-5 h-5" />}
                  <span className="text-sm font-medium">{file.name}</span>
                  <span className="text-xs text-gray-400 uppercase">{fileType}</span>
                </div>
              ) : (
                <div className="text-gray-500">
                  <Upload className="w-8 h-8 mx-auto mb-1 text-gray-400" />
                  <p className="text-sm">
                    {aiAllowed
                      ? 'Click para seleccionar archivo PDF o CSV'
                      : 'Click para seleccionar archivo CSV'}
                  </p>
                  <p className="text-xs text-gray-400 mt-1">
                    {aiAllowed
                      ? 'PDF: extracción con IA · CSV: procesamiento directo'
                      : 'CSV: procesamiento directo'}
                  </p>
                </div>
              )}
            </div>
            {pdfBloqueado && (
              <p className="mt-1 text-xs text-amber-700">
                La lectura de PDF usa IA y no está incluida en tu plan. Sube el estado de cuenta en
                CSV, o escríbenos para activar las funciones de IA.
              </p>
            )}
          </div>

          {/* Bank */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Banco</label>
            <select
              value={bank}
              onChange={(e) => setBank(e.target.value)}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="">Seleccionar banco...</option>
              {BANK_OPTIONS.map((b) => (
                <option key={b.value} value={b.value}>{b.label}</option>
              ))}
            </select>
          </div>

          {/* Account number */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Número de cuenta</label>
            <input
              type="text"
              value={accountNumber}
              onChange={(e) => setAccountNumber(e.target.value)}
              placeholder="Últimos 4 dígitos o completo"
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          {/* Period */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Mes</label>
              <select
                value={periodMonth}
                onChange={(e) => setPeriodMonth(parseInt(e.target.value))}
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-blue-500 focus:border-blue-500"
              >
                {MONTH_NAMES.map((name, i) => (
                  <option key={i} value={i + 1}>{name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Año</label>
              <select
                value={periodYear}
                onChange={(e) => setPeriodYear(parseInt(e.target.value))}
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-blue-500 focus:border-blue-500"
              >
                {years.map((y) => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="mt-6 flex justify-end gap-3">
          <button
            onClick={onClose}
            disabled={uploading}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={handleSubmit}
            disabled={!canSubmit}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {uploading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Procesando...
              </>
            ) : (
              <>
                <Upload className="w-4 h-4" />
                Subir y Procesar
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
