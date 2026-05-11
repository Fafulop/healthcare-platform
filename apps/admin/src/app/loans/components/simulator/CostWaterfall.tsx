"use client";

import type { LoanProfitResult } from "../../lib/types";
import { formatMXN, formatPct } from "../../lib/loan-math";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
  ReferenceLine,
} from "recharts";

interface Props {
  result: LoanProfitResult;
}

export default function CostWaterfall({ result }: Props) {
  const data = [
    { name: "Intereses", value: result.totalInterest, color: "#2563eb" },
    { name: "Comision", value: result.originationFee, color: "#3b82f6" },
    { name: "Costo Fondeo", value: -result.cofTotal, color: "#ef4444" },
    { name: "Provisiones", value: -result.provisionAmount, color: "#f97316" },
    { name: "OpEx", value: -result.opExTotal, color: "#eab308" },
    { name: "Utilidad", value: result.netProfit, color: result.netProfit >= 0 ? "#22c55e" : "#ef4444" },
  ];

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <div className="px-4 py-3 border-b border-gray-100 bg-gray-50">
        <h3 className="text-sm font-semibold text-gray-700">Desglose de Costos e Ingresos</h3>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 p-4">
        <SummaryCard
          label="Pago Mensual"
          value={formatMXN(result.monthlyPayment)}
          sublabel="Lo que paga el doctor"
          color="text-gray-900"
        />
        <SummaryCard
          label="Ingreso Bruto"
          value={formatMXN(result.grossRevenue)}
          sublabel={`Intereses + comision`}
          color="text-blue-600"
        />
        <SummaryCard
          label="Costos Totales"
          value={formatMXN(result.totalCosts)}
          sublabel={`CoF + prov + OpEx`}
          color="text-red-600"
        />
        <SummaryCard
          label="Utilidad Neta"
          value={formatMXN(result.netProfit)}
          sublabel={`${formatPct(result.profitMargin)} margen`}
          color={result.netProfit >= 0 ? "text-green-600" : "text-red-600"}
        />
        <SummaryCard
          label="ROI Anualizado"
          value={formatPct(result.annualizedROI)}
          sublabel={`${formatMXN(result.monthlyProfit)}/mes`}
          color="text-purple-600"
        />
      </div>

      {/* Waterfall Chart */}
      <div className="px-4 pb-4" style={{ height: 280 }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis dataKey="name" tick={{ fontSize: 11 }} />
            <YAxis
              tick={{ fontSize: 11 }}
              tickFormatter={(v) => `${(v / 1000).toFixed(0)}K`}
            />
            <Tooltip
              formatter={(value) => [formatMXN(Math.abs(Number(value))), ""]}
              labelFormatter={(label) => String(label)}
            />
            <ReferenceLine y={0} stroke="#374151" />
            <Bar dataKey="value" radius={[4, 4, 0, 0]}>
              {data.map((entry, i) => (
                <Cell key={i} fill={entry.color} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Cost Detail Table */}
      <div className="px-4 pb-4">
        <table className="w-full text-sm">
          <tbody>
            <CostRow label="Ingreso por intereses" value={result.totalInterest} positive />
            <CostRow label="Comision de apertura (con IVA)" value={result.originationFee} positive />
            <tr className="border-t border-gray-200 font-semibold">
              <td className="py-1.5 text-gray-700">= Ingreso bruto</td>
              <td className="py-1.5 text-right text-blue-600">{formatMXN(result.grossRevenue)}</td>
            </tr>
            <CostRow label={`Costo de fondeo (Y1: ${formatMXN(result.cofBreakdown.year1)}, Y2: ${formatMXN(result.cofBreakdown.year2)}${result.cofBreakdown.year3 > 0 ? `, Y3: ${formatMXN(result.cofBreakdown.year3)}` : ""})`} value={result.cofTotal} />
            <CostRow label="Provision por perdidas (PD x LGD)" value={result.provisionAmount} />
            <CostRow label="Gastos operativos" value={result.opExTotal} />
            <tr className="border-t-2 border-gray-300 font-bold text-base">
              <td className="py-2 text-gray-900">= Utilidad neta por prestamo</td>
              <td className={`py-2 text-right ${result.netProfit >= 0 ? "text-green-600" : "text-red-600"}`}>
                {formatMXN(result.netProfit)}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}

function SummaryCard({
  label,
  value,
  sublabel,
  color,
}: {
  label: string;
  value: string;
  sublabel: string;
  color: string;
}) {
  return (
    <div className="bg-gray-50 rounded-lg px-3 py-2">
      <div className="text-xs text-gray-500">{label}</div>
      <div className={`text-lg font-bold ${color}`}>{value}</div>
      <div className="text-xs text-gray-400">{sublabel}</div>
    </div>
  );
}

function CostRow({
  label,
  value,
  positive,
}: {
  label: string;
  value: number;
  positive?: boolean;
}) {
  return (
    <tr className="border-b border-gray-50">
      <td className="py-1.5 text-gray-600">{label}</td>
      <td className={`py-1.5 text-right ${positive ? "text-green-600" : "text-red-500"}`}>
        {positive ? "+" : "-"}
        {formatMXN(Math.abs(value))}
      </td>
    </tr>
  );
}
