"use client";

import { useRef, useState } from 'react';
import { useUploadThing } from '@/lib/uploadthing';
import { ImageIcon, Loader2, X, RefreshCw } from 'lucide-react';

interface ThumbnailUploadProps {
  value: string;
  onChange: (url: string) => void;
}

export default function ThumbnailUpload({ value, onChange }: ThumbnailUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const { startUpload, isUploading } = useUploadThing('blogImages');

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';
    setUploadError(null);

    try {
      const result = await startUpload([file]);
      if (!result || result.length === 0) throw new Error();
      const url = result[0]?.url;
      if (!url) throw new Error();
      onChange(url);
    } catch {
      setUploadError('No se pudo subir la imagen. Intenta de nuevo.');
    }
  };

  return (
    <div>
      {value ? (
        <div className="relative w-full max-w-xs">
          <img
            src={value}
            alt="Thumbnail"
            className="w-full h-48 object-cover rounded-lg border border-gray-200"
            onError={(e) => { e.currentTarget.style.display = 'none'; }}
          />
          <div className="absolute top-2 right-2 flex gap-1">
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              disabled={isUploading}
              title="Cambiar imagen"
              className="p-1.5 bg-white rounded-md shadow text-gray-600 hover:text-gray-900 disabled:opacity-50"
            >
              {isUploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
            </button>
            <button
              type="button"
              onClick={() => onChange('')}
              title="Eliminar imagen"
              className="p-1.5 bg-white rounded-md shadow text-gray-600 hover:text-red-600"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={isUploading}
          className="flex items-center gap-2 px-4 py-2 border border-dashed border-gray-300 rounded-lg text-sm text-gray-600 hover:border-green-400 hover:text-green-600 transition-colors disabled:opacity-50"
        >
          {isUploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <ImageIcon className="w-4 h-4" />}
          {isUploading ? 'Subiendo...' : 'Subir imagen de portada'}
        </button>
      )}

      {uploadError && (
        <p className="mt-2 text-xs text-red-600">{uploadError}</p>
      )}

      {/* Single input shared by both states — avoids stale ref when switching between empty/preview */}
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleFileChange}
      />
    </div>
  );
}
