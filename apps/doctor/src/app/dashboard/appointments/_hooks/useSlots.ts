import { useState, useEffect, useCallback, useRef } from "react";
import { authFetch } from "@/lib/auth-fetch";
import { toast } from "@/lib/practice-toast";
import { practiceConfirm } from "@/lib/practice-confirm";
import { useDoctorProfile } from "@/contexts/DoctorProfileContext";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "";

export interface AppointmentSlot {
  id: string;
  date: string;
  startTime: string;
  endTime: string;
  duration: number;
  basePrice: number;
  discount: number | null;
  discountType: string | null;
  finalPrice: number;
  isOpen: boolean;
  isPublic: boolean;
  currentBookings: number;
  maxBookings: number;
  location: { name: string; address: string } | null;
  isBlockedByBooking?: boolean;
}

export interface ClinicLocation {
  id: string;
  name: string;
  address: string | null;
  phone: string | null;
}

export function useSlots(doctorId: string | undefined, selectedDate: Date) {
  const { doctorProfile } = useDoctorProfile();
  const [slots, setSlots] = useState<AppointmentSlot[]>([]);
  const [clinicLocations, setClinicLocations] = useState<ClinicLocation[]>([]);
  const [loading, setLoading] = useState(true);
  const hasLoadedOnce = useRef(false);
  const [selectedSlots, setSelectedSlots] = useState<Set<string>>(new Set());

  const fetchSlots = useCallback(async () => {
    if (!doctorId) return;

    if (!hasLoadedOnce.current) setLoading(true);
    try {
      const year = selectedDate.getFullYear();
      const month = selectedDate.getMonth();
      const startStr = `${year}-${String(month + 1).padStart(2, "0")}-01`;
      const startDate = new Date(startStr + "T00:00:00Z").toISOString();
      const lastDay = new Date(year, month + 1, 0).getDate();
      const endStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
      const endDate = new Date(endStr + "T23:59:59Z").toISOString();

      const response = await authFetch(
        `${API_URL}/api/appointments/slots?doctorId=${doctorId}&startDate=${startDate}&endDate=${endDate}`
      );
      const data = await response.json();

      if (data.success) {
        setSlots(data.data);
      }
    } catch (error) {
      console.error("Error fetching slots:", error);
      toast.error("Error al cargar los horarios");
    } finally {
      hasLoadedOnce.current = true;
      setLoading(false);
    }
  }, [doctorId, selectedDate]);

  const fetchClinicLocations = useCallback(async () => {
    const slug = doctorProfile?.slug;
    if (!slug) return;
    try {
      const response = await fetch(`${API_URL}/api/doctors/${slug}/locations`);
      const data = await response.json();
      if (data.success && Array.isArray(data.data)) {
        setClinicLocations(data.data);
      }
    } catch (error) {
      console.error("Error fetching clinic locations:", error);
    }
  }, [doctorProfile?.slug]);

  useEffect(() => { fetchSlots(); }, [fetchSlots]);
  useEffect(() => { fetchClinicLocations(); }, [fetchClinicLocations]);

  const deleteSlot = async (slotId: string, bookings: { id: string; slotId: string | null; status: string; patientName: string }[]) => {
    const activeBookings = bookings.filter(
      (b) =>
        b.slotId === slotId &&
        b.status !== "CANCELLED" &&
        b.status !== "COMPLETED" &&
        b.status !== "NO_SHOW"
    );

    if (activeBookings.length > 0) {
      if (
        !await practiceConfirm(
          `Este horario tiene ${activeBookings.length} cita(s) activa(s). ¿Cancelar las citas y eliminar el horario?`
        )
      )
        return;

      for (const booking of activeBookings) {
        try {
          const cancelRes = await authFetch(
            `${API_URL}/api/appointments/bookings/${booking.id}`,
            { method: "PATCH", body: JSON.stringify({ status: "CANCELLED" }) }
          );
          const cancelData = await cancelRes.json();
          if (!cancelData.success) {
            toast.error(
              `Error al cancelar la cita de ${booking.patientName}. El horario no fue eliminado.`
            );
            return;
          }
        } catch {
          toast.error("Error al cancelar una cita. El horario no fue eliminado.");
          return;
        }
      }
    } else {
      if (!await practiceConfirm("¿Estás seguro de que quieres eliminar este horario?")) return;
    }

    try {
      const response = await authFetch(`${API_URL}/api/appointments/slots/${slotId}`, {
        method: "DELETE",
      });
      const data = await response.json();

      if (data.success || response.status === 404) {
        toast.success("Horario eliminado exitosamente");
        fetchSlots();
      } else {
        toast.error(data.error || "Error al eliminar horario");
      }
    } catch {
      toast.error("Error al eliminar horario");
    }
  };

  const toggleOpenSlot = async (slotId: string, currentIsOpen: boolean) => {
    const slot = slots.find((s) => s.id === slotId);
    const newIsOpen = !currentIsOpen;

    if (slot && !newIsOpen && slot.currentBookings > 0) {
      toast.error(
        `No se puede cerrar este horario porque tiene ${slot.currentBookings} reserva(s) activa(s). Por favor cancela las reservas primero.`
      );
      return;
    }

    if (slot && newIsOpen && slot.currentBookings >= slot.maxBookings) {
      toast.error(
        `Este horario ya está lleno (${slot.currentBookings}/${slot.maxBookings} reservas). No se puede abrir para nuevas citas.`
      );
      return;
    }

    try {
      const response = await authFetch(`${API_URL}/api/appointments/slots/${slotId}`, {
        method: "PATCH",
        body: JSON.stringify({ isOpen: newIsOpen }),
      });
      const data = await response.json();

      if (data.success) {
        toast.success(data.message);
        fetchSlots();
      } else {
        toast.error(data.error || "Error al actualizar horario");
      }
    } catch {
      toast.error("Error al actualizar horario");
    }
  };

  const bulkAction = async (action: "delete" | "close" | "open") => {
    const slotIds = Array.from(selectedSlots);

    if (slotIds.length === 0) {
      toast.error("Por favor selecciona horarios primero");
      return;
    }

    if (action === "close") {
      const slotsWithBookings = slots.filter(
        (s) => slotIds.includes(s.id) && s.currentBookings > 0
      );
      if (slotsWithBookings.length > 0) {
        toast.error(
          `No se pueden cerrar ${slotsWithBookings.length} horario(s) porque tienen reservas activas. Por favor cancela las reservas primero o deselecciona esos horarios.`
        );
        return;
      }
    }

    const actionText =
      action === "delete" ? "eliminar" : action === "close" ? "cerrar" : "abrir";
    if (!await practiceConfirm(`¿Estás seguro de que quieres ${actionText} ${slotIds.length} horario(s)?`)) return;

    try {
      const response = await authFetch(`${API_URL}/api/appointments/slots/bulk`, {
        method: "POST",
        body: JSON.stringify({ slotIds, action }),
      });
      const data = await response.json();

      if (data.success) {
        toast.success(
          `${data.count} horario(s) ${
            actionText === "eliminar"
              ? "eliminados"
              : actionText === "cerrar"
              ? "cerrados"
              : "abiertos"
          } exitosamente`
        );
        setSelectedSlots(new Set());
        fetchSlots();
      } else {
        toast.error(data.error || `Error al ${actionText} horarios`);
      }
    } catch {
      toast.error(`Error al ${actionText} horarios`);
    }
  };

  const toggleSlotSelection = (slotId: string) => {
    const newSelected = new Set(selectedSlots);
    if (newSelected.has(slotId)) {
      newSelected.delete(slotId);
    } else {
      newSelected.add(slotId);
    }
    setSelectedSlots(newSelected);
  };

  const toggleAllSlots = (visibleSlotIds: string[]) => {
    const allSelected = visibleSlotIds.every((id) => selectedSlots.has(id));
    if (allSelected) {
      setSelectedSlots(new Set());
    } else {
      setSelectedSlots(new Set(visibleSlotIds));
    }
  };

  const getSlotStatus = (slot: AppointmentSlot): { label: string; color: string } => {
    const isFull = slot.currentBookings >= slot.maxBookings;
    if (!slot.isOpen) return { label: "Cerrado", color: "bg-gray-200 text-gray-700" };
    if (isFull) return { label: "Lleno", color: "bg-blue-100 text-blue-700" };
    return { label: "Disponible", color: "bg-green-100 text-green-700" };
  };

  const selectedDateStr = `${selectedDate.getFullYear()}-${String(selectedDate.getMonth() + 1).padStart(2, "0")}-${String(selectedDate.getDate()).padStart(2, "0")}`;
  const slotsForSelectedDate = slots.filter(
    (slot) => slot.date.split("T")[0] === selectedDateStr
  );
  const datesWithSlots = new Set(slots.map((slot) => slot.date.split("T")[0]));

  return {
    slots,
    clinicLocations,
    loading,
    selectedSlots,
    setSelectedSlots,
    fetchSlots,
    deleteSlot,
    toggleOpenSlot,
    bulkAction,
    toggleSlotSelection,
    toggleAllSlots,
    getSlotStatus,
    slotsForSelectedDate,
    datesWithSlots,
  };
}
