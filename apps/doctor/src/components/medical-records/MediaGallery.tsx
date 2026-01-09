'use client';

import { useState } from 'react';
import { Filter } from 'lucide-react';
import { MediaCard } from './MediaCard';

interface MediaItem {
  id: string;
  mediaType: 'image' | 'video' | 'audio';
  fileName: string;
  fileUrl: string;
  thumbnailUrl?: string | null;
  category?: string | null;
  bodyArea?: string | null;
  captureDate: Date | string;
  description?: string | null;
  encounterId?: string | null;
}

interface MediaGalleryProps {
  media: MediaItem[];
  patientId: string;
  onMediaClick?: (media: MediaItem) => void;
  showFilters?: boolean;
}

export function MediaGallery({ media, patientId, onMediaClick, showFilters = true }: MediaGalleryProps) {
  const [filterType, setFilterType] = useState<'all' | 'image' | 'video' | 'audio'>('all');
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'date-desc' | 'date-asc' | 'type'>('date-desc');

  // Get unique categories from media
  const categories = Array.from(new Set(media.map(m => m.category).filter(Boolean)));

  // Filter media
  let filteredMedia = media;

  if (filterType !== 'all') {
    filteredMedia = filteredMedia.filter(m => m.mediaType === filterType);
  }

  if (filterCategory !== 'all') {
    filteredMedia = filteredMedia.filter(m => m.category === filterCategory);
  }

  // Sort media
  const sortedMedia = [...filteredMedia].sort((a, b) => {
    if (sortBy === 'date-desc') {
      return new Date(b.captureDate).getTime() - new Date(a.captureDate).getTime();
    } else if (sortBy === 'date-asc') {
      return new Date(a.captureDate).getTime() - new Date(b.captureDate).getTime();
    } else { // type
      return a.mediaType.localeCompare(b.mediaType);
    }
  });

  return (
    <div>
      {/* Filters */}
      {showFilters && (
        <div className="mb-6 bg-white rounded-lg shadow p-4">
          <div className="flex items-center gap-2 mb-3">
            <Filter className="w-5 h-5 text-gray-500" />
            <h3 className="text-sm font-medium text-gray-700">Filters</h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Media Type Filter */}
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">
                Media Type
              </label>
              <select
                value={filterType}
                onChange={(e) => setFilterType(e.target.value as any)}
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
              >
                <option value="all">All Types</option>
                <option value="image">Images</option>
                <option value="video">Videos</option>
                <option value="audio">Audio</option>
              </select>
            </div>

            {/* Category Filter */}
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">
                Category
              </label>
              <select
                value={filterCategory}
                onChange={(e) => setFilterCategory(e.target.value)}
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
              >
                <option value="all">All Categories</option>
                {categories.map(cat => (
                  <option key={cat} value={cat || ''}>
                    {cat}
                  </option>
                ))}
              </select>
            </div>

            {/* Sort Order */}
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">
                Sort By
              </label>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
              >
                <option value="date-desc">Newest First</option>
                <option value="date-asc">Oldest First</option>
                <option value="type">Type</option>
              </select>
            </div>
          </div>

          {/* Active Filters Summary */}
          {(filterType !== 'all' || filterCategory !== 'all') && (
            <div className="mt-3 flex items-center gap-2">
              <span className="text-xs text-gray-600">Active filters:</span>
              {filterType !== 'all' && (
                <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded">
                  {filterType}
                </span>
              )}
              {filterCategory !== 'all' && (
                <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded">
                  {filterCategory}
                </span>
              )}
              <button
                onClick={() => {
                  setFilterType('all');
                  setFilterCategory('all');
                }}
                className="text-xs text-blue-600 hover:text-blue-700 underline"
              >
                Clear all
              </button>
            </div>
          )}
        </div>
      )}

      {/* Results Count */}
      <div className="mb-4 text-sm text-gray-600">
        Showing {sortedMedia.length} of {media.length} media items
      </div>

      {/* Media Grid */}
      {sortedMedia.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {sortedMedia.map(item => (
            <MediaCard
              key={item.id}
              media={item}
              patientId={patientId}
              onClick={() => onMediaClick?.(item)}
            />
          ))}
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow p-12 text-center">
          <p className="text-gray-500">No media found matching your filters</p>
          {(filterType !== 'all' || filterCategory !== 'all') && (
            <button
              onClick={() => {
                setFilterType('all');
                setFilterCategory('all');
              }}
              className="mt-4 text-blue-600 hover:text-blue-700 underline text-sm"
            >
              Clear filters
            </button>
          )}
        </div>
      )}
    </div>
  );
}
