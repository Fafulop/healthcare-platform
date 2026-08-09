/**
 * QUÉ CAMPOS tiene un informe — la lista que comparten el visor y la pestaña
 * "Lista de campos".
 *
 * 🔴 Existe para que las dos vistas NO puedan discrepar. Ya pasó una vez: el
 * visor dibujaba los 60 del diccionario y el borrador descargado pintaba 266
 * blancos de azul. Si cada vista arma su propia lista, vuelven a separarse.
 */
import { geometriaDelFormato, type GeometriaFormato } from './geometria-formato';
import { leerPdfBase, type FormatoEnRepo } from './formatos';
import type { Answers, FieldDict } from './types';

/**
 * La geometría de un formato NO cambia: mismo PDF, mismo diccionario, mismas
 * cajas. Sin caché, cada `blur` en una hoja de 300 casillas volvía a leer el
 * PDF del disco y a parsear las 277 entradas del AcroForm, en una ruta que
 * además sirve PHI.
 *
 * La clave incluye el `updatedAt` de la fila para que editar el `field_dict` en
 * la BD invalide la entrada sola — que es justo el camino de "corregir un mapeo
 * sin desplegar" que el diseño ofrece.
 */
const cache = new Map<string, GeometriaFormato>();

export async function geometriaCacheada(
  formato: FormatoEnRepo,
  dict: FieldDict,
  version: string
): Promise<GeometriaFormato | null> {
  const clave = `${formato.insurer}|${formato.name}|${formato.version}|${version}`;
  const guardada = cache.get(clave);
  if (guardada) return guardada;
  try {
    const geo = await geometriaDelFormato(await leerPdfBase(formato), dict);
    cache.set(clave, geo);
    return geo;
  } catch {
    // No se pudo leer el PDF: el informe se sigue abriendo con las claves del
    // diccionario. Perder la hoja no debe impedir llenar y emitir.
    return null;
  }
}

/**
 * Las claves que el informe debe OFRECER, en orden estable.
 *
 * Es la UNIÓN de tres cosas, y las tres hacen falta:
 *
 *  1. **Las cajas de la hoja** — todo blanco del formato, mapeado o no.
 *  2. **Las claves del diccionario** — 🔴 sin esto, un formato con la página
 *     rotada (donde la geometría devuelve CERO cajas a propósito, para no
 *     dibujar en el renglón equivocado) dejaba al doctor con la lista VACÍA y
 *     un "0 de 0 campos", aunque el pre-llenado ya tuviera datos.
 *  3. **Lo que ya está en `answers`** — un campo que existía cuando se guardó y
 *     hoy no (el diccionario derivó, o cambió la versión del formato) seguiría
 *     escribiéndose en el PDF pero sería invisible e ineditable en la UI.
 */
export function clavesDelInforme(
  geo: GeometriaFormato | null,
  dict: FieldDict,
  answers: Answers
): string[] {
  const vistas = new Set<string>();
  for (const c of geo?.cajas ?? []) vistas.add(c.clave);
  for (const clave of Object.keys(dict)) vistas.add(clave);
  for (const clave of Object.keys(answers)) vistas.add(clave);
  return [...vistas];
}
