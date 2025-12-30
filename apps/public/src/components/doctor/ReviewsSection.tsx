// Reviews Section - Patient testimonials and ratings
import { Star } from 'lucide-react';
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

  return (
    <section
      id={id}
      className="max-w-4xl mx-auto px-4 py-12 md:py-16"
      aria-labelledby="reviews-heading"
    >
      {/* Section Header */}
      <div className="mb-8">
        <h2
          id="reviews-heading"
          className="text-3xl md:text-4xl font-bold text-gray-900 mb-2"
        >
          Opiniones de Pacientes
        </h2>
        <div className="flex items-center gap-3">
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
        {reviews.map((review) => (
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

      {/* SEO-friendly summary (hidden visually) */}
      <div className="sr-only" aria-hidden="true">
        <p>
          {doctorName} tiene {reviewStats.reviewCount} opiniones de pacientes
          con una calificación promedio de{' '}
          {reviewStats.averageRating.toFixed(1)} de 5 estrellas.
        </p>
      </div>
    </section>
  );
}
