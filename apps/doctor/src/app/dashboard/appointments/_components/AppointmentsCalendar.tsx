import { ChevronLeft, ChevronRight } from "lucide-react";
import { getLocalDateString } from "@/lib/dates";

const MONTH_NAMES = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];
const DAY_NAMES = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];

interface Props {
  selectedDate: Date;
  onSelectDate: (date: Date) => void;
  calendarDays: (number | null)[];
  year: number;
  month: number;
  datesWithSlots: Set<string>;
}

export function AppointmentsCalendar({
  selectedDate,
  onSelectDate,
  calendarDays,
  year,
  month,
  datesWithSlots,
}: Props) {
  const selectedDateStr = getLocalDateString(selectedDate);
  const todayStr = getLocalDateString(new Date());

  const prevMonth = () => {
    const d = new Date(selectedDate);
    d.setMonth(d.getMonth() - 1);
    onSelectDate(d);
  };

  const nextMonth = () => {
    const d = new Date(selectedDate);
    d.setMonth(d.getMonth() + 1);
    onSelectDate(d);
  };

  return (
    <div className="bg-white rounded-lg shadow p-4">
      {/* Month header */}
      <div className="flex items-center justify-between mb-4">
        <button
          onClick={prevMonth}
          className="p-1.5 rounded hover:bg-gray-100 text-gray-600 transition-colors"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>
        <h3 className="font-semibold text-gray-900">
          {MONTH_NAMES[month]} {year}
        </h3>
        <button
          onClick={nextMonth}
          className="p-1.5 rounded hover:bg-gray-100 text-gray-600 transition-colors"
        >
          <ChevronRight className="w-5 h-5" />
        </button>
      </div>

      {/* Day headers */}
      <div className="grid grid-cols-7 mb-1">
        {DAY_NAMES.map((d) => (
          <div key={d} className="text-center text-xs font-medium text-gray-400 py-1">
            {d}
          </div>
        ))}
      </div>

      {/* Days grid */}
      <div className="grid grid-cols-7 gap-1">
        {calendarDays.map((day, index) => {
          if (!day) return <div key={`empty-${index}`} />;

          const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
          const isSelected = dateStr === selectedDateStr;
          const isToday = dateStr === todayStr;
          const hasSlots = datesWithSlots.has(dateStr);

          return (
            <button
              key={dateStr}
              onClick={() => {
                const d = new Date(dateStr + "T12:00:00");
                onSelectDate(d);
              }}
              className={`
                relative aspect-square flex flex-col items-center justify-center rounded-lg text-sm font-medium transition-colors
                ${isSelected
                  ? "bg-blue-600 text-white"
                  : isToday
                  ? "bg-blue-50 text-blue-700 border border-blue-200"
                  : "hover:bg-gray-100 text-gray-700"}
              `}
            >
              {day}
              {hasSlots && (
                <span
                  className={`absolute bottom-1 w-1 h-1 rounded-full ${
                    isSelected ? "bg-blue-200" : "bg-blue-500"
                  }`}
                />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
