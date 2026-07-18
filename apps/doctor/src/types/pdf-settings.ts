export interface PdfSettings {
  // ── Encounter PDF ──
  // Header & Footer
  showHeader: boolean;
  showFooter: boolean;
  showPageNumbers: boolean;

  // Margins (mm) — extra blank space for pre-printed letterhead
  // jsPDF uses mm by default, so these values are used directly
  topMarginMm: number;
  bottomMarginMm: number;

  // Standard section visibility
  showPatientBox: boolean;
  showEncounterMeta: boolean;
  showVitals: boolean;
  showFollowUp: boolean;

  // ── Prescription PDF ──
  rxShowHeader: boolean;
  rxShowFooter: boolean;
  rxShowPatientBox: boolean;
  rxShowDiagnosis: boolean;
  rxShowClinicalNotes: boolean;
  rxShowLogo: boolean;       // logo del consultorio in the header band
  rxShowSignature: boolean;  // firma digital in the footer band
  /** Page size — doctors often print on pre-printed receta paper (media carta). */
  rxPageSize: RxPageSize;
  /** Page orientation (vertical = portrait, horizontal = landscape). */
  rxOrientation: 'portrait' | 'landscape';
  rxTopMarginMm: number;
  rxBottomMarginMm: number;
}

export type RxPageSize = 'letter' | 'half-letter' | 'a4' | 'a5';

/** jsPDF format per size: named formats or [w, h] in mm (portrait). */
export const RX_PAGE_FORMATS: Record<RxPageSize, string | [number, number]> = {
  letter: 'letter',            // 216 × 279 mm (carta)
  'half-letter': [140, 216],   // media carta — typical pre-printed receta pads
  a4: 'a4',                    // 210 × 297 mm
  a5: 'a5',                    // 148 × 210 mm
};

export const RX_PAGE_SIZES: { id: RxPageSize; label: string }[] = [
  { id: 'letter', label: 'Carta (216 × 279 mm)' },
  { id: 'half-letter', label: 'Media carta (140 × 216 mm) — típico de recetarios' },
  { id: 'a4', label: 'A4 (210 × 297 mm)' },
  { id: 'a5', label: 'A5 (148 × 210 mm)' },
];

export const DEFAULT_PDF_SETTINGS: PdfSettings = {
  // Encounter
  showHeader: true,
  showFooter: true,
  showPageNumbers: true,
  topMarginMm: 0,
  bottomMarginMm: 0,
  showPatientBox: true,
  showEncounterMeta: true,
  showVitals: true,
  showFollowUp: true,
  // Prescription
  rxShowHeader: true,
  rxShowFooter: true,
  rxShowPatientBox: true,
  rxShowDiagnosis: true,
  rxShowClinicalNotes: true,
  rxShowLogo: true,
  rxShowSignature: true,
  rxPageSize: 'a4', // preserves pre-feature behavior for existing doctors
  rxOrientation: 'portrait',
  rxTopMarginMm: 0,
  rxBottomMarginMm: 0,
};
