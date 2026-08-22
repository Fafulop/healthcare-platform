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
import { DICT_VEPORMAS } from '../dicts/vepormas';
import { DICT_METLIFE, ETIQUETAS_METLIFE } from '../dicts/metlife';
import { DICT_SURA, ETIQUETAS_SURA, OPCIONES_DE_TEXTO_SURA } from '../dicts/sura';

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
   * 🔴 Opciones EXCLUYENTES que la hoja implementa como campos de TEXTO de un
   * carácter (se contesta con una «X»), no como casillas.
   *
   * Una casilla de verdad es **un campo con un valor**, así que el PDF garantiza
   * por estructura que sólo una opción quede marcada. Estas no: son N campos
   * independientes, y nada impide que queden marcadas dos — o el `Sí` y el `No`
   * de la misma pregunta, que le afirma a la aseguradora las dos cosas.
   *
   * Declararlas aquí es lo que permite al SERVIDOR imponer la exclusividad
   * (regla 0). `casillasParaElAgente()` no las alcanza: filtra casillas, y para
   * el motor esto es texto.
   */
  opcionesDeTexto?: Array<{ pregunta: string; campos: string[] }>;
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
  {
    insurer: 'Ve por Más',
    name: 'GMM Informe Médico',
    // La clave impresa en la hoja y en el nombre del archivo que publica la
    // aseguradora: `SM008`. Mismo criterio que AXA y GNP — la clave de la hoja
    // manda sobre la fecha del PDF (creado 2017-04-21, modificado 2021-02-25).
    version: 'SM008',
    sourceUrl: 'https://www.vepormas.com/fwpf/storage/02_informe_medico_GMM_SM008.pdf',
    archivo: 'vepormas-gmm-informe-medico-sm008.pdf',
    dict: DICT_VEPORMAS,
    // El oficial YA trae sus 113 campos (86 de texto + 27 grupos de una casilla)
    // puestos por la aseguradora, y sus nombres se explican solos: no hace falta
    // mapa de `etiquetas`. El archivo es el de Ve por Más byte a byte.
    //
    // ⚠️ Esta hoja rotula sus recuadros por la IZQUIERDA, al revés que AXA,
    // Allianz y GNP. No hay nada que declarar aquí —el lado se MIDE— pero es la
    // hoja que destapó que "a la derecha" era una coincidencia (08-ALTA §7d).
    camposPropios: false,
  },
  {
    insurer: 'MetLife',
    name: 'Informe Médico',
    // La clave impresa al pie de la hoja: `CC-1-020 VER. 5`. Como AXA y GNP, la
    // clave de la aseguradora manda sobre la fecha del PDF (2022-06-08).
    version: 'CC-1-020 VER5',
    sourceUrl: 'https://www.metlife.com.mx/content/dam/metlifecom/mx/pdfs/common-files/CC-1-020-VER5.pdf',
    archivo: 'metlife-informe-medico-cc-1-020-ver5.pdf',
    dict: DICT_METLIFE,
    // 🔴 SÍ necesita mapa de etiquetas aunque los campos los haya puesto la
    // aseguradora: la hoja tiene CUATRO bloques de médico (§6 equipo quirúrgico
    // + §7 el tratante) y sus campos se llaman `Nombre completo_2/_3/_4` sin
    // decir de quién son. Sin esto el modelo ve cuatro `Nombre completo`
    // idénticos. Es el caso que 08-ALTA §7b describe para los formatos PLANOS,
    // aquí por una razón distinta: los nombres existen y no distinguen.
    etiquetas: ETIQUETAS_METLIFE,
    // El oficial ya trae sus 164 campos (133 texto + 31 grupos de UNA casilla).
    // El archivo es el de MetLife byte a byte.
    //
    // ⚠️ Rotula por la IZQUIERDA (08-ALTA §7d) y parte TODAS sus fechas en tres
    // cajas (`D3`/`M3`/`A3`, maxLength 2/2/4), que el diccionario 1:1 no sabe
    // llenar — las teclea el médico.
    camposPropios: false,
  },
  {
    insurer: 'SURA',
    name: 'Informe Médico',
    // La hoja no imprime clave de versión; se usa la fecha de creación del PDF
    // oficial (2025-01-28), como se hizo con Allianz.
    version: 'ENERO 2025',
    sourceUrl: 'https://www.segurossura.com.mx/wp-content/uploads/2025/03/Informe-Medico-SURA.pdf',
    archivo: 'sura-informe-medico-2025-01.pdf',
    dict: DICT_SURA,
    // 🔴 Imprescindible aquí: **13 campos de TEXTO con `maxLength = 1`
    // funcionan como casillas** (se contesta con una «X»), y por ser texto
    // `casillasParaElAgente()` NO los filtra. Sin el mapa, `Si`/`No_3` llegan
    // al modelo sin decir que son «¿Hubo complicaciones?», y `Cirujano` y
    // `Cirujano_2` (Médico 1 y Médico 2) sólo se distinguen por el `_2`.
    etiquetas: ETIQUETAS_SURA,
    // 🔴 La exclusividad de esas opciones la impone el SERVIDOR, no el prompt.
    opcionesDeTexto: OPCIONES_DE_TEXTO_SURA,
    // El oficial ya trae sus 106 campos (82 texto + 24 casillas). El archivo es
    // el de SURA byte a byte.
    //
    // ⚠️ De esas 24 casillas, **23 son de UNA sola opción** —que la regla 2 de
    // `casillasParaElAgente` bloquea, porque el modelo sólo podría MARCAR y
    // nunca negar— así que `Group1`, con sus DOS recuadros, es la ÚNICA que el
    // asistente ve. (No es un radio: esta hoja no trae ni uno; es un
    // `PDFCheckBox` con dos widgets.) Por eso el catálogo de casillas de SURA
    // llega casi vacío al chat y las preguntas de verdad viajan por
    // `opcionesDeTexto`.
    //
    // ⚠️ Trae 3 opciones MARCADAS de fábrica (`Embarazo`, `Más de 2 años` y
    // `Group1`): las apaga `normalizarCasillas` al renderizar y
    // `leerPdfBaseParaVisor` al mostrarlas, igual que las 9 de AXA.
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

/**
 * Los grupos excluyentes de `opcionesDeTexto`, ya en forma de CLAVE.
 *
 * 🔴 Existe por **regla 0**: en una hoja cuyas opciones son cajas de texto, la
 * exclusividad no la da la estructura del PDF (una casilla de verdad es UN campo
 * con un valor) sino nuestra declaración. Sin esto, lo único que impide marcar
 * `Sí` **y** `No` de la misma pregunta es una frase del prompt — y un veredicto
 * que sólo sostiene la prosa del prompt no es un veredicto, es una esperanza.
 */
export function gruposExcluyentesPorClave(formato: FormatoEnRepo): string[][] {
  return (formato.opcionesDeTexto ?? []).map((g) => g.campos.map((n) => claveCruda(n)));
}
