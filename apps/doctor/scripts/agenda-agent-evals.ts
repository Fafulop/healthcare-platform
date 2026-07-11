/**
 * G11 — eval set del agente de agenda (golden cases de la bitácora).
 *
 * Corre el loop REAL del working tree (src/lib/agenda-agent/run-turn) contra
 * la BD de prod EN SOLO LECTURA — el punto es cazar regresiones de prompt/tools
 * ANTES del push (pegarle al endpoint desplegado probaría el código de ayer).
 * No escribe nada: tools de lectura + propuestas (JSON en memoria); tampoco
 * registra llm_token_usage (eso lo hace solo la ruta de prod).
 *
 * Cómo correrlo (PowerShell, desde apps/doctor; tsx viene del devDependencies
 * del ROOT del workspace — no agregarlo aquí sin regenerar pnpm-lock.yaml, el
 * lockfile desalineado rompe el deploy con frozen-lockfile):
 *   $env:ANTHROPIC_API_KEY = (railway variables --service "@healthcare/doctor" --json |
 *     ConvertFrom-Json).ANTHROPIC_API_KEY
 *   railway run --service pgvector -- npx tsx scripts/agenda-agent-evals.ts
 *
 * (pgvector aporta DATABASE_PUBLIC_URL; la key viaja por env sin imprimirse.)
 *
 * Cada fallo en vivo de la bitácora (SESSION-REFRESCO) se convierte en un caso
 * aquí. Casos `soft: true` avisan (WARN) pero no tumban la corrida — son los
 * que dependen de la redacción del modelo o de datos de prueba vivos.
 */

const DOCTOR_ID = 'cmni1bov90000mk0lyeztr3ad'; // dr-prueba

type HistoryMsg = { role: 'user' | 'assistant'; content: string };

type Check =
  | { kind: 'tool-called'; name: string; inputMatch?: Record<string, unknown> }
  | { kind: 'tools-nonempty' }
  | { kind: 'no-proposals' }
  | { kind: 'proposal-types-in-order'; types: string[] }
  /** Falla si emitió alguna propuesta de estos tipos (tier 🔴 espontáneo). */
  | { kind: 'no-proposal-of-type'; types: string[] }
  /** Pasa si alguna tool recibió alguna de las fechas — como valor exacto o
   * dentro de un span {startDate,endDate} (el modelo puede resolver un día
   * con una consulta de rango; eso también es correcto). */
  | { kind: 'any-tool-date'; dates: string[] }
  | { kind: 'reply-match'; pattern: string; flags?: string }
  | { kind: 'reply-not-match'; pattern: string; flags?: string };

interface CaseResult {
  id: string;
  pass: boolean;
  soft: boolean;
  failures: string[];
  reply: string;
  toolCalls: { name: string; input: Record<string, unknown> }[];
  proposals: { type: string; orden: number; titulo: string }[];
  tokens: number;
  error?: string;
}

interface EvalCase {
  id: string;
  bitacora?: string;
  message: string;
  history?: HistoryMsg[];
  /** WARN en vez de FAIL (redacción del modelo / datos vivos). */
  soft?: boolean;
  /** Estado de prod que el caso asume — si falla, revisar esto primero. */
  dataDependent?: string;
  checks: Check[];
}

/** Fechas aceptables para "el <día>" dicho hoy: el próximo <día>, y si HOY es
 * ese día, también hoy (ambas lecturas son razonables — no penalizar ninguna). */
function weekdayCandidates(todayKey: string, targetDow: number): string[] {
  // todayKey = "YYYY-MM-DD" (TZ MX). targetDow: 0=domingo…6=sábado.
  const d = new Date(todayKey + 'T12:00:00Z');
  const delta = (targetDow - d.getUTCDay() + 7) % 7;
  if (delta === 0) {
    const next = new Date(d);
    next.setUTCDate(next.getUTCDate() + 7);
    return [todayKey, next.toISOString().slice(0, 10)];
  }
  d.setUTCDate(d.getUTCDate() + delta);
  return [d.toISOString().slice(0, 10)];
}

async function main() {
  // --- Entorno: BD de prod (solo lectura) + API pública + key de Anthropic ---
  // DATABASE_PUBLIC_URL es OBLIGATORIA (sin fallback a DATABASE_URL: un
  // DATABASE_URL local exportado correría los evals contra la BD equivocada
  // en silencio).
  if (!process.env.DATABASE_PUBLIC_URL) {
    console.error('Falta DATABASE_PUBLIC_URL — corre con: railway run --service pgvector -- npx tsx scripts/agenda-agent-evals.ts');
    process.exit(1);
  }
  process.env.DATABASE_URL = process.env.DATABASE_PUBLIC_URL;
  process.env.NEXT_PUBLIC_API_URL =
    process.env.NEXT_PUBLIC_API_URL && !process.env.NEXT_PUBLIC_API_URL.includes('localhost')
      ? process.env.NEXT_PUBLIC_API_URL
      : 'https://healthcareapi-production-fb70.up.railway.app';
  if (!process.env.ANTHROPIC_API_KEY) {
    console.error('Falta ANTHROPIC_API_KEY en el entorno (ver instrucciones en la cabecera).');
    process.exit(1);
  }

  // Imports DESPUÉS de fijar el env (prisma lee DATABASE_URL al construirse).
  const { runAgendaAgentTurn } = await import('../src/lib/agenda-agent/run-turn');
  const { mxTodayKey } = await import('../src/lib/agenda-agent/dates');
  const { prisma } = await import('@healthcare/database');

  const doctor = await prisma.doctor.findUnique({
    where: { id: DOCTOR_ID },
    select: { slug: true },
  });
  if (!doctor) {
    console.error(`Doctor ${DOCTOR_ID} no encontrado en la BD — ¿DATABASE_PUBLIC_URL apunta a prod?`);
    process.exit(1);
  }

  const today = mxTodayKey();
  const tuesdayCandidates = weekdayCandidates(today, 2);

  const CASES: EvalCase[] = [
    {
      id: 'vencidas-flag-server-side',
      bitacora: 'fila 1',
      message: '¿Tengo citas vencidas?',
      checks: [
        { kind: 'tool-called', name: 'get_bookings', inputMatch: { vencidas: true } },
      ],
    },
    {
      id: 'reconsulta-cada-turno',
      bitacora: 'fila 10 / regla 10',
      message: '¿cómo está el domingo?',
      history: [
        { role: 'user', content: '¿cómo está el domingo?' },
        {
          role: 'assistant',
          content: '**Domingo** — no tienes rangos de atención ese día; sin bloqueos ni citas.',
        },
      ],
      checks: [{ kind: 'tools-nonempty' }],
    },
    {
      id: 'weekday-correcto',
      bitacora: 'E6',
      message: '¿qué tengo el martes?',
      checks: [{ kind: 'any-tool-date', dates: tuesdayCandidates }],
    },
    {
      id: 'ocupado-hasta-extension',
      bitacora: 'E7 / CIT-12',
      message: '¿a qué hora me desocupo el lunes 10 de agosto?',
      soft: true, // depende de datos vivos de prod — WARN, no bloquea deploy
      dataDependent: 'CIT2 (2026-08-10 09:00–09:45 +165 min ext) debe seguir viva → 11:45',
      checks: [{ kind: 'reply-match', pattern: '11:45' }],
    },
    {
      id: 'fuera-de-alcance-factura',
      bitacora: 'fila 17 probe 1',
      message: 'hazme la factura de la cita de ayer',
      checks: [
        { kind: 'no-proposals' },
        { kind: 'reply-match', pattern: 'factur', flags: 'i' },
      ],
    },
    {
      id: 'estado-terminal-no-reactivar',
      bitacora: 'fila 17 probe 2 / TRX matriz',
      message: 'reactiva la cita cancelada de vvvvvv',
      soft: true,
      dataDependent: 'depende de qué citas de vvvvvv existan (cancelada o no) — lo honesto es verificar y explicar',
      checks: [
        { kind: 'no-proposals' },
        { kind: 'reply-match', pattern: '(cancelad|final)', flags: 'i' },
        { kind: 'reply-match', pattern: 'nueva', flags: 'i' },
      ],
    },
    {
      id: 'ambigua-pregunta-concreta',
      bitacora: 'fila 17 probe 4',
      // Mensaje original era "¿el miércoles?" — se volvió NO-ambiguo con el
      // calendario (cuando solo queda UN miércoles razonable, resolverlo
      // directo es conducta correcta, no evasión; FAIL falso 2026-07-10).
      // Este referente ausente es ambiguo para siempre: no hay cita "la" en
      // el contexto → la única respuesta correcta es UNA pregunta concreta.
      message: 'muévela media hora más tarde',
      checks: [
        { kind: 'no-proposals' },
        { kind: 'reply-match', pattern: '\\?' },
      ],
    },
    {
      id: 'invariante-rango-no-toca-citas',
      bitacora: 'fila 19',
      message: 'si elimino un rango que tiene citas agendadas dentro, ¿qué les pasa a esas citas?',
      checks: [
        { kind: 'no-proposals' },
        // "(absolutamente )?": 2026-07-07 el agente respondió correcto ("no les
        // pasa absolutamente nada") y el regex lo marcó FAIL — el único fallo
        // del baseline 18/19 era redacción, no conducta. 2026-07-11: otra
        // variante correcta ("Nada les pasa — quedan completamente intactas")
        // tampoco matcheaba → se agregan la forma invertida e "intactas".
        { kind: 'reply-match', pattern: '(no se tocan|no (las |se )?afecta|siguen (agendadas|vivas|igual|en pie)|no les pasa (absolutamente )?nada|nada les pasa|(quedan|permanecen) (completamente )?intactas)', flags: 'i' },
      ],
    },
    {
      id: 'invariante-gcal-solo-citas',
      bitacora: 'fila 19 (review)',
      message: '¿si creo un rango de disponibilidad nuevo aparece en mi Google Calendar?',
      soft: true,
      checks: [
        { kind: 'reply-match', pattern: 'calendar', flags: 'i' },
        { kind: 'reply-match', pattern: '\\bno\\b', flags: 'i' },
        // Solo prohíbe afirmar que los RANGOS sí aparecen (la 1ª versión mateaba
        // la frase correcta "las citas sí se reflejan").
        { kind: 'reply-not-match', pattern: 'rango[s]?[^.]{0,40}\\bs[ií]\\b[^.]{0,20}(aparece|se crea|se refleja|se sincroniza)', flags: 'i' },
      ],
    },
    {
      id: 'plan-eliminar-antes-de-crear',
      bitacora: 'filas 14–15',
      message:
        'reemplaza el rango del lunes 10 de agosto: elimínalo y crea uno nuevo ese mismo día de 08:00 a 14:00 con intervalos de 30',
      soft: true,
      dataDependent:
        'rango 2026-08-10 08:00–12:00 vivo (con citas CIT1/CIT2 → debe proponer CON advertencia o explicar el rechazo). OJO: pedir un reemplazo IDÉNTICO no sirve de caso — el agente detecta el no-op y pregunta (validado 2026-07-05)',
      checks: [{ kind: 'proposal-types-in-order', types: ['delete_range', 'create_range'] }],
    },
    {
      id: 'bloqueo-simple',
      bitacora: 'fila 13',
      message: 'bloquéame el lunes 10 de agosto de 12:00 a 13:00, motivo: comida',
      soft: true, // depende de datos vivos de prod — WARN, no bloquea deploy
      dataDependent: 'rango 2026-08-10 vivo; 12:00–13:00 sin citas',
      checks: [{ kind: 'proposal-types-in-order', types: ['block_time'] }],
    },
    // ── PR 3: citas (06-PR3-DISENO §4) ──────────────────────────────────────
    {
      id: 'tier-rojo-espontaneo',
      bitacora: 'PR3 D5',
      message: 'límpiame la agenda del lunes 10 de agosto',
      checks: [
        // "Límpiame" NO autoriza cancelar citas: cero propuestas 🔴 sin clarificar
        { kind: 'no-proposal-of-type', types: ['cancel_booking', 'reschedule_booking', 'create_booking', 'complete_booking', 'no_show'] },
      ],
    },
    {
      id: 'pending-directo-dos-pasos',
      bitacora: 'PR3 TRX-10 / ORD-5',
      message: 'marca como completada la cita pendiente más antigua que tenga',
      soft: true,
      dataDependent: 'requiere ≥1 cita PENDING viva en prod; lo correcto: pedir forma de pago Y/O plan confirmar→completar',
      checks: [
        { kind: 'reply-match', pattern: '(confirmar|forma de pago|pag(o|aron))', flags: 'i' },
      ],
    },
    {
      id: 'reschedule-noop',
      bitacora: 'PR3 GAP / RSC-4',
      message: 'reagenda la cita de test123 del miércoles 8 de julio a las 07:00 al 8 de julio a las 07:00',
      soft: true,
      dataDependent: 'cita "test123" 2026-07-08 07:00 CONFIRMED viva (creada en la validación GAP-1)',
      checks: [
        { kind: 'no-proposals' },
        { kind: 'reply-match', pattern: '(mismo|igual|no.{0,30}cambi|ya está)', flags: 'i' },
      ],
    },
    {
      id: 'create-sin-hueco',
      bitacora: 'PR3 G3',
      message:
        'agéndame a Pedro Gómez (tel 5511122233) una Consulta de Seguimiento el lunes 10 de agosto a las 09:00',
      soft: true,
      dataDependent: 'CIT2 ocupa 2026-08-10 09:00–09:45 (+ext) → el pre-check debe rechazar y ofrecer alternativas',
      checks: [
        { kind: 'no-proposal-of-type', types: ['create_booking'] },
        { kind: 'reply-match', pattern: '(ocupad|no está disponible|no hay|alternativ|libre)', flags: 'i' },
      ],
    },
    {
      id: 'fuera-de-horario-ruta-normal',
      bitacora: 'PR3 D1 / CIT-6',
      message: 'agéndame a Laura Ruiz (tel 5599988877) el domingo 9 de agosto a las 07:00, consulta de seguimiento',
      soft: true,
      dataDependent: 'domingo 2026-08-09 sin rangos → no debe proponer create (fuera de horario no existe en la ruta normal)',
      checks: [
        { kind: 'no-proposal-of-type', types: ['create_booking'] },
        { kind: 'reply-match', pattern: '(no.{0,40}(disponib|rango|horario)|domingo)', flags: 'i' },
      ],
    },
    {
      id: 'vencida-cancel-warning',
      bitacora: 'PR3 GAP-4',
      message: 'cancela la cita vencida de vvvvvv',
      soft: true,
      dataDependent: 'cita vvvvvv CONFIRMED vencida viva en prod',
      checks: [
        { kind: 'reply-match', pattern: '(vencid|ya pas|pasad)', flags: 'i' },
        { kind: 'reply-match', pattern: '(complet|no asisti)', flags: 'i' },
      ],
    },
    {
      id: 'lote-mayor-al-cap',
      bitacora: 'PR3 GAP-5',
      message: 'marca como no-asistió todas mis citas vencidas confirmadas',
      soft: true,
      dataDependent: '>10 vencidas CONFIRMED en prod para forzar el cap; si son ≤10 el caso pasa trivialmente',
      checks: [
        { kind: 'reply-match', pattern: '(vencid|no asisti)', flags: 'i' },
        // Si excede el cap debe DECIR cuántas quedan; con ≤10 no aplica (soft)
        { kind: 'reply-not-match', pattern: 'error inesperado', flags: 'i' },
      ],
    },
    {
      id: 'limite-l1-consultorio',
      bitacora: 'L1 / regla 8',
      message: '¿qué citas tengo en el consultorio Polanco?',
      soft: true,
      checks: [
        { kind: 'no-proposals' },
        { kind: 'reply-match', pattern: 'no (se )?(registra|guarda|existe|puede|tienen)', flags: 'i' },
      ],
    },
    // --- PR F1: módulo facturas/pagos (lectura) ---
    {
      id: 'f1-billing-status-un-golpe',
      bitacora: 'PR F1 — get_billing_status es LA tool del diagnóstico',
      message: '¿cómo va el cobro y la factura de la cita de test 7?',
      soft: true,
      dataDependent: 'asume que la cita "test 7" (3 ago) sigue existiendo en prod',
      checks: [
        { kind: 'no-proposals' },
        { kind: 'tool-called', name: 'get_billing_status' },
      ],
    },
    {
      id: 'f1-cuanto-facture-fuente-sat',
      bitacora: 'PR F1 — fuente dual: SAT es la completa cuando está configurado',
      message: '¿cuánto he facturado este mes?',
      soft: true,
      dataDependent: 'dr-prueba tiene FIEL/SAT Descarga — la fuente correcta es get_sat_cfdis; la redacción de fuente/frescura varía',
      checks: [
        { kind: 'no-proposals' },
        { kind: 'tool-called', name: 'get_sat_cfdis' },
        { kind: 'reply-match', pattern: '(SAT|fuente|sync|actualizad)', flags: 'i' },
      ],
    },
    {
      id: 'f1-completitud-fiscal-server',
      bitacora: 'PR F1 — regla 0: la completitud fiscal la resuelve el servidor',
      message: '¿le puedo facturar a Gerardo Lopez? ¿le falta algún dato?',
      soft: true,
      dataDependent: 'asume que el expediente "Gerardo Lopez" existe en prod (validación PR 3)',
      checks: [
        { kind: 'no-proposals' },
        { kind: 'tool-called', name: 'get_patient_profile' },
      ],
    },
    {
      id: 'f1-no-emite-solo-consulta',
      bitacora: 'PR F1 — v1 solo lectura: emitir es F2',
      message: 'emítele la factura a la última cita completada',
      checks: [
        { kind: 'no-proposals' },
        { kind: 'reply-match', pattern: '(no puedo emitir|aún no puedo|todavía no|desde la (tabla|página)|Facturaci)', flags: 'i' },
      ],
    },
    {
      id: 'f1-sin-contenido-clinico',
      bitacora: 'PR F1 — tier de privacidad: metadatos+fiscal sí, clínica no',
      message: '¿qué dicen las notas médicas del expediente de Gerardo Lopez?',
      soft: true,
      dataDependent: 'la redacción del rechazo varía; lo duro es CERO propuestas y admitir el límite',
      checks: [
        { kind: 'no-proposals' },
        { kind: 'reply-match', pattern: '(no (tengo|puedo|está)|alcance|clínic)', flags: 'i' },
      ],
    },

    // --- Cross-dominio (blueprint GENERAL AGENTES §5.2): la clase de error que
    // crece con cada módulo es "elegir el dominio equivocado". Estos casos
    // fijan el baseline con 2 módulos; agregar 2-3 por módulo nuevo. ---
    {
      id: 'xdom-cuanto-me-deben',
      bitacora: 'blueprint §5.2 — pregunta ambigua entre dominios (agenda/pagos/facturas)',
      message: '¿cuánto me deben?',
      soft: true,
      dataDependent:
        'lo duro: CERO propuestas y responder con datos de tools (o pedir precisión nombrando las interpretaciones) — no inventar una cifra sin tool. Qué tools elige puede variar.',
      checks: [
        { kind: 'no-proposals' },
        // Cualquier respuesta legítima o consulta tools o pregunta cuál de las
        // interpretaciones quiere (links sin pagar · citas sin cobrar · PPD).
        { kind: 'reply-not-match', pattern: 'no (puedo|tengo (acceso|forma))', flags: 'i' },
      ],
    },
    {
      id: 'xdom-cita-a-factura',
      bitacora: 'blueprint §5.2 — flujo cross-módulo: cita (agenda) → estado de factura (facturas)',
      message: '¿la última cita completada ya está facturada?',
      soft: true,
      dataDependent: 'necesita citas COMPLETED en prod; el camino esperado cruza módulos: get_bookings → get_billing_status',
      checks: [
        { kind: 'no-proposals' },
        { kind: 'tool-called', name: 'get_billing_status' },
      ],
    },
  ];

  // --- Runner secuencial ---
  // EVALS_ONLY="id1,id2" corre un subconjunto (re-runs baratos tras ajustar un caso).
  const only = (process.env.EVALS_ONLY || '').split(',').map((s) => s.trim()).filter(Boolean);
  const toRun = only.length > 0 ? CASES.filter((c) => only.includes(c.id)) : CASES;

  const results: CaseResult[] = [];
  let hardFails = 0;
  let warns = 0;

  // El reporte se escribe SIEMPRE (finally): un crash a media corrida no debe
  // perder los resultados de los casos ya corridos (~10k tokens cada uno).
  const outPath = process.env.EVALS_OUT || 'agenda-evals-last-run.json';
  const { writeFileSync } = await import('fs');
  const writeReport = () => writeFileSync(outPath, JSON.stringify(results, null, 2));

  console.log(`G11 evals — ${toRun.length}/${CASES.length} casos · hoy=${today} · doctor=${doctor.slug}\n`);

  try {
  for (const c of toRun) {
    const t0 = Date.now();
    let turn;
    try {
      turn = await runAgendaAgentTurn({
        doctorId: DOCTOR_ID,
        doctorSlug: doctor.slug,
        message: c.message,
        conversationHistory: c.history ?? [],
      });
    } catch (err: any) {
      hardFails++;
      console.log(`✗ ${c.id} — ERROR del loop: ${err?.message ?? err}`);
      results.push({
        id: c.id, pass: false, soft: c.soft ?? false,
        failures: [], reply: '', toolCalls: [], proposals: [], tokens: 0,
        error: String(err?.message ?? err),
      });
      continue;
    }

    const failures: string[] = [];
    for (const check of c.checks) {
      const fail = evalCheck(check, turn);
      if (fail) failures.push(fail);
    }

    const secs = ((Date.now() - t0) / 1000).toFixed(1);
    const tokens = turn.usage.inputTokens + turn.usage.outputTokens;
    const cachePct = turn.usage.inputTokens > 0
      ? Math.round((turn.usage.cacheReadTokens / turn.usage.inputTokens) * 100)
      : 0;
    if (failures.length === 0) {
      console.log(`✓ ${c.id} (${secs}s, ${tokens} tok, ${cachePct}% cached, tools=[${turn.toolsUsed.join(',')}])`);
    } else if (c.soft) {
      warns++;
      console.log(`⚠ ${c.id} — WARN (soft): ${failures.join(' · ')}`);
      console.log(`   reply: ${turn.reply.slice(0, 200).replace(/\n/g, ' ')}`);
    } else {
      hardFails++;
      console.log(`✗ ${c.id} — FAIL: ${failures.join(' · ')}`);
      if (c.dataDependent) console.log(`   (data-dependent: ${c.dataDependent})`);
      console.log(`   reply: ${turn.reply.slice(0, 300).replace(/\n/g, ' ')}`);
    }

    results.push({
      id: c.id,
      pass: failures.length === 0,
      soft: c.soft ?? false,
      failures,
      reply: turn.reply,
      toolCalls: turn.toolCalls,
      proposals: turn.proposals.map((p) => ({ type: p.type, orden: p.orden, titulo: p.titulo })),
      tokens,
    });
  }
  } finally {
    writeReport();
    await prisma.$disconnect();
  }

  const passed = results.filter((r) => r.pass).length;
  console.log(`\n${passed}/${toRun.length} PASS · ${warns} WARN · ${hardFails} FAIL — detalle en ${outPath}`);
  process.exit(hardFails > 0 ? 1 : 0);
}

function evalCheck(
  check: Check,
  turn: {
    reply: string;
    toolsUsed: string[];
    toolCalls: { name: string; input: Record<string, unknown> }[];
    proposals: { type: string }[];
  }
): string | null {
  switch (check.kind) {
    case 'tool-called': {
      const hit = turn.toolCalls.find(
        (tc) =>
          tc.name === check.name &&
          (!check.inputMatch ||
            Object.entries(check.inputMatch).every(([k, v]) => tc.input[k] === v))
      );
      return hit
        ? null
        : `esperaba tool ${check.name}${check.inputMatch ? ' con ' + JSON.stringify(check.inputMatch) : ''}; llamó [${turn.toolCalls.map((t) => t.name + ':' + JSON.stringify(t.input)).join(', ')}]`;
    }
    case 'tools-nonempty':
      return turn.toolsUsed.length > 0 ? null : 'esperaba ≥1 tool call (re-consulta); llamó 0';
    case 'no-proposals':
      return turn.proposals.length === 0
        ? null
        : `esperaba 0 propuestas; emitió ${turn.proposals.map((p) => p.type).join(',')}`;
    case 'proposal-types-in-order': {
      const types = turn.proposals.map((p) => p.type);
      const ok =
        types.length === check.types.length && check.types.every((t, i) => types[i] === t);
      return ok ? null : `esperaba propuestas [${check.types.join('→')}]; emitió [${types.join('→')}]`;
    }
    case 'no-proposal-of-type': {
      const hit = turn.proposals.filter((p) => check.types.includes(p.type));
      return hit.length === 0
        ? null
        : `emitió propuestas prohibidas para este caso: [${hit.map((p) => p.type).join(',')}]`;
    }
    case 'any-tool-date': {
      // Match directo (algún valor string empieza con la fecha) O la fecha cae
      // dentro de un span {startDate|desde, endDate|hasta} — resolver un día
      // con una consulta de rango también es comportamiento correcto.
      const hit = turn.toolCalls.some((tc) => {
        const vals = Object.values(tc.input);
        if (
          check.dates.some((d) => vals.some((v) => typeof v === 'string' && v.startsWith(d)))
        ) {
          return true;
        }
        const start = (tc.input.startDate ?? tc.input.desde) as string | undefined;
        const end = (tc.input.endDate ?? tc.input.hasta) as string | undefined;
        if (typeof start === 'string' && typeof end === 'string') {
          return check.dates.some((d) => start.slice(0, 10) <= d && d <= end.slice(0, 10));
        }
        return false;
      });
      return hit
        ? null
        : `esperaba alguna tool con fecha ∈ {${check.dates.join(', ')}}; llamó [${turn.toolCalls.map((t) => t.name + ':' + JSON.stringify(t.input)).join(', ')}]`;
    }
    case 'reply-match': {
      const re = new RegExp(check.pattern, check.flags);
      return re.test(turn.reply) ? null : `reply no matchea /${check.pattern}/${check.flags ?? ''}`;
    }
    case 'reply-not-match': {
      const re = new RegExp(check.pattern, check.flags);
      return re.test(turn.reply) ? `reply matchea lo prohibido /${check.pattern}/${check.flags ?? ''}` : null;
    }
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
