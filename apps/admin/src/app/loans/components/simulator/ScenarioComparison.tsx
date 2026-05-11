"use client";

import type { Scenario } from "../../lib/types";
import { formatMXN, formatPct } from "../../lib/loan-math";
import { X } from "lucide-react";

interface Props {
  scenarios: Scenario[];
  onRemove: (id: string) => void;
}

export default function ScenarioComparison({ scenarios, onRemove }: Props) {
  if (scenarios.length === 0) return null;

  const metrics: { label: string; getter: (s: Scenario) => string; highlight?: (s: Scenario) => string }[] = [
    { label: "Monto", getter: (s) => formatMXN(s.params.principal) },
    { label: "Tasa", getter: (s) => formatPct(s.params.annualRate) },
    { label: "Plazo", getter: (s) => `${s.params.termMonths}m` },
    { label: "CoF", getter: (s) => formatPct(s.params.cofRate) },
    { label: "Default Rate", getter: (s) => formatPct(s.params.defaultRate) },
    { label: "Pago Mensual", getter: (s) => formatMXN(s.result.monthlyPayment) },
    { label: "Ingreso Bruto", getter: (s) => formatMXN(s.result.grossRevenue) },
    { label: "Costo Fondeo", getter: (s) => formatMXN(s.result.cofTotal) },
    { label: "Provisiones", getter: (s) => formatMXN(s.result.provisionAmount) },
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
    {
      label: "ROI Anualizado",
      getter: (s) => formatPct(s.result.annualizedROI),
      highlight: () => "text-purple-600 font-bold",
    },
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
              <tr key={m.label} className="border-b border-gray-50 hover:bg-gray-50">
                <td className="px-3 py-1.5 text-gray-600 text-xs">{m.label}</td>
                {scenarios.map((s, i) => (
                  <td
                    key={s.id}
                    className={`px-3 py-1.5 text-center border-l ${m.highlight?.(s) ?? "text-gray-700"}`}
                  >
                    {m.getter(s)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
