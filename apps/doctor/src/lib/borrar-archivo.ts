/**
 * Borrar DE VERDAD un archivo subido: sale del libro mayor (deja de contar
 * contra el cupo) y se borra del bucket de uploadthing (deja de costar).
 * TIERS 04 §12.6 #5 — regla R3: borrar libera espacio.
 *
 * Decisión del usuario (2026-09-18): borrado INMEDIATO y definitivo, sin
 * papelera. La confirmación de la pantalla lo dice («no se puede recuperar»).
 *
 * 🔴 NUNCA lanza. Quien llama ya borró el registro del dominio y el doctor ya lo
 * dio por borrado: fallar aquí sería pintarle un error por algo que sí pasó. Lo
 * que no se pudo liberar se registra con `[storage]` en los logs para limpiarlo
 * después — el peor caso es un archivo huérfano, que es lo que pasaba SIEMPRE
 * antes de esto.
 */

import { UTApi } from "uploadthing/server";
import { prisma, claveDeArchivo, olvidarArchivo } from "@healthcare/database";

export async function borrarArchivoSubido(doctorId: string, url: string | null | undefined): Promise<void> {
  const clave = claveDeArchivo(url);
  if (!clave) {
    if (url) console.warn("[storage] URL sin llave de uploadthing; no se borra", { doctorId, url });
    return;
  }

  let eraSuyo = 0;
  try {
    eraSuyo = await olvidarArchivo(prisma, doctorId, clave);
  } catch (e) {
    console.error("[storage] no se pudo sacar del libro mayor", { doctorId, clave, error: e instanceof Error ? e.message : e });
    return;
  }

  // 🔴 Sólo se borra del bucket lo que PROBADAMENTE es de este doctor: que
  // estuviera en SU libro mayor (review de #5, hallazgo 1). La URL de un media
  // la manda el navegador sin validar, así que sin esto un doctor podía colgar
  // la URL de un archivo AJENO (una foto de perfil pública) en su expediente,
  // borrarla, y eliminar del bucket el archivo del otro. Consecuencia aceptada:
  // lo subido antes del 2026-09-13 (sin fila en el ledger) sale del expediente
  // pero se queda en el bucket, igual que siempre.
  if (eraSuyo === 0) return;

  try {
    const r = await new UTApi().deleteFiles(clave);
    if (!r.success) console.error("[storage] uploadthing no confirmó el borrado", { doctorId, clave });
  } catch (e) {
    console.error("[storage] no se pudo borrar del bucket", { doctorId, clave, error: e instanceof Error ? e.message : e });
  }
}
