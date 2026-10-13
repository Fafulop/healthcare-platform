"use client";

/**
 * Controles de UNA cita, compartidos por las tres superficies que la muestran:
 * la tarjeta móvil y la fila desplegada de `BookingsSection`, y `BookingDetailModal`
 * (el que abre al hacer clic en un bloque del calendario).
 *
 * Vivían dentro de `BookingsSection.tsx` como funciones locales. Se movieron aquí SIN
 * cambiarles nada cuando el modal del calendario necesitó los mismos controles: la
 * alternativa —reimplementar las acciones en el modal— es exactamente la clase de lógica
 * replicada que produce deriva entre superficies (la tabla diría una cosa y el calendario
 * otra en cuanto alguien tocara una sola).
 */

import { useState, useEffect } from "react";
import { usePermissions } from "@/lib/permissions-client";
import Link from "next/link";
import {
  Loader2, Pencil, Clock, UserSquare2, X, Send,
  Video, ExternalLink, MessageCircle,
} from "lucide-react";
import { InlinePatientSearch } from "./InlinePatientSearch";
import { CreatePatientFromBookingModal } from "./CreatePatientFromBookingModal";
import { FormularioStatusButton } from "./FormularioStatusButton";
import { FiscalFormButton } from "./FiscalFormButton";
import { PaymentLinkButton } from "@/components/payments/PaymentLinkButton";
import { CompleteBookingModal } from "@/components/citas/CompleteBookingModal";
import { formatLocalDate } from "@/lib/dates";
import { waNumber } from "@/lib/whatsapp";
import { resolverContacto, telefonoWhatsApp } from "@/lib/booking-contact";
import type { Booking } from "../_hooks/useBookings";
import { NotaCitaButton } from "@/components/citas/NotaCitaButton";
import { FacturaDeLaCita } from "@/components/citas/FacturaDeLaCita";
import { BotonesEstadoCita, citaReagendable } from "@/components/citas/BotonesEstadoCita";
import { BotonCita, COLUMNA, FilaCita, Hueco, SeccionCita } from "@/components/citas/fila-cita";
import { faltaCorreo, faltaWhatsapp } from "@/components/citas/enviar-enlace";

/**
 * Envuelve los controles que viven en la fila COLAPSADA (precio, expediente) para
 * que su clic no burbujee al toggle de la fila. Sin esto, editar un precio o buscar
 * un paciente abriría/cerraría la cita al mismo tiempo.
 */
export function StopClick({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={className} onClick={(e) => e.stopPropagation()}>
      {children}
    </div>
  );
}

/**
 * Casilla "¿Necesita factura?" — intención POR CITA (`bookings.factura_solicitada`).
 * Desmarcada (null o false) = todo se comporta como siempre. Marcada = abre el grupo
 * **Factura** (debajo de Cobro) para pedirle los datos fiscales al paciente.
 * Vive en el RESUMEN (fila colapsada) para poder marcarla sin abrir la cita, así que va
 * envuelta en StopClick: sin eso, marcarla también abriría/cerraría la fila.
 */
export function FacturaCheckbox({
  booking,
  onChange,
}: {
  booking: Booking;
  onChange: (id: string, value: boolean) => void;
}) {
  const checked = !!booking.facturaSolicitada;
  return (
    <StopClick className="inline-flex">
      <label
        className={`flex items-center gap-1.5 text-xs px-2 py-1 rounded border cursor-pointer transition-colors whitespace-nowrap ${
          checked
            ? "bg-teal-50 text-teal-700 border-teal-200 hover:bg-teal-100"
            : "bg-white text-gray-500 border-gray-200 hover:bg-gray-50"
        }`}
        title="Al marcarla aparecen las filas «Datos fiscales» y «Factura» (en Cobro y factura)"
      >
        <input
          type="checkbox"
          checked={checked}
          onChange={(e) => onChange(booking.id, e.target.checked)}
          className="w-3.5 h-3.5 accent-teal-600 cursor-pointer"
        />
        ¿Necesita factura?
      </label>
    </StopClick>
  );
}

/** T6, sólo historia: su cobro quedó en $0 y es la sesión de un tratamiento (no nacen así desde V2). */
const cubiertaPorPaqueteViejo = (b: Booking) => b.ingreso?.amount === 0 && !!b.tratamientoSesion;

export function PriceCell({
  booking,
  onUpdatePrice,
}: {
  booking: Booking;
  onUpdatePrice: (id: string, price: number) => Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(String(Number(booking.finalPrice)));
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!editing) setValue(String(Number(booking.finalPrice)));
  }, [booking.finalPrice, editing]);

  const handleSave = async () => {
    const price = parseFloat(value);
    if (isNaN(price) || price < 0) { setEditing(false); return; }
    setSaving(true);
    await onUpdatePrice(booking.id, price);
    setSaving(false);
    setEditing(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") handleSave();
    if (e.key === "Escape") { setEditing(false); setValue(String(Number(booking.finalPrice))); }
  };

  // Historia (T6): una sesión que quedó «cubierta por el paquete» antes de V2 se cobró en $0 —
  // mostrar su precio de lista haría creer que se cobró. Ya no nacen así (no hay paquetes).
  if (cubiertaPorPaqueteViejo(booking)) {
    return (
      <span
        title="Se registró en $0 «cubierta por el paquete» (antes de que se quitaran los paquetes)"
        className="text-[11px] px-1.5 py-0.5 rounded bg-teal-100 text-teal-800 whitespace-nowrap"
      >
        Paquete
      </span>
    );
  }

  if (editing) {
    return (
      <div className="flex items-center gap-1">
        <span className="text-gray-500 text-xs">$</span>
        <input
          type="number"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={handleSave}
          autoFocus
          step="0.01"
          min="0"
          className="w-20 px-1.5 py-0.5 border border-blue-300 rounded text-xs focus:outline-none focus:ring-1 focus:ring-blue-400"
        />
        {saving && <Loader2 className="w-3 h-3 animate-spin text-gray-400" />}
      </div>
    );
  }

  return (
    <button
      onClick={() => setEditing(true)}
      title="Click para editar precio"
      className="group flex items-center gap-1 text-sm text-gray-700 hover:text-blue-600 transition-colors"
    >
      ${Number(booking.finalPrice).toLocaleString()}
      <Pencil className="w-3 h-3 opacity-0 group-hover:opacity-50 transition-opacity" />
    </button>
  );
}

function minsToTime(totalMins: number): string {
  const h = Math.floor(totalMins / 60);
  const m = totalMins % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

function timeToMins(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
}

/**
 * «Bloqueo: 10:00–10:45 · Editar» (cuánto tiempo aparta la cita en la agenda). OCULTO por ahora (decisión
 * del usuario 2026-10-12): sirve sobre todo con el portal público de citas, que no se usa todavía. El
 * código se queda; para volver a enseñarlo en las tres pantallas basta con poner esto en `true`.
 * (Al ocultarlo había 2 citas vivas con bloqueo a la medida, las dos ya pasadas: ninguna futura aparta
 * tiempo de más sin que se vea.)
 */
export const MOSTRAR_BLOQUEO = false;

export function ExtendedBlockControl({
  booking,
  onUpdate,
}: {
  booking: Booking;
  onUpdate: (id: string, extendedBlockMinutes: number | null) => Promise<void>;
}) {
  // Hooks must run before the "no start time" bail-out below. A component that
  // returns null on one render and calls hooks on the next throws "Rendered more
  // hooks than during the previous render", and with no error.tsx anywhere in this
  // app that blanks the whole page, not one row.
  // Today it cannot fire: this only renders for CONFIRMED bookings, and the 21
  // prod rows with slot_id + start_time both null are all terminal
  // (CANCELLED/NO_SHOW/COMPLETED). But those 21 prove nothing enforces
  // "freeform => start_time is set", so the guard stays and the hooks stay above it.
  const rawStartTime = booking.slot?.startTime ?? booking.startTime ?? null;
  const slotDuration = booking.slot?.duration ?? booking.duration ?? 60;
  const startMin = rawStartTime ? timeToMins(rawStartTime) : 0;
  const currentBlockMins = booking.extendedBlockMinutes ?? slotDuration;
  const blockEndTime = minsToTime(startMin + currentBlockMins);

  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(blockEndTime);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setValue(minsToTime(startMin + (booking.extendedBlockMinutes ?? slotDuration)));
  }, [booking.extendedBlockMinutes, startMin, slotDuration]);

  const handleSave = async () => {
    const endMin = timeToMins(value);
    // NaN guard: an emptied <input type="time"> yields NaN, and `NaN <= startMin`
    // is false — it would slip through and PATCH extendedBlockMinutes as null,
    // silently wiping the doctor's custom block instead of rejecting the input.
    if (!Number.isFinite(endMin) || endMin <= startMin) return;
    setSaving(true);
    await onUpdate(booking.id, endMin - startMin);
    setSaving(false);
    setEditing(false);
  };

  // Bail-out moved below the hooks — see the note above. (También el interruptor `MOSTRAR_BLOQUEO`.)
  if (!MOSTRAR_BLOQUEO || !rawStartTime) return null;
  const startTime = rawStartTime;

  const isCustom = booking.extendedBlockMinutes != null && booking.extendedBlockMinutes !== slotDuration;

  // Mismo criterio que handleSave, pero expuesto en el botón: rechazar en silencio
  // se lee como "la app no me deja hacer clic" (pasó en la prueba en vivo). El guard
  // de handleSave se queda igual — esto es la versión visible, no el reemplazo.
  const draftEndMin = timeToMins(value);
  const isDraftValid = Number.isFinite(draftEndMin) && draftEndMin > startMin;

  return (
    <div className="flex items-center gap-1 mt-1.5 w-full flex-wrap">
      <Clock className="w-3 h-3 text-indigo-400 shrink-0" />
      {editing ? (
        <>
          <span className="text-xs text-gray-500">Bloquear hasta:</span>
          <input
            type="time"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            className="text-xs border border-gray-300 rounded px-1.5 py-0.5 focus:outline-none focus:ring-1 focus:ring-blue-400"
          />
          {/* El title va en el wrapper, no en el <button>: un control deshabilitado
              no dispara eventos de mouse en Chrome/Safari, así que su tooltip nativo
              nunca aparecería — justo la explicación que hace falta. */}
          <span
            className="inline-flex"
            title={!isDraftValid ? `La hora de fin debe ser posterior a ${startTime}` : undefined}
          >
            <button
              onClick={handleSave}
              disabled={saving || !isDraftValid}
              className="text-xs px-1.5 py-0.5 rounded bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {saving ? "..." : "OK"}
            </button>
          </span>
          <button
            onClick={() => { setEditing(false); setValue(blockEndTime); }}
            className="text-xs px-1.5 py-0.5 rounded bg-gray-100 text-gray-600 hover:bg-gray-200"
          >
            ✕
          </button>
        </>
      ) : (
        <>
          <span className="text-xs text-gray-400">Bloqueo:</span>
          <span className={`text-xs font-medium ${isCustom ? "text-indigo-600" : "text-gray-500"}`}>
            {startTime}–{blockEndTime}
          </span>
          <button
            onClick={() => setEditing(true)}
            className="text-xs px-1.5 py-0.5 rounded text-indigo-600 hover:bg-indigo-50 border border-indigo-200"
          >
            Editar
          </button>
        </>
      )}
    </div>
  );
}

export function ExpedienteCell({
  booking,
  onUpdatePatientLink,
}: {
  booking: Booking;
  onUpdatePatientLink: (bookingId: string, patientId: string | null, patient: { id: string; firstName: string; lastName: string } | null) => void;
}) {
  const [showCreateModal, setShowCreateModal] = useState(false);
  // Escape del caso "Primera vez mal marcada" — ver la nota más abajo.
  const [buscarAbierto, setBuscarAbierto] = useState(false);

  if (booking.patientId && booking.patient) {
    const hasSubmittedForm = booking.formLink?.status === 'SUBMITTED';
    return (
      <div className="flex items-center gap-1">
        <Link
          href={`/dashboard/medical-records/patients/${booking.patientId}`}
          className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 hover:underline"
        >
          <UserSquare2 className="w-3 h-3 shrink-0" />
          {booking.patient.firstName} {booking.patient.lastName}
        </Link>
        <button
          title={hasSubmittedForm ? "Desvincular el formulario recibido primero" : "Desvincular expediente"}
          onClick={() => !hasSubmittedForm && onUpdatePatientLink(booking.id, null, null)}
          disabled={hasSubmittedForm}
          className={`p-0.5 rounded ${hasSubmittedForm ? 'text-gray-300 cursor-not-allowed' : 'text-gray-400 hover:text-red-500 hover:bg-red-50'}`}
        >
          <X className="w-3 h-3" />
        </button>
      </div>
    );
  }

  // Sin expediente vinculado.
  //
  // PRIMERA VEZ ⇒ solo se ofrece CREAR. Un paciente nuevo debe nacer con su propio expediente:
  // si se le cuelga uno que ya existía, el correo de la cita y el del expediente pueden diferir
  // desde el minuto uno, y como la cita gana en todos lados (fila, confirmación, link de pago,
  // formulario) todo se iría al correo equivocado. Creándolo desde la cita nacen iguales.
  //
  // ⚠️ Pero `isFirstTime` NO se puede corregir después (el PATCH de la cita no lo acepta), así
  // que esconder la búsqueda A SECAS dejaría atrapado al doctor que marcó "Primera vez" a un
  // paciente que sí tenía expediente: su única salida sería crear un DUPLICADO, justo lo que
  // esta regla evita. Por eso la búsqueda no desaparece, se repliega detrás de un enlace.
  //
  // `isFirstTime === false` (recurrente) y `null` (citas del agente, 22 en prod) conservan las
  // dos opciones: el null llegó a rendir un "—" muerto sin forma de vincular ni crear.
  const esPrimeraVez = booking.isFirstTime === true;
  const searchEl = (
    <InlinePatientSearch
      onSelect={(patient) => onUpdatePatientLink(booking.id, patient.id, patient)}
    />
  );
  const createEl = (
    <button
      onClick={() => setShowCreateModal(true)}
      className="text-xs px-2 py-1 rounded bg-green-50 text-green-700 border border-green-200 hover:bg-green-100 whitespace-nowrap"
    >
      + Crear expediente
    </button>
  );

  // Un solo return y UNA sola instancia del modal: tenerlo en dos ramas ya empezó a duplicarse
  // y bastaba con que alguien tocara una para que las dos dejaran de coincidir.
  const opciones = esPrimeraVez ? (
    <>
      {createEl}
      {buscarAbierto ? (
        searchEl
      ) : (
        <button
          onClick={() => setBuscarAbierto(true)}
          className="text-[11px] text-gray-400 hover:text-gray-600 hover:underline whitespace-nowrap"
          title="Esta cita se marcó como Primera vez. Si el paciente ya tenía expediente, búscalo aquí en vez de crear uno duplicado."
        >
          ¿Ya tiene expediente?
        </button>
      )}
    </>
  ) : (
    // Recurrente pone la búsqueda primero; el agente (isFirstTime null) conserva las dos.
    <>
      {booking.isFirstTime === false ? searchEl : createEl}
      {booking.isFirstTime === false ? createEl : searchEl}
    </>
  );

  return (
    <div className="flex flex-col items-start gap-1">
      {opciones}
      {showCreateModal && (
        <CreatePatientFromBookingModal
          booking={booking}
          onClose={() => setShowCreateModal(false)}
          onLinked={(patient) => {
            onUpdatePatientLink(booking.id, patient.id, patient);
            setShowCreateModal(false);
          }}
        />
      )}
    </div>
  );
}

export function StatusActions({
  booking,
  onUpdateStatus,
  onDeleteBooking,
  onOpenFormLinkModal,
  onDeleteFormLink,
  onSendEmail,
  onReschedule,
  onCompleteBooking,
  layout = "card",
  sinEstado = false,
  sinCobro = false,
  sinFactura = false,
  soloCobro = false,
  onUpdatePrice,
  onUpdateFacturaSolicitada,
  borrar = "cita",
}: {
  booking: Booking;
  /** El botón de borrar (sólo en citas terminadas y SIN dinero): «Borrar cita» (la agenda, la sesión),
   *  «Borrar cita y visita» (la visita, cuando sabe que está vacía) o ninguno (la visita con contenido:
   *  el servidor la rechazaría). 2026-10-12. */
  borrar?: "cita" | "cita-y-visita" | "no";
  /** Con estos dos, el grupo «Cobro y factura» trae también el PRECIO y «¿Necesita factura?» (la visita,
   *  «Cobros», el modal del calendario). La tabla no los pasa: los enseña en su columna PRECIO. */
  onUpdatePrice?: (id: string, price: number) => Promise<void>;
  onUpdateFacturaSolicitada?: (id: string, value: boolean) => void;
  /** Sin el grupo «Estado». Hoy nadie lo pasa (la tarjeta de la sesión del tratamiento ya no trae la cita). */
  sinEstado?: boolean;
  /** 10-PLAN P1: fuera de la agenda se respetan los permisos del expediente: sin `flujo` no hay Cobro… */
  sinCobro?: boolean;
  /** …y sin `facturacion` no hay Factura. */
  sinFactura?: boolean;
  /** «Cobros» del expediente: sólo lo de dinero — Cobro, Factura y, de Estado, sólo «Completar» (completar y
   *  cobrar); sin el resto de Estado, Confirmación, Documentos ni Eliminar. */
  soloCobro?: boolean;
  /**
   * "table" renders TWO <td> cells (gestión · comunicación/cobro) — ya no se usa en
   * la tabla, que ahora despliega las acciones en su propia fila con "expanded";
   * se conserva porque el contrato de dos <td> sigue siendo válido.
   * "expanded" = los 6 grupos en rejilla. "card" = apilados (móvil y el modal del calendario).
   */
  layout?: "card" | "table" | "expanded";
  onUpdateStatus: (id: string, status: string) => void;
  onDeleteBooking: (id: string, patientName: string) => void;
  onOpenFormLinkModal: (booking: Booking) => void;
  onDeleteFormLink: (bookingId: string) => void;
  onSendEmail: (id: string) => Promise<void>;
  onReschedule: (booking: Booking) => void;
  onCompleteBooking: (id: string, price: number, formaDePago: string) => Promise<{ ledgerEntryId?: number }>;
}) {
  const [isSendingEmail, setIsSendingEmail] = useState(false);
  const [completeModalOpen, setCompleteModalOpen] = useState(false);
  const { can: puedeEnviar } = usePermissions();
  const isTerminal = ["CANCELLED", "COMPLETED", "NO_SHOW"].includes(booking.status);

  const bookingDate = (booking.slot?.date ?? booking.date ?? "").split("T")[0];
  const endTime = booking.slot?.endTime ?? booking.endTime;
  // La regla vive con los botones (09-PLAN L2): la visita y la sesión la usan igual.
  const canReschedule = citaReagendable(booking.status, bookingDate, endTime);

  const handleSendEmail = async () => {
    setIsSendingEmail(true);
    await onSendEmail(booking.id);
    setIsSendingEmail(false);
  };

  // COMPLETADA significa "el doctor ya vio al paciente", no "el asunto se cerró": el dinero y
  // el papeleo siguen abiertos. Por eso Cobro y Documentos sobreviven a completar, y Estado /
  // Comunicación / Horario no (estado terminal sin vuelta atrás, no hay confirmación que
  // reenviar, no hay agenda futura que bloquear). Desde 2026-10-12 «no» = sus botones GRISES en su
  // lugar (con el porqué), no un grupo que desaparece y recorre a los demás.
  //
  // Además el prompt del agente YA daba esto por hecho en dos sitios, y no era cierto:
  //   · facturas.ts get_payment_links → "el flujo recomendado es crearlos desde la cita
  //     (botón Cobro)" — el botón desaparecía justo al completar.
  //   · agenda.ts AGENDA_CITAS_RULES → "la factura se emite desde la tabla de citas" — para eso
  //     hace falta el botón de Datos fiscales, que vivía en Documentos y también desaparecía.
  // Misma familia que bitácora #26/#27 (prosa que enruta a algo inalcanzable) pero en el eje de
  // ESTADO, que `gate:prosa` no mira: ese gate razona por scope, no por estado de la cita.
  const isCompleted = booking.status === "COMPLETED";
  const showCommsGroup = booking.status === "CONFIRMED";

  // El formulario y la factura deciden su propio «no aplica» en su fila (FormularioStatusButton, y
  // `motivoFactura` abajo): ya no hay grupos que se escondan.
  // Cobro: citas activas y COMPLETADAS siempre; canceladas/no-asistió solo con link PAGADO o
  // ACTIVO (un link viejo desactivado y no pagado NO debe reabrir el botón de crear sobre una
  // cita que nunca ocurrió). Ese guard se conserva tal cual para esos dos estados.
  const hasRelevantPaymentLink =
    booking.paymentLink?.status === "PAID" ||
    booking.mpPaymentPreference?.status === "PAID" ||
    booking.paymentLink?.isActive ||
    booking.mpPaymentPreference?.isActive;
  const showCobroGroup = !isTerminal || isCompleted || !!hasRelevantPaymentLink;

  const modal = completeModalOpen && (
    <CompleteBookingModal
      booking={booking}
      onClose={() => setCompleteModalOpen(false)}
      onConfirm={async (price, formaDePago) => {
        const result = await onCompleteBooking(booking.id, price, formaDePago);
        return result || {};
      }}
    />
  );

  // 2026-10-12 (pedido del usuario: «formas, tamaños y nombres distintos, todo por todos lados») — la tarjeta
  // en TRES secciones con UNA forma de botón y UNA forma de fila (components/citas/fila-cita):
  //   ESTADO           · los botones de estado;
  //   COBRO Y FACTURA  · Link de pago · Nota de venta · (con «Necesita factura») Datos fiscales · Factura;
  //   PARA EL PACIENTE · Confirmación · Formulario.
  // Cada fila: nombre · estado en palabras · Correo · WhatsApp · Ver/Copiar · extra. Nada desaparece al
  // cambiar de estado: lo que no aplica queda GRIS en su lugar con el porqué. Las REGLAS (qué se puede en
  // cada estado, con qué permiso) son las de antes: sólo cambió cómo se ve.
  const estadoGroup = !sinEstado && (
    <SeccionCita titulo="Estado">
      {/* 09-PLAN L2: los MISMOS botones que la visita y «Cobros». */}
      <BotonesEstadoCita
        status={booking.status}
        puedeReagendar={canReschedule}
        onConfirmar={() => onUpdateStatus(booking.id, "CONFIRMED")}
        onCompletar={() => setCompleteModalOpen(true)}
        onNoAsistio={() => onUpdateStatus(booking.id, "NO_SHOW")}
        onCancelar={() => onUpdateStatus(booking.id, "CANCELLED")}
        onReagendar={() => onReschedule(booking)}
        soloCompletar={soloCobro}
      />
    </SeccionCita>
  );

  // El EXPEDIENTE manda y la copia de la cita es el respaldo — el MISMO orden que resuelve el servidor
  // (`resolverContacto`, decisión #30). WhatsApp antepone su propio campo (el número que el paciente dio
  // PARA WhatsApp) y cae al teléfono resuelto.
  const contactoEnvio = {
    email: resolverContacto(booking).email,
    wa: waNumber(telefonoWhatsApp(booking)),
    expediente: booking.patientId ? `/dashboard/medical-records/patients/${booking.patientId}` : null,
  };

  // Por qué la cita misma ya no admite algo (cancelada / no asistió), en largo y en corto.
  const motivoCita = booking.status === "CANCELLED" ? "La cita está cancelada"
    : booking.status === "NO_SHOW" ? "El paciente no asistió" : null;
  const motivoCitaCorto = booking.status === "CANCELLED" ? "Cita cancelada" : booking.status === "NO_SHOW" ? "No asistió" : null;

  // ── COBRO Y FACTURA ──────────────────────────────────────────────────────────────────────────────
  // Precio y «¿Necesita factura?» arriba a la derecha (la visita, «Cobros», el calendario; la tabla los
  // enseña en su columna PRECIO). Mandar el link / pedir datos fiscales usan rutas de Pagos / Facturación:
  // sin ese permiso sus botones quedan grises (antes no se ofrecían: el servidor contestaba 403).
  const conPrecio = !!onUpdatePrice && !sinCobro;
  const conCasilla = !!onUpdateFacturaSolicitada && !sinFactura;
  const cubierta = cubiertaPorPaqueteViejo(booking);
  // Cobro: citas activas y COMPLETADAS siempre; canceladas/no-asistió sólo con link PAGADO o ACTIVO (un link
  // viejo no pagado NO debe reabrir el crear sobre una cita que nunca ocurrió).
  const motivoLink = !puedeEnviar("pagos") ? "Mandar links de pago necesita permiso de Pagos"
    : cubierta ? "Cubierta por el paquete: no hay nada que cobrar"
    : !showCobroGroup ? motivoCita
    : null;
  const motivoLinkCorto = !puedeEnviar("pagos") ? "Sin permiso de Pagos" : cubierta ? "Cubierta por el paquete" : !showCobroGroup ? motivoCitaCorto : null;
  // La nota = el COBRO de la cita como PDF: hay nota en cuanto hay cobro con monto (también cancelada).
  const conCobro = !!booking.ingreso && booking.ingreso.amount > 0;
  // Verla sólo pide Flujo de Dinero (lo revisa la fila y la ruta): antes la agenda la escondía con el link
  // (permiso de Pagos), pero la visita ya la ofrecía con sólo Flujo — también en una cita cancelada con
  // cobro. Una sola regla: la de la ruta (2026-10-12).
  const motivoNota = conCobro ? null
    : cubierta || booking.ingreso ? "Cubierta por el paquete: no tiene cobro que documentar"
    : isCompleted ? "Esta cita no tiene cobro con monto"
    : motivoCita ?? "Sin cobro todavía: la nota sale del cobro de la cita (al completarla o pagar el link)";
  const motivoNotaCorto = conCobro ? null : cubierta || booking.ingreso ? "Cubierta por el paquete" : motivoCitaCorto ?? "Sin cobro todavía";
  // Factura: con «¿Necesita factura?» marcada (o ya facturada). Vive mientras la cita no sea cancelada /
  // no asistió (completar = «ya vi al paciente», no «se cerró el papeleo», bitácora #29).
  const verFilasFactura = !sinFactura && (!!booking.facturaSolicitada || !!booking.facturada);
  // «Datos fiscales» sólo con la casilla marcada (como antes); «Factura» también si ya está facturada.
  const verDatosFiscales = !sinFactura && !!booking.facturaSolicitada;
  const motivoFactura = !puedeEnviar("facturacion") ? "Necesita permiso de Facturación" : motivoCita;

  const cobroGroup = (!sinCobro || verFilasFactura || conCasilla) && (
    <SeccionCita
      titulo={sinCobro ? "Factura" : "Cobro y factura"}
      derecha={(conPrecio || conCasilla) && (
        <span className="flex items-center gap-2">
          {conPrecio && (
            <span className="inline-flex items-center gap-1">
              <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Precio</span>
              <PriceCell booking={booking} onUpdatePrice={onUpdatePrice!} />
            </span>
          )}
          {conCasilla && <FacturaCheckbox booking={booking} onChange={onUpdateFacturaSolicitada!} />}
        </span>
      )}
    >
      {!sinCobro && (
        <PaymentLinkButton
          bookingId={booking.id}
          patientId={booking.patientId}
          patientName={booking.patientName}
          patientEmail={contactoEnvio.email || undefined}
          contacto={contactoEnvio}
          motivo={motivoLink}
          motivoCorto={motivoLinkCorto}
          defaultAmount={booking.finalPrice}
          defaultDescription={booking.serviceName ? `${booking.serviceName} - ${booking.patientName}` : `Consulta - ${booking.patientName}`}
          stripeLink={booking.paymentLink ? {
            status: booking.paymentLink.status,
            isActive: booking.paymentLink.isActive,
            url: booking.paymentLink.stripePaymentLinkUrl,
            paidAt: booking.paymentLink.paidAt,
            amount: booking.paymentLink.amount,
          } : null}
          mpLink={booking.mpPaymentPreference ? {
            status: booking.mpPaymentPreference.status,
            isActive: booking.mpPaymentPreference.isActive,
            url: booking.mpPaymentPreference.mpInitPoint,
            paidAt: booking.mpPaymentPreference.paidAt,
            amount: booking.mpPaymentPreference.amount,
          } : null}
        />
      )}
      {!sinCobro && <NotaCitaButton bookingId={booking.id} motivo={motivoNota} motivoCorto={motivoNotaCorto} />}
      {verDatosFiscales && <FiscalFormButton booking={booking} contacto={contactoEnvio} motivo={motivoFactura} />}
      {verFilasFactura && (
        <FacturaDeLaCita
          cfdiId={booking.facturaCfdiId} cfdiStatus={booking.facturaCfdiStatus} folio={booking.facturaCfdiFolio}
          contacto={contactoEnvio} facturada={!!booking.facturada} motivo={motivoFactura}
        />
      )}
    </SeccionCita>
  );

  // ── PARA EL PACIENTE ─────────────────────────────────────────────────────────────────────────────
  // CONFIRMACIÓN — el correo sale solo al crear/confirmar la cita si hay correo y Gmail conectado; en prod
  // había citas CON correo y sin envío, por eso «Correo» sigue aquí. WhatsApp no tiene API: abre el chat
  // con el mensaje listo (por eso no lleva «ya enviado»). Sólo en una cita AGENDADA.
  const ultimoEnvio = booking.confirmationEmailSentAt
    ? new Date(booking.confirmationEmailSentAt).toLocaleString("es-MX", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })
    : null;
  const esTelemedicina = booking.appointmentMode === "TELEMEDICINA";
  const motivoConfirmacion = showCommsGroup ? null
    : booking.status === "PENDING" ? "Confírmala primero" : motivoCita ?? "La cita ya pasó";
  const mensajeWhatsApp = [
    `Hola ${booking.patientName}, te confirmamos tu cita`,
    bookingDate ? ` el ${formatLocalDate(bookingDate, { weekday: "long", day: "numeric", month: "long" })}` : "",
    booking.slot?.startTime ?? booking.startTime ? ` a las ${booking.slot?.startTime ?? booking.startTime}` : "",
    ".",
    booking.meetLink ? ` Enlace de la videoconsulta: ${booking.meetLink}` : "",
  ].join("");

  const comunicacionGroup = !soloCobro && (
    <SeccionCita titulo="Para el paciente">
      <FilaCita
        nombre="Confirmación"
        estado={motivoConfirmacion ? (booking.status === "PENDING" ? "Sin confirmar" : motivoCitaCorto ?? "La cita ya pasó") : ultimoEnvio ? `Enviada · ${ultimoEnvio}` : "Sin enviar por correo"}
        tono={motivoConfirmacion ? "apagado" : ultimoEnvio ? "bien" : "neutro"}
      >
        <BotonCita
          etiqueta="Correo" icono={esTelemedicina && !booking.meetLink ? <Video className="w-3 h-3" /> : <Send className="w-3 h-3" />}
          onClick={handleSendEmail} ocupado={isSendingEmail} ancho={COLUMNA.correo}
          motivo={motivoConfirmacion ?? (!contactoEnvio.email ? faltaCorreo(contactoEnvio.expediente) : null)}
          irA={!motivoConfirmacion && !contactoEnvio.email ? contactoEnvio.expediente : null}
          titulo={esTelemedicina && !booking.meetLink ? "Crea el Google Meet y manda la confirmación" : "Manda la confirmación de la cita al paciente"}
        />
        <BotonCita
          etiqueta="WhatsApp" icono={<MessageCircle className="w-3 h-3" />} ancho={COLUMNA.whatsapp}
          href={`https://wa.me/${contactoEnvio.wa}?text=${encodeURIComponent(mensajeWhatsApp)}`}
          motivo={motivoConfirmacion ?? (!contactoEnvio.wa ? faltaWhatsapp(contactoEnvio.expediente) : null)}
          irA={!motivoConfirmacion && !contactoEnvio.wa ? contactoEnvio.expediente : null}
          titulo="Abre WhatsApp con la confirmación lista para enviar"
        />
        {esTelemedicina && booking.meetLink ? (
          <BotonCita etiqueta="Meet" icono={<ExternalLink className="w-3 h-3" />} href={booking.meetLink} ancho={COLUMNA.ver} titulo="Abrir Google Meet" motivo={motivoConfirmacion} />
        ) : (
          <Hueco ancho={COLUMNA.ver} />
        )}
        <Hueco ancho={COLUMNA.extra} />
      </FilaCita>
      <FormularioStatusButton
        booking={booking}
        contacto={contactoEnvio}
        onCreateForm={() => onOpenFormLinkModal(booking)}
        onDeleteForm={() => onDeleteFormLink(booking.id)}
      />
    </SeccionCita>
  );

  // Una cita con COBRO no se borra (decisión del usuario 2026-10-12): su ingreso quedaba en Flujo sin
  // cita y desaparecía de «Cobros». La regla la aplica el SERVIDOR (409 si tiene ingreso); aquí sólo se
  // lee el mismo hecho que manda GET /bookings (`ingreso`) para no ofrecer un botón que va a fallar.
  const tieneDinero = !!booking.ingreso;
  const eliminarGroup = isTerminal && !soloCobro && !tieneDinero && borrar !== "no" && (
    <div className="pt-1">
      <BotonCita
        etiqueta={borrar === "cita-y-visita" ? "Borrar cita y visita" : "Borrar cita"} variante="peligro"
        onClick={() => onDeleteBooking(booking.id, booking.patientName)}
      />
    </div>
  );

  // Table layout: two cells — gestión (Estado / Borrar) and lo de dinero y del paciente — so the row stays
  // short. (Ya no lo usa la tabla, que despliega la fila con "expanded"; el contrato sigue válido.)
  if (layout === "table") {
    return (
      <>
        <td className="py-3 px-3 align-top">
          {modal}
          <div className="flex flex-col gap-3">
            {estadoGroup}
            {eliminarGroup}
          </div>
        </td>
        <td className="py-3 px-3 align-top">
          <div className="flex flex-col gap-3">
            {cobroGroup}
            {comunicacionGroup}
          </div>
        </td>
      </>
    );
  }

  // "expanded" (la fila desplegada de la tabla, la visita) y "card" (móvil, el calendario): las secciones
  // UNA DEBAJO DE OTRA, siempre en el mismo orden — las filas necesitan el ancho para que sus columnas de
  // botones alineen.
  return (
    <>
      {modal}
      <div className={`flex flex-col gap-4 ${layout === "expanded" ? "border-t border-gray-200 pt-3" : ""}`}>
        {/* «Cobros» del expediente: primero el dinero, luego «Completar». */}
        {soloCobro ? <>{cobroGroup}{estadoGroup}</> : <>{estadoGroup}{cobroGroup}</>}
        {comunicacionGroup}
        {eliminarGroup}
      </div>
    </>
  );
}
