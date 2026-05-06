import { createUploadthing, type FileRouter } from "uploadthing/next";
import { auth } from "@healthcare/auth";

const f = createUploadthing({
  errorFormatter: (err) => {
    console.log("UploadThing Error:", err.message);
    console.log("  - Above error caused by:", err.cause);
    return { message: err.message };
  },
});

// Shared auth middleware — rejects uploads from unauthenticated users.
const authMiddleware = async () => {
  const session = await auth();
  if (!session?.user?.email) throw new Error("Unauthorized");
  return { userId: session.user.id };
};

export const ourFileRouter = {
  // ============================================================================
  // PRACTICE LEDGER
  // ============================================================================

  ledgerAttachments: f({
    image: { maxFileSize: "8MB", maxFileCount: 10 },
    pdf: { maxFileSize: "16MB", maxFileCount: 10 },
  }).middleware(authMiddleware).onUploadComplete(async ({ file }) => {
    console.log("Ledger attachment uploaded:", file.ufsUrl);
    return { uploadedBy: "doctor" };
  }),

  ledgerFacturasPdf: f({
    pdf: { maxFileSize: "16MB", maxFileCount: 5 },
  }).middleware(authMiddleware).onUploadComplete(async ({ file }) => {
    console.log("PDF factura uploaded:", file.ufsUrl);
    return { uploadedBy: "doctor" };
  }),

  ledgerFacturasXml: f({
    "application/xml": { maxFileSize: "2MB", maxFileCount: 5 },
    "text/xml": { maxFileSize: "2MB", maxFileCount: 5 },
  }).middleware(authMiddleware).onUploadComplete(async ({ file }) => {
    console.log("XML factura uploaded:", file.ufsUrl);
    return { uploadedBy: "doctor" };
  }),

  // ============================================================================
  // MEDICAL RECORDS MEDIA
  // ============================================================================

  medicalImages: f({
    image: { maxFileSize: "16MB", maxFileCount: 10 },
  }).middleware(authMiddleware).onUploadComplete(async ({ file }) => {
    console.log("Medical image uploaded:", file.ufsUrl);
    return { uploadedBy: "doctor", mediaType: "image" };
  }),

  medicalVideos: f({
    video: { maxFileSize: "128MB", maxFileCount: 5 },
  }).middleware(authMiddleware).onUploadComplete(async ({ file }) => {
    console.log("Medical video uploaded:", file.ufsUrl);
    return { uploadedBy: "doctor", mediaType: "video" };
  }),

  medicalAudio: f({
    audio: { maxFileSize: "32MB", maxFileCount: 10 },
  }).middleware(authMiddleware).onUploadComplete(async ({ file }) => {
    console.log("Medical audio uploaded:", file.ufsUrl);
    return { uploadedBy: "doctor", mediaType: "audio" };
  }),

  medicalDocuments: f({
    pdf: { maxFileSize: "32MB", maxFileCount: 10 },
  }).middleware(authMiddleware).onUploadComplete(async ({ file }) => {
    console.log("Medical document uploaded:", file.ufsUrl);
    return { uploadedBy: "doctor", mediaType: "document" };
  }),

  // ============================================================================
  // DOCTOR PROFILE MEDIA
  // ============================================================================

  doctorHeroImage: f({
    image: { maxFileSize: "4MB", maxFileCount: 1 },
  }).middleware(authMiddleware).onUploadComplete(async ({ file }) => {
    console.log("Hero image uploaded:", file.ufsUrl);
    return { uploadedBy: "doctor" };
  }),

  doctorCertificates: f({
    image: { maxFileSize: "16MB", maxFileCount: 20 },
  }).middleware(authMiddleware).onUploadComplete(async ({ file }) => {
    console.log("Certificate uploaded:", file.ufsUrl);
    return { uploadedBy: "doctor" };
  }),

  clinicPhotos: f({
    image: { maxFileSize: "8MB", maxFileCount: 20 },
  }).middleware(authMiddleware).onUploadComplete(async ({ file }) => {
    console.log("Clinic photo uploaded:", file.ufsUrl);
    return { uploadedBy: "doctor" };
  }),

  doctorVideos: f({
    video: { maxFileSize: "1GB", maxFileCount: 5 },
  }).middleware(authMiddleware).onUploadComplete(async ({ file }) => {
    console.log("Video uploaded:", file.ufsUrl);
    return { uploadedBy: "doctor" };
  }),

  // ============================================================================
  // BLOG
  // ============================================================================

  blogImages: f({
    image: { maxFileSize: "8MB", maxFileCount: 1 },
  }).middleware(authMiddleware).onUploadComplete(async ({ file }) => {
    console.log("Blog image uploaded:", file.ufsUrl);
    return { uploadedBy: "doctor" };
  }),

  // ============================================================================
  // PRESCRIPTION PDF TEMPLATE
  // ============================================================================

  prescriptionLogo: f({
    image: { maxFileSize: "4MB", maxFileCount: 1 },
  }).middleware(authMiddleware).onUploadComplete(async ({ file }) => {
    console.log("Prescription logo uploaded:", file.ufsUrl);
    return { uploadedBy: "doctor" };
  }),

  prescriptionSignature: f({
    image: { maxFileSize: "2MB", maxFileCount: 1 },
  }).middleware(authMiddleware).onUploadComplete(async ({ file }) => {
    console.log("Prescription signature uploaded:", file.ufsUrl);
    return { uploadedBy: "doctor" };
  }),
} satisfies FileRouter;

export type OurFileRouter = typeof ourFileRouter;
