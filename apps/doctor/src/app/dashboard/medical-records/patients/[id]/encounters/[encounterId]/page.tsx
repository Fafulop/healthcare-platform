'use client';

import { ArrowLeft, Edit, Calendar, MapPin, FileText, Loader2, ClipboardList, Stethoscope, Trash2, Download, Paperclip, Image, Video, FileAudio, File, ExternalLink, Settings } from 'lucide-react';
import { PdfSettingsDialog } from '@/components/medical-records/PdfSettingsDialog';
import Link from 'next/link';
import { formatDateLong, formatDateTime } from '@/lib/practice-utils';
import { getEncounterTypeLabel } from '../_components/encounter-types';
import { EncounterVitalsCard } from '../_components/EncounterVitalsCard';
import { EncounterSOAPCard } from '../_components/EncounterSOAPCard';
import { useEncounterDetail } from '../_components/useEncounterDetail';

export default function EncounterDetailPage() {
  const {
    patientId,
    encounterId,
    sessionStatus,
    encounter,
    customTemplate,
    loading,
    error,
    isDeleting,
    exportingPDF,
    pdfSettings,
    setPdfSettings,
    showPdfSettings,
    setShowPdfSettings,
    handleExportPDF,
    handleDelete,
  } = useEncounterDetail();

  if (sessionStatus === 'loading' || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <Loader2 className="inline-block h-12 w-12 animate-spin text-blue-600" />
          <p className="mt-4 text-gray-600 font-medium">Cargando...</p>
        </div>
      </div>
    );
  }

  if (error || !encounter) {
    return (
      <div className="p-6">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-red-800">{error || 'Consulta no encontrada'}</p>
          <Link
            href={`/dashboard/medical-records/patients/${patientId}`}
            className="text-red-600 hover:text-red-800 mt-2 inline-block"
          >
            Volver al paciente
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="mb-4">
        <Link
          href={`/dashboard/medical-records/patients/${patientId}`}
          className="inline-flex items-center gap-1.5 text-sm text-gray-600 hover:text-gray-900 mb-3"
        >
          <ArrowLeft className="w-4 h-4" />
          Volver al Paciente
        </Link>

        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-gray-900">Consulta del {formatDateLong(encounter.encounterDate)}</h1>
            <p className="text-sm text-gray-600">
              {encounter.patient.firstName} {encounter.patient.lastName} • ID: {encounter.patient.internalId}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleExportPDF}
              disabled={exportingPDF}
              className="px-3 py-1.5 text-sm border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 flex items-center gap-1.5"
            >
              {exportingPDF ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
              {exportingPDF ? 'Generando...' : 'PDF'}
            </button>
            <button
              onClick={() => setShowPdfSettings(true)}
              className="px-2 py-1.5 text-sm border border-gray-300 rounded-md hover:bg-gray-50"
              title="Configuracion de impresion PDF"
            >
              <Settings className="w-3.5 h-3.5" />
            </button>
            <Link
              href={`/dashboard/medical-records/patients/${patientId}/encounters/${encounterId}/edit`}
              className="px-3 py-1.5 text-sm border border-gray-300 rounded-md hover:bg-gray-50 flex items-center gap-1.5"
            >
              <Edit className="w-3.5 h-3.5" />
              Editar
            </Link>
            <button
              onClick={handleDelete}
              disabled={isDeleting}
              className="px-3 py-1.5 text-sm border border-red-300 text-red-600 rounded-md hover:bg-red-50 disabled:opacity-50 flex items-center gap-1.5"
            >
              <Trash2 className="w-3.5 h-3.5" />
              {isDeleting ? 'Eliminando...' : 'Eliminar'}
            </button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="space-y-4">
        {/* Basic Info + Chief Complaint */}
        <div className="bg-white rounded-lg shadow p-4">
          <div className={`flex flex-wrap items-center gap-x-4 gap-y-2 text-sm ${!(encounter.templateId || encounter.customData) && encounter.chiefComplaint ? 'mb-3 pb-3 border-b border-gray-100' : ''}`}>
            <div className="flex items-center gap-1.5">
              <Calendar className="w-4 h-4 text-gray-400" />
              <span className="text-gray-900">{formatDateLong(encounter.encounterDate)}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <FileText className="w-4 h-4 text-gray-400" />
              <span className="text-gray-900">{getEncounterTypeLabel(encounter.encounterType)}</span>
            </div>
            {encounter.location && (
              <div className="flex items-center gap-1.5">
                <MapPin className="w-4 h-4 text-gray-400" />
                <span className="text-gray-900">{encounter.location}</span>
              </div>
            )}
          </div>
          {!(encounter.templateId || encounter.customData) && encounter.chiefComplaint && (
            <div>
              <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Motivo de Consulta</h3>
              <p className="text-gray-900 whitespace-pre-wrap">{encounter.chiefComplaint}</p>
            </div>
          )}
        </div>

        {/* Vitals */}
        <EncounterVitalsCard
          vitalsBloodPressure={encounter.vitalsBloodPressure}
          vitalsHeartRate={encounter.vitalsHeartRate}
          vitalsTemperature={encounter.vitalsTemperature}
          vitalsWeight={encounter.vitalsWeight}
          vitalsHeight={encounter.vitalsHeight}
          vitalsOxygenSat={encounter.vitalsOxygenSat}
          vitalsOther={encounter.vitalsOther}
        />

        {/* SOAP Notes */}
        <EncounterSOAPCard
          subjective={encounter.subjective}
          objective={encounter.objective}
          assessment={encounter.assessment}
          plan={encounter.plan}
        />

        {/* Clinical Notes */}
        {encounter.clinicalNotes && (
          <div className="bg-white rounded-lg shadow p-4">
            <h3 className="text-sm font-semibold text-gray-900 mb-2 flex items-center gap-1.5">
              <Stethoscope className="w-4 h-4 text-gray-600" />
              Notas Clínicas
            </h3>
            <p className="text-sm text-gray-900 whitespace-pre-wrap">{encounter.clinicalNotes}</p>
          </div>
        )}

        {/* Custom Template Data */}
        {encounter.customData && Object.keys(encounter.customData).length > 0 && (
          <div className="bg-white rounded-lg shadow p-4">
            <h3 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-1.5">
              <ClipboardList className="w-4 h-4 text-blue-600" />
              {customTemplate?.name || 'Datos de la Consulta'}
            </h3>
            <dl className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {customTemplate?.customFields
                ? (customTemplate.customFields as any[]).map((field: any) => {
                    const value = encounter.customData![field.name];
                    if (value === undefined || value === null || value === '') return null;
                    return (
                      <div key={field.name}>
                        <dt className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-0.5">
                          {field.labelEs || field.label || field.name}
                        </dt>
                        <dd className="text-sm text-gray-900 whitespace-pre-wrap">
                          {Array.isArray(value) ? value.join(', ') : String(value)}
                        </dd>
                      </div>
                    );
                  })
                : Object.entries(encounter.customData).map(([key, value]) => {
                    if (value === undefined || value === null || value === '') return null;
                    return (
                      <div key={key}>
                        <dt className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-0.5">
                          {key}
                        </dt>
                        <dd className="text-sm text-gray-900 whitespace-pre-wrap">
                          {Array.isArray(value) ? value.join(', ') : String(value)}
                        </dd>
                      </div>
                    );
                  })}
            </dl>
          </div>
        )}

        {/* Linked Media / Attachments */}
        {encounter.media && encounter.media.length > 0 && (
          <div className="bg-white rounded-lg shadow p-4">
            <h3 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-1.5">
              <Paperclip className="w-4 h-4 text-gray-600" />
              Archivos Adjuntos
              <span className="ml-1 text-xs font-normal text-gray-500">({encounter.media.length})</span>
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {encounter.media.map((file) => {
                const isImage = file.mediaType === 'image';
                const isVideo = file.mediaType === 'video';
                const isAudio = file.mediaType === 'audio';
                const MediaIcon = isImage ? Image : isVideo ? Video : isAudio ? FileAudio : File;
                const categoryLabels: Record<string, string> = {
                  wound: 'Herida', 'x-ray': 'Rayos X', dermatology: 'Dermatología',
                  'lab-result': 'Laboratorio', procedure: 'Procedimiento',
                  consultation: 'Consulta', other: 'Otro',
                };
                const sizeKB = file.fileSize ? Math.round(file.fileSize / 1024) : null;
                const sizeLabel = sizeKB && sizeKB > 1024 ? `${(sizeKB / 1024).toFixed(1)} MB` : sizeKB ? `${sizeKB} KB` : null;

                return (
                  <a
                    key={file.id}
                    href={file.fileUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="group flex items-start gap-3 p-3 rounded-lg border border-gray-200 hover:border-blue-300 hover:bg-blue-50/50 transition-colors"
                  >
                    {isImage && (file.thumbnailUrl || file.fileUrl) ? (
                      <img
                        src={file.thumbnailUrl || file.fileUrl}
                        alt={file.fileName}
                        className="w-12 h-12 rounded object-cover flex-shrink-0 bg-gray-100"
                      />
                    ) : (
                      <div className="w-12 h-12 rounded bg-gray-100 flex items-center justify-center flex-shrink-0">
                        <MediaIcon className="w-5 h-5 text-gray-500" />
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-gray-900 truncate group-hover:text-blue-700">
                        {file.fileName}
                      </p>
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 mt-0.5">
                        {file.category && (
                          <span className="text-xs text-gray-500">{categoryLabels[file.category] || file.category}</span>
                        )}
                        {sizeLabel && <span className="text-xs text-gray-400">{sizeLabel}</span>}
                      </div>
                      {file.description && (
                        <p className="text-xs text-gray-500 mt-1 line-clamp-1">{file.description}</p>
                      )}
                    </div>
                    <ExternalLink className="w-3.5 h-3.5 text-gray-400 group-hover:text-blue-500 flex-shrink-0 mt-0.5" />
                  </a>
                );
              })}
            </div>
            <Link
              href={`/dashboard/medical-records/patients/${patientId}/media?encounterId=${encounterId}`}
              className="inline-flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 mt-3"
            >
              Ver en galería completa
              <ExternalLink className="w-3 h-3" />
            </Link>
          </div>
        )}

        {/* Follow-up */}
        {(encounter.followUpDate || encounter.followUpNotes) && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <h3 className="text-sm font-semibold text-gray-900 mb-2 flex items-center gap-1.5">
              <Calendar className="w-4 h-4 text-blue-600" />
              Seguimiento
              {encounter.followUpDate && (
                <span className="ml-auto text-sm font-normal text-blue-700">
                  {formatDateLong(encounter.followUpDate)}
                </span>
              )}
            </h3>
            {encounter.followUpNotes && (
              <p className="text-sm text-gray-900 whitespace-pre-wrap">{encounter.followUpNotes}</p>
            )}
          </div>
        )}

        {/* Metadata */}
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-500 px-1">
          <span>Creada: {formatDateTime(encounter.createdAt)}</span>
          <span>Actualizada: {formatDateTime(encounter.updatedAt)}</span>
        </div>
      </div>

      <PdfSettingsDialog
        open={showPdfSettings}
        onClose={() => setShowPdfSettings(false)}
        onSettingsLoaded={(s) => setPdfSettings(s)}
      />
    </div>
  );
}
