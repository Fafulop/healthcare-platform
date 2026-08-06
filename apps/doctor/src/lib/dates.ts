/**
 * Shared date utilities for the doctor app.
 *
 * Root problem: DB dates are stored as UTC midnight (e.g. "2026-03-04T00:00:00.000Z").
 * Passing those directly to `new Date()` in a Mexico City browser (UTC−6) shifts them
 * to the previous day at 6 PM local time, so `toLocaleDateString` shows one day less.
 *
 * All three helpers below avoid that by working with local year/month/day parts.
 */

/**
 * Convert a Date object to a "YYYY-MM-DD" string using local (not UTC) date parts.
 * Safe to use for <input type="date"> values and date comparisons.
 */
export function getLocalDateString(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Parse a DB ISO date string (e.g. "2026-03-04T00:00:00.000Z") as local midnight.
 * Use this whenever you need a Date object from a DB date field.
 */
export function parseLocalDate(isoStr: string): Date {
  const [y, m, d] = isoStr.split('T')[0].split('-').map(Number);
  return new Date(y, m - 1, d, 0, 0, 0, 0);
}

/**
 * La zona de la plataforma. Todo el producto opera en hora de Ciudad de México y NO hay
 * campo de zona horaria por doctor en el esquema — el resto del app ya asume esta constante
 * en ~27 lugares (`toLocaleString("sv-SE", { timeZone: ... })`).
 *
 * Importa para el calendario: una REJILLA de horas expone la diferencia entre "ahora" del
 * navegador y "ahora" en México (la línea de ahora, la columna de hoy, la posición vertical
 * de cada cita). Un selector de fechas a nivel de DÍA la toleraba; la rejilla no.
 * Siempre derivá "ahora" de aquí, nunca de `new Date()` pelón.
 */
export const CLINIC_TIMEZONE = 'America/Mexico_City';

/**
 * `Date` cuyas partes LOCALES representan la hora de pared de Ciudad de México.
 *
 * El truco del formato "sv-SE" ("YYYY-MM-DD HH:mm:ss") es el mismo que ya usa
 * `appointments/page.tsx` para decidir si una cita está vencida. El objeto resultante NO
 * apunta al instante correcto en UTC — solo sirve para leerle año/mes/día/hora/minuto.
 */
export function nowInClinicTz(): Date {
  // "sv-SE" da "YYYY-MM-DD HH:mm:ss". El `replace` mete la `T` a propósito: con espacio la
  // cadena NO es un formato que ECMA-262 obligue a aceptar (hoy funciona en todos los
  // motores, pero por costumbre, no por contrato); con `T` es fecha-hora ISO sin offset,
  // que la norma manda interpretar como hora LOCAL — justo lo que queremos.
  // No es purismo: esta función es la raíz de TODO "hoy"/"ahora" del calendario, y si
  // devolviera `Invalid Date` el fallo sería total y mudo — `getClinicDateString()` daría
  // "NaN-NaN-NaN", el ancla sería inválida, la ventana NaN, y la rejilla saldría en blanco
  // sin un solo error en consola.
  const wallClock = new Date().toLocaleString('sv-SE', { timeZone: CLINIC_TIMEZONE });
  return new Date(wallClock.replace(' ', 'T'));
}

/** "YYYY-MM-DD" de HOY en hora de la clínica (no del navegador). */
export function getClinicDateString(): string {
  return getLocalDateString(nowInClinicTz());
}

/**
 * Minutos transcurridos desde la medianoche en hora de la clínica.
 * Es lo que posiciona la línea de "ahora" en la rejilla de día/semana.
 */
export function getClinicMinutesOfDay(): number {
  const now = nowInClinicTz();
  return now.getHours() * 60 + now.getMinutes();
}

/**
 * HOY anclado al MEDIODÍA local, en hora de la clínica.
 *
 * El mediodía no es cosmético: `selectedDate` se serializa con `toISOString()` en varios
 * lugares, y a medianoche local en UTC−6 eso salta al día siguiente. Anclar a las 12:00
 * deja 6 horas de colchón por lado. Es el mismo ancla que ya produce el clic en el
 * mini-calendario (`new Date(dateStr + "T12:00:00")`).
 */
export function todayInClinicTz(): Date {
  return parseLocalDateAtNoon(getClinicDateString());
}

/** Igual que `parseLocalDate` pero anclado al mediodía. Ver `todayInClinicTz`. */
export function parseLocalDateAtNoon(isoStr: string): Date {
  const [y, m, d] = isoStr.split('T')[0].split('-').map(Number);
  return new Date(y, m - 1, d, 12, 0, 0, 0);
}

/**
 * Format a DB date string directly for display (e.g. "martes, 4 de marzo de 2026").
 * Parses safely before formatting to avoid the UTC timezone shift.
 */
export function formatLocalDate(
  isoStr: string,
  options?: Intl.DateTimeFormatOptions,
  locale: string = 'es-MX'
): string {
  try {
    return parseLocalDate(isoStr).toLocaleDateString(locale, options);
  } catch {
    return isoStr;
  }
}

/**
 * "HH:MM" en 24 h (como lo guarda la BD y lo devuelve el API) → escrito **como lo escribe el
 * navegador del doctor**: "15:45" o "3:45 PM" según su locale.
 *
 * Existe por una sola razón, y es de coherencia visible: el campo de hora del modal de
 * agendar es un `<input type="time">` y **su formato lo elige el navegador, no nosotros** —
 * no hay atributo para forzarlo. Con las etiquetas en 24 h duras, la misma hora aparecía dos
 * veces y en dos notaciones a un centímetro de distancia: el campo decía `03:45 PM` y el
 * botón de al lado `Usar 15:45 – 16:30`. No estaba mal; obligaba a traducir.
 *
 * ⚠️ **Locale del NAVEGADOR a propósito** (`undefined`), no `es-MX` como `formatLocalDate`.
 * El objetivo no es "hablar español", es **coincidir con el campo** — y el campo sigue al
 * navegador. Fijar un locale aquí reintroduciría el desacuerdo para quien tenga el navegador
 * en otro idioma, que es justo el caso que se está arreglando.
 *
 * ⚠️ **Sólo para el modal de agendar.** La rejilla del calendario, la franja de rangos y la
 * tabla siguen en 24 h: ahí no hay ningún `<input type="time">` con el que coincidir, y son
 * densas en horas (una columna de 14 h con "3 PM" en vez de "15:00" se lee peor).
 *
 * ⚠️ **No usar en render de servidor.** El locale del navegador no existe en el build, así que
 * SSR y cliente pueden diferir. Hoy es seguro porque el modal no se rinde hasta que el doctor
 * lo abre (`isOpen` rinde `null`), pero si algo de esto acaba en HTML prerenderizado hay que
 * volver a mirarlo.
 */
export function formatTimeOfDay(hhmm: string): string {
  const [h, m] = (hhmm ?? '').split(':').map(Number);
  if (!Number.isFinite(h) || !Number.isFinite(m)) return hhmm;
  return new Date(2000, 0, 1, h, m).toLocaleTimeString(undefined, {
    hour: 'numeric',
    minute: '2-digit',
  });
}
