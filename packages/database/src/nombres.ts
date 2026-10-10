/**
 * El nombre de una PERSONA, limpio: sin espacios en los extremos ni dobles por dentro (también tabs y
 * saltos de línea). Primero se colapsan y LUEGO se recorta — al revés, « \t» al final deja un espacio
 * (pasó en la limpieza de la BD del 2026-10-10).
 *
 * Es LA regla de la plataforma para nombres (2026-10-10, análisis completo en
 * docs/DESDE JUNIO/VISITAS/SESSION-REFRESCO.md, «nombres limpios»): se aplica en cada PUNTO DE ENTRADA
 * de texto libre — alta/edición del expediente, importación de Excel, creación de la cita (nombre
 * completo y separado), reseñas y su link, y el movimiento manual de Flujo. Las copias que se arman
 * desde un valor ya limpio salen limpias solas. NO se aplica a la razón social ni a los nombres de los
 * CFDI: son datos legales del SAT y van tal cual.
 *
 * Lo que no es texto pasa tal cual (la validación de cada ruta decide).
 */
export function limpiarNombre<T>(v: T): T | string {
  return typeof v === 'string' ? v.replace(/\s+/g, ' ').trim() : v;
}
