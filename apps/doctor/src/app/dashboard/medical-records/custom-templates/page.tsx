'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { redirect, useRouter } from 'next/navigation';
import {
  Plus,
  Edit,
  Trash2,
  Star,
  FileText,
  Loader2,
  AlertCircle,
  CheckCircle,
  Settings,
} from 'lucide-react';
import Link from 'next/link';
import type { CustomEncounterTemplate } from '@/types/custom-encounter';

export default function CustomTemplatesPage() {
  const router = useRouter();
  const { data: session, status } = useSession({
    required: true,
    onUnauthenticated() {
      redirect('/login');
    },
  });

  const [templates, setTemplates] = useState<CustomEncounterTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  useEffect(() => {
    fetchTemplates();
  }, []);

  const fetchTemplates = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/custom-templates');
      const data = await res.json();

      if (!data.success) {
        throw new Error(data.error || 'Error loading templates');
      }

      setTemplates(data.data);
    } catch (err: any) {
      setError(err.message || 'Error loading templates');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (templateId: string) => {
    try {
      const res = await fetch(`/api/custom-templates/${templateId}`, {
        method: 'DELETE',
      });

      const data = await res.json();

      if (!data.success) {
        throw new Error(data.error || 'Error deleting template');
      }

      // Refresh list
      fetchTemplates();
      setDeleteConfirm(null);
    } catch (err: any) {
      alert(err.message || 'Error deleting template');
    }
  };

  const handleSetDefault = async (templateId: string) => {
    try {
      const res = await fetch(`/api/custom-templates/${templateId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isDefault: true }),
      });

      const data = await res.json();

      if (!data.success) {
        throw new Error(data.error || 'Error setting default');
      }

      // Refresh list
      fetchTemplates();
    } catch (err: any) {
      alert(err.message || 'Error setting default');
    }
  };

  if (status === 'loading' || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <Loader2 className="inline-block h-12 w-12 animate-spin text-blue-600" />
          <p className="mt-4 text-gray-600 font-medium">Loading templates...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-2">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Custom Encounter Templates</h1>
            <p className="text-gray-600 mt-1">
              Create customized encounter forms with your own fields
            </p>
          </div>
          <Link
            href="/dashboard/medical-records/custom-templates/new"
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Plus className="w-5 h-5" />
            Create Template
          </Link>
        </div>

        {/* Info Banner */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 flex items-start gap-3">
          <Settings className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-blue-800">
            <p className="font-medium mb-1">Custom templates let you:</p>
            <ul className="list-disc list-inside space-y-1 text-blue-700">
              <li>Design forms with exactly the fields you need</li>
              <li>Use voice assistant with your custom fields</li>
              <li>Create specialty-specific workflows (dermatology, cardiology, etc.)</li>
            </ul>
          </div>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2">
          <AlertCircle className="w-5 h-5 text-red-600" />
          <p className="text-red-800">{error}</p>
        </div>
      )}

      {/* Templates List */}
      {templates.length === 0 ? (
        <div className="bg-white rounded-lg shadow p-12 text-center">
          <FileText className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">No custom templates yet</h3>
          <p className="text-gray-600 mb-4">
            Create your first custom encounter template to get started
          </p>
          <Link
            href="/dashboard/medical-records/custom-templates/new"
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            <Plus className="w-5 h-5" />
            Create Your First Template
          </Link>
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Template
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Fields
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Usage
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {templates.map((template) => (
                <tr key={template.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div
                        className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                          template.color ? `bg-${template.color}-100` : 'bg-gray-100'
                        }`}
                      >
                        <FileText
                          className={`w-5 h-5 ${
                            template.color ? `text-${template.color}-600` : 'text-gray-600'
                          }`}
                        />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-gray-900">{template.name}</span>
                          {template.isDefault && (
                            <Star className="w-4 h-4 text-yellow-500 fill-yellow-500" />
                          )}
                        </div>
                        {template.description && (
                          <p className="text-sm text-gray-500 line-clamp-1">
                            {template.description}
                          </p>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-sm text-gray-900">
                      {template.customFields.length} fields
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-sm text-gray-600">
                      {template.usageCount} encounters
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    {template.isActive ? (
                      <span className="inline-flex items-center gap-1 px-2 py-1 bg-green-100 text-green-700 text-xs font-medium rounded">
                        <CheckCircle className="w-3 h-3" />
                        Active
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2 py-1 bg-gray-100 text-gray-600 text-xs font-medium rounded">
                        Inactive
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-2">
                      {!template.isDefault && (
                        <button
                          onClick={() => handleSetDefault(template.id)}
                          className="p-2 text-gray-400 hover:text-yellow-600 rounded-lg hover:bg-gray-100"
                          title="Set as default"
                        >
                          <Star className="w-4 h-4" />
                        </button>
                      )}
                      <Link
                        href={`/dashboard/medical-records/custom-templates/${template.id}/edit`}
                        className="p-2 text-gray-400 hover:text-blue-600 rounded-lg hover:bg-gray-100"
                        title="Edit"
                      >
                        <Edit className="w-4 h-4" />
                      </Link>
                      {deleteConfirm === template.id ? (
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => handleDelete(template.id)}
                            className="px-2 py-1 text-xs bg-red-600 text-white rounded hover:bg-red-700"
                          >
                            Confirm
                          </button>
                          <button
                            onClick={() => setDeleteConfirm(null)}
                            className="px-2 py-1 text-xs border rounded hover:bg-gray-50"
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => setDeleteConfirm(template.id)}
                          className="p-2 text-gray-400 hover:text-red-600 rounded-lg hover:bg-gray-100"
                          title="Delete"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
