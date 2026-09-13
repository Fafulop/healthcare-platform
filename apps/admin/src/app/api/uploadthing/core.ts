import { createUploadthing, type FileRouter } from "uploadthing/next";
import { auth } from "@healthcare/auth";
import { UploadThingError } from "uploadthing/server";
import {
  prisma,
  maxBytesForMime,
  registrarArchivo,
  explicarRechazoDeSubida,
  FileTooLargeError,
  type ArchivoEntrante,
} from "@healthcare/database";

const f = createUploadthing({
  errorFormatter: (err) => {
    console.log("UploadThing Error:", err.message);
    console.log("  - Above error caused by:", err.cause);
    return { message: err.message };
  },
});

// 🔴 TIERS Q4 — quién PAGA el archivo no es quien aprieta el botón.
//
// En esta app el que sube es un admin, y sube al perfil de OTRO doctor. Cobrarle
// al admin dejaría al doctor sin medir: el espacio lo ocupa él. Por eso el
// cliente manda el `slug` del doctor destino por `.input()` y aquí se resuelve
// a un `doctorId` real.
//
// El parser es a mano y a propósito: `.input()` acepta cualquier
// `{ _input, _output, parseAsync }` (verificado en los tipos de uploadthing
// 7.7.4), así que no hace falta meter `zod` en las dependencias de admin — y un
// cambio de dependencia obliga a regenerar `pnpm-lock.yaml` en el MISMO commit
// o el build de Railway falla con frozen lockfile.
type EntradaAdmin = { doctorSlug: string | null };

const parserDoctorSlug = {
  _input: null as unknown as EntradaAdmin,
  _output: null as unknown as EntradaAdmin,
  parseAsync: async (raw: unknown): Promise<EntradaAdmin> => {
    const slug = (raw as { doctorSlug?: unknown } | null)?.doctorSlug;
    if (slug === null || slug === undefined) return { doctorSlug: null };
    if (typeof slug !== "string" || slug.length === 0) {
      throw new Error("doctorSlug inválido");
    }
    return { doctorSlug: slug };
  },
};

// Middleware compartido de los 4 endpoints del admin.
//
// Dos diferencias deliberadas con `doctor` y `api`:
//
//  1. El tope POR ARCHIVO (25MB / 200MB video) SÍ se aplica. No es un límite
//     comercial, es "no subas un archivo absurdo", y vale para todos.
//
//  2. El cupo de la CUENTA se APUNTA pero NO se rechaza (decisión del usuario
//     2026-09-13, opción B). El cupo es un límite al CLIENTE; el staff actuando
//     en su nombre no debería quedar bloqueado por él a media alta. Si el admin
//     obedeciera el cupo, dar de alta a un doctor FREE podría fallar en el botón
//     de subir —un video de 200MB es el 40% de sus 500MB— y no habría forma de
//     terminar de onboardearlo sin subirle el plan primero.
//     El libro mayor queda COMPLETO igual: nada deja de medirse.
//     Para volver a la opción A: llamar `assertStorageQuota` aquí.
//
// `doctorSlug` viene null en el alta (`/doctors/new`): ahí el doctor TODAVÍA no
// existe, no hay a quién cobrarle y no hay fila a la que apuntar. Esos archivos
// se cobran cuando se crea el doctor, en el POST /api/doctors.
const authMiddleware = async ({
  files,
  input,
}: {
  // `readonly`: es lo que entrega uploadthing (`readonly FileUploadData[]`).
  files: readonly ArchivoEntrante[];
  input: EntradaAdmin;
}) => {
  const session = await auth();
  if (!session?.user?.email) {
    throw new UploadThingError({ code: "FORBIDDEN", message: "Necesitas iniciar sesión." });
  }

  // 🔴 El rol SE COMPRUEBA AQUÍ, y no es opcional.
  //
  // `apps/admin/src/middleware.ts` exime `/api/uploadthing` (tiene que hacerlo:
  // el callback de uploadthing llega sin cookie de sesión), y `AdminGuard` es un
  // componente de CLIENTE — no protege una ruta de API. O sea que hasta ahora el
  // único filtro era "cualquier sesión con correo", y el `signIn` de
  // `@healthcare/auth` acepta CUALQUIER cuenta de Google (le asigna rol DOCTOR).
  //
  // Sin esta línea, con el `.input()` que agrega Q4 cualquier usuario logueado
  // podría subir archivos ELIGIENDO a qué doctor cobrárselos, y además sin tope
  // de cuenta (decisión B: en admin se APUNTA pero no se rechaza). Es decir:
  // llenarle el plan a un doctor ajeno. Todas las demás escrituras del admin ya
  // pasan por `requireAdminAuth` en `apps/api`; esta ruta era la excepción.
  const role = (session.user as { role?: string }).role;
  if (role !== "ADMIN") {
    throw new UploadThingError({
      code: "FORBIDDEN",
      message: "Sólo un administrador puede subir archivos al perfil de un doctor.",
    });
  }

  for (const a of files) {
    const tope = maxBytesForMime(a.type);
    if (a.size > tope) {
      // Se traduce a `UploadThingError` o la librería lo sepulta bajo un
      // "Failed to run middleware" (ver `explicarRechazoDeSubida`).
      const e = new FileTooLargeError(tope, a.size, a.name);
      const rechazo = explicarRechazoDeSubida(e);
      throw new UploadThingError({
        code: "TOO_LARGE",
        message: rechazo ? rechazo.mensaje : e.message,
        cause: e,
      });
    }
  }

  let doctorId: string | null = null;
  if (input.doctorSlug) {
    const doctor = await prisma.doctor.findUnique({
      where: { slug: input.doctorSlug },
      select: { id: true },
    });
    // Traducido, o uploadthing lo sepulta bajo "Failed to run middleware".
    if (!doctor) {
      throw new UploadThingError({
        code: "NOT_FOUND",
        message: `No existe el doctor "${input.doctorSlug}".`,
      });
    }
    doctorId = doctor.id;
  }

  return { userId: session.user.id, doctorId };
};

// Apunta el archivo al doctor destino. Si no hay doctor todavía (alta), no hay
// nada que apuntar: lo cobra el POST /api/doctors al crear la fila.
//
// Se registra `ufsUrl` y no `url`: en v7 son strings DISTINTAS para el mismo
// archivo, y el UNIQUE que evita contar doble vive sobre esa columna. El
// acumulador del alta manda también `ufsUrl`, para que las dos vías escriban la
// MISMA llave.
const alSubir =
  (kind: string) =>
  async ({
    metadata,
    file,
  }: {
    metadata: { doctorId: string | null };
    file: { key: string; ufsUrl: string; size: number };
  }) => {
    if (metadata.doctorId) {
      await registrarArchivo(prisma, metadata.doctorId, {
        key: file.key,
        url: file.ufsUrl,
        size: file.size,
        kind,
      });
    }
    return { uploadedBy: "admin" };
  };

// FileRouter for doctor profile uploads
export const ourFileRouter = {
  // Hero image uploader (doctor profile photo)
  doctorHeroImage: f({
    image: {
      maxFileSize: "4MB",
      maxFileCount: 1
    }
  })
    .input(parserDoctorSlug)
    .middleware(authMiddleware)
    .onUploadComplete(alSubir("doctorHeroImage")),

  // Certificate images uploader (diplomas, certifications)
  doctorCertificates: f({
    image: {
      maxFileSize: "16MB",
      maxFileCount: 20
    }
  })
    .input(parserDoctorSlug)
    .middleware(authMiddleware)
    .onUploadComplete(alSubir("doctorCertificates")),

  // Clinic photos uploader (clinic interior, equipment)
  clinicPhotos: f({
    image: {
      maxFileSize: "8MB",
      maxFileCount: 20
    }
  })
    .input(parserDoctorSlug)
    .middleware(authMiddleware)
    .onUploadComplete(alSubir("clinicPhotos")),

  // Video uploader (intro videos, facility tours)
  // 1GB → 256MB aquí, 200MB de verdad en el middleware (Q4). `FileSize` sólo
  // admite potencias de 2, así que va el permitido INMEDIATAMENTE SUPERIOR al
  // tope real: con 128MB la librería rechazaría antes y con peor mensaje.
  doctorVideos: f({
    video: {
      maxFileSize: "256MB",
      maxFileCount: 5
    }
  })
    .input(parserDoctorSlug)
    .middleware(authMiddleware)
    .onUploadComplete(alSubir("doctorVideos")),
} satisfies FileRouter;

export type OurFileRouter = typeof ourFileRouter;
