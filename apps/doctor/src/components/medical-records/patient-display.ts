/**
 * Shared display helpers for the patient list (PatientCard + PatientRow).
 * Lifted out of PatientCard when the row view was added so both views format
 * ages and dates identically.
 */

/**
 * `sex` is persisted as the raw lowercase enum ('male' | 'female' | 'other',
 * validated in POST /api/medical-records/patients). The UI is in Spanish, so
 * never render it directly. Unknown values fall through unchanged.
 */
const SEX_LABELS: Record<string, string> = {
  male: 'Masculino',
  female: 'Femenino',
  other: 'Otro',
};

export function formatSex(sex: string): string {
  return SEX_LABELS[sex?.toLowerCase()] ?? sex;
}

// Reexportado desde `lib/edad.ts` — ver la nota en `practice-utils.ts`.
export { calcularEdad as calculateAge } from '@/lib/edad';

export function formatPatientDate(dateString: string): string {
  try {
    const [year, month, day] = dateString.split('T')[0].split('-').map(Number);
    if (year && month && day) {
      const date = new Date(year, month - 1, day); // month is 0-indexed
      return date.toLocaleDateString('es-MX', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      });
    }
    return dateString;
  } catch {
    return dateString;
  }
}
