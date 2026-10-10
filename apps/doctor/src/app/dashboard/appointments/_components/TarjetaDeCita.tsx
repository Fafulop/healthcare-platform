"use client";

/**
 * El CUERPO de la tarjeta de UNA cita: expediente · notas · precio + «¿Necesita factura?» · horario ·
 * los grupos de `StatusActions` (Estado · Confirmación · Cobro · Factura · Documentos · Eliminar).
 *
 * VISITAS 10-PLAN P1: vivía dentro de `BookingDetailModal` (el modal del calendario). Se sacó aquí SIN
 * cambiarle nada para que la visita, la tarjeta de la sesión del tratamiento y «Cobros» del expediente
 * pinten exactamente esto con los MISMOS manejadores (`useBookings`) — una copia derivaría en cuanto
 * alguien tocara la agenda. Los componentes son los de `BookingActions.tsx`; ver allí cada regla.
 *
 * Fuera de la agenda algunas secciones sobran y se apagan, nunca se reescriben:
 *   · `conExpediente={false}` — dentro del expediente el paciente ES éste (desligarlo desde su visita
 *     dejaría la visita colgando de otro);
 *   · `conNotas={false}` — la visita ya enseña las notas de la cita;
 *   · `sinEstado` — la tarjeta de la sesión ya trae Completar · No asistió · Cancelar · Reagendar a la
 *     vista; esto va plegado debajo («Más de la cita»);
 *   · `sinCobro` / `sinFactura` — los permisos del expediente (`flujo` / `facturacion`): sin ellos no se ve
 *     el precio ni el grupo Cobro / ni la casilla ni el grupo Factura (allá tampoco se ven sus insignias).
 */

import { NotasCita, tieneNotas } from "@/components/citas/NotasCita";
import { resolverContacto } from "@/lib/booking-contact";
import {
  StatusActions,
  ExpedienteCell,
  PriceCell,
  FacturaCheckbox,
  ExtendedBlockControl,
} from "./BookingActions";
import type { Booking } from "../_hooks/useBookings";

export interface ManejadoresDeCita {
  onUpdateStatus: (id: string, status: string) => void;
  onUpdateExtendedBlock: (id: string, extendedBlockMinutes: number | null) => Promise<void>;
  onUpdateFacturaSolicitada: (id: string, facturaSolicitada: boolean) => void;
  onUpdatePatientLink: (bookingId: string, patientId: string | null, patient: { id: string; firstName: string; lastName: string } | null) => void;
  onUpdatePrice: (id: string, price: number) => Promise<void>;
  onDeleteBooking: (id: string, patientName: string) => void;
  onOpenFormLinkModal: (booking: Booking) => void;
  onDeleteFormLink: (bookingId: string) => void;
  onSendEmail: (id: string) => Promise<void>;
  onReschedule: (booking: Booking) => void;
  onCompleteBooking: (id: string, price: number, formaDePago: string) => Promise<{ ledgerEntryId?: number }>;
}

/** Etiqueta de una sección del cuerpo — mismo tono que los rótulos de `StatusActions`. */
function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <span className="block text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1">
      {children}
    </span>
  );
}

export function TarjetaDeCita({
  booking, conExpediente = true, conNotas = true, sinEstado = false, sinCobro = false, sinFactura = false,
  onUpdateStatus, onUpdateExtendedBlock, onUpdateFacturaSolicitada, onUpdatePatientLink,
  onUpdatePrice, onDeleteBooking, onOpenFormLinkModal, onDeleteFormLink, onSendEmail,
  onReschedule, onCompleteBooking,
}: ManejadoresDeCita & {
  booking: Booking;
  conExpediente?: boolean;
  conNotas?: boolean;
  sinEstado?: boolean;
  sinCobro?: boolean;
  sinFactura?: boolean;
}) {
  const contacto = resolverContacto(booking);

  return (
    <div className="space-y-4">
      {/* Expediente · contacto. El contacto sale de `resolverContacto`, o sea el
          EXPEDIENTE manda y la copia de la cita es el respaldo (decisión #30) — la
          misma función que usan la fila, el link de pago y el botón fiscal. */}
      {conExpediente && (
        <div>
          <SectionLabel>Expediente</SectionLabel>
          <ExpedienteCell booking={booking} onUpdatePatientLink={onUpdatePatientLink} />
          {(contacto.phone || contacto.email) && (
            <div className="mt-1.5 flex flex-col gap-0.5 text-xs text-gray-500">
              {contacto.phone && <span>{contacto.phone}</span>}
              {contacto.email && <span className="break-all">{contacto.email}</span>}
            </div>
          )}
        </div>
      )}

      {/* Notas de la cita — lo que el doctor escribió al agendarla. Van ARRIBA de
          precio/factura porque son contexto clínico ("seguimiento Wegovy"), no un
          dato administrativo, y hasta hoy no se veían en NINGUNA pantalla.
          `trim()`: en prod hay 29 citas con notes = "", y una sección vacía se lee
          como un error de carga. */}
      {conNotas && tieneNotas(booking.notes) && (
        <div>
          <SectionLabel>Notas</SectionLabel>
          {/* Ya hay rótulo (SectionLabel), así que el bloque va sin su etiqueta. */}
          <NotasCita notes={booking.notes} conEtiqueta={false} recortable={false} />
        </div>
      )}

      {/* Precio y la casilla, juntos como en la columna PRECIO de la tabla.
          La casilla va SIN rótulo, igual que allá: ya se rotula a sí misma ("¿Necesita
          factura?"), y un encabezado "Factura" aquí chocaría con el grupo FACTURA que
          rinde `StatusActions` más abajo — los dos aparecen a la vez en cuanto la
          casilla se marca, y el modal es angosto: dos secciones con el mismo nombre. */}
      {(!sinCobro || !sinFactura) && (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          {!sinCobro && (
            <div>
              <SectionLabel>Precio</SectionLabel>
              <PriceCell booking={booking} onUpdatePrice={onUpdatePrice} />
            </div>
          )}
          {!sinFactura && <FacturaCheckbox booking={booking} onChange={onUpdateFacturaSolicitada} />}
        </div>
      )}

      {/* Mismo gate que la tabla: el bloqueo sólo tiene sentido en una cita CONFIRMED
          (no hay agenda futura que ocupar en una terminal). */}
      {booking.status === "CONFIRMED" && (
        <div>
          <SectionLabel>Horario</SectionLabel>
          <ExtendedBlockControl booking={booking} onUpdate={onUpdateExtendedBlock} />
        </div>
      )}

      {/* Los grupos de acciones, apilados: "card" (la pila del móvil) encaja en un espacio
          angosto mejor que la rejilla de 3 columnas. */}
      <div className="border-t border-gray-100 pt-3">
        <StatusActions
          booking={booking}
          layout="card"
          sinEstado={sinEstado}
          sinCobro={sinCobro}
          sinFactura={sinFactura}
          onUpdateStatus={onUpdateStatus}
          onDeleteBooking={onDeleteBooking}
          onOpenFormLinkModal={onOpenFormLinkModal}
          onDeleteFormLink={onDeleteFormLink}
          onSendEmail={onSendEmail}
          onReschedule={onReschedule}
          onCompleteBooking={onCompleteBooking}
        />
      </div>
    </div>
  );
}
