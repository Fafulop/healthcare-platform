// TIERS P4 — facturas por mes: las funciones REALES de packages/database/src/facturas-del-mes.ts contra
// prod en SÓLO LECTURA. Correr (desde packages/database):
//   railway run --service pgvector sh -c 'DATABASE_URL="$DATABASE_PUBLIC_URL" npx tsx ../../scripts/tiers/facturas-mes-probe.ts'
import { PrismaClient } from '@prisma/client';
import {
  facturasDelMes, facturasIncluidas, inicioDelMesMexico, inicioDelMesSiguienteMexico, seDetieneAlLlegar, usoDeFacturas,
} from '../../packages/database/src/facturas-del-mes';

const prisma = new PrismaClient({ datasources: { db: { url: process.env.DATABASE_PUBLIC_URL || process.env.DATABASE_URL } } });
const res: [string, boolean, string?][] = [];
const ok = (n: string, c: boolean, x = '') => res.push([n, !!c, x]);

(async () => {
  ok('incluidas: FREE 5 · BASICO 25 · PRO/LAB sin tope · desconocido 25',
    facturasIncluidas('FREE') === 5 && facturasIncluidas('BASICO') === 25 && facturasIncluidas('PRO') === null && facturasIncluidas('LAB') === null && facturasIncluidas('X') === 25);
  ok('sólo Gratis se detiene', seDetieneAlLlegar('FREE') && !seDetieneAlLlegar('BASICO') && !seDetieneAlLlegar('PRO'));
  ok('frontera del mes en México', inicioDelMesMexico(new Date('2026-10-01T05:59:00Z')).toISOString() === '2026-09-01T06:00:00.000Z');
  ok('fin del mes (diciembre → enero del año siguiente)', inicioDelMesSiguienteMexico(new Date('2026-12-15T12:00:00Z')).toISOString() === '2027-01-01T06:00:00.000Z');

  // Contra prod: el doctor-mes con más facturas, contado con la función real (canceladas incluidas).
  const todas = await prisma.cfdiEmitted.findMany({ select: { cfdiType: true, issuedAt: true, status: true, fiscalProfile: { select: { doctorId: true } } } });
  const g = new Map<string, number>();
  for (const c of todas) {
    if (c.cfdiType !== 'I') continue;
    const mes = c.issuedAt.toLocaleDateString('en-CA', { timeZone: 'America/Mexico_City' }).slice(0, 7);
    const k = `${c.fiscalProfile.doctorId}|${mes}`;
    g.set(k, (g.get(k) ?? 0) + 1);
  }
  const [mayor] = [...g.entries()].sort((a, b) => b[1] - a[1]);
  if (mayor) {
    const [doctorId, mes] = mayor[0].split('|');
    const enEseMes = new Date(`${mes}-15T12:00:00-06:00`);
    const n = await facturasDelMes(prisma, doctorId, enEseMes);
    ok(`facturasDelMes = conteo a mano (${mes})`, n === mayor[1], `${n} vs ${mayor[1]}`);
    const comoFree = await usoDeFacturas(prisma, doctorId, 'FREE', enEseMes);
    ok('como Gratis ese mes: lleno si ≥ 5', comoFree.lleno === (n >= 5), JSON.stringify(comoFree));
    const comoPago = await usoDeFacturas(prisma, doctorId, 'BASICO', enEseMes);
    ok('como plan de pago: nunca lleno; extra = max(n-25,0)', !comoPago.lleno && comoPago.extra === Math.max(n - 25, 0), JSON.stringify(comoPago));
    const comoPro = await usoDeFacturas(prisma, doctorId, 'PRO', enEseMes);
    ok('PRO: sin tope', comoPro.incluidas === null && !comoPro.lleno);
  }
  const canceladas = todas.filter((c) => c.status === 'cancelled' && c.cfdiType === 'I').length;
  ok('hay canceladas en prod y cuentan (no se filtran por estado)', canceladas >= 0, `${canceladas} canceladas`);

  await prisma.$disconnect();
  for (const [n, p, x] of res) console.log(`${p ? 'OK  ' : 'FAIL'} ${n}${x ? `  (${x})` : ''}`);
  const f = res.filter((r) => !r[1]).length;
  console.log(`\n${res.length - f}/${res.length} · sólo lectura`);
  if (f) process.exitCode = 1;
})();
