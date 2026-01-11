import type { BadgeVariant } from '@healthcare/ui';

/**
 * Maps status strings to Badge component variants
 * for consistent semantic coloring across the application
 */
export function getStatusBadgeVariant(status: string): BadgeVariant {
  const variantMap: Record<string, BadgeVariant> = {
    completed: 'success',
    issued: 'success',
    draft: 'warning',
    cancelled: 'error',
    expired: 'secondary',
    amended: 'secondary',
  };
  return variantMap[status] || 'default';
}

/**
 * Returns localized status labels for encounters and prescriptions
 */
export function getStatusLabel(
  status: string,
  context: 'encounter' | 'prescription' = 'encounter'
): string {
  const encounterMap: Record<string, string> = {
    completed: 'Completada',
    draft: 'Borrador',
    amended: 'Enmendada',
  };

  const prescriptionMap: Record<string, string> = {
    draft: 'Borrador',
    issued: 'Emitida',
    cancelled: 'Cancelada',
    expired: 'Expirada',
  };

  const map = context === 'prescription' ? prescriptionMap : encounterMap;
  return map[status] || status;
}
