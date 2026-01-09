import { createUploadthing, type FileRouter } from "uploadthing/next";

const f = createUploadthing({
  errorFormatter: (err) => {
    console.log("UploadThing Error:", err.message);
    console.log("  - Above error caused by:", err.cause);
    return { message: err.message };
  },
});

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
    .onUploadComplete(async ({ file }) => {
      console.log("Ledger attachment uploaded:", file.url);
      return { uploadedBy: "doctor" };
    }),

  // PDF invoices (facturas in PDF format)
  ledgerFacturasPdf: f({
    pdf: {
      maxFileSize: "16MB",
      maxFileCount: 5
    }
  })
    .onUploadComplete(async ({ file }) => {
      console.log("PDF factura uploaded:", file.url);
      return { uploadedBy: "doctor" };
    }),

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
    .onUploadComplete(async ({ file }) => {
      console.log("XML factura uploaded:", file.url);
      return { uploadedBy: "doctor" };
    }),

  // ============================================================================
  // MEDICAL RECORDS MEDIA
  // ============================================================================

  // Medical images (patient photos, wounds, X-rays, lab results, etc.)
  medicalImages: f({
    image: {
      maxFileSize: "10MB",
      maxFileCount: 10
    }
  })
    .onUploadComplete(async ({ file }) => {
      console.log("Medical image uploaded:", file.url);
      return { uploadedBy: "doctor", mediaType: "image" };
    }),

  // Medical videos (procedures, examinations, etc.)
  medicalVideos: f({
    video: {
      maxFileSize: "100MB",
      maxFileCount: 5
    }
  })
    .onUploadComplete(async ({ file }) => {
      console.log("Medical video uploaded:", file.url);
      return { uploadedBy: "doctor", mediaType: "video" };
    }),

  // Medical audio (voice notes, recordings, etc.)
  medicalAudio: f({
    audio: {
      maxFileSize: "20MB",
      maxFileCount: 10
    }
  })
    .onUploadComplete(async ({ file }) => {
      console.log("Medical audio uploaded:", file.url);
      return { uploadedBy: "doctor", mediaType: "audio" };
    }),
} satisfies FileRouter;

export type OurFileRouter = typeof ourFileRouter;
