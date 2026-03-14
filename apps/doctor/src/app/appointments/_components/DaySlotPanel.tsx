import { Calendar, Clock, DollarSign, Lock, Unlock, Trash2, CheckSquare, Square, MapPin } from "lucide-react";
import { formatLocalDate } from "@/lib/dates";
import type { AppointmentSlot } from "../_hooks/useSlots";

interface Props {
  selectedDate: Date;
  slots: AppointmentSlot[];
  selectedSlots: Set<string>;
  onToggleSelection: (id: string) => void;
  onToggleAllSlots: (ids: string[]) => void;
  onToggleOpen: (id: string, currentIsOpen: boolean) => void;
  onDelete: (id: string) => void;
  onBookWithSlot: (slot: AppointmentSlot) => void;
  getSlotStatus: (slot: AppointmentSlot) => { label: string; color: string };
}

export function DaySlotPanel({
  selectedDate,
  slots,
  selectedSlots,
  onToggleSelection,
  onToggleAllSlots,
  onToggleOpen,
  onDelete,
  onBookWithSlot,
  getSlotStatus,
}: Props) {
  const slotIds = slots.map((s) => s.id);
  const allSelected = slotIds.length > 0 && slotIds.every((id) => selectedSlots.has(id));

  return (
    <div className="bg-white rounded-lg shadow p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-semibold text-gray-900 text-sm">
          {formatLocalDate(selectedDate.toISOString(), { weekday: "long", month: "long", day: "numeric" })}
        </h3>
        {slots.length > 1 && (
          <button
            onClick={() => onToggleAllSlots(slotIds)}
            className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700 transition-colors"
          >
            {allSelected ? (
              <CheckSquare className="w-3.5 h-3.5" />
            ) : (
              <Square className="w-3.5 h-3.5" />
            )}
            {allSelected ? "Deselect" : "Select all"}
          </button>
        )}
      </div>

      {slots.length === 0 ? (
        <div className="text-center py-6 text-gray-400">
          <Calendar className="w-8 h-8 mx-auto mb-2 opacity-50" />
          <p className="text-xs">Sin horarios este día</p>
        </div>
      ) : (
        <div className="space-y-2">
          {slots.map((slot) => {
            const { label, color } = getSlotStatus(slot);
            const isSelected = selectedSlots.has(slot.id);

            return (
              <div
                key={slot.id}
                className={`border rounded-lg p-3 transition-colors ${
                  isSelected ? "border-blue-400 bg-blue-50" : "border-gray-200"
                }`}
              >
                <div className="flex items-start gap-2">
                  <button
                    onClick={() => onToggleSelection(slot.id)}
                    className="mt-0.5 text-gray-400 hover:text-blue-600 transition-colors flex-shrink-0"
                  >
                    {isSelected ? (
                      <CheckSquare className="w-4 h-4 text-blue-600" />
                    ) : (
                      <Square className="w-4 h-4" />
                    )}
                  </button>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <div className="flex items-center gap-1.5 text-sm font-medium text-gray-900">
                        <Clock className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                        {slot.startTime} – {slot.endTime}
                        <span className="text-xs text-gray-400">({slot.duration}min)</span>
                      </div>
                      <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${color}`}>
                        {label}
                      </span>
                    </div>

                    <div className="flex items-center gap-3 text-xs text-gray-500 mb-2">
                      <span className="flex items-center gap-1">
                        <DollarSign className="w-3 h-3" />
                        ${Number(slot.finalPrice).toLocaleString()}
                      </span>
                      <span>
                        {slot.currentBookings}/{slot.maxBookings} reservas
                      </span>
                      {slot.location && (
                        <span className="flex items-center gap-1 text-indigo-600">
                          <MapPin className="w-3 h-3" />
                          {slot.location.name}
                        </span>
                      )}
                    </div>

                    <div className="flex gap-1.5 flex-wrap">
                      <button
                        onClick={() => onBookWithSlot(slot)}
                        disabled={!slot.isOpen || slot.currentBookings >= slot.maxBookings}
                        className="text-xs px-2 py-1 rounded bg-green-600 text-white hover:bg-green-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                      >
                        Agendar
                      </button>
                      <button
                        onClick={() => onToggleOpen(slot.id, slot.isOpen)}
                        className={`text-xs px-2 py-1 rounded flex items-center gap-1 transition-colors ${
                          slot.isOpen
                            ? "bg-gray-100 text-gray-700 hover:bg-gray-200"
                            : "bg-blue-100 text-blue-700 hover:bg-blue-200"
                        }`}
                      >
                        {slot.isOpen ? (
                          <><Lock className="w-3 h-3" /> Cerrar</>
                        ) : (
                          <><Unlock className="w-3 h-3" /> Abrir</>
                        )}
                      </button>
                      <button
                        onClick={() => onDelete(slot.id)}
                        className="text-xs px-2 py-1 rounded bg-red-50 text-red-600 hover:bg-red-100 flex items-center gap-1 transition-colors"
                      >
                        <Trash2 className="w-3 h-3" />
                        Eliminar
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
