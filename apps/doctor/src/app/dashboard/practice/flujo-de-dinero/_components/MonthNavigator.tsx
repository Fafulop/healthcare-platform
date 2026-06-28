'use client';

import { ChevronLeft, ChevronRight, Calendar } from 'lucide-react';

interface Props {
  /** Selected month as YYYY-MM, or '' for a custom range / all time. */
  selectedMonth: string;
  /** Active date range, to tell "custom range" apart from "all time". */
  startDate: string;
  endDate: string;
  onMonthChange: (ym: string) => void;
  onShiftMonth: (delta: number) => void;
}

const MONTHS_ES = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
];

export function MonthNavigator({ selectedMonth, startDate, endDate, onMonthChange, onShiftMonth }: Props) {
  const isMonth = !!selectedMonth;
  const isAllTime = !startDate && !endDate;

  let label: string;
  if (isMonth) {
    const [y, m] = selectedMonth.split('-').map(Number);
    label = `${MONTHS_ES[m - 1]} ${y}`;
  } else if (isAllTime) {
    label = 'Todos los periodos';
  } else {
    label = 'Rango personalizado';
  }

  return (
    <div className="flex flex-wrap items-center gap-2 mb-4">
      <div className="flex items-center gap-1 bg-white rounded-lg shadow-sm border border-gray-200 p-1">
        <button
          type="button"
          onClick={() => onShiftMonth(-1)}
          className="p-1.5 rounded-md text-gray-500 hover:bg-gray-100 hover:text-gray-700 transition-colors"
          aria-label="Mes anterior"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>

        <div className="flex items-center gap-1.5 px-2 min-w-[150px] justify-center">
          <Calendar className="w-4 h-4 text-slate-400" />
          <span className="text-sm font-semibold text-gray-800 capitalize">{label}</span>
        </div>

        <button
          type="button"
          onClick={() => onShiftMonth(1)}
          className="p-1.5 rounded-md text-gray-500 hover:bg-gray-100 hover:text-gray-700 transition-colors"
          aria-label="Mes siguiente"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      {/* Direct month picker */}
      <input
        type="month"
        value={selectedMonth}
        onChange={(e) => onMonthChange(e.target.value)}
        className="text-sm border border-gray-200 rounded-md px-2 py-1.5 text-gray-700 focus:ring-2 focus:ring-slate-400 focus:border-slate-400"
        aria-label="Seleccionar mes"
      />

      <button
        type="button"
        onClick={() => onMonthChange('')}
        className={`text-sm px-3 py-1.5 rounded-md border transition-colors ${
          isAllTime
            ? 'border-slate-400 bg-slate-50 text-slate-700 font-semibold'
            : 'border-gray-200 text-gray-600 hover:bg-gray-50'
        }`}
      >
        Todos
      </button>
    </div>
  );
}
