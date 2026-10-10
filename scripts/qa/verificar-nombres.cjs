// SÓLO LECTURA — ¿algún nombre de paciente guardado con espacios de más? (2026-10-10)
//
// La regla (`limpiarNombre`, packages/database/src/nombres.ts) se aplica en cada punto de entrada de texto
// libre; las copias salen limpias de ahí. Esto revisa TODAS las columnas que guardan un nombre de paciente
// (la fuente y sus copias) y sale con código 1 si alguna tiene filas sucias — si aparecen, hay un camino
// de escritura nuevo que no usa la regla: búscalo con `ultima_sucia`.
// NO revisa razón social ni nombres de CFDI a propósito: son datos legales del SAT y van tal cual.
//
// Correr desde la raíz del repo:
//   railway run --service pgvector node scripts/qa/verificar-nombres.cjs
const path = require('path');
const { PrismaClient } = require(path.join(__dirname, '../../packages/database/node_modules/@prisma/client'));

const prisma = new PrismaClient({ datasources: { db: { url: process.env.DATABASE_PUBLIC_URL || process.env.DATABASE_URL } } });
// La MISMA regla que `limpiarNombre`: colapsar y LUEGO recortar.
const L = (c) => `btrim(regexp_replace(${c}, '[[:space:]]+', ' ', 'g'))`;
const COLUMNAS = [
  ['medical_records.patients', 'first_name'],
  ['medical_records.patients', 'last_name'],
  ['public.bookings', 'patient_name'],
  ['public.bookings', 'patient_first_name'],
  ['public.bookings', 'patient_last_name'],
  ['public.appointment_form_links', 'patient_name'],
  ['public.reviews', 'patient_name'],
  ['public.review_links', 'patient_name'],
  ['practice_management.ledger_entries', 'counterparty_name'],
];

(async () => {
  let sucias = 0;
  try {
    for (const [tabla, col] of COLUMNAS) {
      const [r] = await prisma.$queryRawUnsafe(
        `SELECT count(*)::int AS total, count(*) FILTER (WHERE ${col} IS DISTINCT FROM ${L(col)})::int AS sucias,
                max(created_at) FILTER (WHERE ${col} IS DISTINCT FROM ${L(col)})::date::text AS ultima_sucia
           FROM ${tabla}`);
      sucias += r.sucias;
      console.log(`${r.sucias ? '✗' : '✓'} ${tabla}.${col}: ${r.sucias} de ${r.total}${r.ultima_sucia ? ` (la más reciente: ${r.ultima_sucia})` : ''}`);
    }
  } catch (e) {
    console.error('ERROR:', e.message);
    process.exitCode = 2;
  } finally {
    await prisma.$disconnect();
  }
  if (sucias > 0) {
    console.log(`\n${sucias} nombre(s) con espacios de más: algún camino no usa limpiarNombre.`);
    process.exitCode = 1;
  } else if (!process.exitCode) {
    console.log('\nTodos los nombres limpios.');
  }
})();
