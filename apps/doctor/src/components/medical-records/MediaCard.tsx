'use client';

import { Image, Video, Mic, FileText } from 'lucide-react';
import Link from 'next/link';

interface MediaCardProps {
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
  };
  patientId: string;
  onClick?: () => void;
}

export function MediaCard({ media, patientId, onClick }: MediaCardProps) {
  const captureDate = new Date(media.captureDate);
  const formattedDate = captureDate.toLocaleDateString('es-MX', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  });

  const MediaIcon = media.mediaType === 'image' ? Image :
                    media.mediaType === 'video' ? Video :
                    Mic;

  const handleClick = () => {
    if (onClick) {
      onClick();
    }
  };

  return (
    <div
      onClick={handleClick}
      className={`bg-white rounded-lg shadow hover:shadow-md transition-shadow overflow-hidden ${
        onClick ? 'cursor-pointer' : ''
      }`}
    >
      {/* Thumbnail/Preview */}
      <div className="relative h-48 bg-gray-100 flex items-center justify-center">
        {media.mediaType === 'image' && (
          <img
            src={media.fileUrl}
            alt={media.description || media.fileName}
            className="w-full h-full object-cover"
          />
        )}

        {media.mediaType === 'video' && (
          <>
            {media.thumbnailUrl ? (
              <img
                src={media.thumbnailUrl}
                alt={media.description || media.fileName}
                className="w-full h-full object-cover"
              />
            ) : (
              <Video className="w-16 h-16 text-gray-400" />
            )}
            <div className="absolute inset-0 bg-black bg-opacity-30 flex items-center justify-center">
              <div className="w-16 h-16 bg-white bg-opacity-90 rounded-full flex items-center justify-center">
                <div className="w-0 h-0 border-t-8 border-t-transparent border-l-12 border-l-gray-800 border-b-8 border-b-transparent ml-1" />
              </div>
            </div>
          </>
        )}

        {media.mediaType === 'audio' && (
          <div className="flex flex-col items-center">
            <Mic className="w-16 h-16 text-blue-500 mb-2" />
            <p className="text-sm text-gray-600">Audio Recording</p>
          </div>
        )}

        {/* Media Type Badge */}
        <div className="absolute top-2 left-2 bg-gray-900 bg-opacity-75 text-white text-xs px-2 py-1 rounded flex items-center gap-1">
          <MediaIcon className="w-3 h-3" />
          {media.mediaType}
        </div>

        {/* Category Badge */}
        {media.category && (
          <div className="absolute top-2 right-2 bg-blue-600 text-white text-xs px-2 py-1 rounded">
            {media.category}
          </div>
        )}
      </div>

      {/* Info */}
      <div className="p-3">
        <div className="flex items-start justify-between mb-1">
          <p className="text-sm font-medium text-gray-900 truncate flex-1">
            {media.description || media.fileName}
          </p>
        </div>

        <p className="text-xs text-gray-500 mb-2">{formattedDate}</p>

        {media.bodyArea && (
          <div className="flex items-center gap-1 mb-1">
            <span className="text-xs bg-gray-100 text-gray-700 px-2 py-1 rounded">
              {media.bodyArea}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
