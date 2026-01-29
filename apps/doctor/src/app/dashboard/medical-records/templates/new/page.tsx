'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { redirect } from 'next/navigation';
import { ArrowLeft, Loader2 } from 'lucide-react';
import Link from 'next/link';
import { TemplateEditor } from '@/components/medical-records/TemplateEditor';
import type { CreateTemplateInput } from '@/types/encounter-template';

export default function NewTemplatePage() {
  const router = useRouter();
  const { data: session, status } = useSession({
    required: true,
    onUnauthenticated() {
      redirect('/login');
    },
  });

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSave = async (data: CreateTemplateInput) => {
    try {
      setSaving(true);
      setError(null);

      const res = await fetch('/api/medical-records/templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      const result = await res.json();

      if (result.success) {
        router.push('/dashboard/medical-records/templates');
      } else {
        setError(result.error || 'Error al crear plantilla');
      }
    } catch (err) {
      setError('Error al crear plantilla');
      console.error('Error creating template:', err);
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    router.push('/dashboard/medical-records/templates');
  };

  if (status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <Loader2 className="inline-block h-12 w-12 animate-spin text-blue-600" />
          <p className="mt-4 text-gray-600 font-medium">Cargando...</p>
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
        <h1 className="text-2xl font-bold text-gray-900">Nueva Plantilla</h1>
        <p className="text-gray-600 mt-1">
          Configure los campos y valores predeterminados para su nueva plantilla
        </p>
      </div>

      {/* Error Message */}
      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-red-800">{error}</p>
        </div>
      )}

      <TemplateEditor
        onSave={handleSave}
        onCancel={handleCancel}
        isLoading={saving}
      />
    </div>
  );
}
