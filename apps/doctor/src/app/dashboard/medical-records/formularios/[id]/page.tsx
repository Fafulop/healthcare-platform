'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { redirect } from 'next/navigation';
import { Loader2, Search, CheckCircle, User, ArrowLeft, UserSquare2 } from 'lucide-react';
import Link from 'next/link';
import { authFetch } from '@/lib/auth-fetch';
import { toast } from '@/lib/practice-toast';

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
    bookingId: string;
    date: string | null;
    time: string | null;
    isFirstTime: boolean | null;
    patientName: string;
    patientEmail: string;
    patientPhone: string;
    linkedPatient: { id: string; firstName: string; lastName: string } | null;
  };
  template: {
    name: string;
    description: string | null;
    customFields: FieldDefinition[];
  } | null;
}

interface PatientResult {
  id: string;
  firstName: string;
  lastName: string;
  internalId: string;
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

  // Patient search
  const [patientSearch, setPatientSearch] = useState('');
  const [patientResults, setPatientResults] = useState<PatientResult[]>([]);
  const [searchingPatients, setSearchingPatients] = useState(false);
  const [selectedPatient, setSelectedPatient] = useState<PatientResult | null>(null);

  // Attach state
  const [attaching, setAttaching] = useState(false);
  const [attached, setAttached] = useState(false);

  // ── Load form link ──────────────────────────────────────────────────────────

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

  // ── Patient search ──────────────────────────────────────────────────────────

  const searchPatients = useCallback(async (query: string) => {
    if (!query.trim()) {
      setPatientResults([]);
      return;
    }
    setSearchingPatients(true);
    try {
      const res = await authFetch(
        `/api/medical-records/patients?search=${encodeURIComponent(query)}&status=active`
      );
      const data = await res.json();
      if (data.data) setPatientResults(data.data);
    } catch {
      // silent — user can retry
    } finally {
      setSearchingPatients(false);
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => searchPatients(patientSearch), 350);
    return () => clearTimeout(timer);
  }, [patientSearch, searchPatients]);

  // ── Attach to existing patient ──────────────────────────────────────────────

  const attachToPatient = async (patientId: string) => {
    if (!formLink || attaching) return;
    setAttaching(true);
    try {
      const res = await authFetch(
        `/api/medical-records/patients/${patientId}/encounters`,
        {
          method: 'POST',
          body: JSON.stringify({
            encounterDate: formLink.appointment.date ?? new Date().toISOString().split('T')[0],
            encounterType: 'pre-cita',
            chiefComplaint: 'Formulario pre-cita completado por el paciente',
            templateId: formLink.templateId,
            customData: formLink.submissionData ?? {},
            status: 'completed',
          }),
        }
      );
      const data = await res.json();
      if (data.data?.id) {
        // Auto-link booking → patient if not linked or linked to a different patient
        if ((formLink.appointment.linkedPatient?.id ?? null) !== patientId) {
          authFetch(
            `${process.env.NEXT_PUBLIC_API_URL}/api/appointments/bookings/${formLink.appointment.bookingId}`,
            { method: 'PATCH', body: JSON.stringify({ patientId }) }
          ).catch(() => {});
        }
        toast.success('Formulario adjuntado al expediente correctamente');
        setAttached(true);
      } else {
        toast.error(data.error || 'Error al adjuntar el formulario');
      }
    } catch {
      toast.error('Error al adjuntar el formulario');
    } finally {
      setAttaching(false);
    }
  };

  // ── Create new patient and attach ──────────────────────────────────────────

  const createPatientAndAttach = async () => {
    if (!formLink || attaching) return;
    setAttaching(true);
    try {
      // Split patientName into first + last (best effort)
      const nameParts = formLink.appointment.patientName.trim().split(/\s+/);
      const firstName = nameParts[0] ?? formLink.appointment.patientName;
      const lastName = nameParts.slice(1).join(' ') || '-';

      const createRes = await authFetch('/api/medical-records/patients', {
        method: 'POST',
        body: JSON.stringify({
          firstName,
          lastName,
          dateOfBirth: '1900-01-01', // placeholder — doctor fills later
          sex: 'other',
          email: formLink.appointment.patientEmail,
          phone: formLink.appointment.patientPhone,
        }),
      });
      const createData = await createRes.json();
      const patientId = createData.data?.id;

      if (!patientId) {
        toast.error(createData.error || 'Error al crear el expediente');
        setAttaching(false);
        return;
      }

      await attachToPatient(patientId);
    } catch {
      toast.error('Error al crear el expediente');
      setAttaching(false);
    }
  };

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
        <Link href="/dashboard/medical-records/formularios" className="text-sm text-blue-600 mt-2 inline-block">
          ← Volver a formularios
        </Link>
      </div>
    );
  }

  const fields = formLink.template
    ? [...formLink.template.customFields].sort((a, b) => a.order - b.order)
    : [];
  const submissionData = formLink.submissionData ?? {};

  return (
    <div className="p-4 sm:p-6">
      {/* Header */}
      <div className="mb-6 flex items-center gap-3">
        <Link
          href="/dashboard/medical-records/formularios"
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

        {/* Right — Patient matching + attach */}
        <div className="space-y-4">
          {/* Appointment context */}
          <div className="bg-blue-50 border border-blue-100 rounded-lg p-4 space-y-1">
            <p className="text-xs font-semibold text-blue-700 uppercase tracking-wide mb-2">Contexto de la cita</p>
            {formLink.appointment.date && (
              <p className="text-sm text-gray-700">{formatDate(formLink.appointment.date)}{formLink.appointment.time && ` · ${formLink.appointment.time}`}</p>
            )}
            <p className="text-sm text-gray-700">
              <span className="font-medium">{formLink.appointment.patientName}</span>
              {formLink.appointment.isFirstTime === true && (
                <span className="ml-2 text-xs bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded">Primera visita</span>
              )}
              {formLink.appointment.isFirstTime === false && (
                <span className="ml-2 text-xs bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded">Paciente recurrente</span>
              )}
            </p>
            <p className="text-xs text-gray-500">{formLink.appointment.patientEmail} · {formLink.appointment.patientPhone}</p>
          </div>

          {/* Attach panel */}
          {attached ? (
            <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-center">
              <CheckCircle className="w-8 h-8 text-green-600 mx-auto mb-2" />
              <p className="font-semibold text-green-800">Formulario adjuntado al expediente</p>
              <Link
                href="/dashboard/medical-records"
                className="text-sm text-green-700 underline mt-1 inline-block"
              >
                Ir a expedientes →
              </Link>
            </div>
          ) : (
            <div className="bg-white rounded-lg shadow p-5 space-y-4">
              <h2 className="text-base font-semibold text-gray-900 flex items-center gap-2">
                <User className="w-4 h-4 text-gray-600" />
                Adjuntar al expediente
              </h2>

              {/* Pre-filled: booking already linked to a patient */}
              {formLink.appointment.linkedPatient ? (
                <div className="space-y-3">
                  <div className="flex items-center gap-2 px-3 py-2.5 rounded-lg border border-blue-200 bg-blue-50">
                    <UserSquare2 className="w-4 h-4 text-blue-600 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-blue-900">
                        {formLink.appointment.linkedPatient.firstName} {formLink.appointment.linkedPatient.lastName}
                      </p>
                      <Link
                        href={`/dashboard/medical-records/patients/${formLink.appointment.linkedPatient.id}`}
                        className="text-xs text-blue-600 hover:underline"
                      >
                        Ver expediente →
                      </Link>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => attachToPatient(formLink.appointment.linkedPatient!.id)}
                    disabled={attaching}
                    className="w-full py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-lg transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {attaching ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                    {attaching ? 'Adjuntando...' : `Adjuntar al expediente de ${formLink.appointment.linkedPatient.firstName}`}
                  </button>
                  <p className="text-xs text-gray-400 text-center">O busca otro expediente abajo</p>
                  {/* Search as fallback */}
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                      type="text"
                      value={patientSearch}
                      onChange={(e) => { setPatientSearch(e.target.value); setSelectedPatient(null); }}
                      placeholder="Buscar otro expediente..."
                      className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                    {searchingPatients && (
                      <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 animate-spin text-gray-400" />
                    )}
                  </div>
                  {patientResults.length > 0 && !selectedPatient && (
                    <div className="border border-gray-200 rounded-lg divide-y divide-gray-100 max-h-48 overflow-y-auto">
                      {patientResults.map((p) => (
                        <button
                          key={p.id}
                          type="button"
                          onClick={() => { setSelectedPatient(p); setPatientSearch(`${p.firstName} ${p.lastName}`); setPatientResults([]); }}
                          className="w-full text-left px-3 py-2 hover:bg-gray-50 transition-colors"
                        >
                          <p className="text-sm font-medium text-gray-900">{p.firstName} {p.lastName}</p>
                          <p className="text-xs text-gray-500">#{p.internalId}</p>
                        </button>
                      ))}
                    </div>
                  )}
                  {selectedPatient && (
                    <div className="space-y-2">
                      <div className="bg-purple-50 border border-purple-200 rounded-lg p-3">
                        <p className="text-sm font-medium text-purple-900">{selectedPatient.firstName} {selectedPatient.lastName}</p>
                        <p className="text-xs text-purple-600">#{selectedPatient.internalId}</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => attachToPatient(selectedPatient.id)}
                        disabled={attaching}
                        className="w-full py-2 bg-purple-600 hover:bg-purple-700 text-white text-sm font-semibold rounded-lg transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                      >
                        {attaching ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                        {attaching ? 'Adjuntando...' : `Adjuntar al expediente de ${selectedPatient.firstName}`}
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                <>
                  {/* New patient option */}
                  {formLink.appointment.isFirstTime !== false && (
                    <div className="border border-dashed border-gray-300 rounded-lg p-3">
                      <p className="text-sm text-gray-600 mb-2">
                        Crear nuevo expediente para <span className="font-medium">{formLink.appointment.patientName}</span>
                      </p>
                      <button
                        type="button"
                        onClick={createPatientAndAttach}
                        disabled={attaching}
                        className="w-full py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-lg transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                      >
                        {attaching ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                        {attaching ? 'Creando...' : 'Crear expediente y adjuntar'}
                      </button>
                    </div>
                  )}

                  {/* Search existing patients */}
                  <div>
                    <p className="text-sm font-medium text-gray-700 mb-2">
                      {formLink.appointment.isFirstTime === false
                        ? 'Buscar expediente del paciente'
                        : 'O buscar expediente existente'}
                    </p>
                    <div className="relative mb-2">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                      <input
                        type="text"
                        value={patientSearch}
                        onChange={(e) => { setPatientSearch(e.target.value); setSelectedPatient(null); }}
                        placeholder="Nombre del paciente..."
                        className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                      {searchingPatients && (
                        <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 animate-spin text-gray-400" />
                      )}
                    </div>

                    {patientResults.length > 0 && !selectedPatient && (
                      <div className="border border-gray-200 rounded-lg divide-y divide-gray-100 max-h-48 overflow-y-auto">
                        {patientResults.map((p) => (
                          <button
                            key={p.id}
                            type="button"
                            onClick={() => { setSelectedPatient(p); setPatientSearch(`${p.firstName} ${p.lastName}`); setPatientResults([]); }}
                            className="w-full text-left px-3 py-2 hover:bg-gray-50 transition-colors"
                          >
                            <p className="text-sm font-medium text-gray-900">{p.firstName} {p.lastName}</p>
                            <p className="text-xs text-gray-500">#{p.internalId}</p>
                          </button>
                        ))}
                      </div>
                    )}

                    {selectedPatient && (
                      <div className="mt-2 space-y-2">
                        <div className="bg-purple-50 border border-purple-200 rounded-lg p-3">
                          <p className="text-sm font-medium text-purple-900">
                            {selectedPatient.firstName} {selectedPatient.lastName}
                          </p>
                          <p className="text-xs text-purple-600">#{selectedPatient.internalId}</p>
                        </div>
                        <button
                          type="button"
                          onClick={() => attachToPatient(selectedPatient.id)}
                          disabled={attaching}
                          className="w-full py-2 bg-purple-600 hover:bg-purple-700 text-white text-sm font-semibold rounded-lg transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                        >
                          {attaching ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                          {attaching ? 'Adjuntando...' : `Adjuntar al expediente de ${selectedPatient.firstName}`}
                        </button>
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
