"use client";

import type { PortfolioParams, PortfolioSummary, StressScenario } from "../../lib/types";
import { STRESS_SCENARIOS } from "../../lib/types";
import { projectWithStress } from "../../lib/portfolio-math";
import { formatMXN } from "../../lib/loan-math";

interface Props {
  params: PortfolioParams;
}

export default function StressTestPanel({ params }: Props) {
  const results: { scenario: StressScenario; summary: PortfolioSummary }[] =
    STRESS_SCENARIOS.map((scenario) => ({
      scenario,
      summary: projectWithStress(params, scenario),
    }));

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <div className="px-4 py-3 border-b border-gray-100 bg-gray-50">
        <h3 className="text-sm font-semibold text-gray-700">Stress Testing</h3>
        <p className="text-xs text-gray-500 mt-0.5">
          Comparacion de escenarios de estres sobre la proyeccion base
        </p>
      </div>

      {/* Scenario Buttons */}
      <div className="flex flex-wrap gap-2 p-4 border-b border-gray-100">
        {results.map(({ scenario }) => (
          <div
            key={scenario.id}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium border ${
              scenario.id === "normal"
                ? "bg-green-50 border-green-200 text-green-700"
                : scenario.id === "catastrophic"
                ? "bg-red-50 border-red-200 text-red-700"
                : "bg-amber-50 border-amber-200 text-amber-700"
            }`}
          >
            <span className="font-bold">{scenario.name}</span>
            <span className="text-gray-500 ml-1">— {scenario.description}</span>
          </div>
        ))}
      </div>

      {/* Comparison Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 text-gray-600 text-xs uppercase">
              <th className="px-4 py-2 text-left">Metrica</th>
              {results.map(({ scenario }) => (
                <th key={scenario.id} className="px-4 py-2 text-right">
                  {scenario.name}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            <ComparisonRow
              label="Break-Even (mes)"
              values={results.map(({ summary }) =>
                summary.breakEvenMonth ? `Mes ${summary.breakEvenMonth}` : "No"
              )}
              colorFn={(v) => (v === "No" ? "text-red-600" : "text-green-600")}
            />
            <ComparisonRow
              label="Utilidad Total"
              values={results.map(({ summary }) => formatMXN(summary.totalProfit))}
              colorFn={(_, i) =>
                results[i].summary.totalProfit >= 0 ? "text-green-600" : "text-red-600"
              }
            />
            <ComparisonRow
              label="Ingreso Total"
              values={results.map(({ summary }) => formatMXN(summary.totalRevenue))}
            />
            <ComparisonRow
              label="Costos Totales"
              values={results.map(({ summary }) => formatMXN(summary.totalCosts))}
              colorFn={() => "text-red-500"}
            />
            <ComparisonRow
              label="Cartera Max"
              values={results.map(({ summary }) => formatMXN(summary.peakOutstanding))}
            />
            <ComparisonRow
              label="Total Desembolsado"
              values={results.map(({ summary }) => formatMXN(summary.totalDisbursed))}
            />
            <ComparisonRow
              label="Defaults Acumulados"
              values={results.map(({ summary }) => summary.totalDefaults.toFixed(1))}
              colorFn={() => "text-orange-500"}
            />
            <ComparisonRow
              label="ROA Promedio"
              values={results.map(({ summary }) => `${(summary.avgROA * 100).toFixed(1)}%`)}
              colorFn={(_, i) =>
                results[i].summary.avgROA > 0 ? "text-green-600" : "text-red-600"
              }
            />
            <ComparisonRow
              label="Utilidad Mes Final"
              values={results.map(({ summary }) => {
                const last = summary.projections[summary.projections.length - 1];
                return formatMXN(last?.monthlyNetIncome ?? 0);
              })}
              colorFn={(_, i) => {
                const last = results[i].summary.projections[results[i].summary.projections.length - 1];
                return (last?.monthlyNetIncome ?? 0) >= 0 ? "text-green-600" : "text-red-600";
              }}
            />
            {/* Risk & Efficiency Metrics */}
            <tr className="bg-gray-50">
              <td colSpan={results.length + 1} className="px-4 py-1.5 text-xs font-bold text-gray-500 uppercase">
                Riesgo y Eficiencia
              </td>
            </tr>
            <ComparisonRow
              label="PaR / IMOR"
              values={results.map(({ summary }) => `${(summary.finalPar30 * 100).toFixed(2)}%`)}
              colorFn={(_, i) =>
                results[i].summary.finalPar30 < 0.05 ? "text-green-600" : results[i].summary.finalPar30 < 0.10 ? "text-amber-600" : "text-red-600"
              }
            />
            <ComparisonRow
              label="Write-Off Ratio"
              values={results.map(({ summary }) => `${(summary.finalWriteOffRatio * 100).toFixed(2)}%`)}
              colorFn={() => "text-orange-500"}
            />
            <ComparisonRow
              label="Collection Rate"
              values={results.map(({ summary }) => `${(summary.avgCollectionRate * 100).toFixed(1)}%`)}
              colorFn={(_, i) =>
                results[i].summary.avgCollectionRate > 0.95 ? "text-green-600" : "text-amber-600"
              }
            />
            <ComparisonRow
              label="OER"
              values={results.map(({ summary }) => `${(summary.finalOER * 100).toFixed(1)}%`)}
            />
            <ComparisonRow
              label="OSS"
              values={results.map(({ summary }) => `${(summary.finalOSS * 100).toFixed(0)}%`)}
              colorFn={(_, i) =>
                results[i].summary.finalOSS >= 1 ? "text-green-600" : "text-red-600"
              }
            />
            <ComparisonRow
              label="NIM"
              values={results.map(({ summary }) => `${(summary.finalNIM * 100).toFixed(1)}%`)}
            />
            <ComparisonRow
              label="Portfolio Yield"
              values={results.map(({ summary }) => `${(summary.finalPortfolioYield * 100).toFixed(1)}%`)}
            />
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ComparisonRow({
  label,
  values,
  colorFn,
}: {
  label: string;
  values: string[];
  colorFn?: (value: string, index: number) => string;
}) {
  return (
    <tr className="border-b border-gray-50 hover:bg-gray-50 transition">
      <td className="px-4 py-2 text-gray-700 font-medium">{label}</td>
      {values.map((v, i) => (
        <td
          key={i}
          className={`px-4 py-2 text-right font-semibold ${
            colorFn ? colorFn(v, i) : "text-gray-900"
          }`}
        >
          {v}
        </td>
      ))}
    </tr>
  );
}
