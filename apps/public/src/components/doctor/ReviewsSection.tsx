// Reviews Section - Patient testimonials and ratings
'use client';

import { useState } from 'react';
import { Star } from 'lucide-react';
import BlobDecoration from '../ui/BlobDecoration';
import type { Review, ReviewStats } from '@/types/doctor';

interface ReviewsSectionProps {
  id?: string;
  reviews: Review[];
  reviewStats: ReviewStats;
  doctorName: string;
}

export default function ReviewsSection({
  id,
  reviews,
  reviewStats,
  doctorName,
}: ReviewsSectionProps) {
  const [visibleCount, setVisibleCount] = useState(3);

  // Don't render if no reviews
  if (!reviews || reviews.length === 0) {
    return null;
  }

  // Helper to render stars
  const renderStars = (rating: number) => {
    return (
      <div className="flex gap-0.5">
        {[1, 2, 3, 4, 5].map((star) => (
          <Star
            key={star}
            className={`w-5 h-5 ${
              star <= rating
                ? 'fill-yellow-400 text-yellow-400'
                : 'text-gray-300'
            }`}
          />
        ))}
      </div>
    );
  };

  // Helper to format date
  const formatDate = (date: Date) => {
    return new Date(date).toLocaleDateString('es-MX', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  // Get reviews to display
  const visibleReviews = reviews.slice(0, visibleCount);
  const hasMoreReviews = visibleCount < reviews.length;

  // Load more reviews (3 at a time)
  const loadMoreReviews = () => {
    setVisibleCount((prev) => Math.min(prev + 3, reviews.length));
  };

  return (
    <section
      id={id}
      className="relative py-16 bg-[var(--color-bg-yellow-light)] overflow-hidden"
      aria-labelledby="reviews-heading"
    >
      {/* Organic blobs for visual interest */}
      <BlobDecoration variant="blob2" color="gradient-purple" position="top-left" size="lg" opacity={28} blur={false} />
      <BlobDecoration variant="blob4" color="primary" position="bottom-right" size="md" opacity={20} blur={false} />

      <div className="relative max-w-4xl mx-auto px-4">
        {/* Section Header */}
        <div className="mb-8">
          <h2
            id="reviews-heading"
            className="text-[var(--font-size-h2)] font-bold text-[var(--color-neutral-dark)] mb-2 text-center"
          >
            Opiniones de Pacientes
          </h2>
          <div className="flex items-center justify-center gap-3">
            {renderStars(Math.round(reviewStats.averageRating))}
            <span className="text-lg font-semibold text-gray-900">
              {reviewStats.averageRating.toFixed(1)}
            </span>
            <span className="text-gray-600">
              ({reviewStats.reviewCount}{' '}
              {reviewStats.reviewCount === 1 ? 'opinión' : 'opiniones'})
            </span>
          </div>
        </div>

        {/* Reviews Grid */}
        <div className="grid gap-6">
          {visibleReviews.map((review) => (
            <article
              key={review.id}
              className="bg-white rounded-lg border border-gray-200 p-6 shadow-sm hover:shadow-md transition-shadow"
            >
              {/* Review Header */}
              <div className="flex items-start justify-between mb-3">
                <div>
                  <p className="font-semibold text-gray-900">
                    {review.patientName || 'Paciente Anónimo'}
                  </p>
                  <p className="text-sm text-gray-500">
                    {formatDate(review.createdAt)}
                  </p>
                </div>
                {renderStars(review.rating)}
              </div>

              {/* Review Content */}
              <p className="text-gray-700 leading-relaxed whitespace-pre-wrap">
                {review.comment}
              </p>
            </article>
          ))}
        </div>

        {/* Load More Button */}
        {hasMoreReviews && (
          <div className="mt-8 text-center">
            <button
              onClick={loadMoreReviews}
              className="px-6 py-3 bg-[var(--color-secondary)] text-white font-medium rounded-full hover:bg-[var(--color-secondary)]/90 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-secondary)] focus-visible:ring-offset-2"
            >
              Ver más opiniones ({reviews.length - visibleCount} restantes)
            </button>
          </div>
        )}

        {/* SEO-friendly summary (hidden visually) */}
        <div className="sr-only" aria-hidden="true">
          <p>
            {doctorName} tiene {reviewStats.reviewCount} opiniones de pacientes
            con una calificación promedio de{' '}
            {reviewStats.averageRating.toFixed(1)} de 5 estrellas.
          </p>
        </div>
      </div>
    </section>
  );
}
