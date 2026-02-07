"use client";

import { useState } from "react";
import { Star, Trash2 } from "lucide-react";

interface Review {
  id: string;
  patientName: string | null;
  rating: number;
  comment: string;
  createdAt: string;
}

interface ReviewStats {
  averageRating: number;
  reviewCount: number;
}

interface ReviewsSectionProps {
  reviews: Review[];
  reviewStats: ReviewStats;
  onDelete: (reviewId: string) => void;
}

export default function ReviewsSection({ reviews, reviewStats, onDelete }: ReviewsSectionProps) {
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const handleDelete = async (reviewId: string) => {
    setDeletingId(reviewId);
    await onDelete(reviewId);
    setDeletingId(null);
    setConfirmDeleteId(null);
  };

  const renderStars = (rating: number) => (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map((star) => (
        <Star
          key={star}
          className={`w-4 h-4 ${
            star <= rating
              ? "fill-yellow-400 text-yellow-400"
              : "text-gray-300"
          }`}
        />
      ))}
    </div>
  );

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString("es-MX", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  return (
    <div className="space-y-6">
      {/* Stats Summary */}
      <div>
        <h3 className="text-sm font-semibold text-gray-700 mb-3">
          Opiniones de Pacientes ({reviewStats.reviewCount})
        </h3>

        {reviewStats.reviewCount > 0 ? (
          <div className="flex items-center gap-3 p-4 bg-blue-50 rounded-lg">
            {renderStars(Math.round(reviewStats.averageRating))}
            <span className="text-lg font-semibold text-gray-900">
              {reviewStats.averageRating.toFixed(1)}
            </span>
            <span className="text-sm text-gray-600">
              de 5 estrellas
            </span>
          </div>
        ) : (
          <div className="text-center py-6 text-gray-500 border-2 border-dashed border-gray-200 rounded-lg text-sm">
            No hay opiniones de pacientes todavia.
          </div>
        )}
      </div>

      {/* Reviews List */}
      {reviews.length > 0 && (
        <div className="space-y-3">
          {reviews.map((review) => (
            <div
              key={review.id}
              className="border border-gray-200 rounded-lg p-4"
            >
              {/* Header */}
              <div className="flex items-start justify-between mb-2">
                <div>
                  <p className="font-medium text-gray-900 text-sm">
                    {review.patientName || "Paciente Anonimo"}
                  </p>
                  <p className="text-xs text-gray-500">
                    {formatDate(review.createdAt)}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  {renderStars(review.rating)}

                  {/* Delete button */}
                  {confirmDeleteId === review.id ? (
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleDelete(review.id)}
                        disabled={deletingId === review.id}
                        className="px-3 py-1 bg-red-600 text-white rounded text-xs font-medium hover:bg-red-700 disabled:opacity-50"
                      >
                        {deletingId === review.id ? "Eliminando..." : "Confirmar"}
                      </button>
                      <button
                        onClick={() => setConfirmDeleteId(null)}
                        className="px-3 py-1 bg-gray-200 text-gray-700 rounded text-xs font-medium hover:bg-gray-300"
                      >
                        Cancelar
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setConfirmDeleteId(review.id)}
                      className="text-red-500 hover:text-red-700 p-1"
                      title="Eliminar opinion"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>

              {/* Comment */}
              <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">
                {review.comment}
              </p>
            </div>
          ))}
        </div>
      )}

      {/* Info note */}
      <p className="text-xs text-gray-400">
        Las opiniones son enviadas por pacientes despues de su cita y no pueden ser editadas.
      </p>
    </div>
  );
}
