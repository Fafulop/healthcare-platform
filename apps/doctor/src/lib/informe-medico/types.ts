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

/**
 * Prefijo de un campo **CRUDO**: un blanco del formato que el diccionario no
 * mapea a ningún concepto canónico, pero en el que el doctor sí puede escribir.
 *
 * 🔴 Por qué existe: el diccionario sirve para PRE-LLENAR (concepto canónico →
 * campo del PDF). No tiene por qué decidir dónde se le permite teclear a un
 * humano. AXA trae **255 campos de texto** y el diccionario mapea 60; sin esto,
 * el borrador descargado pinta 266 blancos de azul —"aquí puedes escribir"— y la
 * app sólo deja escribir en 60. Las dos vistas tienen que decir lo mismo.
 *
 * Las claves canónicas nunca llevan `:` (`paciente.edad`, `medicamentos.1.nombre`),
 * así que el prefijo no puede chocar con ninguna.
 */
export const PREFIJO_CRUDO = 'campo:';

/** `Código ICD` → `campo:Código ICD`. */
export function claveCruda(nombrePdf: string): string {
  return PREFIJO_CRUDO + nombrePdf;
}

export function esClaveCruda(clave: string): boolean {
  return clave.startsWith(PREFIJO_CRUDO);
}

/**
 * 🔴 La clave que DE VERDAD quiso decir un modelo.
 *
 * Medido con una llamada real a gpt-4o (2026-08-10): el modelo **se come el
 * prefijo `campo:`**. Le dimos el catálogo con `campo:TE` y devolvió `"TE"`;
 * `campo:Día_4` volvió como `"Día_4"`. Se lo come porque `campo:` se lee como
 * una anotación de espacio de nombres, no como parte del nombre.
 *
 * Y como la validación era `clavesValidas.has(clave)`, **TODO eso se
 * descartaba en silencio**: en ese turno el modelo acertó las 6 casillas y la
 * fecha de cirugía, y no aterrizó ni una. Sobrevivían sólo las claves canónicas
 * (`clinico.diagnostico`), que no llevan prefijo — de ahí que "a veces sí y casi
 * siempre no", y probablemente también el viejo "el dictado sólo sirve en las
 * páginas simples".
 *
 * Se resuelve con tolerancia en vez de con fe en el prompt: primero exacta,
 * luego probando el prefijo. No hay ambigüedad posible porque las claves
 * canónicas nunca llevan `:`.
 */
export function resolverClave(devuelta: string, validas: ReadonlySet<string>): string | null {
  const limpia = devuelta.trim();
  if (validas.has(limpia)) return limpia;
  const conPrefijo = PREFIJO_CRUDO + limpia;
  if (validas.has(conPrefijo)) return conPrefijo;
  // El caso contrario, por si algún día un modelo se inventa el prefijo sobre
  // una clave canónica.
  if (esClaveCruda(limpia)) {
    const sinPrefijo = nombrePdfDeClaveCruda(limpia);
    if (validas.has(sinPrefijo)) return sinPrefijo;
  }
  return null;
}

/** `campo:Código ICD` → `Código ICD`. */
export function nombrePdfDeClaveCruda(clave: string): string {
  return clave.slice(PREFIJO_CRUDO.length);
}

/**
 * A qué campo del PDF va una respuesta. `null` = a ninguno de ESTE formato.
 *
 * Pasa de verdad: un informe guardado con el diccionario de otra aseguradora, o
 * una versión del formato en la que ese campo ya no existe. Se devuelve `null`
 * y quien renderiza lo REPORTA, en vez de escribirlo en el campo equivocado.
 */
export function nombrePdfDe(clave: string, dict: FieldDict): string | null {
  if (esClaveCruda(clave)) return nombrePdfDeClaveCruda(clave);
  return dict[clave] ?? null;
}

const ORIGENES: ReadonlySet<string> = new Set<AnswerOrigin>([
  'deterministic', 'llm', 'voice', 'manual', 'empty',
]);

/**
 * Lee el `answers` que viene de la columna JSONB.
 *
 * Prisma lo tipa como "cualquier JSON" y de verdad lo es: la columna acepta un
 * arreglo, un número o un objeto de la forma que sea. Castearlo a `Answers` a
 * ciegas haría que un `answers` corrupto reventara adentro del renderer con un
 * error que no dice nada. Aquí se descarta lo que no tenga la forma esperada, y
 * lo descartado se puede contar (`Object.keys` antes y después).
 */
export function leerAnswers(json: unknown): Answers {
  if (typeof json !== 'object' || json === null || Array.isArray(json)) return {};
  const salida: Answers = {};
  for (const [clave, bruto] of Object.entries(json as Record<string, unknown>)) {
    if (typeof bruto !== 'object' || bruto === null || Array.isArray(bruto)) continue;
    const v = bruto as Record<string, unknown>;
    if (typeof v.value !== 'string') continue;
    if (typeof v.origin !== 'string' || !ORIGENES.has(v.origin)) continue;
    salida[clave] = {
      value: v.value,
      source: typeof v.source === 'string' ? v.source : null,
      origin: v.origin as AnswerOrigin,
    };
  }
  return salida;
}
