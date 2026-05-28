'use client';

import { useState, useEffect, useRef } from 'react';
import { FileSearch, Link2, X, Loader2, CheckCircle, AlertCircle } from 'lucide-react';
import { authFetch } from '@/lib/auth-fetch';
import type { CfdiSuggestion } from './ledger-types';
import { formatCurrency, formatDate } from './ledger-utils';

const API_URL = process.env.NEXT_PUBLIC_API_URL || '';

const CONFIDENCE_STYLES = {
  high: 'bg-green-100 text-green-800',
  medium: 'bg-yellow-100 text-yellow-800',
  low: 'bg-gray-100 text-gray-600',
} as const;

const CONFIDENCE_LABELS = {
  high: 'Alta',
  medium: 'Media',
  low: 'Baja',
} as const;

interface Props {
  entryId: number;
  onLinked: () => void;
}

export function CfdiSuggestionPopover({ entryId, onLinked }: Props) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [linking, setLinking] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<CfdiSuggestion[]>([]);
  const [error, setError] = useState<string | null>(null);
  const popoverRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open]);

  const fetchSuggestions = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await authFetch(`${API_URL}/api/practice-management/ledger/${entryId}/cfdi-suggestions`);
      if (!res.ok) throw new Error('Error al buscar sugerencias');
      const result = await res.json();
      setSuggestions(result.data || []);
    } catch (err) {
      setError('No se pudieron cargar sugerencias');
      console.error('Error fetching CFDI suggestions:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleOpen = () => {
    setOpen(true);
    fetchSuggestions();
  };

  const handleLink = async (uuid: string) => {
    setLinking(uuid);
    try {
      const res = await authFetch(`${API_URL}/api/practice-management/ledger/${entryId}/link-cfdi`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ uuid }),
      });
      if (!res.ok) {
        const result = await res.json();
        throw new Error(result.error || 'Error al vincular');
      }
      setOpen(false);
      onLinked();
    } catch (err: any) {
      setError(err.message || 'Error al vincular CFDI');
    } finally {
      setLinking(null);
    }
  };

  return (
    <div className="relative" ref={popoverRef}>
      <button
        onClick={handleOpen}
        className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-amber-100 text-amber-800 hover:bg-amber-200 transition-colors"
        title="Buscar CFDI del SAT"
      >
        <FileSearch className="w-3 h-3" />
        CFDI
      </button>

      {open && (
        <div className="absolute z-50 right-0 top-full mt-1 w-80 bg-white rounded-lg shadow-xl border border-gray-200 overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-3 py-2 bg-gray-50 border-b border-gray-200">
            <h4 className="text-sm font-semibold text-gray-900">Sugerencias CFDI</h4>
            <button onClick={() => setOpen(false)} className="text-gray-400 hover:text-gray-600">
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Content */}
          <div className="max-h-72 overflow-y-auto">
            {loading && (
              <div className="flex items-center justify-center py-6">
                <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
                <span className="ml-2 text-sm text-gray-500">Buscando...</span>
              </div>
            )}

            {error && (
              <div className="flex items-center gap-2 px-3 py-3 text-sm text-red-600">
                <AlertCircle className="w-4 h-4 shrink-0" />
                {error}
              </div>
            )}

            {!loading && !error && suggestions.length === 0 && (
              <div className="px-3 py-6 text-center text-sm text-gray-500">
                No se encontraron CFDIs compatibles
              </div>
            )}

            {!loading && suggestions.map((s) => (
              <div key={s.uuid} className="px-3 py-2.5 border-b border-gray-100 last:border-b-0 hover:bg-gray-50">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 mb-1">
                      <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${CONFIDENCE_STYLES[s.confidence]}`}>
                        {CONFIDENCE_LABELS[s.confidence]}
                      </span>
                      <span className="text-[10px] text-gray-500">
                        {s.direction === 'received' ? 'Recibido' : 'Emitido'}
                      </span>
                    </div>
                    <p className="text-sm font-medium text-gray-900 truncate">
                      {s.direction === 'received' ? (s.issuerName || s.issuerRfc) : (s.receiverName || s.receiverRfc)}
                    </p>
                    <div className="flex items-center gap-2 mt-0.5 text-xs text-gray-500">
                      <span>{formatCurrency(s.monto)}</span>
                      <span>&middot;</span>
                      <span>{formatDate(s.issuedAt)}</span>
                    </div>
                    <p className="text-[10px] text-gray-400 mt-0.5 truncate font-mono">{s.uuid}</p>
                  </div>
                  <button
                    onClick={() => handleLink(s.uuid)}
                    disabled={linking !== null}
                    className="shrink-0 inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded bg-teal-600 text-white hover:bg-teal-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    {linking === s.uuid ? (
                      <Loader2 className="w-3 h-3 animate-spin" />
                    ) : (
                      <Link2 className="w-3 h-3" />
                    )}
                    Vincular
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
