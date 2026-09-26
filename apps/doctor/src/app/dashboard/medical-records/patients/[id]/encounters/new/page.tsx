'use client';

import { ArrowLeft, Loader2, Sparkles } from 'lucide-react';
import Link from 'next/link';
import { EncounterForm } from '@/components/medical-records/EncounterForm';
import { TemplateSelector } from '@/components/medical-records/TemplateSelector';
import { AIDraftBanner, VoiceChatSidebar, VoiceRecordingModal } from '@/components/voice-assistant';
import { EncounterChatPanel } from '@/components/medical-records/EncounterChatPanel';
import { useNewEncounterPage } from '../_components/useNewEncounterPage';
import { formatoFechaVisita, visitaHref } from '@/lib/visitas-ui';

export default function NewEncounterPage() {
  const {
    patientId,
    patientName,
    session,
    sessionStatus,
    aiAllowed,
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
    visitaId,
    fechaVisita,
    errorVisita,
  } = useNewEncounterPage();
  // VISITAS D4 — desde una visita se vuelve a ELLA, y el título dice qué se está haciendo.
  const volverHref = visitaId
    ? visitaHref(patientId, visitaId)
    : `/dashboard/medical-records/patients/${patientId}`;

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
    // Fila flex: el formulario a la izquierda y el chat como HERMANO, no encima.
    //
    // 🔴 En `lg` la fila se ACOTA A LA PANTALLA y quien hace scroll es la
    // columna izquierda. Sin esto el alto de la fila es el del formulario
    // entero, el panel se estira hasta ahí, su `overflow-y-auto` no tiene nada
    // que desbordar y la caja de escribir queda hasta el final — habría que
    // recorrer toda la consulta para teclear un mensaje. Es exactamente la
    // trampa documentada en `PantallaInforme`.
    <div className="flex min-h-screen lg:h-screen lg:min-h-0">
      <div className="flex-1 min-w-0 overflow-x-hidden p-4 sm:p-6 lg:overflow-y-auto">
        <div className={chatPanelOpen ? 'max-w-none' : 'max-w-4xl mx-auto'}>
      {/* Header */}
      <div className="mb-6">
        <Link
          href={volverHref}
          className="inline-flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-4"
        >
          <ArrowLeft className="w-5 h-5" />
          {visitaId ? 'Volver a la Visita' : 'Volver al Paciente'}
        </Link>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{visitaId ? 'Agregar plantilla' : 'Nueva Consulta'}</h1>
            {patientName && (
              <p className="text-base font-medium text-gray-700 mt-1">{patientName}</p>
            )}
            <p className="text-gray-600 mt-1">
              {visitaId
                ? fechaVisita
                  ? `Visita del ${formatoFechaVisita(fechaVisita, { day: 'numeric', month: 'long', year: 'numeric' })}`
                  : 'Cargando la visita…'
                : 'Registre los detalles de la consulta'}
            </p>
            {errorVisita && (
              <p className="text-sm text-red-700 mt-1">No se pudo cargar la visita. Recarga la página para intentar de nuevo.</p>
            )}
          </div>
          {aiAllowed && (
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
          )}
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
        submitLabel={visitaId ? 'Guardar en la visita' : 'Crear Consulta'}
        cancelHref={visitaId ? volverHref : undefined}
        fechaFija={fechaVisita ?? undefined}
        templateConfig={templateConfig}
        selectedTemplate={selectedTemplate}
        onFormDataChange={setCurrentFormData}
        onCustomFieldValuesChange={setCurrentCustomFieldValues}
        chatFieldUpdates={chatFieldUpdates}
        chatCustomFieldUpdates={chatCustomFieldUpdates}
      />
        </div>
      </div>

      {/* AI Chat Panel — HERMANO de la columna del formulario, no hijo: es lo
          que hace que el formulario se encoja en vez de quedar tapado. */}
      {chatPanelOpen && currentFormData && (
        <EncounterChatPanel
          onClose={() => setChatPanelOpen(false)}
          currentFormData={currentFormData}
          onUpdateForm={handleChatUpdateForm}
          templateInfo={chatTemplateInfo}
          onUpdateCustomFields={handleChatUpdateCustomFields}
        />
      )}

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
