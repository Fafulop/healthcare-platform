'use client';

import { ArrowLeft, Loader2, Sparkles } from 'lucide-react';
import Link from 'next/link';
import { EncounterForm } from '@/components/medical-records/EncounterForm';
import { TemplateSelector } from '@/components/medical-records/TemplateSelector';
import { AIDraftBanner, VoiceChatSidebar, VoiceRecordingModal } from '@/components/voice-assistant';
import { EncounterChatPanel } from '@/components/medical-records/EncounterChatPanel';
import { useNewEncounterPage } from '../_components/useNewEncounterPage';

export default function NewEncounterPage() {
  const {
    patientId,
    session,
    sessionStatus,
    doctorProfile,
    selectedTemplate,
    modalOpen, setModalOpen,
    sidebarOpen, setSidebarOpen,
    sidebarInitialData,
    voiceInitialData,
    showAIBanner, setShowAIBanner,
    aiMetadata,
    handleModalComplete,
    handleVoiceConfirm,
    handleTemplateSelect,
    chatPanelOpen, setChatPanelOpen,
    currentFormData, setCurrentFormData,
    currentCustomFieldValues, setCurrentCustomFieldValues,
    chatFieldUpdates,
    chatCustomFieldUpdates,
    chatTemplateInfo,
    handleChatUpdateForm,
    handleChatUpdateCustomFields,
    templateConfig,
    handleSubmit,
  } = useNewEncounterPage();

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
          href={`/dashboard/medical-records/patients/${patientId}`}
          className="inline-flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-4"
        >
          <ArrowLeft className="w-5 h-5" />
          Volver al Paciente
        </Link>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Nueva Consulta</h1>
            <p className="text-gray-600 mt-1">Registre los detalles de la consulta</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setChatPanelOpen((prev) => !prev)}
              className={`inline-flex items-center gap-2 px-4 py-2 font-medium rounded-lg transition-colors ${
                chatPanelOpen
                  ? 'bg-indigo-100 text-indigo-700 hover:bg-indigo-200'
                  : 'bg-indigo-600 text-white hover:bg-indigo-700'
              }`}
            >
              <Sparkles className="w-5 h-5" />
              Chat IA
            </button>
          </div>
        </div>
      </div>

      {/* Template Selector */}
      <div className="bg-white rounded-lg shadow p-4 mb-6">
        <div className="flex items-center gap-4">
          <label className="text-sm font-medium text-gray-700 whitespace-nowrap">
            Plantilla:
          </label>
          <TemplateSelector
            selectedTemplateId={selectedTemplate?.id || null}
            onSelect={handleTemplateSelect}
          />
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

      <EncounterForm
        key={selectedTemplate?.id || 'no-template'}
        patientId={patientId}
        initialData={voiceInitialData}
        onSubmit={handleSubmit}
        submitLabel="Crear Consulta"
        templateConfig={templateConfig}
        selectedTemplate={selectedTemplate}
        onFormDataChange={setCurrentFormData}
        onCustomFieldValuesChange={setCurrentCustomFieldValues}
        chatFieldUpdates={chatFieldUpdates}
        chatCustomFieldUpdates={chatCustomFieldUpdates}
      />

      {/* Voice Recording Modal */}
      {session?.user?.doctorId && (
        <VoiceRecordingModal
          isOpen={modalOpen}
          onClose={() => setModalOpen(false)}
          sessionType="NEW_ENCOUNTER"
          context={{
            patientId,
            doctorId: session.user.doctorId,
            doctorName: doctorProfile?.slug || undefined,
          }}
          templateId={selectedTemplate?.id}
          onComplete={handleModalComplete}
        />
      )}

      {/* AI Chat Panel */}
      {chatPanelOpen && currentFormData && (
        <EncounterChatPanel
          onClose={() => setChatPanelOpen(false)}
          currentFormData={currentFormData}
          onUpdateForm={handleChatUpdateForm}
          templateInfo={chatTemplateInfo}
          onUpdateCustomFields={handleChatUpdateCustomFields}
        />
      )}

      {/* Voice Chat Sidebar */}
      {session?.user?.doctorId && (
        <VoiceChatSidebar
          isOpen={sidebarOpen}
          onClose={() => setSidebarOpen(false)}
          sessionType="NEW_ENCOUNTER"
          patientId={patientId}
          doctorId={session.user.doctorId}
          context={{
            patientId,
            doctorId: session.user.doctorId,
            doctorName: doctorProfile?.slug || undefined,
          }}
          templateId={selectedTemplate?.id}
          initialData={sidebarInitialData}
          onConfirm={handleVoiceConfirm}
        />
      )}
    </div>
  );
}
