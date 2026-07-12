"use client";

import { useState } from "react";
import { X, CheckCircle, Loader2, Banknote, CreditCard, FileText, Building2, Receipt } from "lucide-react";
import type { Booking } from "../_hooks/useBookings";

interface Props {
  booking: Booking;
  onClose: () => void;
  onConfirm: (price: number, formaDePago: string) => Promise<{ ledgerEntryId?: number }>;
  onEmitCfdi?: (params: CfdiParams) => Promise<{ success: boolean; error?: string }>;
}

export interface CfdiParams {
  bookingId: string;
  receiver: {
    rfc: string;
    name: string;
    cfdiUse: string;
    fiscalRegime: string;
    taxZipCode: string;
  };
  items: Array<{
    productCode: string;
    description: string;
    quantity: number;
    unitCode: string;
    unitPrice: number;
    subtotal: number;
    total: number;
  }>;
  paymentForm: string;
  paymentMethod: string;
  ledgerEntryId?: number;
}

// Map appointment formaDePago to SAT payment form code
const FORMA_TO_SAT: Record<string, string> = {
  efectivo: "01",
  cheque: "02",
  transferencia: "03",
  tarjeta: "04",
  deposito: "03",
};

const FORMAS_DE_PAGO = [
  { value: "efectivo", label: "Efectivo", icon: Banknote, activeColor: "border-green-500 bg-green-50 text-green-800" },
  { value: "transferencia", label: "Transferencia", icon: Building2, activeColor: "border-blue-500 bg-blue-50 text-blue-800" },
  { value: "tarjeta", label: "Tarjeta", icon: CreditCard, activeColor: "border-purple-500 bg-purple-50 text-purple-800" },
  { value: "cheque", label: "Cheque", icon: Receipt, activeColor: "border-amber-500 bg-amber-50 text-amber-800" },
  { value: "deposito", label: "Depósito", icon: Building2, activeColor: "border-teal-500 bg-teal-50 text-teal-800" },
] as const;

export function CompleteBookingModal({ booking, onClose, onConfirm, onEmitCfdi }: Props) {
  const [price, setPrice] = useState(String(Number(booking.finalPrice)));
  const [formaDePago, setFormaDePago] = useState("efectivo");
  const [submitting, setSubmitting] = useState(false);
  const [emitirFactura, setEmitirFactura] = useState(false);
  const [cfdiStatus, setCfdiStatus] = useState<"idle" | "emitting" | "success" | "error">("idle");
  const [cfdiError, setCfdiError] = useState("");

  const amount = parseFloat(price);
  const isValid = !isNaN(amount) && amount > 0;

  // Check if patient has complete fiscal data
  const patient = booking.patient;
  const hasFiscalData = !!(
    patient?.requiereFactura &&
    patient?.rfc &&
    patient?.razonSocial &&
    patient?.regimenFiscal &&
    patient?.usoCfdi &&
    patient?.codigoPostalFiscal
  );

  const handleConfirm = async () => {
    if (!isValid) return;
    setSubmitting(true);

    // 1. Complete the booking + create ledger entry
    const { ledgerEntryId } = await onConfirm(amount, formaDePago);

    // 2. If user wants factura and we have fiscal data, emit CFDI
    if (emitirFactura && hasFiscalData && onEmitCfdi) {
      setCfdiStatus("emitting");
      try {
        const result = await onEmitCfdi({
          bookingId: booking.id,
          receiver: {
            rfc: patient!.rfc!,
            name: patient!.razonSocial!,
            cfdiUse: patient!.usoCfdi!,
            fiscalRegime: patient!.regimenFiscal!,
            taxZipCode: patient!.codigoPostalFiscal!,
          },
          items: [
            {
              productCode: "85121800", // Servicios de consultoría en salud
              description: booking.serviceName || "Consulta médica",
              quantity: 1,
              unitCode: "E48", // Unidad de servicio
              unitPrice: amount,
              subtotal: amount,
              total: amount,
            },
          ],
          paymentForm: FORMA_TO_SAT[formaDePago] || "03",
          paymentMethod: "PUE",
          ledgerEntryId,
        });

        if (result.success) {
          setCfdiStatus("success");
        } else {
          setCfdiStatus("error");
          setCfdiError(result.error || "Error al emitir factura");
        }
      } catch {
        setCfdiStatus("error");
        setCfdiError("Error de conexión al emitir factura");
      }
      setSubmitting(false);
      return; // Don't close — show CFDI result first
    }

    setSubmitting(false);
    onClose(); // No factura: close immediately
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && isValid) handleConfirm();
    if (e.key === "Escape") onClose();
  };

  // After CFDI status shown, allow closing
  const showResult = cfdiStatus === "success" || cfdiStatus === "error";

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
            <div className="grid grid-cols-3 gap-2">
              {FORMAS_DE_PAGO.map((fp) => {
                const Icon = fp.icon;
                const isActive = formaDePago === fp.value;
                return (
                  <button
                    key={fp.value}
                    type="button"
                    onClick={() => setFormaDePago(fp.value)}
                    className={`flex flex-col items-center justify-center gap-1 py-2 px-1 border-2 rounded-lg text-xs font-medium transition-all ${
                      isActive
                        ? fp.activeColor
                        : "border-gray-200 text-gray-600 hover:border-gray-300"
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    {fp.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Factura toggle — only if patient has fiscal data */}
          {hasFiscalData && onEmitCfdi && (
            <div
              className={`border-2 rounded-lg p-3 cursor-pointer transition-all ${
                emitirFactura
                  ? "border-teal-500 bg-teal-50"
                  : "border-gray-200 hover:border-gray-300"
              }`}
              onClick={() => setEmitirFactura((v) => !v)}
            >
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={emitirFactura}
                  onChange={(e) => setEmitirFactura(e.target.checked)}
                  className="w-4 h-4 text-teal-600 rounded"
                />
                <FileText className="w-4 h-4 text-teal-600" />
                <span className="text-sm font-medium text-gray-800">Emitir factura (CFDI)</span>
              </label>
              {emitirFactura && (
                <div className="mt-2 ml-6 text-xs text-gray-500 space-y-0.5">
                  <p>RFC: <span className="font-medium text-gray-700">{patient!.rfc}</span></p>
                  <p>Razón social: <span className="font-medium text-gray-700">{patient!.razonSocial}</span></p>
                  <p>Uso CFDI: <span className="font-medium text-gray-700">{patient!.usoCfdi}</span></p>
                </div>
              )}
            </div>
          )}

          {/* CFDI status messages */}
          {cfdiStatus === "emitting" && (
            <div className="flex items-center gap-2 text-sm text-teal-700 bg-teal-50 rounded-lg px-3 py-2">
              <Loader2 className="w-4 h-4 animate-spin" /> Emitiendo factura...
            </div>
          )}
          {cfdiStatus === "success" && (
            <div className="flex items-center gap-2 text-sm text-green-700 bg-green-50 rounded-lg px-3 py-2">
              <CheckCircle className="w-4 h-4" /> Factura emitida exitosamente
            </div>
          )}
          {cfdiStatus === "error" && (
            <div className="text-sm text-red-700 bg-red-50 rounded-lg px-3 py-2">
              <p className="font-medium">Error al emitir factura</p>
              <p className="text-xs mt-0.5">{cfdiError}</p>
              <p className="text-xs mt-1 text-gray-500">Puedes emitir la factura manualmente desde Facturación.</p>
            </div>
          )}

          <p className="text-xs text-gray-400">
            Se registrará un ingreso en Flujo de Dinero automáticamente.
          </p>

          {/* Actions */}
          <div className="flex gap-2 pt-1">
            <button
              onClick={onClose}
              disabled={submitting || cfdiStatus === "emitting"}
              className="flex-1 py-2.5 border border-gray-200 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors disabled:opacity-50"
            >
              {showResult ? "Cerrar" : "Cancelar"}
            </button>
            {!showResult && (
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
                {submitting ? "Guardando..." : emitirFactura ? "Completar + Facturar" : "Completar"}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
