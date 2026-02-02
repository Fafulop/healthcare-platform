"use client";

import { useState } from "react";
import { Search, XCircle, Calendar, Clock, User, Loader2, AlertTriangle, CheckCircle } from "lucide-react";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "";

interface BookingData {
  id: string;
  patientName: string;
  patientEmail: string;
  patientPhone: string;
  status: string;
  finalPrice: number;
  confirmationCode: string;
  slot: {
    date: string;
    startTime: string;
    endTime: string;
    duration: number;
  };
  doctor: {
    doctorFullName: string;
    primarySpecialty: string;
    clinicAddress: string | null;
    clinicPhone: string | null;
  };
}

export default function CancelBookingPage() {
  const [code, setCode] = useState("");
  const [booking, setBooking] = useState<BookingData | null>(null);
  const [loading, setLoading] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cancelled, setCancelled] = useState(false);

  const lookupBooking = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!code.trim()) return;

    setLoading(true);
    setError(null);
    setBooking(null);
    setCancelled(false);

    try {
      const res = await fetch(`${API_URL}/api/appointments/bookings/${code.trim()}`);
      const data = await res.json();

      if (data.success) {
        setBooking(data.data);
      } else {
        setError("No se encontró una cita con ese código de confirmación.");
      }
    } catch {
      setError("Error al buscar la cita. Intenta de nuevo.");
    } finally {
      setLoading(false);
    }
  };

  const cancelBooking = async () => {
    if (!booking) return;
    if (!confirm("¿Estás seguro de que quieres cancelar esta cita?")) return;

    setCancelling(true);
    setError(null);

    try {
      const res = await fetch(`${API_URL}/api/appointments/bookings/${booking.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "CANCELLED" }),
      });
      const data = await res.json();

      if (data.success) {
        setCancelled(true);
        setBooking(null);
      } else {
        setError(data.error || "Error al cancelar la cita.");
      }
    } catch {
      setError("Error al cancelar la cita. Intenta de nuevo.");
    } finally {
      setCancelling(false);
    }
  };

  const formatDate = (dateStr: string) => {
    try {
      const [year, month, day] = dateStr.split("T")[0].split("-").map(Number);
      return new Date(year, month - 1, day).toLocaleDateString("es-MX", {
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric",
      });
    } catch {
      return dateStr;
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-gray-900">Cancelar Cita</h1>
          <p className="text-gray-600 mt-2">
            Ingresa tu código de confirmación para ver y cancelar tu cita.
          </p>
        </div>

        {/* Success message */}
        {cancelled && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-6 flex items-start gap-3">
            <CheckCircle className="w-5 h-5 text-green-600 mt-0.5 flex-shrink-0" />
            <div>
              <p className="font-medium text-green-800">Cita cancelada exitosamente</p>
              <p className="text-sm text-green-700 mt-1">
                Tu cita ha sido cancelada. Si necesitas reagendar, contacta al consultorio.
              </p>
            </div>
          </div>
        )}

        {/* Search form */}
        <form onSubmit={lookupBooking} className="bg-white rounded-lg shadow p-6 mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Código de confirmación
          </label>
          <div className="flex gap-2">
            <input
              type="text"
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              placeholder="Ej: ABC123"
              className="flex-1 border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono uppercase"
            />
            <button
              type="submit"
              disabled={loading || !code.trim()}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md font-medium transition-colors disabled:opacity-50 flex items-center gap-2"
            >
              {loading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Search className="w-4 h-4" />
              )}
              Buscar
            </button>
          </div>
        </form>

        {/* Error */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6 flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-red-600 mt-0.5 flex-shrink-0" />
            <p className="text-sm text-red-700">{error}</p>
          </div>
        )}

        {/* Booking details */}
        {booking && (
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Detalles de la cita</h2>

            <div className="space-y-3">
              <div className="flex items-start gap-3">
                <Calendar className="w-5 h-5 text-gray-400 mt-0.5" />
                <div>
                  <p className="font-medium text-gray-900 capitalize">{formatDate(booking.slot.date)}</p>
                  <p className="text-sm text-gray-600">
                    {booking.slot.startTime} - {booking.slot.endTime}
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <User className="w-5 h-5 text-gray-400 mt-0.5" />
                <div>
                  <p className="font-medium text-gray-900">{booking.doctor.doctorFullName}</p>
                  <p className="text-sm text-gray-600">{booking.doctor.primarySpecialty}</p>
                </div>
              </div>

              <div className="flex items-center justify-between pt-3 border-t">
                <span className="text-sm text-gray-600">Estado</span>
                <span
                  className={`px-2 py-1 rounded-full text-xs font-medium ${
                    booking.status === "CONFIRMED"
                      ? "bg-green-100 text-green-700"
                      : booking.status === "PENDING"
                      ? "bg-yellow-100 text-yellow-700"
                      : booking.status === "CANCELLED"
                      ? "bg-red-100 text-red-700"
                      : "bg-gray-100 text-gray-700"
                  }`}
                >
                  {booking.status === "CONFIRMED" ? "Confirmada" :
                   booking.status === "PENDING" ? "Pendiente" :
                   booking.status === "CANCELLED" ? "Cancelada" :
                   booking.status === "COMPLETED" ? "Completada" :
                   booking.status}
                </span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">Precio</span>
                <span className="font-semibold text-gray-900">${booking.finalPrice}</span>
              </div>
            </div>

            {/* Cancel button - only for active bookings */}
            {(booking.status === "PENDING" || booking.status === "CONFIRMED") && (
              <button
                onClick={cancelBooking}
                disabled={cancelling}
                className="w-full mt-6 px-4 py-3 bg-red-600 hover:bg-red-700 text-white rounded-md font-semibold transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {cancelling ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Cancelando...
                  </>
                ) : (
                  <>
                    <XCircle className="w-5 h-5" />
                    Cancelar Cita
                  </>
                )}
              </button>
            )}

            {booking.status === "CANCELLED" && (
              <p className="mt-4 text-center text-sm text-gray-500">
                Esta cita ya fue cancelada.
              </p>
            )}

            {(booking.status === "COMPLETED" || booking.status === "NO_SHOW") && (
              <p className="mt-4 text-center text-sm text-gray-500">
                Esta cita ya fue finalizada y no puede cancelarse.
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
