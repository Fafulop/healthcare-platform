'use client';

import { useState } from 'react';
import { X, Mic, UserPlus, FileText, Pill, Calendar, DollarSign, ShoppingCart, ShoppingBag, CheckSquare } from 'lucide-react';
import { VoiceRecordingModal, VoiceChatSidebar } from '@/components/voice-assistant';
import type { VoiceSessionType, VoiceStructuredData } from '@/types/voice-assistant';
import type { InitialChatData } from '@/hooks/useChatSession';

interface VoiceAssistantHubModalProps {
  isOpen: boolean;
  onClose: () => void;
  doctorId: string;
}

interface VoiceAction {
  id: string;
  title: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  sessionType: VoiceSessionType;
  color: string;
  hoverColor: string;
}

const VOICE_ACTIONS: VoiceAction[] = [
  {
    id: 'new-patient',
    title: 'Crear Paciente',
    description: 'Registrar un nuevo paciente con voz',
    icon: UserPlus,
    sessionType: 'NEW_PATIENT',
    color: 'bg-blue-100 text-blue-700',
    hoverColor: 'hover:bg-blue-200',
  },
  {
    id: 'new-encounter',
    title: 'Nueva Consulta',
    description: 'Registrar consulta médica con voz',
    icon: FileText,
    sessionType: 'NEW_ENCOUNTER',
    color: 'bg-green-100 text-green-700',
    hoverColor: 'hover:bg-green-200',
  },
  {
    id: 'new-prescription',
    title: 'Nueva Receta',
    description: 'Crear receta médica con voz',
    icon: Pill,
    sessionType: 'NEW_PRESCRIPTION',
    color: 'bg-pink-100 text-pink-700',
    hoverColor: 'hover:bg-pink-200',
  },
  {
    id: 'create-appointments',
    title: 'Crear Citas',
    description: 'Programar slots de citas con voz',
    icon: Calendar,
    sessionType: 'CREATE_APPOINTMENT_SLOTS',
    color: 'bg-purple-100 text-purple-700',
    hoverColor: 'hover:bg-purple-200',
  },
  {
    id: 'new-task',
    title: 'Nuevo Pendiente',
    description: 'Crear tarea o pendiente con voz',
    icon: CheckSquare,
    sessionType: 'NEW_TASK',
    color: 'bg-yellow-100 text-yellow-700',
    hoverColor: 'hover:bg-yellow-200',
  },
  {
    id: 'ledger-entry',
    title: 'Movimiento de Efectivo',
    description: 'Registrar ingreso o egreso con voz',
    icon: DollarSign,
    sessionType: 'CREATE_LEDGER_ENTRY',
    color: 'bg-emerald-100 text-emerald-700',
    hoverColor: 'hover:bg-emerald-200',
  },
  {
    id: 'new-sale',
    title: 'Nueva Venta',
    description: 'Registrar venta de productos/servicios',
    icon: ShoppingCart,
    sessionType: 'CREATE_SALE',
    color: 'bg-orange-100 text-orange-700',
    hoverColor: 'hover:bg-orange-200',
  },
  {
    id: 'new-purchase',
    title: 'Nueva Compra',
    description: 'Registrar compra a proveedores',
    icon: ShoppingBag,
    sessionType: 'CREATE_PURCHASE',
    color: 'bg-cyan-100 text-cyan-700',
    hoverColor: 'hover:bg-cyan-200',
  },
];

export function VoiceAssistantHubModal({ isOpen, onClose, doctorId }: VoiceAssistantHubModalProps) {
  const [activeAction, setActiveAction] = useState<VoiceAction | null>(null);
  const [voiceModalOpen, setVoiceModalOpen] = useState(false);
  const [voiceSidebarOpen, setVoiceSidebarOpen] = useState(false);
  const [sidebarInitialData, setSidebarInitialData] = useState<InitialChatData | undefined>(undefined);

  if (!isOpen) return null;

  const handleActionClick = (action: VoiceAction) => {
    setActiveAction(action);
    setVoiceModalOpen(true);
  };

  const handleVoiceComplete = (
    transcript: string,
    data: VoiceStructuredData,
    sessionId: string,
    transcriptId: string,
    audioDuration: number,
  ) => {
    setVoiceModalOpen(false);
    setSidebarInitialData({
      transcript,
      structuredData: data,
      sessionId,
      transcriptId,
      audioDuration,
      fieldsExtracted: Object.keys(data),
    });
    setVoiceSidebarOpen(true);
  };

  const handleSidebarClose = () => {
    setVoiceSidebarOpen(false);
    setSidebarInitialData(undefined);
    setActiveAction(null);
  };

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center">
        {/* Backdrop */}
        <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />

        {/* Modal Content */}
        <div className="relative bg-white rounded-xl shadow-2xl w-full max-w-3xl mx-4 max-h-[90vh] overflow-hidden flex flex-col">
          {/* Header */}
          <div className="bg-gradient-to-r from-purple-600 to-indigo-600 text-white px-6 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-white/20 rounded-lg">
                  <Mic className="w-6 h-6" />
                </div>
                <div>
                  <h2 className="text-xl font-semibold">Asistente de Voz</h2>
                  <p className="text-sm text-purple-100">Crea registros usando tu voz</p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="p-2 rounded-lg hover:bg-white/20 transition-colors"
                title="Cerrar"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Scrollable Content */}
          <div className="flex-1 overflow-y-auto p-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {VOICE_ACTIONS.map((action) => {
                const Icon = action.icon;
                return (
                  <button
                    key={action.id}
                    onClick={() => handleActionClick(action)}
                    className={`
                      flex items-start gap-4 p-4 rounded-lg border-2 border-transparent
                      ${action.color} ${action.hoverColor}
                      transition-all text-left
                      hover:border-current hover:shadow-md
                      active:scale-98
                    `}
                  >
                    <div className="flex-shrink-0">
                      <Icon className="w-6 h-6" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-sm mb-1">{action.title}</h3>
                      <p className="text-xs opacity-80">{action.description}</p>
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Info Box */}
            <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <p className="text-sm text-blue-800">
                <strong>Tip:</strong> Selecciona una acción y luego graba tu voz describiendo la información.
                El asistente convertirá tu audio en datos estructurados que podrás revisar y guardar.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Voice Recording Modal */}
      {activeAction && (
        <VoiceRecordingModal
          isOpen={voiceModalOpen}
          onClose={() => {
            setVoiceModalOpen(false);
            setActiveAction(null);
          }}
          sessionType={activeAction.sessionType}
          context={{
            doctorId: doctorId,
          }}
          onComplete={handleVoiceComplete}
        />
      )}

      {/* Voice Chat Sidebar */}
      {activeAction && sidebarInitialData && (
        <VoiceChatSidebar
          isOpen={voiceSidebarOpen}
          onClose={handleSidebarClose}
          sessionType={activeAction.sessionType}
          patientId=""
          doctorId={doctorId}
          context={{
            doctorId: doctorId,
          }}
          initialData={sidebarInitialData}
          onConfirm={(data) => {
            // Note: Each voice action would need its own confirm handler
            // For now, just close the sidebar
            console.log('Voice data confirmed:', data);
            handleSidebarClose();
            onClose(); // Close the hub modal too
          }}
        />
      )}
    </>
  );
}
