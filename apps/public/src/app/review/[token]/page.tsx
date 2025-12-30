'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Star } from 'lucide-react';

interface ReviewData {
  doctorName: string;
  specialty: string;
  appointmentDate: string;
  appointmentTime: string;
  patientName: string;
}

export default function ReviewPage() {
  const params = useParams();
  const router = useRouter();
  const token = params.token as string;

  const [loading, setLoading] = useState(true);
  const [validToken, setValidToken] = useState(false);
  const [reviewData, setReviewData] = useState<ReviewData | null>(null);
  const [error, setError] = useState('');

  // Form state
  const [rating, setRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [comment, setComment] = useState('');
  const [patientName, setPatientName] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  // Verify token on mount
  useEffect(() => {
    async function verifyToken() {
      try {
        const response = await fetch(
          `${process.env.NEXT_PUBLIC_API_URL}/api/reviews?token=${token}`
        );
        const data = await response.json();

        if (data.success && data.valid) {
          setValidToken(true);
          setReviewData(data.data);
          setPatientName(data.data.patientName);
        } else {
          setError(data.error || 'Invalid or expired review link');
        }
      } catch (err) {
        setError('Failed to verify review link');
      } finally {
        setLoading(false);
      }
    }

    verifyToken();
  }, [token]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (rating === 0) {
      setError('Please select a rating');
      return;
    }

    if (comment.trim().length < 10) {
      setError('Please write at least 10 characters in your review');
      return;
    }

    setSubmitting(true);
    setError('');

    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/reviews`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            token,
            rating,
            comment: comment.trim(),
            patientName: patientName.trim() || null,
          }),
        }
      );

      const data = await response.json();

      if (data.success) {
        setSubmitted(true);
      } else {
        setError(data.error || 'Failed to submit review');
      }
    } catch (err) {
      setError('Failed to submit review. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Verificando enlace...</p>
        </div>
      </div>
    );
  }

  // Invalid token
  if (!validToken) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
        <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-8 text-center">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg
              className="w-8 h-8 text-red-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">
            Enlace Inválido
          </h1>
          <p className="text-gray-600 mb-6">{error}</p>
          <button
            onClick={() => router.push('/')}
            className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
          >
            Ir al inicio
          </button>
        </div>
      </div>
    );
  }

  // Success state
  if (submitted) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
        <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-8 text-center">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg
              className="w-8 h-8 text-green-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M5 13l4 4L19 7"
              />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">
            ¡Gracias por tu opinión!
          </h1>
          <p className="text-gray-600 mb-6">
            Tu reseña ha sido enviada exitosamente y aparecerá en el perfil del
            doctor.
          </p>
          <button
            onClick={() => router.push('/')}
            className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
          >
            Ir al inicio
          </button>
        </div>
      </div>
    );
  }

  // Review form
  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-2xl mx-auto">
        <div className="bg-white rounded-lg shadow-lg p-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Deja tu opinión
          </h1>
          <p className="text-gray-600 mb-6">
            Tu experiencia ayuda a otros pacientes a tomar mejores decisiones
          </p>

          {/* Doctor info */}
          {reviewData && (
            <div className="bg-blue-50 rounded-lg p-4 mb-6">
              <p className="text-sm text-gray-600">Cita con</p>
              <p className="text-lg font-semibold text-gray-900">
                {reviewData.doctorName}
              </p>
              <p className="text-sm text-gray-600">{reviewData.specialty}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Rating */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Calificación *
              </label>
              <div className="flex gap-2">
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    key={star}
                    type="button"
                    onClick={() => setRating(star)}
                    onMouseEnter={() => setHoverRating(star)}
                    onMouseLeave={() => setHoverRating(0)}
                    className="transition-transform hover:scale-110"
                  >
                    <Star
                      className={`w-10 h-10 ${
                        star <= (hoverRating || rating)
                          ? 'fill-yellow-400 text-yellow-400'
                          : 'text-gray-300'
                      }`}
                    />
                  </button>
                ))}
              </div>
            </div>

            {/* Comment */}
            <div>
              <label
                htmlFor="comment"
                className="block text-sm font-medium text-gray-700 mb-2"
              >
                Tu experiencia * (mínimo 10 caracteres)
              </label>
              <textarea
                id="comment"
                rows={5}
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Cuéntanos sobre tu experiencia con el doctor..."
                required
              />
              <p className="text-sm text-gray-500 mt-1">
                {comment.length}/1000 caracteres
              </p>
            </div>

            {/* Name (optional) */}
            <div>
              <label
                htmlFor="name"
                className="block text-sm font-medium text-gray-700 mb-2"
              >
                Tu nombre (opcional)
              </label>
              <input
                id="name"
                type="text"
                value={patientName}
                onChange={(e) => setPatientName(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Anónimo"
              />
              <p className="text-sm text-gray-500 mt-1">
                Deja en blanco para publicar de forma anónima
              </p>
            </div>

            {/* Error */}
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
                {error}
              </div>
            )}

            {/* Submit */}
            <button
              type="submit"
              disabled={submitting}
              className="w-full px-6 py-3 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition disabled:bg-gray-400 disabled:cursor-not-allowed"
            >
              {submitting ? 'Enviando...' : 'Enviar opinión'}
            </button>
          </form>

          <p className="text-xs text-gray-500 text-center mt-6">
            Este enlace solo puede ser usado una vez
          </p>
        </div>
      </div>
    </div>
  );
}
