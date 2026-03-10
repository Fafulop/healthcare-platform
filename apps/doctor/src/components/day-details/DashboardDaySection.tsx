'use client';

import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useDashboardCalendar } from '@/hooks/useDashboardCalendar';
import { DayItineraryContent } from './DayItineraryContent';
import { MiniCalendar } from './MiniCalendar';

export function DashboardDaySection() {
  const {
    selectedDate,
    handleDateSelect,
    handleMonthChange,
    taskDates,
    appointmentDates,
    dayTasks,
    daySlots,
    loading,
  } = useDashboardCalendar();

  const goToPrevDay = () => {
    const d = new Date(selectedDate);
    d.setDate(d.getDate() - 1);
    handleDateSelect(d);
  };

  const goToNextDay = () => {
    const d = new Date(selectedDate);
    d.setDate(d.getDate() + 1);
    handleDateSelect(d);
  };

  return (
    <div className="bg-white rounded-lg shadow mb-6 overflow-hidden">
      <div className="grid grid-cols-1 lg:grid-cols-2">

        {/* Left: Day itinerary */}
        <div className="lg:border-r border-gray-200 flex flex-col">
          {/* Date navigation */}
          <div className="px-4 sm:px-6 py-3 border-b border-gray-200 flex items-center gap-1">
            <button
              onClick={goToPrevDay}
              className="p-1 rounded-lg hover:bg-gray-100 text-gray-500 transition-colors flex-shrink-0"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="text-sm font-medium text-gray-800 capitalize flex-1 text-center truncate">
              {selectedDate.toLocaleDateString('es-MX', {
                weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
              })}
            </span>
            <button
              onClick={goToNextDay}
              className="p-1 rounded-lg hover:bg-gray-100 text-gray-500 transition-colors flex-shrink-0"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          {/* Itinerary */}
          <div className="p-4 sm:p-6 flex-1 min-h-[280px]">
            <DayItineraryContent tasks={dayTasks} slots={daySlots} loading={loading} />
          </div>
        </div>

        {/* Right: Calendar with indicators */}
        <div className="p-4 sm:p-6 border-t lg:border-t-0 border-gray-200">
          <MiniCalendar
            selectedDate={selectedDate}
            onDateSelect={handleDateSelect}
            taskDates={taskDates}
            appointmentDates={appointmentDates}
            onMonthChange={handleMonthChange}
          />
          {/* Legend */}
          <div className="mt-3 flex items-center gap-5 text-xs text-gray-500">
            <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full bg-indigo-500 flex-shrink-0" />
              <span>Pendientes</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full bg-green-500 flex-shrink-0" />
              <span>Citas</span>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
