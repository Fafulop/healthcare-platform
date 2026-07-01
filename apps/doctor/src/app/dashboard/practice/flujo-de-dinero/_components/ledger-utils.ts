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

// First openable factura file for an entry (uploaded PDF, or an uploaded XML that has a real URL).
// Used to view a factura that has no linked SAT CFDI. Returns null when there's nothing to open.
export function getFacturaFileUrl(entry: LedgerEntry): string | null {
  const fromPdf = (entry.facturas || []).find((f: any) => f?.fileUrl)?.fileUrl;
  if (fromPdf) return fromPdf;
  const fromXml = (entry.facturasXml || []).find((f: any) => f?.fileUrl)?.fileUrl;
  return fromXml || null;
}

export interface MonthlyRow {
  key: string;       // YYYY-MM
  label: string;     // "Ene 2026"
  ingresos: number;
  egresos: number;
}

export interface EstadoResultadosData {
  ingresos: Record<string, Record<string, number>>;
  egresos: Record<string, Record<string, number>>;
  ingresosByService: Record<string, number>;
  cuentasPorCobrar: number;
  cuentasPorPagar: number;
  flujoPorFormaPago: Record<string, { ingresos: number; egresos: number }>;
  monthly: MonthlyRow[];
}

const MONTH_NAMES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

export function processEstadoResultados(
  entries: LedgerEntry[],
  estadoStartDate: string,
  estadoEndDate: string
): EstadoResultadosData {
  const result: EstadoResultadosData = {
    ingresos: {},
    egresos: {},
    ingresosByService: {},
    cuentasPorCobrar: 0,
    cuentasPorPagar: 0,
    flujoPorFormaPago: {},
    monthly: [],
  };

  const monthlyMap: Record<string, { ingresos: number; egresos: number }> = {};

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
      const area = entry.area || 'Sin Área';
      const subarea = entry.subarea || 'Sin Subárea';

      // Forma de pago breakdown
      const fp = entry.formaDePago || 'Sin especificar';
      if (!result.flujoPorFormaPago[fp]) result.flujoPorFormaPago[fp] = { ingresos: 0, egresos: 0 };

      // Monthly breakdown
      const monthKey = entry.transactionDate.slice(0, 7); // YYYY-MM
      if (!monthlyMap[monthKey]) monthlyMap[monthKey] = { ingresos: 0, egresos: 0 };

      if (entry.entryType === 'ingreso') {
        if (!result.ingresos[area]) result.ingresos[area] = {};
        result.ingresos[area][subarea] = (result.ingresos[area][subarea] || 0) + amountPaid;
        const svcKey = entry.serviceName || 'Sin servicio';
        result.ingresosByService[svcKey] = (result.ingresosByService[svcKey] || 0) + amountPaid;
        result.cuentasPorCobrar += saldo;
        result.flujoPorFormaPago[fp].ingresos += amountPaid;
        monthlyMap[monthKey].ingresos += amountPaid;
      } else if (entry.entryType === 'egreso') {
        if (!result.egresos[area]) result.egresos[area] = {};
        result.egresos[area][subarea] = (result.egresos[area][subarea] || 0) + amountPaid;
        result.cuentasPorPagar += saldo;
        result.flujoPorFormaPago[fp].egresos += amountPaid;
        monthlyMap[monthKey].egresos += amountPaid;
      }
    });

  // Convert monthly map to sorted array
  result.monthly = Object.entries(monthlyMap)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, data]) => {
      const [y, m] = key.split('-');
      return { key, label: `${MONTH_NAMES[parseInt(m, 10) - 1]} ${y}`, ...data };
    });

  return result;
}
