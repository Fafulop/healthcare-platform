import { FieldDefinition } from '@/types/custom-encounter';

interface DynamicFieldRendererProps {
  fields: FieldDefinition[];
  values: Record<string, any>;
  onChange: (fieldName: string, value: any) => void;
  errors?: Record<string, string>;
}

export function DynamicFieldRenderer({
  fields,
  values,
  onChange,
  errors = {},
}: DynamicFieldRendererProps) {
  // Group fields by section
  const fieldsBySection = fields.reduce((acc, field) => {
    const section = field.section || 'General';
    if (!acc[section]) {
      acc[section] = [];
    }
    acc[section].push(field);
    return acc;
  }, {} as Record<string, FieldDefinition[]>);

  // Sort fields within each section by order
  Object.keys(fieldsBySection).forEach((section) => {
    fieldsBySection[section].sort((a, b) => a.order - b.order);
  });

  const renderField = (field: FieldDefinition) => {
    const value = values[field.name] ?? '';
    const hasError = !!errors[field.name];
    const errorMessage = errors[field.name];

    const baseInputClasses = `w-full px-3 py-2 border ${
      hasError ? 'border-red-300' : 'border-gray-300'
    } rounded-md focus:outline-none focus:ring-2 ${
      hasError ? 'focus:ring-red-500' : 'focus:ring-blue-500'
    }`;

    switch (field.type) {
      case 'text':
        return (
          <input
            type="text"
            id={field.id}
            value={value}
            onChange={(e) => onChange(field.name, e.target.value)}
            placeholder={field.placeholder}
            required={field.required}
            className={baseInputClasses}
          />
        );

      case 'textarea':
        return (
          <textarea
            id={field.id}
            value={value}
            onChange={(e) => onChange(field.name, e.target.value)}
            placeholder={field.placeholder}
            required={field.required}
            rows={4}
            className={baseInputClasses}
          />
        );

      case 'number':
        return (
          <input
            type="number"
            id={field.id}
            value={value}
            onChange={(e) => onChange(field.name, parseFloat(e.target.value) || '')}
            placeholder={field.placeholder}
            required={field.required}
            min={field.min}
            max={field.max}
            step={field.step}
            className={baseInputClasses}
          />
        );

      case 'date':
        return (
          <input
            type="date"
            id={field.id}
            value={value}
            onChange={(e) => onChange(field.name, e.target.value)}
            required={field.required}
            className={baseInputClasses}
          />
        );

      case 'time':
        return (
          <input
            type="time"
            id={field.id}
            value={value}
            onChange={(e) => onChange(field.name, e.target.value)}
            required={field.required}
            className={baseInputClasses}
          />
        );

      case 'dropdown':
        return (
          <select
            id={field.id}
            value={value}
            onChange={(e) => onChange(field.name, e.target.value)}
            required={field.required}
            className={baseInputClasses}
          >
            <option value="">Select an option...</option>
            {field.options?.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        );

      case 'radio':
        return (
          <div className="space-y-2">
            {field.options?.map((option) => (
              <label key={option} className="flex items-center gap-2">
                <input
                  type="radio"
                  name={field.id}
                  value={option}
                  checked={value === option}
                  onChange={(e) => onChange(field.name, e.target.value)}
                  required={field.required}
                  className="w-4 h-4 text-blue-600 focus:ring-blue-500"
                />
                <span className="text-gray-700">{option}</span>
              </label>
            ))}
          </div>
        );

      case 'checkbox':
        return (
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              id={field.id}
              checked={!!value}
              onChange={(e) => onChange(field.name, e.target.checked)}
              className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
            />
            <span className="text-gray-700">{field.placeholder || 'Check this option'}</span>
          </label>
        );

      case 'file':
        return (
          <input
            type="file"
            id={field.id}
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) {
                onChange(field.name, file);
              }
            }}
            required={field.required}
            className={baseInputClasses}
          />
        );

      default:
        return (
          <div className="text-red-600 text-sm">
            Unsupported field type: {field.type}
          </div>
        );
    }
  };

  const getFieldWidth = (field: FieldDefinition) => {
    switch (field.width) {
      case 'half':
        return 'col-span-1';
      case 'third':
        return 'col-span-1';
      case 'full':
      default:
        return 'col-span-2';
    }
  };

  return (
    <div className="space-y-8">
      {Object.entries(fieldsBySection).map(([section, sectionFields]) => (
        <div key={section}>
          <h3 className="text-lg font-semibold text-gray-900 mb-4 pb-2 border-b border-gray-200">
            {section}
          </h3>
          <div className="grid grid-cols-2 gap-4">
            {sectionFields.map((field) => (
              <div key={field.id} className={getFieldWidth(field)}>
                <label
                  htmlFor={field.id}
                  className="block text-sm font-medium text-gray-700 mb-1"
                >
                  {field.label}
                  {field.required && <span className="text-red-500 ml-1">*</span>}
                </label>
                {renderField(field)}
                {errors[field.name] && (
                  <p className="mt-1 text-sm text-red-600">{errors[field.name]}</p>
                )}
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
