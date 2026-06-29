'use client';

import { useEffect, useCallback, useState } from 'react';
import { X, Receipt, Download, File, Landmark, Loader2 } from 'lucide-react';
import { authFetch } from '@/lib/auth-fetch';
import { formatFileSize } from './useLedgerDetail';
import type { LedgerEntry, BankMovementEvidence } from './ledger-types';

const API_URL = process.env.NEXT_PUBLIC_API_URL || '';

interface Props {
  entry: LedgerEntry;
  onClose: () => void;
}

const MONTHS_ES = ['', 'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

function isImage(fileType: string): boolean { return fileType.startsWith('image/'); }
function isPdf(fileType: string): boolean { return fileType === 'application/pdf'; }

function money(n: number): string {
  return n.toLocaleString('es-MX', { style: 'currency', currency: 'MXN' });
}

export function ComprobanteModal({ entry, onClose }: Props) {
  const handleClose = useCallback(() => onClose(), [onClose]);

  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => { if (e.key === 'Escape') handleClose(); };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [handleClose]);

  // Bank evidence is fetched lazily (it's off the list query) when the modal opens.
  const [bankMov, setBankMov] = useState<BankMovementEvidence | null>(null);
  const [isSettlement, setIsSettlement] = useState(false);
  const [loadingEvidence, setLoadingEvidence] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoadingEvidence(true);
      try {
        const res = await authFetch(`${API_URL}/api/practice-management/ledger/${entry.id}/evidence`);
        if (res.ok) {
          const { data } = await res.json();
          if (!cancelled) {
            const mov: BankMovementEvidence | null = data?.bankMovement || data?.settlementItem?.bankMovement || null;
            setBankMov(mov);
            setIsSettlement(!data?.bankMovement && !!data?.settlementItem?.bankMovement);
          }
        }
      } catch { /* silent — falls back to denormalized bankAccount / attachments */ }
      finally { if (!cancelled) setLoadingEvidence(false); }
    })();
    return () => { cancelled = true; };
  }, [entry.id]);

  const attachments = entry.attachments || [];
  const st = bankMov?.bankStatement || null;
  const hasBank = !!bankMov || !!entry.bankAccount;
  const hasAny = hasBank || attachments.length > 0;

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
            <h3 className="text-lg font-bold text-gray-900">Evidencia</h3>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 p-2 -mr-1">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4 min-h-0">
          {/* Bank reconciliation reference */}
          {loadingEvidence ? (
            <div className="flex items-center justify-center gap-2 py-4 text-sm text-gray-500">
              <Loader2 className="w-4 h-4 animate-spin" /> Cargando evidencia…
            </div>
          ) : hasBank ? (
            <div className="border border-emerald-200 bg-emerald-50/60 rounded-lg p-3">
              <div className="flex items-center gap-2 mb-2">
                <Landmark className="w-4 h-4 text-emerald-700" />
                <p className="text-sm font-semibold text-emerald-800">
                  Conciliado con estado de cuenta{isSettlement ? ' (liquidación "Varios")' : ''}
                </p>
              </div>
              {st ? (
                <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                  <dt className="text-gray-500">Banco</dt>
                  <dd className="text-gray-900 font-medium uppercase">{st.bankName}</dd>
                  <dt className="text-gray-500">Cuenta</dt>
                  <dd className="text-gray-900 font-medium">{st.accountNumber}</dd>
                  <dt className="text-gray-500">Estado de cuenta</dt>
                  <dd className="text-gray-900 font-medium capitalize">{MONTHS_ES[st.periodMonth]} {st.periodYear}</dd>
                  {bankMov && (
                    <>
                      <dt className="text-gray-500">Movimiento</dt>
                      <dd className="text-gray-900">
                        {new Date(bankMov.transactionDate).toLocaleDateString('es-MX')} · {money(Number(bankMov.amount))}
                        <span className="text-gray-400"> · {bankMov.movementType === 'deposit' ? 'depósito' : 'retiro'}</span>
                      </dd>
                      {(bankMov.reference || bankMov.description) && (
                        <>
                          <dt className="text-gray-500">Referencia</dt>
                          <dd className="text-gray-700 truncate" title={bankMov.reference || bankMov.description || ''}>
                            {bankMov.reference || bankMov.description}
                          </dd>
                        </>
                      )}
                    </>
                  )}
                </dl>
              ) : (
                // Fallback: only the denormalized account text is known (e.g. evidence predates this view).
                <p className="text-xs text-gray-700">{entry.bankAccount}</p>
              )}
            </div>
          ) : null}

          {/* Uploaded comprobantes (images / PDFs) */}
          {attachments.length > 0 && (
            <div className="space-y-3">
              {hasBank && <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Comprobantes adjuntos ({attachments.length})</p>}
              {attachments.map(att => (
                <div key={att.id} className="border border-gray-200 rounded-lg overflow-hidden">
                  {isImage(att.fileType) ? (
                    <div className="bg-gray-50 flex items-center justify-center p-2 max-h-[400px]">
                      <img src={att.fileUrl} alt={att.fileName} className="max-w-full max-h-[380px] object-contain rounded" />
                    </div>
                  ) : isPdf(att.fileType) ? (
                    <iframe src={att.fileUrl} title={att.fileName} className="w-full h-[400px] border-0" />
                  ) : (
                    <div className="bg-gray-50 flex items-center justify-center py-10">
                      <File className="w-12 h-12 text-gray-300" />
                    </div>
                  )}
                  <div className="flex items-center justify-between px-3 py-2 bg-white border-t border-gray-100">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">{att.fileName}</p>
                      <p className="text-xs text-gray-500">{formatFileSize(att.fileSize)}</p>
                    </div>
                    <a href={att.fileUrl} target="_blank" rel="noopener noreferrer"
                      className="flex items-center gap-1.5 text-sm text-blue-600 hover:text-blue-700 shrink-0 ml-3">
                      <Download className="w-4 h-4" />
                      Abrir
                    </a>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Empty state */}
          {!loadingEvidence && !hasAny && (
            <div className="text-center py-8">
              <Receipt className="w-10 h-10 text-gray-200 mx-auto mb-2" />
              <p className="text-sm text-gray-500">Este movimiento está marcado con comprobante pero no hay un
                estado de cuenta vinculado ni archivos adjuntos.</p>
              <p className="text-xs text-gray-400 mt-1">Puede provenir de un pago en línea o haberse marcado manualmente.</p>
            </div>
          )}
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
