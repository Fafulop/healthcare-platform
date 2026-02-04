import {
  generateUploadButton,
  generateUploadDropzone,
} from "@uploadthing/react";

import type { OurFileRouter } from "../../../api/src/app/api/uploadthing/core";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3003";

export const UploadButton = generateUploadButton<OurFileRouter>({
  url: `${API_URL}/api/uploadthing`,
});

export const UploadDropzone = generateUploadDropzone<OurFileRouter>({
  url: `${API_URL}/api/uploadthing`,
});
