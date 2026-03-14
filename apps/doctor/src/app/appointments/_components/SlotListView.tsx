import { Calendar, Clock, DollarSign, Lock, Unlock, Trash2, CheckSquare, Square, MapPin, ChevronLeft, ChevronRight } from "lucide-react";
import { getLocalDateString } from "@/lib/dates";
import type { AppointmentSlot } from "../_hooks/useSlots";

interface Props {
  slots: AppointmentSlot[];
  listDate: string;
  setListDate: (d: string) => void;
  showAllSlots: boolean;
  setShowAllSlots: (v: boolean) => void;
  selectedSlots: Set<string>;
  onToggleSelection: (id: string) => void;
  onToggleAllSlots: (ids: string[]) => void;
  onToggleOpen: (id: string, currentIsOpen: boolean) => void;
  onDelete: (id: string) => void;
  onBookWithSlot: (slot: AppointmentSlot) => void;
  onBulkAction: (action: "delete" | "close" | "open") => void;
  getSlotStatus: (slot: AppointmentSlot) => { label: string; color: string };
}

export function SlotListView({
  slots,
  listDate,
  setListDate,
  showAllSlots,
  setShowAllSlots,
  selectedSlots,
  onToggleSelection,
  onToggleAllSlots,
  onToggleOpen,
  onDelete,
  onBookWithSlot,
  onBulkAction,
  getSlotStatus,
}: Props) {
  const slotsForListDate = slots.filter((s) => s.date.split("T")[0] === listDate);
  const visibleSlots = showAllSlots ? slots : slotsForListDate;
  const slotIds = visibleSlots.map((s) => s.id);
  const allSelected = slotIds.length > 0 && slotIds.every((id) => selectedSlots.has(id));

  const shiftDate = (days: number) => {
    const base = listDate ? new Date(listDate + "T00:00:00") : new Date();
    base.setDate(base.getDate() + days);
    setListDate(getLocalDateString(base));
  };

  return (
    <div className="bg-white rounded-lg shadow p-4 sm:p-6">
      {/* List header + controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-2">
          {!showAllSlots && (
            <>
              <button
                onClick={() => shiftDate(-1)}
                className="p-1.5 rounded hover:bg-gray-100 text-gray-600"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <input
                type="date"
                value={listDate}
                onChange={(e) => setListDate(e.target.value)}
                className="text-sm border border-gray-200 rounded px-2 py-1.5 text-gray-700 focus:outline-none focus:ring-1 focus:ring-blue-400"
              />
              <button
                onClick={() => shiftDate(1)}
                className="p-1.5 rounded hover:bg-gray-100 text-gray-600"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </>
          )}
          <button
            onClick={() => setShowAllSlots(!showAllSlots)}
            className="text-xs text-blue-600 hover:text-blue-800 px-2 py-1 rounded hover:bg-blue-50 transition-colors"
          >
            {showAllSlots ? "Filtrar por fecha" : "Todos los horarios"}
          </button>
        </div>

        {selectedSlots.size > 0 && (
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs text-gray-500">{selectedSlots.size} seleccionado(s)</span>
            <button
              onClick={() => onBulkAction("open")}
              className="text-xs px-2 py-1 rounded bg-green-100 text-green-700 hover:bg-green-200"
            >
              Abrir
            </button>
            <button
              onClick={() => onBulkAction("close")}
              className="text-xs px-2 py-1 rounded bg-gray-100 text-gray-700 hover:bg-gray-200"
            >
              Cerrar
            </button>
            <button
              onClick={() => onBulkAction("delete")}
              className="text-xs px-2 py-1 rounded bg-red-100 text-red-700 hover:bg-red-200"
            >
              Eliminar
            </button>
          </div>
        )}
      </div>

      {/* Select all */}
      {visibleSlots.length > 1 && (
        <div className="mb-3">
          <button
            onClick={() => onToggleAllSlots(slotIds)}
            className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-700"
          >
            {allSelected ? (
              <CheckSquare className="w-3.5 h-3.5" />
            ) : (
              <Square className="w-3.5 h-3.5" />
            )}
            {allSelected ? "Deseleccionar todos" : "Seleccionar todos"}
          </button>
        </div>
      )}

      {visibleSlots.length === 0 ? (
        <div className="text-center py-12 text-gray-400">
          <Calendar className="w-12 h-12 mx-auto mb-2 opacity-50" />
          <p className="text-sm">
            {showAllSlots ? "No hay horarios creados" : "Sin horarios para esta fecha"}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {visibleSlots.map((slot) => {
            const { label, color } = getSlotStatus(slot);
            const isSelected = selectedSlots.has(slot.id);

            return (
              <div
                key={slot.id}
                className={`border rounded-lg p-4 transition-colors ${
                  isSelected ? "border-blue-400 bg-blue-50" : "border-gray-200"
                }`}
              >
                <div className="flex items-start gap-3">
                  <button
                    onClick={() => onToggleSelection(slot.id)}
                    className="mt-0.5 text-gray-400 hover:text-blue-600 flex-shrink-0"
                  >
                    {isSelected ? (
                      <CheckSquare className="w-4 h-4 text-blue-600" />
                    ) : (
                      <Square className="w-4 h-4" />
                    )}
                  </button>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div>
                        <p className="text-sm font-medium text-gray-900">
                          {slot.date.split("T")[0]}
                        </p>
                        <div className="flex items-center gap-1.5 text-sm text-gray-600 mt-0.5">
                          <Clock className="w-3.5 h-3.5 text-gray-400" />
                          {slot.startTime} – {slot.endTime}
                          <span className="text-xs text-gray-400">({slot.duration}min)</span>
                        </div>
                      </div>
                      <span className={`text-xs px-1.5 py-0.5 rounded font-medium flex-shrink-0 ${color}`}>
                        {label}
                      </span>
                    </div>

                    <div className="flex items-center gap-3 text-xs text-gray-500 mb-2 flex-wrap">
                      <span className="flex items-center gap-1">
                        <DollarSign className="w-3 h-3" />
                        ${Number(slot.finalPrice).toLocaleString()}
                      </span>
                      <span>{slot.currentBookings}/{slot.maxBookings} reservas</span>
                      {slot.location && (
                        <span className="flex items-center gap-1 text-indigo-600">
                          <MapPin className="w-3 h-3" />
                          {slot.location.name}
                        </span>
                      )}
                    </div>

                    <div className="flex gap-2 flex-wrap">
                      <button
                        onClick={() => onBookWithSlot(slot)}
                        disabled={!slot.isOpen || slot.currentBookings >= slot.maxBookings}
                        className="text-xs px-2.5 py-1 rounded bg-green-600 text-white hover:bg-green-700 disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        Agendar
                      </button>
                      <button
                        onClick={() => onToggleOpen(slot.id, slot.isOpen)}
                        className={`text-xs px-2.5 py-1 rounded flex items-center gap-1 ${
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
                        className="text-xs px-2.5 py-1 rounded bg-red-50 text-red-600 hover:bg-red-100 flex items-center gap-1"
                      >
                        <Trash2 className="w-3 h-3" /> Eliminar
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
