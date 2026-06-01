'use client';

import { useEffect, useCallback } from 'react';
import { X, Receipt, Download, File } from 'lucide-react';
import type { Attachment } from './useLedgerDetail';
import { formatFileSize } from './useLedgerDetail';

interface Props {
  attachments: Attachment[];
  onClose: () => void;
}

function isImage(fileType: string): boolean {
  return fileType.startsWith('image/');
}

function isPdf(fileType: string): boolean {
  return fileType === 'application/pdf';
}

export function ComprobanteModal({ attachments, onClose }: Props) {
  const handleClose = useCallback(() => onClose(), [onClose]);

  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => { if (e.key === 'Escape') handleClose(); };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [handleClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/40" />
      <div
        className="relative w-full sm:max-w-2xl sm:rounded-xl rounded-t-2xl bg-white shadow-xl max-h-[90vh] flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        {/* Drag handle (mobile) */}
        <div className="sm:hidden flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 bg-gray-300 rounded-full" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-2 sm:pt-5 pb-3 border-b border-gray-200">
          <div className="flex items-center gap-2">
            <Receipt className="w-5 h-5 text-green-600" />
            <h3 className="text-lg font-bold text-gray-900">Comprobantes ({attachments.length})</h3>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 p-2 -mr-1">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4 min-h-0">
          {attachments.map(att => (
            <div key={att.id} className="border border-gray-200 rounded-lg overflow-hidden">
              {/* Preview */}
              {isImage(att.fileType) ? (
                <div className="bg-gray-50 flex items-center justify-center p-2 max-h-[400px]">
                  <img
                    src={att.fileUrl}
                    alt={att.fileName}
                    className="max-w-full max-h-[380px] object-contain rounded"
                  />
                </div>
              ) : isPdf(att.fileType) ? (
                <iframe
                  src={att.fileUrl}
                  title={att.fileName}
                  className="w-full h-[400px] border-0"
                />
              ) : (
                <div className="bg-gray-50 flex items-center justify-center py-10">
                  <File className="w-12 h-12 text-gray-300" />
                </div>
              )}

              {/* Info bar */}
              <div className="flex items-center justify-between px-3 py-2 bg-white border-t border-gray-100">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">{att.fileName}</p>
                  <p className="text-xs text-gray-500">{formatFileSize(att.fileSize)}</p>
                </div>
                <a
                  href={att.fileUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 text-sm text-blue-600 hover:text-blue-700 shrink-0 ml-3"
                >
                  <Download className="w-4 h-4" />
                  Abrir
                </a>
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-gray-200">
          <button onClick={onClose} className="w-full px-4 py-2.5 border border-gray-300 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50">
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
}
