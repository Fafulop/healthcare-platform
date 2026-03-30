"use client";

import { CheckCircle, DollarSign, Stethoscope, Mail } from "lucide-react";
import { formatLocalDate } from "@/lib/dates";

interface DoctorService {
  id: string;
  serviceName: string;
  price: number | null;
}

interface DisplaySlot {
  date: string;
  startTime: string;
  endTime: string;
}

interface Props {
  patientName: string;
  displaySlot: DisplaySlot | null;
  selectedService: DoctorService | null;
  confirmationCode: string;
  onClose: () => void;
  isRescheduled?: boolean;
}

export function SuccessStep({
  patientName,
  displaySlot,
  selectedService,
  confirmationCode,
  onClose,
  isRescheduled = false,
}: Props) {
  return (
    <div className="text-center py-6">
      <div className={`w-16 h-16 ${isRescheduled ? "bg-amber-100" : "bg-green-100"} rounded-full flex items-center justify-center mx-auto mb-4`}>
        <CheckCircle className={`w-9 h-9 ${isRescheduled ? "text-amber-600" : "text-green-600"}`} />
      </div>
      <h3 className="text-xl font-bold text-gray-900 mb-1">
        {isRescheduled ? "Cita Reagendada" : "Cita Confirmada"}
      </h3>
      <p className="text-sm text-gray-500 mb-6">
        {isRescheduled
          ? "La cita ha sido reagendada exitosamente con la nueva fecha y horario"
          : "La cita ha sido agendada y confirmada exitosamente"}
      </p>

      <div className="bg-gray-50 rounded-xl p-5 text-left space-y-3 mb-6">
        <div className="flex justify-between text-sm">
          <span className="text-gray-500">Paciente</span>
          <span className="font-semibold text-gray-900">{patientName}</span>
        </div>
        {displaySlot && (
          <>
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Fecha</span>
              <span className="font-semibold text-gray-900 capitalize">
                {formatLocalDate(displaySlot.date, {
                  weekday: "long",
                  day: "numeric",
                  month: "long",
                })}
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Horario</span>
              <span className="font-semibold text-gray-900">
                {displaySlot.startTime} – {displaySlot.endTime}
              </span>
            </div>
          </>
        )}
        {selectedService && (
          <>
            <div className="flex justify-between text-sm">
              <span className="text-gray-500 flex items-center gap-1">
                <Stethoscope className="w-3 h-3" /> Servicio
              </span>
              <span className="font-semibold text-gray-900">{selectedService.serviceName}</span>
            </div>
            {selectedService.price != null && (
              <div className="flex justify-between text-sm">
                <span className="text-gray-500 flex items-center gap-1">
                  <DollarSign className="w-3 h-3" /> Precio
                </span>
                <span className="font-semibold text-gray-900">${selectedService.price}</span>
              </div>
            )}
          </>
        )}
        <div className="border-t pt-3 flex justify-between items-center">
          <span className="text-gray-500 text-sm">Código</span>
          <code className="text-base bg-white border border-gray-200 px-3 py-1 rounded-lg font-mono font-bold tracking-widest">
            {confirmationCode}
          </code>
        </div>
      </div>

      {isRescheduled && (
        <div className="flex items-start gap-3 p-4 bg-amber-50 border border-amber-200 rounded-lg text-left mb-4">
          <Mail className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
          <div>
            <p className="text-sm font-semibold text-amber-800">Envía el correo de confirmación</p>
            <p className="text-xs text-amber-700 mt-0.5">
              El paciente aún tiene el correo de la cita anterior. Usa el botón <strong>Correo</strong> en la nueva cita para notificarle la nueva fecha y horario.
            </p>
          </div>
        </div>
      )}

      <button
        onClick={onClose}
        className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold text-sm transition-colors"
      >
        Cerrar
      </button>
    </div>
  );
}
