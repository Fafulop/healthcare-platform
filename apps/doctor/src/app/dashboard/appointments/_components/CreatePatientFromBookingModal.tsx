"use client";

import { useState } from "react";
import { X, Loader2 } from "lucide-react";
import { authFetch } from "@/lib/auth-fetch";
import type { Booking } from "../_hooks/useBookings";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "";

interface Props {
  booking: Booking;
  onClose: () => void;
  onLinked: (patient: { id: string; firstName: string; lastName: string }) => void;
}

export function CreatePatientFromBookingModal({ booking, onClose, onLinked }: Props) {
  // Split patientName on first space for pre-fill
  const spaceIdx = booking.patientName.indexOf(" ");
  const defaultFirst = spaceIdx === -1 ? booking.patientName : booking.patientName.slice(0, spaceIdx);
  const defaultLast  = spaceIdx === -1 ? "" : booking.patientName.slice(spaceIdx + 1);

  const [firstName, setFirstName]     = useState(defaultFirst);
  const [lastName, setLastName]       = useState(defaultLast);
  const [dateOfBirth, setDateOfBirth] = useState("");
  const [sex, setSex]                 = useState<"male" | "female" | "other" | "">("");
  const [email, setEmail]             = useState(booking.patientEmail ?? "");
  const [phone, setPhone]             = useState(booking.patientPhone ?? "");
  const [saving, setSaving]           = useState(false);
  const [error, setError]             = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!firstName.trim() || !lastName.trim() || !dateOfBirth || !sex) {
      setError("Nombre, apellido, fecha de nacimiento y sexo son requeridos.");
      return;
    }
    setSaving(true);
    setError("");

    try {
      // Step 1: Create patient
      const createRes = await fetch("/api/medical-records/patients", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          dateOfBirth,
          sex,
          email: email.trim() || undefined,
          phone: phone.trim() || undefined,
        }),
      });
      const createData = await createRes.json();
      if (!createRes.ok) {
        setError(createData.error || "Error al crear el expediente.");
        setSaving(false);
        return;
      }
      const patient = createData.data ?? createData;

      // Step 2: Link booking to patient
      const patchRes = await authFetch(
        `${API_URL}/api/appointments/bookings/${booking.id}`,
        {
          method: "PATCH",
          body: JSON.stringify({ patientId: patient.id }),
        }
      );
      const patchData = await patchRes.json();
      if (!patchData.success) {
        setError(patchData.error || "Expediente creado pero no se pudo vincular la cita.");
        setSaving(false);
        return;
      }

      onLinked({ id: patient.id, firstName: patient.firstName, lastName: patient.lastName });
    } catch {
      setError("Error inesperado. Intenta de nuevo.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md mx-4 p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-semibold text-gray-900">Crear expediente</h2>
          <button onClick={onClose} className="p-1.5 rounded hover:bg-gray-100">
            <X className="w-4 h-4 text-gray-500" />
          </button>
        </div>

        <p className="text-xs text-gray-500 mb-4">
          Cita de <span className="font-medium text-gray-700">{booking.patientName}</span>. Revisa los datos antes de guardar.
        </p>

        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Nombre *</label>
              <input
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                className="w-full text-sm border border-gray-200 rounded px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-400"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Apellido *</label>
              <input
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                className="w-full text-sm border border-gray-200 rounded px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-400"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Fecha de nacimiento *</label>
              <input
                type="date"
                value={dateOfBirth}
                onChange={(e) => setDateOfBirth(e.target.value)}
                className="w-full text-sm border border-gray-200 rounded px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-400"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Sexo *</label>
              <select
                value={sex}
                onChange={(e) => setSex(e.target.value as typeof sex)}
                className="w-full text-sm border border-gray-200 rounded px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-400"
              >
                <option value="">Seleccionar</option>
                <option value="female">Femenino</option>
                <option value="male">Masculino</option>
                <option value="other">Otro</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Correo</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full text-sm border border-gray-200 rounded px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-400"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Teléfono</label>
            <input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="w-full text-sm border border-gray-200 rounded px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-400"
            />
          </div>

          {error && (
            <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded px-3 py-2">
              {error}
            </p>
          )}

          <div className="flex gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 text-sm px-3 py-2 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex-1 text-sm px-3 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-60 flex items-center justify-center gap-1.5"
            >
              {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              {saving ? "Guardando..." : "Crear y vincular"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
