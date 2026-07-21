'use client';

import { useState } from 'react';
import { Sparkles } from 'lucide-react';
import { VoiceAssistantHubModal } from './VoiceAssistantHubModal';
import { useSession } from 'next-auth/react';
import { usePermissions } from '@/lib/permissions-client';

export function VoiceAssistantHubWidget() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const { data: session } = useSession();
  // Legacy AI surface — owner-only in v1 (00-REQUISITOS §5.3): the modal
  // talks to voice/* endpoints, all OWNER_ONLY. Found live, 2026-07-21 —
  // same bug class as ChatWidget and the agenda-page agent button (§16).
  const { isOwner } = usePermissions();

  const doctorId = session?.user?.doctorId;

  // Don't render if no doctor ID, or if this session isn't the owner.
  if (!doctorId || !isOwner) return null;

  return (
    <>
      {/* Floating Button - positioned above DayDetailsWidget */}
      <button
        onClick={() => setIsModalOpen(true)}
        className="
          fixed bottom-44 right-4 sm:bottom-42 sm:right-6 lg:right-[calc(1.5rem+var(--agent-dock,0px))] z-50
          w-12 h-12 sm:w-14 sm:h-14 rounded-full
          bg-indigo-600 hover:bg-indigo-700
          text-white shadow-lg hover:shadow-xl
          flex items-center justify-center
          transition-all active:scale-95
          lg:bottom-42
        "
        title="Asistente IA"
      >
        <Sparkles className="w-6 h-6 sm:w-7 sm:h-7" />
      </button>

      {/* Modal */}
      <VoiceAssistantHubModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        doctorId={doctorId}
      />
    </>
  );
}
