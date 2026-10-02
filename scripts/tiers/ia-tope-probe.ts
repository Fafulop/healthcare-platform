// TIERS P3 — el tope mensual de IA: corre las funciones REALES de apps/doctor/src/lib/ai/gasto-del-mes.ts
// contra prod en SÓLO LECTURA (no escribe nada).
// Correr (desde packages/database):
//   railway run --service pgvector sh -c 'DATABASE_URL="$DATABASE_PUBLIC_URL" npx tsx --tsconfig ../../apps/doctor/tsconfig.json ../../scripts/tiers/ia-tope-probe.ts'
import { prisma } from '@healthcare/database';
import {
  costoUsd, gastoDelMesUsd, inicioDelMesMexico, limiteDeIaAlcanzado, topeIaUsd,
} from '@/lib/ai/gasto-del-mes';

const res: [string, boolean, string?][] = [];
const ok = (n: string, c: boolean, x = '') => res.push([n, !!c, x]);

(async () => {
  // Fronteras del mes en hora de México (UTC−6).
  ok('1 oct 05:59 UTC (30 sep 23:59 en MX) → mes de SEPTIEMBRE',
    inicioDelMesMexico(new Date('2026-10-01T05:59:00Z')).toISOString() === '2026-09-01T06:00:00.000Z',
    inicioDelMesMexico(new Date('2026-10-01T05:59:00Z')).toISOString());
  ok('1 oct 06:00 UTC (1 oct 00:00 en MX) → mes de OCTUBRE',
    inicioDelMesMexico(new Date('2026-10-01T06:00:00Z')).toISOString() === '2026-10-01T06:00:00.000Z');

  // Topes por plan.
  ok('topes: FREE $1 · BASICO $2 · PRO y LAB sin tope · desconocido → $2',
    topeIaUsd('FREE') === 1 && topeIaUsd('BASICO') === 2 && topeIaUsd('PRO') === null && topeIaUsd('LAB') === null && topeIaUsd('RARO') === 2);

  // Costo por fila.
  ok('gpt-4o-mini: 10k entrada + 1k salida = $0.0021',
    Math.abs(costoUsd({ model: 'gpt-4o-mini', promptTokens: 10_000, completionTokens: 1_000, budgetTokens: null }) - 0.0021) < 1e-9);
  ok('Sonnet con budgetTokens 20k → $0.06 (20k × $3/M)',
    Math.abs(costoUsd({ model: 'claude-sonnet-5', promptTokens: 9_999, completionTokens: 9_999, budgetTokens: 20_000 }) - 0.06) < 1e-9);
  ok('modelo DESCONOCIDO → el precio más caro (no se salta el tope)',
    Math.abs(costoUsd({ model: 'modelo-nuevo', promptTokens: 1_000_000, completionTokens: 0, budgetTokens: null }) - 3) < 1e-9);

  // Contra prod: el doctor con más uso del armador de plantillas, en su mes de más uso.
  const filas = await prisma.llmTokenUsage.findMany({ where: { endpoint: 'form-builder-chat' }, select: { doctorId: true, createdAt: true } });
  const conteo = new Map<string, number>();
  for (const f of filas) {
    const k = `${f.doctorId}|${f.createdAt.toLocaleDateString('en-CA', { timeZone: 'America/Mexico_City' }).slice(0, 7)}`;
    conteo.set(k, (conteo.get(k) ?? 0) + 1);
  }
  const [masUso] = [...conteo.entries()].sort((a, b) => b[1] - a[1]);
  if (masUso) {
    const [doctorId, mes] = masUso[0].split('|');
    const enEseMes = new Date(`${mes}-15T12:00:00-06:00`);
    const gasto = await gastoDelMesUsd(doctorId, 'form-builder-chat', enEseMes);
    ok(`gasto real de ${mes} del doctor con más uso (${masUso[1]} mensajes)`, gasto > 0, `$${gasto.toFixed(4)}`);
  }
  // Este mes, para un doctor cualquiera con uso: la función de decisión corre.
  const algun = filas[0]?.doctorId;
  if (algun) {
    const r = await limiteDeIaAlcanzado(algun, 'FREE', 'form-builder-chat');
    ok('limiteDeIaAlcanzado corre (como FREE, este mes)', typeof r.alcanzado === 'boolean' && r.tope === 1, JSON.stringify(r));
    const sinTope = await limiteDeIaAlcanzado(algun, 'PRO', 'form-builder-chat');
    ok('PRO → nunca alcanzado, no consulta', sinTope.alcanzado === false && sinTope.gasto === null);
  }

  await prisma.$disconnect();
  for (const [n, p, x] of res) console.log(`${p ? 'OK  ' : 'FAIL'} ${n}${x ? `  (${x})` : ''}`);
  const f = res.filter((r) => !r[1]).length;
  console.log(`\n${res.length - f}/${res.length} · sólo lectura`);
  if (f) process.exitCode = 1;
})();
