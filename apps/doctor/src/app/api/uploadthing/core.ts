import { createUploadthing, type FileRouter } from "uploadthing/next";

const f = createUploadthing({
  errorFormatter: (err) => {
    console.log("UploadThing Error:", err.message);
    console.log("  - Above error caused by:", err.cause);
    return { message: err.message };
  },
});

export const ourFileRouter = {
  // ============================================================================
  // PRACTICE LEDGER
  // ============================================================================

  ledgerAttachments: f({
    image: { maxFileSize: "8MB", maxFileCount: 10 },
    pdf: { maxFileSize: "16MB", maxFileCount: 10 },
  }).onUploadComplete(async ({ file }) => {
    console.log("Ledger attachment uploaded:", file.ufsUrl);
    return { uploadedBy: "doctor" };
  }),

  ledgerFacturasPdf: f({
    pdf: { maxFileSize: "16MB", maxFileCount: 5 },
  }).onUploadComplete(async ({ file }) => {
    console.log("PDF factura uploaded:", file.ufsUrl);
    return { uploadedBy: "doctor" };
  }),

  ledgerFacturasXml: f({
    "application/xml": { maxFileSize: "2MB", maxFileCount: 5 },
    "text/xml": { maxFileSize: "2MB", maxFileCount: 5 },
  }).onUploadComplete(async ({ file }) => {
    console.log("XML factura uploaded:", file.ufsUrl);
    return { uploadedBy: "doctor" };
  }),

  // ============================================================================
  // MEDICAL RECORDS MEDIA
  // ============================================================================

  medicalImages: f({
    image: { maxFileSize: "16MB", maxFileCount: 10 },
  }).onUploadComplete(async ({ file }) => {
    console.log("Medical image uploaded:", file.ufsUrl);
    return { uploadedBy: "doctor", mediaType: "image" };
  }),

  medicalVideos: f({
    video: { maxFileSize: "128MB", maxFileCount: 5 },
  }).onUploadComplete(async ({ file }) => {
    console.log("Medical video uploaded:", file.ufsUrl);
    return { uploadedBy: "doctor", mediaType: "video" };
  }),

  medicalAudio: f({
    audio: { maxFileSize: "32MB", maxFileCount: 10 },
  }).onUploadComplete(async ({ file }) => {
    console.log("Medical audio uploaded:", file.ufsUrl);
    return { uploadedBy: "doctor", mediaType: "audio" };
  }),

  medicalDocuments: f({
    pdf: { maxFileSize: "32MB", maxFileCount: 10 },
  }).onUploadComplete(async ({ file }) => {
    console.log("Medical document uploaded:", file.ufsUrl);
    return { uploadedBy: "doctor", mediaType: "document" };
  }),

  // ============================================================================
  // DOCTOR PROFILE MEDIA
  // ============================================================================

  doctorHeroImage: f({
    image: { maxFileSize: "4MB", maxFileCount: 1 },
  }).onUploadComplete(async ({ file }) => {
    console.log("Hero image uploaded:", file.ufsUrl);
    return { uploadedBy: "doctor" };
  }),

  doctorCertificates: f({
    image: { maxFileSize: "16MB", maxFileCount: 20 },
  }).onUploadComplete(async ({ file }) => {
    console.log("Certificate uploaded:", file.ufsUrl);
    return { uploadedBy: "doctor" };
  }),

  clinicPhotos: f({
    image: { maxFileSize: "8MB", maxFileCount: 20 },
  }).onUploadComplete(async ({ file }) => {
    console.log("Clinic photo uploaded:", file.ufsUrl);
    return { uploadedBy: "doctor" };
  }),

  doctorVideos: f({
    video: { maxFileSize: "64MB", maxFileCount: 5 },
  }).onUploadComplete(async ({ file }) => {
    console.log("Video uploaded:", file.ufsUrl);
    return { uploadedBy: "doctor" };
  }),
} satisfies FileRouter;

export type OurFileRouter = typeof ourFileRouter;
