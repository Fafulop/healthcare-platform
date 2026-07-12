import { useState } from "react";
import { getLocalDateString } from "@/lib/dates";

export function useCalendar() {
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [viewMode, setViewMode] = useState<"calendar" | "list">("calendar");
  const [listDate, setListDate] = useState<string>(getLocalDateString(new Date()));
  const [showAllSlots, setShowAllSlots] = useState(false);

  const selectedDateStr = getLocalDateString(selectedDate);

  const year = selectedDate.getFullYear();
  const month = selectedDate.getMonth();
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const daysInMonth = lastDay.getDate();
  const startDayOfWeek = firstDay.getDay();

  const calendarDays: (number | null)[] = [];
  for (let i = 0; i < startDayOfWeek; i++) calendarDays.push(null);
  for (let day = 1; day <= daysInMonth; day++) calendarDays.push(day);

  return {
    selectedDate,
    setSelectedDate,
    selectedDateStr,
    viewMode,
    setViewMode,
    listDate,
    setListDate,
    showAllSlots,
    setShowAllSlots,
    calendarDays,
    year,
    month,
  };
}
