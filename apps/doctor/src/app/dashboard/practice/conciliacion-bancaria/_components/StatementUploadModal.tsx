'use client';

import { useState, useRef } from 'react';
import { X, Upload, Loader2, FileSpreadsheet } from 'lucide-react';
import { BANK_OPTIONS, MONTH_NAMES } from './conciliacion-types';

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
  uploading: boolean;
}

export function StatementUploadModal({ open, onClose, onUpload, uploading }: Props) {
  const [file, setFile] = useState<File | null>(null);
  const [bank, setBank] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [periodMonth, setPeriodMonth] = useState(new Date().getMonth() + 1);
  const [periodYear, setPeriodYear] = useState(new Date().getFullYear());
  const inputRef = useRef<HTMLInputElement>(null);

  if (!open) return null;

  const canSubmit = file && bank && accountNumber.trim() && !uploading;

  const handleSubmit = async () => {
    if (!canSubmit) return;
    const newId = await onUpload(file, bank, accountNumber.trim(), periodMonth, periodYear);
    if (newId) {
      setFile(null);
      setBank('');
      setAccountNumber('');
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
            <label className="block text-sm font-medium text-gray-700 mb-1">Archivo CSV</label>
            <div
              onClick={() => inputRef.current?.click()}
              className="border-2 border-dashed border-gray-300 rounded-lg p-4 text-center cursor-pointer hover:border-blue-400 transition-colors"
            >
              <input
                ref={inputRef}
                type="file"
                accept=".csv,.txt,text/csv,text/plain,application/vnd.ms-excel"
                className="hidden"
                onChange={(e) => setFile(e.target.files?.[0] || null)}
              />
              {file ? (
                <div className="flex items-center justify-center gap-2 text-green-700">
                  <FileSpreadsheet className="w-5 h-5" />
                  <span className="text-sm font-medium">{file.name}</span>
                </div>
              ) : (
                <div className="text-gray-500">
                  <Upload className="w-8 h-8 mx-auto mb-1 text-gray-400" />
                  <p className="text-sm">Click para seleccionar archivo CSV</p>
                </div>
              )}
            </div>
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
