import { createUploadthing, type FileRouter } from "uploadthing/next";
import { auth } from "@healthcare/auth";
import { UploadThingError } from "uploadthing/server";
import {
  prisma,
  assertStorageQuota,
  registrarArchivo,
  explicarRechazoDeSubida,
  type ArchivoEntrante,
} from "@healthcare/database";

const f = createUploadthing({
  errorFormatter: (err) => {
    console.log("UploadThing Error:", err.message);
    console.log("  - Above error caused by:", err.cause);
    return { message: err.message };
  },
});

// Shared auth middleware — rejects uploads from unauthenticated users.
//
// 🔴 TIERS Q4 — aquí también se cobra el ALMACENAMIENTO, y es el único momento
// en que se puede: `files` trae el tamaño de cada archivo y TODAVÍA no se
// transfirió ni un byte. Antes esta función no declaraba parámetros y tiraba
// esa información (las 33 definiciones de los 3 routers hacían lo mismo).
//
// Rechazar después de subir haría esperar al doctor una transferencia completa
// para decirle que no, y nos cobraría el tráfico igual. En la migración a R2 el
// contrato es el mismo (su plan §3.4: el servidor valida MIME y tamaño ANTES de
// firmar el PUT), por eso `assertStorageQuota` recibe TAMAÑOS y no un SDK.
//
// El `doctorId` sale de la sesión: en esta app quien sube es el dueño (o un
// member suyo), así que el archivo se le cobra a su cuenta.
const authMiddleware = async ({ files }: { files: readonly ArchivoEntrante[] }) => {
  const session = await auth();
  if (!session?.user?.email) throw new Error("Unauthorized");

  // 🔴 FAIL-OPEN cuando no hay doctor ligado.
  //
  // Antes de Q4 este middleware NI SIQUIERA miraba `doctorId`: devolvía sólo
  // `userId`, y quien no tuviera doctor ligado subía igual. Exigirlo habría
  // dejado fuera a gente que subía ayer —`computeEffectiveAccess` devuelve null
  // para un ADMIN (y `requireDoctorAuth` admite ADMIN en endpoints de doctor) y
  // para una membresía REVOKED— y encima con un mensaje ilegible.
  //
  // Sin doctor no hay cuenta a la que cobrarle: no se mide ni se registra. Son
  // subidas sin medir de cuentas que no tienen cupo que gastar.
  const doctorId = (session.user as { doctorId?: string }).doctorId ?? null;

  // TIERS 04 §12.6 #6.2: una cuenta CONGELADA no sube archivos (no pasa por
  // requireDoctorAuth, así que se revisa aquí). La de `apps/api` ya queda
  // cubierta por validateAuthToken.
  if ((session.user as { congelada?: boolean }).congelada === true) {
    throw new UploadThingError({
      code: "FORBIDDEN",
      message: "Tu cuenta está congelada. Reactívala desde Mi Cuenta para volver a subir archivos.",
    });
  }

  // uploadthing sólo deja pasar lo que YA es `UploadThingError`; cualquier otra
  // cosa la envuelve en "Failed to run middleware". Sin esta traducción, al
  // doctor sin espacio le aparecería esa frase.
  try {
    if (doctorId) await assertStorageQuota(prisma, doctorId, files);
  } catch (e) {
    const rechazo = explicarRechazoDeSubida(e);
    if (!rechazo) throw e;
    throw new UploadThingError({
      code: rechazo.tipo === "archivo" ? "TOO_LARGE" : "FORBIDDEN",
      message: rechazo.mensaje,
      cause: e,
    });
  }

  return { userId: session.user.id, doctorId };
};

// 🔴 TIERS Q4 — el apunte en el libro mayor va AQUÍ, en el servidor, no en el
// cliente. `onUploadComplete` recibe el `metadata` del middleware (con el
// `doctorId` ya resuelto) JUNTO AL tamaño y la URL definitivos; es el único
// punto por el que pasan TODAS las subidas.
//
// En el cliente sería opcional: hay 19 archivos que suben, con tres idiomas
// distintos (componente, hook `useUploadThing` y `uploadFiles`), y el que se
// olvidara de apuntar dejaría de medir sin que se note.
//
// Se registra `ufsUrl` (no `url`): en v7 son strings DISTINTAS para el mismo
// archivo, y el UNIQUE que evita contar doble vive sobre esa columna.
const alSubir =
  (kind: string, extra?: Record<string, string>) =>
  async ({
    metadata,
    file,
  }: {
    metadata: { doctorId: string | null };
    file: { key: string; ufsUrl: string; size: number };
  }) => {
    // Sin doctor no hay a quién cobrarle (ver el fail-open del middleware).
    if (metadata.doctorId) {
      await registrarArchivo(prisma, metadata.doctorId, {
        key: file.key,
        url: file.ufsUrl,
        size: file.size,
        kind,
      });
    }
    return { uploadedBy: "doctor", ...extra };
  };

export const ourFileRouter = {
  // ============================================================================
  // PRACTICE LEDGER
  // ============================================================================

  ledgerAttachments: f({
    image: { maxFileSize: "8MB", maxFileCount: 10 },
    pdf: { maxFileSize: "16MB", maxFileCount: 10 },
  }).middleware(authMiddleware).onUploadComplete(alSubir("ledgerAttachments")),

  ledgerFacturasPdf: f({
    pdf: { maxFileSize: "16MB", maxFileCount: 5 },
  }).middleware(authMiddleware).onUploadComplete(alSubir("ledgerFacturasPdf")),

  ledgerFacturasXml: f({
    "application/xml": { maxFileSize: "2MB", maxFileCount: 5 },
    "text/xml": { maxFileSize: "2MB", maxFileCount: 5 },
  }).middleware(authMiddleware).onUploadComplete(alSubir("ledgerFacturasXml")),

  // ============================================================================
  // MEDICAL RECORDS MEDIA
  // ============================================================================

  medicalImages: f({
    image: { maxFileSize: "16MB", maxFileCount: 10 },
  }).middleware(authMiddleware).onUploadComplete(alSubir("medicalImages", { mediaType: "image" })),

  // El tope REAL de video (200MB) lo aplica el middleware. Aquí sólo se puede
  // escribir una potencia de 2 (`FileSize` = `${PowOf2}${SizeUnit}`), así que va
  // el valor permitido INMEDIATAMENTE SUPERIOR: si pusiéramos 128MB la librería
  // rechazaría antes que nosotros y con un mensaje peor.
  medicalVideos: f({
    video: { maxFileSize: "256MB", maxFileCount: 5 },
  }).middleware(authMiddleware).onUploadComplete(alSubir("medicalVideos", { mediaType: "video" })),

  // El tope REAL (25MB) lo aplica el middleware; aquí va el permitido superior.
  medicalAudio: f({
    audio: { maxFileSize: "32MB", maxFileCount: 10 },
  }).middleware(authMiddleware).onUploadComplete(alSubir("medicalAudio", { mediaType: "audio" })),

  medicalDocuments: f({
    pdf: { maxFileSize: "32MB", maxFileCount: 10 },
  }).middleware(authMiddleware).onUploadComplete(alSubir("medicalDocuments", { mediaType: "document" })),

  // ============================================================================
  // DOCTOR PROFILE MEDIA
  // ============================================================================

  doctorHeroImage: f({
    image: { maxFileSize: "4MB", maxFileCount: 1 },
  }).middleware(authMiddleware).onUploadComplete(alSubir("doctorHeroImage")),

  doctorCertificates: f({
    image: { maxFileSize: "16MB", maxFileCount: 20 },
  }).middleware(authMiddleware).onUploadComplete(alSubir("doctorCertificates")),

  clinicPhotos: f({
    image: { maxFileSize: "8MB", maxFileCount: 20 },
  }).middleware(authMiddleware).onUploadComplete(alSubir("clinicPhotos")),

  // 1GB → 256MB aquí, 200MB de verdad en el middleware. El archivo más grande
  // que existe hoy en prod es un video de 156.8MB: no rechaza nada de lo que ya
  // está.
  doctorVideos: f({
    video: { maxFileSize: "256MB", maxFileCount: 5 },
  }).middleware(authMiddleware).onUploadComplete(alSubir("doctorVideos")),

  // ============================================================================
  // BLOG
  // ============================================================================

  blogImages: f({
    image: { maxFileSize: "8MB", maxFileCount: 1 },
  }).middleware(authMiddleware).onUploadComplete(alSubir("blogImages")),

  // ============================================================================
  // PRESCRIPTION PDF TEMPLATE
  // ============================================================================

  prescriptionLogo: f({
    image: { maxFileSize: "4MB", maxFileCount: 1 },
  }).middleware(authMiddleware).onUploadComplete(alSubir("prescriptionLogo")),

  prescriptionSignature: f({
    image: { maxFileSize: "2MB", maxFileCount: 1 },
  }).middleware(authMiddleware).onUploadComplete(alSubir("prescriptionSignature")),

  // ============================================================================
  // BANK STATEMENT CSV
  // ============================================================================

  bankStatementCsv: f({
    "text/csv": { maxFileSize: "16MB", maxFileCount: 1 },
    "text/plain": { maxFileSize: "16MB", maxFileCount: 1 },
    "application/vnd.ms-excel": { maxFileSize: "16MB", maxFileCount: 1 },
  }).middleware(authMiddleware).onUploadComplete(alSubir("bankStatementCsv")),

  // ============================================================================
  // BANK STATEMENT PDF
  // ============================================================================

  bankStatementPdf: f({
    pdf: { maxFileSize: "16MB", maxFileCount: 1 },
  }).middleware(authMiddleware).onUploadComplete(alSubir("bankStatementPdf")),

  // ============================================================================
  // DECLARATION RECEIPTS (acuse de recibo PDF)
  // ============================================================================

  declarationReceipts: f({
    pdf: { maxFileSize: "8MB", maxFileCount: 1 },
  }).middleware(authMiddleware).onUploadComplete(alSubir("declarationReceipts")),
} satisfies FileRouter;

export type OurFileRouter = typeof ourFileRouter;
