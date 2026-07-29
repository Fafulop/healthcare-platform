/**
 * Contacto EFECTIVO de una cita: **el EXPEDIENTE manda, la copia de la CITA es el respaldo.**
 *
 * ✅ **Decisión tomada 2026-07-29 — cierra la bitácora #30.** El orden estaba al revés (la cita
 * primero) y eso hacía que el dato VIVO nunca pudiera corregir al viejo: la cita guarda lo que
 * se escribió al agendar y NINGUNA ruta la actualiza después, mientras el expediente sí se
 * edita. Consecuencia real que se midió: corregir el correo al crear el expediente desde una
 * cita **no tenía ningún efecto visible** — la fila seguía mostrando el viejo y el botón de
 * confirmación seguía enviando ahí.
 *
 * Por qué el expediente y no la cita, en los tres flujos que existen:
 *   · Recurrente ligado a un expediente → el correo del expediente ES el bueno.
 *   · Paciente nuevo → el expediente NACE con el correo que se capturó en la cita, así que
 *     coinciden; de ahí en adelante se edita en el expediente.
 *   · Paciente nuevo ligado después a un expediente que ya existía → el del expediente gana.
 *
 * ⚠️ **El `||` NO es opcional.** Si el expediente se creó por otro camino y quedó sin correo,
 * caer a la copia de la cita es lo que evita tirar a la basura un correo utilizable. "El
 * expediente manda" significa *cuando tiene valor*, no siempre.
 *
 * ⚠️ Tras este cambio la copia de la cita queda como **registro histórico** de lo que se
 * capturó al agendar — ya no se lee para enviar. No hay que "mantenerla sincronizada": eso
 * reintroduciría justo la divergencia que esto elimina.
 *
 * Mismo orden que resuelven los dos endpoints de envío del servidor
 * (`bookings/[id]/send-email` y `lib/send-confirmation-email`). Si el cliente y el servidor
 * divergen, el botón promete un envío que la API rechaza — o al revés.
 *
 * ⚠️ Deuda conocida: el AGENTE sigue leyendo `b.patientEmail` a secas (`tools.ts`, mapBooking),
 * así que hasta que se pague la deuda §8 puede contradecir a la UI. La corrección va con el
 * orden NUEVO (expediente primero), no con el que dice la bitácora original.
 */
export interface ContactoDeCita {
  patientEmail?: string | null;
  patientPhone?: string | null;
  patient?: { email?: string | null; phone?: string | null } | null;
}

export function resolverContacto(booking: ContactoDeCita) {
  return {
    email: booking.patient?.email?.trim() || booking.patientEmail?.trim() || "",
    phone: booking.patient?.phone?.trim() || booking.patientPhone?.trim() || "",
  };
}

/**
 * Número al que se le manda WhatsApp desde una cita: el campo que el paciente dio PARA
 * WhatsApp gana, y si no, el teléfono resuelto (expediente → cita).
 *
 * ⚠️ Este es el ÚNICO dato que NO puede seguir la regla "el expediente manda": `Patient` no
 * tiene columna de WhatsApp, así que ese número existe SOLO en la cita. No es una
 * inconsistencia que haya que "arreglar" — es el esquema.
 */
export function telefonoWhatsApp(booking: ContactoDeCita & { patientWhatsapp?: string | null }) {
  return booking.patientWhatsapp?.trim() || resolverContacto(booking).phone;
}
