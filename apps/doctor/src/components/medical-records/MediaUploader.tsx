'use client';

import { useState, useEffect } from 'react';
import { Upload, X, Image as ImageIcon, Video, Mic, Loader2 } from 'lucide-react';
import { useUploadThing } from '@/lib/uploadthing';

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
  'Head',
  'Neck',
  'Chest',
  'Abdomen',
  'Back',
  'Right Arm',
  'Left Arm',
  'Right Leg',
  'Left Leg',
  'Right Hand',
  'Left Hand',
  'Right Foot',
  'Left Foot',
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
      setError('Please select at least one file');
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
        throw new Error('Upload failed');
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
          throw new Error('Failed to save media record');
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
      setError(err.message || 'Failed to upload media');
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
      <h2 className="text-xl font-semibold mb-4">Upload Media</h2>

      {/* File Selection */}
      <div className="mb-6">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Select Files
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
              Click to upload or drag and drop
            </p>
            <p className="text-xs text-gray-500">
              {mediaType === 'image' && 'Images up to 10MB'}
              {mediaType === 'video' && 'Videos up to 100MB'}
              {mediaType === 'audio' && 'Audio up to 20MB'}
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
              Category
            </label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full border border-gray-300 rounded-md px-3 py-2"
              disabled={isUploading}
            >
              <option value="">Select category...</option>
              {CATEGORIES.map(cat => (
                <option key={cat} value={cat}>
                  {cat.charAt(0).toUpperCase() + cat.slice(1)}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Body Area
            </label>
            <select
              value={bodyArea}
              onChange={(e) => setBodyArea(e.target.value)}
              className="w-full border border-gray-300 rounded-md px-3 py-2"
              disabled={isUploading}
            >
              <option value="">Select area...</option>
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
            Link to Encounter (Optional)
          </label>
          <select
            value={selectedEncounterId}
            onChange={(e) => setSelectedEncounterId(e.target.value)}
            className="w-full border border-gray-300 rounded-md px-3 py-2"
            disabled={isUploading || propEncounterId !== undefined}
          >
            <option value="">No encounter selected</option>
            {encounters.map(encounter => (
              <option key={encounter.id} value={encounter.id}>
                {new Date(encounter.encounterDate).toLocaleDateString('es-MX')} - {encounter.chiefComplaint}
              </option>
            ))}
          </select>
          {propEncounterId && (
            <p className="text-xs text-gray-500 mt-1">
              Media will be linked to the current encounter
            </p>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Description
          </label>
          <input
            type="text"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Brief description of the media..."
            className="w-full border border-gray-300 rounded-md px-3 py-2"
            disabled={isUploading}
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Doctor Notes (Private)
          </label>
          <textarea
            value={doctorNotes}
            onChange={(e) => setDoctorNotes(e.target.value)}
            placeholder="Clinical observations, interpretations..."
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
            Cancel
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
              Uploading...
            </>
          ) : (
            <>
              <Upload className="w-4 h-4" />
              Upload
            </>
          )}
        </button>
      </div>
    </div>
  );
}
