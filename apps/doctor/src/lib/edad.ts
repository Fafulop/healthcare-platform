/**
 * La edad del paciente. **UNA sola implementación** — antes había cuatro y tres
 * tenían el mismo bug de zona horaria (01-FUENTES §2).
 *
 * El bug: `new Date("1980-05-15")` se interpreta como medianoche **UTC**; leerlo
 * con `getDate()` **local** en UTC-6 devuelve 14, no 15, así que el paciente
 * "cumplía años" un día antes. Medido en `America/Mexico_City`:
 *
 *   nacimiento 1980-05-15, hoy 14-may-2026  →  la mala dice 46, la correcta 45
 *
 * En un informe médico-legal para una aseguradora eso no es cosmético.
 *
 * La solución es no construir un `Date` para el nacimiento: se parte la fecha en
 * números y se comparan contra el día de HOY en la zona local. Es la versión que
 * vivía en `lib/pdf/encounter-pdf.ts`.
 */

/**
 * Años cumplidos a día de hoy.
 *
 * @param dateOfBirth `YYYY-MM-DD`, un ISO completo, o el `Date` que devuelve
 *   Prisma para `dateOfBirth` (columna `@db.Date` ⇒ medianoche UTC, así que su
 *   `toISOString()` sí trae el día calendario correcto).
 */
export function calcularEdad(dateOfBirth: string | Date): number {
  const iso = typeof dateOfBirth === 'string' ? dateOfBirth : dateOfBirth.toISOString();
  const [y, m, d] = iso.split('T')[0].split('-').map(Number);
  if (!y || !m || !d) return NaN;

  const hoy = new Date();
  let edad = hoy.getFullYear() - y;
  const meses = hoy.getMonth() - (m - 1);
  if (meses < 0 || (meses === 0 && hoy.getDate() < d)) edad--;
  return edad;
}
