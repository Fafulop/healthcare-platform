'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, Save } from 'lucide-react';
import Link from 'next/link';
import { MedicationList, type Medication } from '@/components/medical-records/MedicationList';

interface PrescriptionDetails {
  id: string;
  prescriptionDate: string;
  status: string;
  diagnosis?: string;
  clinicalNotes?: string;
  doctorFullName: string;
  doctorLicense: string;
  expiresAt?: string;
  medications: Medication[];
}

export default function EditPrescriptionPage() {
  const params = useParams();
  const router = useRouter();
  const patientId = params.id as string;
  const prescriptionId = params.prescriptionId as string;

  const [prescription, setPrescription] = useState<PrescriptionDetails | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingPrescription, setLoadingPrescription] = useState(true);
  const [error, setError] = useState('');

  // Form state
  const [prescriptionDate, setPrescriptionDate] = useState('');
  const [diagnosis, setDiagnosis] = useState('');
  const [clinicalNotes, setClinicalNotes] = useState('');
  const [doctorFullName, setDoctorFullName] = useState('');
  const [doctorLicense, setDoctorLicense] = useState('');
  const [expiresAt, setExpiresAt] = useState('');
  const [medications, setMedications] = useState<Medication[]>([]);

  useEffect(() => {
    fetchPrescription();
  }, [patientId, prescriptionId]);

  const fetchPrescription = async () => {
    setLoadingPrescription(true);
    setError('');
    try {
      const res = await fetch(
        `/api/medical-records/patients/${patientId}/prescriptions/${prescriptionId}`
      );

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || 'Error al cargar prescripción');
      }

      const { data } = await res.json();

      // Check if prescription is editable
      if (data.status !== 'draft') {
        throw new Error('Solo se pueden editar prescripciones en borrador');
      }

      setPrescription(data);

      // Populate form
      setPrescriptionDate(data.prescriptionDate.split('T')[0]);
      setDiagnosis(data.diagnosis || '');
      setClinicalNotes(data.clinicalNotes || '');
      setDoctorFullName(data.doctorFullName);
      setDoctorLicense(data.doctorLicense);
      setExpiresAt(data.expiresAt ? data.expiresAt.split('T')[0] : '');
      setMedications(data.medications || []);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoadingPrescription(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      // Validate medications
      const validMedications = medications.filter(
        (med) => med.drugName && med.dosage && med.frequency && med.instructions
      );

      if (validMedications.length === 0) {
        throw new Error('Debe agregar al menos un medicamento válido');
      }

      if (!doctorFullName || !doctorLicense) {
        throw new Error('Debe completar la información del doctor');
      }

      // Update prescription metadata
      const prescriptionData = {
        prescriptionDate: new Date(prescriptionDate).toISOString(),
        diagnosis: diagnosis || null,
        clinicalNotes: clinicalNotes || null,
        doctorFullName,
        doctorLicense,
        expiresAt: expiresAt ? new Date(expiresAt).toISOString() : null,
      };

      const resUpdate = await fetch(
        `/api/medical-records/patients/${patientId}/prescriptions/${prescriptionId}`,
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(prescriptionData),
        }
      );

      if (!resUpdate.ok) {
        const errorData = await resUpdate.json();
        throw new Error(errorData.error || 'Error al actualizar prescripción');
      }

      // Delete existing medications and add new ones
      const existingMedicationIds = prescription?.medications?.map((m) => m.id) || [];

      for (const medId of existingMedicationIds) {
        if (medId) {
          await fetch(
            `/api/medical-records/patients/${patientId}/prescriptions/${prescriptionId}/medications/${medId}`,
            {
              method: 'DELETE',
            }
          );
        }
      }

      // Add new medications
      for (const medication of validMedications) {
        const medRes = await fetch(
          `/api/medical-records/patients/${patientId}/prescriptions/${prescriptionId}/medications`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(medication),
          }
        );

        if (!medRes.ok) {
          throw new Error('Error al agregar medicamento');
        }
      }

      // Redirect to prescription detail
      router.push(
        `/dashboard/medical-records/patients/${patientId}/prescriptions/${prescriptionId}`
      );
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (loadingPrescription) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Cargando prescripción...</p>
        </div>
      </div>
    );
  }

  if (error && !prescription) {
    return (
      <div className="p-6 max-w-4xl mx-auto">
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
          {error}
        </div>
        <Link
          href={`/dashboard/medical-records/patients/${patientId}/prescriptions`}
          className="inline-flex items-center text-blue-600 hover:text-blue-700 mt-4"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Volver a Prescripciones
        </Link>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <Link
          href={`/dashboard/medical-records/patients/${patientId}/prescriptions/${prescriptionId}`}
          className="inline-flex items-center text-blue-600 hover:text-blue-700 mb-4"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Volver a Prescripción
        </Link>

        <h1 className="text-2xl font-bold text-gray-900">Editar Prescripción</h1>
        <p className="text-gray-600 mt-1">
          Modificar la información de la prescripción
        </p>
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-6">
          {error}
        </div>
      )}

      {/* Form */}
      <form onSubmit={handleSubmit} className="space-y-6">
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
        </div>

        {/* Doctor Info */}
        <div className="bg-white rounded-lg shadow p-6 space-y-4">
          <h2 className="text-lg font-semibold text-gray-900">Información del Doctor</h2>

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
        </div>

        {/* Medications */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Medicamentos</h2>
          <MedicationList
            medications={medications}
            onChange={setMedications}
          />
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end gap-3">
          <Link
            href={`/dashboard/medical-records/patients/${patientId}/prescriptions/${prescriptionId}`}
            className="px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50"
          >
            Cancelar
          </Link>

          <button
            type="submit"
            disabled={loading}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
          >
            <Save className="w-4 h-4" />
            {loading ? 'Guardando...' : 'Guardar Cambios'}
          </button>
        </div>
      </form>
    </div>
  );
}
