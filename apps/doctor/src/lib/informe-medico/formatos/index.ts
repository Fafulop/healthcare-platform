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
 * alguien adivina la URL, lo que baja es una hoja **en blanco**. Nada de esto es
 * PHI.
 *
 * ⚠️ Y no todas son la hoja tal cual la publica la aseguradora: la de **Allianz**
 * es la oficial **con los campos que le pusimos nosotros** (`camposPropios`), así
 * que su `Producer` dice `pdf-lib`. Sigue siendo un formato en blanco, pero no es
 * el archivo de Allianz byte a byte y la fila lo declara (03-FORMATOS §5).
 */
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { PDFCheckBox, PDFDocument, PDFRadioGroup } from 'pdf-lib';
import { claveCruda, type FieldDict } from '../types';
import { DICT_AXA } from '../dicts/axa';
import { DICT_ALLIANZ, ETIQUETAS_ALLIANZ } from '../dicts/allianz';
import { DICT_GNP } from '../dicts/gnp';

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
   * `nombre del campo -> lo que dice la HOJA`, para los formatos cuyos nombres
   * inventamos nosotros (los planos).
   *
   * 🔴 Sin esto el asistente recibe `campo:p1_AAAA` y no puede elegirlo. En AXA
   * no hace falta: sus nombres los puso la aseguradora y se explican solos.
   */
  etiquetas?: Record<string, string>;
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
  {
    insurer: 'Allianz',
    name: 'GMM Informe Médico',
    // Allianz no imprime una clave de versión en la hoja como AXA
    // (`AI-346 FEBRERO 2022`). Se usa la fecha de creación del PDF oficial,
    // que es lo único estable que lo identifica: 2023-02-27.
    version: 'FEBRERO 2023',
    sourceUrl: 'https://componentes.allianz.com.mx/widget/web/guest/documentos',
    archivo: 'allianz-gmm-informe-medico-2023-02.pdf',
    dict: DICT_ALLIANZ,
    etiquetas: ETIQUETAS_ALLIANZ,
    // 🔴 El oficial viene PLANO (0 campos). Los 52 campos de texto y los 14
    // grupos de casillas se los pusimos nosotros con
    // `agregarCamposAFormatoPlano()`, así que este archivo ya no es el de
    // Allianz byte a byte y la fila lo declara (03-FORMATOS §5).
    camposPropios: true,
  },
  {
    insurer: 'GNP',
    name: 'Informe Médico GMM',
    // La clave impresa en la propia hoja, al pie de la p1: `402087SCinfmed_0217`
    // (febrero 2017). Es lo mismo que hace AXA con `AI-346 FEBRERO 2022`, y por
    // eso no se usa la fecha del PDF.
    version: '402087SCinfmed_0217',
    sourceUrl:
      'https://www.gnp.com.mx/content/dam/pp/mx/es/footer/blue-navigation/asistencia-y-contacto/servicios-en-linea/que-hacer-en-caso-de-siniestro/gastos-medicos-mayores/Informe-Medico-GMM-GNP.pdf',
    archivo: 'gnp-informe-medico-gmm-0217.pdf',
    dict: DICT_GNP,
    // El oficial YA trae sus 62 campos (55 de texto + 7 grupos de radio) puestos
    // por Adobe: el archivo es el de GNP byte a byte y no le agregamos nada.
    //
    // ⚠️ Es un archivo de PREPRENSA: mide 684×864 (carta + 36 pt de rebase),
    // trae marcas de registro en una capa encendida, y su página 1 lleva dentro
    // una copia INVISIBLE del arte de la página 2. Lo primero es cosmético y se
    // deja como GNP lo publica (03-FORMATOS §5); lo último obligó a filtrar por
    // capa antes de deducir cualquier etiqueta (`add-fields.ts`).
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
      // Y los RADIOS igual: el GNP oficial trae `Relación otro padecimiento`
      // preseleccionado. pdf.js dibuja la apariencia guardada, así que esa marca
      // saldría pintada en el lienzo debajo de un recuadro HTML vacío — visible,
      // imposible de desmarcar, y para la app nunca estuvo marcada.
      if (field instanceof PDFRadioGroup) {
        try { field.clear(); } catch { /* idem */ }
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

/**
 * Las etiquetas del formato, **por CLAVE** — que es como las busca
 * `camposDictables`, no por nombre de campo.
 *
 * 🔴 El mapa se escribe por nombre (`p1_AAAA`) porque es lo natural al leer la
 * hoja, pero el catálogo del modelo indexa por clave (`campo:p1_AAAA`). Sin
 * convertir, el merge no empata NADA y todo el trabajo de etiquetas es un no-op
 * silencioso: el modelo sigue viendo el nombre crudo y los contadores no se
 * mueven.
 *
 * Los campos que SÍ tienen concepto canónico (`paciente.nombres`) no llevan
 * prefijo y por lo tanto no se pisan: conservan su etiqueta del canónico, que
 * es la buena.
 */
export function etiquetasPorClave(formato: FormatoEnRepo): Record<string, string> {
  const salida: Record<string, string> = {};
  for (const [nombre, etiqueta] of Object.entries(formato.etiquetas ?? {})) {
    salida[claveCruda(nombre)] = etiqueta;
  }
  return salida;
}
