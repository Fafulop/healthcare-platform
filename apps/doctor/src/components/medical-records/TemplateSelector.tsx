'use client';

import { useState, useEffect, Fragment } from 'react';
import { Listbox, Transition } from '@headlessui/react';
import {
  Check,
  ChevronDown,
  Settings,
  Star,
  Stethoscope,
  HeartPulse,
  Activity,
  Thermometer,
  Baby,
  Brain,
  Bone,
  Eye,
  Ear,
  Pill,
  Syringe,
  Scissors,
  Clock,
  Calendar,
  ClipboardList,
  UserCheck,
  Loader2,
} from 'lucide-react';
import Link from 'next/link';
import type { EncounterTemplate, TemplateIcon } from '@/types/encounter-template';
import { getColorClasses } from '@/constants/encounter-fields';

// Icon mapping
const ICON_COMPONENTS: Record<TemplateIcon, React.ComponentType<{ className?: string }>> = {
  stethoscope: Stethoscope,
  'heart-pulse': HeartPulse,
  activity: Activity,
  thermometer: Thermometer,
  baby: Baby,
  brain: Brain,
  bone: Bone,
  eye: Eye,
  ear: Ear,
  pill: Pill,
  syringe: Syringe,
  scissors: Scissors,
  clock: Clock,
  calendar: Calendar,
  'clipboard-list': ClipboardList,
  'user-check': UserCheck,
};

interface TemplateSelectorProps {
  selectedTemplateId: string | null;
  onSelect: (template: EncounterTemplate | null) => void;
  disabled?: boolean;
}

export function TemplateSelector({
  selectedTemplateId,
  onSelect,
  disabled = false,
}: TemplateSelectorProps) {
  const [templates, setTemplates] = useState<EncounterTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchTemplates();
  }, []);

  const fetchTemplates = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/medical-records/templates');
      const data = await res.json();

      if (data.success) {
        setTemplates(data.data);
        // Auto-select default template if none selected
        if (!selectedTemplateId && data.data.length > 0) {
          const defaultTemplate = data.data.find((t: EncounterTemplate) => t.isDefault);
          if (defaultTemplate) {
            onSelect(defaultTemplate);
          }
        }
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

  const selectedTemplate = templates.find((t) => t.id === selectedTemplateId) || null;

  const renderIcon = (template: EncounterTemplate) => {
    const iconName = template.icon as TemplateIcon | null;
    const IconComponent = iconName ? ICON_COMPONENTS[iconName] : Stethoscope;
    const colorClasses = getColorClasses(template.color);

    return (
      <span className={`inline-flex items-center justify-center w-8 h-8 rounded-lg ${colorClasses.bgClass}`}>
        <IconComponent className={`w-4 h-4 ${colorClasses.textClass}`} />
      </span>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-gray-500">
        <Loader2 className="w-4 h-4 animate-spin" />
        <span className="text-sm">Cargando plantillas...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-sm text-red-600">
        {error}
        <button
          type="button"
          onClick={fetchTemplates}
          className="ml-2 text-blue-600 hover:text-blue-800 underline"
        >
          Reintentar
        </button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-3">
      <Listbox
        value={selectedTemplate}
        onChange={onSelect}
        disabled={disabled}
      >
        <div className="relative flex-1 min-w-[250px]">
          <Listbox.Button className="relative w-full cursor-pointer rounded-lg bg-white py-2.5 pl-3 pr-10 text-left border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed">
            {selectedTemplate ? (
              <span className="flex items-center gap-3">
                {renderIcon(selectedTemplate)}
                <span className="block truncate font-medium">{selectedTemplate.name}</span>
                {selectedTemplate.isDefault && (
                  <Star className="w-4 h-4 text-yellow-500 fill-yellow-500" />
                )}
              </span>
            ) : (
              <span className="block truncate text-gray-500">Seleccionar plantilla</span>
            )}
            <span className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-2">
              <ChevronDown className="h-5 w-5 text-gray-400" aria-hidden="true" />
            </span>
          </Listbox.Button>
          <Transition
            as={Fragment}
            leave="transition ease-in duration-100"
            leaveFrom="opacity-100"
            leaveTo="opacity-0"
          >
            <Listbox.Options className="absolute z-20 mt-1 max-h-60 w-full overflow-auto rounded-md bg-white py-1 text-base shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none">
              {templates.map((template) => (
                <Listbox.Option
                  key={template.id}
                  className={({ active }) =>
                    `relative cursor-pointer select-none py-2 pl-3 pr-10 ${
                      active ? 'bg-blue-50 text-blue-900' : 'text-gray-900'
                    }`
                  }
                  value={template}
                >
                  {({ selected }) => (
                    <>
                      <span className="flex items-center gap-3">
                        {renderIcon(template)}
                        <span className={`block truncate ${selected ? 'font-semibold' : 'font-normal'}`}>
                          {template.name}
                        </span>
                        {template.isDefault && (
                          <Star className="w-4 h-4 text-yellow-500 fill-yellow-500" />
                        )}
                      </span>
                      {template.description && (
                        <span className="block truncate text-sm text-gray-500 ml-11">
                          {template.description}
                        </span>
                      )}
                      {selected && (
                        <span className="absolute inset-y-0 right-0 flex items-center pr-3 text-blue-600">
                          <Check className="h-5 w-5" aria-hidden="true" />
                        </span>
                      )}
                    </>
                  )}
                </Listbox.Option>
              ))}

              {/* Manage templates link */}
              <div className="border-t border-gray-100 mt-1 pt-1">
                <Link
                  href="/dashboard/medical-records/templates"
                  className="flex items-center gap-2 px-3 py-2 text-sm text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                >
                  <Settings className="w-4 h-4" />
                  Administrar plantillas
                </Link>
              </div>
            </Listbox.Options>
          </Transition>
        </div>
      </Listbox>
    </div>
  );
}

// Export icon components for use in other parts of the app
export { ICON_COMPONENTS };
