export interface PdfSettings {
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
}

export const DEFAULT_PDF_SETTINGS: PdfSettings = {
  showHeader: true,
  showFooter: true,
  showPageNumbers: true,
  topMarginMm: 0,
  bottomMarginMm: 0,
  showPatientBox: true,
  showEncounterMeta: true,
  showVitals: true,
  showFollowUp: true,
};
