/**
 * El nombre con que se MUESTRA una plantilla llenada (`ClinicalEncounter`) en listas y tarjetas: su
 * «Motivo»; si no lo tiene, el NOMBRE de la plantilla («QA Plantilla 2 Signos»); y sólo sin ninguno de
 * los dos, una etiqueta genérica. Antes cada pantalla improvisaba la suya — «Plantilla personalizada»,
 * «3/10/2026 -» o el primer valor llenado («Regular») — (H-021 · H-037 · H-050). El nombre llega con
 * `template: { select: { name: true } }` en la consulta de la ruta.
 */
export interface ConNombreDePlantilla {
  chiefComplaint?: string | null;
  templateId?: string | null;
  template?: { name: string } | null;
}

export function tituloDePlantilla(e: ConNombreDePlantilla, generico?: string): string {
  return e.chiefComplaint?.trim()
    || e.template?.name?.trim()
    || generico
    || (e.templateId ? 'Plantilla personalizada' : 'Plantilla SOAP');
}
