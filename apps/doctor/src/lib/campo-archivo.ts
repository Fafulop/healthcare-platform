/**
 * The «Archivo» field of a custom template, retired 2026-10-03 (H-025).
 *
 * It never uploaded anything: DynamicFieldRenderer kept the browser `File` in the form state and
 * JSON turned it into `{}`, so the record showed "[object Object]" and the file was gone (3 such
 * values in prod, one of them a real doctor's). Files belong in the visita's «Fotos y documentos»,
 * which uploads, counts against storage and shows in Docs y Galería. The field type stays VALID
 * (3 prod templates still have one and must keep saving) but can no longer be added, renders this
 * note instead of an input, is never required and is never offered to a model to fill.
 *
 * These helpers are the ONE place for those rules — the client forms, the renderer, the server
 * route and every surface that shows customData use them, so they cannot drift apart.
 */

import { formatLocalDate } from '@/lib/dates';
export const NOTA_CAMPO_ARCHIVO = 'Sube el archivo en «Fotos y documentos» de la visita.';

interface CampoLike {
  type?: string;
  required?: boolean;
}

/** Whether a field must be filled. A 'file' field never is: it has no input anymore. */
export function esRequerido(field: CampoLike): boolean {
  return !!field.required && field.type !== 'file';
}

/** Whether a model (voice, chat) may be asked to fill this field. Never a file. */
export function esLlenablePorModelo(field: CampoLike): boolean {
  return field.type !== 'file';
}

/**
 * True when a custom-field value has nothing to show: the usual empties plus the `{}` the old
 * «Archivo» left behind. Only an EMPTY object — anything with content is still shown.
 */
export function sinValor(v: unknown): boolean {
  if (v === undefined || v === null || v === '') return true;
  return typeof v === 'object' && !Array.isArray(v) && Object.keys(v as object).length === 0;
}

/** Whether a customData object has at least one value worth showing (gates its card/section). */
export function tieneValores(customData: Record<string, unknown> | null | undefined): boolean {
  return !!customData && Object.values(customData).some((v) => !sinValor(v));
}

/**
 * How a filled custom-field value READS for the doctor (visita view, Línea de Tiempo, visita PDF):
 * a «Casilla» is «Sí»/«No», not `true`/`false` (H-026); a multi-select is a comma list. (The Formularios
 * page has its own `renderFieldValue` with the same Sí/No rule, by field type.)
 */
export function textoDeValor(v: unknown, tipo?: string): string {
  if (typeof v === 'boolean') return v ? 'Sí' : 'No';
  // A «Fecha» field stores the calendar day as 'YYYY-MM-DD' (no time zone): «8 nov 2026», not the raw
  // string (H-023). Read as a local date — no UTC shift for a date-only value.
  if (tipo === 'date' && typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v)) {
    return formatLocalDate(v, { day: 'numeric', month: 'short', year: 'numeric' });
  }
  if (Array.isArray(v)) return v.join(', ');
  return String(v);
}
