'use client';

/**
 * ChatSources Component
 * Displays source attribution badges for an assistant response.
 */

import { BookOpen } from 'lucide-react';

interface Source {
  module: string;
  submodule?: string;
  heading?: string;
}

interface ChatSourcesProps {
  sources: Source[];
}

const MODULE_LABELS: Record<string, string> = {
  'medical-records': 'Expedientes',
  'appointments': 'Citas',
  'practice-management': 'Consultorio',
  'blog': 'Blog',
  'voice-assistant': 'Voz',
  'navigation': 'Navegación',
  'general': 'General',
};

export function ChatSources({ sources }: ChatSourcesProps) {
  if (sources.length === 0) return null;

  // Deduplicate by module
  const uniqueModules = [...new Set(sources.map(s => s.module))];

  return (
    <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
      <BookOpen className="w-3 h-3 text-gray-400 flex-shrink-0" />
      {uniqueModules.map((moduleId) => (
        <span
          key={moduleId}
          className="
            inline-flex items-center px-2 py-0.5 rounded-full
            text-xs font-medium bg-blue-50 text-blue-700
          "
        >
          {MODULE_LABELS[moduleId] || moduleId}
        </span>
      ))}
    </div>
  );
}
