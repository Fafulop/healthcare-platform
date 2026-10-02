/**
 * PACIENTE MIGRATION I2 — Word (.docx) → TEXTO de la nota, en el navegador (decisión del usuario
 * 2026-10-01: el Word no se sube; se vuelve nota). Mecánico, SIN IA: lo que dice el documento, sin
 * resumir. `mammoth` se carga sólo cuando aparece un Word (no pesa en la página si no hay).
 * Diseño: docs/DESDE JUNIO/PACIENTE MIGRATION/02-DISENO-importar-documentos.md (D1–D1d, G5).
 */

export const NOTA_MAX_CARACTERES = 100_000; // el mismo tope que valida el servidor (lib/importar-documentos.ts)

export type LecturaWord =
  | { ok: true; texto: string; imagenes: number }
  | { ok: false; motivo: string };

/** Saltos de línea normales y a lo más un renglón en blanco seguido. */
export function limpiarTexto(t: string) {
  return t
    .replace(/\r\n?/g, '\n')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export async function leerWord(datos: ArrayBuffer): Promise<LecturaWord> {
  const mammoth = await import('mammoth');
  // En el navegador mammoth lee un ArrayBuffer; en Node (las pruebas) pide un Buffer.
  const entrada = typeof window === 'undefined' ? { buffer: Buffer.from(datos) } : { arrayBuffer: datos };
  try {
    const crudo = await mammoth.extractRawText(entrada);
    // D1d: las imágenes NO pasan a la nota — se cuentan para AVISAR por archivo.
    let imagenes = 0;
    await mammoth.convertToHtml(
      entrada,
      { convertImage: mammoth.images.imgElement(async () => { imagenes++; return { src: '' }; }) },
    );
    const texto = limpiarTexto(crudo.value);
    if (!texto) return { ok: false, motivo: 'No tiene texto (¿es un escaneo pegado en Word?): expórtalo a PDF' };
    if (texto.length > NOTA_MAX_CARACTERES) return { ok: false, motivo: 'Es demasiado largo para una nota: expórtalo a PDF' };
    return { ok: true, texto, imagenes };
  } catch {
    return { ok: false, motivo: 'No se pudo leer (¿protegido o dañado?): expórtalo a PDF' };
  }
}
