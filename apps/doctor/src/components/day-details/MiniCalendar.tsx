'use client';

import { useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface MiniCalendarProps {
  selectedDate: Date;
  onDateSelect: (date: Date) => void;
  highlightedDates?: string[]; // Array of YYYY-MM-DD dates to highlight
}

// Helper function to get local date string
function getLocalDateString(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function MiniCalendar({ selectedDate, onDateSelect, highlightedDates = [] }: MiniCalendarProps) {
  const [currentMonth, setCurrentMonth] = useState(new Date(selectedDate));

  const year = currentMonth.getFullYear();
  const month = currentMonth.getMonth();
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const goToPreviousMonth = () => {
    const newMonth = new Date(currentMonth);
    newMonth.setMonth(currentMonth.getMonth() - 1);
    setCurrentMonth(newMonth);
  };

  const goToNextMonth = () => {
    const newMonth = new Date(currentMonth);
    newMonth.setMonth(currentMonth.getMonth() + 1);
    setCurrentMonth(newMonth);
  };

  const goToToday = () => {
    const today = new Date();
    setCurrentMonth(today);
    onDateSelect(today);
  };

  const days: React.ReactElement[] = [];

  // Empty cells before month starts
  for (let i = 0; i < firstDay; i++) {
    days.push(<div key={`empty-${i}`} className="aspect-square" />);
  }

  // Days of the month
  for (let day = 1; day <= daysInMonth; day++) {
    const date = new Date(year, month, day);
    const dateStr = getLocalDateString(date);
    const isToday = dateStr === getLocalDateString(new Date());
    const isSelected = getLocalDateString(selectedDate) === dateStr;
    const isHighlighted = highlightedDates.includes(dateStr);

    days.push(
      <button
        key={day}
        onClick={() => onDateSelect(date)}
        className={`aspect-square p-1 sm:p-2 rounded-lg text-center transition-all ${
          isSelected
            ? "bg-indigo-600 text-white font-bold"
            : isToday
            ? "bg-indigo-100 text-indigo-700 font-semibold"
            : isHighlighted
            ? "bg-indigo-200 text-indigo-900 font-medium hover:bg-indigo-300"
            : "text-gray-600 hover:bg-gray-100"
        }`}
      >
        <div className="text-xs sm:text-sm">{day}</div>
        {isHighlighted && !isSelected && (
          <div className="w-1 h-1 bg-indigo-600 rounded-full mx-auto mt-0.5 sm:mt-1" />
        )}
      </button>
    );
  }

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4">
      {/* Calendar Navigation */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-gray-900 capitalize">
          {currentMonth.toLocaleDateString('es-MX', { month: 'long', year: 'numeric' })}
        </h3>
        <div className="flex gap-1">
          <button
            onClick={goToPreviousMonth}
            className="p-1.5 hover:bg-gray-100 rounded transition-colors"
            title="Mes anterior"
          >
            <ChevronLeft className="w-4 h-4 text-gray-600" />
          </button>
          <button
            onClick={goToToday}
            className="px-2 py-1 text-xs bg-gray-100 hover:bg-gray-200 rounded text-gray-700 transition-colors"
          >
            Hoy
          </button>
          <button
            onClick={goToNextMonth}
            className="p-1.5 hover:bg-gray-100 rounded transition-colors"
            title="Mes siguiente"
          >
            <ChevronRight className="w-4 h-4 text-gray-600" />
          </button>
        </div>
      </div>

      {/* Calendar Grid */}
      <div className="grid grid-cols-7 gap-1">
        {/* Day Headers */}
        {["D", "L", "M", "M", "J", "V", "S"].map((day, idx) => (
          <div
            key={`${day}-${idx}`}
            className="text-center font-semibold text-gray-600 text-xs py-1"
          >
            {day}
          </div>
        ))}

        {/* Calendar Days */}
        {days}
      </div>
    </div>
  );
}
