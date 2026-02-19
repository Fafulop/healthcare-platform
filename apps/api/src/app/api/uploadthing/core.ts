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
      maxFileSize: "16MB",
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
      maxFileSize: "128MB",
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
      maxFileSize: "32MB",
      maxFileCount: 10
    }
  })
    .onUploadComplete(async ({ file }) => {
      console.log("Medical audio uploaded:", file.url);
      return { uploadedBy: "doctor", mediaType: "audio" };
    }),

  // Medical documents (PDFs: lab results, reports, referrals, etc.)
  medicalDocuments: f({
    pdf: {
      maxFileSize: "32MB",
      maxFileCount: 10
    }
  })
    .onUploadComplete(async ({ file }) => {
      console.log("Medical document uploaded:", file.url);
      return { uploadedBy: "doctor", mediaType: "document" };
    }),
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
    .onUploadComplete(async ({ file }) => {
      console.log("Hero image uploaded:", file.url);
      return { uploadedBy: "doctor" };
    }),

  // Certificate images uploader (diplomas, certifications)
  doctorCertificates: f({
    image: {
      maxFileSize: "16MB",
      maxFileCount: 20
    }
  })
    .onUploadComplete(async ({ file }) => {
      console.log("Certificate uploaded:", file.url);
      return { uploadedBy: "doctor" };
    }),

  // Clinic photos uploader (clinic interior, equipment)
  clinicPhotos: f({
    image: {
      maxFileSize: "8MB",
      maxFileCount: 20
    }
  })
    .onUploadComplete(async ({ file }) => {
      console.log("Clinic photo uploaded:", file.url);
      return { uploadedBy: "doctor" };
    }),

  // Video uploader (intro videos, facility tours)
  doctorVideos: f({
    video: {
      maxFileSize: "64MB",
      maxFileCount: 5
    }
  })
    .onUploadComplete(async ({ file }) => {
      console.log("Video uploaded:", file.url);
      return { uploadedBy: "doctor" };
    }),
} satisfies FileRouter;

export type OurFileRouter = typeof ourFileRouter;
