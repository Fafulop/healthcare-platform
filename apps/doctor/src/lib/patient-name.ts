/**
 * Nombre del paciente de una CITA → nombre y apellidos separados.
 *
 * Desde 2026-07-29 la cita guarda `patientFirstName` / `patientLastName` tal como los capturó el
 * doctor en el modal de agendar: ahí NO hay nada que adivinar y esta función solo los devuelve.
 *
 * El split solo corre para las citas que NO los traen, que son y seguirán siendo muchas:
 *   · las 366 citas anteriores a la migración,
 *   · las del widget público (un solo campo de nombre),
 *   · las que crea el agente (manda `patientName` a secas).
 *
 * El criterio del split es "todo lo que sigue al PRIMER espacio son apellidos". Se conserva tal
 * cual porque se midió: contra las citas ya vinculadas cuyo nombre coincide con el del expediente
 * acierta 23 de 26 (2026-07-29). Se probó la alternativa "las dos ÚLTIMAS palabras son los
 * apellidos" —que la forma de los expedientes sugería— y acertó 22 de 26: peor. No se cambia una
 * heurística viva por una corazonada que la medición no respalda.
 */
/**
 * El nombre completo de la CITA = nombre + apellidos.
 * `bookings.patientName` sigue siendo la concatenación de los dos campos: es lo que leen los
 * correos, el agente, el widget público, la fila de la tabla y el link de pago. Los campos
 * separados existen ADEMÁS, no en su lugar.
 * Vive aquí junto a `partirNombreDeCita` porque son las dos mitades de la misma regla —
 * juntar para guardar en la cita, separar para nacer el expediente.
 */
export function nombreCompleto(f: { patientFirstName: string; patientLastName: string }): string {
  return `${f.patientFirstName.trim()} ${f.patientLastName.trim()}`.trim();
}

export interface NombrePartido {
  firstName: string;
  lastName: string;
  /** true = vino del split (adivinado); false = el doctor lo capturó separado. */
  adivinado: boolean;
}

export function partirNombreDeCita(booking: {
  patientName: string;
  patientFirstName?: string | null;
  patientLastName?: string | null;
}): NombrePartido {
  const first = booking.patientFirstName?.trim();
  const last = booking.patientLastName?.trim();
  // Basta con que UNO de los dos venga: una cita con nombre pero sin apellidos capturados es
  // válida (el paciente dio un solo nombre) y no debe caer al split, que devolvería lo mismo.
  if (first || last) {
    return { firstName: first ?? "", lastName: last ?? "", adivinado: false };
  }

  const completo = (booking.patientName ?? "").trim().replace(/\s+/g, " ");
  const corte = completo.indexOf(" ");
  return corte === -1
    ? { firstName: completo, lastName: "", adivinado: true }
    : { firstName: completo.slice(0, corte), lastName: completo.slice(corte + 1), adivinado: true };
}
