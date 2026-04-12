"use client";

import { useState } from "react";
import { X, CheckCircle, Loader2, Banknote, CreditCard } from "lucide-react";
import type { Booking } from "../_hooks/useBookings";

interface Props {
  booking: Booking;
  onClose: () => void;
  onConfirm: (price: number, formaDePago: "efectivo" | "transferencia") => Promise<void>;
}

export function CompleteBookingModal({ booking, onClose, onConfirm }: Props) {
  const [price, setPrice] = useState(String(Number(booking.finalPrice)));
  const [formaDePago, setFormaDePago] = useState<"efectivo" | "transferencia">("efectivo");
  const [submitting, setSubmitting] = useState(false);

  const amount = parseFloat(price);
  const isValid = !isNaN(amount) && amount > 0;

  const handleConfirm = async () => {
    if (!isValid) return;
    setSubmitting(true);
    await onConfirm(amount, formaDePago);
    setSubmitting(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && isValid) handleConfirm();
    if (e.key === "Escape") onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-xl shadow-lg w-full max-w-sm">
        {/* Header */}
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
          <h2 className="text-base font-semibold text-gray-900 flex items-center gap-2">
            <CheckCircle className="w-4 h-4 text-green-500" />
            Completar cita
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 p-1 rounded transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {/* Patient + service */}
          <p className="text-sm text-gray-700">
            <span className="font-medium text-gray-900">{booking.patientName}</span>
            {booking.serviceName && (
              <span className="text-gray-500"> · {booking.serviceName}</span>
            )}
          </p>

          {/* Price */}
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1.5">
              Monto cobrado (MXN)
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 font-medium text-sm">
                $
              </span>
              <input
                type="number"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                onKeyDown={handleKeyDown}
                step="0.01"
                min="0"
                autoFocus
                className="w-full pl-7 pr-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent text-sm"
              />
            </div>
          </div>

          {/* Forma de pago */}
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1.5">
              Forma de pago
            </label>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setFormaDePago("efectivo")}
                className={`flex-1 flex items-center justify-center gap-2 py-2.5 border-2 rounded-lg text-sm font-medium transition-all ${
                  formaDePago === "efectivo"
                    ? "border-green-500 bg-green-50 text-green-800"
                    : "border-gray-200 text-gray-600 hover:border-gray-300"
                }`}
              >
                <Banknote className="w-4 h-4" />
                Efectivo
              </button>
              <button
                type="button"
                onClick={() => setFormaDePago("transferencia")}
                className={`flex-1 flex items-center justify-center gap-2 py-2.5 border-2 rounded-lg text-sm font-medium transition-all ${
                  formaDePago === "transferencia"
                    ? "border-blue-500 bg-blue-50 text-blue-800"
                    : "border-gray-200 text-gray-600 hover:border-gray-300"
                }`}
              >
                <CreditCard className="w-4 h-4" />
                Banco
              </button>
            </div>
          </div>

          <p className="text-xs text-gray-400">
            Se registrará un ingreso en Flujo de Dinero automáticamente.
          </p>

          {/* Actions */}
          <div className="flex gap-2 pt-1">
            <button
              onClick={onClose}
              disabled={submitting}
              className="flex-1 py-2.5 border border-gray-200 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors disabled:opacity-50"
            >
              Cancelar
            </button>
            <button
              onClick={handleConfirm}
              disabled={submitting || !isValid}
              className="flex-1 py-2.5 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {submitting ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <CheckCircle className="w-4 h-4" />
              )}
              {submitting ? "Guardando..." : "Completar"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
