'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { redirect } from 'next/navigation';
import type { Medication } from '@/components/medical-records/MedicationList';
import type { ImagingStudy, LabStudy } from '@/components/medical-records/StudyList';
import { fetchDoctorProfile, type PracticeDoctorProfile } from '@/lib/practice-utils';
import { validateMedications } from './prescription-types';

interface PrescriptionForEdit {
  id: string;
  prescriptionDate: string;
  status: string;
  diagnosis?: string;
  clinicalNotes?: string;
  doctorFullName: string;
  doctorLicense: string;
  expiresAt?: string;
  medications: Medication[];
  imagingStudies: ImagingStudy[];
  labStudies: LabStudy[];
}

export function useEditPrescriptionForm() {
  const params = useParams();
  const router = useRouter();
  const patientId = params.id as string;
  const prescriptionId = params.prescriptionId as string;

  const { data: session, status } = useSession({
    required: true,
    onUnauthenticated() {
      redirect('/login');
    },
  });

  const [prescription, setPrescription] = useState<PrescriptionForEdit | null>(null);
  const [doctorProfile, setDoctorProfile] = useState<PracticeDoctorProfile | null>(null);
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
  const [imagingStudies, setImagingStudies] = useState<ImagingStudy[]>([]);
  const [labStudies, setLabStudies] = useState<LabStudy[]>([]);

  useEffect(() => {
    if (session?.user?.doctorId) {
      fetchDoctorProfile(session.user.doctorId).then((profile) => {
        if (profile) setDoctorProfile(profile);
      });
    }
  }, [session]);

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
      setImagingStudies(data.imagingStudies || []);
      setLabStudies(data.labStudies || []);
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
      const validationError = validateMedications(medications);
      if (validationError) throw new Error(validationError);

      const validMedications = medications.filter((med) => med.drugName?.trim());

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

      // Replace medications: delete existing, add new
      for (const medId of prescription?.medications?.map((m) => m.id) || []) {
        if (medId) {
          await fetch(
            `/api/medical-records/patients/${patientId}/prescriptions/${prescriptionId}/medications/${medId}`,
            { method: 'DELETE' }
          );
        }
      }
      for (const medication of validMedications) {
        const medRes = await fetch(
          `/api/medical-records/patients/${patientId}/prescriptions/${prescriptionId}/medications`,
          { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(medication) }
        );
        if (!medRes.ok) throw new Error('Error al agregar medicamento');
      }

      // Replace imaging studies: delete existing, add new
      for (const study of prescription?.imagingStudies?.filter((s) => s.id) || []) {
        await fetch(
          `/api/medical-records/patients/${patientId}/prescriptions/${prescriptionId}/imaging-studies/${study.id}`,
          { method: 'DELETE' }
        );
      }
      for (const study of imagingStudies.filter((s) => s.studyName.trim())) {
        const res = await fetch(
          `/api/medical-records/patients/${patientId}/prescriptions/${prescriptionId}/imaging-studies`,
          { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(study) }
        );
        if (!res.ok) throw new Error('Error al agregar estudio de imagen');
      }

      // Replace lab studies: delete existing, add new
      for (const study of prescription?.labStudies?.filter((s) => s.id) || []) {
        await fetch(
          `/api/medical-records/patients/${patientId}/prescriptions/${prescriptionId}/lab-studies/${study.id}`,
          { method: 'DELETE' }
        );
      }
      for (const study of labStudies.filter((s) => s.studyName.trim())) {
        const res = await fetch(
          `/api/medical-records/patients/${patientId}/prescriptions/${prescriptionId}/lab-studies`,
          { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(study) }
        );
        if (!res.ok) throw new Error('Error al agregar estudio de laboratorio');
      }

      router.push(
        `/dashboard/medical-records/patients/${patientId}/prescriptions/${prescriptionId}`
      );
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return {
    // Route
    patientId,
    prescriptionId,
    sessionStatus: status,
    // Data
    prescription,
    doctorProfile,
    // Loading / error
    loading,
    loadingPrescription,
    error,
    // Form fields
    prescriptionDate, setPrescriptionDate,
    diagnosis, setDiagnosis,
    clinicalNotes, setClinicalNotes,
    doctorFullName, setDoctorFullName,
    doctorLicense, setDoctorLicense,
    expiresAt, setExpiresAt,
    medications, setMedications,
    imagingStudies, setImagingStudies,
    labStudies, setLabStudies,
    // Submit
    handleSubmit,
  };
}
