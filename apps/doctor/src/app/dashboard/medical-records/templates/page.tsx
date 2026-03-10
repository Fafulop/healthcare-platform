'use client';

import { ArrowLeft, Plus, Loader2, AlertCircle } from 'lucide-react';
import Link from 'next/link';
import { MAX_TEMPLATES_PER_DOCTOR } from '@/constants/encounter-fields';
import { useTemplatesPage } from './_components/useTemplatesPage';
import { TemplateCard } from './_components/TemplateCard';

export default function TemplatesPage() {
  const {
    sessionStatus,
    templates,
    loading,
    error,
    deletingId,
    openMenuId, setOpenMenuId,
    fetchTemplates,
    handleDelete,
    handleSetDefault,
  } = useTemplatesPage();

  if (sessionStatus === 'loading' || loading) {
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

      {/* Error */}
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
            <TemplateCard
              key={template.id}
              template={template}
              deletingId={deletingId}
              openMenuId={openMenuId}
              onOpenMenu={setOpenMenuId}
              onSetDefault={handleSetDefault}
              onDelete={handleDelete}
            />
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
