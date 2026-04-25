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
  confirmationEmailSentAt?: string | null;
  meetLink?: string | null;
  isRescheduled?: boolean;
  extendedBlockMinutes?: number | null;
  patientId?: string | null;
  patient?: { id: string; firstName: string; lastName: string } | null;
  formLink?: {
    id: string;
    token: string;
    status: 'PENDING' | 'SUBMITTED';
    createdAt: string;
  } | null;
}

export function useBookings(doctorId: string | undefined) {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [bookingsCollapsed, setBookingsCollapsed] = useState(false);
  const [bookingFilterDate, setBookingFilterDate] = useState<string>(() => getLocalDateString(new Date()));
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

  const updatePatientLink = async (
    bookingId: string,
    patientId: string | null,
    patient: { id: string; firstName: string; lastName: string } | null,
  ) => {
    try {
      const response = await authFetch(
        `${API_URL}/api/appointments/bookings/${bookingId}`,
        { method: "PATCH", body: JSON.stringify({ patientId }) }
      );
      const data = await response.json();
      if (data.success) {
        setBookings((prev) =>
          prev.map((b) => b.id === bookingId ? { ...b, patientId, patient } : b)
        );
      } else {
        toast.error(data.error || "Error al vincular paciente");
      }
    } catch {
      toast.error("Error al vincular paciente");
    }
  };

  const updateExtendedBlock = async (bookingId: string, extendedBlockMinutes: number | null) => {
    try {
      const response = await authFetch(
        `${API_URL}/api/appointments/bookings/${bookingId}`,
        { method: "PATCH", body: JSON.stringify({ extendedBlockMinutes }) }
      );
      const data = await response.json();
      if (data.success) {
        toast.success("Bloqueo actualizado");
        setBookings((prev) =>
          prev.map((b) => b.id === bookingId ? { ...b, extendedBlockMinutes } : b)
        );
      } else {
        toast.error(data.error || "Error al actualizar el bloqueo");
      }
    } catch {
      toast.error("Error al actualizar el bloqueo");
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

  const completeBooking = async (bookingId: string, price: number, formaDePago: string) => {
    try {
      // 1. Mark booking as COMPLETED
      const statusRes = await authFetch(
        `${API_URL}/api/appointments/bookings/${bookingId}`,
        { method: "PATCH", body: JSON.stringify({ status: "COMPLETED" }) }
      );
      const statusData = await statusRes.json();
      if (!statusData.success) {
        toast.error(statusData.error || "Error al completar la cita");
        return;
      }

      // 2. Build concept from local booking state
      const booking = bookings.find((b) => b.id === bookingId);
      const patientName = booking?.patientName ?? "";
      const serviceName = booking?.serviceName;
      const concept = serviceName
        ? `${serviceName} - ${patientName}`
        : `Consulta - ${patientName}`;

      // 3. Create ledger entry (fire the call, but surface errors as a soft warning)
      const appointmentDate = (booking?.slot?.date ?? booking?.date ?? "").split("T")[0];
      const transactionDate = appointmentDate || new Date().toISOString().split("T")[0];
      const ledgerRes = await authFetch(
        `${API_URL}/api/practice-management/ledger`,
        {
          method: "POST",
          body: JSON.stringify({
            entryType: "ingreso",
            amount: price,
            concept,
            formaDePago,
            transactionDate,
            paymentStatus: "PAID",
            amountPaid: price,
          }),
        }
      );
      const ledgerData = await ledgerRes.json();
      if (!ledgerData.data) {
        toast.error("Cita completada, pero hubo un error al crear el movimiento en Flujo de Dinero");
      } else {
        toast.success("Cita completada · ingreso registrado en Flujo de Dinero");
      }

      fetchBookings();
    } catch {
      toast.error("Error al completar la cita");
    }
  };

  const updateBookingPrice = async (bookingId: string, price: number) => {
    try {
      const res = await authFetch(
        `${API_URL}/api/appointments/bookings/${bookingId}`,
        { method: "PATCH", body: JSON.stringify({ finalPrice: price }) }
      );
      const data = await res.json();
      if (data.success) {
        setBookings((prev) =>
          prev.map((b) => b.id === bookingId ? { ...b, finalPrice: price } : b)
        );
      } else {
        toast.error(data.error || "Error al actualizar el precio");
      }
    } catch {
      toast.error("Error al actualizar el precio");
    }
  };

  const deleteFormLink = async (bookingId: string) => {
    try {
      const response = await authFetch(
        `${API_URL}/api/appointments/bookings/${bookingId}/form-link`,
        { method: "DELETE" }
      );
      const data = await response.json();
      if (data.success) {
        setBookings((prev) =>
          prev.map((b) => b.id === bookingId ? { ...b, formLink: null } : b)
        );
      } else {
        toast.error(data.error || "Error al eliminar el formulario");
      }
    } catch {
      toast.error("Error al eliminar el formulario");
    }
  };

  const sendConfirmationEmail = async (bookingId: string): Promise<void> => {
    try {
      const response = await authFetch(
        `${API_URL}/api/appointments/bookings/${bookingId}/send-email`,
        { method: "POST" }
      );
      const data = await response.json();

      if (data.success) {
        toast.success(data.message || "Correo enviado exitosamente");
        // Update local state so button reflects sent timestamp and Meet link immediately
        setBookings((prev) =>
          prev.map((b) =>
            b.id === bookingId
              ? {
                  ...b,
                  confirmationEmailSentAt: data.sentAt ?? new Date().toISOString(),
                  ...(data.meetLink ? { meetLink: data.meetLink } : {}),
                }
              : b
          )
        );
      } else if (data.code === "GMAIL_SCOPE_MISSING" || data.code === "NO_GOOGLE_TOKEN" || data.code === "TOKEN_EXPIRED") {
        toast.error(data.error);
      } else {
        toast.error(data.error || "Error al enviar el correo");
      }
    } catch {
      toast.error("Error al enviar el correo");
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
    updatePatientLink,
    updateExtendedBlock,
    completeBooking,
    updateBookingPrice,
    deleteBooking,
    deleteFormLink,
    sendConfirmationEmail,
    shiftBookingFilterDate,
    getStatusColor,
    sortColumn,
    sortDirection,
    toggleSort,
  };
}
