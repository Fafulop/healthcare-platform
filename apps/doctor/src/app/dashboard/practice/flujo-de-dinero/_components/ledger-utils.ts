import type { LedgerEntry, Area } from './ledger-types';

export function formatCurrency(amount: string | number): string {
  return new Intl.NumberFormat('es-MX', {
    style: 'currency',
    currency: 'MXN',
  }).format(typeof amount === 'string' ? parseFloat(amount) : amount);
}

export function formatDate(dateString: string): string {
  const [year, month, day] = dateString.split('T')[0].split('-').map(Number);
  if (year && month && day) {
    const date = new Date(year, month - 1, day);
    return date.toLocaleDateString('es-MX', { year: 'numeric', month: 'short', day: 'numeric' });
  }
  return dateString;
}

export function cleanConcept(concept: string): string {
  const ventaMatch = concept.match(/^Venta VTA-\d{4}-\d{3} - Cliente: (.+)$/);
  if (ventaMatch) return ventaMatch[1];
  const compraMatch = concept.match(/^Compra CMP-\d{4}-\d{3} - Proveedor: (.+)$/);
  if (compraMatch) return compraMatch[1];
  return concept;
}

export function getAvailableAreasForEntry(entry: LedgerEntry, areas: Area[]): Area[] {
  return areas.filter(a =>
    entry.entryType === 'ingreso' ? a.type === 'INGRESO' : a.type === 'EGRESO'
  );
}

export interface EstadoResultadosData {
  ingresos: Record<string, Record<string, number>>;
  egresos: Record<string, Record<string, number>>;
  cuentasPorCobrar: number;
  cuentasPorPagar: number;
}

export function processEstadoResultados(
  entries: LedgerEntry[],
  estadoStartDate: string,
  estadoEndDate: string
): EstadoResultadosData {
  const result: EstadoResultadosData = {
    ingresos: {},
    egresos: {},
    cuentasPorCobrar: 0,
    cuentasPorPagar: 0,
  };

  entries
    .filter(entry => {
      const d = entry.transactionDate.split('T')[0];
      if (estadoStartDate && d < estadoStartDate) return false;
      if (estadoEndDate && d > estadoEndDate) return false;
      return true;
    })
    .forEach(entry => {
      const amount = parseFloat(entry.amount);
      const amountPaid = parseFloat(entry.amountPaid || '0');
      const saldo = amount - amountPaid;

      if (entry.entryType === 'ingreso') {
        if (!result.ingresos[entry.area]) result.ingresos[entry.area] = {};
        result.ingresos[entry.area][entry.subarea] = (result.ingresos[entry.area][entry.subarea] || 0) + amountPaid;
        result.cuentasPorCobrar += saldo;
      } else if (entry.entryType === 'egreso') {
        if (!result.egresos[entry.area]) result.egresos[entry.area] = {};
        result.egresos[entry.area][entry.subarea] = (result.egresos[entry.area][entry.subarea] || 0) + amountPaid;
        result.cuentasPorPagar += saldo;
      }
    });

  return result;
}
