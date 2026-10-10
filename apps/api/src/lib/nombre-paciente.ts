/**
 * El nombre del paciente que llega al CREAR una cita, limpio: sin espacios en los extremos ni dobles por
 * dentro (también tabs y saltos de línea). Primero se colapsan y LUEGO se recorta — al revés, « \t» al
 * final deja un espacio (pasó en la limpieza de la BD del 2026-10-10).
 *
 * El agente y la página pública mandan el nombre tal como se escribió; 83 de 87 citas con espacios de
 * más venían de ahí. Es la misma regla que `limpiarNombrePropio` del expediente (apps/doctor). Lo que no
 * es texto pasa tal cual (la validación de cada ruta decide).
 */
export function limpiarNombre<T>(v: T): T | string {
  return typeof v === 'string' ? v.replace(/\s+/g, ' ').trim() : v;
}
