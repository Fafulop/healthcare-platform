'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { X, Mic, Sparkles, UserPlus, Calendar, DollarSign, ShoppingCart, ShoppingBag, CheckSquare, FileSpreadsheet } from 'lucide-react';
import { VoiceRecordingModal, VoiceChatSidebar } from '@/components/voice-assistant';
import type { VoiceSessionType, VoiceStructuredData } from '@/types/voice-assistant';
import type { InitialChatData } from '@/hooks/useChatSession';

const SESSION_TYPE_ROUTES: Partial<Record<VoiceSessionType, { route: string; storageKey: string }>> = {
  NEW_PATIENT: { route: '/dashboard/medical-records/patients/new', storageKey: 'voicePatientData' },
  NEW_TASK: { route: '/dashboard/pendientes/new', storageKey: 'voiceTaskData' },
  CREATE_APPOINTMENT_SLOTS: { route: '/appointments', storageKey: 'voiceAppointmentData' },
  CREATE_SALE: { route: '/dashboard/practice/ventas/new', storageKey: 'voiceSaleData' },
  CREATE_PURCHASE: { route: '/dashboard/practice/compras/new', storageKey: 'voicePurchaseData' },
  CREATE_LEDGER_ENTRY: { route: '/dashboard/practice/flujo-de-dinero/new', storageKey: 'voiceLedgerData' },
};

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
  /** If set, navigates to this route with ?chat=true instead of opening voice recording */
  chatRoute?: string;
}

const VOICE_ACTIONS: VoiceAction[] = [
  {
    id: 'new-patient',
    title: 'Crear Paciente',
    description: 'Registrar un nuevo paciente con Chat IA',
    icon: UserPlus,
    sessionType: 'NEW_PATIENT',
    color: 'bg-indigo-50 text-indigo-600',
    hoverColor: 'hover:bg-indigo-100',
    chatRoute: '/dashboard/medical-records/patients/new',
  },
{
    id: 'create-appointments',
    title: 'Crear Citas',
    description: 'Programar slots de citas con voz',
    icon: Calendar,
    sessionType: 'CREATE_APPOINTMENT_SLOTS',
    color: 'bg-blue-50 text-blue-600',
    hoverColor: 'hover:bg-blue-100',
  },
  {
    id: 'new-task',
    title: 'Nuevo Pendiente',
    description: 'Crear tarea o pendiente con Chat IA',
    icon: CheckSquare,
    sessionType: 'NEW_TASK',
    color: 'bg-indigo-50 text-indigo-600',
    hoverColor: 'hover:bg-indigo-100',
    chatRoute: '/dashboard/pendientes/new',
  },
  {
    id: 'ledger-entry',
    title: 'Movimiento de Efectivo',
    description: 'Registrar ingreso o egreso con Chat IA',
    icon: DollarSign,
    sessionType: 'CREATE_LEDGER_ENTRY',
    color: 'bg-indigo-50 text-indigo-600',
    hoverColor: 'hover:bg-indigo-100',
    chatRoute: '/dashboard/practice/flujo-de-dinero/new',
  },
  {
    id: 'new-sale',
    title: 'Nueva Venta',
    description: 'Registrar venta con Chat IA',
    icon: ShoppingCart,
    sessionType: 'CREATE_SALE',
    color: 'bg-indigo-50 text-indigo-600',
    hoverColor: 'hover:bg-indigo-100',
    chatRoute: '/dashboard/practice/ventas/new',
  },
  {
    id: 'new-quotation',
    title: 'Nueva Cotización',
    description: 'Crear cotización con Chat IA',
    icon: FileSpreadsheet,
    sessionType: 'CREATE_SALE',
    color: 'bg-indigo-50 text-indigo-600',
    hoverColor: 'hover:bg-indigo-100',
    chatRoute: '/dashboard/practice/cotizaciones/new',
  },
  {
    id: 'new-purchase',
    title: 'Nueva Compra',
    description: 'Registrar compra con Chat IA',
    icon: ShoppingBag,
    sessionType: 'CREATE_PURCHASE',
    color: 'bg-indigo-50 text-indigo-600',
    hoverColor: 'hover:bg-indigo-100',
    chatRoute: '/dashboard/practice/compras/new',
  },
];

export function VoiceAssistantHubModal({ isOpen, onClose, doctorId }: VoiceAssistantHubModalProps) {
  const router = useRouter();
  const [activeAction, setActiveAction] = useState<VoiceAction | null>(null);
  const [voiceModalOpen, setVoiceModalOpen] = useState(false);
  const [voiceSidebarOpen, setVoiceSidebarOpen] = useState(false);
  const [sidebarInitialData, setSidebarInitialData] = useState<InitialChatData | undefined>(undefined);

  if (!isOpen) return null;

  const handleActionClick = (action: VoiceAction) => {
    if (action.chatRoute) {
      onClose();
      router.push(action.chatRoute + '?chat=true');
      return;
    }
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
      <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
        {/* Backdrop */}
        <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />

        {/* Modal Content */}
        <div className="relative bg-white sm:rounded-xl shadow-2xl w-full h-full sm:h-auto sm:max-w-2xl sm:mx-4 sm:max-h-[90vh] overflow-hidden flex flex-col">
          {/* Header */}
          <div className="border-b border-gray-200 bg-gray-50 px-4 py-3 sm:px-6 sm:py-4 shrink-0">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5 sm:gap-3">
                <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-lg bg-indigo-100 flex items-center justify-center shrink-0">
                  <Sparkles className="w-4.5 h-4.5 sm:w-5 sm:h-5 text-indigo-600" />
                </div>
                <div>
                  <h2 className="text-base sm:text-lg font-semibold text-gray-900">Asistente IA</h2>
                  <p className="text-xs sm:text-sm text-gray-500">Crea registros con Chat IA o voz</p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="p-2 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
                title="Cerrar"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Scrollable Content */}
          <div className="flex-1 overflow-y-auto overscroll-contain p-4 sm:p-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 sm:gap-3">
              {VOICE_ACTIONS.map((action) => {
                const Icon = action.icon;
                const isChatIA = !!action.chatRoute;
                return (
                  <button
                    key={action.id}
                    onClick={() => handleActionClick(action)}
                    className={`
                      flex items-center gap-3 p-3 sm:p-4 rounded-lg
                      border bg-white transition-colors text-left active:scale-[0.98]
                      ${isChatIA
                        ? 'border-indigo-200 hover:border-indigo-400 hover:bg-indigo-50'
                        : 'border-gray-200 hover:border-blue-300 hover:bg-blue-50'
                      }
                    `}
                  >
                    <div className={`w-9 h-9 sm:w-10 sm:h-10 rounded-lg flex items-center justify-center shrink-0 ${action.color}`}>
                      <Icon className="w-4.5 h-4.5 sm:w-5 sm:h-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <h3 className="font-medium text-sm text-gray-900">{action.title}</h3>
                        {isChatIA && <Sparkles className="w-3.5 h-3.5 text-indigo-500 shrink-0" />}
                      </div>
                      <p className="text-xs text-gray-500 hidden sm:block">{action.description}</p>
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Info Box */}
            <div className="mt-4 sm:mt-6 p-3 sm:p-4 bg-gray-50 border border-gray-200 rounded-lg">
              <p className="text-xs sm:text-sm text-gray-600">
                <span className="font-medium text-gray-700">Tip:</span> Las acciones con <Sparkles className="w-3 h-3 text-indigo-500 inline" /> usan Chat IA para llenar formularios con texto o voz.
                Las demás usan el asistente de voz clásico.
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
            if (!activeAction) return;
            const config = SESSION_TYPE_ROUTES[activeAction.sessionType];
            if (config) {
              sessionStorage.setItem(config.storageKey, JSON.stringify({
                data,
                sessionId: sidebarInitialData?.sessionId,
                transcriptId: sidebarInitialData?.transcriptId,
              }));
              handleSidebarClose();
              onClose();
              router.push(config.route + '?voice=true');
            }
          }}
        />
      )}
    </>
  );
}
