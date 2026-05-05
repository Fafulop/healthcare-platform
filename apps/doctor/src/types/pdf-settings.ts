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
  rxTopMarginMm: number;
  rxBottomMarginMm: number;
}

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
  rxTopMarginMm: 0,
  rxBottomMarginMm: 0,
};
