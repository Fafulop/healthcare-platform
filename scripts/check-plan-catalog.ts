/**
 * Gate del CATÁLOGO DEL PLAN (TIERS C1) — la red que hace confiable una lista
 * escrita a mano.
 *
 * Run: pnpm gate:catalogo
 *
 * Por qué existe: `packages/database/src/plan-catalog.ts` NO se deriva de
 * `TIER_EXCLUDED_KEYS` (su cabecera explica las cuatro mentiras que derivarla
 * produciría). Pero una lista a mano se pudre sola en cuanto alguien agrega un
 * tier, una key o un feature flag. Este gate la ata a las tres fuentes que
 * podrían dejarla desactualizada:
 *
 *   1. TIER_EXCLUDED_KEYS — ninguna key por la que se cobra puede quedar sin
 *      nombre en la pantalla del doctor.
 *   2. Los flags de visibilidad — nada tapado puede anunciarse como incluido.
 *   3. El vocabulario TierKey — ninguna key puede quedar sin clasificar.
 *
 * Es el mismo trato que `gate:routes` le da al route map: escribir a mano está
 * permitido; olvidarse, no.
 */
import { readFileSync } from 'fs';
import { join } from 'path';
import {
  PLAN_CATALOG,
  keysQueDistinguenPlanes,
  GRUPOS_CATALOGO,
} from '../packages/database/src/plan-catalog';
import {
  PERMISSION_KEYS,
  TIER_KEY_LABELS,
  DOCTOR_TIERS,
  TIER_EXCLUDED_KEYS,
  type TierKey,
} from '../packages/database/src/permissions';

const fallos: string[] = [];

// Todo el vocabulario de tier: las 19 de member + las dos que sólo viven aquí.
const TODAS_LAS_KEYS = Object.keys(TIER_KEY_LABELS) as TierKey[];

const keysEnCatalogo = PLAN_CATALOG.flatMap((e) => e.keys);
const anunciables = PLAN_CATALOG.filter((e) => e.noAnunciable === null);
const keysAnunciadas = new Set(anunciables.flatMap((e) => e.keys));

console.log(`Entradas en el catálogo: ${PLAN_CATALOG.length} (${anunciables.length} anunciables)`);
console.log(`Keys del vocabulario TierKey: ${TODAS_LAS_KEYS.length}`);
console.log(`Tiers: ${DOCTOR_TIERS.join(', ')}`);

// ── 1. Cobertura: toda key del vocabulario tiene UNA entrada ────────────────
// Sin esto, agregar una key nueva la deja invisible en la pantalla del doctor
// sin que nadie se entere.
for (const key of TODAS_LAS_KEYS) {
  const veces = keysEnCatalogo.filter((k) => k === key).length;
  if (veces === 0) {
    fallos.push(
      `La key '${key}' (${TIER_KEY_LABELS[key]}) no tiene entrada en PLAN_CATALOG. ` +
        `Agrégala —anunciable o con su motivo— en packages/database/src/plan-catalog.ts.`,
    );
  } else if (veces > 1) {
    fallos.push(
      `La key '${key}' aparece en ${veces} entradas del catálogo. Una key pertenece a UNA ` +
        `línea de producto: si no, el doctor la ve dos veces y con dos estados posibles.`,
    );
  }
}

// ── 2. Estado de los flags de visibilidad ──────────────────────────────────
// Se leen como TEXTO a propósito: importarlos metería un archivo de apps/doctor
// (con "use client" y JSX en su árbol) dentro de un script de Node.
const FLAGS: { archivo: string; constante: string; keys: TierKey[] }[] = [
  {
    archivo: 'apps/doctor/src/lib/ui-visibility.ts',
    constante: 'CONCILIACION_BANCARIA_VISIBLE',
    keys: ['conciliacion'],
  },
  {
    archivo: 'apps/doctor/src/lib/agenda-agent/feature-flag.ts',
    constante: 'ASISTENTE_IA_VISIBLE',
    keys: ['asistente_ia'],
  },
];

/** key → el flag que la tapa (o la destapa) y su estado actual. */
const estadoFlag = new Map<TierKey, { constante: string; archivo: string; visible: boolean }>();

for (const flag of FLAGS) {
  const ruta = join(__dirname, '..', flag.archivo);
  try {
    const src = readFileSync(ruta, 'utf8');
    // 🔴 ANCLADO a la DECLARACIÓN, no a la primera mención. Sin el `^\s*export
    // const` y el flag `m`, una línea de comentario como
    // `// cuando ASISTENTE_IA_VISIBLE = true, el panel se pinta` —escrita
    // ARRIBA de la declaración, que es donde se documentan estos flags— se
    // leería como el valor real. El gate creería que la función está visible,
    // la regla 4 exigiría quitarle su `noAnunciable`, y el catálogo empezaría a
    // anunciar una puerta que sigue tapiada: justo lo que este gate existe para
    // impedir, pero al revés y en silencio.
    const m = src.match(
      new RegExp(`^\\s*export const ${flag.constante}\\s*(?::[^=]+)?=\\s*(true|false)`, 'm'),
    );
    if (!m) {
      fallos.push(
        `No se pudo leer ${flag.constante} en ${flag.archivo}. El gate no puede verificar ` +
          `si sus funciones están tapadas; arregla la lectura antes de seguir.`,
      );
      continue;
    }
    const visible = m[1] === 'true';
    console.log(`  ${flag.constante} = ${visible ? 'true (visible)' : 'false (tapado)'}`);
    for (const key of flag.keys) {
      estadoFlag.set(key, { constante: flag.constante, archivo: flag.archivo, visible });
    }
  } catch {
    fallos.push(`No se pudo abrir ${flag.archivo} para leer ${flag.constante}.`);
  }
}

// ── 3. 🔴 Lo que se cobra, se nombra ───────────────────────────────────────
// Una key que ALGÚN tier excluye es, por definición, algo por lo que se paga:
// si no se anuncia, el doctor no puede saber qué le falta ni qué compraría.
//
// ⚠️ CON UNA EXCEPCIÓN, y no es cosmética: una función TAPADA POR FLAG para
// todas las cuentas no le falta a nadie de forma observable. `conciliacion` es
// justo ese caso —FREE la excluye, pero la sección está oculta desde el
// 2026-08-27—, y su exclusión es defensiva: está ahí para que la puerta no
// quede abierta el día que el flag se prenda (lo dice permissions.ts). Exigir
// que se anuncie obligaría a vender una puerta tapiada; prohibirlo sin más
// dejaría el hueco abierto para siempre. Por eso la excepción vive ATADA al
// flag: en cuanto el flag se prenda, la regla 4 exige anunciarla.
const distinguen = keysQueDistinguenPlanes();
const diferidasPorFlag: string[] = [];

for (const key of distinguen) {
  if (keysAnunciadas.has(key)) continue;

  const flag = estadoFlag.get(key);
  if (flag && !flag.visible) {
    diferidasPorFlag.push(`${key} (tapada por ${flag.constante})`);
    continue;
  }

  const tiers = DOCTOR_TIERS.filter((t) =>
    (TIER_EXCLUDED_KEYS[t] as readonly TierKey[]).includes(key),
  );
  const entrada = PLAN_CATALOG.find((e) => e.keys.includes(key));
  const motivo = entrada?.noAnunciable
    ? ` Hoy no se anuncia porque: ${entrada.noAnunciable.razon}`
    : '';
  fallos.push(
    `La key '${key}' la EXCLUYE ${tiers.join('/')} —o sea que es algo por lo que se cobra— ` +
      `pero no se le anuncia al doctor.${motivo} Si de verdad no debe anunciarse, ` +
      `entonces tampoco debería distinguir planes: sácala de TIER_EXCLUDED_KEYS.`,
  );
}

// ── 4. El flag manda en las dos direcciones ────────────────────────────────
// Tapado + anunciado  ⇒ estaríamos vendiendo una puerta tapiada.
// Visible + no anunciado ⇒ el tripwire de la excepción de arriba: el día que
// alguien prenda CONCILIACION_BANCARIA_VISIBLE o retire ASISTENTE_IA_VISIBLE
// (Q5), esta pantalla tiene que dejar de callarse esa función.
for (const [key, flag] of estadoFlag) {
  const anunciada = keysAnunciadas.has(key);
  if (!flag.visible && anunciada) {
    fallos.push(
      `'${key}' se anuncia en el catálogo, pero ${flag.constante} = false en ${flag.archivo}: ` +
        `estaríamos vendiendo una puerta tapiada. Marca la entrada como noAnunciable o prende el flag.`,
    );
  }
  if (flag.visible && !anunciada) {
    fallos.push(
      `${flag.constante} ya es true en ${flag.archivo}, así que '${key}' es una función VISIBLE ` +
        `que la pantalla de plan no menciona. Quita su \`noAnunciable\` en plan-catalog.ts.`,
    );
  }
}

// ── 5. Nada anunciable puede apuntar a una key inexistente ─────────────────
for (const entrada of PLAN_CATALOG) {
  if (entrada.keys.length === 0) {
    fallos.push(`La entrada '${entrada.id}' no declara ninguna key.`);
  }
  for (const key of entrada.keys) {
    if (!(key in TIER_KEY_LABELS)) {
      fallos.push(`La entrada '${entrada.id}' nombra la key '${key}', que no existe en TierKey.`);
    }
  }
  if (!GRUPOS_CATALOGO.includes(entrada.grupo)) {
    fallos.push(`La entrada '${entrada.id}' usa el grupo '${entrada.grupo}', que no existe.`);
  }
  if (entrada.noAnunciable && !entrada.noAnunciable.desbloqueaCuando) {
    fallos.push(
      `La entrada '${entrada.id}' no se anuncia pero no dice qué la desbloquea. Sin eso, ` +
        `una ausencia deliberada no se distingue de un olvido.`,
    );
  }
}

// ── 6. Ids únicos ──────────────────────────────────────────────────────────
const ids = PLAN_CATALOG.map((e) => e.id);
const duplicados = ids.filter((id, i) => ids.indexOf(id) !== i);
if (duplicados.length > 0) {
  fallos.push(`Ids repetidos en el catálogo: ${[...new Set(duplicados)].join(', ')}`);
}

// ── Reporte ────────────────────────────────────────────────────────────────
console.log(
  `\nKeys que HOY distinguen un plan de otro: ${distinguen.length > 0 ? distinguen.join(', ') : '(ninguna)'}`,
);
if (diferidasPorFlag.length > 0) {
  console.log(`Excluidas pero NO anunciadas por estar tapadas: ${diferidasPorFlag.join(', ')}`);
}
console.log(
  `Entradas NO anunciables: ${
    PLAN_CATALOG.filter((e) => e.noAnunciable)
      .map((e) => e.id)
      .join(', ') || '(ninguna)'
  }`,
);
// PERMISSION_KEYS se usa sólo para reportar: el catálogo habla de TierKey, que
// es PermissionKey + ia + whatsapp. Si el número cambia, se ve aquí.
console.log(`(PermissionKey: ${PERMISSION_KEYS.length} · TierKey: ${TODAS_LAS_KEYS.length})`);

if (fallos.length > 0) {
  console.error(`\nCATÁLOGO FAIL (${fallos.length}):`);
  for (const f of fallos) console.error(`  - ${f}`);
  process.exit(1);
}

console.log('\nCatálogo del plan coherente. OK.');
