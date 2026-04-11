'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { redirect } from 'next/navigation';
import { ArrowLeft, Plus, Clock, Loader2, Download, NotebookPen } from 'lucide-react';
import Link from 'next/link';
import { TimelineView } from '@/components/medical-records/TimelineView';
import { calculateAge } from '@/lib/practice-utils';
import { generateTimelinePDF } from '@/lib/pdf/encounter-pdf';

interface Patient {
  id: string;
  firstName: string;
  lastName: string;
  dateOfBirth: string;
}

interface TimelineData {
  timeline: any[];
  patient: Patient;
}

export default function PatientTimelinePage() {
  const params = useParams();
  const patientId = params.id as string;

  const { status } = useSession({
    required: true,
    onUnauthenticated() {
      redirect("/login");
    },
  });

  const [timelineData, setTimelineData] = useState<TimelineData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [exportingPDF, setExportingPDF] = useState(false);

  useEffect(() => {
    fetchTimeline();
  }, [patientId]);

  const handleExportPDF = async () => {
    if (!timelineData) return;
    setExportingPDF(true);
    try {
      const encounters = timelineData.timeline
        .filter((item: any) => item.type === 'encounter')
        .map((item: any) => item.data);
      await generateTimelinePDF(encounters, timelineData.patient);
    } catch (err) {
      console.error('Error generating PDF:', err);
    } finally {
      setExportingPDF(false);
    }
  };

  const fetchTimeline = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`/api/medical-records/patients/${patientId}/timeline`);

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || 'Error al cargar línea de tiempo');
      }

      const data = await res.json();
      setTimelineData(data.data);
    } catch (err: any) {
      setError(err.message || 'Error loading timeline');
    } finally {
      setLoading(false);
    }
  };

  if (status === "loading" || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <Loader2 className="inline-block h-12 w-12 animate-spin text-blue-600" />
          <p className="mt-4 text-gray-600 font-medium">Cargando...</p>
        </div>
      </div>
    );
  }

  if (error || !timelineData) {
    return (
      <div className="p-6">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-red-800">{error || 'No se pudo cargar la línea de tiempo'}</p>
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

  const { timeline, patient } = timelineData;

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <Link
          href={`/dashboard/medical-records/patients/${patientId}`}
          className="inline-flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-4"
        >
          <ArrowLeft className="w-5 h-5" />
          Volver al Paciente
        </Link>

        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          <div className="flex items-center gap-3">
            <Clock className="w-7 h-7 text-blue-600 flex-shrink-0" />
            <div>
              <h1 className="text-xl sm:text-2xl font-bold text-gray-900">
                Línea de Tiempo Clínica
              </h1>
              <p className="text-gray-600 mt-0.5 text-sm sm:text-base">
                {patient.firstName} {patient.lastName} • {calculateAge(patient.dateOfBirth)} años
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-shrink-0">
            <button
              onClick={handleExportPDF}
              disabled={exportingPDF || !timelineData}
              className="px-3 py-2 border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 flex items-center gap-2 text-sm transition-colors"
            >
              {exportingPDF ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
              <span className="hidden sm:inline">{exportingPDF ? 'Generando...' : 'Exportar PDF'}</span>
            </button>
            <Link
              href={`/dashboard/medical-records/patients/${patientId}/encounters/new`}
              className="px-3 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 flex items-center gap-2 text-sm font-semibold transition-colors"
            >
              <Plus className="w-4 h-4" />
              Nueva Consulta
            </Link>
          </div>
        </div>
      </div>

      {/* Stats summary */}
      {timeline.length > 0 && (
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
            <div className="text-center">
              <div className="text-3xl font-bold text-blue-600">
                {timeline.filter((item: any) => item.type === 'encounter').length}
              </div>
              <div className="text-sm text-gray-600 mt-1">Consultas</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-emerald-600">
                {timeline.filter((item: any) => item.type === 'prescription').length}
              </div>
              <div className="text-sm text-gray-600 mt-1">Prescripciones</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-purple-600">
                {timeline.filter((item: any) => item.type === 'media').length}
              </div>
              <div className="text-sm text-gray-600 mt-1">Documentos</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-amber-600">
                {timeline.filter((item: any) => item.type === 'note').length}
              </div>
              <div className="text-sm text-gray-600 mt-1">Notas</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-violet-600">
                {timeline.filter((item: any) => item.type === 'formulario').length}
              </div>
              <div className="text-sm text-gray-600 mt-1">Formularios</div>
            </div>
          </div>
        </div>
      )}

      {/* Timeline */}
      <TimelineView timeline={timeline} patientId={patientId} />
    </div>
  );
}
