/**
 * Smoke test — flujo module query shapes vs PROD (READ-ONLY).
 * Run: railway run --service pgvector -- npx tsx scripts/flujo-smoke.ts
 * (DATABASE_PUBLIC_URL from pgvector service; only SELECTs — no writes.)
 * Scratch script for the F1 PR; not part of the app.
 */

(async () => {
  if (!process.env.DATABASE_PUBLIC_URL) {
    console.error('Falta DATABASE_PUBLIC_URL — corre con: railway run --service pgvector -- npx tsx scripts/flujo-smoke.ts');
    process.exit(1);
  }
  // prisma reads DATABASE_URL at construction — set it BEFORE importing the module.
  process.env.DATABASE_URL = process.env.DATABASE_PUBLIC_URL;
  const { flujoModule } = await import('../src/lib/agenda-agent/modules/flujo');

  const ctx = { doctorId: 'cmni1bov90000mk0lyeztr3ad', doctorSlug: 'dr-prueba' };

  async function run(name: string, input: Record<string, unknown>) {
    const t0 = Date.now();
    try {
      const out = await flujoModule.executeRead(ctx, name, input);
      const json = JSON.stringify(out);
      console.log(`\n=== ${name} ${JSON.stringify(input)} — ${Date.now() - t0}ms, ${json.length} bytes ===`);
      console.log(json.length > 3500 ? json.slice(0, 3500) + ' …[truncado]' : json);
    } catch (err) {
      console.log(`\n=== ${name} ${JSON.stringify(input)} — ERROR ===`);
      console.log(err);
      process.exitCode = 1;
    }
  }

  await run('get_flujo_status', {});
  await run('get_balance', {});
  await run('get_balance', { startDate: '2026-06-01', endDate: '2026-06-30' });
  await run('get_movimientos', { entryType: 'egreso', startDate: '2026-06-01', endDate: '2026-06-30' });
  await run('get_movimientos', { hasFactura: false, entryType: 'ingreso' });
  await run('get_movimientos', { search: 'EGR-2026-352' });
  await run('get_movimientos', { needsReview: true });
  await run('get_movimientos', { entryType: 'ingreso', estatusPago: 'POR_COBRAR' });
  await run('get_movimientos', { startDate: '2026-13-01' }); // impossible date → filter dropped, periodo echoes it
  await run('get_movimiento_detail', { internalId: 'EGR-2026-352' });
  await run('get_movimiento_detail', { internalId: 'egr-2026-353' }); // case-insensitive
  await run('get_movimiento_detail', { internalId: 'NO-EXISTE-999' }); // negative
  await run('get_conciliacion_bancaria', {});
  console.log('\nDone.');
  process.exit(process.exitCode ?? 0);
})();
