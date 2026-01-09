'use client';

import { useState } from 'react';
import { X, Edit2, Save, Trash2, Download } from 'lucide-react';

interface MediaViewerProps {
  media: {
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
  };
  patientId: string;
  onClose: () => void;
  onDelete?: (mediaId: string) => void;
  onUpdate?: (mediaId: string) => void;
}

export function MediaViewer({ media, patientId, onClose, onDelete, onUpdate }: MediaViewerProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editedDescription, setEditedDescription] = useState(media.description || '');
  const [editedDoctorNotes, setEditedDoctorNotes] = useState(media.doctorNotes || '');
  const [editedCategory, setEditedCategory] = useState(media.category || '');
  const [editedBodyArea, setEditedBodyArea] = useState(media.bodyArea || '');
  const [isSaving, setIsSaving] = useState(false);

  const captureDate = new Date(media.captureDate);
  const formattedDate = captureDate.toLocaleDateString('es-MX', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const response = await fetch(`/api/medical-records/patients/${patientId}/media/${media.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          description: editedDescription,
          doctorNotes: editedDoctorNotes,
          category: editedCategory,
          bodyArea: editedBodyArea,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to update media');
      }

      setIsEditing(false);
      if (onUpdate) {
        onUpdate(media.id);
      }
    } catch (error) {
      console.error('Error updating media:', error);
      alert('Failed to update media');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm('Are you sure you want to delete this media? This action cannot be undone.')) {
      return;
    }

    try {
      const response = await fetch(`/api/medical-records/patients/${patientId}/media/${media.id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Failed to delete media');
      }

      if (onDelete) {
        onDelete(media.id);
      }
      onClose();
    } catch (error) {
      console.error('Error deleting media:', error);
      alert('Failed to delete media');
    }
  };

  const handleDownload = () => {
    window.open(media.fileUrl, '_blank');
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg max-w-6xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="text-xl font-semibold truncate flex-1">{media.fileName}</h2>
          <div className="flex items-center gap-2">
            <button
              onClick={handleDownload}
              className="p-2 hover:bg-gray-100 rounded-full"
              title="Download"
            >
              <Download className="w-5 h-5" />
            </button>
            {!isEditing ? (
              <button
                onClick={() => setIsEditing(true)}
                className="p-2 hover:bg-gray-100 rounded-full"
                title="Edit"
              >
                <Edit2 className="w-5 h-5" />
              </button>
            ) : (
              <button
                onClick={handleSave}
                disabled={isSaving}
                className="p-2 hover:bg-gray-100 rounded-full disabled:opacity-50"
                title="Save"
              >
                <Save className="w-5 h-5" />
              </button>
            )}
            <button
              onClick={handleDelete}
              className="p-2 hover:bg-red-100 text-red-600 rounded-full"
              title="Delete"
            >
              <Trash2 className="w-5 h-5" />
            </button>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 rounded-full"
              title="Close"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 p-6">
            {/* Media Display - Takes 2 columns on large screens */}
            <div className="lg:col-span-2">
              <div className="bg-gray-100 rounded-lg flex items-center justify-center min-h-[400px]">
                {media.mediaType === 'image' && (
                  <img
                    src={media.fileUrl}
                    alt={media.description || media.fileName}
                    className="max-w-full max-h-[600px] object-contain rounded-lg"
                  />
                )}

                {media.mediaType === 'video' && (
                  <video
                    src={media.fileUrl}
                    controls
                    className="max-w-full max-h-[600px] rounded-lg"
                    poster={media.thumbnailUrl || undefined}
                  >
                    Your browser does not support the video tag.
                  </video>
                )}

                {media.mediaType === 'audio' && (
                  <div className="w-full max-w-2xl p-8">
                    <audio
                      src={media.fileUrl}
                      controls
                      className="w-full"
                    >
                      Your browser does not support the audio tag.
                    </audio>
                  </div>
                )}
              </div>
            </div>

            {/* Metadata - Takes 1 column */}
            <div className="space-y-4">
              <div>
                <h3 className="text-sm font-medium text-gray-700 mb-2">Details</h3>
                <div className="space-y-2 text-sm">
                  <div>
                    <span className="text-gray-600">Type:</span>{' '}
                    <span className="font-medium">{media.mediaType}</span>
                  </div>
                  <div>
                    <span className="text-gray-600">Captured:</span>{' '}
                    <span className="font-medium">{formattedDate}</span>
                  </div>
                </div>
              </div>

              {/* Editable Fields */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Category
                </label>
                {isEditing ? (
                  <input
                    type="text"
                    value={editedCategory}
                    onChange={(e) => setEditedCategory(e.target.value)}
                    className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
                    placeholder="e.g., wound, x-ray..."
                  />
                ) : (
                  <p className="text-sm text-gray-900">{media.category || 'Not specified'}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Body Area
                </label>
                {isEditing ? (
                  <input
                    type="text"
                    value={editedBodyArea}
                    onChange={(e) => setEditedBodyArea(e.target.value)}
                    className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
                    placeholder="e.g., Right Arm..."
                  />
                ) : (
                  <p className="text-sm text-gray-900">{media.bodyArea || 'Not specified'}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Description
                </label>
                {isEditing ? (
                  <textarea
                    value={editedDescription}
                    onChange={(e) => setEditedDescription(e.target.value)}
                    rows={3}
                    className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
                    placeholder="Brief description..."
                  />
                ) : (
                  <p className="text-sm text-gray-900">{media.description || 'No description'}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Doctor Notes (Private)
                </label>
                {isEditing ? (
                  <textarea
                    value={editedDoctorNotes}
                    onChange={(e) => setEditedDoctorNotes(e.target.value)}
                    rows={4}
                    className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
                    placeholder="Clinical observations..."
                  />
                ) : (
                  <p className="text-sm text-gray-900">{media.doctorNotes || 'No notes'}</p>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
