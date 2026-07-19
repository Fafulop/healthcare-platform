'use client';

import { useEffect, useState, useCallback } from 'react';
import { X, Loader2, FileCheck2, Unlink, ExternalLink } from 'lucide-react';
import { authFetch } from '@/lib/auth-fetch';
import { SAT_FORMA_PAGO_LABELS, SAT_EFECTO_LABELS } from './ledger-types';
import type { LedgerEntry } from './ledger-types';

const API_URL = process.env.NEXT_PUBLIC_API_URL || '';

interface Concepto {
  claveProdServ: string | null;
  descripcion: string | null;
  cantidad: number | null;
  valorUnitario: number | null;
  importe: number | null;
  ivaTrasladado: number | null;
}

interface CfdiDetail {
  uuid: string;
  subtotal: number | null;
  descuento: number | null;
  total: number | null;
  ivaTrasladado: number | null;
  isrRetenido: number | null;
  ivaRetenido: number | null;
  ieps: number | null;
  metodoPago: string | null;
  formaPago: string | null;
  usoCfdi: string | null;
  moneda: string | null;
  tipoCambio: number | null;
  serie: string | null;
  folio: string | null;
  lugarExpedicion: string | null;
  conceptos: Concepto[];
  metadata: {
    direction: string;
    efecto: string | null;
    issuerRfc: string;
    issuerName: string | null;
    receiverRfc: string;
    receiverName: string | null;
    monto: number | null;
    satStatus: string;
    issuedAt: string | null;
    certifiedAt: string | null;
  } | null;
}

/** CFDI emitted by the PLATFORM (cfdis_emitted) — the fallback source when the
 * uuid has no SAT XML detail (sandbox always; production until the first sync). */
interface PlatformCfdi {
  id: number;
  uuid: string;
  folio: string | null;
  serie: string | null;
  rfcEmisor: string;
  rfcReceptor: string;
  nombreReceptor: string;
  usoCfdi: string;
  subtotal: string | number;
  iva: string | number | null;
  retencionIsr: string | number | null;
  total: string | number;
  formaPago: string;
  metodoPago: string;
  status: string;
  issuedAt: string;
}

interface Props {
  entry: Pick<LedgerEntry, 'id' | 'satCfdiUuid' | 'facturas' | 'facturasXml'>;
  onClose: () => void;
  onUnlinked?: () => void;
}

const fmt = (n: number | null) =>
  n !== null ? `$${n.toLocaleString('es-MX', { minimumFractionDigits: 2 })}` : '—';

function Item({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <span className="text-gray-400">{label}:</span>{' '}
      <span className={`text-gray-700 ${mono ? 'font-mono' : ''}`}>{value}</span>
    </div>
  );
}

export function CfdiDetailModal({ entry, onClose, onUnlinked }: Props) {
  const uuid = entry.satCfdiUuid ?? null;
  const entryId = entry.id;
  const uploadedFiles = [
    ...(entry.facturas || []).filter((f: any) => f?.fileUrl).map((f: any) => ({ key: `pdf-${f.id}`, name: f.fileName as string, url: f.fileUrl as string, kind: 'PDF' })),
    ...(entry.facturasXml || []).filter((f: any) => f?.fileUrl).map((f: any) => ({ key: `xml-${f.id}`, name: f.fileName as string, url: f.fileUrl as string, kind: 'XML' })),
  ];
  const [data, setData] = useState<CfdiDetail | null>(null);
  const [platform, setPlatform] = useState<PlatformCfdi | null>(null);
  const [loading, setLoading] = useState(!!uuid);
  const [error, setError] = useState<string | null>(null);
  const [unlinking, setUnlinking] = useState(false);
  const [downloading, setDownloading] = useState<string | null>(null);

  const handleClose = useCallback(() => onClose(), [onClose]);

  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => { if (e.key === 'Escape') handleClose(); };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [handleClose]);

  useEffect(() => {
    if (!uuid) { setData(null); setPlatform(null); setError(null); setLoading(false); return; }
    let cancelled = false;
    setLoading(true);
    setError(null);

    (async () => {
      try {
        // 1st source: SAT XML detail (external CFDIs, or platform ones after a sync)
        const res = await authFetch(`${API_URL}/api/sat-descarga/details/${uuid}`);
        if (res.ok) {
          const json = await res.json();
          if (!cancelled) setData(json.data);
          return;
        }
        if (res.status !== 404) throw new Error('Error al cargar datos.');

        // 2nd source: platform-emitted CFDI (cfdis_emitted) — the ledger entry
        // may carry a uuid WE stamped at emission, which the SAT hasn't synced.
        const pRes = await authFetch(`${API_URL}/api/facturacion/cfdi?uuid=${encodeURIComponent(uuid)}`);
        const pBody = await pRes.json().catch(() => ({}));
        const record = Array.isArray(pBody.data) ? pBody.data[0] : null;
        if (record) {
          if (!cancelled) setPlatform(record as PlatformCfdi);
          return;
        }
        throw new Error('No hay detalles XML para este CFDI.');
      } catch (err: any) {
        if (!cancelled) setError(err.message || 'Error al cargar datos.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [uuid]);

  const downloadPlatformFile = async (format: 'pdf' | 'xml') => {
    if (!platform) return;
    setDownloading(format);
    try {
      const res = await authFetch(`${API_URL}/api/facturacion/cfdi/${platform.id}/${format}`);
      if (!res.ok) throw new Error();
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `factura_${platform.folio || platform.id}.${format}`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      alert(`No se pudo descargar el ${format.toUpperCase()}.`);
    } finally {
      setDownloading(null);
    }
  };

  const meta = data?.metadata;

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
            <FileCheck2 className="w-5 h-5 text-green-600" />
            <h3 className="text-lg font-bold text-gray-900">{uuid ? 'Factura CFDI' : 'Factura'}</h3>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 p-2 -mr-1">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4 min-h-0">
          {loading && (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-slate-400" />
            </div>
          )}

          {error && (
            <div className="text-center py-12">
              <p className="text-sm text-gray-500">{error}</p>
            </div>
          )}

          {data && (
            <>
              {/* Metadata */}
              {meta && (
                <div className="space-y-2">
                  <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Datos del CFDI</h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1.5 text-xs">
                    <Item label="UUID" value={data.uuid} mono />
                    <Item label="Status" value={meta.satStatus} />
                    <Item label="Emisor" value={`${meta.issuerName || '—'} (${meta.issuerRfc})`} />
                    <Item label="Receptor" value={`${meta.receiverName || '—'} (${meta.receiverRfc})`} />
                    {meta.issuedAt && (
                      <Item label="Fecha Emisión" value={new Date(meta.issuedAt).toLocaleString('es-MX', { dateStyle: 'medium', timeStyle: 'short' })} />
                    )}
                    {meta.certifiedAt && (
                      <Item label="Certificación SAT" value={new Date(meta.certifiedAt).toLocaleString('es-MX', { dateStyle: 'medium', timeStyle: 'short' })} />
                    )}
                    <Item label="Dirección" value={meta.direction === 'emitted' ? 'Emitido' : 'Recibido'} />
                    {meta.efecto && <Item label="Efecto" value={SAT_EFECTO_LABELS[meta.efecto] || meta.efecto} />}
                    {meta.monto !== null && <Item label="Monto" value={fmt(meta.monto)} />}
                  </div>
                </div>
              )}

              {/* Financial breakdown */}
              {data.total !== null && (
                <div className="space-y-2">
                  <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Desglose Fiscal</h4>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-1.5 text-xs">
                    <Item label="Subtotal" value={fmt(data.subtotal)} />
                    {data.descuento !== null && <Item label="Descuento" value={fmt(data.descuento)} />}
                    <Item label="IVA Trasladado" value={fmt(data.ivaTrasladado)} />
                    {data.isrRetenido !== null && <Item label="ISR Retenido" value={fmt(data.isrRetenido)} />}
                    {data.ivaRetenido !== null && <Item label="IVA Retenido" value={fmt(data.ivaRetenido)} />}
                    {data.ieps !== null && <Item label="IEPS" value={fmt(data.ieps)} />}
                    <Item label="Total" value={fmt(data.total)} />
                  </div>
                </div>
              )}

              {/* Payment info */}
              {(data.metodoPago || data.formaPago || data.usoCfdi) && (
                <div className="space-y-2">
                  <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Pago</h4>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-1.5 text-xs">
                    {data.metodoPago && <Item label="Método" value={data.metodoPago === 'PUE' ? 'PUE (Pago en una exhibición)' : 'PPD (Pago en parcialidades)'} />}
                    {data.formaPago && <Item label="Forma" value={`${data.formaPago} — ${SAT_FORMA_PAGO_LABELS[data.formaPago] || 'Otro'}`} />}
                    {data.usoCfdi && <Item label="Uso CFDI" value={data.usoCfdi} />}
                    {data.moneda && <Item label="Moneda" value={data.moneda} />}
                    {data.serie && <Item label="Serie" value={data.serie} />}
                    {data.folio && <Item label="Folio" value={data.folio} />}
                    {data.lugarExpedicion && <Item label="Lugar Exp. (CP)" value={data.lugarExpedicion} />}
                  </div>
                </div>
              )}

              {/* Conceptos table */}
              {data.conceptos.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                    Conceptos ({data.conceptos.length})
                  </h4>
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs border border-gray-200 rounded">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-2 py-1.5 text-left font-medium text-gray-600">Descripción</th>
                          <th className="px-2 py-1.5 text-right font-medium text-gray-600">Cant.</th>
                          <th className="px-2 py-1.5 text-right font-medium text-gray-600">P. Unit.</th>
                          <th className="px-2 py-1.5 text-right font-medium text-gray-600">Importe</th>
                          <th className="px-2 py-1.5 text-right font-medium text-gray-600">IVA</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {data.conceptos.map((c, i) => (
                          <tr key={i} className="hover:bg-gray-50">
                            <td className="px-2 py-1.5 max-w-[250px] truncate" title={c.descripcion || ''}>
                              {c.descripcion || '—'}
                              {c.claveProdServ && <span className="ml-1 text-gray-400">[{c.claveProdServ}]</span>}
                            </td>
                            <td className="px-2 py-1.5 text-right font-mono">{c.cantidad ?? '—'}</td>
                            <td className="px-2 py-1.5 text-right font-mono">{fmt(c.valorUnitario)}</td>
                            <td className="px-2 py-1.5 text-right font-mono">{fmt(c.importe)}</td>
                            <td className="px-2 py-1.5 text-right font-mono">{fmt(c.ivaTrasladado)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </>
          )}

          {/* Platform-emitted CFDI (no SAT XML yet — sandbox, or pre-first-sync) */}
          {platform && !data && (
            <>
              <div className="rounded-md bg-blue-50 border border-blue-200 px-3 py-2 text-xs text-blue-800">
                Factura emitida EN LA PLATAFORMA — datos del registro de emisión (el SAT aún no la reporta en Descarga).
              </div>
              <div className="space-y-2">
                <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Datos del CFDI</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1.5 text-xs">
                  <Item label="UUID" value={platform.uuid} mono />
                  <Item label="Status" value={platform.status === 'active' ? 'Vigente' : platform.status === 'cancellation_pending' ? 'Cancelación en proceso' : 'Cancelada'} />
                  <Item label="Emisor (RFC)" value={platform.rfcEmisor} />
                  <Item label="Receptor" value={`${platform.nombreReceptor} (${platform.rfcReceptor})`} />
                  <Item label="Fecha Emisión" value={new Date(platform.issuedAt).toLocaleString('es-MX', { dateStyle: 'medium', timeStyle: 'short' })} />
                  {platform.folio && <Item label="Folio" value={`${platform.serie ? platform.serie + '-' : ''}${platform.folio}`} />}
                </div>
              </div>
              <div className="space-y-2">
                <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Desglose Fiscal</h4>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-1.5 text-xs">
                  <Item label="Subtotal" value={fmt(Number(platform.subtotal))} />
                  <Item label="IVA Trasladado" value={fmt(platform.iva !== null ? Number(platform.iva) : null)} />
                  {platform.retencionIsr !== null && <Item label="ISR Retenido" value={fmt(Number(platform.retencionIsr))} />}
                  <Item label="Total" value={fmt(Number(platform.total))} />
                </div>
              </div>
              <div className="space-y-2">
                <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Pago</h4>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-1.5 text-xs">
                  <Item label="Método" value={platform.metodoPago === 'PUE' ? 'PUE (Pago en una exhibición)' : 'PPD (Pago en parcialidades)'} />
                  <Item label="Forma" value={`${platform.formaPago} — ${SAT_FORMA_PAGO_LABELS[platform.formaPago] || 'Otro'}`} />
                  <Item label="Uso CFDI" value={platform.usoCfdi} />
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => downloadPlatformFile('pdf')}
                  disabled={downloading !== null}
                  className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 border border-gray-300 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50 disabled:opacity-50"
                >
                  {downloading === 'pdf' ? <Loader2 className="w-4 h-4 animate-spin" /> : <ExternalLink className="w-4 h-4" />}
                  Descargar PDF
                </button>
                <button
                  onClick={() => downloadPlatformFile('xml')}
                  disabled={downloading !== null}
                  className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 border border-gray-300 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50 disabled:opacity-50"
                >
                  {downloading === 'xml' ? <Loader2 className="w-4 h-4 animate-spin" /> : <ExternalLink className="w-4 h-4" />}
                  Descargar XML
                </button>
              </div>
            </>
          )}

          {/* Uploaded factura files (PDF / XML) — always available, even without a linked CFDI */}
          {uploadedFiles.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Archivos de factura subidos</h4>
              <div className="space-y-2">
                {uploadedFiles.map(f => (
                  <div key={f.key} className="flex items-center justify-between p-2.5 bg-gray-50 rounded-lg border border-gray-100">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">{f.name}</p>
                      <p className="text-[10px] text-gray-400 uppercase">{f.kind}</p>
                    </div>
                    <a href={f.url} target="_blank" rel="noopener noreferrer"
                      className="flex items-center gap-1.5 text-sm text-blue-600 hover:text-blue-700 shrink-0 ml-3">
                      <ExternalLink className="w-4 h-4" />
                      Abrir
                    </a>
                  </div>
                ))}
              </div>
            </div>
          )}

          {!loading && !uuid && uploadedFiles.length === 0 && (
            <div className="text-center py-8 text-sm text-gray-500">Sin factura vinculada.</div>
          )}
        </div>

        {/* Footer — no Desvincular for platform-emitted CFDIs (that link is the
            emission itself; undoing it is CANCELLING the factura, not unlinking) */}
        <div className="px-5 py-3 border-t border-gray-200 flex gap-2">
          {uuid && entryId && onUnlinked && !platform && (
            <button
              onClick={async () => {
                if (!confirm('¿Desvincular esta factura CFDI del movimiento?')) return;
                setUnlinking(true);
                try {
                  const res = await authFetch(`${API_URL}/api/practice-management/ledger/${entryId}/link-cfdi`, { method: 'DELETE' });
                  if (res.ok) {
                    onUnlinked();
                    onClose();
                  } else {
                    const err = await res.json();
                    alert(err.error || 'Error al desvincular');
                  }
                } catch {
                  alert('Error de conexión');
                } finally {
                  setUnlinking(false);
                }
              }}
              disabled={unlinking}
              className="flex-1 inline-flex items-center justify-center gap-1.5 px-4 py-2.5 border border-red-300 text-red-700 rounded-lg text-sm font-medium hover:bg-red-50 disabled:opacity-50"
            >
              {unlinking ? <Loader2 className="w-4 h-4 animate-spin" /> : <Unlink className="w-4 h-4" />}
              Desvincular
            </button>
          )}
          <button onClick={onClose} className="flex-1 px-4 py-2.5 border border-gray-300 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50">
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
}
