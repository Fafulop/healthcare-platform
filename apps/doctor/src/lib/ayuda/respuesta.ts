/**
 * Convierte la salida del modelo en lo que ve el doctor, y VERIFICA lo verificable.
 *
 * El prompt pide citar la sección y enlazar sólo rutas del mapa, pero pedirlo no lo
 * garantiza. Aquí se comprueba contra la fuente, en el servidor:
 *   · una `seccion` que no existe en el manual se tira (queda null) — una cita inventada
 *     se ve igual de segura que una real;
 *   · un enlace que no está en `MAPA_DE_RUTAS` se tira — sería un 404 dicho con confianza.
 * Se DESCARTA el elemento inválido y se conserva el resto: rechazar la respuesta entera
 * por un enlace malo dejaría al doctor sin la parte buena.
 */

import { esRutaDelMapa, etiquetaDeRuta } from './mapa-de-rutas';

export interface EnlaceAyuda {
  ruta: string;
  etiqueta: string;
}

export interface RespuestaAyuda {
  respuesta: string;
  /** "Área > Sección", sólo si existe en el manual. */
  seccion: string | null;
  enlaces: EnlaceAyuda[];
  /** Lo que se tiró por no existir — para el log, no para el doctor. */
  descartado: { seccion: string | null; enlaces: string[] };
}

const MAX_ENLACES = 2;

/** Compara "Agenda > Reagendar una cita" sin que un espacio o una mayúscula la invaliden. */
function normalizar(s: string): string {
  return s.replace(/\s+/g, ' ').replace(/\s*>\s*/g, ' > ').trim().toLowerCase();
}

function pareceJson(texto: string): boolean {
  return /^\s*(```(json)?\s*)?\{/.test(texto) || /"respuesta"\s*:/.test(texto);
}

/** El valor de "respuesta" de un JSON que no parsea: hasta la siguiente llave o hasta el final. */
function rescatarRespuesta(texto: string): string {
  const m = /"respuesta"\s*:\s*"([\s\S]*?)(?:"\s*,\s*"(?:seccion|enlaces)"|"\s*\}|$)/.exec(texto);
  if (!m) return '';
  return m[1]
    .replace(/\\n/g, '\n')
    .replace(/\\"/g, '"')
    .replace(/\\\\/g, '\\')
    .replace(/"\s*$/, '')
    .trim();
}

export function interpretarRespuesta(texto: string, secciones: string[]): RespuestaAyuda {
  let crudo: unknown;
  try {
    // Claude a veces envuelve el JSON en ```json … ```: se toma del primer { al último }.
    const inicio = texto.indexOf('{');
    const fin = texto.lastIndexOf('}');
    crudo = JSON.parse(inicio >= 0 && fin > inicio ? texto.slice(inicio, fin + 1) : texto);
  } catch {
    // Sin JSON válido no hay cita ni enlaces que verificar. Lo que NO se hace es enseñar el
    // texto crudo si ES un JSON roto (respuesta cortada por max_tokens, o un salto de línea
    // literal dentro del string): el doctor vería `{"respuesta": "1. Abre…` con llaves y
    // comillas. Se rescata el valor de `respuesta`; si no se puede, va vacío y la ruta
    // contesta "no pude generar una respuesta" en vez de basura.
    return {
      respuesta: pareceJson(texto) ? rescatarRespuesta(texto) : texto.trim(),
      seccion: null,
      enlaces: [],
      descartado: { seccion: null, enlaces: [] },
    };
  }

  const obj = (crudo ?? {}) as Record<string, unknown>;
  const respuesta = typeof obj.respuesta === 'string' ? obj.respuesta.trim() : '';

  let seccion: string | null = null;
  let seccionDescartada: string | null = null;
  if (typeof obj.seccion === 'string' && obj.seccion.trim()) {
    const buscada = normalizar(obj.seccion);
    const real = secciones.find((s) => normalizar(s) === buscada);
    if (real) seccion = real;
    else seccionDescartada = obj.seccion;
  }

  const enlaces: EnlaceAyuda[] = [];
  const enlacesDescartados: string[] = [];
  if (Array.isArray(obj.enlaces)) {
    for (const e of obj.enlaces) {
      if (typeof e !== 'string') continue;
      const ruta = e.trim();
      if (esRutaDelMapa(ruta)) {
        if (!enlaces.some((x) => x.ruta === ruta)) enlaces.push({ ruta, etiqueta: etiquetaDeRuta(ruta) });
      } else {
        enlacesDescartados.push(ruta);
      }
    }
  }

  return {
    respuesta,
    seccion,
    enlaces: enlaces.slice(0, MAX_ENLACES),
    descartado: { seccion: seccionDescartada, enlaces: enlacesDescartados },
  };
}
