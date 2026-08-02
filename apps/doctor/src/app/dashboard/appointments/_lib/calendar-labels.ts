/**
 * Rótulos de fecha en español — FUENTE ÚNICA.
 *
 * Vivían copiados en cinco componentes (`AppointmentsCalendar`, `PurgeSlotsModal`,
 * `SlotPickerStep`, y las dos rejillas nuevas). Son contenido curado: una copia que se
 * corrija sola —una tilde, un orden de semana— deja a las otras diciendo algo distinto en
 * la misma pantalla.
 */

export const MONTH_NAMES = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
] as const;

/** Nombre del mes en minúscula, para rótulos dentro de una frase ("3 – 9 de agosto 2026"). */
export function monthNameLower(month: number): string {
  return MONTH_NAMES[month].toLowerCase();
}

/** Encabezados de columna. El orden fija el inicio de semana en DOMINGO (ver `useCalendar`). */
export const DAY_NAMES_SHORT = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"] as const;

/** Variante de una letra, para los mini-meses de la vista de año. */
export const DAY_INITIALS = ["D", "L", "M", "M", "J", "V", "S"] as const;
