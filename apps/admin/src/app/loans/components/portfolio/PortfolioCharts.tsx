"use client";

import type { PortfolioSummary } from "../../lib/types";
import { formatMXN } from "../../lib/loan-math";
import {
  AreaChart,
  Area,
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";

interface Props {
  summary: PortfolioSummary;
}

export default function PortfolioCharts({ summary }: Props) {
  const { projections, breakEvenMonth } = summary;

  return (
    <div className="space-y-6">
      {/* KPI Cards — Row 1: Core */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <KpiCard
          label="Break-Even"
          value={breakEvenMonth ? `Mes ${breakEvenMonth}` : "No alcanzado"}
          color={breakEvenMonth ? "text-green-600" : "text-red-600"}
        />
        <KpiCard
          label="Cartera Max"
          value={formatMXN(summary.peakOutstanding)}
          color="text-blue-600"
        />
        <KpiCard
          label="Utilidad Total"
          value={formatMXN(summary.totalProfit)}
          color={summary.totalProfit >= 0 ? "text-green-600" : "text-red-600"}
        />
        <KpiCard
          label="ROA Promedio"
          value={`${(summary.avgROA * 100).toFixed(1)}%`}
          color="text-purple-600"
        />
      </div>
      {/* KPI Cards — Row 2: Risk & Efficiency */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
        <KpiCard
          label="PaR / IMOR"
          value={`${(summary.finalPar30 * 100).toFixed(2)}%`}
          color={summary.finalPar30 < 0.05 ? "text-green-600" : summary.finalPar30 < 0.10 ? "text-amber-600" : "text-red-600"}
        />
        <KpiCard
          label="Write-Off"
          value={`${(summary.finalWriteOffRatio * 100).toFixed(2)}%`}
          color="text-orange-600"
        />
        <KpiCard
          label="Collection Rate"
          value={`${(summary.avgCollectionRate * 100).toFixed(1)}%`}
          color={summary.avgCollectionRate > 0.95 ? "text-green-600" : "text-amber-600"}
        />
        <KpiCard
          label="OER"
          value={`${(summary.finalOER * 100).toFixed(1)}%`}
          color="text-rose-600"
        />
        <KpiCard
          label="OSS"
          value={`${(summary.finalOSS * 100).toFixed(0)}%`}
          color={summary.finalOSS >= 1 ? "text-green-600" : "text-red-600"}
        />
        <KpiCard
          label="NIM"
          value={`${(summary.finalNIM * 100).toFixed(1)}%`}
          color="text-amber-600"
        />
        <KpiCard
          label="Yield"
          value={`${(summary.finalPortfolioYield * 100).toFixed(1)}%`}
          color="text-indigo-600"
        />
      </div>

      {/* Cumulative Profit */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100 bg-gray-50">
          <h3 className="text-sm font-semibold text-gray-700">Utilidad Acumulada</h3>
        </div>
        <div className="px-4 pt-4 pb-2" style={{ height: 260 }}>
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={projections} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="month" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `${(v / 1000000).toFixed(1)}M`} />
              <Tooltip
                formatter={(value) => [formatMXN(Number(value)), ""]}
                labelFormatter={(v) => `Mes ${v}`}
              />
              <ReferenceLine y={0} stroke="#374151" strokeWidth={2} />
              {breakEvenMonth && (
                <ReferenceLine
                  x={breakEvenMonth}
                  stroke="#22c55e"
                  strokeDasharray="4 4"
                  label={{ value: "Break-even", position: "top", fontSize: 10 }}
                />
              )}
              <Area
                type="monotone"
                dataKey="cumulativeProfit"
                stroke="#2563eb"
                fill="#dbeafe"
                strokeWidth={2}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Portfolio Outstanding */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100 bg-gray-50">
          <h3 className="text-sm font-semibold text-gray-700">Cartera Vigente</h3>
        </div>
        <div className="px-4 pt-4 pb-2" style={{ height: 260 }}>
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={projections} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="month" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `${(v / 1000000).toFixed(1)}M`} />
              <Tooltip
                formatter={(value) => [formatMXN(Number(value)), ""]}
                labelFormatter={(v) => `Mes ${v}`}
              />
              <Area
                type="monotone"
                dataKey="portfolioOutstanding"
                stroke="#8b5cf6"
                fill="#ede9fe"
                strokeWidth={2}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Monthly P&L */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100 bg-gray-50">
          <h3 className="text-sm font-semibold text-gray-700">P&L Mensual</h3>
        </div>
        <div className="px-4 pt-4 pb-2" style={{ height: 280 }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={projections} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="month" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `${(v / 1000).toFixed(0)}K`} />
              <Tooltip
                formatter={(value, name) => {
                  const labels: Record<string, string> = {
                    monthlyRevenue: "Ingresos",
                    monthlyCof: "CoF",
                    monthlyProvisions: "Provisiones",
                    monthlyOpex: "OpEx",
                    monthlyFixedCosts: "Costos Fijos",
                    monthlyNetIncome: "Utilidad Neta",
                  };
                  return [formatMXN(Number(value)), labels[String(name)] ?? String(name)];
                }}
                labelFormatter={(v) => `Mes ${v}`}
              />
              <ReferenceLine y={0} stroke="#374151" />
              <Bar dataKey="monthlyRevenue" fill="#3b82f6" stackId="income" />
              <Bar dataKey="monthlyNetIncome" fill="#22c55e" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Active Loans */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100 bg-gray-50">
          <h3 className="text-sm font-semibold text-gray-700">Prestamos Activos y Defaults Acumulados</h3>
        </div>
        <div className="px-4 pt-4 pb-2" style={{ height: 260 }}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={projections} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="month" tick={{ fontSize: 11 }} />
              <YAxis yAxisId="left" tick={{ fontSize: 11 }} />
              <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11 }} />
              <Tooltip
                formatter={(value, name) => {
                  const labels: Record<string, string> = {
                    activeLoans: "Prestamos Activos",
                    cumulativeDefaults: "Defaults Acumulados",
                  };
                  return [Number(value).toFixed(1), labels[String(name)] ?? String(name)];
                }}
                labelFormatter={(v) => `Mes ${v}`}
              />
              <Line yAxisId="left" type="monotone" dataKey="activeLoans" stroke="#2563eb" strokeWidth={2} dot={false} />
              <Line yAxisId="right" type="monotone" dataKey="cumulativeDefaults" stroke="#ef4444" strokeWidth={1.5} strokeDasharray="4 4" dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Risk & Efficiency Metrics Over Time */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100 bg-gray-50">
          <h3 className="text-sm font-semibold text-gray-700">Metricas de Riesgo y Eficiencia</h3>
          <p className="text-xs text-gray-500 mt-0.5">PaR/IMOR, OER, OSS y NIM a lo largo del tiempo</p>
        </div>
        <div className="px-4 pt-4 pb-2" style={{ height: 280 }}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart
              data={projections.map((p) => ({
                month: p.month,
                par30: p.par30 * 100,
                oer: p.oer * 100,
                oss: p.oss * 100,
                nim: p.nim * 100,
                portfolioYield: p.portfolioYield * 100,
              }))}
              margin={{ top: 10, right: 10, left: 10, bottom: 0 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="month" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `${v.toFixed(0)}%`} />
              <Tooltip
                formatter={(value, name) => {
                  const labels: Record<string, string> = {
                    par30: "PaR / IMOR",
                    oer: "OER",
                    oss: "OSS",
                    nim: "NIM",
                    portfolioYield: "Yield",
                  };
                  return [`${Number(value).toFixed(1)}%`, labels[String(name)] ?? String(name)];
                }}
                labelFormatter={(v) => `Mes ${v}`}
              />
              <ReferenceLine y={100} stroke="#22c55e" strokeDasharray="4 4" label={{ value: "OSS 100%", position: "right", fontSize: 9 }} />
              <Line type="monotone" dataKey="par30" stroke="#ef4444" strokeWidth={2} dot={false} name="par30" />
              <Line type="monotone" dataKey="oer" stroke="#f97316" strokeWidth={1.5} dot={false} name="oer" />
              <Line type="monotone" dataKey="oss" stroke="#22c55e" strokeWidth={2} dot={false} name="oss" />
              <Line type="monotone" dataKey="nim" stroke="#eab308" strokeWidth={1.5} strokeDasharray="4 4" dot={false} name="nim" />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}

function KpiCard({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 px-4 py-3">
      <div className="text-xs text-gray-500">{label}</div>
      <div className={`text-lg font-bold ${color}`}>{value}</div>
    </div>
  );
}
