/**
 * Comprobaciones de `_lib/event-model.ts` — la matemática que comparten las TRES vistas del
 * calendario (Día/Semana, Mes y Año). Correr con:
 *
 *     npx tsx scripts/event-model-check.ts
 *
 * Vivían en un scratchpad, así que los "17/24/28 checks" que citaban los docs no eran
 * verificables ni podían fallar en una regresión. Aquí sí.
 *
 * Cubre, en particular, los tres bugs que este módulo ya produjo en vivo:
 *  - reusar un predicado para dos preguntas distintas (la vista de Año en blanco),
 *  - perder las citas LIBRES por leer sólo `slot`,
 *  - y que una cita que libera su horario siga dibujada encima del hueco.
 */
import {
  buildDayEvents, layoutDayEvents, computeFreeGaps, minToTime,
  FREES_THE_SLOT, NO_WORKLOAD,
} from "../src/app/dashboard/appointments/_lib/event-model";

let failures = 0;
function check(name: string, actual: unknown, expected: unknown) {
  const a = JSON.stringify(actual), e = JSON.stringify(expected);
  if (a === e) { console.log(`  ok   ${name}`); }
  else { console.log(`  FAIL ${name}\n       esperado ${e}\n       obtuvo   ${a}`); failures++; }
}

const D = "2026-08-03";
const range = (s: string, e: string) => ({
  id: `r-${s}`, date: `${D}T00:00:00.000Z`, startTime: s, endTime: e,
  intervalMinutes: 30, locationId: null, location: null,
});
const slotBooking = (id: string, s: string, e: string, status = "CONFIRMED", ext?: number) => ({
  id, slotId: `s-${id}`, patientName: id, status,
  extendedBlockMinutes: ext ?? null,
  slot: { date: `${D}T00:00:00.000Z`, startTime: s, endTime: e, duration: 30 },
});
const freeBooking = (id: string, s: string, e: string, status = "CONFIRMED") => ({
  id, slotId: null, patientName: id, status,
  date: `${D}T00:00:00.000Z`, startTime: s, endTime: e, duration: 30, slot: null,
});
const block = (id: string, s: string, e: string) => ({
  id, date: `${D}T00:00:00.000Z`, startTime: s, endTime: e, reason: null,
});

console.log("\nbuildDayEvents");
{
  // Las citas tienen DOS formas; una vista que sólo lea `slot` pierde las libres.
  const evs = buildDayEvents(D, [slotBooking("a", "09:00", "09:30"), freeBooking("b", "10:00", "10:30")], []);
  check("toma citas con slot Y libres", evs.map(e => e.id), ["a", "b"]);

  const otherDay = { ...slotBooking("x", "09:00", "09:30"), slot: { date: "2026-08-04T00:00:00.000Z", startTime: "09:00", endTime: "09:30", duration: 30 } };
  check("descarta otro día", buildDayEvents(D, [otherDay], []).length, 0);

  const ext = buildDayEvents(D, [slotBooking("c", "09:00", "09:30", "CONFIRMED", 90)], []);
  check("blockEndMin usa extendedBlockMinutes", [ext[0].endMin, ext[0].blockEndMin], [570, 630]);

  const noExt = buildDayEvents(D, [slotBooking("d", "09:00", "09:30", "CONFIRMED", 15)], []);
  check("extendedBlockMinutes menor que la duración no encoge", noExt[0].blockEndMin, 570);

  check("bloqueos entran como evento", buildDayEvents(D, [], [block("bt", "13:00", "14:00")]).map(e => e.kind), ["blocked"]);
}

console.log("\nlayoutDayEvents");
{
  const seq = layoutDayEvents(buildDayEvents(D, [slotBooking("a", "09:00", "09:30"), slotBooking("b", "10:00", "10:30")], []));
  check("sin traslape → 1 columna cada uno", seq.map(e => [e.col, e.cols]), [[0, 1], [0, 1]]);

  const over = layoutDayEvents(buildDayEvents(D, [slotBooking("a", "09:00", "10:00"), freeBooking("b", "09:30", "10:30")], []));
  check("traslape → 2 columnas", over.map(e => [e.col, e.cols]), [[0, 2], [1, 2]]);

  const triple = layoutDayEvents(buildDayEvents(D, [
    slotBooking("a", "09:00", "10:00"), freeBooking("b", "09:15", "10:15"), freeBooking("c", "09:30", "10:30"),
  ], []));
  check("triple traslape → 3 columnas", triple.map(e => e.cols), [3, 3, 3]);

  // Contiguo NO es traslape: 09:00–09:30 y 09:30–10:00 deben ir a ancho completo.
  const touching = layoutDayEvents(buildDayEvents(D, [slotBooking("a", "09:00", "09:30"), slotBooking("b", "09:30", "10:00")], []));
  check("citas contiguas no se parten", touching.map(e => e.cols), [1, 1]);

  // El bloqueo extendido ocupa carril aunque la consulta ya terminó.
  const extOverlap = layoutDayEvents(buildDayEvents(D, [
    slotBooking("a", "09:00", "09:30", "CONFIRMED", 60), freeBooking("b", "09:45", "10:15"),
  ], []));
  check("la cola del bloqueo extendido reserva carril", extOverlap.map(e => e.cols), [2, 2]);
}

console.log("\ncomputeFreeGaps");
{
  const g1 = computeFreeGaps([range("09:00", "12:00")], buildDayEvents(D, [slotBooking("a", "10:00", "10:30")], []));
  check("hueco antes y después", g1.map(g => `${minToTime(g.start)}-${minToTime(g.end)}`), ["09:00-10:00", "10:30-12:00"]);

  const g2 = computeFreeGaps([range("09:00", "12:00")], buildDayEvents(D, [slotBooking("a", "10:00", "10:30", "CANCELLED")], []));
  check("una cancelada libera el hueco", g2.map(g => `${minToTime(g.start)}-${minToTime(g.end)}`), ["09:00-12:00"]);

  const g3 = computeFreeGaps([range("09:00", "12:00")], buildDayEvents(D, [slotBooking("a", "10:00", "10:30", "CONFIRMED", 90)], []));
  check("el bloqueo extendido recorta el hueco", g3.map(g => `${minToTime(g.start)}-${minToTime(g.end)}`), ["09:00-10:00", "11:30-12:00"]);

  const g4 = computeFreeGaps([range("09:00", "12:00")], buildDayEvents(D, [], [block("bt", "10:00", "11:00")]));
  check("un bloqueo recorta el hueco", g4.map(g => `${minToTime(g.start)}-${minToTime(g.end)}`), ["09:00-10:00", "11:00-12:00"]);

  const g5 = computeFreeGaps([range("09:00", "12:00")], buildDayEvents(D, [slotBooking("a", "09:00", "11:50")], []));
  check("descarta huecos menores a 15 min", g5.length, 0);

  const g6 = computeFreeGaps([range("09:00", "11:00"), range("16:00", "18:00")], buildDayEvents(D, [slotBooking("a", "16:30", "17:00")], []));
  check("dos rangos del mismo día", g6.map(g => `${minToTime(g.start)}-${minToTime(g.end)}`), ["09:00-11:00", "16:00-16:30", "17:00-18:00"]);

  // Una cita FUERA de todo rango no debe inventar hueco ni romper el recorte.
  const g7 = computeFreeGaps([range("09:00", "11:00")], buildDayEvents(D, [slotBooking("a", "14:00", "14:30")], []));
  check("cita fuera de rango no afecta", g7.map(g => `${minToTime(g.start)}-${minToTime(g.end)}`), ["09:00-11:00"]);
}

console.log("\nlos DOS predicados (el bug de la vista de año)");
{
  // El bug real: la densidad del año usaba el conjunto de "libera el horario", que incluye
  // COMPLETED —el estado de TODA consulta ya realizada— y pintaba en blanco todo el pasado.
  check("COMPLETED libera el horario", FREES_THE_SLOT.has("COMPLETED"), true);
  check("COMPLETED SÍ es carga de trabajo", NO_WORKLOAD.has("COMPLETED"), false);
  check("CANCELLED no es carga", NO_WORKLOAD.has("CANCELLED"), true);
  check("NO_SHOW no es carga", NO_WORKLOAD.has("NO_SHOW"), true);
  check("CONFIRMED es carga y ocupa", [NO_WORKLOAD.has("CONFIRMED"), FREES_THE_SLOT.has("CONFIRMED")], [false, false]);
  // Si alguien vuelve a fundirlos, esto truena.
  check("los conjuntos NO son iguales", FREES_THE_SLOT.size === NO_WORKLOAD.size, false);

  // Réplica del conteo de YearGrid: un día con sólo consultas COMPLETED debe contar.
  const pasado = ["COMPLETED", "COMPLETED", "CANCELLED"].filter((s) => !NO_WORKLOAD.has(s)).length;
  check("un día pasado con 2 consultas hechas cuenta 2", pasado, 2);
}

console.log("\ncanceladas fuera del calendario");
{
  const evs = buildDayEvents(D, [
    slotBooking("viva", "09:00", "09:30", "CONFIRMED"),
    slotBooking("cancelada", "10:00", "10:30", "CANCELLED"),
    slotBooking("hecha", "11:00", "11:30", "COMPLETED"),
    slotBooking("faltó", "12:00", "12:30", "NO_SHOW"),
  ], []);
  check("la cancelada no se dibuja", evs.map(e => e.id), ["viva", "hecha", "faltó"]);
  check("COMPLETED y NO_SHOW SÍ se dibujan (son registro)",
    evs.filter(e => e.status === "COMPLETED" || e.status === "NO_SHOW").length, 2);

  // El horario de una cancelada debe quedar agendable — antes se lograba porque
  // FREES_THE_SLOT la excluía de las ventanas ocupadas; ahora ni siquiera llega. Mismo
  // resultado por otro camino, así que esto blinda el comportamiento, no el mecanismo.
  const gaps = computeFreeGaps([range("09:00", "12:00")],
    buildDayEvents(D, [slotBooking("c", "10:00", "10:30", "CANCELLED")], []));
  check("el horario de una cancelada queda libre", gaps.map(g => `${minToTime(g.start)}-${minToTime(g.end)}`), ["09:00-12:00"]);

  // Una COMPLETED libera el horario Y SIGUE dibujándose: el rango entero queda como UN
  // hueco continuo de 09:00 a 12:00, con el bloque de la cita encima justo en 10:00–10:30.
  // Ese solape es DELIBERADO: el bloque se queda el clic (nadie agenda hacia atrás) a cambio
  // de conservar su tooltip, que en Semana es lo único que deja leer el nombre truncado.
  const completada = [slotBooking("h", "10:00", "10:30", "COMPLETED")];
  const gapsCompletada = computeFreeGaps([range("09:00", "12:00")], buildDayEvents(D, completada, []));
  check("una COMPLETED libera todo el rango pero sigue dibujada encima",
    [
      gapsCompletada.map(g => `${minToTime(g.start)}-${minToTime(g.end)}`),
      buildDayEvents(D, completada, []).length,
    ],
    [["09:00-12:00"], 1]);
}

console.log(failures === 0 ? "\nTODO OK\n" : `\n${failures} FALLA(S)\n`);
process.exit(failures === 0 ? 0 : 1);
