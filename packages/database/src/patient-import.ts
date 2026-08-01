/**
 * Contrato de importación de pacientes — la ÚNICA fuente de verdad.
 *
 * De aquí salen las dos cosas que tienen que coincidir siempre: la plantilla
 * `.xlsx` que se le da al doctor y el validador que lee el archivo que regresa.
 * Si vivieran separadas, un día la plantilla diría `sexo` y el validador
 * buscaría `genero`, y el error aparecería recién con un archivo real de un
 * doctor real.
 *
 * Vive en `@healthcare/database` porque los DOS apps lo necesitan: el del
 * doctor (autoservicio) y el de admin (migración asistida), y no comparten API.
 * No agrega dependencias — es TypeScript puro, sin exceljs: el armado del
 * archivo vive en `apps/api`, que ya tiene esa librería.
 *
 * Diseño y huecos conocidos: `docs/DESDE JUNIO/PACIENTE MIGRATION/`.
 */

export type ImportColumnType =
  | 'text'
  | 'longText'
  | 'date'
  | 'integer'
  | 'decimal'
  | 'enum'
  | 'boolean'
  | 'tags';

export interface ImportColumn {
  /** Encabezado EXACTO en la hoja. Es también la llave al parsear. */
  key: string;
  /** Campo de Prisma al que aterriza. */
  field: string;
  type: ImportColumnType;
  required?: boolean;
  /** Tope del `VarChar` en la BD. El validador corta y reporta. */
  maxLength?: number;
  /** `Decimal(p,s)` de la BD — lo que NO cabe se redondea y se reporta. */
  decimal?: { precision: number; scale: number };
  /** Valores que se le ofrecen al doctor (van como desplegable en el .xlsx). */
  options?: readonly string[];
  /** Valor de la hoja → valor que guarda la BD. */
  map?: Readonly<Record<string, string | boolean>>;
  /** Ayuda de una línea; se pinta en la hoja de instrucciones. */
  help: string;
}

/* ── Mapas de enum ────────────────────────────────────────────────────────
   El desplegable del .xlsx sirve para que el doctor NO escriba libremente:
   en texto libre un doctor mexicano pone «M», que es ambiguo entre Masculino
   y Mujer. Aun así el validador acepta estos sinónimos, porque un .csv
   exportado de otro lado no trae desplegables. */

export const SEXO_MAP: Readonly<Record<string, string>> = {
  masculino: 'male',
  femenino: 'female',
  otro: 'other',
  // Sinónimos tolerados al parsear (NO se ofrecen en el desplegable).
  hombre: 'male',
  mujer: 'female',
  h: 'male',
  f: 'female',
  // OJO: 'm' NO está aquí a propósito. Es ambiguo (Masculino / Mujer) y
  // adivinarlo asigna sexo equivocado en silencio. El validador lo rechaza y
  // pide que se corrija a mano.
};

export const ESTATUS_MAP: Readonly<Record<string, string>> = {
  activo: 'active',
  inactivo: 'inactive',
  archivado: 'archived',
};

export const TIPO_CONSULTA_MAP: Readonly<Record<string, string>> = {
  consulta: 'consultation',
  seguimiento: 'follow-up',
  urgencia: 'emergency',
  telemedicina: 'telemedicine',
};

export const SI_NO_MAP: Readonly<Record<string, boolean>> = {
  sí: true,
  si: true,
  no: false,
};

/* ── Hoja 1: PACIENTES ──────────────────────────────────────────────────── */

export const PATIENT_COLUMNS: readonly ImportColumn[] = [
  {
    key: 'id_paciente',
    field: 'internalId',
    type: 'text',
    maxLength: 50,
    help: 'Tu folio interno del paciente. Si lo dejas vacío se genera uno. Es lo que une esta hoja con la de CONSULTAS.',
  },
  {
    key: 'nombre',
    field: 'firstName',
    type: 'text',
    required: true,
    maxLength: 100,
    help: 'Obligatorio.',
  },
  {
    key: 'apellidos',
    field: 'lastName',
    type: 'text',
    required: true,
    maxLength: 100,
    help: 'Obligatorio.',
  },
  {
    key: 'fecha_nacimiento',
    field: 'dateOfBirth',
    type: 'date',
    required: true,
    help: 'Obligatorio. Celda de fecha — no la escribas como texto.',
  },
  {
    key: 'sexo',
    field: 'sex',
    type: 'enum',
    required: true,
    options: ['masculino', 'femenino', 'otro'],
    map: SEXO_MAP,
    help: 'Obligatorio. Elige de la lista.',
  },

  { key: 'email', field: 'email', type: 'text', maxLength: 255, help: 'Opcional.' },
  {
    key: 'telefono',
    field: 'phone',
    type: 'text',
    maxLength: 50,
    help: 'Columna de TEXTO, para no perder el 0 inicial.',
  },
  { key: 'direccion', field: 'address', type: 'longText', help: 'Calle y número.' },
  { key: 'ciudad', field: 'city', type: 'text', maxLength: 100, help: 'Opcional.' },
  { key: 'estado', field: 'state', type: 'text', maxLength: 100, help: 'Opcional.' },
  {
    key: 'codigo_postal',
    field: 'postalCode',
    type: 'text',
    maxLength: 20,
    help: 'Columna de TEXTO, para no perder el 0 inicial.',
  },

  {
    key: 'emergencia_nombre',
    field: 'emergencyContactName',
    type: 'text',
    maxLength: 200,
    help: 'A quién llamar.',
  },
  {
    key: 'emergencia_telefono',
    field: 'emergencyContactPhone',
    type: 'text',
    maxLength: 50,
    help: 'Columna de TEXTO.',
  },
  {
    key: 'emergencia_parentesco',
    field: 'emergencyContactRelation',
    type: 'text',
    maxLength: 100,
    help: 'Madre, esposo, hijo…',
  },

  { key: 'alergias', field: 'currentAllergies', type: 'longText', help: 'Texto libre.' },
  {
    key: 'enfermedades_cronicas',
    field: 'currentChronicConditions',
    type: 'longText',
    help: 'Texto libre.',
  },
  {
    key: 'medicamentos_actuales',
    field: 'currentMedications',
    type: 'longText',
    help: 'Texto libre.',
  },
  { key: 'tipo_sangre', field: 'bloodType', type: 'text', maxLength: 10, help: 'O+, A-, …' },
  { key: 'notas_generales', field: 'generalNotes', type: 'longText', help: 'Lo que no cabe en otra columna.' },

  {
    key: 'primera_visita',
    field: 'firstVisitDate',
    type: 'date',
    help: 'Si la dejas vacía se calcula de la consulta más antigua.',
  },
  {
    key: 'ultima_visita',
    field: 'lastVisitDate',
    type: 'date',
    help: 'Si la dejas vacía se calcula de la consulta más reciente.',
  },
  {
    key: 'estatus',
    field: 'status',
    type: 'enum',
    options: ['activo', 'inactivo', 'archivado'],
    map: ESTATUS_MAP,
    help: 'Si la dejas vacía, queda activo.',
  },
  {
    key: 'etiquetas',
    field: 'tags',
    type: 'tags',
    help: 'Separadas por punto y coma. Ej: diabético; post-operado',
  },

  {
    key: 'requiere_factura',
    field: 'requiereFactura',
    type: 'boolean',
    options: ['sí', 'no'],
    map: SI_NO_MAP,
    help: 'Solo si le facturas a este paciente.',
  },
  { key: 'rfc', field: 'rfc', type: 'text', maxLength: 13, help: 'Columna de TEXTO. 12 o 13 caracteres.' },
  { key: 'razon_social', field: 'razonSocial', type: 'text', maxLength: 300, help: 'Como aparece en su constancia.' },
  {
    key: 'regimen_fiscal',
    field: 'regimenFiscal',
    type: 'text',
    maxLength: 10,
    help: 'Clave del SAT. Ej: 612',
  },
  { key: 'uso_cfdi', field: 'usoCfdi', type: 'text', maxLength: 10, help: 'Clave del SAT. Ej: D01' },
  { key: 'cp_fiscal', field: 'codigoPostalFiscal', type: 'text', maxLength: 10, help: 'Columna de TEXTO.' },
];

/* ── Hoja 2: CONSULTAS ──────────────────────────────────────────────────── */

export const ENCOUNTER_COLUMNS: readonly ImportColumn[] = [
  {
    key: 'id_paciente',
    field: '__patientRef',
    type: 'text',
    required: true,
    maxLength: 50,
    help: 'Obligatorio. Tiene que existir en la hoja PACIENTES.',
  },
  {
    key: 'fecha',
    field: 'encounterDate',
    type: 'date',
    required: true,
    help: 'Obligatorio. La fecha REAL de la visita — es lo que ordena el expediente.',
  },
  {
    key: 'motivo',
    field: 'chiefComplaint',
    type: 'text',
    maxLength: 500,
    help: 'Por qué vino. Si lo dejas vacío se escribe «Consulta migrada».',
  },
  {
    key: 'notas',
    field: 'clinicalNotes',
    type: 'longText',
    help: 'AQUÍ va todo el texto libre: lo que en tu sistema anterior eran plantillas, recetas y notas.',
  },
  { key: 'padecimiento_actual', field: 'subjective', type: 'longText', help: 'Lo que refiere el paciente.' },
  { key: 'exploracion', field: 'objective', type: 'longText', help: 'Hallazgos de la exploración.' },
  { key: 'diagnostico', field: 'assessment', type: 'longText', help: 'Diagnóstico o impresión.' },
  { key: 'tratamiento', field: 'plan', type: 'longText', help: 'Plan y seguimiento.' },
  {
    key: 'tipo',
    field: 'encounterType',
    type: 'enum',
    options: ['consulta', 'seguimiento', 'urgencia', 'telemedicina'],
    map: TIPO_CONSULTA_MAP,
    help: 'Si la dejas vacía, queda como consulta.',
  },
  { key: 'consultorio', field: 'location', type: 'text', maxLength: 100, help: 'Dónde fue.' },
  { key: 'proxima_cita', field: 'followUpDate', type: 'date', help: 'Si quedó una cita de seguimiento.' },

  {
    key: 'presion_arterial',
    field: 'vitalsBloodPressure',
    type: 'text',
    maxLength: 20,
    help: 'TEXTO, porque es 120/80.',
  },
  { key: 'frecuencia_cardiaca', field: 'vitalsHeartRate', type: 'integer', help: 'Número entero.' },
  {
    key: 'temperatura_c',
    field: 'vitalsTemperature',
    type: 'decimal',
    decimal: { precision: 4, scale: 1 },
    help: 'Grados Celsius. Un decimal.',
  },
  {
    key: 'peso_kg',
    field: 'vitalsWeight',
    type: 'decimal',
    decimal: { precision: 5, scale: 2 },
    help: 'Kilogramos. Hasta dos decimales.',
  },
  {
    key: 'estatura_cm',
    field: 'vitalsHeight',
    type: 'decimal',
    decimal: { precision: 5, scale: 2 },
    help: 'CENTÍMETROS (172, no 1.72). La unidad va en el nombre para que no haya duda.',
  },
  { key: 'saturacion_oxigeno', field: 'vitalsOxygenSat', type: 'integer', help: 'Número entero.' },
  { key: 'otros_signos', field: 'vitalsOther', type: 'longText', help: 'Lo demás.' },
];

/* ── Constantes del importador ──────────────────────────────────────────── */

export const IMPORT_SHEETS = {
  patients: 'PACIENTES',
  encounters: 'CONSULTAS',
  instructions: 'INSTRUCCIONES',
} as const;

/**
 * Tope por archivo. No es capricho: el commit corre en transacción y un
 * archivo grande revienta el timeout. Por arriba de esto, se parte el archivo.
 */
export const IMPORT_MAX_ROWS = 2000;

/** Lo que se escribe en `chiefComplaint` cuando el archivo no trae motivo. */
export const DEFAULT_CHIEF_COMPLAINT = 'Consulta migrada';

/**
 * Encabezado que se antepone a `clinicalNotes` de todo lo migrado.
 *
 * La procedencia va AQUÍ y no en `customData`: poner cualquier cosa en
 * `customData` hace que `EncounterCard` saque la descripción de la tarjeta del
 * primer valor string de ese objeto, y que la vista de detalle DEJE de mostrar
 * el motivo de consulta. O sea, cada consulta migrada se listaría con el
 * nombre del archivo de importación como título.
 */
export function importedNotesHeader(sourceFile: string, importedAt: Date): string {
  const fecha = importedAt.toISOString().slice(0, 10);
  return `— Migrado del sistema anterior · archivo: ${sourceFile} · ${fecha} —`;
}
