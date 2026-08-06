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
  buildDayEvents, layoutDayEvents, computeFreeGaps, computeOpenSpans, snapToGrid, minToTime,
  BOOKING_GRID_MINUTES, FREES_THE_SLOT, NO_WORKLOAD,
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

console.log("\ncomputeOpenSpans (clic para agendar FUERA de rango)");
{
  const w = (spans: Array<{ start: number; end: number }>) =>
    spans.map((s) => `${minToTime(s.start)}-${minToTime(s.end)}`);

  // Lo que motivó todo: un día SIN ningún rango publicado tiene que ser clicable entero.
  const s1 = computeOpenSpans(buildDayEvents(D, [], []), 7 * 60, 21 * 60);
  check("día sin rangos ni citas → toda la ventana es clicable", w(s1), ["07:00-21:00"]);
  check("y computeFreeGaps ahí no ofrece NADA (por eso hizo falta)",
    computeFreeGaps([], buildDayEvents(D, [], [])).length, 0);

  const s2 = computeOpenSpans(buildDayEvents(D, [slotBooking("a", "10:00", "10:30")], []), 7 * 60, 21 * 60);
  check("una cita parte la ventana en dos", w(s2), ["07:00-10:00", "10:30-21:00"]);

  const s3 = computeOpenSpans(buildDayEvents(D, [slotBooking("a", "10:00", "10:30", "CANCELLED")], []), 7 * 60, 21 * 60);
  check("una cancelada no parte nada", w(s3), ["07:00-21:00"]);

  const s4 = computeOpenSpans(buildDayEvents(D, [slotBooking("a", "10:00", "10:30", "CONFIRMED", 90)], []), 7 * 60, 21 * 60);
  check("el bloqueo extendido recorta lo clicable", w(s4), ["07:00-10:00", "11:30-21:00"]);

  const s5 = computeOpenSpans(buildDayEvents(D, [], [block("bt", "10:00", "11:00")]), 7 * 60, 21 * 60);
  check("un bloqueo recorta lo clicable", w(s5), ["07:00-10:00", "11:00-21:00"]);

  // Recorte del pasado: la rejilla arranca la ventana en "ahora" para hoy. Un hueco de menos
  // de una celda no se rinde — no habría dónde clicar.
  const s6 = computeOpenSpans(buildDayEvents(D, [], []), 20 * 60 + 50, 21 * 60);
  check("ventana de 10 min → nada clicable", s6.length, 0);
  const s7 = computeOpenSpans(buildDayEvents(D, [], []), 20 * 60 + 45, 21 * 60);
  check("ventana de 15 min → sí", w(s7), ["20:45-21:00"]);
  check("ventana invertida (ya pasó todo el día) → vacío",
    computeOpenSpans(buildDayEvents(D, [], []), 22 * 60, 21 * 60).length, 0);

  // El encuadre de la rejilla se estira con `blockEndMin`, que no tiene tope: una cita de las
  // 22:00 con 150 min de bloqueo extendido lo empuja a las 24:30. Sin recortar al día se
  // ofrecía un hueco cuyas horas `minToTime` rinde como "24:45" — y `<input type="time">` las
  // rechaza, así que el campo llegaba VACÍO y sin explicación.
  const nocturno = computeOpenSpans(buildDayEvents(D, [slotBooking("a", "22:00", "23:00", "CONFIRMED", 150)], []), 7 * 60, 25 * 60);
  check("la ventana se recorta a las 24:00", w(nocturno), ["07:00-22:00"]);
  check("y ninguna hora propuesta se pasa del día",
    nocturno.every((s) => s.end <= 24 * 60 && minToTime(s.end) <= "24:00"), true);
}

console.log("\nsnapToGrid (la rejilla de 15 min ES la afordancia, no el límite)");
{
  const dia = { start: 7 * 60, end: 21 * 60 };
  check("la rejilla es de 15 min", BOOKING_GRID_MINUTES, 15);
  check("16:20 → 16:15 (hacia abajo: se clicó ESE bloque)", minToTime(snapToGrid(16 * 60 + 20, dia)), "16:15");
  check("16:00 exacto se queda", minToTime(snapToGrid(16 * 60, dia)), "16:00");
  check("16:59 → 16:45", minToTime(snapToGrid(16 * 60 + 59, dia)), "16:45");

  // Hueco que empieza en minuto raro (cita que terminó 09:07): nunca se propone una hora
  // ANTERIOR al hueco, que estaría ocupada.
  const raro = { start: 9 * 60 + 7, end: 10 * 60 };
  check("no se cae fuera del hueco por redondear hacia abajo", minToTime(snapToGrid(9 * 60 + 10, raro)), "09:15");

  // Hueco tan corto que ninguna marca de 15 min cae dentro: se propone su inicio REAL. El
  // motor acepta cualquier minuto, así que 09:50 es una propuesta válida — rechazarla sería
  // volver a la rejilla que este trabajo quitó.
  const corto = { start: 9 * 60 + 50, end: 10 * 60 };
  check("hueco sin marca de rejilla → su inicio real", minToTime(snapToGrid(9 * 60 + 55, corto)), "09:50");
  // Mientras SÍ quepa una marca de rejilla, gana la marca aunque el hueco empiece en 16:07:
  // la afordancia es de 15 min. El 16:07 se propone sólo cuando es la ÚNICA hora libre.
  check("con marca dentro, gana la marca", minToTime(snapToGrid(16 * 60 + 9, { start: 16 * 60 + 7, end: 16 * 60 + 20 })), "16:15");
  check("sin marca dentro, sobrevive el 16:07", minToTime(snapToGrid(16 * 60 + 9, { start: 16 * 60 + 7, end: 16 * 60 + 14 })), "16:07");

  // Clic EXACTO en el borde inferior (`clientY === rect.bottom`, alcanzable de verdad en
  // pantallas de DPI fraccionario). El candidato cae justo en el fin del hueco, que no es una
  // hora libre. El remedio es la última marca DENTRO, no el inicio: devolver `span.start`
  // proponía las 07:00 a quien clicó el fondo de una columna de 14 horas.
  check("clic en el borde inferior → la última marca del hueco", minToTime(snapToGrid(21 * 60, dia)), "20:45");
  check("y no se cae al inicio del hueco", minToTime(snapToGrid(21 * 60, dia)) !== "07:00", true);
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
