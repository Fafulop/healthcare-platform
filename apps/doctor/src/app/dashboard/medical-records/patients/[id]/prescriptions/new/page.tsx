'use client';

import { ArrowLeft, Save, Loader2, Sparkles } from 'lucide-react';
import Link from 'next/link';
import { MedicationList } from '@/components/medical-records/MedicationList';
import { ImagingStudyList, LabStudyList } from '@/components/medical-records/StudyList';
import {
  AIDraftBanner,
  VoiceChatSidebar,
  VoiceRecordingModal,
} from '@/components/voice-assistant';
import { PrescriptionChatPanel } from '@/components/medical-records/PrescriptionChatPanel';
import { DynamicFieldRenderer } from '@/components/medical-records/DynamicFieldRenderer';
import { formatLocalDate as formatDateString } from '@/lib/dates';
import { useNewPrescriptionForm } from '../_components/useNewPrescriptionForm';

export default function NewPrescriptionPage() {
  const {
    patientId,
    session,
    sessionStatus,
    patient,
    doctorProfile,
    encounters,
    loading,
    loadingPatient,
    error,
    prescriptionDate, setPrescriptionDate,
    diagnosis, setDiagnosis,
    clinicalNotes, setClinicalNotes,
    doctorFullName, setDoctorFullName,
    doctorLicense, setDoctorLicense,
    doctorCredentials,
    expiresAt, setExpiresAt,
    medications, setMedications,
    imagingStudies, setImagingStudies,
    labStudies, setLabStudies,
    selectedEncounterId, setSelectedEncounterId,
    recetaTemplates,
    selectedTemplateId,
    handleTemplateSelect,
    selectedTemplate,
    customData,
    handleCustomFieldChange,
    modalOpen, setModalOpen,
    sidebarOpen, setSidebarOpen,
    sidebarInitialData,
    showAIBanner, setShowAIBanner,
    aiMetadata,
    handleModalComplete,
    handleVoiceConfirm,
    chatPanelOpen, setChatPanelOpen,
    currentFormData,
    handleChatFieldUpdates,
    handleChatMedicationUpdates,
    handleChatImagingStudyUpdates,
    handleChatLabStudyUpdates,
    handleSubmit,
  } = useNewPrescriptionForm();

  if (sessionStatus === 'loading' || loadingPatient) {
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
          href={`/dashboard/medical-records/patients/${patientId}/prescriptions`}
          className="inline-flex items-center text-blue-600 hover:text-blue-700 mb-4"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Volver a Prescripciones
        </Link>

        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Nueva Prescripción</h1>
            {patient && (
              <p className="text-gray-600 mt-1">
                Paciente: {patient.firstName} {patient.lastName} (ID: {patient.internalId})
              </p>
            )}
          </div>
          <div className="flex items-center gap-2">
            {/* Chat IA edits the fixed fields — hidden in template mode */}
            {!selectedTemplate && (
              <button
                onClick={() => setChatPanelOpen(true)}
                className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white font-medium rounded-lg hover:bg-indigo-700 transition-colors"
              >
                <Sparkles className="w-5 h-5" />
                Chat IA
              </button>
            )}
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

      {/* Error */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-6">
          {error}
        </div>
      )}

      {/* Form */}
      <form onSubmit={(e) => handleSubmit(e, false)} className="space-y-6">
        {/* Template selector — a receta template replaces the fixed form */}
        {recetaTemplates.length > 0 && (
          <div className="bg-white rounded-lg shadow p-6 space-y-2">
            <label className="block text-sm font-medium text-gray-700">
              Tipo de Receta
            </label>
            <select
              value={selectedTemplateId}
              onChange={(e) => handleTemplateSelect(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Receta estándar (medicamentos y estudios)</option>
              {recetaTemplates.map((t) => (
                <option key={t.id} value={t.id}>
                  Plantilla: {t.name}
                </option>
              ))}
            </select>
            {selectedTemplate?.description && (
              <p className="text-sm text-gray-500">{selectedTemplate.description}</p>
            )}
          </div>
        )}

        {/* Prescription Info */}
        <div className="bg-white rounded-lg shadow p-6 space-y-4">
          <h2 className="text-lg font-semibold text-gray-900">Información General</h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Fecha de Prescripción *
              </label>
              <input
                type="date"
                value={prescriptionDate}
                onChange={(e) => setPrescriptionDate(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Fecha de Expiración
              </label>
              <input
                type="date"
                value={expiresAt}
                onChange={(e) => setExpiresAt(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          {/* Content fields — replaced by the template's own fields */}
          {!selectedTemplate && (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Diagnóstico
                </label>
                <input
                  type="text"
                  value={diagnosis}
                  onChange={(e) => setDiagnosis(e.target.value)}
                  placeholder="Ej: Infección respiratoria aguda"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Notas Clínicas
                </label>
                <textarea
                  value={clinicalNotes}
                  onChange={(e) => setClinicalNotes(e.target.value)}
                  placeholder="Notas adicionales sobre el tratamiento"
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Vincular a Consulta (Opcional)
            </label>
            <select
              value={selectedEncounterId}
              onChange={(e) => setSelectedEncounterId(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Ninguna consulta seleccionada</option>
              {encounters.map(encounter => (
                <option key={encounter.id} value={encounter.id}>
                  {formatDateString(encounter.encounterDate)} - {encounter.chiefComplaint}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Doctor Info — from the saved receta identity when configured */}
        <div className="bg-white rounded-lg shadow p-6 space-y-4">
          <h2 className="text-lg font-semibold text-gray-900">Información del Doctor</h2>

          {doctorCredentials.length > 0 ? (
            <div className="rounded-md bg-gray-50 border border-gray-200 px-4 py-3">
              <p className="font-medium text-gray-900">{doctorFullName}</p>
              <ul className="mt-1 space-y-0.5">
                {doctorCredentials.map((c, i) => (
                  <li key={i} className="text-sm text-gray-600">
                    {c.titulo} — Céd. {c.cedula}
                  </li>
                ))}
              </ul>
              <p className="mt-2 text-xs text-gray-400">
                Estos datos vienen de tu perfil y aparecerán en la receta y su PDF.{' '}
                <Link href="/dashboard/mi-perfil" className="text-blue-600 hover:underline">
                  Editar en Mi Perfil
                </Link>
              </p>
            </div>
          ) : (
            <>
              <p className="text-xs text-amber-700">
                💡 Guarda tu nombre, cédulas y firma una sola vez en{' '}
                <Link href="/dashboard/mi-perfil" className="underline">
                  Mi Perfil → Receta
                </Link>{' '}
                y este bloque se llenará automáticamente.
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Nombre Completo *
                  </label>
                  <input
                    type="text"
                    value={doctorFullName}
                    onChange={(e) => setDoctorFullName(e.target.value)}
                    placeholder="Dr. Juan Pérez"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Cédula Profesional *
                  </label>
                  <input
                    type="text"
                    value={doctorLicense}
                    onChange={(e) => setDoctorLicense(e.target.value)}
                    placeholder="1234567"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>
              </div>
            </>
          )}
        </div>

        {/* Template mode: the template's fields ARE the receta content */}
        {selectedTemplate ? (
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">
              {selectedTemplate.name}
            </h2>
            <DynamicFieldRenderer
              fields={(selectedTemplate.customFields || []) as any}
              values={customData}
              onChange={handleCustomFieldChange}
            />
          </div>
        ) : (
          <>
            {/* Medications */}
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Medicamentos</h2>
              <MedicationList
                medications={medications}
                onChange={setMedications}
              />
            </div>

            {/* Imaging Studies */}
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Estudios de Imagen</h2>
              <ImagingStudyList
                studies={imagingStudies}
                onChange={setImagingStudies}
              />
            </div>

            {/* Lab Studies */}
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Estudios de Laboratorio</h2>
              <LabStudyList
                studies={labStudies}
                onChange={setLabStudies}
              />
            </div>
          </>
        )}

        {/* Actions */}
        <div className="flex items-center justify-end gap-3">
          <Link
            href={`/dashboard/medical-records/patients/${patientId}/prescriptions`}
            className="px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50"
          >
            Cancelar
          </Link>

          <button
            type="submit"
            disabled={loading}
            className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 disabled:opacity-50 flex items-center gap-2"
          >
            <Save className="w-4 h-4" />
            {loading ? 'Guardando...' : 'Guardar como Borrador'}
          </button>

          <button
            type="button"
            onClick={(e) => handleSubmit(e, true)}
            disabled={loading}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
          >
            <Save className="w-4 h-4" />
            {loading ? 'Guardando...' : 'Guardar y Emitir'}
          </button>
        </div>
      </form>

      {/* Voice Recording Modal */}
      {session?.user?.doctorId && (
        <VoiceRecordingModal
          isOpen={modalOpen}
          onClose={() => setModalOpen(false)}
          sessionType="NEW_PRESCRIPTION"
          context={{
            patientId,
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
          sessionType="NEW_PRESCRIPTION"
          patientId={patientId}
          doctorId={session.user.doctorId}
          context={{
            patientId,
            doctorId: session.user.doctorId,
            doctorName: doctorProfile?.slug || undefined,
          }}
          initialData={sidebarInitialData}
          onConfirm={handleVoiceConfirm}
        />
      )}

      {/* Chat IA Panel */}
      {chatPanelOpen && (
        <PrescriptionChatPanel
          onClose={() => setChatPanelOpen(false)}
          currentFormData={currentFormData}
          onUpdateFields={handleChatFieldUpdates}
          onUpdateMedications={handleChatMedicationUpdates}
          onUpdateImagingStudies={handleChatImagingStudyUpdates}
          onUpdateLabStudies={handleChatLabStudyUpdates}
        />
      )}
    </div>
  );
}
