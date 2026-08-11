/**
 * 🔴 QUÉ CLASE DE FECHA TRAE CADA FUENTE. Un solo lugar, a propósito.
 *
 * Medido contra prod (2026-08-11): las columnas de fecha *clínica* se escriben
 * con `new Date("YYYY-MM-DD")` desde un input de tipo fecha, así que quedan a
 * **medianoche UTC** y su semántica es un **día del calendario**, no un instante:
 *
 * | columna                 | en prod              | clase       | se lee en |
 * |-------------------------|----------------------|-------------|-----------|
 * | `encounterDate`         | 193/199 a las 00:00Z | calendario  | **UTC**   |
 * | `prescriptionDate`      | 41/41 a las 00:00Z   | calendario  | **UTC**   |
 * | `expiresAt`             | 8/8 a las 00:00Z     | calendario  | **UTC**   |
 * | `patientNote.createdAt` | 11/11 CON hora       | instante    | **México**|
 *
 * Formatear una de calendario en hora de México la corre **un día para atrás**
 * (18/7 → 17/7). Formatear un instante en UTC la corre **un día para adelante**
 * después de las 18:00. Las dos equivocaciones caben en el campo que la
 * aseguradora cruza contra la fecha del siniestro.
 *
 * ⚠️ Este módulo es **puro** (sin Prisma) justamente para que lo importen las dos
 * orillas: el servidor al armar el texto del modelo y los componentes de cliente
 * al pintar las etiquetas. Ya pasó una vez que la decisión viviera en tres copias
 * y dos de ellas quedaran mal.
 */

export type TipoFuente = 'consulta' | 'nota' | 'receta';

/** La zona del negocio. El servidor corre en UTC; "hoy" nunca es UTC aquí. */
export const MX_TZ = 'America/Mexico_City';

/**
 * `true` si la COLUMNA de esa fuente se llena con un día del calendario.
 * Es sólo la mitad de la decisión: la otra mitad la da el valor (ver abajo).
 */
const COLUMNA_DE_CALENDARIO: Record<TipoFuente, boolean> = {
  consulta: true,   // encounterDate
  receta: true,     // prescriptionDate · expiresAt
  nota: false,      // createdAt — `now()`, instante real
};

/**
 * 🔴 Exactamente medianoche UTC ⇒ el valor **es** un día de calendario.
 *
 * ⚠️ Y hace falta además del tipo, porque la tabla de arriba **no es exhaustiva**:
 * de las 199 `encounter_date` de prod, **193 están a las 00:00Z pero 6 traen hora
 * de verdad** (12:00Z, datos viejos/importados). Leer una de esas en UTC corre la
 * fecha **hacia adelante**: `2026-03-13T01:00:00Z` es el 12 de marzo a las 19:00
 * en CDMX y se imprimiría "13/03". Con esta comprobación, las 193 se leen como
 * día (UTC) y las 6 como el instante que son (México). Las de 12:00Z dan lo mismo
 * en las dos zonas, así que ninguna cambia de día.
 */
function esMedianocheUtc(d: Date): boolean {
  return d.getUTCHours() === 0 && d.getUTCMinutes() === 0
    && d.getUTCSeconds() === 0 && d.getUTCMilliseconds() === 0;
}

/** La zona en la que hay que LEER esta fecha concreta de esta fuente. */
export function zonaDeFuente(d: Date, tipo: TipoFuente): string {
  return COLUMNA_DE_CALENDARIO[tipo] && esMedianocheUtc(d) ? 'UTC' : MX_TZ;
}

/**
 * `dd/mm/aaaa` de la fecha de una fuente, en la zona que le toca.
 *
 * Devuelve `''` si no hay fecha o no se puede leer — una fuente guardada antes de
 * que la columna existiera no tiene ninguna, y ahí es mejor no decir nada que
 * inventar un día.
 */
export function fechaDeFuente(
  valor: string | Date | undefined | null,
  tipo: TipoFuente
): string {
  if (!valor) return '';
  const d = valor instanceof Date ? valor : new Date(valor);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('es-MX', { timeZone: zonaDeFuente(d, tipo) });
}

/** El día de HOY en la zona del negocio, como `aaaa-mm-dd` para comparar. */
function hoyEnMexico(ahora: Date): string {
  // `en-CA` da `aaaa-mm-dd`, que se compara como texto sin líos de zona.
  return ahora.toLocaleDateString('en-CA', { timeZone: MX_TZ });
}

/** Los componentes del día, ya leídos en la zona correcta. */
export interface PartesDelDia { anio: number; mes: number; dia: number }

/**
 * 🔴 Devuelve `null` si no salen tres números, y NO es paranoia de más: quien
 * llama arma `dd/mm/aaaa` con esto, y sin la guarda un parseo fallido produce el
 * literal `"undefined/undefined/NaN"` — que `det()` estampa como
 * `origin: 'deterministic'`, o sea **una fecha inventada presentada como "del
 * expediente"** en un documento médico-legal. `fechaCalendario` en `prefill.ts`
 * ya se guardaba de exactamente esto.
 *
 * Se llega ahí con un runtime cuyo ICU no traiga `en-CA` (build small-icu,
 * `NODE_ICU_DATA` mal puesto): el formato cae a `M/D/YYYY` y el `split('-')` se
 * rompe. Y trivialmente con el siguiente que pase un `new Date(x)` sin validar.
 */
function partesEnZona(d: Date, zona: string): PartesDelDia | null {
  if (Number.isNaN(d.getTime())) return null;
  const partes = d.toLocaleDateString('en-CA', { timeZone: zona }).split('-').map(Number);
  if (partes.length !== 3 || partes.some((n) => !Number.isFinite(n))) return null;
  const [anio, mes, dia] = partes;
  return { anio, mes, dia };
}

/**
 * El día de la fecha de una FUENTE, en la zona que le toca — la misma regla que
 * `fechaDeFuente`, porque **delega en `zonaDeFuente`** en vez de repetirla.
 *
 * ⚠️ El `tipo` es obligatorio a propósito. Con la heurística de medianoche suelta
 * y un nombre genérico, esto invita a llamarlo con `nota.createdAt` — y una nota
 * creada justo a las 00:00Z se leería como día de calendario, que es lo que
 * `zonaDeFuente` evita al exigir además que la COLUMNA sea de calendario.
 *
 * Lo usa `prefill.ts`, que arma su propio `dd/mm/aaaa` con ceros a la izquierda:
 * lo que se comparte es **la decisión de la zona**, no el formato.
 */
export function partesDelDiaDeFuente(d: Date, tipo: TipoFuente): PartesDelDia | null {
  return partesEnZona(d, zonaDeFuente(d, tipo));
}

/**
 * El día de un INSTANTE de verdad (`new Date()`), siempre en la zona del negocio.
 *
 * 🔴 Para esto no hay heurística que valga: un instante se lee donde está el
 * negocio. Con el contenedor en UTC y componentes locales, a las 19:00 en CDMX ya
 * es el día siguiente y el informe se estampa con la fecha de MAÑANA.
 */
export function partesDelDiaEnMexico(d: Date): PartesDelDia | null {
  return partesEnZona(d, MX_TZ);
}

/** El día de una fecha de calendario, como `aaaa-mm-dd`. */
function diaDeCalendario(d: Date, tipo: TipoFuente): string {
  return d.toLocaleDateString('en-CA', { timeZone: zonaDeFuente(d, tipo) });
}

/**
 * 🔴 ¿La receta ya venció? Se comparan **DÍAS**, no instantes.
 *
 * `expiresAt` es un día del calendario (medianoche UTC) y `new Date()` es un
 * instante: compararlos directamente —que es lo que hacía -- declara vencida la
 * receta **6 horas antes**. Con `expiresAt = 2026-08-15T00:00:00Z`, a las 19:00
 * del **14** en CDMX ya daba `true`, y el modelo recibía "VENCIDA el 15/08" de una
 * receta que seguía vigente ese día. Es la MISMA mezcla de clases que este módulo
 * existe para impedir, cometida dentro del módulo.
 *
 * Vence AL EMPEZAR su día: `new Date("2026-08-15")` es el instante en que deja de
 * valer, así que el 15 en México ya está vencida y el 14 no.
 */
export function recetaVencidaEl(expiresAt: Date | null, ahora = new Date()): boolean {
  if (expiresAt === null) return false;
  return hoyEnMexico(ahora) >= diaDeCalendario(expiresAt, 'receta');
}
