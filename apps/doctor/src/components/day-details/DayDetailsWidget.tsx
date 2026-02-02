'use client';

import { useState } from 'react';
import { Calendar, Loader2 } from 'lucide-react';
import { useDayDetails } from '@/hooks/useDayDetails';
import { DayDetailsModal } from './DayDetailsModal';

export function DayDetailsWidget() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const { data, loading, error, refetch } = useDayDetails();

  // Calculate count of today's items (tasks + appointments with bookings)
  // Only count items for today, not the selected date
  const today = new Date();
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

  const itemCount = data
    ? data.tasks.filter(t => {
        if (!t.dueDate) return false;
        const taskDateStr = typeof t.dueDate === 'string' ? t.dueDate.split('T')[0] : '';
        return taskDateStr === todayStr;
      }).length + data.slots.filter(s => {
        const slotDateStr = typeof s.date === 'string' ? s.date.split('T')[0] : '';
        return slotDateStr === todayStr && s.currentBookings > 0;
      }).length
    : 0;

  const handleDateChange = (newDate: Date) => {
    setSelectedDate(newDate);
    refetch(newDate);
  };

  return (
    <>
      {/* Floating Button - positioned above ChatWidget */}
      <button
        onClick={() => setIsModalOpen(true)}
        className="
          fixed bottom-32 right-4 sm:bottom-24 sm:right-6 z-50
          w-12 h-12 sm:w-14 sm:h-14 rounded-full
          bg-indigo-600 hover:bg-indigo-700
          text-white shadow-lg hover:shadow-xl
          flex items-center justify-center
          transition-all active:scale-95
          lg:bottom-24 lg:right-6
        "
        title="Detalles del día"
      >
        {loading ? (
          <Loader2 className="w-6 h-6 sm:w-7 sm:h-7 animate-spin" />
        ) : (
          <>
            <Calendar className="w-6 h-6 sm:w-7 sm:h-7" />
            {/* Badge with count */}
            {itemCount > 0 && (
              <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-xs font-bold rounded-full flex items-center justify-center">
                {itemCount > 9 ? '9+' : itemCount}
              </span>
            )}
            {/* Error indicator */}
            {error && (
              <span className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full animate-pulse" />
            )}
          </>
        )}
      </button>

      {/* Modal */}
      <DayDetailsModal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          // Reset to today when closing
          setSelectedDate(new Date());
          refetch(new Date());
        }}
        tasks={data?.tasks || []}
        slots={data?.slots || []}
        selectedDate={selectedDate}
        onDateChange={handleDateChange}
        loading={loading}
      />
    </>
  );
}
