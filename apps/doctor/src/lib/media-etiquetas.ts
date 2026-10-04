// Cómo se LEEN los valores de «Fotos y documentos» (H-051): la BD guarda claves en inglés
// (`x-ray`, `image`…) y la galería/tarjeta las pintaban tal cual. Una sola tabla para el
// subidor (que ya traducía), la tarjeta y los filtros de la galería.

export const CATEGORIAS_MEDIA: { value: string; label: string }[] = [
  { value: 'wound', label: 'Herida' },
  { value: 'x-ray', label: 'Rayos X' },
  { value: 'dermatology', label: 'Dermatología' },
  { value: 'cardiology', label: 'Cardiología' },
  { value: 'lab-result', label: 'Resultado de Laboratorio' },
  { value: 'procedure', label: 'Procedimiento' },
  { value: 'consultation', label: 'Consulta' },
  { value: 'other', label: 'Otro' },
];

/** Etiqueta de una categoría guardada; una clave desconocida se muestra tal cual. */
export function etiquetaCategoriaMedia(valor: string): string {
  return CATEGORIAS_MEDIA.find((c) => c.value === valor)?.label ?? valor;
}

const TIPOS: Record<string, string> = {
  image: 'Imagen',
  video: 'Video',
  audio: 'Audio',
  document: 'Documento',
};

/** Etiqueta del tipo de archivo (`image` → «Imagen»). */
export function etiquetaTipoMedia(valor: string): string {
  return TIPOS[valor] ?? valor;
}
