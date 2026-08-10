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
import { PDFCheckBox, PDFDocument, PDFTextField } from 'pdf-lib';
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
function onStateDe(widget: { getAppearances: () => { normal?: unknown } | undefined }): string | undefined {
  const normal = widget.getAppearances()?.normal as { dict?: Map<{ asString(): string }, unknown> } | undefined;
  if (!normal?.dict) return undefined;
  for (const k of normal.dict.keys()) {
    const nombre = k.asString().replace(/^\//, '');
    if (nombre !== 'Off') return nombre;
  }
  return undefined;
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
    const esCasilla = field instanceof PDFCheckBox;
    // Radios y firmas se quedan fuera a propósito; sólo se avisan si alguien los
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

      const r = widget.getRectangle();
      cajas.push({
        clave,
        nombrePdf,
        pagina,
        x: r.x,
        y: r.y,
        ancho: r.width,
        alto: r.height,
        tipo: esTexto ? 'texto' : 'casilla',
        multilinea: esTexto ? (field as PDFTextField).isMultiline() : false,
        ...(esTexto && (field as PDFTextField).getMaxLength() !== undefined
          ? { maxLength: (field as PDFTextField).getMaxLength() }
          : {}),
        ...(esCasilla ? { onState: onStateDe(widget) } : {}),
      });
    }
  }

  return { paginas, cajas, sinUbicar };
}
