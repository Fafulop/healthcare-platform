/**
 * INFORME MÉDICO — dónde cae cada campo en la hoja.
 *
 * Es lo que permite dibujar las cajas de captura ENCIMA del formato real: el
 * navegador pinta la página del PDF y coloca un `<input>` sobre cada blanco.
 *
 * 🔴 Las coordenadas van tal cual las da el PDF: origen **abajo-izquierda** y en
 * PUNTOS. El navegador dibuja desde **arriba-izquierda** y en píxeles. La
 * conversión se hace en el cliente, que es quien conoce la escala del render, y
 * está en UN solo lugar (`InformeVisor`). Repartirla es cómo se acaba con la
 * mitad de las cajas volteadas.
 */
import { PDFCheckBox, PDFDocument, PDFName, PDFRadioGroup, PDFTextField } from 'pdf-lib';
import { claveCruda, type FieldDict } from './types';

export interface CajaCampo {
  /** Clave canónica: con esto el visor sabe qué respuesta va aquí. */
  clave: string;
  /** Nombre del campo AcroForm — sólo para diagnosticar. */
  nombrePdf: string;
  /** 0-based. */
  pagina: number;
  /** Coordenadas del PDF: origen abajo-izquierda, en puntos. */
  x: number;
  y: number;
  ancho: number;
  alto: number;
  tipo: 'texto' | 'casilla';
  /** El campo admite varios renglones: el visor pone un `<textarea>`. */
  multilinea: boolean;
  /**
   * Tope DURO de caracteres que declara el propio PDF (`/MaxLen`), si lo tiene.
   *
   * 🔴 No es lo mismo que la capacidad visual de `capacidadDeCaja`: aquélla dice
   * "a partir de aquí no se lee", ésta dice "`setText` LANZA". Las 7 cajas de
   * fecha de AXA lo declaran en 8 (`ddmmaaaa`) aunque midan para ~38.
   */
  maxLength?: number;
  /**
   * Sólo casillas: el estado "encendido" de ESTE recuadro (`M`, `A`, `On`…).
   *
   * 🔴 Las casillas de AXA no son booleanos independientes: son GRUPOS
   * mutuamente excluyentes. Un campo (`MAM`) tiene varios recuadros y cada uno
   * su propio on-state (`/M`, `/A`, `/E`, `/S`); el PDF guarda UN valor por
   * campo, y ese valor dice cuál recuadro está marcado. Sin esto, marcar uno
   * marcaba los cuatro y el PDF terminaba con la marca en el primero,
   * independientemente de cuál eligió el doctor.
   *
   * En un grupo de RADIO es lo mismo, y el on-state ES el valor de exportación
   * del recuadro (`Opción2` en GNP): por eso los dos tipos comparten camino.
   */
  onState?: string;
}

export interface GeometriaFormato {
  paginas: Array<{ ancho: number; alto: number }>;
  cajas: CajaCampo[];
  /** Campos del diccionario que no se pudieron ubicar. Nunca se callan: sin esto
   * el visor enseñaría una hoja a la que le faltan blancos y parecería completa. */
  sinUbicar: Array<{ clave: string; nombrePdf: string; motivo: string }>;
}

/**
 * Calcula la geometría de los campos que el diccionario mapea.
 *
 * Sólo se devuelven los del diccionario a propósito: son los que el informe
 * sabe llenar. Los otros ~220 campos de AXA se quedan como parte de la imagen
 * de fondo, que es exactamente lo que son hasta que alguien los mapee.
 */
/**
 * El nombre del estado ENCENDIDO de un recuadro: la clave de su `/AP /N` que no
 * es `/Off`. Es el valor que hay que ponerle al campo para que se marque ESTE
 * recuadro y no otro del mismo grupo.
 */
export function onStateDelWidget(
  widget: { getAppearances: () => { normal?: unknown } | undefined }
): string | undefined {
  const normal = widget.getAppearances()?.normal as
    | { dict?: Map<{ decodeText(): string }, unknown> }
    | undefined;
  if (!normal?.dict) return undefined;
  for (const k of normal.dict.keys()) {
    // 🔴 `decodeText()` y NO `asString()`. Un nombre del PDF escapa todo byte
    // fuera del ASCII imprimible, así que `Opción2` se guarda como `Opci#F3n2` y
    // `Sí` como `S#ED`. `asString()` devuelve ese literal escapado; el
    // `getOptions()` de un grupo de radio devuelve el texto ya decodificado.
    // Mezclarlos hace que el valor que guarda el visor no empate con ninguna
    // opción y la elección del médico se DESCARTE en silencio — medido sobre el
    // GNP oficial, cuyas 6 preguntas con acento fallaban todas.
    const nombre = k.decodeText();
    if (nombre !== 'Off') return nombre;
  }
  return undefined;
}

// `empataOpcion` vive en `types.ts`, que NO importa pdf-lib: el visor es un
// componente de cliente y también tiene que empatar. Se re-exporta desde aquí
// porque es donde se lee el on-state, y así los dos van juntos.
export { empataOpcion } from './types';

/**
 * El rectángulo de un widget, SIEMPRE con ancho y alto positivos.
 *
 * 🔴 Un `/Rect` del PDF se declara con DOS esquinas opuestas y el spec no exige
 * ningún orden: `[x1 y1 x2 y2]` con `y2 < y1` es perfectamente válido y describe
 * la misma caja. `pdf-lib` resta sin normalizar, así que devuelve **alto
 * negativo** — y entonces:
 *
 *   · el visor calcula `top = altoPagina - y - alto` y baja la caja |alto| pt, y
 *     le pone un `height` negativo que el navegador descarta ⇒ el campo queda
 *     invisible o corrido, y el doctor **no puede escribir en él**;
 *   · `capacidadDeCaja` lo trata como inmensurable y se lo salta ⇒ el campo
 *     nunca se revisa por legibilidad, en silencio;
 *   · el borrador pinta su recuadro de color |alto| pt más abajo.
 *
 * Medido en el GNP oficial: 4 widgets vienen así, uno de ellos el cuadro de
 * `Antecedentes perinatales` (318×−56). AXA y Allianz no traen ninguno, que es
 * por lo que nunca se había visto.
 */
export function rectDelWidget(widget: { getRectangle: () => { x: number; y: number; width: number; height: number } }): {
  x: number;
  y: number;
  ancho: number;
  alto: number;
} {
  const r = widget.getRectangle();
  return {
    x: Math.min(r.x, r.x + r.width),
    y: Math.min(r.y, r.y + r.height),
    ancho: Math.abs(r.width),
    alto: Math.abs(r.height),
  };
}

export async function geometriaDelFormato(
  pdfBase: Uint8Array | ArrayBuffer,
  dict: FieldDict
): Promise<GeometriaFormato> {
  const pdf = await PDFDocument.load(pdfBase);
  const form = pdf.getForm();
  const pages = pdf.getPages();

  const paginas = pages.map((p) => {
    const { width, height } = p.getSize();
    return { ancho: width, alto: height };
  });

  const cajas: CajaCampo[] = [];
  const sinUbicar: GeometriaFormato['sinUbicar'] = [];

  // 🔴 El cliente convierte con `top = altoDePagina - y - alto`, lo que asume
  // que la esquina inferior izquierda de la página es (0,0) y que NO está
  // rotada. pdf.js, en cambio, arma su viewport con el **CropBox** y aplica
  // `/Rotate`. Si un formato trae rotación o un CropBox desplazado, el lienzo y
  // las cajas se miden con reglas distintas y TODAS caen en el lugar
  // equivocado — sin ningún error. AXA está limpio (rot 0, crop == media, en
  // las 6 páginas), pero Allianz y GNP siguen sin verificarse.
  const sospechosas: number[] = [];
  pages.forEach((p, i) => {
    const media = p.getMediaBox();
    const crop = p.getCropBox();
    const rot = p.getRotation().angle % 360;
    const desplazada = Math.abs(crop.x) > 0.5 || Math.abs(crop.y) > 0.5;
    const recortada = Math.abs(crop.width - media.width) > 0.5 || Math.abs(crop.height - media.height) > 0.5;
    if (rot !== 0 || desplazada || recortada) sospechosas.push(i + 1);
  });
  if (sospechosas.length > 0) {
    // No se dibuja NADA encima de una hoja cuya geometría no entendemos: es
    // preferible mandar al doctor a la lista de campos que enseñarle cajas
    // convincentes en el renglón equivocado de un documento médico-legal.
    return {
      paginas,
      cajas: [],
      sinUbicar: Object.entries(dict).map(([clave, nombrePdf]) => ({
        clave,
        nombrePdf,
        motivo: `pagina-rotada-o-recortada (p${sospechosas.join(', p')})`,
      })),
    };
  }

  // `nombre del campo en el PDF -> clave canónica`, para saber cuáles de los
  // campos de la hoja ya tienen concepto y cuáles son CRUDOS.
  const canonicaDe = new Map<string, string>();
  for (const [clave, nombrePdf] of Object.entries(dict)) canonicaDe.set(nombrePdf, clave);

  // Un campo que el diccionario nombra y el PDF no tiene: el diccionario va
  // contra otra versión del formato. Se reporta aunque no se dibuje nada.
  for (const [clave, nombrePdf] of Object.entries(dict)) {
    try { form.getField(nombrePdf); } catch { sinUbicar.push({ clave, nombrePdf, motivo: 'no-existe' }); }
  }

  // 🔴 Se recorre el FORMATO entero, no el diccionario. El diccionario dice qué
  // se pre-llena; no tiene por qué decidir dónde puede teclear un humano. Con
  // sólo los 60 mapeados, el borrador descargado pintaba 266 blancos de azul
  // —"aquí puedes escribir"— y la app dejaba escribir en 60.
  for (const field of form.getFields()) {
    const nombrePdf = field.getName();
    const clave = canonicaDe.get(nombrePdf) ?? claveCruda(nombrePdf);

    const esTexto = field instanceof PDFTextField;
    // 🔴 Un grupo de RADIO se dibuja igual que uno de casillas y se comporta
    // igual para el doctor: N recuadros, uno solo encendido, y el valor guardado
    // es el estado de exportación del recuadro elegido. Como la forma es la
    // misma, el visor, el catálogo del asistente y la procedencia funcionan sin
    // aprender nada nuevo — que es exactamente lo que se hizo con las casillas
    // dibujadas de Allianz (08-ALTA §7).
    //
    // Antes se excluían "a propósito", y en GNP eso dejaba 7 preguntas sin un
    // solo recuadro donde contestar, incluido el sexo del paciente.
    const esCasilla = field instanceof PDFCheckBox || field instanceof PDFRadioGroup;
    // Las firmas y los botones sí se quedan fuera; sólo se avisan si alguien los
    // mapeó en el diccionario, porque entonces sí se esperaba llenarlos.
    if (!esTexto && !esCasilla) {
      if (canonicaDe.has(nombrePdf)) sinUbicar.push({ clave, nombrePdf, motivo: 'tipo-no-soportado' });
      continue;
    }

    const widgets = field.acroField.getWidgets();
    if (widgets.length === 0) {
      sinUbicar.push({ clave, nombrePdf, motivo: 'sin-widget' });
      continue;
    }

    for (const widget of widgets) {
      // Misma resolución de página que el borrador: `/P` es OPCIONAL en el spec
      // y cuando falta hay que buscar la página que referencia al widget.
      // `findPageForAnnotationRef` devuelve una PDFPage, NO una PDFRef.
      const pRef = widget.P();
      const porP = pRef ? pages.findIndex((p) => p.ref === pRef) : -1;
      let pagina = porP;
      if (pagina < 0) {
        const ref = pdf.context.getObjectRef(widget.dict);
        const encontrada = ref ? pdf.findPageForAnnotationRef(ref) : undefined;
        pagina = encontrada ? pages.indexOf(encontrada) : -1;
      }
      if (pagina < 0) {
        sinUbicar.push({ clave, nombrePdf, motivo: 'sin-pagina' });
        continue;
      }

      const r = rectDelWidget(widget);
      cajas.push({
        clave,
        nombrePdf,
        pagina,
        x: r.x,
        y: r.y,
        ancho: r.ancho,
        alto: r.alto,
        tipo: esTexto ? 'texto' : 'casilla',
        multilinea: esTexto ? (field as PDFTextField).isMultiline() : false,
        ...(esTexto && (field as PDFTextField).getMaxLength() !== undefined
          ? { maxLength: (field as PDFTextField).getMaxLength() }
          : {}),
        ...(esCasilla ? { onState: onStateDelWidget(widget) } : {}),
      });
    }
  }

  return { paginas, cajas, sinUbicar };
}
