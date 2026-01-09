'use client';

import { useState, useEffect } from 'react';
import { use } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Plus, Loader2 } from 'lucide-react';
import Link from 'next/link';
import { MediaGallery } from '@/components/medical-records/MediaGallery';
import { MediaViewer } from '@/components/medical-records/MediaViewer';

interface Media {
  id: string;
  mediaType: 'image' | 'video' | 'audio';
  fileName: string;
  fileUrl: string;
  thumbnailUrl?: string | null;
  category?: string | null;
  bodyArea?: string | null;
  captureDate: Date | string;
  description?: string | null;
  doctorNotes?: string | null;
  encounterId?: string | null;
}

interface Patient {
  id: string;
  firstName: string;
  lastName: string;
  internalId: string;
}

export default function MediaGalleryPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params);
  const router = useRouter();
  const [media, setMedia] = useState<Media[]>([]);
  const [patient, setPatient] = useState<Patient | null>(null);
  const [selectedMedia, setSelectedMedia] = useState<Media | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, [resolvedParams.id]);

  const fetchData = async () => {
    try {
      // Fetch patient info and media in parallel
      const [patientRes, mediaRes] = await Promise.all([
        fetch(`/api/medical-records/patients/${resolvedParams.id}`),
        fetch(`/api/medical-records/patients/${resolvedParams.id}/media`)
      ]);

      if (!patientRes.ok || !mediaRes.ok) {
        throw new Error('Failed to fetch data');
      }

      const patientData = await patientRes.json();
      const mediaData = await mediaRes.json();

      setPatient(patientData.data);
      setMedia(mediaData.data);
    } catch (error) {
      console.error('Error fetching data:', error);
      alert('Failed to load media gallery');
    } finally {
      setIsLoading(false);
    }
  };

  const handleMediaClick = (mediaItem: Media) => {
    setSelectedMedia(mediaItem);
  };

  const handleCloseViewer = () => {
    setSelectedMedia(null);
  };

  const handleMediaDelete = () => {
    // Refresh media list after deletion
    fetchData();
  };

  const handleMediaUpdate = () => {
    // Refresh media list after update
    fetchData();
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  if (!patient) {
    return (
      <div className="p-6">
        <p className="text-red-600">Patient not found</p>
      </div>
    );
  }

  return (
    <div className="p-6">
      {/* Header */}
      <div className="mb-6">
        <Link
          href={`/dashboard/medical-records/patients/${resolvedParams.id}`}
          className="inline-flex items-center text-blue-600 hover:text-blue-700 mb-4"
        >
          <ArrowLeft className="w-4 h-4 mr-1" />
          Back to Patient
        </Link>

        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              Media Gallery
            </h1>
            <p className="text-gray-600">
              {patient.firstName} {patient.lastName} (ID: {patient.internalId})
            </p>
          </div>

          <Link
            href={`/dashboard/medical-records/patients/${resolvedParams.id}/media/upload`}
            className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 flex items-center gap-2"
          >
            <Plus className="w-5 h-5" />
            Upload Media
          </Link>
        </div>
      </div>

      {/* Media Gallery */}
      {media.length > 0 ? (
        <MediaGallery
          media={media}
          patientId={resolvedParams.id}
          onMediaClick={handleMediaClick}
          showFilters={true}
        />
      ) : (
        <div className="bg-white rounded-lg shadow p-12 text-center">
          <p className="text-gray-500 mb-4">No media uploaded yet</p>
          <Link
            href={`/dashboard/medical-records/patients/${resolvedParams.id}/media/upload`}
            className="inline-flex items-center bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700"
          >
            <Plus className="w-5 h-5 mr-2" />
            Upload First Media
          </Link>
        </div>
      )}

      {/* Media Viewer Modal */}
      {selectedMedia && (
        <MediaViewer
          media={selectedMedia}
          patientId={resolvedParams.id}
          onClose={handleCloseViewer}
          onDelete={handleMediaDelete}
          onUpdate={handleMediaUpdate}
        />
      )}
    </div>
  );
}
