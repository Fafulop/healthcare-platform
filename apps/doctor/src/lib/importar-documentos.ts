import type { Prisma, PrismaClient } from '@healthcare/database';
import { claveDeArchivo } from '@healthcare/database';
import { getClinicDateString } from '@/lib/dates';

/**
 * PACIENTE MIGRATION I1 — lo compartido por la ruta `POST /api/patient-import/documentos` y la
 * pantalla de importar documentos (I2). Diseño: docs/DESDE JUNIO/PACIENTE MIGRATION/02-DISENO-importar-documentos.md
 */

export const MAX_POR_TANDA = 25;
export const NOTA_MAX_CARACTERES = 100_000;
export const RUTA_MAX = 500;
export const NOMBRE_MAX = 255; // PatientMedia.fileName es VarChar(255)
export const CATEGORIA_IMPORTADO = 'Historial importado';

/** MIME → mediaType. G4: sólo lo que el navegador sabe mostrar (HEIC NO). */
export const TIPOS: Record<string, 'document' | 'image'> = {
  'application/pdf': 'document',
  'image/jpeg': 'image',
  'image/png': 'image',
  'image/webp': 'image',
};

/**
 * Por qué ruta de subida tuvo que entrar cada tipo (lo dice el libro de archivos, `StoredFile.kind`).
 * Manda el LIBRO, no el MIME que diga el navegador: así un PDF nunca se guarda como imagen, y una
 * factura o la foto del perfil (otras rutas) no se pueden colgar en un expediente.
 */
const KIND_DE: Record<'document' | 'image', string> = { document: 'medicalDocuments', image: 'medicalImages' };

const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
/** '2023-05-14' → '14 may 2023'. */
function diaLargo(iso: string) {
  const [y, m, d] = iso.split('-').map(Number);
  return `${d} ${MESES[m - 1]} ${y}`;
}

/**
 * G2: `captureDate` y las fechas de la nota son TIMESTAMP, no `@db.Date`. El día se guarda a MEDIODÍA
 * de México (UTC−6, sin horario de verano desde 2022): a medianoche UTC, «14 may» se vería 13 may.
 */
export function mediodiaMexico(iso: string) {
  return new Date(`${iso}T12:00:00-06:00`);
}

/** El primer renglón de una nota importada (es su título en la lista, y la llave de G1). */
export function encabezadoDeNota(fileName: string, fecha: string) {
  return `Importado de ${fileName} · ${diaLargo(fecha)}`;
}

/** `nuevo` sólo lo contesta `verificar` (aún no está importado: hay que subirlo). */
export type Resultado = { ref: string; estado: 'guardado' | 'ya_importado' | 'nuevo' | 'error'; id?: string; motivo?: string };

export const texto = (v: unknown, max: number) => (typeof v === 'string' && v.trim() && v.length <= max ? v.trim() : null);

function fechaValida(v: unknown): string | null {
  if (typeof v !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return null;
  const [y, m, d] = v.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== m - 1 || dt.getUTCDate() !== d) return null; // 31-feb
  if (y < 1900) return null;
  if (v > getClinicDateString()) return null; // no en el futuro (hoy en México)
  return v;
}

/** Lo que se escribe en la bitácora por elemento; la ruta lo manda a `logAudit` (con el request). */
export interface AuditoriaDeImport {
  patientId: string;
  action: 'upload_media' | 'create_note';
  resourceType: 'media' | 'note';
  resourceId: string;
  changes: Record<string, unknown>;
}

/**
 * Guarda una tanda. Cada elemento por separado (uno que falla no tumba a los demás). `db` puede ser
 * una transacción (el probe la revierte) y `auditar` recibe cada renglón de bitácora — así el probe
 * corre ESTE código sin dejar rastro en prod.
 */
export async function guardarTanda(
  db: Prisma.TransactionClient | PrismaClient,
  quien: { doctorId: string; userId: string },
  batchId: string,
  elementos: unknown[],
  auditar: (a: AuditoriaDeImport) => Promise<void>,
): Promise<Resultado[]> {
  // Los pacientes de la tanda, de ESTE doctor (también archivados — G6).
  const ids = [...new Set(elementos.map((e) => (e as { patientId?: unknown })?.patientId).filter((x): x is string => typeof x === 'string'))];
  const pacientes = new Set(
    (await db.patient.findMany({ where: { id: { in: ids }, doctorId: quien.doctorId }, select: { id: true } })).map((p) => p.id),
  );

  const resultados: Resultado[] = [];
  for (const crudo of elementos) {
    const e = (crudo ?? {}) as Record<string, unknown>;
    const ref = typeof e.ref === 'string' ? e.ref.slice(0, 100) : '';
    const error = (motivo: string) => resultados.push({ ref, estado: 'error', motivo });
    try {
      const patientId = typeof e.patientId === 'string' ? e.patientId : '';
      if (!pacientes.has(patientId)) { error('El paciente no existe o no es tuyo'); continue; }

      // `verificar` (SÓLO LECTURA): ¿este archivo ya se importó a este paciente? La pantalla pregunta
      // ANTES de subir — si no, re-importar la misma carpeta volvería a SUBIR cada archivo (copias sin
      // usar que gastan cupo) aunque al guardar saliera «ya importado». Misma regla que G1 abajo.
      if (e.tipo === 'verificar') {
        const nombre = texto(e.fileName, NOMBRE_MAX);
        const bytes = typeof e.bytes === 'number' && Number.isInteger(e.bytes) && e.bytes > 0 ? e.bytes : null;
        if (!nombre || !bytes) { error('Falta el nombre o el tamaño del archivo'); continue; }
        const ya = await db.patientMedia.findFirst({
          where: { patientId, doctorId: quien.doctorId, category: CATEGORIA_IMPORTADO, fileName: nombre, fileSize: bytes },
          select: { id: true },
        });
        resultados.push(ya ? { ref, estado: 'ya_importado', id: ya.id } : { ref, estado: 'nuevo' });
        continue;
      }
      const fecha = fechaValida(e.fecha);
      if (!fecha) { error('Fecha inválida o en el futuro'); continue; }
      const ruta = texto(e.ruta, RUTA_MAX);
      const fileName = texto(e.fileName, NOMBRE_MAX);
      if (!ruta || !fileName) { error('Falta el nombre del archivo'); continue; }

      if (e.tipo === 'archivo') {
        const mimeType = typeof e.mimeType === 'string' ? e.mimeType.toLowerCase() : '';
        const mediaType = TIPOS[mimeType];
        if (!mediaType) { error('Tipo de archivo no permitido (sólo PDF, JPG, PNG o WebP)'); continue; }
        const fileUrl = texto(e.fileUrl, 2000);
        const key = claveDeArchivo(fileUrl);
        // El archivo tiene que ser uno que ESTE doctor subió (su libro de archivos), y lo que se guarda
        // es la URL DEL LIBRO, nunca la del navegador: `https://otro-sitio/f/<llave-real>` pasaría el
        // cotejo de la llave y dejaría en el expediente un enlace ajeno.
        const subido = key
          ? await db.storedFile.findFirst({ where: { fileKey: key, doctorId: quien.doctorId }, select: { sizeBytes: true, url: true, kind: true } })
          : null;
        if (!fileUrl || !subido) { error('No se encontró el archivo subido; vuelve a subirlo'); continue; }
        if (subido.kind !== KIND_DE[mediaType]) { error('El archivo no se subió como documento o imagen del expediente'); continue; }

        // G1: ¿ya se importó a este paciente? (mismo nombre y tamaño, en «Historial importado»).
        const ya = await db.patientMedia.findFirst({
          where: {
            patientId, doctorId: quien.doctorId, category: CATEGORIA_IMPORTADO, fileName,
            // El tamaño, del libro de archivos (lo midió el servidor al subir), no del navegador.
            fileSize: subido.sizeBytes,
          },
          select: { id: true },
        });
        if (ya) { resultados.push({ ref, estado: 'ya_importado', id: ya.id }); continue; }

        const media = await db.patientMedia.create({
          data: {
            patientId, doctorId: quien.doctorId, encounterId: null, visitaId: null,
            mediaType, fileName, fileUrl: subido.url, fileSize: subido.sizeBytes, mimeType,
            category: CATEGORIA_IMPORTADO, captureDate: mediodiaMexico(fecha),
            description: `Importado de ${ruta}`.slice(0, 2000), visibility: 'internal', uploadedBy: quien.userId,
          },
          select: { id: true },
        });
        await auditar({
          patientId,
          action: 'upload_media', resourceType: 'media', resourceId: media.id,
          changes: { origen: 'importar-documentos', batchId, ruta, fecha },
        });
        resultados.push({ ref, estado: 'guardado', id: media.id });
      } else if (e.tipo === 'nota') {
        const cuerpo = typeof e.texto === 'string' ? e.texto.trim() : '';
        if (!cuerpo) { error('El documento no tiene texto; expórtalo a PDF'); continue; }
        if (cuerpo.length > NOTA_MAX_CARACTERES) { error('El documento es demasiado largo para una nota; expórtalo a PDF'); continue; }
        const encabezado = encabezadoDeNota(fileName, fecha);

        // G1: la MISMA nota ya se importó (contenido idéntico). No basta el primer renglón: dos Word
        // distintos con el mismo nombre y fecha (`consulta.docx` en dos carpetas) son dos notas.
        const contenido = `${encabezado}\n\n${cuerpo}`;
        const ya = await db.patientNote.findFirst({
          where: { patientId, doctorId: quien.doctorId, content: contenido },
          select: { id: true },
        });
        if (ya) { resultados.push({ ref, estado: 'ya_importado', id: ya.id }); continue; }

        const cuando = mediodiaMexico(fecha);
        const nota = await db.patientNote.create({
          data: {
            patientId, doctorId: quien.doctorId, visitaId: null,
            content: contenido,
            // D7: la fecha de la nota es la del DOCUMENTO (si no, todas dirían «hoy»).
            createdAt: cuando, updatedAt: cuando,
          },
          select: { id: true },
        });
        await auditar({
          patientId,
          action: 'create_note', resourceType: 'note', resourceId: nota.id,
          changes: { origen: 'importar-documentos', batchId, ruta, fecha, caracteres: cuerpo.length },
        });
        resultados.push({ ref, estado: 'guardado', id: nota.id });
      } else {
        error('Elemento inválido');
      }
    } catch (err) {
      console.error('[importar-documentos] elemento falló', { ref, error: err instanceof Error ? err.message : err });
      error('No se pudo guardar; reintenta');
    }
  }

  return resultados;
}
