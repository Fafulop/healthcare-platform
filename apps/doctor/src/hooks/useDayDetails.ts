'use client';

import { useState, useEffect } from 'react';

interface Task {
  id: string;
  title: string;
  description: string | null;
  dueDate: string | null;
  startTime: string | null;
  endTime: string | null;
  priority: "ALTA" | "MEDIA" | "BAJA";
  status: "PENDIENTE" | "EN_PROGRESO" | "COMPLETADA" | "CANCELADA";
  category: string;
  patientId: string | null;
  patient: { id: string; firstName: string; lastName: string } | null;
}

interface Booking {
  id: string;
  patientName: string;
  patientEmail: string;
  patientPhone: string;
  status: string;
}

interface AppointmentSlot {
  id: string;
  date: string;
  startTime: string;
  endTime: string;
  isOpen: boolean;
  currentBookings: number;
  maxBookings: number;
  bookings?: Booking[];
}

interface DayDetailsData {
  tasks: Task[];
  slots: AppointmentSlot[];
}

// Helper function to get local date string (fixes timezone issues)
function getLocalDateString(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function useDayDetails(date?: Date) {
  const [data, setData] = useState<DayDetailsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchDataForDate = async (targetDate: Date) => {
    setLoading(true);
    setError(null);

    try {
      const dateStr = getLocalDateString(targetDate);
      const response = await fetch(
        `/api/medical-records/tasks/calendar?startDate=${dateStr}&endDate=${dateStr}`
      );

      if (!response.ok) {
        throw new Error('Failed to fetch day details');
      }

      const result = await response.json();

      setData({
        tasks: result.data?.tasks || [],
        slots: result.data?.appointmentSlots || [],
      });
    } catch (err) {
      console.error('Error fetching day details:', err);
      setError(err instanceof Error ? err.message : 'Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDataForDate(date || new Date());
  }, []);

  return {
    data,
    loading,
    error,
    refetch: (newDate?: Date) => fetchDataForDate(newDate || date || new Date())
  };
}
