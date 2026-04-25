"use client";

import { Calendar, Clock, Trash2, MapPin, User } from "lucide-react";
import { formatLocalDate } from "@/lib/dates";
import type { AvailabilityRange } from "../_hooks/useRanges";

interface Booking {
  id: string;
  slotId: string | null;
  patientName: string;
  serviceName?: string | null;
  status: string;
  date?: string | null;
  startTime?: string | null;
  endTime?: string | null;
  duration?: number | null;
  extendedBlockMinutes?: number | null;
  slot?: { date: string; startTime: string; endTime: string; duration: number } | null;
}

interface Props {
  selectedDate: Date;
  ranges: AvailabilityRange[];
  bookings: Booking[];
  onDeleteRange: (rangeId: string) => void;
  onBookInGap: (date: string, startTime: string) => void;
}

/** Resolve booking date/time from freeform or slot fields */
function resolveBookingTime(b: Booking) {
  if (b.slotId && b.slot) {
    return { date: b.slot.date.split("T")[0], startTime: b.slot.startTime, endTime: b.slot.endTime, duration: b.slot.duration };
  }
  if (!b.slotId && b.date && b.startTime && b.endTime) {
    return { date: (b.date as string).split("T")[0], startTime: b.startTime, endTime: b.endTime, duration: b.duration ?? 0 };
  }
  return null;
}

function timeToMin(t: string) {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}

function minToTime(m: number) {
  return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
}

const statusColors: Record<string, { bg: string; text: string; label: string }> = {
  PENDING:   { bg: "bg-amber-50 border-amber-200",  text: "text-amber-700", label: "Pendiente" },
  CONFIRMED: { bg: "bg-green-50 border-green-200",  text: "text-green-700", label: "Confirmada" },
  COMPLETED: { bg: "bg-blue-50 border-blue-200",    text: "text-blue-700",  label: "Completada" },
  CANCELLED: { bg: "bg-gray-50 border-gray-200",    text: "text-gray-400",  label: "Cancelada" },
  NO_SHOW:   { bg: "bg-red-50 border-red-200",      text: "text-red-600",   label: "No asistió" },
};

export function DayTimelinePanel({
  selectedDate,
  ranges,
  bookings,
  onDeleteRange,
  onBookInGap,
}: Props) {
  const dateStr = `${selectedDate.getFullYear()}-${String(selectedDate.getMonth() + 1).padStart(2, "0")}-${String(selectedDate.getDate()).padStart(2, "0")}`;

  // Resolve bookings for this date
  const dayBookings = bookings
    .map((b) => {
      const resolved = resolveBookingTime(b);
      if (!resolved || resolved.date !== dateStr) return null;
      return { ...b, ...resolved };
    })
    .filter(Boolean) as Array<Booking & { date: string; startTime: string; endTime: string; duration: number }>;

  // Active bookings (for gap computation display)
  const activeBookings = dayBookings.filter(
    (b) => b.status !== "CANCELLED" && b.status !== "COMPLETED" && b.status !== "NO_SHOW"
  );

  return (
    <div className="bg-white rounded-lg shadow p-4">
      <h3 className="font-semibold text-gray-900 text-sm mb-3">
        {formatLocalDate(selectedDate.toISOString(), { weekday: "long", month: "long", day: "numeric" })}
      </h3>

      {ranges.length === 0 && dayBookings.length === 0 ? (
        <div className="text-center py-6 text-gray-400">
          <Calendar className="w-8 h-8 mx-auto mb-2 opacity-50" />
          <p className="text-xs">Sin disponibilidad este día</p>
        </div>
      ) : (
        <div className="space-y-3">
          {/* Ranges */}
          {ranges.map((range) => {
            const rangeStart = timeToMin(range.startTime);
            const rangeEnd = timeToMin(range.endTime);
            const totalHours = (rangeEnd - rangeStart) / 60;

            // Bookings within this range
            const rangeBookings = dayBookings.filter((b) => {
              const bs = timeToMin(b.startTime);
              const be = timeToMin(b.endTime);
              return bs >= rangeStart && be <= rangeEnd;
            });

            // Compute free gaps between active bookings
            const sortedActive = activeBookings
              .filter((b) => {
                const bs = timeToMin(b.startTime);
                const be = timeToMin(b.endTime);
                return bs >= rangeStart && be <= rangeEnd;
              })
              .sort((a, b) => timeToMin(a.startTime) - timeToMin(b.startTime));

            const gaps: Array<{ start: number; end: number }> = [];
            let cursor = rangeStart;
            for (const bk of sortedActive) {
              const bs = timeToMin(bk.startTime);
              if (bs > cursor) gaps.push({ start: cursor, end: bs });
              // Use extended block end if set, otherwise appointment endTime
              const endMin = timeToMin(bk.endTime);
              const extEnd = bk.extendedBlockMinutes != null
                ? Math.max(endMin, bs + bk.extendedBlockMinutes)
                : endMin;
              cursor = Math.max(cursor, extEnd);
            }
            if (cursor < rangeEnd) gaps.push({ start: cursor, end: rangeEnd });

            return (
              <div key={range.id} className="border border-blue-200 rounded-lg overflow-hidden">
                {/* Range header */}
                <div className="bg-blue-50 px-3 py-2 flex items-center justify-between">
                  <div className="flex items-center gap-2 text-sm">
                    <Clock className="w-3.5 h-3.5 text-blue-600" />
                    <span className="font-medium text-blue-800">
                      {range.startTime} – {range.endTime}
                    </span>
                    <span className="text-xs text-blue-500">
                      ({totalHours}h • cada {range.intervalMinutes} min)
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    {range.location && (
                      <span className="text-xs text-indigo-600 flex items-center gap-1">
                        <MapPin className="w-3 h-3" />
                        {range.location.name}
                      </span>
                    )}
                    <button
                      onClick={() => onDeleteRange(range.id)}
                      className="text-xs px-2 py-1 rounded bg-red-50 text-red-600 hover:bg-red-100 flex items-center gap-1 transition-colors"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                </div>

                {/* Timeline content */}
                <div className="px-3 py-2 space-y-1.5">
                  {rangeBookings.length === 0 && gaps.length > 0 ? (
                    <p className="text-xs text-gray-400 py-1">Sin citas — todo libre</p>
                  ) : (
                    <>
                      {rangeBookings
                        .sort((a, b) => timeToMin(a.startTime) - timeToMin(b.startTime))
                        .map((bk) => {
                          const sc = statusColors[bk.status] ?? statusColors.PENDING;
                          const bkStartMin = timeToMin(bk.startTime);
                          const bkEndMin = timeToMin(bk.endTime);
                          const hasExtBlock = bk.extendedBlockMinutes != null && bk.extendedBlockMinutes > (bkEndMin - bkStartMin);
                          const extBlockEnd = hasExtBlock ? minToTime(bkStartMin + bk.extendedBlockMinutes!) : null;
                          return (
                            <div
                              key={bk.id}
                              className={`flex items-center gap-2 px-2.5 py-1.5 rounded-md border ${sc.bg}`}
                            >
                              <User className={`w-3.5 h-3.5 ${sc.text} flex-shrink-0`} />
                              <div className="flex-1 min-w-0">
                                <span className="text-xs font-medium text-gray-900">
                                  {bk.startTime}–{bk.endTime}
                                </span>
                                {hasExtBlock && (
                                  <span className="text-[10px] text-indigo-600 ml-1" title={`Bloqueo extendido hasta ${extBlockEnd}`}>
                                    (bloq. hasta {extBlockEnd})
                                  </span>
                                )}
                                <span className="text-xs text-gray-600 ml-1.5 truncate">
                                  {bk.patientName}
                                </span>
                                {bk.serviceName && (
                                  <span className="text-xs text-gray-400 ml-1">({bk.serviceName})</span>
                                )}
                              </div>
                              <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${sc.text}`}>
                                {sc.label}
                              </span>
                            </div>
                          );
                        })}

                      {/* Free gaps */}
                      {gaps
                        .filter((g) => g.end - g.start >= 15)
                        .map((gap) => (
                          <button
                            key={`gap-${gap.start}`}
                            onClick={() => onBookInGap(dateStr, minToTime(gap.start))}
                            className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-md border border-dashed border-gray-200 text-xs text-gray-400 hover:border-green-300 hover:text-green-600 hover:bg-green-50 transition-colors"
                          >
                            <span className="font-medium">
                              {minToTime(gap.start)}–{minToTime(gap.end)}
                            </span>
                            <span>libre ({gap.end - gap.start} min) — clic para agendar</span>
                          </button>
                        ))}
                    </>
                  )}
                </div>
              </div>
            );
          })}

          {/* Bookings outside ranges (e.g. instant bookings or legacy slots) */}
          {dayBookings
            .filter((b) => {
              const bs = timeToMin(b.startTime);
              const be = timeToMin(b.endTime);
              return !ranges.some((r) => bs >= timeToMin(r.startTime) && be <= timeToMin(r.endTime));
            })
            .sort((a, b) => timeToMin(a.startTime) - timeToMin(b.startTime))
            .map((bk) => {
              const sc = statusColors[bk.status] ?? statusColors.PENDING;
              const bkStartMin = timeToMin(bk.startTime);
              const bkEndMin = timeToMin(bk.endTime);
              const hasExtBlock = bk.extendedBlockMinutes != null && bk.extendedBlockMinutes > (bkEndMin - bkStartMin);
              const extBlockEnd = hasExtBlock ? minToTime(bkStartMin + bk.extendedBlockMinutes!) : null;
              return (
                <div
                  key={bk.id}
                  className={`flex items-center gap-2 px-2.5 py-1.5 rounded-md border ${sc.bg}`}
                >
                  <User className={`w-3.5 h-3.5 ${sc.text} flex-shrink-0`} />
                  <div className="flex-1 min-w-0">
                    <span className="text-xs font-medium text-gray-900">
                      {bk.startTime}–{bk.endTime}
                    </span>
                    {hasExtBlock && (
                      <span className="text-[10px] text-indigo-600 ml-1" title={`Bloqueo extendido hasta ${extBlockEnd}`}>
                        (bloq. hasta {extBlockEnd})
                      </span>
                    )}
                    <span className="text-xs text-gray-600 ml-1.5 truncate">{bk.patientName}</span>
                    {bk.serviceName && (
                      <span className="text-xs text-gray-400 ml-1">({bk.serviceName})</span>
                    )}
                  </div>
                  <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${sc.text}`}>
                    {sc.label}
                  </span>
                </div>
              );
            })}
        </div>
      )}
    </div>
  );
}
