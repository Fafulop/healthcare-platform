"use client";

import { useEffect } from "react";
import { X, Eye } from "lucide-react";
import Image from "next/image";

interface BlogPreviewModalProps {
  title: string;
  thumbnail?: string;
  content: string;
  onClose: () => void;
}

export default function BlogPreviewModal({
  title,
  thumbnail,
  content,
  onClose,
}: BlogPreviewModalProps) {
  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [onClose]);

  // Prevent body scroll
  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, []);

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col bg-black/60 backdrop-blur-sm"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      {/* Modal header bar */}
      <div className="flex-none flex items-center justify-between bg-gray-900 text-white px-4 py-3 shadow">
        <div className="flex items-center gap-2 text-sm font-medium">
          <Eye className="w-4 h-4 text-green-400" />
          <span>Vista previa del artículo</span>
          <span className="text-gray-400 text-xs ml-2">(así se verá al publicarse)</span>
        </div>
        <button
          onClick={onClose}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gray-700 hover:bg-gray-600 transition-colors text-sm"
        >
          <X className="w-4 h-4" />
          Cerrar
        </button>
      </div>

      {/* Scrollable article area */}
      <div className="flex-1 overflow-y-auto bg-gray-100">
        <div className="max-w-3xl mx-auto bg-white my-6 rounded-xl shadow-lg overflow-hidden">
          {/* Thumbnail */}
          {thumbnail && (
            <div className="relative w-full h-64 sm:h-80 bg-gray-200">
              <Image
                src={thumbnail}
                alt={title}
                fill
                sizes="(max-width: 768px) 100vw, 768px"
                className="object-cover"
              />
            </div>
          )}

          <div className="px-6 sm:px-10 py-8">
            {/* Title */}
            <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 leading-tight mb-6">
              {title || <span className="text-gray-400 italic">Sin título</span>}
            </h1>

            <hr className="border-gray-200 mb-8" />

            {/* Article body */}
            {content ? (
              <>
                {/* Inline CSS fixes for image rendering in preview */}
                <style>{`
                  .preview-content img { margin: 0; }
                  .preview-content::after { content: ''; display: table; clear: both; }
                `}</style>
                <div
                  className="preview-content prose prose-lg max-w-none
                    prose-headings:text-gray-900
                    prose-h2:text-3xl prose-h2:font-bold prose-h2:mt-8 prose-h2:mb-4
                    prose-h3:text-2xl prose-h3:font-semibold prose-h3:mt-6 prose-h3:mb-3
                    prose-p:text-gray-700 prose-p:leading-relaxed prose-p:mb-4
                    prose-a:text-green-600 prose-a:no-underline hover:prose-a:underline
                    prose-strong:text-gray-900 prose-strong:font-semibold
                    prose-ul:my-6 prose-ul:list-disc prose-ul:pl-6
                    prose-ol:my-6 prose-ol:list-decimal prose-ol:pl-6
                    prose-li:text-gray-700 prose-li:my-2
                    prose-blockquote:border-l-4 prose-blockquote:border-green-500
                    prose-blockquote:pl-4 prose-blockquote:italic prose-blockquote:text-gray-600"
                  dangerouslySetInnerHTML={{ __html: content }}
                />
              </>
            ) : (
              <p className="text-gray-400 italic">El artículo no tiene contenido todavía.</p>
            )}
          </div>
        </div>

        {/* Bottom padding */}
        <div className="h-10" />
      </div>
    </div>
  );
}
