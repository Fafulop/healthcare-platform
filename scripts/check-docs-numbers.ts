/**
 * Docs gate: the numbers declared in the DESDE JUNIO documentation must match the CODE.
 * Covers the two sibling feature folders: AGENTES/ and NUEVOS USUARIOS/.
 *
 * Why this exists: docs/DESDE JUNIO/AGENTES/ drifted for ~3 weeks because tool/eval
 * counts were hand-copied between 40+ docs. The worst case was the eval suite size
 * being recorded as 62 (the PASS count of a 62/65 run) instead of 65 — in BOTH of the
 * docs that are supposed to be authoritative. This gate makes that class of error
 * impossible to commit unnoticed.
 *
 * Contract: exactly ONE doc per number is allowed to declare it in the present tense
 * (see GENERAL AGENTES/07-CONVENCIONES-docs.md §2). Those docs carry machine-readable
 * markers that this script compares against the code:
 *
 *     <!-- gate:tools=39 -->            02-CAPACIDADES §4   vs ALL_TOOLS.length
 *     <!-- gate:modules=5 -->           02-CAPACIDADES §4   vs AGENT_MODULES
 *     <!-- gate:evals=65 -->            02-CAPACIDADES §4   vs agenda-agent-evals.ts
 *     <!-- gate:module-list=... -->     02-CAPACIDADES §4   vs AGENT_MODULES names
 *     <!-- gate:toggles=19 -->          05-COBERTURA        vs PERMISSION_KEYS.length
 *
 * We check exact tokens rather than parsing prose on purpose: a gate that fuzzy-matches
 * sentences becomes its own maintenance burden.
 *
 * Run: pnpm gate:docs
 */
import { readFileSync } from 'fs';
import { join } from 'path';
import { AGENT_MODULES, ALL_TOOLS, AGENT_MODULE_REQUIREMENTS } from '../apps/doctor/src/lib/agenda-agent/modules/registry';
import { PERMISSION_KEYS } from '../packages/database/src/permissions';

const REPO = join(__dirname, '..');
const CAPACIDADES = join(REPO, 'docs/DESDE JUNIO/AGENTES/GENERAL AGENTES/02-CAPACIDADES-matriz-que-puede-y-que-no.md');
const EVALS = join(REPO, 'apps/doctor/scripts/agenda-agent-evals.ts');
const COBERTURA = join(REPO, 'docs/DESDE JUNIO/NUEVOS USUARIOS/05-COBERTURA-19-toggles.md');

let failures = 0;

function check(label: string, expected: string | number, actual: string | number) {
  const ok = String(expected) === String(actual);
  const detail = ok ? `(${actual})` : `-- el doc dice "${actual}", el codigo dice "${expected}"`;
  console.log(`${ok ? 'OK  ' : 'FAIL'} ${label} ${detail}`);
  if (!ok) failures++;
}

function markerIn(file: string, label: string, name: string): string {
  const src = readFileSync(file, 'utf8');
  const m = src.match(new RegExp(`<!--\\s*gate:${name}=([^\\s>]*?)\\s*-->`));
  if (!m) {
    console.log(`FAIL marcador gate:${name} AUSENTE en ${label}`);
    failures++;
    return '<ausente>';
  }
  return m[1];
}

// --- Derive the truth from the code --------------------------------------
const codeTools = ALL_TOOLS.length;
const codeModules = AGENT_MODULES.length;
const codeModuleList = AGENT_MODULES.map((m) => m.name).join(',');
const codeToggles = PERMISSION_KEYS.length;

// Eval count: the suite is a flat array of cases, each with a unique `id:`.
const evalsSrc = readFileSync(EVALS, 'utf8');
const evalIds = evalsSrc.match(/^\s+id:\s*'[^']+'/gm) ?? [];
const codeEvals = evalIds.length;

// --- AGENTES --------------------------------------------------------------
console.log('Gate de docs -- AGENTES vs codigo\n');
check('02-CAPACIDADES tools', codeTools, markerIn(CAPACIDADES, '02-CAPACIDADES', 'tools'));
check('02-CAPACIDADES modulos', codeModules, markerIn(CAPACIDADES, '02-CAPACIDADES', 'modules'));
check('02-CAPACIDADES casos de eval', codeEvals, markerIn(CAPACIDADES, '02-CAPACIDADES', 'evals'));
check('02-CAPACIDADES lista de modulos', codeModuleList, markerIn(CAPACIDADES, '02-CAPACIDADES', 'module-list'));

// Fail-closed invariant: every module must appear in the permissions map. A module
// missing from it is BLOCKED for secondary users — the intended default, but it must
// be a DECISION, not an oversight.
for (const m of AGENT_MODULES) {
  const mapped = Object.prototype.hasOwnProperty.call(AGENT_MODULE_REQUIREMENTS, m.name);
  const why = mapped ? '' : ' -- quedaria BLOQUEADO para usuarios secundarios (fail-closed). Si es intencional, agregalo explicitamente.';
  console.log(`${mapped ? 'OK  ' : 'FAIL'} modulo "${m.name}" declarado en AGENT_MODULE_REQUIREMENTS${why}`);
  if (!mapped) failures++;
}

// Duplicate eval ids would silently shrink the suite.
const idValues = evalIds.map((s) => s.replace(/^\s+id:\s*'/, '').replace(/'$/, ''));
const dupes = [...new Set(idValues.filter((v, i) => idValues.indexOf(v) !== i))];
if (dupes.length) {
  console.log(`FAIL ids de eval duplicados: ${dupes.join(', ')}`);
  failures++;
} else {
  console.log('OK   ids de eval unicos');
}

// --- NUEVOS USUARIOS ------------------------------------------------------
console.log('\nGate de docs -- NUEVOS USUARIOS vs codigo\n');
check('05-COBERTURA toggles', codeToggles, markerIn(COBERTURA, '05-COBERTURA', 'toggles'));

// The coverage audit has one row per toggle. If a toggle is added to the code and the
// audit is not re-run, that row is missing and members silently have an unaudited block.
// NOTE: scan ONLY the markdown table rows. Scanning the whole file gives a false pass —
// several keys are also mentioned in the prose below the matrix (caught in a negative test).
const coberturaRows = readFileSync(COBERTURA, 'utf8')
  .split('\n')
  .filter((l) => /^\s*\|/.test(l))
  .join('\n');
const missingRows = PERMISSION_KEYS.filter((k) => !coberturaRows.includes(`\`${k}\``));
if (missingRows.length) {
  console.log(`FAIL toggles sin fila en la matriz de 05-COBERTURA: ${missingRows.join(', ')} -- re-corre la auditoria`);
  failures++;
} else {
  console.log('OK   los 19 toggles tienen fila en la matriz de cobertura');
}

// --- Result ---------------------------------------------------------------
console.log(
  failures === 0
    ? '\nOK: los numeros de los docs coinciden con el codigo.'
    : `\nFALLO: ${failures} desajuste(s). Actualiza el marcador Y el texto en el doc que declara ese numero (07-CONVENCIONES seccion 2); los demas docs lo citan CON FECHA.`
);
process.exit(failures === 0 ? 0 : 1);
