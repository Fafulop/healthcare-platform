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
 *
 * La sección la decide el SERVIDOR, no el modelo: el modelo copia la frase del manual en la
 * que se basa (`cita`) y aquí se busca en qué sección está. gpt-4o-mini dejaba `seccion`
 * vacía en las respuestas «no se puede» y citaba la tabla-resumen vecina en vez de la
 * sección con el dato (12 de 18 bien, 2026-09-23); copiar una frase le cuesta menos que
 * clasificarla, y una frase que no está en el manual se detecta. `seccion` del modelo queda
 * como respaldo, validada como antes.
 */

import { esRutaDelMapa, etiquetaDeRuta } from './mapa-de-rutas';
import type { Manual } from './manual';

export interface EnlaceAyuda {
  ruta: string;
  etiqueta: string;
}

export interface RespuestaAyuda {
  respuesta: string;
  /** "Área > Sección", sólo si existe en el manual. */
  seccion: string | null;
  /**
   * La frase del manual que citó el modelo, sólo si SÍ está en el manual. No se le enseña al
   * doctor: viaja de vuelta en la historia para que el modelo vea turnos que citan y siga
   * citando (imita sus propios turnos anteriores — hallazgo 3 del review de la Fase 2).
   */
  cita: string | null;
  enlaces: EnlaceAyuda[];
  /** Lo que se tiró por no existir — para el log, no para el doctor. */
  descartado: { seccion: string | null; enlaces: string[]; cita: string | null };
}

const MAX_ENLACES = 2;

/** Compara "Agenda > Reagendar una cita" sin que un espacio o una mayúscula la invaliden. */
function normalizar(s: string): string {
  return s.replace(/\s+/g, ' ').replace(/\s*>\s*/g, ' > ').trim().toLowerCase();
}

/**
 * Para buscar una frase citada dentro del manual sin que el formato la invalide: el modelo
 * copia el texto como lo LEERÍA el doctor — sin negritas, comillas «», `|` de tabla, sintaxis de
 * enlace `[texto](#ancla)`, viñetas ni números de paso, y sin respetar los saltos de línea.
 */
function normalizarTexto(s: string): string {
  return s
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/^\s*>\s?/gm, '')
    .replace(/^\s*(?:\d+\.|[-*])\s+/gm, '')
    .replace(/…/g, '...')
    .replace(/\*\*|[«»"“”`]|⚠️/g, '')
    .replace(/\|/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/[.:;,]+$/, '')
    .toLowerCase();
}

/** Una frase más corta («No», «Agendada») aparece en demasiadas secciones para decidir. */
const MIN_CARACTERES_CITA = 12;
/**
 * Para CORREGIR una sección válida que dio el modelo hace falta más: «pide confirmación» (17)
 * está en «Cancelar…» y movería una respuesta de Reagendar a esa sección. Con 25+ la frase ya
 * es lo bastante propia de un lugar.
 */
const MIN_CARACTERES_PARA_CORREGIR = 25;

/** El texto normalizado de cada sección (y de sus filas de tabla), calculado una sola vez. */
const normalizados = new WeakMap<object, { texto: string; filas: string[] }>();
function normalizado(b: { texto: string }) {
  let n = normalizados.get(b);
  if (!n) {
    n = {
      texto: normalizarTexto(b.texto),
      filas: b.texto.split(/\r?\n/).filter((l) => l.includes('|')).map(normalizarTexto),
    };
    normalizados.set(b, n);
  }
  return n;
}

/**
 * ¿Está la frase en esta sección? Una fila de tabla («| Emitida | Ya no se puede editar |») el
 * modelo la copia resumida, sin las celdas de en medio: basta que CADA celda esté en un mismo
 * renglón de la tabla.
 */
function contiene(b: { texto: string }, cita: string): boolean {
  const n = normalizado(b);
  if (!cita.includes('|')) return n.texto.includes(normalizarTexto(cita));
  const celdas = cita.split('|').map(normalizarTexto).filter(Boolean);
  return celdas.length > 0 && n.filas.some((f) => celdas.every((c) => f.includes(c)));
}

/** Las secciones que contienen la frase; `null` si es demasiado corta para buscarla. */
function seccionesConLaFrase(frase: string, manual: Pick<Manual, 'bloques'>): string[] | null {
  if (normalizarTexto(frase).length < MIN_CARACTERES_CITA) return null;
  return manual.bloques.filter((b) => contiene(b, frase)).map((b) => b.seccion);
}

/**
 * Qué sección decide una cita VERIFICADA. Sólo decide cuando no es ambigua: si la frase vive
 * en varias secciones y el modelo no dijo ninguna de ellas, elegir la primera premiaría a la
 * tabla-resumen, que va antes que las secciones con el detalle — el error que esto arregla.
 */
function seccionPorLaCita(halladas: string[], delModelo: string | null, cita: string): string | null {
  if (delModelo && halladas.includes(delModelo)) return delModelo;
  if (halladas.length !== 1) return null;
  if (!delModelo) return halladas[0];
  return normalizarTexto(cita).length >= MIN_CARACTERES_PARA_CORREGIR ? halladas[0] : null;
}

/** Una oración de la respuesta más corta que esto no dice de qué sección salió. */
const MIN_CARACTERES_ORACION = 30;

/**
 * Último recurso, cuando el modelo no dio ni cita ni sección: si una oración de la RESPUESTA
 * está tal cual en UNA sola sección del manual, de ahí salió. (gpt-4o-mini contestaba «Hoy no
 * hay un botón para reactivar…» —la frase exacta del manual— con `seccion: null`.)
 */
function seccionDeLaRespuesta(respuesta: string, manual: Pick<Manual, 'bloques'>): string | null {
  const oraciones = respuesta
    .split(/(?<=[.!?])\s+|\n+/)
    .filter((o) => normalizarTexto(o).length >= MIN_CARACTERES_ORACION);
  for (const o of oraciones) {
    const halladas = seccionesConLaFrase(o, manual);
    if (halladas?.length === 1) return halladas[0];
  }
  return null;
}

/** El modelo a veces escribe el string "null" en vez de null. */
function textoONull(v: unknown): string | null {
  if (typeof v !== 'string') return null;
  const t = v.trim();
  return t && t.toLowerCase() !== 'null' ? t : null;
}

function pareceJson(texto: string): boolean {
  return /^\s*(```(json)?\s*)?\{/.test(texto) || /"respuesta"\s*:/.test(texto);
}

/** El valor de "respuesta" de un JSON que no parsea: hasta la siguiente llave o hasta el final. */
function rescatarRespuesta(texto: string): string {
  const m = /"respuesta"\s*:\s*"([\s\S]*?)(?:"\s*,\s*"(?:cita|seccion|enlaces)"|"\s*\}|$)/.exec(texto);
  if (!m) return '';
  return m[1]
    .replace(/\\n/g, '\n')
    .replace(/\\"/g, '"')
    .replace(/\\\\/g, '\\')
    .replace(/"\s*$/, '')
    .trim();
}

export function interpretarRespuesta(
  texto: string,
  manual: Pick<Manual, 'secciones' | 'bloques'>
): RespuestaAyuda {
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
      cita: null,
      enlaces: [],
      descartado: { seccion: null, enlaces: [], cita: null },
    };
  }

  const obj = (crudo ?? {}) as Record<string, unknown>;
  const respuesta = typeof obj.respuesta === 'string' ? obj.respuesta.trim() : '';

  // La que dijo el modelo, sólo si existe.
  let seccionDelModelo: string | null = null;
  let seccionDescartada: string | null = null;
  const dijo = textoONull(obj.seccion);
  if (dijo) {
    const real = manual.secciones.find((s) => normalizar(s) === normalizar(dijo));
    if (real) seccionDelModelo = real;
    else seccionDescartada = dijo;
  }

  // La frase citada: si no está en el manual, se tira (y se loguea); si está, decide la
  // sección cuando no es ambigua. Una demasiado corta no se busca — ni cuenta como inventada.
  const cita = textoONull(obj.cita);
  const halladas = cita ? seccionesConLaFrase(cita, manual) : null;
  const citaVerificada = cita && halladas && halladas.length > 0 ? cita : null;
  const citaDescartada = cita && halladas && halladas.length === 0 ? cita : null;
  const seccionCitada =
    citaVerificada && halladas ? seccionPorLaCita(halladas, seccionDelModelo, citaVerificada) : null;
  const seccion = seccionCitada ?? seccionDelModelo ?? seccionDeLaRespuesta(respuesta, manual);

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
    cita: citaVerificada,
    enlaces: enlaces.slice(0, MAX_ENLACES),
    descartado: { seccion: seccionDescartada, enlaces: enlacesDescartados, cita: citaDescartada },
  };
}
