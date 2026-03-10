'use client';

import { ArrowLeft, Edit, Send, Ban, Trash2, Download, Loader2 } from 'lucide-react';
import Link from 'next/link';
import { MedicationList } from '@/components/medical-records/MedicationList';
import { formatDateLong } from '@/lib/practice-utils';
import { getStatusLabel, getStatusColor } from '../_components/prescription-types';
import { usePrescriptionDetail } from '../_components/usePrescriptionDetail';

export default function ViewPrescriptionPage() {
  const {
    patientId,
    prescriptionId,
    sessionStatus,
    prescription,
    loading,
    actionLoading,
    error,
    showCancelModal, setShowCancelModal,
    cancellationReason, setCancellationReason,
    handleIssue,
    handleCancel,
    handleDelete,
    handleDownloadPDF,
  } = usePrescriptionDetail();

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

  if (!prescription) {
    return (
      <div className="p-6 max-w-4xl mx-auto">
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
          Prescripción no encontrada
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

        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Prescripción Médica</h1>
            <p className="text-gray-600 mt-1">
              Paciente: {prescription.patient.firstName} {prescription.patient.lastName} (
              {prescription.patient.internalId})
            </p>
          </div>

          <span className={`px-3 py-1 text-sm rounded ${getStatusColor(prescription.status)}`}>
            {getStatusLabel(prescription.status)}
          </span>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-6">
          {error}
        </div>
      )}

      {/* Actions */}
      <div className="bg-white rounded-lg shadow p-4 mb-6">
        <div className="flex flex-wrap items-center gap-3">
          {prescription.status === 'draft' && (
            <>
              <Link
                href={`/dashboard/medical-records/patients/${patientId}/prescriptions/${prescriptionId}/edit`}
                className="px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 flex items-center gap-2"
              >
                <Edit className="w-4 h-4" />
                Editar
              </Link>

              <button
                onClick={handleIssue}
                disabled={actionLoading}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
              >
                <Send className="w-4 h-4" />
                Emitir Prescripción
              </button>
            </>
          )}

          {prescription.status === 'issued' && (
            <>
              <button
                onClick={handleDownloadPDF}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 flex items-center gap-2"
              >
                <Download className="w-4 h-4" />
                Descargar PDF
              </button>

              <button
                onClick={() => setShowCancelModal(true)}
                disabled={actionLoading}
                className="px-4 py-2 border border-red-300 text-red-600 rounded-md hover:bg-red-50 disabled:opacity-50 flex items-center gap-2"
              >
                <Ban className="w-4 h-4" />
                Cancelar Prescripción
              </button>
            </>
          )}

          <button
            onClick={handleDelete}
            disabled={actionLoading}
            className="px-4 py-2 border border-red-300 text-red-600 rounded-md hover:bg-red-50 disabled:opacity-50 flex items-center gap-2"
          >
            <Trash2 className="w-4 h-4" />
            Eliminar
          </button>

          {prescription.status === 'cancelled' && prescription.cancellationReason && (
            <div className="w-full p-3 bg-red-50 border border-red-200 rounded-md">
              <p className="text-sm font-medium text-red-800">Motivo de Cancelación:</p>
              <p className="text-sm text-red-700 mt-1">{prescription.cancellationReason}</p>
            </div>
          )}
        </div>
      </div>

      {/* Prescription Details */}
      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Información General</h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <p className="text-sm text-gray-600">Fecha de Prescripción</p>
            <p className="text-gray-900">{formatDateLong(prescription.prescriptionDate)}</p>
          </div>

          {prescription.expiresAt && (
            <div>
              <p className="text-sm text-gray-600">Fecha de Expiración</p>
              <p className="text-gray-900">{formatDateLong(prescription.expiresAt)}</p>
            </div>
          )}

          {prescription.diagnosis && (
            <div className="md:col-span-2">
              <p className="text-sm text-gray-600">Diagnóstico</p>
              <p className="text-gray-900">{prescription.diagnosis}</p>
            </div>
          )}

          {prescription.clinicalNotes && (
            <div className="md:col-span-2">
              <p className="text-sm text-gray-600">Notas Clínicas</p>
              <p className="text-gray-900 whitespace-pre-wrap">{prescription.clinicalNotes}</p>
            </div>
          )}
        </div>
      </div>

      {/* Doctor Info */}
      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Información del Doctor</h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <p className="text-sm text-gray-600">Nombre Completo</p>
            <p className="text-gray-900">{prescription.doctorFullName}</p>
          </div>

          <div>
            <p className="text-sm text-gray-600">Cédula Profesional</p>
            <p className="text-gray-900">{prescription.doctorLicense}</p>
          </div>
        </div>
      </div>

      {/* Patient Info */}
      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Información del Paciente</h2>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <p className="text-sm text-gray-600">Nombre</p>
            <p className="text-gray-900">
              {prescription.patient.firstName} {prescription.patient.lastName}
            </p>
          </div>

          <div>
            <p className="text-sm text-gray-600">ID Interno</p>
            <p className="text-gray-900">{prescription.patient.internalId}</p>
          </div>

          <div>
            <p className="text-sm text-gray-600">Sexo</p>
            <p className="text-gray-900">{prescription.patient.sex}</p>
          </div>
        </div>
      </div>

      {/* Medications */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Medicamentos</h2>
        <MedicationList
          medications={prescription.medications}
          onChange={() => {}}
          readOnly
        />
      </div>

      {/* Cancel Modal */}
      {showCancelModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              Cancelar Prescripción
            </h3>

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Motivo de Cancelación *
              </label>
              <textarea
                value={cancellationReason}
                onChange={(e) => setCancellationReason(e.target.value)}
                placeholder="Explique por qué se cancela esta prescripción"
                rows={4}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>

            <div className="flex items-center justify-end gap-3">
              <button
                onClick={() => setShowCancelModal(false)}
                className="px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50"
              >
                Cerrar
              </button>

              <button
                onClick={handleCancel}
                disabled={actionLoading || !cancellationReason.trim()}
                className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 disabled:opacity-50"
              >
                {actionLoading ? 'Cancelando...' : 'Cancelar Prescripción'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
