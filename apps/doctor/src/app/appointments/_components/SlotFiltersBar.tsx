import type { AppointmentSlot } from "../_hooks/useSlots";

export type SlotStatusFilter = "all" | "open" | "blocked" | "full";

export function applySlotStatusFilter(
  slots: AppointmentSlot[],
  filter: SlotStatusFilter
): AppointmentSlot[] {
  if (filter === "all") return slots;
  if (filter === "open") return slots.filter((s) => s.isOpen && s.currentBookings < s.maxBookings);
  if (filter === "blocked") return slots.filter((s) => !s.isOpen);
  if (filter === "full") return slots.filter((s) => s.isOpen && s.currentBookings >= s.maxBookings);
  return slots;
}

interface Props {
  value: SlotStatusFilter;
  onChange: (v: SlotStatusFilter) => void;
}

const OPTIONS: { value: SlotStatusFilter; label: string; active: string }[] = [
  { value: "all", label: "Todos", active: "bg-gray-700 text-white" },
  { value: "open", label: "Disponible", active: "bg-green-600 text-white" },
  { value: "blocked", label: "Bloqueado", active: "bg-gray-500 text-white" },
  { value: "full", label: "Lleno", active: "bg-blue-600 text-white" },
];

export function SlotFiltersBar({ value, onChange }: Props) {
  return (
    <div className="flex items-center gap-2 flex-wrap">
      <span className="text-xs text-gray-500 font-medium">Estado:</span>
      {OPTIONS.map((opt) => (
        <button
          key={opt.value}
          onClick={() => onChange(opt.value)}
          className={`text-xs px-3 py-1 rounded-full font-medium transition-colors ${
            value === opt.value ? opt.active : "bg-gray-100 text-gray-600 hover:bg-gray-200"
          }`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}
