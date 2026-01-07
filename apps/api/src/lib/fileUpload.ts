/**
 * File Upload Utility
 * Handles file uploads to cloud storage (Cloudinary)
 */

interface UploadResult {
  url: string;
  fileName: string;
  fileSize: number;
  fileType: string;
}

/**
 * Upload file to Cloudinary
 * Requires environment variables:
 * - CLOUDINARY_CLOUD_NAME
 * - CLOUDINARY_API_KEY
 * - CLOUDINARY_API_SECRET
 */
export async function uploadToCloudinary(
  file: File,
  folder: string = 'ledger'
): Promise<UploadResult> {
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
  const apiKey = process.env.CLOUDINARY_API_KEY;
  const apiSecret = process.env.CLOUDINARY_API_SECRET;

  if (!cloudName || !apiKey || !apiSecret) {
    throw new Error('Cloudinary credentials not configured');
  }

  // Convert File to Buffer
  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  // Create form data for Cloudinary
  const formData = new FormData();
  formData.append('file', new Blob([buffer]), file.name);
  formData.append('upload_preset', 'ml_default'); // Use your upload preset
  formData.append('folder', folder);
  formData.append('resource_type', 'auto'); // Auto-detect file type

  // Upload to Cloudinary
  const response = await fetch(
    `https://api.cloudinary.com/v1_1/${cloudName}/upload`,
    {
      method: 'POST',
      body: formData
    }
  );

  if (!response.ok) {
    const error = await response.json();
    throw new Error(`Error al subir archivo: ${error.error?.message || 'Error desconocido'}`);
  }

  const result = await response.json();

  return {
    url: result.secure_url,
    fileName: file.name,
    fileSize: file.size,
    fileType: file.type || 'application/octet-stream'
  };
}

/**
 * Alternative: Upload file to local storage (for development)
 * Stores files in public/uploads directory
 */
export async function uploadToLocal(
  file: File,
  folder: string = 'ledger'
): Promise<UploadResult> {
  const fs = require('fs').promises;
  const path = require('path');

  // Create uploads directory if it doesn't exist
  const uploadsDir = path.join(process.cwd(), 'public', 'uploads', folder);
  await fs.mkdir(uploadsDir, { recursive: true });

  // Generate unique filename
  const timestamp = Date.now();
  const sanitizedName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
  const fileName = `${timestamp}-${sanitizedName}`;
  const filePath = path.join(uploadsDir, fileName);

  // Write file to disk
  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  await fs.writeFile(filePath, buffer);

  // Return relative URL
  const url = `/uploads/${folder}/${fileName}`;

  return {
    url,
    fileName: file.name,
    fileSize: file.size,
    fileType: file.type || 'application/octet-stream'
  };
}

/**
 * Main upload function - uses Cloudinary if configured, otherwise local storage
 */
export async function uploadFile(
  file: File,
  folder: string = 'ledger'
): Promise<UploadResult> {
  // Validate file
  if (!file || file.size === 0) {
    throw new Error('Archivo vacío o inválido');
  }

  // Check file size (max 50MB)
  const maxSize = 50 * 1024 * 1024; // 50MB
  if (file.size > maxSize) {
    throw new Error('El archivo excede el tamaño máximo de 50MB');
  }

  // Use Cloudinary if configured, otherwise use local storage
  const useCloudinary = process.env.CLOUDINARY_CLOUD_NAME &&
    process.env.CLOUDINARY_API_KEY &&
    process.env.CLOUDINARY_API_SECRET;

  if (useCloudinary) {
    return uploadToCloudinary(file, folder);
  } else {
    // Fallback to local storage for development
    console.warn('Cloudinary not configured, using local storage');
    return uploadToLocal(file, folder);
  }
}

/**
 * Validate file type
 */
export function validateFileType(
  file: File,
  allowedTypes: string[]
): boolean {
  if (!file.type) return false;

  return allowedTypes.some(type => {
    // Support wildcards like "image/*"
    if (type.endsWith('/*')) {
      const prefix = type.slice(0, -2);
      return file.type.startsWith(prefix);
    }
    return file.type === type;
  });
}

/**
 * Validate file extension
 */
export function validateFileExtension(
  fileName: string,
  allowedExtensions: string[]
): boolean {
  const ext = fileName.split('.').pop()?.toLowerCase();
  if (!ext) return false;

  return allowedExtensions.includes(ext);
}
