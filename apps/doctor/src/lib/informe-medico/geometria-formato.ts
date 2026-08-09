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
import type { FieldDict } from './types';

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

  for (const [clave, nombrePdf] of Object.entries(dict)) {
    let field;
    try {
      field = form.getField(nombrePdf);
    } catch {
      sinUbicar.push({ clave, nombrePdf, motivo: 'no-existe' });
      continue;
    }

    const esTexto = field instanceof PDFTextField;
    const esCasilla = field instanceof PDFCheckBox;
    if (!esTexto && !esCasilla) {
      sinUbicar.push({ clave, nombrePdf, motivo: 'tipo-no-soportado' });
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
      });
    }
  }

  return { paginas, cajas, sinUbicar };
}
