import { createUploadthing, type FileRouter } from "uploadthing/next";
import { validateAuthToken } from '../../../lib/auth';
import { UploadThingError } from 'uploadthing/server';
import {
  prisma,
  assertStorageQuota,
  registrarArchivo,
  explicarRechazoDeSubida,
  type ArchivoEntrante,
} from '@healthcare/database';

const f = createUploadthing({
  errorFormatter: (err) => {
    console.log("UploadThing Error:", err.message);
    console.log("  - Above error caused by:", err.cause);
    return { message: err.message };
  },
});

// Auth middleware — rejects uploads from unauthenticated users.
// The API app uses JWT tokens (not NextAuth sessions), so we validate the
// Authorization header via the shared validateAuthToken helper.
//
// 🔴 TIERS Q4 — aquí también se cobra el ALMACENAMIENTO. `files` trae el tamaño
// de cada archivo y todavía no se transfirió ni un byte; es el único punto
// donde se puede rechazar sin gastar el tráfico del doctor ni el nuestro.
//
// ⚠️ Este router NO tiene ningún cliente en el repo: los helpers de `doctor`
// fijan `url: "/api/uploadthing"` (relativo, su propia app) y los de `admin`
// omiten `url`. Está vivo y autenticado con JWT, así que si el cupo no lo
// cubriera sería una vía de subida SIN medir — justo la clase de hueco que
// parece funcionar. Por eso se gatea igual que los otros dos.
const authMiddleware = async ({ req, files }: { req: Request; files: readonly ArchivoEntrante[] }) => {
  const user = await validateAuthToken(req);

  // 🔴 FAIL-OPEN cuando no hay doctor ligado, igual que en `doctor`.
  //
  // `doctorId` es el doctor EFECTIVO (membresía activa, o el legado) y
  // `computeEffectiveAccess` devuelve null para un ADMIN o una membresía
  // REVOKED. Antes de Q4 este middleware no lo miraba: exigirlo habría roto
  // subidas que ayer funcionaban. Sin doctor no se mide ni se registra.
  const doctorId = user.doctorId ?? null;

  // Igual que en `doctor`: uploadthing sepulta el error del middleware si no es
  // ya un `UploadThingError`.
  try {
    if (doctorId) await assertStorageQuota(prisma, doctorId, files);
  } catch (e) {
    const rechazo = explicarRechazoDeSubida(e);
    if (!rechazo) throw e;
    throw new UploadThingError({
      code: rechazo.tipo === 'archivo' ? 'TOO_LARGE' : 'FORBIDDEN',
      message: rechazo.mensaje,
      cause: e,
    });
  }

  return { userId: user.userId, doctorId: user.doctorId };
};

// 🔴 TIERS Q4 — el apunte en el libro mayor, del lado del servidor. Mismo
// contrato que en `doctor`: `onUploadComplete` recibe el `metadata` del
// middleware (con el `doctorId` ya resuelto) junto al tamaño y la URL
// definitivos. Se registra `ufsUrl` y no `url` porque en v7 son strings
// DISTINTAS para el mismo archivo, y el UNIQUE que evita contar doble vive
// sobre esa columna.
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

// FileRouter for practice management ledger uploads
export const ourFileRouter = {
  // General attachments (receipts, documents, etc.)
  ledgerAttachments: f({
    image: {
      maxFileSize: "8MB",
      maxFileCount: 10
    },
    pdf: {
      maxFileSize: "16MB",
      maxFileCount: 10
    }
  })
    .middleware(authMiddleware)
    .onUploadComplete(alSubir("ledgerAttachments")),

  // PDF invoices (facturas in PDF format)
  ledgerFacturasPdf: f({
    pdf: {
      maxFileSize: "16MB",
      maxFileCount: 5
    }
  })
    .middleware(authMiddleware)
    .onUploadComplete(alSubir("ledgerFacturasPdf")),

  // XML invoices (CFDI format)
  ledgerFacturasXml: f({
    "application/xml": {
      maxFileSize: "2MB",
      maxFileCount: 5
    },
    "text/xml": {
      maxFileSize: "2MB",
      maxFileCount: 5
    }
  })
    .middleware(authMiddleware)
    .onUploadComplete(alSubir("ledgerFacturasXml")),

  // ============================================================================
  // MEDICAL RECORDS MEDIA
  // ============================================================================

  // Medical images (patient photos, wounds, X-rays, lab results, etc.)
  medicalImages: f({
    image: {
      maxFileSize: "16MB",
      maxFileCount: 10
    }
  })
    .middleware(authMiddleware)
    .onUploadComplete(alSubir("medicalImages", { mediaType: "image" })),

  // Medical videos (procedures, examinations, etc.)
  // El tope REAL de video (200MB) lo aplica el middleware; `FileSize` sólo
  // admite potencias de 2, así que aquí va el permitido superior.
  medicalVideos: f({
    video: {
      maxFileSize: "256MB",
      maxFileCount: 5
    }
  })
    .middleware(authMiddleware)
    .onUploadComplete(alSubir("medicalVideos", { mediaType: "video" })),

  // Medical audio (voice notes, recordings, etc.)
  // El tope REAL (25MB) lo aplica el middleware.
  medicalAudio: f({
    audio: {
      maxFileSize: "32MB",
      maxFileCount: 10
    }
  })
    .middleware(authMiddleware)
    .onUploadComplete(alSubir("medicalAudio", { mediaType: "audio" })),

  // Medical documents (PDFs: lab results, reports, referrals, etc.)
  medicalDocuments: f({
    pdf: {
      maxFileSize: "32MB",
      maxFileCount: 10
    }
  })
    .middleware(authMiddleware)
    .onUploadComplete(alSubir("medicalDocuments", { mediaType: "document" })),
  // ============================================================================
  // DOCTOR PROFILE MEDIA
  // ============================================================================

  // Hero image uploader (doctor profile photo)
  doctorHeroImage: f({
    image: {
      maxFileSize: "4MB",
      maxFileCount: 1
    }
  })
    .middleware(authMiddleware)
    .onUploadComplete(alSubir("doctorHeroImage")),

  // Certificate images uploader (diplomas, certifications)
  doctorCertificates: f({
    image: {
      maxFileSize: "16MB",
      maxFileCount: 20
    }
  })
    .middleware(authMiddleware)
    .onUploadComplete(alSubir("doctorCertificates")),

  // Declaration receipts (acuse de recibo PDF)
  declarationReceipts: f({
    pdf: {
      maxFileSize: "8MB",
      maxFileCount: 1
    }
  })
    .middleware(authMiddleware)
    .onUploadComplete(alSubir("declarationReceipts")),

  // Clinic photos uploader (clinic interior, equipment)
  clinicPhotos: f({
    image: {
      maxFileSize: "8MB",
      maxFileCount: 20
    }
  })
    .middleware(authMiddleware)
    .onUploadComplete(alSubir("clinicPhotos")),

  // Video uploader (intro videos, facility tours)
  // 64MB → 256MB aquí, 200MB de verdad en el middleware (Q4).
  doctorVideos: f({
    video: {
      maxFileSize: "256MB",
      maxFileCount: 5
    }
  })
    .middleware(authMiddleware)
    .onUploadComplete(alSubir("doctorVideos")),
} satisfies FileRouter;

export type OurFileRouter = typeof ourFileRouter;
