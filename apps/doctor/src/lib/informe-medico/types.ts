/**
 * INFORME MÉDICO — tipos compartidos.
 *
 * Diseño: docs/DESDE JUNIO/INFORME MEDICO/
 * El PDF es una SALIDA, nunca la superficie de captura: se teclea contra este
 * JSON en un formulario HTML y el PDF se genera al final (02-PLAN §1).
 */

/**
 * De dónde salió un valor. **Conjunto CERRADO** — está replicado en el comentario
 * de `MedicalReport.answers` (schema.prisma) y en `create-informe-medico.sql`.
 * Agregar un valor aquí sin actualizar los otros dos rompe cualquier `switch`
 * de la UI en silencio (01-FUENTES §4).
 */
export type AnswerOrigin =
  | 'deterministic' // copiado del expediente, sin interpretar
  | 'llm'           // lo redactó el modelo — el doctor DEBE revisarlo
  | 'voice'         // dictado
  | 'manual'        // lo tecleó el doctor
  | 'empty';        // NO HAY DE DÓNDE. Estado explícito, no un "" ambiguo

/** Un valor del informe CON su procedencia. Nunca se guarda el valor suelto. */
export interface AnswerValue {
  value: string;
  /** Ruta legible de la fuente: `patient.dateOfBirth`, `encounter.customData.tipoLesion`… */
  source: string | null;
  origin: AnswerOrigin;
}

/** `campoCanónico -> valor`. Es el `answers` JSONB de `medical_reports`. */
export type Answers = Record<string, AnswerValue>;

/**
 * `campoCanónico -> nombre del campo AcroForm en ESE PDF`.
 * Es el `field_dict` de `insurance_forms`: agregar una aseguradora es escribir
 * este diccionario, **no tocar código** (04-MAPEO §1).
 */
export type FieldDict = Record<string, string>;

/** Un campo vacío pero declarado: hay dónde escribir y no hay qué. */
export const EMPTY_ANSWER: AnswerValue = { value: '', source: null, origin: 'empty' };
