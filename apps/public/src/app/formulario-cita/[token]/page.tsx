'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';

// ─── Types ────────────────────────────────────────────────────────────────────

type FieldType =
  | 'text' | 'textarea' | 'number' | 'date' | 'time'
  | 'dropdown' | 'radio' | 'checkbox' | 'file';

interface FieldDefinition {
  id: string;
  name: string;
  label: string;
  type: FieldType;
  required: boolean;
  order: number;
  options?: string[];
  min?: number;
  max?: number;
  step?: number;
  placeholder?: string;
  helpText?: string;
  defaultValue?: any;
}

interface FormPayload {
  patientName: string;
  doctorName: string;
  doctorSpecialty: string | null;
  appointmentDate: string | null;
  appointmentTime: string | null;
  template: {
    name: string;
    description: string | null;
    customFields: FieldDefinition[];
  };
}

type PageState = 'loading' | 'invalid' | 'expired' | 'already-submitted' | 'form' | 'success';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(dateStr: string): string {
  const [year, month, day] = dateStr.split('-').map(Number);
  return new Date(year, month - 1, day).toLocaleDateString('es-MX', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function FormularioCitaPage() {
  const params = useParams();
  const token = params.token as string;

  const [pageState, setPageState] = useState<PageState>('loading');
  const [errorMessage, setErrorMessage] = useState('');
  const [formPayload, setFormPayload] = useState<FormPayload | null>(null);
  const [fieldValues, setFieldValues] = useState<Record<string, any>>({});
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [privacyConsent, setPrivacyConsent] = useState(false);
  const [privacyError, setPrivacyError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');

  // ── Load form on mount ────────────────────────────────────────────────────

  useEffect(() => {
    async function loadForm() {
      try {
        const res = await fetch(
          `${process.env.NEXT_PUBLIC_API_URL}/api/appointment-form?token=${token}`
        );
        const json = await res.json();

        if (!json.success) {
          if (json.alreadySubmitted) {
            setPageState('already-submitted');
          } else if (json.expired) {
            setPageState('expired');
          } else {
            setErrorMessage(json.error || 'Este enlace no es válido');
            setPageState('invalid');
          }
          return;
        }

        const payload: FormPayload = json.data;
        setFormPayload(payload);

        // Initialize field values from defaultValue
        const initial: Record<string, any> = {};
        for (const field of payload.template.customFields) {
          initial[field.name] = field.type === 'checkbox'
            ? (field.defaultValue ?? false)
            : (field.defaultValue ?? '');
        }
        setFieldValues(initial);
        setPageState('form');
      } catch {
        setErrorMessage('No se pudo cargar el formulario. Intenta de nuevo.');
        setPageState('invalid');
      }
    }

    loadForm();
  }, [token]);

  // ── Field helpers ─────────────────────────────────────────────────────────

  function updateField(name: string, value: any) {
    setFieldValues((prev) => ({ ...prev, [name]: value }));
    if (fieldErrors[name]) {
      setFieldErrors((prev) => {
        const next = { ...prev };
        delete next[name];
        return next;
      });
    }
  }

  function validateFields(): boolean {
    if (!formPayload) return false;
    const errors: Record<string, string> = {};
    for (const field of formPayload.template.customFields) {
      if (field.required && field.type !== 'checkbox' && field.type !== 'file') {
        const val = fieldValues[field.name];
        if (val === undefined || val === null || String(val).trim() === '') {
          errors[field.name] = 'Este campo es obligatorio';
        }
      }
    }
    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  }

  // ── Submit ────────────────────────────────────────────────────────────────

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validateFields()) return;
    if (!privacyConsent) {
      setPrivacyError('Debes aceptar el Aviso de Privacidad para enviar el formulario');
      return;
    }
    setPrivacyError('');

    setSubmitting(true);
    setSubmitError('');

    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/appointment-form`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token, data: fieldValues }),
        }
      );
      const json = await res.json();

      if (json.success) {
        setPageState('success');
      } else {
        setSubmitError(json.error || 'Error al enviar el formulario');
      }
    } catch {
      setSubmitError('Error de conexión. Por favor intenta de nuevo.');
    } finally {
      setSubmitting(false);
    }
  }

  // ── Field renderer ────────────────────────────────────────────────────────

  function renderField(field: FieldDefinition) {
    if (field.type === 'file') return null;

    const value = fieldValues[field.name];
    const error = fieldErrors[field.name];
    const inputClass = `w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
      error ? 'border-red-400' : 'border-gray-300'
    }`;

    // Checkbox renders differently — inline label, no outer label element
    if (field.type === 'checkbox') {
      return (
        <div key={field.id} className="space-y-1">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={value ?? false}
              onChange={(e) => updateField(field.name, e.target.checked)}
              className="w-4 h-4 text-blue-600 rounded"
            />
            <span className="text-sm font-medium text-gray-700">
              {field.label}
              {field.required && <span className="text-red-500 ml-1">*</span>}
            </span>
          </label>
          {field.helpText && (
            <p className="text-xs text-gray-500 ml-6">{field.helpText}</p>
          )}
          {error && <p className="text-xs text-red-500 ml-6">{error}</p>}
        </div>
      );
    }

    return (
      <div key={field.id} className="space-y-1">
        <label className="block text-sm font-medium text-gray-700">
          {field.label}
          {field.required && <span className="text-red-500 ml-1">*</span>}
        </label>

        {field.type === 'text' && (
          <input
            type="text"
            value={value ?? ''}
            onChange={(e) => updateField(field.name, e.target.value)}
            placeholder={field.placeholder}
            className={inputClass}
          />
        )}

        {field.type === 'textarea' && (
          <textarea
            rows={4}
            value={value ?? ''}
            onChange={(e) => updateField(field.name, e.target.value)}
            placeholder={field.placeholder}
            className={inputClass}
          />
        )}

        {field.type === 'number' && (
          <input
            type="number"
            value={value ?? ''}
            onChange={(e) =>
              updateField(field.name, e.target.value === '' ? '' : Number(e.target.value))
            }
            min={field.min}
            max={field.max}
            step={field.step}
            className={inputClass}
          />
        )}

        {field.type === 'date' && (
          <input
            type="date"
            value={value ?? ''}
            onChange={(e) => updateField(field.name, e.target.value)}
            className={inputClass}
          />
        )}

        {field.type === 'time' && (
          <input
            type="time"
            value={value ?? ''}
            onChange={(e) => updateField(field.name, e.target.value)}
            className={inputClass}
          />
        )}

        {field.type === 'dropdown' && (
          <select
            value={value ?? ''}
            onChange={(e) => updateField(field.name, e.target.value)}
            className={inputClass}
          >
            <option value="">Selecciona una opción</option>
            {(field.options ?? []).map((opt) => (
              <option key={opt} value={opt}>{opt}</option>
            ))}
          </select>
        )}

        {field.type === 'radio' && (
          <div className="space-y-2">
            {(field.options ?? []).map((opt) => (
              <label key={opt} className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name={field.name}
                  value={opt}
                  checked={value === opt}
                  onChange={() => updateField(field.name, opt)}
                  className="text-blue-600"
                />
                <span className="text-sm text-gray-700">{opt}</span>
              </label>
            ))}
          </div>
        )}

        {field.helpText && (
          <p className="text-xs text-gray-500">{field.helpText}</p>
        )}
        {error && <p className="text-xs text-red-500">{error}</p>}
      </div>
    );
  }

  // ── State renders ─────────────────────────────────────────────────────────

  if (pageState === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto" />
          <p className="mt-4 text-gray-600">Cargando formulario...</p>
        </div>
      </div>
    );
  }

  if (pageState === 'already-submitted') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
        <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-8 text-center">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Ya enviaste este formulario</h1>
          <p className="text-gray-600">Tu médico ya tiene tus respuestas. ¡Gracias!</p>
        </div>
      </div>
    );
  }

  if (pageState === 'expired') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
        <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-8 text-center">
          <div className="w-16 h-16 bg-yellow-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Enlace expirado</h1>
          <p className="text-gray-600">Este formulario ya no está disponible porque la cita ya pasó.</p>
        </div>
      </div>
    );
  }

  if (pageState === 'invalid') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
        <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-8 text-center">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Enlace inválido</h1>
          <p className="text-gray-600">{errorMessage}</p>
        </div>
      </div>
    );
  }

  if (pageState === 'success') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
        <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-8 text-center">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">¡Formulario enviado!</h1>
          <p className="text-gray-600">Tu médico revisará tus respuestas. ¡Gracias!</p>
        </div>
      </div>
    );
  }

  // pageState === 'form'
  const fields = [...formPayload!.template.customFields].sort((a, b) => a.order - b.order);

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-2xl mx-auto">
        <div className="bg-white rounded-lg shadow-lg p-8">
          <div className="mb-6">
            <h1 className="text-2xl font-bold text-gray-900 mb-1">
              {formPayload!.template.name}
            </h1>
            {formPayload!.template.description && (
              <p className="text-gray-500 text-sm">{formPayload!.template.description}</p>
            )}
          </div>

          {/* Appointment context card */}
          <div className="bg-blue-50 border border-blue-100 rounded-lg p-4 mb-8 space-y-1">
            <p className="text-sm font-medium text-gray-900">
              Dr. {formPayload!.doctorName}
              {formPayload!.doctorSpecialty && (
                <span className="font-normal text-gray-600"> — {formPayload!.doctorSpecialty}</span>
              )}
            </p>
            {formPayload!.appointmentDate && (
              <p className="text-sm text-gray-600">
                Cita: {formatDate(formPayload!.appointmentDate)}
                {formPayload!.appointmentTime && ` a las ${formPayload!.appointmentTime}`}
              </p>
            )}
            <p className="text-sm text-gray-600">Paciente: {formPayload!.patientName}</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            {fields.map((field) => renderField(field))}

            {/* Aviso de Privacidad — obligatorio por LFPDPPP 2025 (datos sensibles de salud) */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg px-4 py-3">
              <p className="text-xs text-gray-600 mb-2 font-medium">Consentimiento de tratamiento de datos personales</p>
              <label className="flex items-start gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={privacyConsent}
                  onChange={(e) => { setPrivacyConsent(e.target.checked); setPrivacyError(''); }}
                  className="w-4 h-4 mt-0.5 flex-shrink-0 text-blue-600 rounded"
                />
                <span className="text-xs text-gray-600 leading-snug">
                  He leído y acepto el{' '}
                  <a href="/privacidad" target="_blank" rel="noopener noreferrer" className="text-blue-600 underline hover:text-blue-800">
                    Aviso de Privacidad
                  </a>
                  . Consiento expresamente el tratamiento de mis datos personales de salud (incluyendo información médica, síntomas y antecedentes) para ser compartidos con el médico que me atenderá. *
                </span>
              </label>
              {privacyError && (
                <p className="text-xs text-red-600 mt-2">{privacyError}</p>
              )}
            </div>

            {submitError && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
                {submitError}
              </div>
            )}

            <button
              type="submit"
              disabled={submitting || !privacyConsent}
              className="w-full px-6 py-3 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition disabled:bg-gray-400 disabled:cursor-not-allowed"
            >
              {submitting ? 'Enviando...' : 'Enviar formulario'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
