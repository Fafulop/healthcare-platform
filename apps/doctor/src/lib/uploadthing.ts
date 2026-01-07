import { generateReactHelpers } from "@uploadthing/react";

// Connect to the API app's UploadThing endpoint
const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3003';

export const { useUploadThing, uploadFiles } = generateReactHelpers({
  url: `${API_URL}/api/uploadthing`,
});
