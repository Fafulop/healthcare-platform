import { useState, useEffect, useCallback } from "react";
import { authFetch } from "@/lib/auth-fetch";
import { toast } from "@/lib/practice-toast";
import { practiceConfirm } from "@/lib/practice-confirm";
import { getLocalDateString } from "@/lib/dates";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "";

export type SortColumn = "patient" | "date" | "status";
export type SortDirection = "asc" | "desc";

const STATUS_SORT_ORDER: Record<string, number> = {
  PENDING: 0,
  CONFIRMED: 1,
  VENCIDA: 2,
  COMPLETED: 3,
  NO_SHOW: 4,
  CANCELLED: 5,
};

function getEffectiveStatus(booking: Booking, nowLocal: string): string {
  if (booking.status === "PENDING" || booking.status === "CONFIRMED") {
    const date = (booking.slot?.date ?? booking.date ?? "").split("T")[0];
    const endTime = booking.slot?.endTime ?? booking.endTime;
    if (date && endTime && `${date} ${endTime}:00` < nowLocal) return "VENCIDA";
  }
  return booking.status;
}

export interface Booking {
  id: string;
  slotId: string | null;
  patientName: string;
  patientEmail: string;
  patientPhone: string;
  patientWhatsapp: string | null;
  status: string;
  finalPrice: number;
  confirmationCode: string;
  createdAt: string;
  serviceName?: string | null;
  isFirstTime?: boolean | null;
  appointmentMode?: string | null;
  slot: { date: string; startTime: string; endTime: string; duration: number } | null;
  date?: string | null;
  startTime?: string | null;
  endTime?: string | null;
  duration?: number | null;
}

export function useBookings(doctorId: string | undefined) {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [bookingsCollapsed, setBookingsCollapsed] = useState(false);
  const [bookingFilterDate, setBookingFilterDate] = useState<string>("");
  const [bookingFilterPatient, setBookingFilterPatient] = useState<string>("");
  const [bookingFilterStatus, setBookingFilterStatus] = useState<string>("ACTIVE");
  const [sortColumn, setSortColumn] = useState<SortColumn>("status");
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");

  const toggleSort = (column: SortColumn) => {
    if (column === sortColumn) {
      setSortDirection((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortColumn(column);
      setSortDirection("asc");
    }
  };

  const fetchBookings = useCallback(async () => {
    if (!doctorId) return;
    try {
      const response = await authFetch(
        `${API_URL}/api/appointments/bookings?doctorId=${doctorId}`
      );
      const data = await response.json();
      if (data.success) {
        setBookings(data.data);
      }
    } catch (error) {
      console.error("Error fetching bookings:", error);
      toast.error("Error al cargar las citas");
    }
  }, [doctorId]);

  useEffect(() => { fetchBookings(); }, [fetchBookings]);

  const updateBookingStatus = async (bookingId: string, newStatus: string) => {
    if (
      newStatus === "CANCELLED" &&
      !await practiceConfirm("¿Estás seguro de que quieres cancelar esta cita?")
    )
      return;

    try {
      const response = await authFetch(
        `${API_URL}/api/appointments/bookings/${bookingId}`,
        { method: "PATCH", body: JSON.stringify({ status: newStatus }) }
      );
      const data = await response.json();

      if (data.success) {
        toast.success(data.message || "Estado actualizado exitosamente");
        fetchBookings();
      } else {
        toast.error(data.error || "Error al actualizar estado");
      }
    } catch {
      toast.error("Error al actualizar estado");
    }
  };

  const deleteBooking = async (bookingId: string, patientName: string) => {
    if (
      !await practiceConfirm(
        `¿Eliminar el registro de la cita de ${patientName}? Esta acción no se puede deshacer.`
      )
    )
      return;

    try {
      const response = await authFetch(
        `${API_URL}/api/appointments/bookings/${bookingId}`,
        { method: "DELETE" }
      );
      const data = await response.json();

      if (data.success) {
        toast.success("Cita eliminada exitosamente");
        fetchBookings();
      } else {
        toast.error(data.error || "Error al eliminar la cita");
      }
    } catch {
      toast.error("Error al eliminar la cita");
    }
  };

  const shiftBookingFilterDate = (days: number) => {
    const base = bookingFilterDate
      ? new Date(bookingFilterDate + "T00:00:00")
      : new Date();
    base.setDate(base.getDate() + days);
    setBookingFilterDate(getLocalDateString(base));
  };

  const nowLocal = new Date().toLocaleString("sv-SE", { timeZone: "America/Mexico_City" });

  const filteredBookings = bookings
    .filter((booking) => {
      const bookingDate = (booking.slot?.date ?? booking.date ?? "").split("T")[0];
      if (bookingFilterDate && bookingDate !== bookingFilterDate) return false;
      if (bookingFilterPatient) {
        const search = bookingFilterPatient.toLowerCase();
        if (
          !booking.patientName.toLowerCase().includes(search) &&
          !booking.patientEmail.toLowerCase().includes(search)
        )
          return false;
      }
      if (bookingFilterStatus === "ACTIVE") {
        if (booking.status !== "PENDING" && booking.status !== "CONFIRMED") return false;
      } else if (bookingFilterStatus && booking.status !== bookingFilterStatus) {
        return false;
      }
      return true;
    })
    .sort((a, b) => {
      let cmp = 0;
      if (sortColumn === "status") {
        const sa = STATUS_SORT_ORDER[getEffectiveStatus(a, nowLocal)] ?? 99;
        const sb = STATUS_SORT_ORDER[getEffectiveStatus(b, nowLocal)] ?? 99;
        cmp = sa - sb;
      } else if (sortColumn === "date") {
        const da = `${(a.slot?.date ?? a.date ?? "").split("T")[0]} ${a.slot?.startTime ?? a.startTime ?? ""}`;
        const db = `${(b.slot?.date ?? b.date ?? "").split("T")[0]} ${b.slot?.startTime ?? b.startTime ?? ""}`;
        cmp = da < db ? -1 : da > db ? 1 : 0;
      } else if (sortColumn === "patient") {
        cmp = a.patientName.localeCompare(b.patientName, "es");
      }
      return sortDirection === "asc" ? cmp : -cmp;
    });

  const getStatusColor = (status: string, slotEndTime?: string, slotDate?: string) => {
    if ((status === "PENDING" || status === "CONFIRMED") && slotEndTime && slotDate) {
      const nowLocal = new Date().toLocaleString("sv-SE", {
        timeZone: "America/Mexico_City",
      });
      const slotEndStr = `${slotDate.split("T")[0]} ${slotEndTime}:00`;
      if (slotEndStr < nowLocal) return "bg-red-100 text-red-800 border-red-300";
    }
    switch (status) {
      case "CONFIRMED":
        return "bg-blue-100 text-blue-700 border-blue-200";
      case "PENDING":
        return "bg-yellow-100 text-yellow-700 border-yellow-200";
      case "CANCELLED":
        return "bg-red-100 text-red-700 border-red-200";
      case "COMPLETED":
        return "bg-green-100 text-green-700 border-green-200";
      case "NO_SHOW":
        return "bg-orange-100 text-orange-700 border-orange-200";
      default:
        return "bg-gray-100 text-gray-700 border-gray-200";
    }
  };

  return {
    bookings,
    filteredBookings,
    bookingsCollapsed,
    setBookingsCollapsed,
    bookingFilterDate,
    setBookingFilterDate,
    bookingFilterPatient,
    setBookingFilterPatient,
    bookingFilterStatus,
    setBookingFilterStatus,
    fetchBookings,
    updateBookingStatus,
    deleteBooking,
    shiftBookingFilterDate,
    getStatusColor,
    sortColumn,
    sortDirection,
    toggleSort,
  };
}
