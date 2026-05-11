"use client";

import { useState } from "react";
import type { PortfolioParams } from "../../lib/types";
import { DEFAULT_PORTFOLIO_PARAMS } from "../../lib/types";
import { projectPortfolio } from "../../lib/portfolio-math";
import PortfolioParamPanel from "./PortfolioParamPanel";
import PortfolioCharts from "./PortfolioCharts";
import StressTestPanel from "./StressTestPanel";
import { RotateCcw } from "lucide-react";

export default function PortfolioProjection() {
  const [params, setParams] = useState<PortfolioParams>(DEFAULT_PORTFOLIO_PARAMS);
  const [showStress, setShowStress] = useState(false);

  const summary = projectPortfolio(params);

  return (
    <div className="flex flex-col lg:flex-row gap-6">
      {/* Left: Parameters */}
      <div className="lg:w-80 xl:w-96 shrink-0">
        <div className="bg-white rounded-xl border border-gray-200 p-4 sticky top-4">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-bold text-gray-800">Parametros Portfolio</h2>
            <button
              onClick={() => setParams(DEFAULT_PORTFOLIO_PARAMS)}
              className="p-1.5 text-gray-400 hover:text-gray-600 transition"
              title="Reset"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
          </div>
          <PortfolioParamPanel params={params} onChange={setParams} />
        </div>
      </div>

      {/* Right: Results */}
      <div className="flex-1 min-w-0 space-y-6">
        <PortfolioCharts summary={summary} />

        {/* Toggle Stress Test */}
        <button
          onClick={() => setShowStress(!showStress)}
          className={`px-4 py-2 text-sm font-medium rounded-lg border transition ${
            showStress
              ? "bg-blue-50 border-blue-300 text-blue-700"
              : "bg-white border-gray-200 text-gray-600 hover:border-blue-300"
          }`}
        >
          Stress Testing
        </button>

        {showStress && <StressTestPanel params={params} />}
      </div>
    </div>
  );
}
