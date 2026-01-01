import Link from 'next/link';
import { Calendar, Eye } from 'lucide-react';

interface ArticleCardProps {
  slug: string;
  title: string;
  excerpt: string;
  thumbnail?: string | null;
  publishedAt: string;
  views: number;
  doctorSlug: string;
}

export function ArticleCard({
  slug,
  title,
  excerpt,
  thumbnail,
  publishedAt,
  views,
  doctorSlug,
}: ArticleCardProps) {
  const formattedDate = new Date(publishedAt).toLocaleDateString('es-MX', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  return (
    <Link href={`/doctores/${doctorSlug}/blog/${slug}`}>
      <article className="bg-white rounded-lg shadow-md overflow-hidden hover:shadow-xl transition-shadow duration-300 h-full flex flex-col">
        {/* Thumbnail Image */}
        {thumbnail ? (
          <div className="relative w-full h-48 bg-gray-200 overflow-hidden">
            <img
              src={thumbnail}
              alt={title}
              className="w-full h-full object-cover hover:scale-105 transition-transform duration-300"
            />
          </div>
        ) : (
          <div className="w-full h-48 bg-blue-100 flex items-center justify-center">
            <svg
              className="w-16 h-16 text-blue-300"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z"
              />
            </svg>
          </div>
        )}

        {/* Content */}
        <div className="p-6 flex-1 flex flex-col">
          {/* Title */}
          <h2 className="text-xl font-bold text-gray-900 mb-3 line-clamp-2 hover:text-blue-600 transition-colors">
            {title}
          </h2>

          {/* Excerpt */}
          <p className="text-gray-600 mb-4 line-clamp-3 flex-1">
            {excerpt}
          </p>

          {/* Metadata Footer */}
          <div className="flex items-center justify-between text-sm text-gray-500 pt-4 border-t border-gray-100">
            <div className="flex items-center gap-1">
              <Calendar className="w-4 h-4" />
              <time dateTime={publishedAt}>{formattedDate}</time>
            </div>

            <div className="flex items-center gap-1">
              <Eye className="w-4 h-4" />
              <span>{views} vistas</span>
            </div>
          </div>
        </div>
      </article>
    </Link>
  );
}
