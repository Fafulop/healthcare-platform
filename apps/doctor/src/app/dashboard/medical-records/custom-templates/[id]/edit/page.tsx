'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { redirect, useRouter, useParams } from 'next/navigation';
import { ArrowLeft, Save, Loader2, AlertCircle, FileCode } from 'lucide-react';
import Link from 'next/link';
import type { CustomEncounterTemplate } from '@/types/custom-encounter';

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
  const [jsonInput, setJsonInput] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [parseError, setParseError] = useState('');

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
      // Format the template for editing (only editable fields)
      const editableData = {
        name: data.data.name,
        description: data.data.description,
        icon: data.data.icon,
        color: data.data.color,
        customFields: data.data.customFields,
      };
      setJsonInput(JSON.stringify(editableData, null, 2));
    } catch (err: any) {
      setError(err.message || 'Error loading template');
    } finally {
      setLoading(false);
    }
  };

  const handleJsonChange = (value: string) => {
    setJsonInput(value);
    setParseError('');

    // Try to parse and validate
    try {
      JSON.parse(value);
    } catch (err: any) {
      setParseError(err.message);
    }
  };

  const handleSave = async () => {
    setError('');
    setParseError('');

    // Parse JSON
    let parsed: any;
    try {
      parsed = JSON.parse(jsonInput);
    } catch (err: any) {
      setParseError('Invalid JSON: ' + err.message);
      return;
    }

    // Basic validation
    if (!parsed.name) {
      setError('Template name is required');
      return;
    }

    if (!parsed.customFields || parsed.customFields.length === 0) {
      setError('At least one field is required');
      return;
    }

    setSaving(true);
    try {
      const res = await fetch(`/api/custom-templates/${templateId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(parsed),
      });

      const data = await res.json();

      if (!data.success) {
        throw new Error(data.error || 'Error updating template');
      }

      // Redirect to templates list
      router.push('/dashboard/medical-records/custom-templates');
    } catch (err: any) {
      setError(err.message || 'Error updating template');
      setSaving(false);
    }
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

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <Link
          href="/dashboard/medical-records/custom-templates"
          className="inline-flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-4"
        >
          <ArrowLeft className="w-5 h-5" />
          Back to Templates
        </Link>
        <div className="flex items-center gap-3 mb-2">
          <FileCode className="w-8 h-8 text-blue-600" />
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Edit Template</h1>
            <p className="text-gray-600">{template?.name}</p>
          </div>
        </div>
      </div>

      {/* Info Banner */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
        <h3 className="font-medium text-blue-900 mb-2">Editing template:</h3>
        <ul className="list-disc list-inside space-y-1 text-sm text-blue-800">
          <li>Modify the JSON below to update your template</li>
          <li>You can change: name, description, icon, color, and customFields</li>
          <li>Be careful when editing fields - encounters already created will keep old structure</li>
        </ul>
      </div>

      {/* Error Messages */}
      {error && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2">
          <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0" />
          <p className="text-red-800">{error}</p>
        </div>
      )}

      {parseError && (
        <div className="mb-4 p-4 bg-yellow-50 border border-yellow-200 rounded-lg flex items-center gap-2">
          <AlertCircle className="w-5 h-5 text-yellow-600 flex-shrink-0" />
          <p className="text-yellow-800">JSON Syntax Error: {parseError}</p>
        </div>
      )}

      {/* JSON Editor */}
      <div className="bg-white rounded-lg shadow">
        <div className="p-4 border-b border-gray-200">
          <h2 className="font-semibold text-gray-900">Template JSON</h2>
          <p className="text-sm text-gray-600 mt-1">
            Edit the template structure below
          </p>
        </div>

        <div className="p-4">
          <textarea
            value={jsonInput}
            onChange={(e) => handleJsonChange(e.target.value)}
            className="w-full h-[600px] font-mono text-sm p-4 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Template JSON..."
            spellCheck={false}
          />
        </div>

        {/* Actions */}
        <div className="p-4 border-t border-gray-200 flex justify-end gap-3">
          <Link
            href="/dashboard/medical-records/custom-templates"
            className="px-6 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
          >
            Cancel
          </Link>
          <button
            onClick={handleSave}
            disabled={saving || !!parseError}
            className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-blue-400 flex items-center gap-2"
          >
            {saving ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save className="w-5 h-5" />
                Save Changes
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
