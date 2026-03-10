import { Star, MoreVertical, Edit, Trash2, Loader2 } from 'lucide-react';
import Link from 'next/link';
import type { EncounterTemplate, TemplateIcon } from '@/types/encounter-template';
import { getColorClasses } from '@/constants/encounter-fields';
import { ICON_COMPONENTS } from '@/components/medical-records/TemplateSelector';

interface Props {
  template: EncounterTemplate;
  deletingId: string | null;
  openMenuId: string | null;
  onOpenMenu: (id: string | null) => void;
  onSetDefault: (template: EncounterTemplate) => void;
  onDelete: (template: EncounterTemplate) => void;
}

function renderIcon(template: EncounterTemplate) {
  const iconName = template.icon as TemplateIcon | null;
  const IconComponent = iconName ? ICON_COMPONENTS[iconName] : ICON_COMPONENTS.stethoscope;
  const colorClasses = getColorClasses(template.color);

  return (
    <span className={`inline-flex items-center justify-center w-12 h-12 rounded-xl ${colorClasses.bgClass}`}>
      <IconComponent className={`w-6 h-6 ${colorClasses.textClass}`} />
    </span>
  );
}

export function TemplateCard({
  template,
  deletingId,
  openMenuId,
  onOpenMenu,
  onSetDefault,
  onDelete,
}: Props) {
  return (
    <div className="bg-white rounded-lg shadow p-4 hover:shadow-md transition-shadow">
      <div className="flex items-start gap-4">
        {renderIcon(template)}

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="text-lg font-semibold text-gray-900 truncate">{template.name}</h3>
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
              <span className="px-2 py-0.5 bg-blue-50 text-blue-700 rounded text-xs">SOAP</span>
            )}
          </div>
        </div>

        {/* Actions Menu */}
        <div className="relative">
          <button
            onClick={() => onOpenMenu(openMenuId === template.id ? null : template.id)}
            className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <MoreVertical className="w-5 h-5" />
          </button>

          {openMenuId === template.id && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => onOpenMenu(null)} />
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
                    onClick={() => onSetDefault(template)}
                    className="w-full flex items-center gap-2 px-4 py-2 text-gray-700 hover:bg-gray-50 text-left"
                  >
                    <Star className="w-4 h-4" />
                    Hacer predeterminada
                  </button>
                )}
                {!template.isDefault && (
                  <button
                    onClick={() => onDelete(template)}
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
  );
}
