'use client';

import { useCallback, useEffect, useState } from 'react';
import { Receipt } from 'lucide-react';
import { authFetch } from '@/lib/auth-fetch';
import { toast } from '@/lib/practice-toast';
import { useAlVolverALaPestana } from '@/lib/use-al-volver-a-la-pestana';

const API_URL = process.env.NEXT_PUBLIC_API_URL || '';

interface FacturaSinCita {
  id: number;
  folio: string | null;
  uuid: string;
  total: number;
  status: string;
  issuedAt: string;
  concepto: string | null;
  deVenta: boolean;
  deTratamiento: boolean;
}

const pesos = (n: number) => `$${n.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
// `issuedAt` es un TIMESTAMP: se lee en la zona de la clínica.
const fecha = (iso: string) =>
  new Date(iso).toLocaleDateString('es-MX', { timeZone: 'America/Mexico_City', day: 'numeric', month: 'short', year: 'numeric' });

/**
 * 2026-10-12 — «Otras facturas del paciente» en su «Cobros»: las que NO son de una cita (una factura
 * manual hecha en Facturación, la de una venta o la de un tratamiento; sólo de ingreso). Sólo lectura, con su PDF / XML. Sólo aparece si hay alguna.
 * (El botón «Nueva factura manual» de aquí y del perfil se quitó: la factura manual se hace en Facturación.)
 */
export function OtrasFacturas({ patientId }: { patientId: string }) {
  const [facturas, setFacturas] = useState<FacturaSinCita[] | null | 'error'>(null);

  const cargar = useCallback(async (silencioso = false) => {
    try {
      const d = await fetch(`/api/medical-records/patients/${patientId}/facturas-sin-cita`).then((r) => r.json());
      if (!d?.success) throw new Error();
      setFacturas(d.data ?? []);
    } catch {
      if (!silencioso) setFacturas('error');
    }
  }, [patientId]);
  useEffect(() => { cargar(); }, [cargar]);
  useAlVolverALaPestana(() => cargar(true));

  const descargar = async (cfdiId: number, formato: 'pdf' | 'xml') => {
    try {
      const res = await authFetch(`${API_URL}/api/facturacion/cfdi/${cfdiId}/${formato}`);
      if (!res.ok) throw new Error();
      const url = URL.createObjectURL(await res.blob());
      const a = document.createElement('a');
      a.href = url;
      a.download = `factura_${cfdiId}.${formato}`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      toast.error(`Error al descargar el ${formato.toUpperCase()}`);
    }
  };

  if (facturas === null || (Array.isArray(facturas) && facturas.length === 0)) return null;
  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h2 className="text-xl font-semibold text-gray-900 flex items-center gap-2 mb-1">
        <Receipt className="w-5 h-5 text-teal-600" /> Otras facturas del paciente
      </h2>
      <p className="text-xs text-gray-500 mb-3">Las que no son de una cita (una factura manual, la de una venta o de un tratamiento), ligadas a su cobro o a su RFC. Las manuales se hacen en Facturación.</p>
      {facturas === 'error' ? (
        <p className="text-sm text-amber-700">No se pudieron cargar sus otras facturas. Recarga la página para intentar de nuevo.</p>
      ) : (
        <ul className="divide-y divide-gray-100">
          {facturas.map((f) => (
            <li key={f.id} className="py-3 flex items-center justify-between gap-3 flex-wrap">
              <div className="min-w-0">
                <p className="text-sm text-gray-900 flex items-center gap-2 flex-wrap">
                  <span className="font-medium">{pesos(f.total)}</span>
                  {f.folio && <span className="text-gray-500">Folio {f.folio}</span>}
                  {f.deVenta && <span className="text-[11px] px-1.5 py-0.5 rounded bg-gray-100 text-gray-600">De una venta</span>}
                  {f.deTratamiento && <span className="text-[11px] px-1.5 py-0.5 rounded bg-teal-50 text-teal-700">De un tratamiento</span>}
                  {f.status === 'cancelled' && <span className="text-[11px] px-1.5 py-0.5 rounded bg-red-100 text-red-700">Cancelada</span>}
                  {f.status === 'cancellation_pending' && <span className="text-[11px] px-1.5 py-0.5 rounded bg-amber-100 text-amber-800">Cancelación en proceso</span>}
                </p>
                <p className="text-xs text-gray-500 mt-0.5 truncate">{fecha(f.issuedAt)}{f.concepto ? ` · ${f.concepto}` : ''}</p>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <button onClick={() => descargar(f.id, 'pdf')} className="text-xs px-2 py-1 rounded bg-gray-100 text-gray-600 hover:bg-gray-200">PDF</button>
                <button onClick={() => descargar(f.id, 'xml')} className="text-xs px-2 py-1 rounded bg-gray-100 text-gray-600 hover:bg-gray-200">XML</button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
