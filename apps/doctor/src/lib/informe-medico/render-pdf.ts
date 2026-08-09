/**
 * INFORME MÉDICO — los DOS renders del mismo informe (02-PLAN §4b).
 *
 *   renderFinal()    → lo que recibe la aseguradora: limpio y APLANADO
 *   renderBorrador() → lo que revisa el médico: dos capas de color, SÓLO LECTURA
 *
 * 🔴 El borrador NUNCA se manda. Los tres formatos dicen en su propio texto que
 * no son válidos con tachaduras ni enmendaduras; una hoja con recuadros de color
 * encima es peor que una en blanco.
 *
 * Probado punta a punta el 2026-08-08 contra el AXA oficial (277 campos) y el
 * Allianz oficial: 10/10 y 12/12 campos llenados, 0 campos vivos tras aplanar, y
 * los acentos y la ñ intactos (`Muñoz`, `Peña`, `María de los Ángeles`).
 */
import {
  PDFCheckBox,
  PDFDocument,
  PDFDropdown,
  PDFOptionList,
  PDFRadioGroup,
  PDFTextField,
  rgb,
  StandardFonts,
  type PDFField,
  type PDFForm,
} from 'pdf-lib';
import type { Answers, FieldDict } from './types';
import { caracteresNoImprimibles } from './winansi';

/** Azul: aquí SE PUEDE escribir (campo vacío). */
const COLOR_VACIO = rgb(0.83, 0.89, 0.97);
/** Verde: aquí YA HAY contenido, venga de donde venga. */
const COLOR_LLENO = rgb(0.80, 0.93, 0.79);

/** Un campo que no se pudo escribir, y por qué. Nunca se traga en silencio. */
export interface CampoOmitido {
  campoCanonico: string;
  nombrePdf: string;
  motivo: 'no-existe' | 'no-es-de-texto' | 'caracteres-no-imprimibles';
  /** Sólo para `caracteres-no-imprimibles`: qué hay que quitar. */
  caracteres?: string[];
}

export interface RenderResult {
  pdf: Uint8Array;
  llenados: number;
  /** Todo lo que el diccionario mandaba escribir y no se pudo. */
  omitidos: CampoOmitido[];
  /** Widgets cuya página no se pudo resolver: NO se pintaron (sólo borrador). */
  widgetsSinPagina: number;
}

/**
 * Escribe las respuestas en el PDF usando el diccionario del formato.
 * No aplana ni pinta: eso lo deciden las dos funciones públicas de abajo.
 */
function aplicarRespuestas(form: PDFForm, answers: Answers, dict: FieldDict) {
  const omitidos: CampoOmitido[] = [];
  let llenados = 0;

  for (const [campoCanonico, nombrePdf] of Object.entries(dict)) {
    const respuesta = answers[campoCanonico];
    if (!respuesta || respuesta.value.trim() === '') continue;

    // 🔴 ANTES de escribir: si el texto trae algo que WinAnsi no codifica, el
    // `save()` de más abajo truena y se cae el informe ENTERO. Se omite ESTE
    // campo y se reporta con el carácter culpable, sin reescribir nada.
    const malos = caracteresNoImprimibles(respuesta.value);
    if (malos.length > 0) {
      omitidos.push({ campoCanonico, nombrePdf, motivo: 'caracteres-no-imprimibles', caracteres: malos });
      continue;
    }

    let field;
    try {
      field = form.getField(nombrePdf);
    } catch {
      // El diccionario nombra un campo que ESTE PDF no tiene: casi siempre es
      // el diccionario contra otra versión del formato.
      omitidos.push({ campoCanonico, nombrePdf, motivo: 'no-existe' });
      continue;
    }
    if (!(field instanceof PDFTextField)) {
      // Existe, pero es casilla/radio. Antes esto caía en el mismo saco que
      // "no existe" y el diagnóstico salía equivocado.
      omitidos.push({ campoCanonico, nombrePdf, motivo: 'no-es-de-texto' });
      continue;
    }
    field.setText(respuesta.value);
    llenados++;
  }
  return { omitidos, llenados };
}

/**
 * ¿Este campo ya tiene algo? Decide el color del borrador.
 *
 * 🔴 No basta con `getText()`: **sólo los campos de texto lo tienen**. Una
 * casilla usa `isChecked()` y un desplegable `getSelected()`, así que
 * preguntarles por `getText` devuelve `undefined` y las 45 casillas de AXA
 * saldrían en AZUL —"aquí se puede escribir"— aunque estuvieran marcadas.
 */
function tieneContenido(field: PDFField): boolean {
  try {
    if (field instanceof PDFTextField) return (field.getText() ?? '').trim() !== '';
    if (field instanceof PDFCheckBox) return field.isChecked();
    if (field instanceof PDFRadioGroup) return field.getSelected() !== undefined;
    if (field instanceof PDFDropdown) return field.getSelected().length > 0;
    if (field instanceof PDFOptionList) return field.getSelected().length > 0;
  } catch {
    // Un campo con la apariencia corrupta no debe tumbar el borrador entero.
    return false;
  }
  return false;
}

/**
 * FINAL — el PDF que se descarga o se le manda al paciente.
 * Aplanado: los campos dejan de existir y el informe firmado no se puede editar.
 */
export async function renderFinal(
  pdfBase: Uint8Array | ArrayBuffer,
  answers: Answers,
  dict: FieldDict
): Promise<RenderResult> {
  const pdf = await PDFDocument.load(pdfBase);
  const form = pdf.getForm();
  const { omitidos, llenados } = aplicarRespuestas(form, answers, dict);

  // 🔴 Sin esto el informe llega EDITABLE a la aseguradora.
  form.flatten();

  return { pdf: await pdf.save(), llenados, omitidos, widgetsSinPagina: 0 };
}

/**
 * BORRADOR — sólo para el médico.
 *
 * Dos capas de color: azul donde se puede escribir, verde donde ya hay algo.
 * Resuelve la pregunta real al abrir un formato de 277 campos: *¿dónde escribo
 * y qué ya está hecho?*
 *
 * ⚠️ SÓLO LECTURA a propósito. Los colores se pintan al generar (son una foto:
 * un PDF no reacciona, escribir en un campo azul no lo pone verde). Y si el
 * doctor pudiera teclear aquí, ese valor viviría sólo en este archivo — fuera
 * del JSON de respuestas — y al regenerar el borrador desaparecería en silencio.
 * Se edita en la app; esto es para revisar e imprimir.
 */
export async function renderBorrador(
  pdfBase: Uint8Array | ArrayBuffer,
  answers: Answers,
  dict: FieldDict
): Promise<RenderResult> {
  const pdf = await PDFDocument.load(pdfBase);
  const form = pdf.getForm();
  const { omitidos, llenados } = aplicarRespuestas(form, answers, dict);

  const pages = pdf.getPages();
  const font = await pdf.embedFont(StandardFonts.HelveticaBold);
  let widgetsSinPagina = 0;

  for (const field of form.getFields()) {
    const lleno = tieneContenido(field);

    field.enableReadOnly();

    for (const widget of field.acroField.getWidgets()) {
      const r = widget.getRectangle();
      // `/P` es OPCIONAL en el spec y muchos generadores no lo ponen. Cuando
      // falta hay que buscar la página que referencia al widget — es lo que
      // hace `flatten()` por dentro, y por eso el FINAL sí funciona en PDFs
      // donde el borrador se quedaba sin pintar NADA (277 widgets, 0 recuadros,
      // reportado sólo como un contador que ninguna UI lee todavía).
      const widgetRef = pdf.context.getObjectRef(widget.dict);
      const pageRef = widget.P() ?? (widgetRef ? pdf.findPageForAnnotationRef(widgetRef) : undefined);
      const page = pages.find((p) => p.ref === pageRef);
      // Sin página no se pinta: hacerlo en la 1 con las coordenadas de OTRA
      // tira recuadros de color encima del texto impreso, sin ninguna señal.
      if (!page) { widgetsSinPagina++; continue; }
      page.drawRectangle({
        x: r.x,
        y: r.y,
        width: r.width,
        height: r.height,
        color: lleno ? COLOR_LLENO : COLOR_VACIO,
        opacity: 0.55,
        borderWidth: 0,
      });
    }
  }

  // Aviso + leyenda arriba de la primera página.
  const p1 = pages[0];
  const { width, height } = p1.getSize();
  p1.drawRectangle({ x: 0, y: height - 26, width, height: 26, color: rgb(1, 0.95, 0.95), opacity: 0.95 });
  p1.drawText('BORRADOR — sólo lectura. Se edita en la app. NO enviar a la aseguradora.', {
    x: 14, y: height - 17, size: 9, font, color: rgb(0.7, 0.1, 0.1),
  });
  p1.drawRectangle({ x: 330, y: height - 21, width: 16, height: 9, color: COLOR_VACIO });
  p1.drawText('se puede escribir', { x: 350, y: height - 19, size: 7.5, font, color: rgb(0.25, 0.25, 0.3) });
  p1.drawRectangle({ x: 448, y: height - 21, width: 16, height: 9, color: COLOR_LLENO });
  p1.drawText('ya tiene contenido', { x: 468, y: height - 19, size: 7.5, font, color: rgb(0.25, 0.25, 0.3) });

  return { pdf: await pdf.save(), llenados, omitidos, widgetsSinPagina };
}
