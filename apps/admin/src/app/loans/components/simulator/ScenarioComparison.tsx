"use client";

import { Fragment } from "react";
import type { Scenario } from "../../lib/types";
import { formatMXN, formatPct } from "../../lib/loan-math";
import { X } from "lucide-react";

interface Props {
  scenarios: Scenario[];
  onRemove: (id: string) => void;
}

export default function ScenarioComparison({ scenarios, onRemove }: Props) {
  if (scenarios.length === 0) return null;

  const metrics: { label: string; getter: (s: Scenario) => string; highlight?: (s: Scenario) => string; section?: string }[] = [
    // Params
    { label: "Monto", getter: (s) => formatMXN(s.params.principal), section: "PARAMETROS" },
    { label: "Tasa", getter: (s) => formatPct(s.params.annualRate) },
    { label: "Plazo", getter: (s) => `${s.params.termMonths}m${s.params.prepaymentMonth > 0 ? ` (prepago m${s.params.prepaymentMonth})` : ""}` },
    { label: "CoF", getter: (s) => formatPct(s.params.cofRate) },
    { label: "Default Rate", getter: (s) => formatPct(s.params.defaultRate) },
    // Borrower
    { label: "Pago Mensual", getter: (s) => formatMXN(s.result.monthlyPayment), section: "DOCTOR" },
    { label: "DTI", getter: (s) => formatPct(s.result.dti), highlight: (s) => s.result.dti <= 0.35 ? "text-green-600 font-bold" : s.result.dti <= 0.50 ? "text-amber-600 font-bold" : "text-red-600 font-bold" },
    { label: "DSCR", getter: (s) => `${s.result.dscr.toFixed(2)}x`, highlight: (s) => s.result.dscr >= 1.5 ? "text-green-600 font-bold" : s.result.dscr >= 1.2 ? "text-amber-600 font-bold" : "text-red-600 font-bold" },
    { label: "CAT", getter: (s) => formatPct(s.result.cat), highlight: (s) => s.result.cat > 1.0 ? "text-red-600 font-bold" : "text-gray-700" },
    // P&L
    { label: "Ingreso Bruto", getter: (s) => formatMXN(s.result.grossRevenue), section: "RESULTADOS" },
    { label: "Costos Totales", getter: (s) => formatMXN(s.result.totalCosts) },
    {
      label: "Utilidad Neta",
      getter: (s) => formatMXN(s.result.netProfit),
      highlight: (s) => (s.result.netProfit >= 0 ? "text-green-600 font-bold" : "text-red-600 font-bold"),
    },
    {
      label: "Margen",
      getter: (s) => formatPct(s.result.profitMargin),
      highlight: (s) => (s.result.profitMargin >= 0.4 ? "text-green-600 font-bold" : "text-gray-700"),
    },
    // Returns
    { label: "TIR (IRR)", getter: (s) => `${formatPct(s.result.irr)} ${s.result.hurdleCleared ? "✓" : "✗"}`, highlight: (s) => s.result.hurdleCleared ? "text-green-600 font-bold" : "text-red-600 font-bold", section: "RETORNOS" },
    { label: "MOIC", getter: (s) => `${s.result.moic.toFixed(2)}x`, highlight: () => "text-indigo-600 font-bold" },
    { label: "RAROC", getter: (s) => formatPct(s.result.raroc), highlight: () => "text-violet-600 font-bold" },
    { label: "Spread", getter: (s) => formatPct(s.result.spread) },
    { label: "NIM", getter: (s) => formatPct(s.result.nim) },
    { label: "ROE", getter: (s) => formatPct(s.result.roe) },
    { label: "ROA", getter: (s) => formatPct(s.result.roa) },
    { label: "OSS", getter: (s) => `${(s.result.oss * 100).toFixed(0)}%`, highlight: (s) => s.result.oss >= 1 ? "text-green-600 font-bold" : "text-red-600 font-bold" },
    // Structural
    { label: "EAD", getter: (s) => formatMXN(s.result.ead), section: "ESTRUCTURA" },
    { label: "WAL", getter: (s) => `${s.result.wal.toFixed(1)} anos` },
    { label: "Payback", getter: (s) => s.result.paybackMonth > 0 ? `Mes ${s.result.paybackMonth}` : "N/A" },
    { label: "Break-even", getter: (s) => `${s.result.breakEvenLoans} prestamos` },
    { label: "Utilidad/Mes", getter: (s) => formatMXN(s.result.monthlyProfit) },
  ];

  const colors = ["bg-blue-50 border-blue-200", "bg-green-50 border-green-200", "bg-purple-50 border-purple-200", "bg-amber-50 border-amber-200"];

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <div className="px-4 py-3 border-b border-gray-100 bg-gray-50">
        <h3 className="text-sm font-semibold text-gray-700">
          Comparacion de Escenarios ({scenarios.length})
        </h3>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50">
              <th className="px-3 py-2 text-left text-xs text-gray-500 uppercase w-40">Metrica</th>
              {scenarios.map((s, i) => (
                <th key={s.id} className={`px-3 py-2 text-center border-l ${colors[i % colors.length]}`}>
                  <div className="flex items-center justify-center gap-2">
                    <span className="font-semibold text-gray-700">{s.name}</span>
                    <button
                      onClick={() => onRemove(s.id)}
                      className="text-gray-400 hover:text-red-500 transition"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {metrics.map((m) => (
              <Fragment key={m.label}>
                {m.section && (
                  <tr className="bg-gray-100">
                    <td
                      colSpan={scenarios.length + 1}
                      className="px-3 py-1 text-xs font-bold text-gray-500 uppercase tracking-wider"
                    >
                      {m.section}
                    </td>
                  </tr>
                )}
                <tr className="border-b border-gray-50 hover:bg-gray-50">
                  <td className="px-3 py-1.5 text-gray-600 text-xs">{m.label}</td>
                  {scenarios.map((s) => (
                    <td
                      key={s.id}
                      className={`px-3 py-1.5 text-center border-l ${m.highlight?.(s) ?? "text-gray-700"}`}
                    >
                      {m.getter(s)}
                    </td>
                  ))}
                </tr>
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
