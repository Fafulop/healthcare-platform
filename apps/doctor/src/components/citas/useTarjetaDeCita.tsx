'use client';

import { useCallback, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAlVolverALaPestana } from '@/lib/use-al-volver-a-la-pestana';
import { useBookings, type Booking } from '@/app/dashboard/appointments/_hooks/useBookings';
import { PreAppointmentFormModal } from '@/app/dashboard/appointments/_components/PreAppointmentFormModal';
import type { ManejadoresDeCita } from '@/app/dashboard/appointments/_components/TarjetaDeCita';

/**
 * VISITAS 10-PLAN P1 — la tarjeta COMPLETA de la cita (`TarjetaDeCita`) fuera de la agenda: las citas de
 * UN paciente con la misma forma que la agenda (`useBookings(…, { patientId })`) y los MISMOS
 * manejadores. Lo único propio de cada pantalla:
 *   · `despues` — tras cada INTENTO de escritura (también si el doctor dijo que no en la confirmación o
 *     el servidor la rechazó: los manejadores de la agenda no lo distinguen), recargar lo suyo. Recibe la
 *     acción intentada, no un hecho: quien lo use para salir de la página debe comprobar (como la visita,
 *     que re-lee y sólo sale si su visita ya no existe);
 *   · `volverA` — «Reagendar» abre el modal de la agenda (`?reagendar=`) y regresa aquí al cerrarlo.
 * Devuelve también el modal del formulario pre-consulta («Crear formulario»), que vive en la página.
 */
export function useTarjetaDeCita({ doctorId, patientId, volverA, despues }: {
  doctorId: string | null | undefined;
  patientId: string;
  volverA: string;
  despues: (status?: string) => Promise<void>;
}) {
  const b = useBookings(doctorId ?? undefined, { patientId });
  // N10: al regresar a la pestaña, la tarjeta vuelve a leer sus citas (lo cambiado en otra no se veía).
  useAlVolverALaPestana(() => b.fetchBookings({ silencioso: true }));
  const router = useRouter();
  const [formulario, setFormulario] = useState<Booking | null>(null);

  const porId = useCallback((id: string | null | undefined) => (id ? b.bookings.find((x) => x.id === id) : undefined), [b.bookings]);

  // Tras CUALQUIER escritura se re-leen las dos listas juntas (la de la agenda, que pinta esta tarjeta, y
  // la de la página, que pinta sus insignias): si no, la casilla «¿Necesita factura?» decía una cosa y la
  // insignia de arriba otra hasta recargar.
  const releer = (accion?: string) => Promise.all([b.fetchBookings(), despues(accion)]).then(() => undefined);

  const manejadores: ManejadoresDeCita = {
    onUpdateStatus: async (id, status) => { await b.updateBookingStatus(id, status); await releer(status); },
    onUpdateExtendedBlock: async (id, min) => { await b.updateExtendedBlock(id, min); await releer(); },
    onUpdateFacturaSolicitada: async (id, v) => { await b.updateFacturaSolicitada(id, v); await releer(); },
    onUpdatePatientLink: b.updatePatientLink,
    onUpdatePrice: async (id, price) => { await b.updateBookingPrice(id, price); await releer(); },
    onDeleteBooking: async (id, name) => { await b.deleteBooking(id, name); await releer('DELETED'); },
    onOpenFormLinkModal: setFormulario,
    onDeleteFormLink: async (id) => { await b.deleteFormLink(id); await releer(); },
    onSendEmail: async (id) => { await b.sendConfirmationEmail(id); await releer(); },
    onReschedule: (booking) => router.push(
      `/dashboard/appointments?reagendar=${encodeURIComponent(booking.id)}&volver=${encodeURIComponent(volverA)}`,
    ),
    onCompleteBooking: async (id, price, forma) => {
      const r = await b.completeBooking(id, price, forma);
      await releer('COMPLETED');
      return r;
    },
  };

  const modalFormulario = (
    <PreAppointmentFormModal
      booking={formulario}
      isOpen={!!formulario}
      onClose={() => setFormulario(null)}
      onSuccess={() => { void releer(); }}
    />
  );

  // `cargadas` / `fallo`: sin la cita de la agenda la tarjeta no se puede pintar — la página lo DICE en vez
  // de quedarse sin botones en silencio.
  return { porId, manejadores, modalFormulario, recargar: b.fetchBookings, cargadas: b.bookingsCargadas, fallo: b.bookingsFallo };
}
