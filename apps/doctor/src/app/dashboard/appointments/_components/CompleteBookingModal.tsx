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

/**
 * Etiqueta legible de una forma de pago guardada. Las que escribe el webhook de Mercado
 * Pago pasan por `mapMpPaymentMethod` y pueden no estar en `FORMAS_DE_PAGO` (la rejilla
 * que ve el doctor), así que el fallback muestra el valor crudo en vez de nada.
 */
function etiquetaFormaDePago(valor: string | null): string {
  if (!valor) return "No especificada";
  return FORMAS_DE_PAGO.find((f) => f.value === valor)?.label ?? valor;
}

export function CompleteBookingModal({ booking, onClose, onConfirm, onEmitCfdi }: Props) {
  // EL INGRESO YA REGISTRADO manda. Si existe (un link de pago cobrado lo escribió por
  // webhook), el servidor lo detecta por el `bookingId` único y DESCARTA el precio y la
  // forma de pago que mande este modal — completar sólo cierra la cita.
  //
  // Antes esto no se miraba: el modal ofrecía la rejilla de formas de pago con "Efectivo"
  // preseleccionado sobre una cita pagada con tarjeta, mandaba esa respuesta, el servidor
  // la tiraba, y al doctor se le avisaba DESPUÉS por un toast. Pedía un dato garantizado
  // inútil y de paso insinuaba efectivo sobre un pago con tarjeta.
  const ingreso = booking.ingreso ?? null;
  const yaCobrado = ingreso !== null;
  // El proveedor sale del link — es lo que explica de DÓNDE salió el ingreso. El chip
  // verde "Pagado" de la columna Cobro usa exactamente este mismo criterio.
  const linkPagado =
    booking.paymentLink?.status === "PAID"
      ? { proveedor: "Stripe", paidAt: booking.paymentLink.paidAt }
      : booking.mpPaymentPreference?.status === "PAID"
        ? { proveedor: "Mercado Pago", paidAt: booking.mpPaymentPreference.paidAt }
        : null;

  const [price, setPrice] = useState(String(Number(booking.finalPrice)));
  const [formaDePago, setFormaDePago] = useState("efectivo");
  const [submitting, setSubmitting] = useState(false);
  const [emitirFactura, setEmitirFactura] = useState(false);
  const [cfdiStatus, setCfdiStatus] = useState<"idle" | "emitting" | "success" | "error">("idle");
  const [cfdiError, setCfdiError] = useState("");

  const amount = parseFloat(price);

  // Lo que de verdad se manda y se factura. Con el ingreso ya registrado NO se usa lo que
  // haya en el formulario (que ni siquiera se muestra): se reenvían los valores guardados.
  // El servidor los va a descartar de todos modos por idempotencia — pero si la entrada
  // desapareciera entre la carga y el envío, se recrearía con lo REAL en vez de con
  // "efectivo / precio de lista".
  const montoEfectivo = ingreso ? ingreso.amount : amount;
  const formaEfectiva = ingreso ? (ingreso.formaDePago ?? "efectivo") : formaDePago;
  // `NaN > 0` ya es false, así que un `!isNaN` aquí no aportaba nada.
  const isValid = montoEfectivo > 0;

  // El monto cobrado no siempre es el precio de lista de la cita (un link creado por otra
  // cantidad, o editado antes de pagarse). Cuando difieren se DICE, en vez de enseñar
  // `finalPrice` como si fuera lo que entró.
  const montoDifiere = !!ingreso && Number(booking.finalPrice) !== ingreso.amount;

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

  // Esta cita YA tiene factura (la resuelve el servidor contra el ingreso; ver `facturada`
  // en api/appointments/bookings/route.ts). Ofrecer "Emitir factura" aquí produciría un
  // SEGUNDO CFDI de la misma consulta —un timbrado real ante el SAT que después hay que
  // cancelar—, así que la casilla no se ofrece: se dice que ya está.
  const yaFacturada = booking.facturada === true;

  const handleConfirm = async () => {
    if (!isValid) return;
    setSubmitting(true);

    // 1. Complete the booking + create ledger entry
    const { ledgerEntryId } = await onConfirm(montoEfectivo, formaEfectiva);

    // 2. If user wants factura and we have fiscal data, emit CFDI.
    //    `!yaFacturada` también aquí, no sólo al pintar la casilla: si el payload se
    //    refresca con la casilla ya marcada, ésta se desmonta pero `emitirFactura` se
    //    queda en true — y confirmar timbraría el CFDI duplicado que esto evita.
    if (emitirFactura && !yaFacturada && hasFiscalData && onEmitCfdi) {
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
              unitPrice: montoEfectivo,
              subtotal: montoEfectivo,
              total: montoEfectivo,
            },
          ],
          // La factura tiene que declarar la forma de pago REAL, no la que preseleccione
          // la rejilla: un CFDI que dice "efectivo" sobre un cobro con tarjeta es un dato
          // falso ante el SAT.
          paymentForm: FORMA_TO_SAT[formaEfectiva] || "03",
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

          {/* REGISTRO DE PAGO — el ingreso ya existe, así que no se pide nada: se enseña.
              Sustituye al campo de monto Y a la rejilla de formas de pago, porque los dos
              serían casillas que el servidor ignora. */}
          {ingreso ? (
            <div className="rounded-lg border-2 border-green-200 bg-green-50 p-3 space-y-2">
              <div className="flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-green-600 shrink-0" />
                <span className="text-sm font-medium text-green-900">
                  {linkPagado ? `Pagado con ${linkPagado.proveedor}` : "Pago ya registrado"}
                </span>
              </div>
              <dl className="text-xs text-green-900 space-y-1 ml-6">
                <div className="flex justify-between gap-3">
                  <dt className="text-green-700">Monto recibido</dt>
                  <dd className="font-semibold">${ingreso.amount.toLocaleString()}</dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-green-700">Forma de pago</dt>
                  <dd className="font-semibold">{etiquetaFormaDePago(ingreso.formaDePago)}</dd>
                </div>
                {linkPagado?.paidAt && (
                  <div className="flex justify-between gap-3">
                    <dt className="text-green-700">Fecha del pago</dt>
                    <dd className="font-semibold">
                      {new Date(linkPagado.paidAt).toLocaleString("es-MX", {
                        day: "numeric", month: "short", hour: "2-digit", minute: "2-digit",
                      })}
                    </dd>
                  </div>
                )}
              </dl>
              {/* Un monto distinto al precio de lista NO es un error — el link pudo crearse
                  por otra cantidad. Pero callarlo dejaría al doctor creyendo que cobró
                  `finalPrice`. */}
              {montoDifiere && (
                <p className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded px-2 py-1.5 ml-6">
                  El precio de la cita dice ${Number(booking.finalPrice).toLocaleString()}, pero lo
                  que entró fueron ${ingreso.amount.toLocaleString()}. Se registró lo que entró.
                </p>
              )}
              <p className="text-xs text-green-700 ml-6">
                Ya está en Flujo de Dinero. Completar la cita no vuelve a cobrarla ni lo duplica.
              </p>
            </div>
          ) : (
          <>
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
          </>
          )}

          {/* Ya facturada — se informa en vez de ofrecer timbrar otra vez. */}
          {yaFacturada && (
            <div className="flex items-center gap-2 text-xs text-teal-800 bg-teal-50 border border-teal-200 rounded-lg px-3 py-2">
              <FileText className="w-4 h-4 shrink-0 text-teal-600" />
              Esta cita ya tiene factura. Completarla no emite otra.
            </div>
          )}

          {/* Factura toggle — only if patient has fiscal data AND it isn't invoiced yet */}
          {!yaFacturada && hasFiscalData && onEmitCfdi && (
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

          {/* Con el ingreso ya registrado esta frase era FALSA: no se registra nada nuevo.
              Lo dice el bloque verde de arriba, así que aquí no se repite. */}
          {!yaCobrado && (
            <p className="text-xs text-gray-400">
              Se registrará un ingreso en Flujo de Dinero automáticamente.
            </p>
          )}

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
