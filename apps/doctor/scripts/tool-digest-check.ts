/**
 * Verificación de `agenda-agent/tool-digest.ts` — la capa que garantiza que a
 * `agent_tool_calls` no llegue ningún dato de paciente.
 *
 * DOS pasadas:
 *
 *   npx tsx scripts/tool-digest-check.ts
 *     → solo la pasada PURA (casos sintéticos). No necesita BD ni API.
 *
 *   railway run --service pgvector -- npx tsx scripts/tool-digest-check.ts
 *     → además el TRIPWIRE: corre tools de verdad contra prod (READ-ONLY),
 *       pasa cada resultado por digestResult y exige que en el digest no
 *       aparezca NADA del paciente.
 *
 * Por qué las dos: la pasada pura solo prueba los payloads que a alguien se le
 * ocurrieron, y ese es exactamente el modo en que se coló la fuga de `error`
 * en review — nadie imaginó que `modules/facturas.ts:1442` interpolaba el
 * NOMBRE del paciente dentro del texto del error. El tripwire no depende de
 * imaginación: toma los nombres/correos/teléfonos REALES de la BD y verifica
 * que ninguno sobreviva al digest. Idea tomada del tripwire de privacidad de
 * `expediente-smoke.ts` (05-REFERENCIA-TECNICA §10), generalizada de "campos
 * clínicos por nombre" a "los datos que de verdad están en prod".
 */

import { redactInput, digestResult } from '../src/lib/agenda-agent/tool-digest';

let fails = 0;
const check = (name: string, cond: boolean, got?: unknown) => {
  if (!cond) {
    fails++;
    console.log('  FAIL', name, got !== undefined ? JSON.stringify(got) : '');
  } else {
    console.log('  ok  ', name);
  }
};

console.log('\n--- redactInput: se conserva lo seguro ---');
const r1 = redactInput({ startDate: '2026-08-01', endDate: '2026-08-08', serviceId: 'cmox123' });
check('fechas e ids', r1.startDate === '2026-08-01' && r1.serviceId === 'cmox123', r1);
const r5 = redactInput({ daysOfWeek: [0, 1, 2], mode: 'recurring' });
check('arreglo de escalares', JSON.stringify(r5.daysOfWeek) === '[0,1,2]', r5);
check('arreglo numérico largo NO se vuelve mixto',
  (redactInput({ daysOfWeek: Array.from({ length: 30 }, (_, i) => i) }).daysOfWeek as unknown[])
    .every((x) => typeof x === 'number'));

console.log('\n--- redactInput: NO se guarda lo que identifica ---');
// ⚠️ Estas llaves son las REALES de los schemas de las tools, no inventadas:
// `patientName/patientEmail/patientPhone/patientWhatsapp` son de
// propose_create_booking (proposals.ts:219-223) y propose_reschedule_booking
// (:266-268); `query` es la de find_patient (tools.ts:133). Probar con nombres
// aproximados ("email", "telefono") daba confianza falsa: verificaba llaves que
// ninguna tool manda — la misma trampa que la llave inventada `motivo_bloqueo`.
const r2 = redactInput({
  patientName: 'Pepito Pérez',
  patientEmail: 'p@x.com',
  patientPhone: '5512345678',
  patientWhatsapp: '5512345678',
});
check('patientName', r2.patientName === '<string:12>', r2);
check('patientEmail', r2.patientEmail === '<string:7>', r2);
check('patientPhone', r2.patientPhone === '<string:10>', r2);
check('patientWhatsapp', r2.patientWhatsapp === '<string:10>', r2);
check('query de find_patient (nombre del paciente)',
  redactInput({ query: 'Pérez' }).query === '<string:5>');
const r3 = redactInput({ bookingId: 'b1', motivo: 'dolor de pecho', notas: 'paciente diabético' });
check('motivo clínico', r3.motivo === '<string:14>', r3);
check('notas clínicas', r3.notas === '<string:18>', r3);
check('bookingId sí se conserva', r3.bookingId === 'b1', r3);
check('llave desconocida = default-deny',
  redactInput({ campoDeUnaToolFutura: 'lo que sea' }).campoDeUnaToolFutura === '<string:10>');

console.log('\n--- digestResult: get_availability (bitácora 2026-07-31) ---');
const datesOnly = digestResult({
  nota: 'Sin servicio especificado: calculado con el más corto (Consulta de Seguimiento, 30 min).',
  bufferMinutos: 0,
  servicio: null,
  fechasDisponibles: ['2026-08-03', '2026-08-04'],
  horarios: {},
});
console.log('  ', JSON.stringify(datesOnly));
check('nota se conserva', typeof datesOnly.nota === 'string');
check('fechas se conservan', JSON.stringify(datesOnly.fechasDisponibles) === '["2026-08-03","2026-08-04"]');
check('conteo de fechas', datesOnly.fechasDisponibles_n === 2);

const empty = digestResult({ nota: null, bufferMinutos: 0, fechasDisponibles: [], horarios: {} });
console.log('  ', JSON.stringify(empty));
check('“modo solo-fechas” y “vacío real” son distinguibles',
  empty.fechasDisponibles_n === 0 && datesOnly.fechasDisponibles_n === 2);
check('mapa fecha->slots se resume por fecha',
  JSON.stringify(digestResult({ horarios: { '2026-08-05': [{ startTime: '11:00' }] } }).horarios_fechas)
    === '["2026-08-05"]');

console.log('\n--- digestResult: payloads CON datos de paciente ---');
const citas = digestResult({
  totalEncontradas: 2,
  mostradas: 2,
  citas: [
    { paciente: 'Pepito Pérez', telefono: '5512345678', inicio: '11:00' },
    { paciente: 'test 7', email: 'a@b.com', inicio: '09:00' },
  ],
});
console.log('  ', JSON.stringify(citas));
let blob = JSON.stringify(citas);
check('ningún nombre sobrevive', !blob.includes('Pepito') && !blob.includes('test 7'), blob);
check('ningún contacto sobrevive', !blob.includes('5512345678') && !blob.includes('a@b.com'), blob);
check('pero sí los conteos', citas.citas_n === 2 && citas.totalEncontradas === 2);

// REGRESIÓN — fuga encontrada en review: modules/facturas.ts:1442 mete el
// nombre del paciente dentro del texto de `error`, en el carácter ~22.
const errLeak = digestResult({
  error: 'Los datos fiscales de Pepito Pérez están incompletos — faltan: rfc, régimen fiscal.',
  camposFaltantes: ['rfc', 'regimenFiscal'],
});
console.log('  ', JSON.stringify(errLeak));
blob = JSON.stringify(errLeak);
check('el TEXTO de error no se guarda', !blob.includes('Pepito'), blob);
check('pero sí que hubo error y su tamaño', typeof errLeak.error === 'string' && (errLeak.error as string).startsWith('<string:'));
check('camposFaltantes queda como conteo', errLeak.camposFaltantes_n === 2);

console.log('\n--- bordes ---');
check('null', JSON.stringify(digestResult(null)) === '{"vacio":true}');
const wide: Record<string, unknown> = {};
for (let i = 0; i < 400; i++) wide['k' + i] = 'x'.repeat(50);
const wideD = digestResult(wide);
check('payload ancho se trunca', wideD.truncado === true);
check('y el fallback queda acotado', JSON.stringify(wideD).length < 600, JSON.stringify(wideD).length);

// ---------------------------------------------------------------------------
// TRIPWIRE contra prod (solo con DATABASE_PUBLIC_URL) — READ-ONLY.
// ---------------------------------------------------------------------------

/** Campos de contenido clínico que jamás deben aparecer — misma lista que el
 * tripwire de `expediente-smoke.ts`, por nombre de campo. */
const BANNED_FIELDS = [
  'subjective', 'objective', 'assessment', 'chiefComplaint', 'clinicalNotes',
  'diagnosis', 'currentAllergies', 'currentMedications', 'currentChronicConditions', 'bloodType',
];

/** Tools de LECTURA que tocan datos de paciente. Inputs mínimos y reales. */
async function tripwire(): Promise<void> {
  process.env.DATABASE_URL = process.env.DATABASE_PUBLIC_URL!;
  process.env.NEXT_PUBLIC_API_URL =
    process.env.NEXT_PUBLIC_API_URL && !process.env.NEXT_PUBLIC_API_URL.includes('localhost')
      ? process.env.NEXT_PUBLIC_API_URL
      : 'https://healthcareapi-production-fb70.up.railway.app';

  const { dispatchReadTool, FULL_SCOPE } = await import('../src/lib/agenda-agent/modules/registry');
  const { prisma } = await import('@healthcare/database');

  const doctorId = 'cmni1bov90000mk0lyeztr3ad'; // dr-prueba
  // Tipado de verdad (no `as never`): si ToolContext cambia, esto truena en
  // type-check en vez de fallar en vivo con un campo faltante.
  const ctx: import('../src/lib/agenda-agent/tools').ToolContext = {
    doctorId,
    doctorSlug: 'dr-prueba',
    apiToken: null,
    tier: FULL_SCOPE.tier,
  };

  // Valores REALES de prod que no deben sobrevivir al digest. Se descartan los
  // cortos (<5) para no generar falsos positivos por subcadena.
  const patients = await prisma.patient.findMany({
    where: { doctorId },
    select: { firstName: true, lastName: true, email: true, phone: true },
    take: 60,
  });
  const secrets = [
    ...new Set(
      patients
        .flatMap((p) => [p.firstName, p.lastName, p.email, p.phone])
        .filter((v): v is string => typeof v === 'string' && v.trim().length >= 5)
        .map((v) => v.trim())
    ),
  ];
  console.log(`\n--- TRIPWIRE contra prod: ${secrets.length} valores reales de paciente vigilados ---`);
  // Sin valores que vigilar, TODOS los checks de abajo pasarían por vacuidad —
  // el mismo modo de falla que el `skip` silencioso de find_patient: verde sin
  // haber verificado nada.
  check('hay valores reales que vigilar', secrets.length > 0, secrets.length);

  const today = new Date().toISOString().slice(0, 10);
  const calls: [string, Record<string, unknown>][] = [
    ['get_day_schedule', { date: today }],
    ['get_bookings', { startDate: today }],
    ['get_bookings', { vencidas: true }],
    ['get_availability', { startDate: today }],
    ['get_ranges', { startDate: today, endDate: today }],
    ['get_services', {}],
    ['get_pacientes_overview', {}],
  ];
  // find_patient con un apellido REAL: el peor caso del tripwire — el resultado
  // son datos de contacto puros, y además el input se ecoa. La llave es `query`
  // (tools.ts:133); pasarla mal hacía que la tool tronara y el caso se SALTARA
  // en silencio, que es justo lo que no queremos de un tripwire.
  const someLastName = patients.find((p) => (p.lastName ?? '').length >= 5)?.lastName;
  if (someLastName) calls.push(['find_patient', { query: someLastName }]);

  for (const [name, input] of calls) {
    let result: unknown;
    try {
      result = await dispatchReadTool(ctx, name, input);
    } catch (err) {
      // NO se salta en silencio: un tripwire que omite el caso que más importa
      // (pasó con find_patient y una llave de input mal escrita) no vigila nada.
      check(`${name} — la tool corrió`, false, (err as Error).message.slice(0, 80));
      continue;
    }
    const digestJson = JSON.stringify(digestResult(result));
    const inputJson = JSON.stringify(redactInput(input));
    const both = digestJson + inputJson;

    const leakedFields = BANNED_FIELDS.filter((b) => both.includes(b));
    const leakedValues = secrets.filter((s) => both.includes(s));
    const rawBytes = JSON.stringify(result ?? null).length;

    check(
      `${name} — sin campos clínicos`,
      leakedFields.length === 0,
      leakedFields.length ? leakedFields : undefined
    );
    check(
      `${name} — sin datos reales de paciente`,
      leakedValues.length === 0,
      leakedValues.length ? leakedValues : undefined
    );
    console.log(`         ${rawBytes} bytes crudos → ${digestJson.length} de digest`);
  }

  await prisma.$disconnect();
}

(async () => {
  if (process.env.DATABASE_PUBLIC_URL) {
    await tripwire();
  } else {
    console.log(
      '\n(TRIPWIRE omitido — corre con `railway run --service pgvector -- npx tsx scripts/tool-digest-check.ts`\n para verificarlo también contra datos reales de prod.)'
    );
  }
  console.log(fails === 0 ? '\nTODO OK' : `\n${fails} FALLAS`);
  process.exit(fails === 0 ? 0 : 1);
})();
