'use client';

import { useState } from 'react';
import { Sparkles, Lock } from 'lucide-react';
import { VoiceAssistantHubModal } from './VoiceAssistantHubModal';
import { useSession } from 'next-auth/react';
import { useAiLock, AiUpgradeDialog } from '@/components/layout/AiUpgradeDialog';

export function VoiceAssistantHubWidget() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const { data: session } = useSession();
  // Legacy AI surface — owner-only in v1 (00-REQUISITOS §5.3): the modal
  // talks to voice/* endpoints, all OWNER_ONLY. Found live, 2026-07-21 —
  // same bug class as ChatWidget and the agenda-page agent button (§16).
  //
  // TIERS Q2b: el check de dueño ya NO se hace a mano. `useAiLock` lo cubre
  // por construcción — `can('ia')` es false para cualquier member (su set de
  // permisos nunca trae `ia`), así que la conducta owner-only se conserva, y
  // encima el dueño de un plan SIN IA ve el candado en vez de nada. Ésta es
  // UNA de las dos puertas con candado (plan §9.2); el resto se ocultan.
  const { locked, allowed, upsellOpen, openUpsell, closeUpsell } = useAiLock();

  const doctorId = session?.user?.doctorId;

  if (!doctorId) return null;
  // Ni permitida ni bloqueada-con-derecho-a-comprar ⇒ no existe para este usuario.
  if (!allowed && !locked) return null;

  return (
    <>
      {/* Floating Button - positioned above DayDetailsWidget */}
      <button
        onClick={locked ? openUpsell : () => setIsModalOpen(true)}
        className={`
          fixed bottom-44 right-4 sm:bottom-42 sm:right-6 lg:right-[calc(1.5rem+var(--agent-dock,0px))] z-50
          w-12 h-12 sm:w-14 sm:h-14 rounded-full
          text-white shadow-lg hover:shadow-xl
          flex items-center justify-center
          transition-all active:scale-95
          lg:bottom-42
          ${locked ? 'bg-gray-400 hover:bg-gray-500' : 'bg-indigo-600 hover:bg-indigo-700'}
        `}
        title={locked ? 'Asistente IA — no incluido en tu plan' : 'Asistente IA'}
      >
        {locked ? (
          <Lock className="w-5 h-5 sm:w-6 sm:h-6" />
        ) : (
          <Sparkles className="w-6 h-6 sm:w-7 sm:h-7" />
        )}
      </button>

      {/* Modal — solo cuando la cuenta SÍ tiene IA. */}
      {!locked && (
        <VoiceAssistantHubModal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          doctorId={doctorId}
        />
      )}

      <AiUpgradeDialog open={upsellOpen} onClose={closeUpsell} />
    </>
  );
}
