'use client';

import { toast } from '@/lib/practice-toast';

/** Descarga un archivo. Revoca el enlace DESPUÉS (revocarlo en el mismo instante vaciaba la descarga en
 *  Safari / Firefox). Un solo lugar para las descargas de PDF de la tarjeta de la cita. */
export function descargarBlob(blob: Blob, nombre: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = nombre; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 30_000);
}

/** ¿Este navegador puede compartir este archivo con el «Compartir» del equipo? */
export function puedeCompartir(archivo: File): boolean {
  return typeof navigator !== 'undefined' && !!navigator.canShare?.({ files: [archivo] });
}

/**
 * Manda un ARCHIVO (un PDF) por WhatsApp sin publicarlo en internet — decisión del usuario 2026-10-12
 * («opción A»): WhatsApp no recibe archivos por enlace (`wa.me` sólo lleva texto), así que se abre el
 * «Compartir» del equipo con el archivo adjunto y el doctor elige WhatsApp y el chat del paciente.
 *
 * ⚠️ Llamarla DIRECTO en un clic, con el archivo YA preparado: el navegador sólo deja compartir justo
 * después de un clic, y si antes se espera al servidor (bajar el PDF) ese permiso se vence en algunos
 * teléfonos (code review). Por eso quien la usa prepara el archivo primero y ofrece «Compartir PDF».
 * Si no se puede, se DESCARGA y se dice por qué (nunca se queda callado).
 */
export async function compartirArchivo(archivo: File): Promise<'compartido' | 'cancelado' | 'descargado'> {
  if (puedeCompartir(archivo)) {
    try {
      // SÓLO el archivo: con `text`/`title` junto, WhatsApp en iPhone manda el texto y TIRA el adjunto (code review).
      await navigator.share({ files: [archivo] });
      return 'compartido';
    } catch (err) {
      // El doctor cerró el «Compartir»: no es un error.
      if ((err as Error)?.name === 'AbortError') return 'cancelado';
      console.error('[compartir] no se pudo abrir Compartir:', err);
      descargarBlob(archivo, archivo.name);
      toast.warning('No se pudo abrir «Compartir»: se descargó el PDF. Adjúntalo en WhatsApp.');
      return 'descargado';
    }
  }
  descargarBlob(archivo, archivo.name);
  toast.warning('Tu navegador no permite compartir archivos directo: se descargó el PDF. Adjúntalo en WhatsApp.');
  return 'descargado';
}
