"use client";

import type { LoanParams } from "../../lib/types";
import { generateDefaultCurve, formatMXN } from "../../lib/loan-math";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";

interface Props {
  params: LoanParams;
}

export default function DefaultScenarios({ params }: Props) {
  const curve = generateDefaultCurve(params);

  const chartData = curve.map((d) => ({
    month: d.defaultMonth,
    netResult: d.netResult,
    recovery: d.recoveryAmount,
    outstanding: d.outstandingAtDefault,
  }));

  // Find break-even month (first month where default is still profitable)
  const breakEvenMonth = curve.find((d) => d.netResult >= 0)?.defaultMonth ?? null;

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <div className="px-4 py-3 border-b border-gray-100 bg-gray-50">
        <h3 className="text-sm font-semibold text-gray-700">
          Impacto de Default por Mes
        </h3>
        <p className="text-xs text-gray-500 mt-0.5">
          Resultado neto si el doctor deja de pagar en cada mes.
          {breakEvenMonth && (
            <span className="text-green-600 font-medium">
              {" "}A partir del mes {breakEvenMonth}, incluso un default es rentable.
            </span>
          )}
        </p>
      </div>

      {/* Chart */}
      <div className="px-4 pt-4" style={{ height: 250 }}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis
              dataKey="month"
              tick={{ fontSize: 11 }}
              label={{ value: "Mes de Default", position: "bottom", offset: -5, fontSize: 11 }}
            />
            <YAxis
              tick={{ fontSize: 11 }}
              tickFormatter={(v) => `${(v / 1000).toFixed(0)}K`}
            />
            <Tooltip
              formatter={(value, name) => {
                const labels: Record<string, string> = {
                  netResult: "Resultado Neto",
                  outstanding: "Saldo Pendiente",
                  recovery: "Recuperacion",
                };
                return [formatMXN(Number(value)), labels[String(name)] ?? String(name)];
              }}
              labelFormatter={(v) => `Default en mes ${v}`}
            />
            <ReferenceLine y={0} stroke="#374151" strokeWidth={2} />
            <Line
              type="monotone"
              dataKey="netResult"
              stroke="#2563eb"
              strokeWidth={2}
              dot={false}
            />
            <Line
              type="monotone"
              dataKey="outstanding"
              stroke="#ef4444"
              strokeWidth={1}
              strokeDasharray="4 4"
              dot={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Key defaults table */}
      <div className="p-4">
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-gray-50 text-gray-600 uppercase">
              <th className="px-2 py-1.5 text-left">Mes</th>
              <th className="px-2 py-1.5 text-right">Pagos Recibidos</th>
              <th className="px-2 py-1.5 text-right">Saldo Pendiente</th>
              <th className="px-2 py-1.5 text-right">Recuperacion</th>
              <th className="px-2 py-1.5 text-right">CoF Pagado</th>
              <th className="px-2 py-1.5 text-right">Resultado Neto</th>
            </tr>
          </thead>
          <tbody>
            {[
              curve[Math.min(2, curve.length - 1)],  // month 3
              curve[Math.min(5, curve.length - 1)],  // month 6
              curve[Math.min(11, curve.length - 1)], // month 12
              curve[Math.min(17, curve.length - 1)], // month 18
              curve[curve.length - 1],               // last month
            ]
              .filter((d, i, arr) => d && arr.findIndex((x) => x?.defaultMonth === d.defaultMonth) === i)
              .map((d) => (
                <tr key={d.defaultMonth} className="border-b border-gray-50">
                  <td className="px-2 py-1.5 font-medium">Mes {d.defaultMonth}</td>
                  <td className="px-2 py-1.5 text-right">{formatMXN(d.paymentsReceived)}</td>
                  <td className="px-2 py-1.5 text-right text-red-500">
                    {formatMXN(d.outstandingAtDefault)}
                  </td>
                  <td className="px-2 py-1.5 text-right text-green-500">
                    {formatMXN(d.recoveryAmount)}
                  </td>
                  <td className="px-2 py-1.5 text-right text-orange-500">
                    {formatMXN(d.cofPaid)}
                  </td>
                  <td
                    className={`px-2 py-1.5 text-right font-bold ${
                      d.netResult >= 0 ? "text-green-600" : "text-red-600"
                    }`}
                  >
                    {formatMXN(d.netResult)}
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
