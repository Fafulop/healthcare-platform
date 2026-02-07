'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { redirect, useRouter, useParams } from 'next/navigation';
import { Loader2, AlertCircle, ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { FormBuilder } from '@/components/form-builder/FormBuilder';
import type { CustomEncounterTemplate, FieldDefinition } from '@/types/custom-encounter';

export default function EditCustomTemplatePage() {
  const router = useRouter();
  const params = useParams();
  const templateId = params.id as string;

  const { data: session, status } = useSession({
    required: true,
    onUnauthenticated() {
      redirect('/login');
    },
  });

  const [template, setTemplate] = useState<CustomEncounterTemplate | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchTemplate();
  }, [templateId]);

  const fetchTemplate = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`/api/custom-templates/${templateId}`);
      const data = await res.json();

      if (!data.success) {
        throw new Error(data.error || 'Error loading template');
      }

      setTemplate(data.data);
    } catch (err: any) {
      setError(err.message || 'Error loading template');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (data: {
    name: string;
    description?: string;
    icon?: string;
    color?: string;
    customFields: FieldDefinition[];
  }) => {
    const res = await fetch(`/api/custom-templates/${templateId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });

    const result = await res.json();

    if (!result.success) {
      throw new Error(result.error || 'Error updating template');
    }

    router.push('/dashboard/medical-records/custom-templates');
  };

  if (status === 'loading' || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Loader2 className="h-12 w-12 animate-spin text-blue-600" />
      </div>
    );
  }

  if (error && !template) {
    return (
      <div className="p-4 sm:p-6 max-w-7xl mx-auto">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-center gap-2">
          <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0" />
          <p className="text-red-800">{error}</p>
        </div>
        <Link
          href="/dashboard/medical-records/custom-templates"
          className="inline-flex items-center gap-2 text-gray-600 hover:text-gray-900 mt-4"
        >
          <ArrowLeft className="w-5 h-5" />
          Back to Templates
        </Link>
      </div>
    );
  }

  return <FormBuilder initialTemplate={template} onSave={handleSave} />;
}
