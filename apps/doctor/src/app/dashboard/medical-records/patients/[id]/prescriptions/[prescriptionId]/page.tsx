'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { redirect } from 'next/navigation';
import { ArrowLeft, Edit, FileText, Send, Ban, Trash2, Download, Loader2 } from 'lucide-react';
import Link from 'next/link';
import { MedicationList, type Medication } from '@/components/medical-records/MedicationList';
import Sidebar from '@/components/layout/Sidebar';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

interface DoctorProfile {
  id: string;
  slug: string;
  primarySpecialty: string;
}

interface PrescriptionDetails {
  id: string;
  prescriptionDate: string;
  status: string;
  diagnosis?: string;
  clinicalNotes?: string;
  doctorFullName: string;
  doctorLicense: string;
  expiresAt?: string;
  issuedAt?: string;
  issuedBy?: string;
  cancelledAt?: string;
  cancellationReason?: string;
  patient: {
    id: string;
    firstName: string;
    lastName: string;
    internalId: string;
    dateOfBirth: string;
    sex: string;
  };
  medications: Medication[];
  createdAt: string;
  updatedAt: string;
}

export default function ViewPrescriptionPage() {
  const params = useParams();
  const router = useRouter();
  const patientId = params.id as string;
  const prescriptionId = params.prescriptionId as string;

  const { data: session, status } = useSession({
    required: true,
    onUnauthenticated() {
      redirect("/login");
    },
  });

  const [prescription, setPrescription] = useState<PrescriptionDetails | null>(null);
  const [doctorProfile, setDoctorProfile] = useState<DoctorProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState('');
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [cancellationReason, setCancellationReason] = useState('');

  useEffect(() => {
    if (session?.user?.doctorId) {
      fetchDoctorProfile(session.user.doctorId);
    }
  }, [session]);

  const fetchDoctorProfile = async (doctorId: string) => {
    try {
      const response = await fetch(`${API_URL}/api/doctors`);
      const result = await response.json();

      if (result.success) {
        const doctor = result.data.find((d: any) => d.id === doctorId);
        if (doctor) {
          setDoctorProfile(doctor);
        }
      }
    } catch (err) {
      console.error("Error fetching doctor profile:", err);
    }
  };

  useEffect(() => {
    fetchPrescription();
  }, [patientId, prescriptionId]);

  const fetchPrescription = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(
        `/api/medical-records/patients/${patientId}/prescriptions/${prescriptionId}`
      );

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || 'Error al cargar prescripción');
      }

      const data = await res.json();
      setPrescription(data.data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleIssue = async () => {
    if (!confirm('¿Está seguro de emitir esta prescripción? No podrá editarla después.')) {
      return;
    }

    setActionLoading(true);
    setError('');
    try {
      const res = await fetch(
        `/api/medical-records/patients/${patientId}/prescriptions/${prescriptionId}/issue`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({}),
        }
      );

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || 'Error al emitir prescripción');
      }

      await fetchPrescription();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleCancel = async () => {
    if (!cancellationReason.trim()) {
      setError('Debe proporcionar un motivo de cancelación');
      return;
    }

    setActionLoading(true);
    setError('');
    try {
      const res = await fetch(
        `/api/medical-records/patients/${patientId}/prescriptions/${prescriptionId}/cancel`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ cancellationReason }),
        }
      );

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || 'Error al cancelar prescripción');
      }

      setShowCancelModal(false);
      await fetchPrescription();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleDelete = async () => {
    if (
      !confirm(
        '¿Está seguro de eliminar esta prescripción? Esta acción no se puede deshacer.'
      )
    ) {
      return;
    }

    setActionLoading(true);
    setError('');
    try {
      const res = await fetch(
        `/api/medical-records/patients/${patientId}/prescriptions/${prescriptionId}`,
        {
          method: 'DELETE',
        }
      );

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || 'Error al eliminar prescripción');
      }

      router.push(`/dashboard/medical-records/patients/${patientId}/prescriptions`);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleDownloadPDF = () => {
    window.open(
      `/api/medical-records/patients/${patientId}/prescriptions/${prescriptionId}/pdf`,
      '_blank'
    );
  };

  const formatDate = (dateString: string): string => {
    return new Date(dateString).toLocaleDateString('es-MX', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const getStatusLabel = (status: string): string => {
    const statusMap: Record<string, string> = {
      draft: 'Borrador',
      issued: 'Emitida',
      cancelled: 'Cancelada',
      expired: 'Expirada'
    };
    return statusMap[status] || status;
  };

  const getStatusColor = (status: string): string => {
    const colorMap: Record<string, string> = {
      draft: 'bg-yellow-100 text-yellow-800',
      issued: 'bg-green-100 text-green-800',
      cancelled: 'bg-red-100 text-red-800',
      expired: 'bg-gray-100 text-gray-800'
    };
    return colorMap[status] || 'bg-gray-100 text-gray-800';
  };

  if (status === "loading" || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <Loader2 className="inline-block h-12 w-12 animate-spin text-blue-600" />
          <p className="mt-4 text-gray-600 font-medium">Loading...</p>
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
    <div className="flex h-screen bg-gray-50">
      <Sidebar doctorProfile={doctorProfile} />

      <main className="flex-1 overflow-y-auto">
        <div className="p-6 max-w-4xl mx-auto">
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

              <button
                onClick={handleDelete}
                disabled={actionLoading}
                className="px-4 py-2 border border-red-300 text-red-600 rounded-md hover:bg-red-50 disabled:opacity-50 flex items-center gap-2"
              >
                <Trash2 className="w-4 h-4" />
                Eliminar
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
            <p className="text-gray-900">{formatDate(prescription.prescriptionDate)}</p>
          </div>

          {prescription.expiresAt && (
            <div>
              <p className="text-sm text-gray-600">Fecha de Expiración</p>
              <p className="text-gray-900">{formatDate(prescription.expiresAt)}</p>
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
      </main>
    </div>
  );
}
