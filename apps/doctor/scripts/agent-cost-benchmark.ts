/**
 * Benchmark de COSTO del agente — la "regla" que mide si un experimento de
 * optimización (TTL 1h, poda del prefijo, modelo más barato, cap semanal) de
 * verdad bajó el costo SIN romper la calidad.
 *
 * NO re-corre el loop ni pega a la API: es puro post-proceso del reporte que YA
 * escribió el eval runner (agenda-evals-last-run.json). Flujo:
 *
 *   1. railway run --service pgvector -- npx tsx scripts/agenda-agent-evals.ts
 *      → corre las 65 evals contra prod (read-only) y escribe el JSON con el
 *        desglose de tokens por caso (input/output/cacheRead/cacheWrite/budget).
 *   2. npx tsx scripts/agent-cost-benchmark.ts --label baseline
 *      → aplica la tabla de precios, calcula USD por caso + agregados, guarda un
 *        record comparable y AÑADE una fila al ledger. Imprime el delta vs la
 *        corrida anterior. Sin credenciales, instantáneo.
 *
 * Así el paso caro (correr las evals contra Anthropic) se hace UNA vez por
 * experimento y el análisis/comparación es gratis y re-ejecutable.
 *
 * Uso:
 *   npx tsx scripts/agent-cost-benchmark.ts [--label <txt>] [--price <key>]
 *                                           [--ttl <5m|1h>] [--in <archivo.json>]
 *
 * --label   nombre del experimento (baseline, ttl-1h, haiku, poda-prefijo…).
 * --price   clave de la tabla de precios (default: AGENDA_AGENT_MODEL o
 *           claude-sonnet-5). Para proyectar "¿y si fuera Haiku?" sobre los
 *           MISMOS tokens, pásalo — pero OJO: es aproximación (otro modelo
 *           produce otros conteos/caché; el número real sale corriendo ESE
 *           modelo). El costo REAL de la corrida usa el modelo que se corrió.
 *   --ttl     etiqueta informativa del TTL de caché con el que se corrió (no
 *             cambia el cálculo; documenta la config del experimento).
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync, appendFileSync } from 'fs';
import { join } from 'path';
import { execSync } from 'child_process';

// --- Tabla de precios (USD por 1M tokens) — de OPTIMIZACION COSTOS/00 §6. ---
// cacheWrite ≈ 1.25× input (regla de Anthropic); para proveedores con caché
// automática y sin precio de write publicado se aproxima a input. `estimate`
// marca las filas que salen de agregadores de terceros, no de página oficial.
interface Price {
  label: string;
  in: number;
  out: number;
  cacheRead: number;
  cacheWrite: number;
  estimate?: boolean;
}
const PRICES: Record<string, Price> = {
  'claude-sonnet-5': { label: 'Sonnet 5 (estándar $3/$15, desde 2026-09-01)', in: 3, out: 15, cacheRead: 0.3, cacheWrite: 3.75 },
  'claude-sonnet-5-intro': { label: 'Sonnet 5 (intro $2/$10, hasta 2026-08-31)', in: 2, out: 10, cacheRead: 0.2, cacheWrite: 2.5 },
  'claude-haiku-4-5': { label: 'Haiku 4.5 ($1/$5)', in: 1, out: 5, cacheRead: 0.1, cacheWrite: 1.25 },
  'kimi-k2.6': { label: 'Kimi K2.6 (Moonshot, ESTIMADO)', in: 0.6, out: 2.5, cacheRead: 0.15, cacheWrite: 0.6, estimate: true },
  'deepseek-v4-flash': { label: 'DeepSeek V4 Flash (ESTIMADO)', in: 0.14, out: 0.28, cacheRead: 0.0028, cacheWrite: 0.14, estimate: true },
};

interface Usage {
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheWriteTokens: number;
  budgetTokens: number;
}
interface CaseRecord {
  id: string;
  pass: boolean;
  soft: boolean;
  latencyMs?: number;
  usage?: Usage;
  tokens?: number;
  error?: string;
}

function arg(name: string, fallback = ''): string {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
}

/** USD de un turno: precia cada tramo por su tarifa. inputTokens = VOLUMEN total
 * (uncached + write + read); el uncached es lo que queda al restar los cacheados. */
function caseUsd(u: Usage, p: Price): number {
  const uncached = Math.max(0, u.inputTokens - u.cacheReadTokens - u.cacheWriteTokens);
  return (
    (uncached * p.in +
      u.cacheReadTokens * p.cacheRead +
      u.cacheWriteTokens * p.cacheWrite +
      u.outputTokens * p.out) /
    1_000_000
  );
}

function pct(v: number, arr: number[]): number {
  if (arr.length === 0) return 0;
  const s = [...arr].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.floor((v / 100) * s.length))];
}

function main() {
  const label = arg('label', 'sin-etiqueta');
  const priceKey = arg('price', process.env.AGENDA_AGENT_MODEL || 'claude-sonnet-5');
  const ttl = arg('ttl', '5m');
  const inFile = arg('in', 'agenda-evals-last-run.json');

  const price = PRICES[priceKey];
  if (!price) {
    console.error(`Precio desconocido "${priceKey}". Claves: ${Object.keys(PRICES).join(', ')}`);
    process.exit(1);
  }
  if (!existsSync(inFile)) {
    console.error(`No existe ${inFile}. Corre primero las evals:\n  railway run --service pgvector -- npx tsx scripts/agenda-agent-evals.ts`);
    process.exit(1);
  }

  const records: CaseRecord[] = JSON.parse(readFileSync(inFile, 'utf8'));
  const withUsage = records.filter((r) => r.usage && r.usage.inputTokens > 0);
  if (withUsage.length === 0) {
    console.error(`${inFile} no tiene desglose de tokens (usage). ¿Corriste el eval runner ACTUALIZADO (guarda usage por caso)?`);
    process.exit(1);
  }

  // --- Calidad (el X/Y autoritativo lo imprime el eval runner; esto lo reconstruye) ---
  const pass = records.filter((r) => r.pass).length;
  const fail = records.filter((r) => !r.pass && !r.soft).length;
  const warn = records.filter((r) => !r.pass && r.soft).length;

  // --- Costo ---
  const perCase = withUsage.map((r) => ({ id: r.id, usd: caseUsd(r.usage!, price), u: r.usage! }));
  const usds = perCase.map((c) => c.usd);
  const totalUsd = usds.reduce((a, b) => a + b, 0);
  const meanUsd = totalUsd / usds.length;
  const p50Usd = pct(50, usds);
  const p90Usd = pct(90, usds);
  const totalBudget = withUsage.reduce((a, r) => a + r.usage!.budgetTokens, 0);
  // "Pregunta fría" = la que más pagó cache-WRITE (escribió el prefijo desde cero).
  // Es el peor caso de costo por pregunta y el número que mueven TTL-1h y la poda.
  const coldCase = [...perCase].sort((a, b) => b.u.cacheWriteTokens - a.u.cacheWriteTokens)[0];
  const latencies = withUsage.map((r) => r.latencyMs ?? 0).filter((x) => x > 0);
  const p50Latency = pct(50, latencies);

  // Cross-check: budgetTokens está ponderado a precio Sonnet estándar ($3 base).
  const budgetUsdSonnetStd = (totalBudget * 3) / 1_000_000;

  const gitSha = (() => {
    try {
      return execSync('git rev-parse --short HEAD', { encoding: 'utf8' }).trim();
    } catch {
      return 'unknown';
    }
  })();
  const timestamp = new Date().toISOString();

  const record = {
    timestamp,
    label,
    priceKey,
    priceLabel: price.label + (price.estimate ? ' [ESTIMADO]' : ''),
    ttl,
    gitSha,
    inFile,
    quality: { pass, warn, fail, total: records.length },
    cost: {
      totalUsd,
      meanUsdPerCase: meanUsd,
      p50UsdPerCase: p50Usd,
      p90UsdPerCase: p90Usd,
      coldQuestionUsd: coldCase?.usd ?? 0,
      coldQuestionId: coldCase?.id ?? '',
      totalBudgetTokens: totalBudget,
      budgetUsdAtSonnetStd: budgetUsdSonnetStd,
      p50LatencyMs: p50Latency,
      nCasesPriced: withUsage.length,
    },
    perCase: perCase.map((c) => ({ id: c.id, usd: c.usd })),
  };

  // --- Persistencia: record por corrida + ledger append-only ---
  const outDir = join(
    process.cwd(),
    '..',
    '..',
    'docs',
    'DESDE JUNIO',
    'AGENTES',
    'OPTIMIZACION COSTOS',
    'benchmarks'
  );
  if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true });
  const safeLabel = label.replace(/[^a-z0-9-]/gi, '-');
  const recPath = join(outDir, `${timestamp.slice(0, 19).replace(/[:T]/g, '-')}-${safeLabel}.json`);
  writeFileSync(recPath, JSON.stringify(record, null, 2));

  const ledgerPath = join(outDir, 'ledger.csv');
  const header =
    'timestamp,label,priceKey,ttl,gitSha,total,pass,warn,fail,totalUsd,meanUsd,p50Usd,coldUsd,totalBudgetTokens,p50LatencyMs\n';
  const prevLedger = existsSync(ledgerPath) ? readFileSync(ledgerPath, 'utf8') : '';
  if (!prevLedger) writeFileSync(ledgerPath, header);
  // Strip commas/newlines from the label so it can't shift CSV columns (which
  // would also misalign the Δ parse below that reads fixed indices).
  const csvLabel = label.replace(/[,\r\n]/g, ' ');
  const row =
    [
      timestamp,
      csvLabel,
      priceKey,
      ttl,
      gitSha,
      records.length,
      pass,
      warn,
      fail,
      totalUsd.toFixed(5),
      meanUsd.toFixed(6),
      p50Usd.toFixed(6),
      (coldCase?.usd ?? 0).toFixed(6),
      totalBudget,
      p50Latency,
    ].join(',') + '\n';
  appendFileSync(ledgerPath, row);

  // --- Corrida anterior (última fila del ledger ANTES de este append) para el delta ---
  const prevRows = prevLedger
    .split('\n')
    .slice(1)
    .filter((l) => l.trim());
  const prev = prevRows.length ? prevRows[prevRows.length - 1].split(',') : null;

  // --- Reporte ---
  const usd = (n: number) => `$${n.toFixed(5)}`;
  console.log(`\n═══ Benchmark de costo — ${label} ═══`);
  console.log(`Modelo/precio : ${record.priceLabel} · TTL ${ttl} · git ${gitSha}`);
  console.log(`Calidad       : ${pass}/${records.length} PASS · ${warn} WARN · ${fail} FAIL`);
  console.log(`Costo total   : ${usd(totalUsd)}  (${withUsage.length} casos)`);
  console.log(`  media/caso  : ${usd(meanUsd)}   p50 ${usd(p50Usd)}   p90 ${usd(p90Usd)}`);
  console.log(`  pregunta fría: ${usd(coldCase?.usd ?? 0)}  (${coldCase?.id})`);
  console.log(`  budget tok  : ${totalBudget.toLocaleString()}  (≈ ${usd(budgetUsdSonnetStd)} a Sonnet std, cross-check)`);
  console.log(`  latencia p50: ${(p50Latency / 1000).toFixed(1)}s`);

  if (prev) {
    const [, pLabel, , , , , , , , pTotalUsd, pMeanUsd] = prev;
    const dTotal = totalUsd - Number(pTotalUsd);
    const dMean = meanUsd - Number(pMeanUsd);
    const pctChange = Number(pTotalUsd) > 0 ? (dTotal / Number(pTotalUsd)) * 100 : 0;
    console.log(`\nΔ vs corrida anterior ("${pLabel}"):`);
    console.log(
      `  costo total : ${usd(Number(pTotalUsd))} → ${usd(totalUsd)}  (${dTotal >= 0 ? '+' : ''}${pctChange.toFixed(1)}%)`
    );
    console.log(`  media/caso  : ${usd(Number(pMeanUsd))} → ${usd(meanUsd)}  (${dMean >= 0 ? '+' : ''}${usd(dMean)})`);
    console.log(`  (calidad: compara pass/warn/fail en ${ledgerPath})`);
  } else {
    console.log(`\n(primera corrida — es la BASELINE; las siguientes se comparan contra esta.)`);
  }

  console.log(`\nRecord  : ${recPath}`);
  console.log(`Ledger  : ${ledgerPath}\n`);
}

main();
