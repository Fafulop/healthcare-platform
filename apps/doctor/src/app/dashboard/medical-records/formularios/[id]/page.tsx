'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { redirect } from 'next/navigation';
import { Loader2, CheckCircle, ArrowLeft, UserSquare2, CalendarDays, ClipboardList } from 'lucide-react';
import Link from 'next/link';
import { authFetch } from '@/lib/auth-fetch';

// ─── Types ────────────────────────────────────────────────────────────────────

interface FieldDefinition {
  id: string;
  name: string;
  label: string;
  type: string;
  required: boolean;
  order: number;
  options?: string[];
  helpText?: string;
}

interface FormLinkDetail {
  id: string;
  templateId: string;
  status: string;
  submissionData: Record<string, any> | null;
  submittedAt: string | null;
  patientName: string;
  patientEmail: string;
  appointment: {
    bookingId: string | null;
    date: string | null;
    time: string | null;
    isFirstTime: boolean | null;
    patientName: string;
    patientEmail: string;
    patientPhone: string | null;
    linkedPatient: { id: string; firstName: string; lastName: string } | null;
  };
  template: {
    name: string;
    description: string | null;
    customFields: FieldDefinition[];
  } | null;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(dateStr: string): string {
  const [year, month, day] = dateStr.split('-').map(Number);
  return new Date(year, month - 1, day).toLocaleDateString('es-MX', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  });
}

function renderFieldValue(field: FieldDefinition, value: any): string {
  if (value === undefined || value === null || value === '') return '—';
  if (field.type === 'checkbox') return value ? 'Sí' : 'No';
  return String(value);
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function FormularioDetailPage() {
  const params = useParams();
  const id = params.id as string;

  const { status: authStatus } = useSession({
    required: true,
    onUnauthenticated() { redirect('/login'); },
  });

  const [formLink, setFormLink] = useState<FormLinkDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (authStatus !== 'authenticated') return;

    async function fetchFormLink() {
      try {
        const res = await authFetch(
          `${process.env.NEXT_PUBLIC_API_URL}/api/appointments/form-links/${id}`
        );
        const data = await res.json();
        if (data.success) {
          setFormLink(data.data);
        } else {
          setError(data.error || 'Formulario no encontrado');
        }
      } catch {
        setError('Error al cargar el formulario');
      } finally {
        setLoading(false);
      }
    }

    fetchFormLink();
  }, [authStatus, id]);

  // ─── Render ────────────────────────────────────────────────────────────────

  if (authStatus === 'loading' || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Loader2 className="h-10 w-10 animate-spin text-blue-600" />
      </div>
    );
  }

  if (error || !formLink) {
    return (
      <div className="p-6">
        <p className="text-red-600">{error || 'Formulario no encontrado'}</p>
        <Link href="/dashboard/medical-records" className="text-sm text-blue-600 mt-2 inline-block">
          ← Volver a expedientes
        </Link>
      </div>
    );
  }

  const backHref = formLink.appointment.linkedPatient
    ? `/dashboard/medical-records/patients/${formLink.appointment.linkedPatient.id}`
    : '/dashboard/medical-records';

  const fields = formLink.template
    ? [...formLink.template.customFields].sort((a, b) => a.order - b.order)
    : [];
  const submissionData = formLink.submissionData ?? {};

  return (
    <div className="p-4 sm:p-6">
      {/* Header */}
      <div className="mb-6 flex items-center gap-3">
        <Link
          href={backHref}
          className="p-1.5 rounded-md hover:bg-gray-100 text-gray-500 transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="text-xl font-bold text-gray-900">
            {formLink.template?.name ?? 'Formulario pre-cita'}
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Enviado por {formLink.patientName}
            {formLink.submittedAt && ` · ${new Date(formLink.submittedAt).toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' })}`}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* Left — Filled form view */}
        <div className="space-y-4">
          <div className="bg-white rounded-lg shadow p-5">
            <h2 className="text-base font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <CheckCircle className="w-4 h-4 text-green-600" />
              Respuestas del paciente
            </h2>

            {fields.length === 0 ? (
              <p className="text-sm text-gray-400">Plantilla no disponible — los datos están guardados.</p>
            ) : (
              <div className="space-y-4">
                {fields.map((field) => (
                  <div key={field.id}>
                    <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-0.5">
                      {field.label}
                    </p>
                    <p className="text-sm text-gray-900">
                      {renderFieldValue(field, submissionData[field.name])}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right — Sidebar */}
        <div className="space-y-4">

          {/* Patient card */}
          {formLink.appointment.linkedPatient && (
            <div className="bg-white rounded-lg shadow p-4">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3 flex items-center gap-1.5">
                <UserSquare2 className="w-3.5 h-3.5" /> Expediente vinculado
              </p>
              <p className="text-sm font-semibold text-gray-900">
                {formLink.appointment.linkedPatient.firstName} {formLink.appointment.linkedPatient.lastName}
              </p>
              <Link
                href={`/dashboard/medical-records/patients/${formLink.appointment.linkedPatient.id}`}
                className="text-xs text-blue-600 hover:underline mt-0.5 inline-block"
              >
                Ver expediente →
              </Link>
            </div>
          )}

          {/* Appointment context */}
          <div className="bg-white rounded-lg shadow p-4 space-y-3">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide flex items-center gap-1.5">
              <CalendarDays className="w-3.5 h-3.5" /> Contexto de la cita
            </p>
            {formLink.appointment.date && (
              <p className="text-sm text-gray-700">
                {formatDate(formLink.appointment.date)}
                {formLink.appointment.time && ` · ${formLink.appointment.time}`}
              </p>
            )}
            <div>
              <p className="text-sm font-medium text-gray-900">{formLink.appointment.patientName}</p>
              <p className="text-xs text-gray-500 mt-0.5">
                {formLink.appointment.patientEmail}
                {formLink.appointment.patientPhone && ` · ${formLink.appointment.patientPhone}`}
              </p>
            </div>
            {formLink.appointment.isFirstTime === true && (
              <span className="inline-block text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded">Primera visita</span>
            )}
            {formLink.appointment.isFirstTime === false && (
              <span className="inline-block text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded">Paciente recurrente</span>
            )}
          </div>

          {/* Submission metadata */}
          <div className="bg-white rounded-lg shadow p-4 space-y-2">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide flex items-center gap-1.5">
              <ClipboardList className="w-3.5 h-3.5" /> Formulario
            </p>
            <div className="flex items-center justify-between">
              <span className="text-xs text-gray-500">Estado</span>
              {formLink.status === 'SUBMITTED' ? (
                <span className="text-xs px-2 py-0.5 rounded bg-green-100 text-green-700 font-medium">Recibido</span>
              ) : (
                <span className="text-xs px-2 py-0.5 rounded bg-amber-100 text-amber-700 font-medium">Pendiente</span>
              )}
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
