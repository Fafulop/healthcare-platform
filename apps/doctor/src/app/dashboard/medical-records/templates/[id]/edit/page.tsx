'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { redirect } from 'next/navigation';
import { ArrowLeft, Loader2, AlertCircle } from 'lucide-react';
import Link from 'next/link';
import { TemplateEditor } from '@/components/medical-records/TemplateEditor';
import type { EncounterTemplate, UpdateTemplateInput } from '@/types/encounter-template';

export default function EditTemplatePage() {
  const params = useParams();
  const router = useRouter();
  const templateId = params.id as string;

  const { data: session, status } = useSession({
    required: true,
    onUnauthenticated() {
      redirect('/login');
    },
  });

  const [template, setTemplate] = useState<EncounterTemplate | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (templateId) {
      fetchTemplate();
    }
  }, [templateId]);

  const fetchTemplate = async () => {
    try {
      setLoading(true);
      setError(null);

      const res = await fetch(`/api/medical-records/templates/${templateId}`);
      const data = await res.json();

      if (data.success) {
        setTemplate(data.data);
      } else {
        setError(data.error || 'Plantilla no encontrada');
      }
    } catch (err) {
      setError('Error al cargar plantilla');
      console.error('Error fetching template:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (data: UpdateTemplateInput) => {
    try {
      setSaving(true);
      setError(null);

      const res = await fetch(`/api/medical-records/templates/${templateId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      const result = await res.json();

      if (result.success) {
        router.push('/dashboard/medical-records/templates');
      } else {
        setError(result.error || 'Error al actualizar plantilla');
      }
    } catch (err) {
      setError('Error al actualizar plantilla');
      console.error('Error updating template:', err);
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    router.push('/dashboard/medical-records/templates');
  };

  if (status === 'loading' || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <Loader2 className="inline-block h-12 w-12 animate-spin text-blue-600" />
          <p className="mt-4 text-gray-600 font-medium">Cargando...</p>
        </div>
      </div>
    );
  }

  if (error && !template) {
    return (
      <div className="p-4 sm:p-6 max-w-4xl mx-auto">
        <div className="mb-6">
          <Link
            href="/dashboard/medical-records/templates"
            className="inline-flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-4"
          >
            <ArrowLeft className="w-5 h-5" />
            Volver a Plantillas
          </Link>
        </div>

        <div className="bg-white rounded-lg shadow p-8 text-center">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <AlertCircle className="w-8 h-8 text-red-600" />
          </div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">Error</h3>
          <p className="text-gray-600 mb-4">{error}</p>
          <Link
            href="/dashboard/medical-records/templates"
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
            Volver
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <Link
          href="/dashboard/medical-records/templates"
          className="inline-flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-4"
        >
          <ArrowLeft className="w-5 h-5" />
          Volver a Plantillas
        </Link>
        <h1 className="text-2xl font-bold text-gray-900">Editar Plantilla</h1>
        <p className="text-gray-600 mt-1">
          Modifique la configuración de su plantilla
        </p>
      </div>

      {/* Error Message */}
      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-red-800">{error}</p>
        </div>
      )}

      {template && (
        <TemplateEditor
          template={template}
          onSave={handleSave}
          onCancel={handleCancel}
          isLoading={saving}
        />
      )}
    </div>
  );
}
