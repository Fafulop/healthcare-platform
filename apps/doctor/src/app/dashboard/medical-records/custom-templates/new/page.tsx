'use client';

import { useState } from 'react';
import { useSession } from 'next-auth/react';
import { redirect, useRouter } from 'next/navigation';
import { ArrowLeft, Save, Loader2, AlertCircle, FileCode } from 'lucide-react';
import Link from 'next/link';
import type { CreateCustomTemplateInput, FieldDefinition } from '@/types/custom-encounter';

// Example template to show users
const EXAMPLE_TEMPLATE = {
  name: "Dermatology Consultation",
  description: "For skin lesion evaluations",
  icon: "stethoscope",
  color: "blue",
  customFields: [
    {
      id: "field_1",
      name: "chiefComplaint",
      label: "Chief Complaint",
      labelEs: "Motivo de Consulta",
      type: "textarea",
      required: true,
      order: 1,
      placeholder: "Why is the patient visiting?",
      section: "Basic Info"
    },
    {
      id: "field_2",
      name: "lesionType",
      label: "Lesion Type",
      labelEs: "Tipo de Lesión",
      type: "dropdown",
      required: true,
      order: 2,
      options: ["Macular", "Papular", "Vesicular", "Pustular", "Nodular"],
      section: "Clinical Findings"
    },
    {
      id: "field_3",
      name: "lesionLocation",
      label: "Lesion Location",
      labelEs: "Ubicación de la Lesión",
      type: "text",
      required: true,
      order: 3,
      placeholder: "e.g., left arm",
      section: "Clinical Findings"
    },
    {
      id: "field_4",
      name: "lesionSizeMm",
      label: "Lesion Size (mm)",
      labelEs: "Tamaño de la Lesión (mm)",
      type: "number",
      required: false,
      order: 4,
      min: 0,
      max: 500,
      section: "Clinical Findings"
    },
    {
      id: "field_5",
      name: "physicalExam",
      label: "Physical Examination",
      labelEs: "Exploración Física",
      type: "textarea",
      required: false,
      order: 5,
      placeholder: "Describe examination findings",
      section: "Examination"
    },
    {
      id: "field_6",
      name: "treatmentPlan",
      label: "Treatment Plan",
      labelEs: "Plan de Tratamiento",
      type: "dropdown",
      required: false,
      order: 6,
      options: ["Topical medication", "Oral medication", "Biopsy", "Referral", "Observation"],
      section: "Plan"
    }
  ]
};

export default function NewCustomTemplatePage() {
  const router = useRouter();
  const { data: session, status } = useSession({
    required: true,
    onUnauthenticated() {
      redirect('/login');
    },
  });

  const [jsonInput, setJsonInput] = useState(JSON.stringify(EXAMPLE_TEMPLATE, null, 2));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [parseError, setParseError] = useState('');

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
    let parsed: CreateCustomTemplateInput;
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

    setLoading(true);
    try {
      const res = await fetch('/api/custom-templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(parsed),
      });

      const data = await res.json();

      if (!data.success) {
        throw new Error(data.error || 'Error creating template');
      }

      // Redirect to templates list
      router.push('/dashboard/medical-records/custom-templates');
    } catch (err: any) {
      setError(err.message || 'Error creating template');
      setLoading(false);
    }
  };

  if (status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Loader2 className="h-12 w-12 animate-spin text-blue-600" />
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
            <h1 className="text-2xl font-bold text-gray-900">Create Custom Template</h1>
            <p className="text-gray-600">JSON Editor (Visual Builder Coming Soon)</p>
          </div>
        </div>
      </div>

      {/* Info Banner */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
        <h3 className="font-medium text-blue-900 mb-2">How to create a template:</h3>
        <ol className="list-decimal list-inside space-y-1 text-sm text-blue-800">
          <li>Edit the JSON below to define your custom fields</li>
          <li>Each field needs: id, name (camelCase), label, labelEs, type, required, order</li>
          <li>Available types: text, textarea, number, date, time, dropdown, radio, checkbox, file</li>
          <li>For dropdown/radio, add an "options" array</li>
          <li>Use "section" to group related fields</li>
          <li>Click Save to create the template</li>
        </ol>
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
            The example below shows a dermatology template. Modify it for your needs.
          </p>
        </div>

        <div className="p-4">
          <textarea
            value={jsonInput}
            onChange={(e) => handleJsonChange(e.target.value)}
            className="w-full h-[600px] font-mono text-sm p-4 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Paste your template JSON here..."
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
            disabled={loading || !!parseError}
            className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-blue-400 flex items-center gap-2"
          >
            {loading ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Creating...
              </>
            ) : (
              <>
                <Save className="w-5 h-5" />
                Create Template
              </>
            )}
          </button>
        </div>
      </div>

      {/* Field Type Reference */}
      <div className="mt-6 bg-gray-50 rounded-lg p-6">
        <h3 className="font-semibold text-gray-900 mb-3">Field Type Reference</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          <div>
            <span className="font-medium text-gray-900">text</span>
            <p className="text-gray-600">Single line input</p>
          </div>
          <div>
            <span className="font-medium text-gray-900">textarea</span>
            <p className="text-gray-600">Multi-line input</p>
          </div>
          <div>
            <span className="font-medium text-gray-900">number</span>
            <p className="text-gray-600">Numeric input (min/max/step)</p>
          </div>
          <div>
            <span className="font-medium text-gray-900">date</span>
            <p className="text-gray-600">Date picker</p>
          </div>
          <div>
            <span className="font-medium text-gray-900">time</span>
            <p className="text-gray-600">Time picker</p>
          </div>
          <div>
            <span className="font-medium text-gray-900">dropdown</span>
            <p className="text-gray-600">Select (needs options)</p>
          </div>
          <div>
            <span className="font-medium text-gray-900">radio</span>
            <p className="text-gray-600">Radio buttons (needs options)</p>
          </div>
          <div>
            <span className="font-medium text-gray-900">checkbox</span>
            <p className="text-gray-600">True/false checkbox</p>
          </div>
        </div>
      </div>
    </div>
  );
}
