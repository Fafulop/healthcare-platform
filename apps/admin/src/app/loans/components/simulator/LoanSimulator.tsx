"use client";

import { useState } from "react";
import type { LoanParams, Scenario } from "../../lib/types";
import { DEFAULT_LOAN_PARAMS } from "../../lib/constants";
import { calculateLoanProfit, calculateFundEconomics } from "../../lib/loan-math";
import ParameterPanel from "./ParameterPanel";
import AmortizationTable from "./AmortizationTable";
import CostWaterfall from "./CostWaterfall";
import FundEconomicsPanel from "./FundEconomicsPanel";
import ScenarioComparison from "./ScenarioComparison";
import SensitivityMatrix from "./SensitivityMatrix";
import DefaultScenarios from "./DefaultScenarios";
import { Save, RotateCcw } from "lucide-react";

export default function LoanSimulator() {
  const [params, setParams] = useState<LoanParams>(DEFAULT_LOAN_PARAMS);
  const [scenarios, setScenarios] = useState<Scenario[]>([]);
  const [showSensitivity, setShowSensitivity] = useState(false);
  const [showDefaults, setShowDefaults] = useState(false);

  const result = calculateLoanProfit(params);
  const fund = calculateFundEconomics(params, result);

  const saveScenario = () => {
    if (scenarios.length >= 4) return;
    const names = ["A", "B", "C", "D"];
    const name = `Escenario ${names[scenarios.length]}`;
    setScenarios([
      ...scenarios,
      { id: crypto.randomUUID(), name, params: { ...params }, result },
    ]);
  };

  const removeScenario = (id: string) => {
    setScenarios(scenarios.filter((s) => s.id !== id));
  };

  const resetParams = () => setParams(DEFAULT_LOAN_PARAMS);

  const handleCellClick = (rate: number, cof: number) => {
    setParams({ ...params, annualRate: rate, cofRate: cof });
  };

  return (
    <div className="flex flex-col lg:flex-row gap-6">
      {/* Left: Parameters */}
      <div className="lg:w-80 xl:w-96 shrink-0">
        <div className="bg-white rounded-xl border border-gray-200 p-4 sticky top-4">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-bold text-gray-800">Parametros</h2>
            <div className="flex gap-2">
              <button
                onClick={resetParams}
                className="p-1.5 text-gray-400 hover:text-gray-600 transition"
                title="Reset"
              >
                <RotateCcw className="w-4 h-4" />
              </button>
              <button
                onClick={saveScenario}
                disabled={scenarios.length >= 4}
                className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Save className="w-3.5 h-3.5" />
                Guardar ({scenarios.length}/4)
              </button>
            </div>
          </div>
          <ParameterPanel params={params} onChange={setParams} />
        </div>
      </div>

      {/* Right: Results */}
      <div className="flex-1 min-w-0 space-y-6">
        {/* Cost Waterfall + Summary */}
        <CostWaterfall result={result} params={params} />

        {/* Fund / Business Economics */}
        <FundEconomicsPanel fund={fund} result={result} params={params} />

        {/* Scenario Comparison */}
        <ScenarioComparison scenarios={scenarios} onRemove={removeScenario} />

        {/* Toggle panels */}
        <div className="flex gap-3">
          <button
            onClick={() => setShowSensitivity(!showSensitivity)}
            className={`px-4 py-2 text-sm font-medium rounded-lg border transition ${
              showSensitivity
                ? "bg-blue-50 border-blue-300 text-blue-700"
                : "bg-white border-gray-200 text-gray-600 hover:border-blue-300"
            }`}
          >
            Matriz de Sensibilidad
          </button>
          <button
            onClick={() => setShowDefaults(!showDefaults)}
            className={`px-4 py-2 text-sm font-medium rounded-lg border transition ${
              showDefaults
                ? "bg-blue-50 border-blue-300 text-blue-700"
                : "bg-white border-gray-200 text-gray-600 hover:border-blue-300"
            }`}
          >
            Impacto de Default
          </button>
        </div>

        {/* Sensitivity Matrix */}
        {showSensitivity && (
          <SensitivityMatrix params={params} onCellClick={handleCellClick} />
        )}

        {/* Default Scenarios */}
        {showDefaults && <DefaultScenarios params={params} />}

        {/* Amortization Table */}
        <AmortizationTable schedule={result.schedule} yearSummaries={result.yearSummaries} amortizationType={params.amortizationType} />
      </div>
    </div>
  );
}
