// T6a probe — runs add-ledger-tratamiento-id.sql TWICE inside ONE transaction that ALWAYS rolls
// back, and checks the column + index by full definition. Nothing is left in prod.
//   railway run --service pgvector node scripts/visitas/tratamientos-probe-t6a.cjs
// With `--aplicar`, runs it for real in a transaction that COMMITS only if every check passes.
const fs = require('fs');
const path = require('path');
const url = process.env.DATABASE_PUBLIC_URL || process.env.DATABASE_URL;
const { PrismaClient } = require(path.join(__dirname, '../../packages/database/node_modules/@prisma/client'));
const prisma = new PrismaClient({ datasources: { db: { url } } });
const APLICAR = process.argv.includes('--aplicar');
const SQL = fs.readFileSync(path.join(__dirname, '../../packages/database/prisma/migrations/add-ledger-tratamiento-id.sql'), 'utf8');
const stmts = SQL.split('\n').filter((l) => !l.trim().startsWith('--')).join('\n')
  .split(';').map((x) => x.trim()).filter(Boolean);

const ROLLBACK = new Error('ROLLBACK (intencional)');
const res = [];
const ok = (n, c, x = '') => res.push([n, !!c, x]);

(async () => {
  try {
    await prisma.$transaction(async (tx) => {
      const filasAntes = (await tx.$queryRawUnsafe(`SELECT count(*)::int n FROM practice_management.ledger_entries`))[0].n;
      for (const s of stmts) await tx.$executeRawUnsafe(s);
      if (!APLICAR) for (const s of stmts) await tx.$executeRawUnsafe(s); // idempotente
      ok(`SQL corrido (${stmts.length} sentencias${APLICAR ? '' : ', dos veces'})`, true);

      const col = await tx.$queryRawUnsafe(`SELECT data_type, is_nullable, column_default FROM information_schema.columns
        WHERE table_schema='practice_management' AND table_name='ledger_entries' AND column_name='tratamiento_id'`);
      ok('columna tratamiento_id TEXT NULL sin default', col.length === 1 && col[0].data_type === 'text'
        && col[0].is_nullable === 'YES' && col[0].column_default === null, JSON.stringify(col));

      const idx = await tx.$queryRawUnsafe(`SELECT indexdef FROM pg_indexes
        WHERE schemaname='practice_management' AND indexname='ledger_entries_doctor_id_tratamiento_id_idx'`);
      const def = idx[0]?.indexdef ?? '';
      ok('índice (doctor_id, tratamiento_id), no único ni parcial',
        /\(doctor_id, tratamiento_id\)$/.test(def) && !/UNIQUE/.test(def) && !/WHERE/.test(def), def);

      const filasDespues = (await tx.$queryRawUnsafe(`SELECT count(*)::int n FROM practice_management.ledger_entries`))[0].n;
      const conValor = (await tx.$queryRawUnsafe(`SELECT count(*)::int n FROM practice_management.ledger_entries WHERE tratamiento_id IS NOT NULL`))[0].n;
      ok('no se tocó ninguna fila', filasAntes === filasDespues && conValor === 0, `${filasAntes} filas, ${conValor} con valor`);

      // Prisma ve la columna (el cliente generado aún no: se lee por SQL).
      const n = (await tx.$queryRawUnsafe(`SELECT count(*)::int n FROM practice_management.ledger_entries WHERE doctor_id = 'x' AND tratamiento_id = 'y'`))[0].n;
      ok('consulta por (doctor_id, tratamiento_id) corre', n === 0);

      if (!APLICAR || res.some((r) => !r[1])) throw ROLLBACK;
    }, { timeout: 60000 });
  } catch (e) {
    if (e !== ROLLBACK) { console.log('ERROR:', e.message); process.exitCode = 1; }
  } finally {
    await prisma.$disconnect();
  }
  for (const [n, p, x] of res) console.log(`${p ? 'OK  ' : 'FAIL'} ${n}${x ? `  (${x})` : ''}`);
  const f = res.filter((r) => !r[1]).length;
  console.log(`\n${res.length - f}/${res.length} · ${APLICAR && !f ? 'APLICADO (commit)' : 'revertido'}`);
  if (f) process.exitCode = 1;
})();
