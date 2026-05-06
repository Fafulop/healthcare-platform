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

// FileRouter for doctor profile uploads
export const ourFileRouter = {
  // Hero image uploader (doctor profile photo)
  doctorHeroImage: f({
    image: {
      maxFileSize: "4MB",
      maxFileCount: 1
    }
  })
    .middleware(authMiddleware)
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
    .middleware(authMiddleware)
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
    .middleware(authMiddleware)
    .onUploadComplete(async ({ file }) => {
      console.log("Clinic photo uploaded:", file.ufsUrl);
      return { uploadedBy: "admin" };
    }),

  // Video uploader (intro videos, facility tours)
  doctorVideos: f({
    video: {
      maxFileSize: "1GB",
      maxFileCount: 5
    }
  })
    .middleware(authMiddleware)
    .onUploadComplete(async ({ file }) => {
      console.log("Video uploaded:", file.ufsUrl);
      return { uploadedBy: "admin" };
    }),
} satisfies FileRouter;

export type OurFileRouter = typeof ourFileRouter;
