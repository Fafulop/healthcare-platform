// GET /api/patient-import/template — descarga la plantilla .xlsx de migración.
//
// FASE 1 de `docs/DESDE JUNIO/PACIENTE MIGRATION/`. Es lo único del proyecto
// que sirve SIN backend de importación: se le puede mandar hoy a un doctor, y
// el archivo que regrese es lo que enseña qué tan sucios vienen los datos —
// que es lo que decide cuánto hay que invertir en el validador.
//
// ⚠️ SE REPARTE .xlsx Y NO .csv A PROPÓSITO. Un CSV lo abre el doctor en Excel
// y Excel lo reescribe al guardar: las fechas se relocalizan (1985-02-01 pasa a
// 01/02/1985), los teléfonos pierden el 0 inicial y el RFC se puede coercionar.
// Con .xlsx las fechas son celdas de fecha de verdad, los teléfonos y claves
// del SAT van con formato de texto, y `sexo` es un DESPLEGABLE — que es lo que
// mata el problema de que «M» sea ambiguo entre Masculino y Mujer, en vez de
// validarlo después.
//
// Vive en `apps/api` porque es quien ya tiene `exceljs`; los dos apps (doctor y
// admin) simplemente enlazan aquí. Las columnas NO se definen en este archivo:
// vienen de `@healthcare/database`, para que la plantilla y el validador no
// puedan divergir.

import { NextRequest, NextResponse } from 'next/server';
import * as ExcelJS from 'exceljs';
import {
  PATIENT_COLUMNS,
  ENCOUNTER_COLUMNS,
  IMPORT_SHEETS,
  IMPORT_MAX_ROWS,
  type ImportColumn,
} from '@healthcare/database';
import { requireDoctorAuth, AuthError } from '@/lib/auth';

/** Renglones a los que se les aplica formato y desplegables por adelantado. */
const PREFORMATTED_ROWS = 500;

const HEADER_FILL = 'FF4F46E5'; // el índigo de la marca
const REQUIRED_FILL = 'FFFEF3C7'; // ámbar claro: columna obligatoria

function buildSheet(
  workbook: ExcelJS.Workbook,
  sheetName: string,
  columns: readonly ImportColumn[],
) {
  const ws = workbook.addWorksheet(sheetName, {
    views: [{ state: 'frozen', ySplit: 1 }], // el encabezado no se pierde al bajar
  });

  ws.columns = columns.map((c) => ({
    header: c.key,
    key: c.key,
    width: Math.min(Math.max(c.key.length + 4, 14), 30),
  }));

  const header = ws.getRow(1);
  header.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 };
  header.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: HEADER_FILL } };
  header.alignment = { vertical: 'middle' };
  header.height = 22;

  columns.forEach((col, i) => {
    const column = ws.getColumn(i + 1);

    // El formato por TIPO es la mitad del valor de repartir .xlsx.
    if (col.type === 'date') {
      column.numFmt = 'yyyy-mm-dd';
    } else if (col.type === 'text' || col.type === 'tags') {
      // '@' = texto. Sin esto Excel se come el 0 inicial de un teléfono y
      // convierte a número lo que parezca número (RFC, claves del SAT, CP).
      column.numFmt = '@';
    } else if (col.type === 'integer') {
      column.numFmt = '0';
    } else if (col.type === 'decimal') {
      column.numFmt = col.decimal?.scale === 1 ? '0.0' : '0.00';
    }

    // Las obligatorias se tiñen para que se vean sin leer las instrucciones.
    if (col.required) {
      ws.getCell(1, i + 1).fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: HEADER_FILL },
      };
      for (let r = 2; r <= PREFORMATTED_ROWS; r++) {
        ws.getCell(r, i + 1).fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: REQUIRED_FILL },
        };
      }
    }

    // Desplegable para enums y sí/no.
    if (col.options && col.options.length > 0) {
      const formula = `"${col.options.join(',')}"`;
      for (let r = 2; r <= PREFORMATTED_ROWS; r++) {
        ws.getCell(r, i + 1).dataValidation = {
          type: 'list',
          allowBlank: !col.required,
          formulae: [formula],
          showErrorMessage: true,
          errorStyle: 'error',
          errorTitle: 'Valor no válido',
          error: `Elige uno de: ${col.options.join(', ')}`,
        };
      }
    }
  });

  return ws;
}

function buildInstructions(workbook: ExcelJS.Workbook) {
  const ws = workbook.addWorksheet(IMPORT_SHEETS.instructions);
  ws.columns = [
    { key: 'a', width: 26 },
    { key: 'b', width: 14 },
    { key: 'c', width: 78 },
  ];

  const title = ws.addRow(['Cómo llenar esta plantilla']);
  title.font = { bold: true, size: 14 };
  ws.addRow([]);

  [
    'Llena una fila por paciente en la hoja PACIENTES.',
    'Si tienes el historial de sus consultas, ponlo en la hoja CONSULTAS: una fila por visita.',
    'Las dos hojas se unen por la columna id_paciente. Tiene que escribirse igual en ambas.',
    'Las columnas sombreadas son obligatorias. Las demás puedes dejarlas vacías.',
    'No cambies los nombres de las columnas ni el orden: el sistema las lee por su nombre.',
    `Máximo ${IMPORT_MAX_ROWS} filas por archivo. Si tienes más, pártelo en varios.`,
    'Guarda el archivo como .xlsx. Si lo guardas como .csv, Excel cambia las fechas al guardar.',
  ].forEach((line) => {
    const r = ws.addRow(['', '•', line]);
    r.getCell(3).alignment = { wrapText: true, vertical: 'top' };
  });

  ws.addRow([]);
  const note = ws.addRow([
    '',
    '⚠️',
    'Lo que en tu sistema anterior eran plantillas, recetas o notas de la consulta va TODO en la columna «notas» de la hoja CONSULTAS, como texto. No hace falta una columna por campo.',
  ]);
  note.getCell(3).alignment = { wrapText: true, vertical: 'top' };
  note.getCell(3).font = { bold: true };
  note.height = 30;

  // Diccionario de columnas: qué es cada una, sacado del mismo contrato.
  for (const [sheet, columns] of [
    [IMPORT_SHEETS.patients, PATIENT_COLUMNS],
    [IMPORT_SHEETS.encounters, ENCOUNTER_COLUMNS],
  ] as const) {
    ws.addRow([]);
    const h = ws.addRow([`Hoja ${sheet}`, '', '']);
    h.font = { bold: true, size: 12 };

    const sub = ws.addRow(['Columna', '¿Obligatoria?', 'Qué va aquí']);
    sub.font = { bold: true };
    sub.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE5E7EB' } };

    columns.forEach((c) => {
      const r = ws.addRow([c.key, c.required ? 'Sí' : '', c.help]);
      r.getCell(3).alignment = { wrapText: true, vertical: 'top' };
      if (c.required) r.getCell(2).font = { bold: true };
    });
  }

  return ws;
}

export async function GET(request: NextRequest) {
  try {
    // DOCTOR o ADMIN: la plantilla es un archivo VACÍO, no lleva datos de
    // nadie, pero no hay razón para servirla sin sesión.
    await requireDoctorAuth(request);

    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'TuSalud.pro';
    workbook.created = new Date();

    // Instrucciones primero: es la hoja que se abre al abrir el archivo.
    buildInstructions(workbook);
    buildSheet(workbook, IMPORT_SHEETS.patients, PATIENT_COLUMNS);
    buildSheet(workbook, IMPORT_SHEETS.encounters, ENCOUNTER_COLUMNS);

    const buffer = await workbook.xlsx.writeBuffer();

    return new NextResponse(buffer as ArrayBuffer, {
      headers: {
        'Content-Type':
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition':
          'attachment; filename="plantilla-pacientes-tusalud.xlsx"',
        'Cache-Control': 'no-store',
      },
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error('GET /api/patient-import/template', error);
    return NextResponse.json(
      { error: 'Error al generar la plantilla' },
      { status: 500 },
    );
  }
}
