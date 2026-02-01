'use client';

/**
 * VoiceChatSidebar
 *
 * Main chat sidebar component that slides in from the right.
 * Integrates all chat components and manages the session.
 */

import { useEffect, useState, useRef } from 'react';
import { X, CheckCircle, RotateCcw, AlertCircle, GripVertical } from 'lucide-react';
import { ChatMessageList } from './ChatMessageList';
import { ChatInput } from './ChatInput';
import { StructuredDataPreview } from './StructuredDataPreview';
import { BatchEntryList } from './BatchEntryList';
import { BatchTaskList } from './BatchTaskList';
import { useChatSession } from '@/hooks/useChatSession';
import type { InitialChatData } from '@/hooks/useChatSession';
import type {
  VoiceSessionType,
  VoiceSessionContext,
  VoiceStructuredData,
  VoiceLedgerEntryBatch,
  VoiceTaskBatch,
  EXTRACTABLE_FIELDS,
  FIELD_LABELS_ES,
} from '@/types/voice-assistant';
import { EXTRACTABLE_FIELDS as FIELDS, FIELD_LABELS_ES as LABELS } from '@/types/voice-assistant';

// Sidebar width constraints
const MIN_WIDTH = 320;
const MAX_WIDTH = 800;
const DEFAULT_WIDTH = 384; // 96 * 4 (24rem = sm:w-96)

// Context data for different session types
interface Client {
  id: number;
  businessName: string;
  contactName?: string | null;
}

interface Supplier {
  id: number;
  businessName: string;
  contactName?: string | null;
}

interface Product {
  id: number;
  name: string;
  sku?: string | null;
  unit?: string | null;
  price?: string | null;
}

interface SaleContext {
  clients?: Client[];
  products?: Product[];
}

interface PurchaseContext {
  suppliers?: Supplier[];
  products?: Product[];
}

interface VoiceChatSidebarProps {
  isOpen: boolean;
  onClose: () => void;
  sessionType: VoiceSessionType;
  patientId: string;
  doctorId: string;
  context?: VoiceSessionContext;
  onConfirm: (data: VoiceStructuredData) => void;
  initialData?: InitialChatData; // NEW: Initial voice recording data
  saleContext?: SaleContext; // NEW: For CREATE_SALE session type
  purchaseContext?: PurchaseContext; // NEW: For CREATE_PURCHASE session type
}

// Titles per session type
const SIDEBAR_TITLES: Record<VoiceSessionType, string> = {
  NEW_PATIENT: 'Asistente - Nuevo Paciente',
  NEW_ENCOUNTER: 'Asistente - Nueva Consulta',
  NEW_PRESCRIPTION: 'Asistente - Nueva Receta',
  CREATE_APPOINTMENT_SLOTS: 'Asistente - Crear Horarios',
  CREATE_LEDGER_ENTRY: 'Asistente - Movimiento de Dinero',
  CREATE_SALE: 'Asistente - Nueva Venta',
  CREATE_PURCHASE: 'Asistente - Nueva Compra',
  NEW_TASK: 'Asistente - Nuevo Pendiente',
};

export function VoiceChatSidebar({
  isOpen,
  onClose,
  sessionType,
  patientId,
  doctorId,
  context,
  onConfirm,
  initialData,
  saleContext,
  purchaseContext,
}: VoiceChatSidebarProps) {
  const chat = useChatSession({
    sessionType,
    patientId,
    doctorId,
    context,
    initialData, // Pass through initial data from voice recording modal
    onConfirm: (data) => {
      onConfirm(data);
      onClose();
    },
  });

  // Sidebar width state
  const [width, setWidth] = useState(DEFAULT_WIDTH);
  const [isResizing, setIsResizing] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const sidebarRef = useRef<HTMLDivElement>(null);

  // Detect mobile
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 640);
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Load saved width from localStorage
  useEffect(() => {
    const saved = localStorage.getItem('voiceChatSidebarWidth');
    if (saved) {
      const parsedWidth = parseInt(saved, 10);
      if (parsedWidth >= MIN_WIDTH && parsedWidth <= MAX_WIDTH) {
        setWidth(parsedWidth);
      }
    }
  }, []);

  // Handle escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };

    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [isOpen, onClose]);

  // Prevent body scroll when sidebar is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  // Handle resize
  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing(true);
  };

  useEffect(() => {
    if (!isResizing) return;

    // Prevent text selection while resizing
    document.body.style.userSelect = 'none';
    document.body.style.cursor = 'col-resize';

    const handleMouseMove = (e: MouseEvent) => {
      if (!sidebarRef.current) return;

      // Calculate new width based on distance from right edge
      const newWidth = window.innerWidth - e.clientX;

      // Clamp between min and max
      const clampedWidth = Math.max(MIN_WIDTH, Math.min(MAX_WIDTH, newWidth));

      setWidth(clampedWidth);
    };

    const handleMouseUp = () => {
      setIsResizing(false);
      // Restore cursor and selection
      document.body.style.userSelect = '';
      document.body.style.cursor = '';
      // Save to localStorage
      localStorage.setItem('voiceChatSidebarWidth', width.toString());
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.body.style.userSelect = '';
      document.body.style.cursor = '';
    };
  }, [isResizing, width]);

  const handleConfirm = () => {
    console.log('[VoiceChatSidebar] Confirming data:', {
      hasCurrentData: !!chat.currentData,
      fieldsCount: chat.fieldsExtracted.length,
      currentData: chat.currentData
    });

    const result = chat.confirmData();

    console.log('[VoiceChatSidebar] Confirm result:', result);
  };

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/30 z-40 transition-opacity"
        onClick={onClose}
      />

      {/* Resize cursor overlay when resizing */}
      {isResizing && (
        <div className="fixed inset-0 z-[60] cursor-col-resize" />
      )}

      {/* Sidebar */}
      <div
        ref={sidebarRef}
        style={{
          // Use full width on mobile, custom width on desktop
          width: isMobile ? '100%' : `${width}px`
        }}
        className={`
          fixed right-0 top-0 h-full bg-white shadow-2xl z-50
          flex flex-col
          transform transition-transform duration-300 ease-out
          ${isOpen ? 'translate-x-0' : 'translate-x-full'}
          ${isResizing ? 'transition-none' : ''}
        `}
      >
        {/* Resize Handle - hidden on mobile */}
        <div
          onMouseDown={handleMouseDown}
          className={`
            hidden sm:block
            absolute left-0 top-0 bottom-0 w-2 cursor-col-resize z-10
            hover:bg-blue-400 transition-all
            group
            ${isResizing ? 'bg-blue-500' : 'bg-gray-200'}
          `}
          title="Arrastra para ajustar el ancho"
        >
          {/* Grip icon - shows on hover */}
          <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 opacity-50 group-hover:opacity-100 transition-opacity pointer-events-none">
            <GripVertical className="w-3 h-3 text-gray-600" />
          </div>
        </div>
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 bg-gray-50">
          <h2 className="font-semibold text-gray-900">
            {SIDEBAR_TITLES[sessionType]}
          </h2>
          <div className="flex items-center gap-2">
            {/* Reset button */}
            {chat.messages.length > 0 && (
              <button
                onClick={chat.resetSession}
                className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-200 rounded-lg transition-colors"
                title="Reiniciar conversación"
              >
                <RotateCcw className="w-4 h-4" />
              </button>
            )}
            {/* Close button */}
            <button
              onClick={onClose}
              className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-200 rounded-lg transition-colors"
              title="Cerrar"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Error banner */}
        {chat.error && (
          <div className="px-4 py-2 bg-red-50 border-b border-red-100 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0" />
            <p className="text-sm text-red-700 flex-1">{chat.error}</p>
          </div>
        )}

        {/* Messages */}
        <ChatMessageList
          messages={chat.messages}
          sessionType={sessionType}
          isProcessing={chat.isProcessing}
        />

        {/* Data summary and confirm button */}
        {chat.isReady && chat.currentData && (
          <div className="border-t border-gray-200 bg-green-50 p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2">
                  <CheckCircle className="w-5 h-5 text-green-600" />
                  <span className="font-medium text-green-800">
                    {chat.fieldsExtracted.length} campos capturados
                  </span>
                </div>
                {(() => {
                  const allFields = FIELDS[sessionType];
                  const missingCount = allFields.length - chat.fieldsExtracted.length;
                  if (missingCount > 0) {
                    return (
                      <span className="text-sm text-gray-600">
                        • {missingCount} faltantes
                      </span>
                    );
                  }
                  return null;
                })()}
              </div>
              <span className="text-xs text-gray-500">
                Campos faltantes aparecen en gris
              </span>
            </div>

            {/* Prescription-specific tip */}
            {sessionType === 'NEW_PRESCRIPTION' && (
              <div className="mb-2 bg-blue-50 border border-blue-200 rounded-lg p-2">
                <p className="text-xs text-blue-800">
                  💡 <strong>Tip:</strong> Puede dictar o escribir múltiples medicamentos con todas sus características (dosis, frecuencia, indicaciones). Todos serán agregados a la receta.
                </p>
              </div>
            )}

            {/* Compact data preview with filled and missing fields */}
            <div className="bg-white rounded-lg p-3 mb-3 max-h-48 overflow-y-auto border border-green-200">
              {/* Check if this is a batch entry for CREATE_LEDGER_ENTRY */}
              {sessionType === 'CREATE_LEDGER_ENTRY' &&
               chat.currentData &&
               (chat.currentData as VoiceLedgerEntryBatch).isBatch ? (
                <BatchEntryList
                  entries={(chat.currentData as VoiceLedgerEntryBatch).entries}
                  onUpdateEntries={(updatedEntries) => {
                    const batchData = chat.currentData as VoiceLedgerEntryBatch;
                    chat.currentData = {
                      ...batchData,
                      entries: updatedEntries,
                      totalCount: updatedEntries.length,
                    };
                  }}
                />
              ) : sessionType === 'NEW_TASK' &&
               chat.currentData &&
               (chat.currentData as VoiceTaskBatch).isBatch ? (
                <BatchTaskList
                  entries={(chat.currentData as VoiceTaskBatch).entries}
                  onUpdateEntries={(updatedEntries) => {
                    const batchData = chat.currentData as VoiceTaskBatch;
                    chat.currentData = {
                      ...batchData,
                      entries: updatedEntries,
                      totalCount: updatedEntries.length,
                    };
                  }}
                />
              ) : (
                <StructuredDataPreview
                  data={chat.currentData}
                  sessionType={sessionType}
                  fieldsExtracted={chat.fieldsExtracted}
                  compact
                  showMissing
                  clients={saleContext?.clients}
                  products={saleContext?.products || purchaseContext?.products}
                  suppliers={purchaseContext?.suppliers}
                />
              )}
            </div>

            {/* Confirm button */}
            <button
              onClick={handleConfirm}
              className="w-full py-3 bg-green-600 hover:bg-green-700 text-white font-medium rounded-lg transition-colors flex items-center justify-center gap-2"
            >
              <CheckCircle className="w-5 h-5" />
              {sessionType === 'CREATE_LEDGER_ENTRY' &&
               chat.currentData &&
               (chat.currentData as VoiceLedgerEntryBatch).isBatch
                ? `Crear ${(chat.currentData as VoiceLedgerEntryBatch).totalCount} Movimientos`
                : 'Confirmar y Rellenar Formulario'}
            </button>
          </div>
        )}

        {/* Input */}
        <ChatInput
          isRecording={chat.isRecording}
          isProcessing={chat.isProcessing}
          recordingDuration={chat.recordingDurationFormatted}
          onStartRecording={chat.startVoiceMessage}
          onStopRecording={chat.stopVoiceMessage}
          onCancelRecording={chat.cancelVoiceMessage}
          onSendText={chat.sendTextMessage}
          disabled={false}
        />
      </div>
    </>
  );
}

export default VoiceChatSidebar;
