'use client';

import { FORMAS_DE_PAGO } from '../../flujo-de-dinero/_components/ledger-types';

/**
 * H-001 / H-036 (2026-10-05): la venta no preguntaba cómo se cobró, y su ingreso en Flujo de Dinero
 * nacía siempre «transferencia» aunque el paciente pagara en efectivo. Misma lista que Flujo
 * (`FORMAS_DE_PAGO`); default «Efectivo», como «Completar cita». Se pide SIEMPRE (también en una venta
 * pendiente: cobrarla después desde la lista —«registrar monto»— no vuelve a preguntar).
 *
 * Un valor que no está en la lista (o vacío = no registrado) se MUESTRA tal cual, en vez de que el
 * select enseñe «Efectivo» como si eso estuviera guardado.
 */
export function FormaDePagoVenta({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const conocido = FORMAS_DE_PAGO.some((f) => f.value === value);
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-2">Forma de pago *</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
      >
        {!conocido && <option value={value}>{value || 'Sin registrar'}</option>}
        {FORMAS_DE_PAGO.map((f) => (
          <option key={f.value} value={f.value}>{f.label}</option>
        ))}
      </select>
    </div>
  );
}
