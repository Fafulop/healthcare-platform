import { CheckCircle, XCircle, AlertCircle } from "lucide-react";

const STATUS_LABEL: Record<string, string> = {
  PENDING: "PENDIENTE",
  CONFIRMED: "AGENDADA",
  COMPLETED: "COMPLETADA",
  NO_SHOW: "NO ASISTIÓ",
  CANCELLED: "CANCELADA",
};

function getStatusIcon(status: string) {
  switch (status) {
    case "CONFIRMED":
      return <CheckCircle className="w-4 h-4" />;
    case "CANCELLED":
      return <XCircle className="w-4 h-4" />;
    case "PENDING":
      return <AlertCircle className="w-4 h-4" />;
    default:
      return null;
  }
}

function getStatusLabel(status: string, slotEndTime?: string, slotDate?: string): string {
  if ((status === "PENDING" || status === "CONFIRMED") && slotEndTime && slotDate) {
    const nowLocal = new Date().toLocaleString("sv-SE", {
      timeZone: "America/Mexico_City",
    });
    const slotEndStr = `${slotDate.split("T")[0]} ${slotEndTime}:00`;
    if (slotEndStr < nowLocal) return "VENCIDA";
  }
  return STATUS_LABEL[status] ?? status;
}

interface Props {
  status: string;
  colorClass: string;
  slotEndTime?: string;
  slotDate?: string;
}

export function BookingStatusBadge({ status, colorClass, slotEndTime, slotDate }: Props) {
  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border ${colorClass}`}
    >
      {getStatusIcon(status)}
      {getStatusLabel(status, slotEndTime, slotDate)}
    </span>
  );
}
