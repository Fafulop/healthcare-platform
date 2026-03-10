'use client';

import { useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface MiniCalendarProps {
  selectedDate: Date;
  onDateSelect: (date: Date) => void;
  highlightedDates?: string[]; // kept for backward compat — shows indigo dot
  taskDates?: string[];         // days with tasks — shows indigo dot
  appointmentDates?: string[];  // days with appointments — shows green dot
  onMonthChange?: (month: Date) => void;
}

import { getLocalDateString } from '@/lib/dates';

export function MiniCalendar({
  selectedDate,
  onDateSelect,
  highlightedDates = [],
  taskDates = [],
  appointmentDates = [],
  onMonthChange,
}: MiniCalendarProps) {
  const [currentMonth, setCurrentMonth] = useState(new Date(selectedDate));

  // Sync calendar view when selectedDate crosses a month boundary (e.g. prev/next day nav).
  // Do NOT call onMonthChange here — the parent already fetched when the date was selected.
  useEffect(() => {
    if (
      selectedDate.getMonth() !== currentMonth.getMonth() ||
      selectedDate.getFullYear() !== currentMonth.getFullYear()
    ) {
      setCurrentMonth(new Date(selectedDate));
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDate]);

  const year = currentMonth.getFullYear();
  const month = currentMonth.getMonth();
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const changeMonth = (newMonth: Date) => {
    setCurrentMonth(newMonth);
    onMonthChange?.(newMonth);
  };

  const goToPreviousMonth = () => {
    const newMonth = new Date(currentMonth);
    newMonth.setMonth(currentMonth.getMonth() - 1);
    changeMonth(newMonth);
  };

  const goToNextMonth = () => {
    const newMonth = new Date(currentMonth);
    newMonth.setMonth(currentMonth.getMonth() + 1);
    changeMonth(newMonth);
  };

  const goToToday = () => {
    const today = new Date();
    changeMonth(today);
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
    const isTask = taskDates.includes(dateStr);
    const isAppointment = appointmentDates.includes(dateStr);
    const hasDot = !isSelected && (isTask || isAppointment || (isHighlighted && !isTask && !isAppointment));

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
        {hasDot && (
          <div className="flex justify-center gap-0.5 mt-0.5 sm:mt-1">
            {isTask && <div className="w-1 h-1 bg-indigo-500 rounded-full" />}
            {isAppointment && <div className="w-1 h-1 bg-green-500 rounded-full" />}
            {isHighlighted && !isTask && !isAppointment && <div className="w-1 h-1 bg-indigo-600 rounded-full" />}
          </div>
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
