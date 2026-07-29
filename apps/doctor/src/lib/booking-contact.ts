/**
 * Contacto EFECTIVO de una cita: la copia de la CITA primero, el EXPEDIENTE de respaldo.
 *
 * Es el MISMO orden que resuelven los dos endpoints de envío del servidor
 * (`bookings/[id]/send-email` y `lib/send-confirmation-email`). Si el cliente y el servidor
 * divergen, el botón promete un envío que la API rechaza — o al revés.
 *
 * Vive aquí y no dentro de un componente porque lo necesitan la fila, el link de pago y los
 * botones que comparten enlaces (formulario pre-consulta y datos fiscales). Estos dos últimos
 * leían `booking.patientPhone` a secas: la fila mostraba un teléfono que solo existe en el
 * expediente y el botón de WhatsApp se escondía diciendo que no había número.
 *
 * ⚠️ La cita guarda lo que se escribió al agendar y NADIE la actualiza después (ninguna ruta
 * escribe `booking.patientEmail` fuera de la creación), así que esta copia puede estar vieja
 * frente al expediente. Que la copia gane es una decisión pendiente de revisar — bitácora #30
 * en `AGENTE AGENDA/SESSION-REFRESCO`. Mientras siga así, este archivo es el único lugar donde
 * se cambia el orden.
 */
export interface ContactoDeCita {
  patientEmail?: string | null;
  patientPhone?: string | null;
  patient?: { email?: string | null; phone?: string | null } | null;
}

export function resolverContacto(booking: ContactoDeCita) {
  return {
    email: booking.patientEmail?.trim() || booking.patient?.email?.trim() || "",
    phone: booking.patientPhone?.trim() || booking.patient?.phone?.trim() || "",
  };
}

/**
 * Número al que se le manda WhatsApp desde una cita: el campo que el paciente dio PARA
 * WhatsApp gana, y si no, el teléfono resuelto (cita → expediente).
 * `Patient` NO tiene columna de WhatsApp, así que ese campo solo existe en la cita.
 */
export function telefonoWhatsApp(booking: ContactoDeCita & { patientWhatsapp?: string | null }) {
  return booking.patientWhatsapp?.trim() || resolverContacto(booking).phone;
}
