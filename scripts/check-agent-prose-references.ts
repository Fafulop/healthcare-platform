/**
 * GATE: la prosa de un módulo nunca debe enrutar a una tool que ESE usuario no
 * tiene (TIERS T3 — docs/DESDE JUNIO/TIERS/01-DISENO-tecnico.md §11.5 / §11.5.1).
 *
 * POR QUÉ EXISTE. El agente compone su prompt por módulos, pero la prosa de un
 * módulo cross-referencia tools de OTROS ("datos fiscales = get_patient_profile",
 * "los gastos del día a día viven en get_balance/get_movimientos"). Cuando un
 * recorte —toggles de member o tier de la cuenta— deja fuera el módulo dueño de
 * esa tool, el texto sobrevive y le dice al modelo que la respuesta está en un
 * lugar al que NO puede ir. El modelo no declina: **improvisa** con la tool más
 * parecida que sí tiene. Eso ya produjo un bug real y medido (§11.5.1: el
 * desempate de `fiscal` apuntaba al ledger ausente ⇒ el agente contestaba
 * "¿cuánto me quedó este mes?" con base de efectivo del SAT, cifra de OTRA cosa,
 * con confianza y sin avisar).
 *
 * Los fixes de ese bug —`prompt.partial` + `prompt.prosaDependsOn`— arreglan las
 * INSTANCIAS conocidas. Este gate cierra la CATEGORÍA: cualquier cross-reference
 * NUEVA que no esté declarada o exenta truena el build, en vez de esperar a que
 * alguien la note en producción.
 *
 * CÓMO. No adivina ni parsea a ojo: enumera los scopes ALCANZABLES (cada
 * combinación de módulos concedibles × cada tier conocido), los resuelve con el
 * resolver REAL (`resolveAgentScope`) y, para cada módulo que sobrevive, lee la
 * prosa que el composer REAL le daría (`sectionsFor`, respetando la variante
 * `partial`). Toda tool nombrada ahí debe estar en el toolset de ese scope.
 *
 * FUERA DE ALCANCE, a propósito: las secciones COMPARTIDAS del prompt
 * (INTRO/RESILIENCE/RULES…). Enumeran las 9 capacidades y son byte-congeladas
 * para el dueño (gate:prompt); neutralizarlas es trabajo de las notas de alcance
 * (tradeoff de PR C, NUEVOS USUARIOS 01-DISENO §13). Exigir su ausencia aquí
 * contradiría la identidad de bytes.
 *
 * Run: pnpm exec tsx scripts/check-agent-prose-references.ts
 */
import { DOCTOR_TIERS, AGENT_MODULE_REQUIREMENTS, type PermissionKey } from '@healthcare/database';
import {
  AGENT_MODULES,
  ALL_TOOLS,
  resolveAgentScope,
} from '../apps/doctor/src/lib/agenda-agent/modules/registry';
import { sectionsFor, STABLE_SYSTEM_PROMPT } from '../apps/doctor/src/lib/agenda-agent/prompt';

/**
 * Cross-references TOLERADAS hoy, con su razón. Cada entrada es DEUDA VISIBLE:
 * la prosa menciona una tool que ese usuario podría no tener. Se permiten solo
 * cuando quitarlas costaría más de lo que valen (una variante `partial` por cada
 * combinación de dependencias ausentes) y el daño es una pista de ruteo perdida,
 * NO una cifra inventada.
 *
 * ⚠️ Antes de agregar una entrada: pregúntate si el modelo podría CONTESTAR con
 * otra cosa en vez de declinar. Si puede, no es exención — es el bug de §11.5.1
 * y necesita `prosaDependsOn` + variante.
 */
const ALLOWED: { module: string; tool: string; reason: string }[] = [
  {
    module: 'facturas',
    tool: 'get_movimientos',
    reason:
      '"¿quién me debe?" tiene TRES lecturas y esta es una de ellas. Sin el módulo flujo el modelo pierde una alternativa que ofrecer, pero las otras dos que nombra (get_ppd_cobranza, get_pendientes_factura) SÍ están: no se queda sin respuesta ni la inventa. Una variante `partial` por esta sola frase chocaría con la variante pagos-only que el tier ya usa.',
  },
  {
    module: 'facturas',
    tool: 'get_ppd_cobranza',
    reason:
      'Tool del módulo `fiscal`, que requiere EXACTAMENTE las mismas keys que `facturas` (facturacion+sat): por construcción aparecen y desaparecen JUNTOS. Inalcanzable que falte estando facturas presente.',
  },
  {
    module: 'fiscal',
    tool: 'get_sat_cfdis',
    reason:
      'Simétrico al anterior: tool de `facturas`, mismas keys que `fiscal`. Siempre co-presentes por construcción.',
  },
  // ——— facturas → agenda. Un member puede tener `facturacion`+`sat` sin `citas`.
  // En TODOS estos el modelo pierde de dónde SACAR un dato (bookingId, paciente),
  // así que tiene que PREGUNTARLE al doctor: no puede inventarse una factura,
  // porque propose_create_cfdi exige un ledgerEntryId que sale de un tool real y
  // el servidor lo valida. Degradación, no fabricación.
  {
    module: 'facturas',
    tool: 'propose_complete_booking',
    reason:
      'Ruta "cita sin completar ⇒ complétala primero y factura en el turno siguiente". Sin el módulo agenda el consejo sigue siendo CORRECTO, solo que no puede ejecutarlo él — igual que cualquier límite de alcance. No produce una factura equivocada.',
  },
  {
    module: 'facturas',
    tool: 'get_bookings',
    reason:
      'Fuente del bookingId en la descripción de get_billing_status. Sin agenda el modelo no puede resolverlo solo y tiene que pedírselo al doctor; el tool falla limpio sin id válido.',
  },
  {
    module: 'facturas',
    tool: 'get_day_schedule',
    reason: 'Misma frase y mismo razonamiento que get_bookings.',
  },
  {
    module: 'facturas',
    tool: 'find_patient',
    reason:
      'Fuente de identidad del paciente. Sin agenda, get_patient_profile/get_billing_status quedan menos usables, pero el receptor de un CFDI SIEMPRE sale del expediente validado server-side — nunca del texto del chat.',
  },
  {
    module: 'agenda',
    tool: 'Flujo de Dinero',
    reason:
      'FALSO POSITIVO del heurístico, conservado a propósito: "El ingreso se registra EN Flujo de Dinero automáticamente" NO es un redirect, es un HECHO — y sigue siendo cierto para un member sin `flujo`, porque el ingreso es efecto SERVER-SIDE de completar la cita (NUEVOS USUARIOS 01-DISENO §17; confirmado en prod: 6 completaciones, cero writes de `flujo` en member_audit_log). Que el modelo lo sepa es correcto: si lo calláramos, diría que el ingreso no se registró. La cue "se registra en" queda en el patrón porque atrapa redirects reales en otras frases.',
  },
  {
    module: 'expediente',
    tool: 'find_patient',
    reason:
      'El patientId de get_expediente_resumen sale de find_patient (módulo agenda). Un member con `expedientes` sin `citas` tiene que pedirle el paciente al doctor; el tool exige un patientId real y falla limpio sin él. Degradación de usabilidad, no dato inventado.',
  },
];

const isAllowed = (module: string, tool: string) =>
  ALLOWED.some((a) => a.module === module && a.tool === tool);

/**
 * SEGUNDA CLASE — referencias a una SECCIÓN/FUNCIÓN de la plataforma, no a una
 * tool. El chequeo de tools de arriba NO las ve, y ahí vivían los peores
 * hallazgos de la sesión: "la factura se emite desde la tabla de citas",
 * "entra a Flujo de Dinero en el menú lateral". Mandar al doctor a una sección
 * que sus permisos o su plan bloquean es PEOR que perder una pista de ruteo:
 * choca con una puerta cerrada y parece que el producto está roto.
 *
 * Solo dispara con una PISTA DE RUTEO delante ("en la página X", "desde X",
 * "entra a X"): nombrar una función para NEGARLA ("no tienes conciliación
 * bancaria") es correcto y honesto — lo que se persigue es el redirect.
 */
const ROUTING_CUE = String.raw`(?:en (?:la|el|tu) (?:p[áa]gina|secci[óo]n|pesta[ñn]a|men[úu])|(?:entra|ve|accede|dir[íi]gete|mándalo|m[áa]ndalo)\s+a|se (?:emite|hace|registra|gestiona)n?\s+(?:desde|en)|desde (?:la|el) (?:p[áa]gina|secci[óo]n|pesta[ñn]a|tabla))`;

const FEATURE_PHRASES: { key: PermissionKey; label: string; pattern: string }[] = [
  { key: 'facturacion', label: 'Facturación', pattern: String.raw`Facturaci[óo]n|Nueva Factura` },
  { key: 'sat', label: 'Descarga SAT', pattern: String.raw`SAT\s*Descarga|Descarga\s*SAT|Declaraciones|Deducciones` },
  { key: 'conciliacion', label: 'Conciliación Bancaria', pattern: String.raw`Conciliaci[óo]n\s*Bancaria` },
  { key: 'flujo', label: 'Flujo de Dinero', pattern: String.raw`Flujo\s*de\s*Dinero` },
  // `expediente` a secas cuenta: el nombre de la sección casi nunca se escribe
  // completo en la prosa ("se emite desde el EXPEDIENTE del paciente"), así que
  // exigir "Expedientes Médicos" dejaba pasar el redirect real. Con el patrón
  // viejo, un cross-reference de agenda→expediente en 12 de los 66 scopes pasó
  // el gate sin ruido (plan 07, punto A). El ROUTING_CUE sigue mandando: nombrar
  // el expediente sin mandar a nadie ahí ("el receptor sale del expediente") no
  // dispara.
  { key: 'expedientes', label: 'Expedientes Médicos', pattern: String.raw`Expedientes\s*M[ée]dicos|expediente` },
  { key: 'pagos', label: 'Pagos', pattern: String.raw`Pagos` },
];

/** Feature sections a chunk of prose ROUTES the doctor to. */
function featuresRoutedIn(text: string | undefined): { key: PermissionKey; label: string; snippet: string }[] {
  if (!text) return [];
  const out: { key: PermissionKey; label: string; snippet: string }[] = [];
  for (const f of FEATURE_PHRASES) {
    const re = new RegExp(`${ROUTING_CUE}[^.\\n]{0,40}?(?:${f.pattern})`, 'gi');
    const m = text.match(re);
    if (m) out.push({ key: f.key, label: f.label, snippet: m[0].replace(/\s+/g, ' ').trim() });
  }
  return out;
}

const TOOL_NAME_RE = /\b(?:get|propose|search|find)_[a-z0-9_]+\b/g;
const REAL_TOOLS = new Set(ALL_TOOLS.map((t) => t.name));

/** Tool names named in a chunk of prose — solo nombres que existen de verdad
 * (así una frase como "get_algo_que_no_existe" no genera ruido; el gate de
 * identidad ya cubre nombres inventados en otros ejes). */
function toolsNamedIn(text: string | undefined): string[] {
  if (!text) return [];
  return [...new Set(text.match(TOOL_NAME_RE) ?? [])].filter((n) => REAL_TOOLS.has(n));
}

/** Todo subconjunto de módulos, expresado como el set de toggles que lo concede.
 * Conceder la unión puede habilitar MÁS módulos de los pedidos (facturacion+sat
 * prende facturas Y fiscal) — da igual: lo que se evalúa es el scope RESUELTO. */
function toggleCombos(): { label: string; permissions: Record<string, boolean> }[] {
  const names = AGENT_MODULES.map((m) => m.name);
  const out: { label: string; permissions: Record<string, boolean> }[] = [];
  for (let mask = 0; mask < 1 << names.length; mask++) {
    const chosen = names.filter((_, i) => mask & (1 << i));
    const permissions: Record<string, boolean> = {};
    for (const n of chosen) {
      for (const k of AGENT_MODULE_REQUIREMENTS[n] ?? []) permissions[k as string] = true;
    }
    out.push({ label: chosen.length ? chosen.join('+') : '(sin módulos)', permissions });
  }
  return out;
}

interface Violation {
  scope: string;
  module: string;
  tool: string;
  where: string;
}

const violations: Violation[] = [];
let scopesChecked = 0;

function checkScope(label: string, scope: ReturnType<typeof resolveAgentScope>) {
  scopesChecked++;
  const present = new Set(scope.tools.map((t) => t.name));

  for (const m of scope.modules) {
    const sections = sectionsFor(m, scope);
    const own = new Set([...m.readTools, ...m.proposalTools].map((t) => t.name));

    const spots: [string, string | undefined][] = [
      ['domainModel', sections.domainModel],
      ['domainRules', sections.domainRules],
      // Las DESCRIPCIONES viajan en el mismo prefijo y afirman lo mismo que la
      // prosa — se revisan igual (ahí vivían 2 de los 6 sitios del bug hunt).
      ...scope.tools
        .filter((t) => own.has(t.name))
        .map((t) => [`descripción de ${t.name}`, t.description] as [string, string | undefined]),
    ];

    for (const [where, text] of spots) {
      for (const tool of toolsNamedIn(text)) {
        if (present.has(tool)) continue;
        if (isAllowed(m.name, tool)) continue;
        violations.push({ scope: label, module: m.name, tool, where });
      }
      // Segunda clase: redirects a una SECCIÓN que este usuario no puede abrir.
      for (const f of featuresRoutedIn(text)) {
        if (scope.providedKeys.has(f.key)) continue;
        if (isAllowed(m.name, f.label)) continue;
        violations.push({
          scope: label,
          module: m.name,
          tool: `sección "${f.label}"`,
          where: `${where} — "${f.snippet}"`,
        });
      }
    }
  }
}

/**
 * TERCERA CLASE — prosa que nombra una tool que NO EXISTE EN NINGÚN SCOPE.
 *
 * `toolsNamedIn` filtra a propósito por `REAL_TOOLS` para no gritar ante nombres
 * ilustrativos, pero ese filtro tiene un punto ciego caro: al ELIMINAR una tool,
 * todas las frases que la nombraban dejan de existir para el gate y pasan en
 * silencio — justo el momento de máximo riesgo de #26/#27, donde el modelo no
 * declina sino que improvisa con la tool más parecida.
 *
 * Se cazó a mano el 2026-08-05 al quitar `get_availability`: dos DESCRIPCIONES
 * (`propose_create_booking` y `propose_reschedule_booking`) seguían diciendo "el
 * horario debe salir de get_availability de ESTE turno" y `gate:prosa` pasó
 * verde.
 *
 * Cubre TRES fuentes, y las secciones COMPARTIDAS son obligatorias: la regla 2 de
 * `RULES` (en prompt.ts, no en ningún módulo) era otro de los sitios que había que
 * arreglar a mano. `STABLE_SYSTEM_PROMPT` es el prompt del dueño ya compuesto, así
 * que INTRO / RESILIENCE / HOW_TO_PROPOSE / RULES entran enteras por ahí; las
 * variantes `partial` de cada módulo se suman aparte porque NO viajan en él.
 */
const ghosts: { where: string; name: string }[] = [];
{
  const full = resolveAgentScope({ isOwner: true, permissions: null, tier: 'FULL' });
  const corpus: [string, string | undefined][] = [
    ['prompt compartido (STABLE_SYSTEM_PROMPT)', STABLE_SYSTEM_PROMPT],
  ];
  for (const m of full.modules) {
    const s = sectionsFor(m, full);
    corpus.push([`${m.name}.domainModel`, s.domainModel], [`${m.name}.domainRules`, s.domainRules]);
    // Las variantes recortadas no están en STABLE_SYSTEM_PROMPT.
    corpus.push(
      [`${m.name}.partial.domainModel`, m.prompt.partial?.domainModel],
      [`${m.name}.partial.domainRules`, m.prompt.partial?.domainRules]
    );
  }
  for (const t of ALL_TOOLS) corpus.push([`descripción de ${t.name}`, t.description]);
  for (const [where, text] of corpus) {
    for (const n of new Set(text?.match(TOOL_NAME_RE) ?? [])) {
      if (!REAL_TOOLS.has(n)) ghosts.push({ where, name: n });
    }
  }
}
if (ghosts.length > 0) {
  console.log('\nFALLA — prosa que nombra tools INEXISTENTES (¿se eliminó una tool y quedó su prosa?)');
  for (const g of ghosts) console.log(`  ${g.where}: ${g.name}`);
} else {
  console.log('OK   ninguna prosa nombra una tool inexistente (cubre el borrado de tools)');
}

for (const tier of DOCTOR_TIERS) {
  checkScope(`owner · ${tier}`, resolveAgentScope({ isOwner: true, permissions: null, tier }));
  for (const combo of toggleCombos()) {
    checkScope(
      `member{${combo.label}} · ${tier}`,
      resolveAgentScope({ isOwner: false, permissions: combo.permissions, tier })
    );
  }
}

// Una exención que ya no corresponde a nada es ruido que oculta deuda real.
const staleAllowed = ALLOWED.filter(
  (a) =>
    !AGENT_MODULES.some((m) => m.name === a.module) ||
    // las exenciones de SECCIÓN se identifican por etiqueta, no por tool real
    (!REAL_TOOLS.has(a.tool) && !FEATURE_PHRASES.some((f) => f.label === a.tool))
);

console.log(`Gate de referencias cruzadas en prosa — ${scopesChecked} scopes revisados\n`);

if (staleAllowed.length) {
  for (const a of staleAllowed) {
    console.log(`FAIL exención obsoleta: ${a.module} → ${a.tool} (ya no existen)`);
  }
}

if (violations.length === 0) {
  console.log(`OK   ninguna prosa enruta a una tool ausente de su scope`);
  console.log(`     (${ALLOWED.length} cross-references toleradas explícitamente — ver ALLOWED)`);
} else {
  // Un mismo defecto aparece en decenas de scopes; agrupar para que el mensaje
  // señale el ARREGLO (una prosa) y no el síntoma repetido.
  const grouped = new Map<string, Violation[]>();
  for (const v of violations) {
    const key = `${v.module} → ${v.tool}`;
    grouped.set(key, [...(grouped.get(key) ?? []), v]);
  }
  for (const [key, vs] of grouped) {
    console.log(`FAIL ${key}`);
    console.log(`       en: ${[...new Set(vs.map((v) => v.where))].join(' · ')}`);
    console.log(`       p.ej. scope: ${vs[0].scope}  (+${vs.length - 1} más)`);
    console.log(
      `       arréglalo con prompt.prosaDependsOn + variante partial, o añádelo a ALLOWED con su razón.`
    );
  }
}

const failed = violations.length > 0 || staleAllowed.length > 0 || ghosts.length > 0;
console.log(failed ? `\n${grouped_count(violations)} cross-reference(s) sin declarar.` : '\nAll checks passed.');
function grouped_count(vs: Violation[]) {
  return new Set(vs.map((v) => `${v.module}→${v.tool}`)).size;
}
process.exit(failed ? 1 : 0);
