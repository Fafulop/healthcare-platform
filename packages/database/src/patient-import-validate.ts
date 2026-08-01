/**
 * Validador de la importación de pacientes — FASE 2.
 *
 * Recibe renglones YA parseados (objetos `columna → valor`) y devuelve filas
 * listas para escribir + la lista de problemas, uno por renglón y columna.
 * **No escribe nada** y **no toca Prisma**: es una función pura, para poder
 * probarla con archivos sucios de verdad sin base de datos de por medio.
 *
 * El parseo del .xlsx/.csv vive en `apps/api` (es quien tiene exceljs). Aquí
 * solo llegan objetos planos.
 *
 * Reglas de fondo:
 *   error   ⇒ el renglón NO se importa.
 *   warning ⇒ el renglón SÍ se importa, pero se ajustó algo y hay que decirlo.
 *
 * Un dato que se recorta o se redondea SIEMPRE genera warning. Lo que no puede
 * pasar es que el sistema modifique un dato clínico en silencio.
 *
 * Diseño y huecos: `docs/DESDE JUNIO/PACIENTE MIGRATION/`.
 */

import {
  PATIENT_COLUMNS,
  ENCOUNTER_COLUMNS,
  IMPORT_SHEETS,
  IMPORT_MAX_ROWS,
  DEFAULT_CHIEF_COMPLAINT,
  SEXO_MAP,
  ESTATUS_MAP,
  TIPO_CONSULTA_MAP,
  SI_NO_MAP,
  type ImportColumn,
} from './patient-import';

export type IssueLevel = 'error' | 'warning';

export interface RowIssue {
  sheet: string;
  /** Renglón tal como lo ve el doctor en Excel (el encabezado es el 1). */
  row: number;
  column?: string;
  level: IssueLevel;
  code: string;
  message: string;
}

export interface ParsedPatientRow {
  row: number;
  internalId: string | null;
  data: Record<string, unknown>;
}

export interface ParsedEncounterRow {
  row: number;
  patientRef: string;
  data: Record<string, unknown>;
}

export interface ValidationResult {
  patients: ParsedPatientRow[];
  encounters: ParsedEncounterRow[];
  issues: RowIssue[];
  counts: {
    patientsOk: number;
    encountersOk: number;
    errors: number;
    warnings: number;
  };
}

/** Filas crudas: lo que devuelve el parser, por hoja. */
export interface RawSheets {
  patients: Record<string, unknown>[];
  encounters: Record<string, unknown>[];
}

/** Lo que ya existe en la BD, para no duplicar. Lo llena la ruta. */
export interface ExistingData {
  /** `internalId` de los pacientes que ya tiene ese doctor. */
  internalIds?: Set<string>;
  /** `nombre|apellidos|YYYY-MM-DD` normalizado, para el cotejo secundario. */
  identityKeys?: Set<string>;
}

/* ── Utilidades ──────────────────────────────────────────────────────────── */

const norm = (v: unknown): string =>
  typeof v === 'string' ? v.trim() : v === null || v === undefined ? '' : String(v).trim();

const normKey = (v: unknown): string =>
  norm(v)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, ''); // quita acentos: "sí" → "si"

/**
 * Fecha de la hoja → `Date`, anclada a las 12:00 UTC.
 *
 * ⚠️ ESTO NO ES DECORATIVO. `new Date('1985-02-01')` es medianoche UTC; en
 * horario de México (UTC-6) eso ES el 31 de enero a las 18:00, y un campo
 * `@db.Date` guardaría **el día anterior**. Anclar a mediodía deja margen de
 * ±12 h, así que ninguna zona horaria mueve el día. Es el hueco #7.
 */
function parseSheetDate(value: unknown): Date | null {
  if (value === null || value === undefined || value === '') return null;

  // exceljs devuelve Date para celdas con formato de fecha.
  if (value instanceof Date && !isNaN(value.getTime())) {
    return new Date(
      Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate(), 12),
    );
  }

  // Serial de Excel (días desde 1899-12-30) — aparece en .csv exportados.
  if (typeof value === 'number' && value > 0 && value < 100000) {
    const ms = Math.round((value - 25569) * 86400 * 1000);
    const d = new Date(ms);
    return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 12));
  }

  const s = norm(value);

  // ISO: el único formato de texto que se acepta sin adivinar.
  const iso = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(s);
  if (iso) {
    const [, y, m, d] = iso;
    return new Date(Date.UTC(Number(y), Number(m) - 1, Number(d), 12));
  }

  // dd/mm/yyyy — se asume orden MEXICANO. Se acepta pero avisa (ver abajo):
  // 01/02/1985 es 1 de febrero aquí y 2 de enero para un archivo gringo.
  const slash = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(s);
  if (slash) {
    const [, a, b, y] = slash;
    const day = Number(a);
    const month = Number(b);
    if (day > 31 || month > 12) return null;
    return new Date(Date.UTC(Number(y), month - 1, day, 12));
  }

  return null;
}

/** ¿La fecha venía en un formato que pudo interpretarse al revés? */
function isAmbiguousDateText(value: unknown): boolean {
  const s = norm(value);
  const m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(s);
  // Solo es ambigua si AMBOS números caben como mes (≤12).
  return !!m && Number(m[1]) <= 12 && Number(m[2]) <= 12;
}

function roundToScale(n: number, scale: number): number {
  const f = Math.pow(10, scale);
  return Math.round(n * f) / f;
}

/* ── Validación de una celda ─────────────────────────────────────────────── */

function validateCell(
  col: ImportColumn,
  raw: unknown,
  ctx: { sheet: string; row: number; issues: RowIssue[] },
): unknown {
  const push = (level: IssueLevel, code: string, message: string) =>
    ctx.issues.push({ sheet: ctx.sheet, row: ctx.row, column: col.key, level, code, message });

  const s = norm(raw);

  if (s === '') {
    if (col.required) {
      push('error', 'REQUERIDO', `«${col.key}» no puede ir vacío.`);
      return undefined;
    }
    return null;
  }

  switch (col.type) {
    case 'date': {
      const d = parseSheetDate(raw);
      if (!d) {
        push('error', 'FECHA_INVALIDA', `«${s}» no es una fecha. Usa AAAA-MM-DD.`);
        return undefined;
      }
      if (d.getTime() > Date.now()) {
        push('error', 'FECHA_FUTURA', `«${s}» está en el futuro.`);
        return undefined;
      }
      if (isAmbiguousDateText(raw)) {
        push(
          'warning',
          'FECHA_AMBIGUA',
          `«${s}» se leyó como día/mes/año → ${d.toISOString().slice(0, 10)}. Verifica que sea correcto.`,
        );
      }
      return d;
    }

    case 'enum':
    case 'boolean': {
      const map: Record<string, string | boolean> =
        col.key === 'sexo'
          ? SEXO_MAP
          : col.key === 'estatus'
            ? ESTATUS_MAP
            : col.key === 'tipo'
              ? TIPO_CONSULTA_MAP
              : SI_NO_MAP;

      const k = normKey(raw);
      if (k in map) return map[k];

      // «M» es el caso especial que NO se adivina.
      if (col.key === 'sexo' && k === 'm') {
        push(
          'error',
          'SEXO_AMBIGUO',
          '«M» es ambiguo: puede ser Masculino o Mujer. Escribe masculino o femenino.',
        );
        return undefined;
      }
      push(
        'error',
        'VALOR_NO_VALIDO',
        `«${s}» no es válido. Usa: ${(col.options ?? Object.keys(map)).join(', ')}.`,
      );
      return undefined;
    }

    case 'integer': {
      const n = Number(s.replace(/,/g, ''));
      if (!Number.isFinite(n)) {
        push('error', 'NO_ES_NUMERO', `«${s}» no es un número.`);
        return undefined;
      }
      if (!Number.isInteger(n)) {
        push('warning', 'REDONDEADO', `«${s}» se redondeó a ${Math.round(n)}.`);
        return Math.round(n);
      }
      return n;
    }

    case 'decimal': {
      const n = Number(s.replace(/,/g, ''));
      if (!Number.isFinite(n)) {
        push('error', 'NO_ES_NUMERO', `«${s}» no es un número.`);
        return undefined;
      }
      const scale = col.decimal?.scale ?? 2;
      const precision = col.decimal?.precision ?? 10;
      const rounded = roundToScale(n, scale);
      if (rounded !== n) {
        push('warning', 'REDONDEADO', `«${s}» se redondeó a ${rounded}.`);
      }
      // Decimal(p,s): p es el TOTAL de dígitos, así que caben p-s enteros.
      const maxInt = Math.pow(10, precision - scale);
      if (Math.abs(rounded) >= maxInt) {
        push(
          'error',
          'FUERA_DE_RANGO',
          `«${s}» no cabe en la columna (máximo ${maxInt - 1}). Revisa la unidad.`,
        );
        return undefined;
      }
      return rounded;
    }

    case 'tags': {
      const tags = s
        .split(';')
        .map((t) => t.trim())
        .filter(Boolean);
      return tags;
    }

    case 'text':
    case 'longText':
    default: {
      if (col.maxLength && s.length > col.maxLength) {
        push(
          'warning',
          'RECORTADO',
          `«${col.key}» tenía ${s.length} caracteres y se recortó a ${col.maxLength}.`,
        );
        return s.slice(0, col.maxLength);
      }
      return s;
    }
  }
}

/* ── Validación completa ─────────────────────────────────────────────────── */

export function validateImport(
  sheets: RawSheets,
  existing: ExistingData = {},
): ValidationResult {
  const issues: RowIssue[] = [];
  const patients: ParsedPatientRow[] = [];
  const encounters: ParsedEncounterRow[] = [];

  const totalRows = sheets.patients.length + sheets.encounters.length;
  if (totalRows > IMPORT_MAX_ROWS) {
    issues.push({
      sheet: '—',
      row: 0,
      level: 'error',
      code: 'ARCHIVO_MUY_GRANDE',
      message: `El archivo trae ${totalRows} renglones y el máximo es ${IMPORT_MAX_ROWS}. Pártelo en varios.`,
    });
    return { patients: [], encounters: [], issues, counts: tally(issues, 0, 0) };
  }

  /* ── Hoja PACIENTES ─────────────────────────────────────────────────── */
  const seenInternalIds = new Map<string, number>();
  const seenIdentity = new Map<string, number>();
  const fileInternalIds = new Set<string>();
  /** Folios que SÍ vienen en la hoja pero cuyo renglón no pasó. */
  const failedInternalIds = new Map<string, number>();

  sheets.patients.forEach((raw, i) => {
    const row = i + 2; // +1 por índice base 0, +1 por el encabezado
    const ctx = { sheet: IMPORT_SHEETS.patients, row, issues };
    const data: Record<string, unknown> = {};
    let rowFailed = false;

    for (const col of PATIENT_COLUMNS) {
      const value = validateCell(col, raw[col.key], ctx);
      if (value === undefined) {
        rowFailed = true;
        continue;
      }
      if (value !== null) data[col.field] = value;
    }

    const internalId = norm(raw['id_paciente']) || null;

    // Hueco #4 — duplicado DENTRO del archivo.
    if (internalId) {
      const prev = seenInternalIds.get(internalId);
      if (prev) {
        issues.push({
          sheet: IMPORT_SHEETS.patients,
          row,
          column: 'id_paciente',
          level: 'error',
          code: 'DUPLICADO_EN_ARCHIVO',
          message: `«${internalId}» ya aparece en el renglón ${prev} de esta misma hoja.`,
        });
        rowFailed = true;
      } else {
        seenInternalIds.set(internalId, row);
      }
    }

    // Hueco #1 — ya existe en la BD ⇒ se salta, NO se pisa.
    if (internalId && existing.internalIds?.has(internalId)) {
      issues.push({
        sheet: IMPORT_SHEETS.patients,
        row,
        column: 'id_paciente',
        level: 'warning',
        code: 'YA_EXISTE',
        message: `Ya tienes un paciente con el folio «${internalId}». Este renglón se omite; no se sobrescribe nada.`,
      });
      rowFailed = true;
    }

    // Hueco #3 — sin folio, cotejo secundario por identidad.
    const identity =
      data.firstName && data.lastName && data.dateOfBirth
        ? `${normKey(data.firstName)}|${normKey(data.lastName)}|${(data.dateOfBirth as Date).toISOString().slice(0, 10)}`
        : null;

    if (identity) {
      const prevRow = seenIdentity.get(identity);
      if (prevRow) {
        issues.push({
          sheet: IMPORT_SHEETS.patients,
          row,
          level: 'warning',
          code: 'POSIBLE_DUPLICADO',
          message: `Mismo nombre y fecha de nacimiento que el renglón ${prevRow}. Se importa igual — revísalo.`,
        });
      } else {
        seenIdentity.set(identity, row);
      }
      if (!internalId && existing.identityKeys?.has(identity)) {
        issues.push({
          sheet: IMPORT_SHEETS.patients,
          row,
          level: 'warning',
          code: 'POSIBLE_DUPLICADO_BD',
          message:
            'Ya tienes un paciente con ese nombre y fecha de nacimiento. Como este renglón no trae folio, se importaría como uno nuevo.',
        });
      }
    }

    if (!rowFailed) {
      if (internalId) fileInternalIds.add(internalId);
      patients.push({ row, internalId, data });
    } else if (internalId) {
      // Se guarda aparte para poder distinguir «no existe» de «existe pero
      // viene con errores» al validar sus consultas. Ver abajo.
      failedInternalIds.set(internalId, row);
    }
  });

  /* ── Hoja CONSULTAS ─────────────────────────────────────────────────── */
  const seenEncounters = new Map<string, number>();

  sheets.encounters.forEach((raw, i) => {
    const row = i + 2;
    const ctx = { sheet: IMPORT_SHEETS.encounters, row, issues };
    const data: Record<string, unknown> = {};
    let rowFailed = false;

    for (const col of ENCOUNTER_COLUMNS) {
      const value = validateCell(col, raw[col.key], ctx);
      if (value === undefined) {
        rowFailed = true;
        continue;
      }
      if (value !== null) data[col.field] = value;
    }

    const patientRef = norm(raw['id_paciente']);

    // Integridad referencial: la consulta tiene que colgar de un paciente
    // que venga en ESTE archivo. Si no, no hay a quién colgarla.
    //
    // ⚠️ Se distinguen DOS casos a propósito. Una sola celda mala en la hoja
    // de pacientes tumba también TODO el historial clínico de ese paciente, y
    // con un mensaje de «no encontrado» el doctor corrige esa celda sin
    // enterarse de que además perdió sus consultas. El mensaje tiene que
    // mandarlo al renglón que de verdad hay que arreglar.
    if (patientRef && !fileInternalIds.has(patientRef)) {
      const failedAt = failedInternalIds.get(patientRef);
      issues.push(
        failedAt
          ? {
              sheet: IMPORT_SHEETS.encounters,
              row,
              column: 'id_paciente',
              level: 'error',
              code: 'PACIENTE_CON_ERRORES',
              message: `«${patientRef}» sí está en ${IMPORT_SHEETS.patients} (renglón ${failedAt}) pero ese renglón tiene errores. Arregla el renglón ${failedAt} y esta consulta entra sola.`,
            }
          : {
              sheet: IMPORT_SHEETS.encounters,
              row,
              column: 'id_paciente',
              level: 'error',
              code: 'PACIENTE_NO_ENCONTRADO',
              message: `«${patientRef}» no aparece en la hoja ${IMPORT_SHEETS.patients}.`,
            },
      );
      rowFailed = true;
    }

    // `chiefComplaint` es NOT NULL en la BD.
    if (!data.chiefComplaint) {
      data.chiefComplaint = DEFAULT_CHIEF_COMPLAINT;
    }

    // Hueco #2 — las consultas NO tienen llave natural. Sin esto, reintentar
    // una importación le duplica el historial completo al paciente, y no se
    // nota hasta que alguien abre el expediente.
    if (patientRef && data.encounterDate) {
      const key = `${patientRef}|${(data.encounterDate as Date).toISOString().slice(0, 10)}|${normKey(data.chiefComplaint)}`;
      const prev = seenEncounters.get(key);
      if (prev) {
        issues.push({
          sheet: IMPORT_SHEETS.encounters,
          row,
          level: 'error',
          code: 'CONSULTA_DUPLICADA',
          message: `Misma fecha y motivo que el renglón ${prev} para el mismo paciente.`,
        });
        rowFailed = true;
      } else {
        seenEncounters.set(key, row);
      }
    }

    if (!rowFailed) encounters.push({ row, patientRef, data });
  });

  return {
    patients,
    encounters,
    issues,
    counts: tally(issues, patients.length, encounters.length),
  };
}

function tally(issues: RowIssue[], patientsOk: number, encountersOk: number) {
  return {
    patientsOk,
    encountersOk,
    errors: issues.filter((i) => i.level === 'error').length,
    warnings: issues.filter((i) => i.level === 'warning').length,
  };
}
