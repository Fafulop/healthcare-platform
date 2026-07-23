/**
 * Mide EXACTO el prefijo estático del agente con `count_tokens` de Anthropic.
 *
 * Por qué existe: el ~24.7k que citan los docs es un TOPE estimado (se dedujo del piso de
 * `prompt_tokens` en `llm_token_usage`, que incluye mensaje + historial). El prefijo es el
 * número que gobierna el costo de CADA pregunta fría (baseline 2026-07-23: ~75% del costo
 * frío), así que la palanca de poda (lever 2b) necesita medirlo de verdad, no estimarlo —
 * y necesita saber QUÉ tool pesa cuánto para tener blancos concretos.
 *
 * `count_tokens` no consume tokens de generación (endpoint de conteo) y no toca la BD.
 *
 * Uso (desde apps/doctor):
 *   $vars = railway variables --service "@healthcare/doctor" --json | ConvertFrom-Json
 *   $env:ANTHROPIC_API_KEY = $vars.ANTHROPIC_API_KEY
 *   npx tsx scripts/measure-agent-prefix.ts            # resumen + top tools
 *   npx tsx scripts/measure-agent-prefix.ts --all      # además, las 39 tools
 *
 * Método: prefijo = count(system+tools+msg) - count(msg). El mensaje mínimo se resta para
 * no contar el overhead del envoltorio de la conversación.
 */

const API = 'https://api.anthropic.com/v1/messages/count_tokens';
const VERSION = '2023-06-01';

async function countTokens(
  apiKey: string,
  model: string,
  body: { system?: unknown; tools?: unknown[] }
): Promise<number> {
  const res = await fetch(API, {
    method: 'POST',
    headers: { 'x-api-key': apiKey, 'anthropic-version': VERSION, 'content-type': 'application/json' },
    body: JSON.stringify({
      model,
      messages: [{ role: 'user', content: 'x' }],
      ...body,
    }),
  });
  if (!res.ok) {
    throw new Error(`count_tokens ${res.status}: ${(await res.text().catch(() => '')).slice(0, 300)}`);
  }
  return ((await res.json()) as { input_tokens: number }).input_tokens;
}

async function main() {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    console.error('Falta ANTHROPIC_API_KEY (ver cabecera).');
    process.exit(1);
  }
  // Prisma se construye al importar el registry pero no consulta nada aquí; una URL
  // sintácticamente válida basta para que no truene la construcción.
  process.env.DATABASE_URL ||= 'postgresql://u:p@localhost:5432/none';

  const { STABLE_SYSTEM_PROMPT } = await import('../src/lib/agenda-agent/prompt');
  const { ALL_TOOLS, AGENT_MODULES } = await import('../src/lib/agenda-agent/modules/registry');
  const model = process.env.AGENDA_AGENT_MODEL || 'claude-sonnet-5';

  const stableBlock = [{ type: 'text', text: STABLE_SYSTEM_PROMPT }];

  const [baseline, sysOnly, toolsOnly, full] = await Promise.all([
    countTokens(apiKey, model, {}),
    countTokens(apiKey, model, { system: stableBlock }),
    countTokens(apiKey, model, { tools: ALL_TOOLS }),
    countTokens(apiKey, model, { system: stableBlock, tools: ALL_TOOLS }),
  ]);

  const prefix = full - baseline;
  const sys = sysOnly - baseline;
  const tools = toolsOnly - baseline;

  console.log(`\n═══ Prefijo estático del agente — MEDIDO (${model}) ═══`);
  console.log(`overhead del envoltorio (msg vacío) : ${baseline.toLocaleString()} tok  (restado de todo lo demás)`);
  console.log(`system prompt                       : ${sys.toLocaleString()} tok`);
  console.log(`tools (${ALL_TOOLS.length})                          : ${tools.toLocaleString()} tok`);
  console.log(`──────────────────────────────────────────────`);
  console.log(`PREFIJO TOTAL (system + tools)      : ${prefix.toLocaleString()} tok`);
  console.log(`  (system ${(sys / prefix * 100).toFixed(0)}% · tools ${(tools / prefix * 100).toFixed(0)}%)`);

  // Costo del prefijo por pregunta FRÍA: se escribe a caché a ×1.25 del precio de input base.
  const coldWrite = prefix * 1.25;
  for (const [name, base] of [['intro $2/M', 2], ['estándar $3/M', 3]] as const) {
    console.log(`  → escribirlo en una pregunta fría cuesta ${Math.round(coldWrite).toLocaleString()} budget ≈ $${(coldWrite * base / 1e6).toFixed(4)} (${name})`);
  }

  // Peso por TOOL. OJO: contar UNA tool incluye el overhead FIJO del bloque de tools, así que
  // la medición cruda viene inflada. Se despeja con las dos ecuaciones que ya tenemos:
  //   count([t_i]) - base = OH + w_i        (por tool)
  //   count(todas)  - base = OH + Σw_i      (juntas)
  // ⇒ Σ(crudo_i) - juntas = (n-1)·OH  ⇒  OH conocido  ⇒  w_i = crudo_i − OH.
  const rawPerTool: { name: string; raw: number }[] = [];
  for (const t of ALL_TOOLS) {
    rawPerTool.push({ name: t.name, raw: (await countTokens(apiKey, model, { tools: [t] })) - baseline });
  }
  const rawSum = rawPerTool.reduce((a, c) => a + c.raw, 0);
  const overhead = Math.round((rawSum - tools) / (rawPerTool.length - 1));
  const perTool = rawPerTool
    .map((t) => ({ name: t.name, tokens: t.raw - overhead }))
    .sort((a, b) => b.tokens - a.tokens);

  // Peso por MÓDULO: sus tools (netas) + su texto de prompt.
  console.log(`\n─── Peso por módulo (prompt del módulo + sus tools) ───`);
  const byName = new Map(perTool.map((t) => [t.name, t.tokens]));
  const perModule = await Promise.all(
    AGENT_MODULES.map(async (m: any) => {
      const names: string[] = [...(m.readTools ?? []), ...(m.proposalTools ?? [])].map((t: any) => t.name);
      const toolTokens = names.reduce((a, n) => a + (byName.get(n) ?? 0), 0);
      const text = [m.prompt?.domainModel ?? '', m.prompt?.domainRules ?? ''].filter(Boolean).join('\n\n');
      const promptTokens = text
        ? (await countTokens(apiKey, model, { system: [{ type: 'text', text }] })) - baseline
        : 0;
      return { name: m.name, nTools: names.length, toolTokens, promptTokens, total: toolTokens + promptTokens };
    })
  );
  perModule.sort((a, b) => b.total - a.total);
  for (const m of perModule) {
    const flag = m.total > 3000 ? '  ⚠️ sobre presupuesto (~2-3k)' : '';
    console.log(
      `  ${String(m.total).padStart(6)} tok  ${String(m.nTools).padStart(2)} tools` +
        `  (tools ${String(m.toolTokens).padStart(5)} + prompt ${String(m.promptTokens).padStart(4)})  ${m.name}${flag}`
    );
  }
  const modSum = perModule.reduce((a, c) => a + c.total, 0);
  console.log(`  suma de módulos: ${modSum.toLocaleString()} tok — el resto del prefijo (${(prefix - modSum).toLocaleString()}) es`);
  console.log(`  prompt COMPARTIDO (intro/resilience/reglas globales) + overhead del bloque de tools (${overhead}).`);

  // Peso por TOOL — los blancos concretos de la poda.
  console.log(`\n─── Tools más pesadas (blancos de poda; netas, sin el overhead de ${overhead}) ───`);
  const show = process.argv.includes('--all') ? perTool : perTool.slice(0, 10);
  for (const t of show) console.log(`  ${String(t.tokens).padStart(5)} tok  ${t.name}`);
  if (!process.argv.includes('--all')) {
    const rest = perTool.slice(10).reduce((a, c) => a + c.tokens, 0);
    console.log(`  … ${perTool.length - show.length} tools más suman ${rest.toLocaleString()} tok (--all para verlas).`);
  }
  console.log(`\n  Top-10 = ${perTool.slice(0, 10).reduce((a, c) => a + c.tokens, 0).toLocaleString()} tok de ${tools.toLocaleString()} en tools ` +
    `(${(perTool.slice(0, 10).reduce((a, c) => a + c.tokens, 0) / tools * 100).toFixed(0)}%).`);
  console.log();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

// Marca el archivo como MÓDULO (no script global): sin esto, `main`/`countTokens` chocan con
// los del eval runner — que tampoco tiene imports de nivel superior — y tsc truena con
// "Duplicate function implementation" (cazado por el type-check antes del commit).
export {};
