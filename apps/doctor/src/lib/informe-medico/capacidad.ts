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
 * Tope de tamaño de letra al imprimir. Ver `acotarTamanosDeLetra` en
 * `render-pdf.ts`: sin él, una palabra corta en una caja grande sale a 56 pt.
 * 11 pt es lo que ya producían las cajas de una línea.
 */
export const PT_MAXIMO = 11;

/**
 * Ancho medio de un carácter como fracción del tamaño de letra, en Helvetica.
 * 0.5 es el promedio habitual para minúsculas y dígitos; los formatos usan
 * Helvetica/Arial, así que sirve para dimensionar.
 */
const ANCHO_POR_PUNTO = 0.5;

/** Interlineado que aplica pdf-lib en los campos multilínea. */
const INTERLINEADO = 1.15;

/**
 * Caracteres de tolerancia antes de gritar. El cálculo es una aproximación
 * (0.5 de ancho medio); sin holgura, un texto que renderiza justo en el mínimo
 * legible se reporta como ilegible y el aviso pierde credibilidad.
 */
const HOLGURA = 1;

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
  // 🔴 Un widget de ancho o alto <= 0 (muñones ocultos, o un `/Rect` con las
  // esquinas invertidas, que pdf-lib devuelve como ancho negativo) NO se puede
  // medir. Antes el `Math.max(1, …)` lo dejaba en "cabe 1 carácter" y cualquier
  // texto de 2+ quedaba marcado como ilegible PARA SIEMPRE, sin que el doctor
  // pudiera hacer nada. Se declara inmensurable y no se avisa nada.
  if (!(ancho > 0) || !(alto > 0)) return { maximo: Infinity, excede: false, sobran: 0 };

  const porRenglon = Math.max(1, Math.floor(ancho / (PT_MINIMO_LEGIBLE * ANCHO_POR_PUNTO)));
  const renglones = multilinea
    ? Math.max(1, Math.floor(alto / (PT_MINIMO_LEGIBLE * INTERLINEADO)))
    : 1;
  const maximo = porRenglon * renglones;
  // 🔴 `>` y no `>=`: el caso calibrado (`cuarenta y seis`, 15 caracteres en la
  // caja de 43 pt) renderiza a 6 pt EXACTOS — el mínimo legible, no por debajo.
  // Marcarlo como problema sería avisar de algo que sí se lee, y el aviso que
  // salta de más es el que enseña a ignorarlo. Se tolera un carácter de holgura.
  const sobran = Math.max(0, largo - (maximo + HOLGURA));
  return { maximo, excede: sobran > 0, sobran };
}
