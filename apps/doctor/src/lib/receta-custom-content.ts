/**
 * Resolve a template-based receta's customData into ordered, PDF-ready
 * [{label, value}] pairs using the template's field definitions (order,
 * showInPdf, Spanish labels), falling back to raw keys when the template is
 * gone (its FK is SET NULL).
 *
 * Single source for every surface that renders receta content:
 * - jsPDF download (usePrescriptionDetail)
 * - react-pdf API route (prescriptions/[id]/pdf)
 * - prescription detail page
 */

export interface RecetaContentItem {
  label: string;
  value: string;
  /** Layout hints from the template (PDF replicates the on-screen format). */
  width: 'full' | 'half' | 'third';
  section?: string;
}

interface TemplateFieldLike {
  name: string;
  label?: string;
  labelEs?: string;
  order?: number;
  showInPdf?: boolean;
  width?: 'full' | 'half' | 'third';
  section?: string;
}

function formatValue(v: unknown): string {
  if (typeof v === 'boolean') return v ? 'Sí' : 'No';
  if (Array.isArray(v)) return v.join(', ');
  return String(v);
}

export function resolveRecetaCustomContent(
  customData: Record<string, unknown> | null | undefined,
  fields: TemplateFieldLike[] | null | undefined,
  options: { respectShowInPdf?: boolean } = {}
): RecetaContentItem[] {
  if (!customData || Object.keys(customData).length === 0) return [];
  const { respectShowInPdf = true } = options;

  if (fields && fields.length > 0) {
    const byOrder = fields.slice().sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
    // Group by section NAME like the on-screen form does (sections in first-
    // appearance order, fields by order within) — a section reused at a later
    // order must not appear twice.
    const sectionRank = new Map<string, number>();
    for (const f of byOrder) {
      const s = f.section || 'General';
      if (!sectionRank.has(s)) sectionRank.set(s, sectionRank.size);
    }
    return byOrder
      .sort((a, b) => {
        const ra = sectionRank.get(a.section || 'General')! - sectionRank.get(b.section || 'General')!;
        return ra !== 0 ? ra : (a.order ?? 0) - (b.order ?? 0);
      })
      .filter((f) => !respectShowInPdf || f.showInPdf !== false)
      .filter((f) => {
        const v = customData[f.name];
        return v !== undefined && v !== null && v !== '';
      })
      .map((f) => ({
        label: f.labelEs || f.label || f.name,
        value: formatValue(customData[f.name]),
        width: f.width === 'half' || f.width === 'third' ? f.width : 'full' as const,
        section: f.section || undefined,
      }));
  }

  return Object.entries(customData)
    .filter(([, v]) => v !== undefined && v !== null && v !== '')
    .map(([k, v]) => ({ label: k, value: formatValue(v), width: 'full' as const }));
}
