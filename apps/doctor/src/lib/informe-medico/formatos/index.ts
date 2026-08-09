/**
 * INFORME MÉDICO — el catálogo de formatos de v1.
 *
 * Los formatos oficiales son **de plataforma, no de cada doctor** (02-PLAN §4),
 * y su destino final es la tabla `insurance_forms` con su `field_dict`, dada de
 * alta por un admin. Mientras esa pantalla no exista, el PDF base y el
 * diccionario viven en el repo y la fila de `insurance_forms` sólo guarda la
 * identidad (aseguradora · nombre · versión · procedencia) para que
 * `medical_reports.form_id` tenga a qué apuntar.
 *
 * 🔴 `formatoDe()` empata por la fila de la BD, no por un id inventado aquí: el
 * informe ya emitido tiene que seguir reproduciéndose con SU versión aunque la
 * aseguradora publique una hoja nueva (02-PLAN §4).
 *
 * ⚠️ El PDF vive en `public/formatos/` a propósito. Es la única carpeta que se
 * despliega con garantía en cualquier modo de build de Next; `src/` no. Se lee
 * del disco con `fs` (nunca por HTTP) y no se enlaza desde la UI — aunque si
 * alguien adivina la URL, lo que baja es la hoja **en blanco** que AXA ya publica
 * en su propio sitio. Nada de esto es PHI.
 */
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { PDFCheckBox, PDFDocument } from 'pdf-lib';
import type { FieldDict } from '../types';
import { DICT_AXA } from '../dicts/axa';

export interface FormatoEnRepo {
  insurer: string;
  name: string;
  version: string;
  /** De dónde se bajó el PDF. Regla de 03-FORMATOS: del dominio de la aseguradora. */
  sourceUrl: string;
  /** Archivo dentro de `public/formatos/`. */
  archivo: string;
  dict: FieldDict;
  /**
   * `true` si los campos rellenables se los pusimos nosotros (Allianz), `false`
   * si el PDF oficial ya venía con AcroForm (AXA). Va a
   * `insurance_forms.fields_added_by_us`.
   */
  camposPropios: boolean;
}

/**
 * Los formatos que v1 sabe generar. La clave es `insurer|name|version`, que es
 * exactamente la unique de `insurance_forms`.
 */
export const FORMATOS: FormatoEnRepo[] = [
  {
    insurer: 'AXA',
    name: 'GMM Informe Médico',
    version: 'AI-346 FEBRERO 2022',
    sourceUrl: 'https://axa.mx/',
    archivo: 'axa-gmm-informe-medico-2022-02.pdf',
    dict: DICT_AXA,
    camposPropios: false,
  },
];

/** La clave compuesta con la que se empata una fila de `insurance_forms`. */
export function claveFormato(f: { insurer: string; name: string; version: string }): string {
  return `${f.insurer}|${f.name}|${f.version}`;
}

/**
 * El formato del repo que corresponde a una fila de `insurance_forms`.
 *
 * `undefined` significa que la BD conoce un formato que este build no sabe
 * generar — pasa si alguien da de alta una versión nueva antes de que el
 * diccionario llegue al repo. Se devuelve el vacío explícito para que la ruta
 * conteste un error claro en vez de generar un PDF a medias.
 */
export function formatoDe(fila: { insurer: string; name: string; version: string }): FormatoEnRepo | undefined {
  return FORMATOS.find((f) => claveFormato(f) === claveFormato(fila));
}

/** El PDF base, leído del disco. */
export async function leerPdfBase(formato: FormatoEnRepo): Promise<Uint8Array> {
  const ruta = path.join(process.cwd(), 'public', 'formatos', formato.archivo);
  return new Uint8Array(await readFile(ruta));
}

/**
 * La hoja para MOSTRAR en el visor, con las casillas apagadas.
 *
 * 🔴 La hoja "en blanco" de AXA trae 9 casillas marcadas de fábrica. pdf.js
 * dibuja la apariencia guardada de cada widget, así que esas marcas salían
 * pintadas en el lienzo — debajo de una casilla HTML vacía. El doctor veía una
 * opción marcada que él no eligió y que la app no podía desmarcar, porque para
 * la app nunca estuvo marcada.
 *
 * Es sólo para el fondo del visor; el llenado real lo normaliza `render-pdf`.
 */
export async function leerPdfBaseParaVisor(formato: FormatoEnRepo): Promise<Uint8Array> {
  const bytes = await leerPdfBase(formato);
  try {
    const pdf = await PDFDocument.load(bytes);
    const form = pdf.getForm();
    for (const field of form.getFields()) {
      if (field instanceof PDFCheckBox) {
        try { field.uncheck(); } catch { /* una casilla terca no debe tumbar el visor */ }
      }
    }
    form.updateFieldAppearances();
    return await pdf.save();
  } catch {
    // Si no se puede normalizar, mejor la hoja tal cual que ninguna hoja.
    return bytes;
  }
}

/**
 * El diccionario que se usa para ESTE informe.
 *
 * **La fila de `insurance_forms` manda**: es donde el diseño dice que vive el
 * diccionario (04-MAPEO §1) y es lo que permitirá corregir un mapeo sin
 * desplegar. El del repo es la SEMILLA con la que se dio de alta la fila, y sólo
 * se usa cuando la fila trae `{}` — es decir, cuando nadie la ha sembrado.
 *
 * 🔴 Se decide con una sola regla y explícita. Tener dos diccionarios y
 * "preferir el que se vea mejor" es cómo terminan divergiendo en silencio y el
 * informe sale llenando campos distintos según por dónde se generó.
 */
export function dictParaRender(formato: FormatoEnRepo, fieldDictDeLaFila: unknown): FieldDict {
  if (
    typeof fieldDictDeLaFila === 'object' &&
    fieldDictDeLaFila !== null &&
    !Array.isArray(fieldDictDeLaFila) &&
    Object.keys(fieldDictDeLaFila).length > 0
  ) {
    const dict: FieldDict = {};
    for (const [k, v] of Object.entries(fieldDictDeLaFila as Record<string, unknown>)) {
      if (typeof v === 'string') dict[k] = v;
    }
    return dict;
  }
  return formato.dict;
}
