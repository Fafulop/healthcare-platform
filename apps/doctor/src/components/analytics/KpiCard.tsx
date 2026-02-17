"use client";

import { TrendingUp, TrendingDown } from "lucide-react";

interface KpiCardProps {
  title: string;
  value: number;
  icon: React.ReactNode;
  change?: number; // percentage change (optional)
}

export default function KpiCard({ title, value, icon, change }: KpiCardProps) {
  return (
    <div className="bg-white rounded-lg shadow p-5">
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-medium text-gray-500">{title}</span>
        <span className="text-gray-400">{icon}</span>
      </div>
      <p className="text-2xl font-bold text-gray-900">{value.toLocaleString()}</p>
      {change !== undefined && (
        <div className={`flex items-center gap-1 mt-1 text-sm ${change >= 0 ? "text-green-600" : "text-red-500"}`}>
          {change >= 0 ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
          <span>{change >= 0 ? "+" : ""}{change}%</span>
          <span className="text-gray-400 ml-1">vs periodo anterior</span>
        </div>
      )}
    </div>
  );
}
