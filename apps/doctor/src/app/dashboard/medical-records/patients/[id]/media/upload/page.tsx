'use client';

import { use, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { MediaUploader } from '@/components/medical-records/MediaUploader';

interface Patient {
  id: string;
  firstName: string;
  lastName: string;
  internalId: string;
}

export default function MediaUploadPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params);
  const router = useRouter();
  const [patient, setPatient] = useState<Patient | null>(null);

  useEffect(() => {
    fetchPatient();
  }, [resolvedParams.id]);

  const fetchPatient = async () => {
    try {
      const response = await fetch(`/api/medical-records/patients/${resolvedParams.id}`);
      if (!response.ok) {
        throw new Error('Failed to fetch patient');
      }
      const data = await response.json();
      setPatient(data.data);
    } catch (error) {
      console.error('Error fetching patient:', error);
      alert('Failed to load patient information');
    }
  };

  const handleUploadComplete = (mediaId: string) => {
    // Redirect to media gallery after successful upload
    router.push(`/dashboard/medical-records/patients/${resolvedParams.id}/media`);
  };

  const handleCancel = () => {
    router.push(`/dashboard/medical-records/patients/${resolvedParams.id}/media`);
  };

  if (!patient) {
    return (
      <div className="p-6">
        <p className="text-gray-600">Loading...</p>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <Link
          href={`/dashboard/medical-records/patients/${resolvedParams.id}/media`}
          className="inline-flex items-center text-blue-600 hover:text-blue-700 mb-4"
        >
          <ArrowLeft className="w-4 h-4 mr-1" />
          Back to Gallery
        </Link>

        <h1 className="text-2xl font-bold text-gray-900 mb-2">
          Upload Media
        </h1>
        <p className="text-gray-600">
          {patient.firstName} {patient.lastName} (ID: {patient.internalId})
        </p>
      </div>

      {/* Upload Component */}
      <MediaUploader
        patientId={resolvedParams.id}
        onUploadComplete={handleUploadComplete}
        onCancel={handleCancel}
      />
    </div>
  );
}
