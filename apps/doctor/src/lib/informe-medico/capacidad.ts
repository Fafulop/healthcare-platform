/**
 * ¿CABE este texto en su casilla, de forma LEGIBLE?
 *
 * 🔴 `pdf-lib` nunca recorta: cuando el texto no cabe, **encoge la letra** y la
 * deja desbordar. Medido sobre el AXA oficial, campo `Edad` (43×14 pt):
 *
 *   `46`                       -> 10 pt   legible
 *   `cuarenta y seis`          ->  6 pt   al límite
 *   40 caracteres              ->  3 pt   ILEGIBLE
 *   109 caracteres             ->  3 pt   imposible en 43 pt: se sale de la caja
 *
 * Una aseguradora que recibe un dato en 3 pt lo lee mal o rechaza la hoja, y hoy
 * eso pasa **sin ninguna señal**. Tecleando salen entradas cortas; **dictando
 * salen párrafos** (05-VOZ §10.2), así que esto deja de ser el borde y pasa a ser
 * lo normal.
 *
 * El cálculo es una APROXIMACIÓN a propósito: sólo hace falta contestar "¿esto
 * necesita menos de la letra mínima legible?", no maquetar. Se usa el mismo
 * helper en el visor (aviso en vivo) y en el render (reporte), para que las dos
 * superficies digan lo mismo.
 */

/** Debajo de esto no se considera legible en papel. */
export const PT_MINIMO_LEGIBLE = 6;

/**
 * Ancho medio de un carácter como fracción del tamaño de letra, en Helvetica.
 * 0.5 es el promedio habitual para minúsculas y dígitos; los formatos usan
 * Helvetica/Arial, así que sirve para dimensionar.
 */
const ANCHO_POR_PUNTO = 0.5;

/** Interlineado que aplica pdf-lib en los campos multilínea. */
const INTERLINEADO = 1.15;

export interface Capacidad {
  /** Cuántos caracteres caben a `PT_MINIMO_LEGIBLE`. */
  maximo: number;
  /** `true` si el texto necesitaría letra más chica que la mínima legible. */
  excede: boolean;
  /** Cuántos caracteres sobran. 0 si cabe. */
  sobran: number;
}

/**
 * Cuánto texto admite una caja antes de volverse ilegible.
 *
 * @param ancho  ancho del widget en puntos
 * @param alto   alto del widget en puntos
 * @param multilinea si el campo admite varios renglones
 * @param largo  cuántos caracteres se quieren meter
 */
export function capacidadDeCaja(
  ancho: number,
  alto: number,
  multilinea: boolean,
  largo: number
): Capacidad {
  const porRenglon = Math.max(1, Math.floor(ancho / (PT_MINIMO_LEGIBLE * ANCHO_POR_PUNTO)));
  const renglones = multilinea
    ? Math.max(1, Math.floor(alto / (PT_MINIMO_LEGIBLE * INTERLINEADO)))
    : 1;
  const maximo = porRenglon * renglones;
  const sobran = Math.max(0, largo - maximo);
  return { maximo, excede: sobran > 0, sobran };
}
