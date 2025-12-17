import { createUploadthing, type FileRouter } from "uploadthing/next";

const f = createUploadthing({
  /**
   * Log out more information about the error, but don't return it to the client
   * @see https://docs.uploadthing.com/errors#error-formatting
   */
  errorFormatter: (err) => {
    console.log("UploadThing Error:", err.message);
    console.log("  - Above error caused by:", err.cause);

    return { message: err.message };
  },
});

// FileRouter for doctor profile uploads
export const ourFileRouter = {
  // Hero image uploader (doctor profile photo)
  doctorHeroImage: f({
    image: {
      maxFileSize: "4MB",
      maxFileCount: 1
    }
  })
    .onUploadComplete(async ({ file }) => {
      console.log("Hero image uploaded:", file.ufsUrl);
      return { uploadedBy: "admin" };
    }),

  // Certificate images uploader (diplomas, certifications)
  doctorCertificates: f({
    image: {
      maxFileSize: "16MB",
      maxFileCount: 20
    }
  })
    .onUploadComplete(async ({ file }) => {
      console.log("Certificate uploaded:", file.ufsUrl);
      return { uploadedBy: "admin" };
    }),

  // Clinic photos uploader (clinic interior, equipment)
  clinicPhotos: f({
    image: {
      maxFileSize: "8MB",
      maxFileCount: 20
    }
  })
    .onUploadComplete(async ({ file }) => {
      console.log("Clinic photo uploaded:", file.ufsUrl);
      return { uploadedBy: "admin" };
    }),

  // Video uploader (intro videos, facility tours)
  doctorVideos: f({
    video: {
      maxFileSize: "64MB",
      maxFileCount: 5
    }
  })
    .onUploadComplete(async ({ file }) => {
      console.log("Video uploaded:", file.ufsUrl);
      return { uploadedBy: "admin" };
    }),
} satisfies FileRouter;

export type OurFileRouter = typeof ourFileRouter;
