'use client';

import { Loader2, Trash2, Download } from 'lucide-react';

interface Props {
  count: number;
  deletingBatch: boolean;
  onClear: () => void;
  onDelete: () => void;
  onExportPDF: () => void;
}

export function BatchActionBar({ count, deletingBatch, onClear, onDelete, onExportPDF }: Props) {
  if (count === 0) return null;

  return (
    <div className="bg-slate-50 border border-slate-200 rounded-lg px-4 py-3 mb-4 flex flex-wrap items-center gap-2">
      <span className="text-sm font-medium text-slate-800 flex-1 min-w-0">
        {count} movimiento{count !== 1 ? 's' : ''} seleccionado{count !== 1 ? 's' : ''}
      </span>
      <div className="flex items-center gap-2 flex-shrink-0">
        <button
          onClick={onClear}
          className="text-sm text-gray-600 hover:text-gray-800 px-3 py-1.5 rounded-md hover:bg-gray-100"
        >
          Cancelar
        </button>
        <button
          onClick={onDelete}
          disabled={deletingBatch}
          className="flex items-center gap-1.5 bg-red-600 hover:bg-red-700 text-white text-sm font-medium px-3 py-1.5 rounded-md transition-colors disabled:opacity-50"
        >
          {deletingBatch ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
          <span className="hidden sm:inline">{deletingBatch ? 'Eliminando...' : `Eliminar (${count})`}</span>
          <span className="sm:hidden">{deletingBatch ? '...' : `(${count})`}</span>
        </button>
        <button
          onClick={onExportPDF}
          className="flex items-center gap-1.5 bg-slate-600 hover:bg-slate-700 text-white text-sm font-medium px-3 py-1.5 rounded-md transition-colors"
        >
          <Download className="w-4 h-4" />
          <span className="hidden sm:inline">Exportar PDF</span>
        </button>
      </div>
    </div>
  );
}
