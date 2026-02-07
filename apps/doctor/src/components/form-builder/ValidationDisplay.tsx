import { AlertCircle } from 'lucide-react';

interface ValidationDisplayProps {
  errors: Record<string, string[]>;
}

export function ValidationDisplay({ errors }: ValidationDisplayProps) {
  const allErrors = Object.entries(errors);
  if (allErrors.length === 0) return null;

  // Show template-level errors
  const templateErrors = errors['_template'] || [];
  const fieldCountErrors = errors['_fields'] || [];
  const topErrors = [...templateErrors, ...fieldCountErrors];

  return (
    <div className="bg-red-50 border border-red-200 rounded-lg p-3">
      <div className="flex items-center gap-2 mb-1">
        <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0" />
        <span className="text-sm font-medium text-red-800">
          {allErrors.length} {allErrors.length === 1 ? 'problema de validacion' : 'problemas de validacion'}
        </span>
      </div>
      {topErrors.length > 0 && (
        <ul className="ml-6 text-sm text-red-700 list-disc">
          {topErrors.map((err, i) => (
            <li key={i}>{err}</li>
          ))}
        </ul>
      )}
    </div>
  );
}
