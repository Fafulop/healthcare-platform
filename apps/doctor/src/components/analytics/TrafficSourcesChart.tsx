"use client";

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import type { TrafficSource } from "@healthcare/types";

interface TrafficSourcesChartProps {
  data: TrafficSource[];
}

export default function TrafficSourcesChart({ data }: TrafficSourcesChartProps) {
  if (data.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow p-6 text-center text-gray-400">
        Sin datos de fuentes de trafico
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">Fuentes de trafico</h3>
      <ResponsiveContainer width="100%" height={220}>
        <BarChart data={data} layout="vertical">
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis type="number" fontSize={12} />
          <YAxis type="category" dataKey="channel" fontSize={12} width={140} />
          <Tooltip />
          <Bar dataKey="sessions" name="Sesiones" fill="#2563eb" radius={[0, 4, 4, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
