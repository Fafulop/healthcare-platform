"use client";

import { useState } from "react";
import type { AmortizationRow, YearSummary, AmortizationType } from "../../lib/types";
import { AMORTIZATION_LABELS } from "../../lib/types";
import { formatMXN } from "../../lib/loan-math";
import { ChevronDown, ChevronRight } from "lucide-react";

interface Props {
  schedule: AmortizationRow[];
  yearSummaries: YearSummary[];
  amortizationType?: AmortizationType;
}

export default function AmortizationTable({ schedule, yearSummaries, amortizationType = "french" }: Props) {
  const [expandedYears, setExpandedYears] = useState<Set<number>>(new Set([1]));

  const toggleYear = (year: number) => {
    setExpandedYears((prev) => {
      const next = new Set(prev);
      if (next.has(year)) next.delete(year);
      else next.add(year);
      return next;
    });
  };

  const totalInterest = schedule.reduce((s, r) => s + r.interest, 0);
  const totalPrincipal = schedule.reduce((s, r) => s + r.principal, 0);
  const totalPayments = schedule.reduce((s, r) => s + r.payment, 0);

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <div className="px-4 py-3 border-b border-gray-100 bg-gray-50">
        <h3 className="text-sm font-semibold text-gray-700">
          Tabla de Amortizacion
          <span className="ml-2 text-xs font-normal text-gray-500">
            — {AMORTIZATION_LABELS[amortizationType].label}
          </span>
        </h3>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 text-gray-600 text-xs uppercase">
              <th className="px-3 py-2 text-left">Mes</th>
              <th className="px-3 py-2 text-right">Saldo Inicial</th>
              <th className="px-3 py-2 text-right">Interes</th>
              <th className="px-3 py-2 text-right">Capital</th>
              <th className="px-3 py-2 text-right">Pago</th>
              <th className="px-3 py-2 text-right">Saldo Final</th>
            </tr>
          </thead>
          {yearSummaries.map((ys) => {
            const yearRows = schedule.slice((ys.year - 1) * 12, ys.year * 12);
            const isExpanded = expandedYears.has(ys.year);

            return (
              <tbody key={ys.year}>
                {/* Year header row */}
                <tr
                  onClick={() => toggleYear(ys.year)}
                  className="bg-blue-50 cursor-pointer hover:bg-blue-100 transition font-semibold text-blue-800"
                >
                  <td className="px-3 py-2 flex items-center gap-1">
                    {isExpanded ? (
                      <ChevronDown className="w-4 h-4" />
                    ) : (
                      <ChevronRight className="w-4 h-4" />
                    )}
                    Ano {ys.year}
                  </td>
                  <td className="px-3 py-2 text-right">
                    {formatMXN(yearRows[0]?.startBalance ?? 0)}
                  </td>
                  <td className="px-3 py-2 text-right text-red-600">
                    {formatMXN(ys.totalInterest)}
                  </td>
                  <td className="px-3 py-2 text-right text-green-600">
                    {formatMXN(ys.totalPrincipal)}
                  </td>
                  <td className="px-3 py-2 text-right">{formatMXN(ys.totalPayments)}</td>
                  <td className="px-3 py-2 text-right">
                    {formatMXN(yearRows[yearRows.length - 1]?.endBalance ?? 0)}
                  </td>
                </tr>

                {/* Month rows */}
                {isExpanded &&
                  yearRows.map((row) => (
                    <tr
                      key={row.month}
                      className="border-b border-gray-50 hover:bg-gray-50 transition"
                    >
                      <td className="px-3 py-1.5 pl-8 text-gray-600">
                        {row.month}
                        {row.principal === 0 && (
                          <span className="ml-1 text-[10px] text-amber-600 font-medium">gracia</span>
                        )}
                      </td>
                      <td className="px-3 py-1.5 text-right text-gray-700">
                        {formatMXN(row.startBalance)}
                      </td>
                      <td className="px-3 py-1.5 text-right text-red-500">
                        {formatMXN(row.interest)}
                      </td>
                      <td className="px-3 py-1.5 text-right text-green-500">
                        {formatMXN(row.principal)}
                      </td>
                      <td className="px-3 py-1.5 text-right text-gray-700">
                        {formatMXN(row.payment)}
                      </td>
                      <td className="px-3 py-1.5 text-right text-gray-700">
                        {formatMXN(row.endBalance)}
                      </td>
                    </tr>
                  ))}
              </tbody>
            );
          })}

          {/* Total row */}
          <tbody>
            <tr className="bg-gray-100 font-bold text-gray-900 border-t-2 border-gray-300">
              <td className="px-3 py-2">TOTAL</td>
              <td className="px-3 py-2 text-right">{formatMXN(schedule[0]?.startBalance ?? 0)}</td>
              <td className="px-3 py-2 text-right text-red-700">{formatMXN(totalInterest)}</td>
              <td className="px-3 py-2 text-right text-green-700">{formatMXN(totalPrincipal)}</td>
              <td className="px-3 py-2 text-right">{formatMXN(totalPayments)}</td>
              <td className="px-3 py-2 text-right">{formatMXN(0)}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
