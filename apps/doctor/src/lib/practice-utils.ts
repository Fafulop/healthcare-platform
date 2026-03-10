const API_URL = process.env.NEXT_PUBLIC_API_URL || '';

export interface PracticeDoctorProfile {
  id: string;
  slug: string;
  primarySpecialty: string;
  doctorFullName?: string;
}

export function formatCurrency(amount: string | number): string {
  return new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' })
    .format(typeof amount === 'string' ? parseFloat(amount) : amount);
}

// Short format: 15/03/2026 — for list/table views
export function formatDateShort(dateString: string): string {
  try {
    const datePart = dateString.split('T')[0];
    const [year, month, day] = datePart.split('-').map(Number);
    if (year && month && day) {
      return new Date(year, month - 1, day).toLocaleDateString('es-MX', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
      });
    }
    return dateString;
  } catch { return dateString; }
}

// Long format: 15 de marzo de 2026 — for detail/heading views
export function formatDateLong(dateString: string): string {
  try {
    const datePart = dateString.split('T')[0];
    const [year, month, day] = datePart.split('-').map(Number);
    if (year && month && day) {
      return new Date(year, month - 1, day).toLocaleDateString('es-MX', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      });
    }
    return dateString;
  } catch { return dateString; }
}

export function calculateAge(dateOfBirth: string): number {
  const today = new Date();
  const birth = new Date(dateOfBirth);
  let age = today.getFullYear() - birth.getFullYear();
  const monthDiff = today.getMonth() - birth.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
    age--;
  }
  return age;
}

export function formatDateTime(dateString: string): string {
  return new Date(dateString).toLocaleString('es-MX', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export async function fetchDoctorProfile(doctorId: string): Promise<PracticeDoctorProfile | null> {
  try {
    const response = await fetch(`${API_URL}/api/doctors`);
    const result = await response.json();
    if (result.success) {
      return result.data.find((d: any) => d.id === doctorId) || null;
    }
    return null;
  } catch {
    return null;
  }
}
