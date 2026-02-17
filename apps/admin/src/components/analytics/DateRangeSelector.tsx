"use client";

import type { DateRange } from "@healthcare/types";

interface DateRangeSelectorProps {
  value: DateRange;
  onChange: (range: DateRange) => void;
}

const OPTIONS: { value: DateRange; label: string }[] = [
  { value: "7d", label: "7 dias" },
  { value: "28d", label: "28 dias" },
  { value: "90d", label: "90 dias" },
];

export default function DateRangeSelector({ value, onChange }: DateRangeSelectorProps) {
  return (
    <div className="inline-flex rounded-lg border border-gray-200 bg-white">
      {OPTIONS.map((opt) => (
        <button
          key={opt.value}
          onClick={() => onChange(opt.value)}
          className={`px-4 py-2 text-sm font-medium transition-colors first:rounded-l-lg last:rounded-r-lg ${
            value === opt.value
              ? "bg-blue-600 text-white"
              : "text-gray-600 hover:bg-gray-50"
          }`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}
