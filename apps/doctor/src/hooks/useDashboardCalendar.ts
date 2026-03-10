'use client';

import { useState, useEffect } from 'react';
import { getLocalDateString } from '@/lib/dates';

interface Task {
  id: string;
  title: string;
  description: string | null;
  dueDate: string | null;
  startTime: string | null;
  endTime: string | null;
  priority: 'ALTA' | 'MEDIA' | 'BAJA';
  status: 'PENDIENTE' | 'EN_PROGRESO' | 'COMPLETADA' | 'CANCELADA';
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

type MonthData = { tasks: Task[]; slots: AppointmentSlot[] };

function filterForDate(data: MonthData | null, dateStr: string) {
  if (!data) return { tasks: [], slots: [] };
  return {
    tasks: data.tasks.filter(t => t.dueDate && t.dueDate.split('T')[0] === dateStr),
    slots: data.slots.filter(s => {
      const d = typeof s.date === 'string' ? s.date.split('T')[0] : getLocalDateString(new Date(s.date));
      return d === dateStr;
    }),
  };
}

async function fetchCalendarMonth(monthDate: Date): Promise<MonthData> {
  const year = monthDate.getFullYear();
  const month = monthDate.getMonth();
  const startDate = getLocalDateString(new Date(year, month, 1));
  const endDate = getLocalDateString(new Date(year, month + 1, 0));
  const res = await fetch(
    `/api/medical-records/tasks/calendar?startDate=${startDate}&endDate=${endDate}`
  );
  if (!res.ok) throw new Error('Failed to fetch');
  const result = await res.json();
  return {
    tasks: result.data?.tasks || [],
    slots: result.data?.appointmentSlots || [],
  };
}

export function useDashboardCalendar() {
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [viewMonth, setViewMonth] = useState(new Date());

  // monthData is used only for calendar dot indicators; updated when browsing months.
  const [monthData, setMonthData] = useState<MonthData | null>(null);

  // dayData is used only for the itinerary; updated only when the user selects a date.
  const [dayData, setDayData] = useState<{ tasks: Task[]; slots: AppointmentSlot[] }>({ tasks: [], slots: [] });

  const [loadingDay, setLoadingDay] = useState(true);

  // On mount: fetch today's month for both indicators and initial itinerary.
  useEffect(() => {
    const today = new Date();
    const todayStr = getLocalDateString(today);
    setLoadingDay(true);
    fetchCalendarMonth(today)
      .then(data => {
        setMonthData(data);
        setDayData(filterForDate(data, todayStr));
      })
      .catch(() => {
        setMonthData({ tasks: [], slots: [] });
        setDayData({ tasks: [], slots: [] });
      })
      .finally(() => setLoadingDay(false));
  }, []);

  // Calendar browsing — fetch indicators for the new month WITHOUT touching the itinerary.
  const handleMonthChange = (newViewMonth: Date) => {
    setViewMonth(newViewMonth);
    fetchCalendarMonth(newViewMonth)
      .then(data => setMonthData(data))
      .catch(() => setMonthData({ tasks: [], slots: [] }));
  };

  // Date selection — update itinerary. If the new date is in a different month than
  // the calendar view, also refresh the calendar indicators.
  const handleDateSelect = (date: Date) => {
    const dateStr = getLocalDateString(date);
    setSelectedDate(date);
    setLoadingDay(true);

    const isNewMonth =
      date.getMonth() !== viewMonth.getMonth() ||
      date.getFullYear() !== viewMonth.getFullYear();

    if (isNewMonth) {
      setViewMonth(date);
      fetchCalendarMonth(date)
        .then(data => {
          setMonthData(data);
          setDayData(filterForDate(data, dateStr));
        })
        .catch(() => {
          setMonthData({ tasks: [], slots: [] });
          setDayData({ tasks: [], slots: [] });
        })
        .finally(() => setLoadingDay(false));
    } else {
      // Same month — derive from existing monthData immediately.
      setDayData(filterForDate(monthData, dateStr));
      setLoadingDay(false);
    }
  };

  // Derive calendar dot indicators from the viewed month's data.
  const taskDates = [
    ...new Set(
      (monthData?.tasks || [])
        .map(t => (t.dueDate ? t.dueDate.split('T')[0] : null))
        .filter((d): d is string => d !== null)
    ),
  ];

  const appointmentDates = [
    ...new Set(
      (monthData?.slots || [])
        .filter(s => s.currentBookings > 0)
        .map(s => (typeof s.date === 'string' ? s.date.split('T')[0] : getLocalDateString(new Date(s.date))))
    ),
  ];

  return {
    selectedDate,
    handleDateSelect,
    handleMonthChange,
    taskDates,
    appointmentDates,
    dayTasks: dayData.tasks,
    daySlots: dayData.slots,
    loading: loadingDay,
  };
}
