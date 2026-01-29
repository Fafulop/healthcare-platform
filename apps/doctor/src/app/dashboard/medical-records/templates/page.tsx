'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { redirect } from 'next/navigation';
import {
  ArrowLeft,
  Plus,
  Star,
  MoreVertical,
  Edit,
  Trash2,
  Loader2,
  AlertCircle,
} from 'lucide-react';
import Link from 'next/link';
import type { EncounterTemplate, TemplateIcon } from '@/types/encounter-template';
import { getColorClasses, MAX_TEMPLATES_PER_DOCTOR } from '@/constants/encounter-fields';
import { ICON_COMPONENTS } from '@/components/medical-records/TemplateSelector';

export default function TemplatesPage() {
  const router = useRouter();
  const { data: session, status } = useSession({
    required: true,
    onUnauthenticated() {
      redirect('/login');
    },
  });

  const [templates, setTemplates] = useState<EncounterTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);

  useEffect(() => {
    fetchTemplates();
  }, []);

  const fetchTemplates = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch('/api/medical-records/templates');
      const data = await res.json();

      if (data.success) {
        setTemplates(data.data);
      } else {
        setError(data.error || 'Error al cargar plantillas');
      }
    } catch (err) {
      setError('Error al cargar plantillas');
      console.error('Error fetching templates:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (template: EncounterTemplate) => {
    if (template.isDefault) {
      alert('No se puede eliminar la plantilla predeterminada');
      return;
    }

    if (!confirm(`¿Eliminar la plantilla "${template.name}"?`)) {
      return;
    }

    try {
      setDeletingId(template.id);
      const res = await fetch(`/api/medical-records/templates/${template.id}`, {
        method: 'DELETE',
      });
      const data = await res.json();

      if (data.success) {
        setTemplates((prev) => prev.filter((t) => t.id !== template.id));
      } else {
        alert(data.error || 'Error al eliminar plantilla');
      }
    } catch (err) {
      alert('Error al eliminar plantilla');
      console.error('Error deleting template:', err);
    } finally {
      setDeletingId(null);
      setOpenMenuId(null);
    }
  };

  const handleSetDefault = async (template: EncounterTemplate) => {
    if (template.isDefault) return;

    try {
      const res = await fetch(`/api/medical-records/templates/${template.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isDefault: true }),
      });
      const data = await res.json();

      if (data.success) {
        // Update local state
        setTemplates((prev) =>
          prev.map((t) => ({
            ...t,
            isDefault: t.id === template.id,
          }))
        );
      } else {
        alert(data.error || 'Error al actualizar plantilla');
      }
    } catch (err) {
      alert('Error al actualizar plantilla');
      console.error('Error updating template:', err);
    } finally {
      setOpenMenuId(null);
    }
  };

  const renderIcon = (template: EncounterTemplate) => {
    const iconName = template.icon as TemplateIcon | null;
    const IconComponent = iconName ? ICON_COMPONENTS[iconName] : ICON_COMPONENTS.stethoscope;
    const colorClasses = getColorClasses(template.color);

    return (
      <span
        className={`inline-flex items-center justify-center w-12 h-12 rounded-xl ${colorClasses.bgClass}`}
      >
        <IconComponent className={`w-6 h-6 ${colorClasses.textClass}`} />
      </span>
    );
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

  const canCreateMore = templates.length < MAX_TEMPLATES_PER_DOCTOR;

  return (
    <div className="p-4 sm:p-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <Link
          href="/dashboard/medical-records"
          className="inline-flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-4"
        >
          <ArrowLeft className="w-5 h-5" />
          Volver
        </Link>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Plantillas de Consulta</h1>
            <p className="text-gray-600 mt-1">
              Administre sus plantillas personalizadas ({templates.length}/{MAX_TEMPLATES_PER_DOCTOR})
            </p>
          </div>
          {canCreateMore ? (
            <Link
              href="/dashboard/medical-records/templates/new"
              className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors"
            >
              <Plus className="w-5 h-5" />
              Nueva Plantilla
            </Link>
          ) : (
            <span className="text-sm text-gray-500 bg-gray-100 px-3 py-2 rounded-lg">
              Límite alcanzado
            </span>
          )}
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg flex items-center gap-3">
          <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0" />
          <p className="text-red-800">{error}</p>
          <button
            onClick={fetchTemplates}
            className="ml-auto text-red-600 hover:text-red-800 underline text-sm"
          >
            Reintentar
          </button>
        </div>
      )}

      {/* Templates List */}
      {templates.length === 0 ? (
        <div className="bg-white rounded-lg shadow p-8 text-center">
          <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <AlertCircle className="w-8 h-8 text-gray-400" />
          </div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">No hay plantillas</h3>
          <p className="text-gray-600 mb-4">
            Cree su primera plantilla para agilizar el registro de consultas
          </p>
          <Link
            href="/dashboard/medical-records/templates/new"
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Plus className="w-5 h-5" />
            Crear Plantilla
          </Link>
        </div>
      ) : (
        <div className="space-y-4">
          {templates.map((template) => (
            <div
              key={template.id}
              className="bg-white rounded-lg shadow p-4 hover:shadow-md transition-shadow"
            >
              <div className="flex items-start gap-4">
                {renderIcon(template)}

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="text-lg font-semibold text-gray-900 truncate">
                      {template.name}
                    </h3>
                    {template.isDefault && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-yellow-100 text-yellow-800 text-xs font-medium rounded-full">
                        <Star className="w-3 h-3 fill-yellow-500" />
                        Predeterminada
                      </span>
                    )}
                  </div>
                  {template.description && (
                    <p className="text-sm text-gray-600 mt-1 line-clamp-2">{template.description}</p>
                  )}
                  <div className="flex items-center gap-4 mt-2 text-sm text-gray-500">
                    <span>Usado {template.usageCount} {template.usageCount === 1 ? 'vez' : 'veces'}</span>
                    {template.useSOAPMode && (
                      <span className="px-2 py-0.5 bg-blue-50 text-blue-700 rounded text-xs">
                        SOAP
                      </span>
                    )}
                  </div>
                </div>

                {/* Actions Menu */}
                <div className="relative">
                  <button
                    onClick={() => setOpenMenuId(openMenuId === template.id ? null : template.id)}
                    className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                  >
                    <MoreVertical className="w-5 h-5" />
                  </button>

                  {openMenuId === template.id && (
                    <>
                      {/* Backdrop to close menu */}
                      <div
                        className="fixed inset-0 z-10"
                        onClick={() => setOpenMenuId(null)}
                      />
                      <div className="absolute right-0 top-10 z-20 w-48 bg-white rounded-lg shadow-lg border border-gray-200 py-1">
                        <Link
                          href={`/dashboard/medical-records/templates/${template.id}/edit`}
                          className="flex items-center gap-2 px-4 py-2 text-gray-700 hover:bg-gray-50"
                        >
                          <Edit className="w-4 h-4" />
                          Editar
                        </Link>
                        {!template.isDefault && (
                          <button
                            onClick={() => handleSetDefault(template)}
                            className="w-full flex items-center gap-2 px-4 py-2 text-gray-700 hover:bg-gray-50 text-left"
                          >
                            <Star className="w-4 h-4" />
                            Hacer predeterminada
                          </button>
                        )}
                        {!template.isDefault && (
                          <button
                            onClick={() => handleDelete(template)}
                            disabled={deletingId === template.id}
                            className="w-full flex items-center gap-2 px-4 py-2 text-red-600 hover:bg-red-50 text-left disabled:opacity-50"
                          >
                            {deletingId === template.id ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <Trash2 className="w-4 h-4" />
                            )}
                            Eliminar
                          </button>
                        )}
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Info about limits */}
      <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
        <p className="text-sm text-blue-800">
          <strong>Nota:</strong> Puede crear hasta {MAX_TEMPLATES_PER_DOCTOR} plantillas.
          Las plantillas controlan qué campos se muestran y los valores predeterminados al crear consultas.
        </p>
      </div>
    </div>
  );
}
