'use client';

import { ArrowLeft, Loader2, Sparkles } from 'lucide-react';
import Link from 'next/link';
import { PatientForm } from '@/components/medical-records/PatientForm';
import { PatientChatPanel } from '@/components/medical-records/PatientChatPanel';
import { AIDraftBanner, VoiceChatSidebar, VoiceRecordingModal } from '@/components/voice-assistant';
import { useNewPatientPage } from '../_components/useNewPatientPage';

export default function NewPatientPage() {
  const {
    session,
    sessionStatus,
    doctorProfile,
    modalOpen, setModalOpen,
    sidebarOpen, setSidebarOpen,
    sidebarInitialData,
    voiceInitialData,
    showAIBanner, setShowAIBanner,
    aiMetadata,
    handleModalComplete,
    handleVoiceConfirm,
    chatPanelOpen, setChatPanelOpen,
    setCurrentFormSnapshot,
    chatFieldUpdates,
    chatFieldUpdatesVersion,
    chatFormData,
    handleChatFieldUpdates,
    handleSubmit,
  } = useNewPatientPage();

  if (sessionStatus === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <Loader2 className="inline-block h-12 w-12 animate-spin text-blue-600" />
          <p className="mt-4 text-gray-600 font-medium">Cargando...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <Link
          href="/dashboard/medical-records"
          className="inline-flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-4"
        >
          <ArrowLeft className="w-5 h-5" />
          Volver a Pacientes
        </Link>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Nuevo Paciente</h1>
            <p className="text-gray-600 mt-1">Complete la información del paciente</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setChatPanelOpen(true)}
              className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white font-medium rounded-lg hover:bg-indigo-700 transition-colors"
            >
              <Sparkles className="w-5 h-5" />
              Chat IA
            </button>
          </div>
        </div>
      </div>

      {/* AI Draft Banner */}
      {showAIBanner && aiMetadata && (
        <AIDraftBanner
          confidence={aiMetadata.confidence}
          fieldsExtracted={aiMetadata.fieldsExtracted}
          fieldsEmpty={aiMetadata.fieldsEmpty}
          onDismiss={() => setShowAIBanner(false)}
        />
      )}

      <PatientForm
        initialData={voiceInitialData}
        onSubmit={handleSubmit}
        submitLabel="Crear Paciente"
        cancelHref="/dashboard/medical-records"
        onFormChange={setCurrentFormSnapshot}
        chatFieldUpdates={chatFieldUpdates}
        chatFieldUpdatesVersion={chatFieldUpdatesVersion}
      />

      {/* Voice Recording Modal */}
      {session?.user?.doctorId && (
        <VoiceRecordingModal
          isOpen={modalOpen}
          onClose={() => setModalOpen(false)}
          sessionType="NEW_PATIENT"
          context={{
            patientId: undefined,
            doctorId: session.user.doctorId,
            doctorName: doctorProfile?.slug || undefined,
          }}
          onComplete={handleModalComplete}
        />
      )}

      {/* Voice Chat Sidebar */}
      {session?.user?.doctorId && (
        <VoiceChatSidebar
          isOpen={sidebarOpen}
          onClose={() => setSidebarOpen(false)}
          sessionType="NEW_PATIENT"
          patientId="new"
          doctorId={session.user.doctorId}
          context={{
            patientId: undefined,
            doctorId: session.user.doctorId,
            doctorName: doctorProfile?.slug || undefined,
          }}
          initialData={sidebarInitialData}
          onConfirm={handleVoiceConfirm}
        />
      )}

      {/* Chat IA Panel */}
      {chatPanelOpen && (
        <PatientChatPanel
          onClose={() => setChatPanelOpen(false)}
          currentFormData={chatFormData}
          onUpdateFields={handleChatFieldUpdates}
        />
      )}
    </div>
  );
}
