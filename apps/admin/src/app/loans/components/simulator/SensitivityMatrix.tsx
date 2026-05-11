"use client";

import type { LoanParams } from "../../lib/types";
import { generateSensitivityMatrix, formatMXN, formatPct } from "../../lib/loan-math";

interface Props {
  params: LoanParams;
  onCellClick: (rate: number, cof: number) => void;
}

const RATE_RANGE = [0.24, 0.27, 0.30, 0.33, 0.36, 0.39, 0.42];
const COF_RANGE = [0.085, 0.10, 0.12, 0.14, 0.16, 0.18, 0.20];

export default function SensitivityMatrix({ params, onCellClick }: Props) {
  const matrix = generateSensitivityMatrix(params, RATE_RANGE, COF_RANGE);

  // Find min/max for color scale
  const allProfits = matrix.flat().map((c) => c.profit);
  const maxProfit = Math.max(...allProfits);
  const minProfit = Math.min(...allProfits);

  const getColor = (profit: number) => {
    if (profit < 0) return "bg-red-100 text-red-800";
    const ratio = maxProfit > 0 ? profit / maxProfit : 0;
    if (ratio > 0.7) return "bg-green-100 text-green-800";
    if (ratio > 0.4) return "bg-green-50 text-green-700";
    if (ratio > 0.2) return "bg-yellow-50 text-yellow-800";
    return "bg-orange-50 text-orange-700";
  };

  const isCurrentCell = (rate: number, cof: number) =>
    Math.abs(rate - params.annualRate) < 0.005 && Math.abs(cof - params.cofRate) < 0.005;

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <div className="px-4 py-3 border-b border-gray-100 bg-gray-50">
        <h3 className="text-sm font-semibold text-gray-700">
          Matriz de Sensibilidad — Utilidad por Prestamo
        </h3>
        <p className="text-xs text-gray-500 mt-0.5">
          Filas = Costo de Fondeo | Columnas = Tasa Cobrada | Click para cargar parametros
        </p>
      </div>

      <div className="overflow-x-auto p-4">
        <table className="w-full text-xs">
          <thead>
            <tr>
              <th className="px-2 py-1.5 text-left text-gray-500">CoF \ Tasa</th>
              {RATE_RANGE.map((r) => (
                <th key={r} className="px-2 py-1.5 text-center text-gray-600 font-semibold">
                  {formatPct(r, 0)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {matrix.map((row, ri) => (
              <tr key={COF_RANGE[ri]}>
                <td className="px-2 py-1.5 text-gray-600 font-semibold">{formatPct(COF_RANGE[ri])}</td>
                {row.map((cell, ci) => (
                  <td
                    key={`${ri}-${ci}`}
                    onClick={() => onCellClick(cell.rate, cell.cof)}
                    className={`px-2 py-1.5 text-center cursor-pointer transition hover:ring-2 hover:ring-blue-400 ${getColor(cell.profit)} ${
                      isCurrentCell(cell.rate, cell.cof) ? "ring-2 ring-blue-600 font-bold" : ""
                    }`}
                  >
                    {formatMXN(cell.profit)}
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
