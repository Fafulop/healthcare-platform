/**
 * Verificación de `serializeToolResult` (run-turn.ts) — el recorte de payloads
 * de tools contra el cap de 8,000 chars.
 *
 * DOS pasadas, igual que `tool-digest-check.ts`:
 *
 *   npx tsx scripts/tool-result-cap-check.ts
 *     → solo casos sintéticos (función pura, sin BD ni API, sin costo)
 *
 *   railway run --service pgvector -- npx tsx scripts/tool-result-cap-check.ts
 *     → además contra los PAYLOADS REALES de prod, que es donde se midió el bug
 *
 * Por qué existe: hasta el 2026-07-31 esto cortaba el JSON a media fila
 * (`json.slice(0, CAP)`) y lo metía como string en `parcial`. Medido:
 *   · el cap NO capaba — `get_bookings` emitía 9,367 B y `get_billing_status`
 *     9,129 B, por ENCIMA de los 8,000, porque re-serializar escapa cada `"`.
 *   · el modelo recibía una fila partida ⇒ mecanismo exacto del incidente #31
 *     (cosió el ledgerEntryId de un ingreso con el importe de otro y propuso
 *     timbrar un CFDI equivocado).
 */

// ⚠️ NADA de imports estáticos del árbol del agente. `tools.ts` congela
// `API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3003'` al
// CARGARSE, y ESM iza los imports por encima de cualquier código de este archivo:
// un `import ... from '../src/...'` arriba dejaría API_URL apuntando a localhost
// y toda tool que salga por HTTP fallaría con "fetch failed" contra un puerto
// muerto (lo destapó `get_availability`, eliminada el 2026-08-05; la trampa
// sigue viva para checkSlot y cualquier otra llamada a la API).
// (Pasó: 3 corridas seguidas, y la misma llamada aislada funcionaba — parecía un
// blip de red y era determinista.) Por eso el env se fija PRIMERO y todo se
// importa dinámicamente, igual que en `tool-digest-check.ts`.
process.env.NEXT_PUBLIC_API_URL =
  process.env.NEXT_PUBLIC_API_URL && !process.env.NEXT_PUBLIC_API_URL.includes('localhost')
    ? process.env.NEXT_PUBLIC_API_URL
    : 'https://healthcareapi-production-fb70.up.railway.app';
// Mismo motivo, y la misma trampa: el cliente de Prisma se construye AL CARGARSE
// `@healthcare/database`, que entra por la cadena de imports de run-turn. Si esto
// se asigna dentro de contraProd() ya es tarde y el cliente quedó apuntando al
// host INTERNO (`pgvector.railway.internal`), inalcanzable desde fuera de Railway.
if (process.env.DATABASE_PUBLIC_URL) process.env.DATABASE_URL = process.env.DATABASE_PUBLIC_URL;

// `import type` SÍ es seguro: TypeScript lo borra por completo, así que NO carga
// el módulo en runtime y no congela API_URL. Solo los imports de VALOR son el
// problema. Además da el tipo real, sin el que este archivo indexaba `unknown`.
import type { SerializedToolResult } from '../src/lib/agenda-agent/run-turn';

type SerializeFn = (r: unknown) => SerializedToolResult;
let serializeToolResult: SerializeFn;
let digestResult: (r: unknown, extra?: Record<string, unknown>) => Record<string, unknown>;

const CAP = 8000;
let fails = 0;
const check = (name: string, cond: boolean, got?: unknown) => {
  if (!cond) {
    fails++;
    console.log('  FAIL', name, got !== undefined ? JSON.stringify(got).slice(0, 160) : '');
  } else {
    console.log('  ok  ', name);
  }
};

/** Payload sintético: `n` filas de ~`bytes` cada una, con total independiente. */
function conTotal(n: number, bytes = 200) {
  return {
    totalEncontradas: n * 3, // el total NO es la longitud de la lista: debe sobrevivir intacto
    mostradas: n,
    citas: Array.from({ length: n }, (_, i) => ({ id: `id-${i}`, relleno: 'x'.repeat(bytes) })),
  };
}

function puros() {
console.log('\n--- 1. payloads que YA caben: byte-idénticos y sin marca ---');
for (const p of [{ a: 1 }, conTotal(3), { citas: [] }, null, 'texto', 42]) {
  const r = serializeToolResult(p);
  check(`cabe: ${JSON.stringify(p).slice(0, 28)}`, r.content === JSON.stringify(p) && r.recorte === null);
}

console.log('\n--- 2. payload grande CON total: se recorta por filas ---');
const grande = serializeToolResult(conTotal(200));
const g = JSON.parse(grande.content);
console.log(`   ${JSON.stringify(conTotal(200)).length}B -> ${grande.content.length}B`);
check('queda bajo el cap', grande.content.length <= CAP, grande.content.length);
check('es JSON válido', typeof g === 'object' && g !== null);
check('las filas que quedan están ÍNTEGRAS', Array.isArray(g.citas) && g.citas.every((c: any) => typeof c.id === 'string' && typeof c.relleno === 'string'));
check('el total NO se tocó', g.totalEncontradas === 600, g.totalEncontradas);
check('avisa que recortó', g.truncado === true && typeof g.aviso === 'string');
check('dice qué recortó', g.recorte?.campo === 'citas' && g.recorte.quitadas > 0);
check('recorte.mostradas == filas reales', g.recorte.mostradas === g.citas.length);
check('lo reporta para la traza', (grande.recorte as any)?.campo === 'citas');

console.log('\n--- 3. SIN total recuperable: NO se recorta (cae al corte viejo) ---');
// Era el caso de `get_availability` (eliminada el 2026-08-05): una lista de
// horarios sin ningún total. El caso se conserva porque la guarda sigue viva —
// recortar filas de una lista sin total pierde OPCIONES, no detalle (fallo #32).
const sinTotal = { fechasDisponibles: Array.from({ length: 300 }, (_, i) => `2026-08-${i}`), horarios: { '2026-08-05': Array.from({ length: 300 }, () => ({ startTime: '09:00', endTime: '09:30' })) } };
const st = serializeToolResult(sinTotal);
const stp = JSON.parse(st.content);
check('NO recorta por filas (sin total = recortar mentiría)', stp.truncado === true && 'parcial' in stp);
check('lo marca como corte por caracteres', (st.recorte as any)?.modo === 'caracteres');

console.log('\n--- 4. arreglos ANIDADOS nunca se tocan ---');
const anidado = { totalX: 5, horarios: { d1: Array.from({ length: 400 }, () => ({ s: '09:00', e: '09:30' })) } };
const an = JSON.parse(serializeToolResult(anidado).content);
check('un arreglo anidado no se recorta por filas', 'parcial' in an);

console.log('\n--- 5. bordes / terminación ---');
check('lista de 1 fila enorme termina', (() => { const r = serializeToolResult({ total: 1, citas: [{ x: 'y'.repeat(20000) }] }); return r.content.length > 0; })());
check('arreglo vacío + envelope enorme termina', (() => { const r = serializeToolResult({ total: 0, nota: 'z'.repeat(20000), citas: [] }); return JSON.parse(r.content).truncado === true; })());
check('elige el arreglo MÁS pesado', (() => {
  const r = JSON.parse(serializeToolResult({ total: 9, chicas: [{ a: 1 }, { a: 2 }], citas: Array.from({ length: 200 }, () => ({ relleno: 'x'.repeat(200) })) }).content);
  return r.recorte?.campo === 'citas' && r.chicas.length === 2;
})());
check('recorta lo MÍNIMO necesario (no vacía la lista)', (() => {
  const r = JSON.parse(serializeToolResult(conTotal(45, 200)).content);
  return r.citas.length > 10;
})());

console.log('\n--- 5b. contadores hermanos coherentes con las filas ---');
// `mostradas` contaba las filas entregadas: tras recortar debe bajar, o el
// payload se contradice (decía 50 con 29 filas dentro).
const coh = JSON.parse(serializeToolResult(conTotal(200)).content);
check('`mostradas` baja a las filas reales', coh.mostradas === coh.citas.length, { mostradas: coh.mostradas, filas: coh.citas.length });
// TRAMPA: si la lista NO venía capada, el total COINCIDE con la longitud.
// Bajarlo destruiría el único dato que hace seguro recortar.
const trampa = { totalEncontradas: 40, mostradas: 40, citas: Array.from({ length: 40 }, (_, i) => ({ id: i, relleno: 'x'.repeat(300) })) };
const t = JSON.parse(serializeToolResult(trampa).content);
check('el total NO baja aunque coincida con la longitud', t.totalEncontradas === 40, t.totalEncontradas);
check('pero `mostradas` sí baja', t.mostradas === t.citas.length && t.mostradas < 40, { mostradas: t.mostradas, filas: t.citas.length });

console.log('\n--- 5c. hallazgos del code review (2026-07-31) ---');
// #1 — SIN `total*` también se recorta por filas. get_day_schedule y find_patient
// no tienen ninguno y caían al corte por caracteres, o sea seguían con el bug.
const sinTot = { fecha: '2026-08-10', citas: Array.from({ length: 60 }, (_, i) => ({ id: i, relleno: 'x'.repeat(300) })) };
const st1 = serializeToolResult(sinTot);
const p1: any = JSON.parse(st1.content);
check('#1 recorta por filas aunque NO haya total*', Array.isArray(p1.citas) && p1.recorte?.campo === 'citas', st1.recorte);
check('#1 el conteo real viaja en recorte.deUnTotalDe', p1.recorte?.deUnTotalDe === 60, p1.recorte);
check('#1 respeta el cap', st1.content.length <= CAP, st1.content.length);

// #2 — si la lista se vacía, JSON VÁLIDO con lista vacía, no corte a media fila.
const env = serializeToolResult({ total: 3, nota2: 'z'.repeat(9000), citas: [{ a: 1 }] });
const p2: any = JSON.parse(env.content);
check('#2 envelope gigante -> lista vacía válida, no corte por caracteres', Array.isArray(p2.citas) && !('parcial' in p2), Object.keys(p2));

// #3 — con cola pesada la estimación por promedio se pasaba y no devolvía filas.
const desigual = { total: 50, citas: [...Array.from({ length: 40 }, (_, i) => ({ id: i, r: 'x'.repeat(80) })), ...Array.from({ length: 10 }, (_, i) => ({ id: 40 + i, r: 'y'.repeat(1500) }))] };
const p3: any = JSON.parse(serializeToolResult(desigual).content);
const unaMas3 = JSON.stringify({ ...p3, citas: [...p3.citas, desigual.citas[p3.citas.length]] });
check('#3 no sobre-recorta con filas desiguales (una más no cabría)', unaMas3.length > CAP, `${p3.citas.length} filas, +1 = ${unaMas3.length}B`);

// #4 — la nota en prosa citaba el conteo viejo y contradecía al payload.
const conNota: any = { totalCitas: 44, mostradas: 20, nota: 'Solo las 20 citas más recientes de 44', citas: Array.from({ length: 20 }, (_, i) => ({ id: i, r: 'x'.repeat(600) })) };
const p4: any = JSON.parse(serializeToolResult(conNota).content);
check('#4 la nota en prosa desaparece al recortar', !('nota' in p4) && p4.mostradas === p4.citas.length, { nota: p4.nota, mostradas: p4.mostradas, filas: p4.citas.length });

// #5 — un `limit: 50` que coincide con las filas NO debe reescribirse.
const conLimit: any = { total: 99, limit: 50, mostradas: 50, citas: Array.from({ length: 50 }, (_, i) => ({ id: i, r: 'x'.repeat(300) })) };
const p5: any = JSON.parse(serializeToolResult(conLimit).content);
check('#5 `limit` NO se reescribe; `mostradas` sí', p5.limit === 50 && p5.mostradas === p5.citas.length && p5.mostradas < 50, { limit: p5.limit, mostradas: p5.mostradas });

// #6 — `_recorte` debe quedar DENTRO del tope del digest, no pegado después.
const anchoConExtra = (() => { const o: any = {}; for (let i = 0; i < 400; i++) o['k' + i] = 'x'.repeat(50); return digestResult(o, { _recorte: { campo: 'citas', quitadas: 1 } }); })();
check('#6 el extra sobrevive al tope del digest', (anchoConExtra as any)._recorte?.campo === 'citas' && JSON.stringify(anchoConExtra).length < 2200, JSON.stringify(anchoConExtra).length);

// La disponibilidad SIGUE intocable (el deny explícito reemplaza al guard de total*).
// OJO: el fixture tiene que pasarse DE VERDAD del cap. La primera versión traía
// 400 fechas cortas (~5.2 KB), nunca se truncaba, y el assert fallaba por eso —
// no por el código.
const dispo: any = { fechasDisponibles: Array.from({ length: 400 }, (_, i) => `2026-08-${i}T09:00-relleno-para-superar-el-cap`) };
check('el fixture de disponibilidad SÍ excede el cap', JSON.stringify(dispo).length > CAP, JSON.stringify(dispo).length);
check('disponibilidad NO se recorta por filas', 'parcial' in JSON.parse(serializeToolResult(dispo).content));
}

// ---------------------------------------------------------------------------
// 6. Contra PAYLOADS REALES de prod (solo con DATABASE_PUBLIC_URL)
// ---------------------------------------------------------------------------
async function contraProd(): Promise<void> {
  process.env.DATABASE_URL = process.env.DATABASE_PUBLIC_URL!;
  process.env.NEXT_PUBLIC_API_URL =
    process.env.NEXT_PUBLIC_API_URL && !process.env.NEXT_PUBLIC_API_URL.includes('localhost')
      ? process.env.NEXT_PUBLIC_API_URL
      : 'https://healthcareapi-production-fb70.up.railway.app';

  const { dispatchReadTool, FULL_SCOPE } = await import('../src/lib/agenda-agent/modules/registry');
  const { prisma } = await import('@healthcare/database');
  const doctorId = 'cmni1bov90000mk0lyeztr3ad'; // dr-prueba
  const ctx = { doctorId, doctorSlug: 'dr-prueba', apiToken: null, tier: FULL_SCOPE.tier };

  const p: Array<{ id: string }> = await prisma.$queryRawUnsafe(
    `SELECT p.id FROM medical_records.patients p JOIN public.bookings b ON b.patient_id = p.id
      WHERE p.doctor_id = '${doctorId}' GROUP BY p.id ORDER BY count(b.id) DESC LIMIT 1`
  );
  const hoy = new Date().toISOString().slice(0, 10);

  console.log('\n--- 6. PAYLOADS REALES de prod ---');
  const casos: Array<[string, Record<string, unknown>]> = [
    ['get_bookings', {}],
    ['get_bookings', { vencidas: true }],
    ['get_billing_status', { patientId: p[0]?.id }],
    ['get_ranges', { startDate: '2026-07-01', endDate: '2026-08-31' }],
    ['get_payment_links', {}],
    ['get_day_schedule', { date: '2026-08-10' }],
  ];
  for (const [name, input] of casos) {
    // Un reintento: hay tools que salen por HTTP a la API pública y un blip de
    // red daría una FALSA alarma. Si los dos intentos fallan, se reporta como FALLA
    // (nunca se salta en silencio — un tripwire que omite el caso no vigila nada).
    let raw: unknown;
    let ultimoError = '';
    for (let intento = 1; intento <= 2; intento++) {
      try {
        raw = await dispatchReadTool(ctx as never, name, input);
        ultimoError = '';
        break;
      } catch (err) {
        ultimoError = (err as Error).message.slice(0, 70);
        // Con pausa: reintentar al instante no sirve contra un blip de red de
        // 1-2s (medido: dos intentos seguidos fallaban, y la misma llamada
        // aislada pasaba al primer intento).
        if (intento === 1) await new Promise((r) => setTimeout(r, 2000));
      }
    }
    if (ultimoError) {
      check(`${name} — la tool corrió (2 intentos)`, false, ultimoError);
      continue;
    }
    const crudo = JSON.stringify(raw).length;
    const r = serializeToolResult(raw);
    const etiqueta = `${name} ${JSON.stringify(input).slice(0, 26)}`;
    check(`${etiqueta} — respeta el cap`, r.content.length <= CAP, `${crudo}B -> ${r.content.length}B`);
    check(`${etiqueta} — JSON válido`, (() => { try { JSON.parse(r.content); return true; } catch { return false; } })());
    // El invariante que importa: si se recortó por filas, el total original sigue ahí.
    if (r.recorte && 'campo' in r.recorte) {
      const orig = raw as Record<string, unknown>;
      const out = JSON.parse(r.content) as Record<string, unknown>;
      const totales = Object.keys(orig).filter((k) => /^total/i.test(k));
      check(`${etiqueta} — totales intactos`, totales.every((k) => out[k] === orig[k]), totales.map((k) => `${k}:${orig[k]}->${out[k]}`));
      // MINIMALIDAD: cada fila de más que se quite es una capacidad que el agente
      // pierde (una cita que ya no puede facturar). Se exige que devolver UNA fila
      // más ya se pase del cap — si no, se está recortando de más.
      // Nació de un bug propio: un `aviso` de 250 chars costaba una cita entera en
      // get_billing_status y escondía el ingreso del eval f2b-emision-camino-feliz.
      const campo = r.recorte.campo;
      const listaOrig = orig[campo] as unknown[];
      const listaOut = out[campo] as unknown[];
      const unaMas = { ...out, [campo]: [...listaOut, listaOrig[listaOut.length]] };
      check(
        `${etiqueta} — recorta lo MÍNIMO (una fila más no cabría)`,
        JSON.stringify(unaMas).length > CAP,
        `con ${listaOut.length + 1} filas serían ${JSON.stringify(unaMas).length}B`
      );
    }
    console.log(`         ${crudo}B -> ${r.content.length}B ${r.recorte ? JSON.stringify(r.recorte) : '(cupo entero)'}`);
  }
  await prisma.$disconnect();
}

/**
 * `nearestTimes` (proposals.ts) — las alternativas que checkSlot devuelve cuando
 * la hora pedida no sirve. Vive en ESTE script porque su razón de ser es el cap:
 * en freeform con `interval=1` la lista cruda trae hasta 1,440 horas (~11 KB) y
 * sola revienta los 8,000 chars, que es el mecanismo de #31/#34.
 *
 * Pero acotar por tamaño NO basta, y esa fue la trampa que cazó el code review:
 * quedarse con las 8 MÁS CERCANAS en una rejilla de 1 minuto devuelve 8 minutos
 * consecutivos — el MISMO hueco repetido 8 veces.
 */
async function horariosCercanos() {
  console.log('\n--- 6. nearestTimes: tamaño Y distinción ---');
  const { nearestTimes } = await import('../src/lib/agenda-agent/proposals');

  // Día freeform realista: libre todo salvo 16:00–16:30, servicio de 30 min.
  const libres: string[] = [];
  for (let m = 0; m < 24 * 60; m++) {
    if (m > 15 * 60 + 30 && m < 16 * 60 + 30) continue; // un 30-min no cabe ahí
    libres.push(`${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`);
  }

  const r = nearestTimes(libres, '16:07', 30);
  check('cabe en el cap (<= 8 horas)', r.length <= 8, r);
  check('no devuelve minutos consecutivos (huecos distintos)', new Set(r).size === r.length && r.every((t, i) => i === 0 || toMin(t) - toMin(r[i - 1]) >= 30), r);
  check('orden cronológico', r.every((t, i) => i === 0 || toMin(t) > toMin(r[i - 1])), r);
  check('ofrece opciones ANTES y DESPUÉS del objetivo', r.some((t) => toMin(t) < toMin('16:07')) && r.some((t) => toMin(t) > toMin('16:07')), r);
  check('incluye el hueco real más cercano (16:30)', r.includes('16:30'), r);
  check('el payload de alternativas es chico (< 100 B)', JSON.stringify(r).length < 100, JSON.stringify(r).length);

  // Bordes: nada libre, objetivo con formato inválido, gap absurdo.
  check('lista vacía → vacío', nearestTimes([], '16:07', 30).length === 0);
  // Devolver "los primeros 8" ante un objetivo inválido reintroducía el defecto
  // que esta función existe para evitar: 00:00–00:07 en rejilla de 1 min, o sea
  // el MISMO hueco 8 veces a la peor hora del día (hallazgo del review 2026-08-05).
  check('objetivo inválido → NO devuelve la madrugada, devuelve vacío', nearestTimes(libres, 'xx:yy', 30).length === 0, nearestTimes(libres, 'xx:yy', 30));
  // Freeform abarca el día entero: sin tope, a quien pide 08:00 se le ofrece 04:00.
  const early = nearestTimes(libres, '08:00', 30);
  check('no ofrece horas absurdamente lejanas (<= 3 h del objetivo)', early.every((t) => Math.abs(toMin(t) - toMin('08:00')) <= 180), early);
  check('gap 0 → cae al default y sigue espaciando', nearestTimes(libres, '16:07', 0).every((t, i, a) => i === 0 || toMin(t) - toMin(a[i - 1]) >= 15));
  console.log(`         alternativas para 16:07 (servicio 30 min): ${r.join(', ')}`);
}
const toMin = (t: string) => {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
};

(async () => {
  // Dinámico y DESPUÉS de fijar el env (ver la nota de arriba).
  ({ serializeToolResult } = (await import('../src/lib/agenda-agent/run-turn')) as unknown as {
    serializeToolResult: SerializeFn;
  });
  ({ digestResult } = await import('../src/lib/agenda-agent/tool-digest'));
  puros();
  await horariosCercanos();
  if (process.env.DATABASE_PUBLIC_URL) {
    await contraProd();
  } else {
    console.log('\n(prod omitido — corre con `railway run --service pgvector -- npx tsx scripts/tool-result-cap-check.ts`)');
  }
  console.log(fails === 0 ? '\nTODO OK' : `\n${fails} FALLAS`);
  process.exit(fails === 0 ? 0 : 1);
})();
