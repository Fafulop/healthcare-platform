/**
 * Parseo del archivo de migración: .xlsx o .csv → renglones planos.
 *
 * Vive en `apps/api` y no en `packages/` porque necesita exceljs, que solo
 * está aquí. El validador de `@healthcare/database` es puro y recibe lo que
 * esto devuelve.
 *
 * Se leen las hojas POR NOMBRE (`PACIENTES`, `CONSULTAS`) y las columnas por
 * su encabezado, nunca por posición: un doctor va a reordenar columnas o
 * insertar una suya, y leer por índice haría que los datos se corrieran de
 * campo en silencio — el peor error posible aquí.
 */

import * as ExcelJS from 'exceljs';
import { IMPORT_SHEETS, type RawSheets } from '@healthcare/database';

/** Una celda de exceljs puede venir envuelta; esto la deja en algo plano. */
function cellValue(cell: ExcelJS.Cell): unknown {
  const v = cell.value;
  if (v === null || v === undefined) return null;
  if (v instanceof Date) return v;
  if (typeof v === 'object') {
    // Fórmulas, texto enriquecido e hipervínculos.
    if ('result' in v) return (v as ExcelJS.CellFormulaValue).result ?? null;
    if ('richText' in v)
      return (v as ExcelJS.CellRichTextValue).richText.map((t) => t.text).join('');
    if ('text' in v) return (v as ExcelJS.CellHyperlinkValue).text;
    return null;
  }
  return v;
}

function readSheet(ws: ExcelJS.Worksheet | undefined): Record<string, unknown>[] {
  if (!ws) return [];

  const headerRow = ws.getRow(1);
  const headers: (string | null)[] = [];
  headerRow.eachCell({ includeEmpty: true }, (cell, col) => {
    const raw = cellValue(cell);
    headers[col] = raw === null ? null : String(raw).trim().toLowerCase();
  });

  const rows: Record<string, unknown>[] = [];

  ws.eachRow({ includeEmpty: false }, (row, rowNumber) => {
    if (rowNumber === 1) return;

    const obj: Record<string, unknown> = {};
    let hasAny = false;

    row.eachCell({ includeEmpty: false }, (cell, col) => {
      const key = headers[col];
      if (!key) return;
      const value = cellValue(cell);
      if (value === null || value === '') return;
      obj[key] = value;
      hasAny = true;
    });

    // Un renglón totalmente vacío no es un error: Excel deja cientos al final
    // de cualquier archivo que alguien tocó. Se ignoran en silencio.
    if (hasAny) rows.push(obj);
  });

  return rows;
}

export async function parseImportFile(
  buffer: ArrayBuffer,
  filename: string,
): Promise<RawSheets> {
  const workbook = new ExcelJS.Workbook();

  if (filename.toLowerCase().endsWith('.csv')) {
    // Un .csv es UNA tabla: se asume que son PACIENTES. Traer historial
    // clínico exige el .xlsx de dos hojas.
    const text = Buffer.from(buffer).toString('utf-8');
    const ws = await workbook.csv.read(
      // `csv.read` quiere un stream; un Readable de una línea basta.
      require('stream').Readable.from([text]),
    );
    return { patients: readSheet(ws), encounters: [] };
  }

  await workbook.xlsx.load(buffer);

  const find = (name: string) =>
    workbook.worksheets.find(
      (w) => w.name.trim().toLowerCase() === name.toLowerCase(),
    );

  return {
    patients: readSheet(find(IMPORT_SHEETS.patients)),
    encounters: readSheet(find(IMPORT_SHEETS.encounters)),
  };
}

/** ¿El archivo trae siquiera las hojas que esperamos? */
export function describeSheets(sheets: RawSheets): string | null {
  if (sheets.patients.length === 0 && sheets.encounters.length === 0) {
    return `El archivo no tiene filas en una hoja llamada «${IMPORT_SHEETS.patients}». Descarga la plantilla y llénala sin cambiarle el nombre a las hojas.`;
  }
  return null;
}
