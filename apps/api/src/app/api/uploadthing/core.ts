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
} satisfies FileRouter;

export type OurFileRouter = typeof ourFileRouter;
