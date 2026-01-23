'use client';

import { useState, useEffect } from 'react';
import { Upload, X, Image as ImageIcon, Video, Mic, Loader2 } from 'lucide-react';
import { useUploadThing } from '@/lib/uploadthing';

// Helper to format date string for display (fixes timezone issues)
function formatDateString(dateStr: string, locale: string = 'es-MX'): string {
  try {
    const [year, month, day] = dateStr.split('-').map(Number);
    if (year && month && day) {
      const date = new Date(year, month - 1, day); // month is 0-indexed
      return date.toLocaleDateString(locale);
    }
    return dateStr;
  } catch {
    return dateStr;
  }
}

interface MediaUploaderProps {
  patientId: string;
  encounterId?: string;
  onUploadComplete?: (mediaId: string) => void;
  onCancel?: () => void;
}

type MediaType = 'image' | 'video' | 'audio';

interface Encounter {
  id: string;
  encounterDate: string;
  encounterType: string;
  chiefComplaint: string;
}

const CATEGORIES = [
  'wound',
  'x-ray',
  'dermatology',
  'lab-result',
  'procedure',
  'consultation',
  'other'
];

const BODY_AREAS = [
  'Cabeza',
  'Cuello',
  'Pecho',
  'Abdomen',
  'Espalda',
  'Brazo Derecho',
  'Brazo Izquierdo',
  'Pierna Derecha',
  'Pierna Izquierda',
  'Mano Derecha',
  'Mano Izquierda',
  'Pie Derecho',
  'Pie Izquierdo',
];

export function MediaUploader({ patientId, encounterId: propEncounterId, onUploadComplete, onCancel }: MediaUploaderProps) {
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [mediaType, setMediaType] = useState<MediaType>('image');
  const [category, setCategory] = useState('');
  const [bodyArea, setBodyArea] = useState('');
  const [description, setDescription] = useState('');
  const [doctorNotes, setDoctorNotes] = useState('');
  const [selectedEncounterId, setSelectedEncounterId] = useState<string>(propEncounterId || '');
  const [encounters, setEncounters] = useState<Encounter[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // UploadThing hooks for different media types
  const { startUpload: uploadImages } = useUploadThing('medicalImages');
  const { startUpload: uploadVideos } = useUploadThing('medicalVideos');
  const { startUpload: uploadAudio } = useUploadThing('medicalAudio');

  // Fetch patient encounters for linking
  useEffect(() => {
    const fetchEncounters = async () => {
      try {
        const response = await fetch(`/api/medical-records/patients/${patientId}`);
        if (response.ok) {
          const data = await response.json();
          setEncounters(data.data.encounters || []);
        }
      } catch (error) {
        console.error('Failed to fetch encounters:', error);
      }
    };

    fetchEncounters();
  }, [patientId]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    // Detect media type from first file
    const firstFile = files[0];
    if (firstFile.type.startsWith('image/')) {
      setMediaType('image');
    } else if (firstFile.type.startsWith('video/')) {
      setMediaType('video');
    } else if (firstFile.type.startsWith('audio/')) {
      setMediaType('audio');
    }

    setSelectedFiles(files);
    setError(null);
  };

  const handleRemoveFile = (index: number) => {
    setSelectedFiles(prev => prev.filter((_, i) => i !== index));
  };

  const handleUpload = async () => {
    if (selectedFiles.length === 0) {
      setError('Por favor selecciona al menos un archivo');
      return;
    }

    setIsUploading(true);
    setError(null);

    try {
      // Step 1: Upload to UploadThing based on media type
      let uploadedFiles;
      if (mediaType === 'image') {
        uploadedFiles = await uploadImages(selectedFiles);
      } else if (mediaType === 'video') {
        uploadedFiles = await uploadVideos(selectedFiles);
      } else {
        uploadedFiles = await uploadAudio(selectedFiles);
      }

      if (!uploadedFiles || uploadedFiles.length === 0) {
        throw new Error('Error al subir archivo');
      }

      // Step 2: Create media records in database for each uploaded file
      for (const file of uploadedFiles) {
        const response = await fetch(`/api/medical-records/patients/${patientId}/media`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            encounterId: selectedEncounterId || null,
            mediaType,
            fileName: file.name,
            fileUrl: file.url,
            fileSize: file.size,
            mimeType: selectedFiles[0].type, // Use original file type
            category: category || null,
            bodyArea: bodyArea || null,
            captureDate: new Date().toISOString(),
            description: description || null,
            doctorNotes: doctorNotes || null,
            visibility: 'internal',
          }),
        });

        if (!response.ok) {
          throw new Error('Error al guardar registro de medios');
        }

        const { data } = await response.json();

        // Notify parent component
        if (onUploadComplete) {
          onUploadComplete(data.id);
        }
      }

      // Reset form
      setSelectedFiles([]);
      setCategory('');
      setBodyArea('');
      setDescription('');
      setDoctorNotes('');

      // Close uploader if cancel handler exists
      if (onCancel) {
        onCancel();
      }
    } catch (err: any) {
      console.error('Upload error:', err);
      setError(err.message || 'Error al subir medios');
    } finally {
      setIsUploading(false);
    }
  };

  const acceptedFileTypes =
    mediaType === 'image' ? 'image/*' :
    mediaType === 'video' ? 'video/*' :
    'audio/*';

  const MediaIcon = mediaType === 'image' ? ImageIcon :
                    mediaType === 'video' ? Video :
                    Mic;

  return (
    <div className="bg-white rounded-lg shadow-lg p-6">
      <h2 className="text-xl font-semibold mb-4">Subir Medios</h2>

      {/* File Selection */}
      <div className="mb-6">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Seleccionar Archivos
        </label>
        <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center hover:border-blue-500 transition-colors">
          <input
            type="file"
            multiple
            accept={acceptedFileTypes}
            onChange={handleFileSelect}
            className="hidden"
            id="file-upload"
            disabled={isUploading}
          />
          <label htmlFor="file-upload" className="cursor-pointer">
            <Upload className="w-12 h-12 text-gray-400 mx-auto mb-2" />
            <p className="text-sm text-gray-600 mb-1">
              Haz clic para subir o arrastra y suelta
            </p>
            <p className="text-xs text-gray-500">
              {mediaType === 'image' && 'Imágenes hasta 10MB'}
              {mediaType === 'video' && 'Videos hasta 100MB'}
              {mediaType === 'audio' && 'Audio hasta 20MB'}
            </p>
          </label>
        </div>

        {/* Selected Files */}
        {selectedFiles.length > 0 && (
          <div className="mt-4 space-y-2">
            {selectedFiles.map((file, index) => (
              <div key={index} className="flex items-center justify-between bg-gray-50 p-3 rounded">
                <div className="flex items-center gap-2">
                  <MediaIcon className="w-5 h-5 text-gray-500" />
                  <span className="text-sm text-gray-700">{file.name}</span>
                  <span className="text-xs text-gray-500">
                    ({(file.size / 1024 / 1024).toFixed(2)} MB)
                  </span>
                </div>
                {!isUploading && (
                  <button
                    onClick={() => handleRemoveFile(index)}
                    className="text-red-500 hover:text-red-700"
                  >
                    <X className="w-5 h-5" />
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Metadata Form */}
      <div className="space-y-4 mb-6">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Categoría
            </label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full border border-gray-300 rounded-md px-3 py-2"
              disabled={isUploading}
            >
              <option value="">Seleccionar categoría...</option>
              {CATEGORIES.map(cat => (
                <option key={cat} value={cat}>
                  {cat.charAt(0).toUpperCase() + cat.slice(1)}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Área del Cuerpo
            </label>
            <select
              value={bodyArea}
              onChange={(e) => setBodyArea(e.target.value)}
              className="w-full border border-gray-300 rounded-md px-3 py-2"
              disabled={isUploading}
            >
              <option value="">Seleccionar área...</option>
              {BODY_AREAS.map(area => (
                <option key={area} value={area}>
                  {area}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Link to Encounter */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Vincular a Consulta (Opcional)
          </label>
          <select
            value={selectedEncounterId}
            onChange={(e) => setSelectedEncounterId(e.target.value)}
            className="w-full border border-gray-300 rounded-md px-3 py-2"
            disabled={isUploading || propEncounterId !== undefined}
          >
            <option value="">Ninguna consulta seleccionada</option>
            {encounters.map(encounter => (
              <option key={encounter.id} value={encounter.id}>
                {formatDateString(encounter.encounterDate, 'es-MX')} - {encounter.chiefComplaint}
              </option>
            ))}
          </select>
          {propEncounterId && (
            <p className="text-xs text-gray-500 mt-1">
              Los medios se vincularán a la consulta actual
            </p>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Descripción
          </label>
          <input
            type="text"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Breve descripción de los medios..."
            className="w-full border border-gray-300 rounded-md px-3 py-2"
            disabled={isUploading}
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Notas del Doctor (Privadas)
          </label>
          <textarea
            value={doctorNotes}
            onChange={(e) => setDoctorNotes(e.target.value)}
            placeholder="Observaciones clínicas, interpretaciones..."
            rows={3}
            className="w-full border border-gray-300 rounded-md px-3 py-2"
            disabled={isUploading}
          />
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded text-red-700 text-sm">
          {error}
        </div>
      )}

      {/* Actions */}
      <div className="flex justify-end gap-3">
        {onCancel && (
          <button
            onClick={onCancel}
            disabled={isUploading}
            className="px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50"
          >
            Cancelar
          </button>
        )}
        <button
          onClick={handleUpload}
          disabled={isUploading || selectedFiles.length === 0}
          className="bg-blue-600 text-white px-6 py-2 rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
        >
          {isUploading ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Subiendo...
            </>
          ) : (
            <>
              <Upload className="w-4 h-4" />
              Subir
            </>
          )}
        </button>
      </div>
    </div>
  );
}
