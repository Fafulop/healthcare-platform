// T1 probe — runs create-tratamientos.sql + 14 checks inside ONE transaction that ALWAYS rolls back.
// Nothing is left in prod. Each rejection must fail with ITS SQLSTATE and ITS constraint.
const fs = require('fs');
const url = process.env.DATABASE_PUBLIC_URL || process.env.DATABASE_URL;
const { PrismaClient, Prisma } = require(require('path').join(__dirname, '../../packages/database/node_modules/@prisma/client'));
// Rellena TODOS los campos obligatorios sin default de un modelo, leyendo el DMMF de Prisma.
function relleno(modelo, datos) {
  const m = Prisma.dmmf.datamodel.models.find((x) => x.name === modelo);
  const out = { ...datos };
  for (const f of m.fields) {
    if (f.kind !== 'scalar' && f.kind !== 'enum') continue;
    if (!f.isRequired || f.hasDefaultValue || f.isUpdatedAt || f.name in out) continue;
    if (f.isList) { out[f.name] = []; continue; }
    if (f.kind === 'enum') { out[f.name] = Prisma.dmmf.datamodel.enums.find((e) => e.name === f.type).values[0].name; continue; }
    out[f.name] = ({ String: 'probe', Int: 1, Float: 1, Boolean: false, DateTime: new Date('2026-01-01'), Json: {}, Decimal: 0, BigInt: 1 })[f.type];
  }
  return out;
}
const prisma = new PrismaClient({ datasources: { db: { url } } });
const SQL = fs.readFileSync(require('path').join(__dirname, '../../packages/database/prisma/migrations/create-tratamientos.sql'), 'utf8');

// Split into top-level statements: respects -- comments and $$ … $$ bodies.
function statements(sql) {
  const out = []; let cur = ''; let inDollar = false;
  const lines = sql.split(/\r?\n/);
  for (const raw of lines) {
    const line = inDollar ? raw : raw.replace(/--.*$/, '');
    cur += line + '\n';
    const n = (line.match(/\$\$/g) || []).length;
    if (n % 2 === 1) inDollar = !inDollar;
    if (!inDollar && /;\s*$/.test(line)) { if (cur.trim().replace(/;$/, '').trim()) out.push(cur.trim()); cur = ''; }
  }
  if (cur.trim()) out.push(cur.trim());
  return out;
}

const ROLLBACK = new Error('ROLLBACK (intencional)');
const results = [];
const ok = (name, cond, extra = '') => results.push({ name, pass: !!cond, extra });

(async () => {
  try {
    await prisma.$transaction(async (tx) => {
      const run = (s) => tx.$executeRawUnsafe(s);
      const q = (s) => tx.$queryRawUnsafe(s);
      const stmts = statements(SQL);
      for (const s of stmts) await run(s);
      for (const s of stmts) await run(s);           // T1-13 idempotente
      ok('T1-13 idempotente (2 corridas)', true, `${stmts.length} sentencias`);

      // expect a failure with SQLSTATE + constraint, inside a savepoint
      let sp = 0;
      const rechaza = async (name, sql, code, constraint) => {
        const s = `sp${++sp}`; await run(`SAVEPOINT ${s}`);
        try { await run(sql); await run(`ROLLBACK TO SAVEPOINT ${s}`); ok(name, false, 'NO rebotó'); }
        catch (e) {
          await run(`ROLLBACK TO SAVEPOINT ${s}`);
          const msg = String(e.message); const got = e.meta?.code || (msg.match(/Code: `(\w+)`/) || [])[1];
          const det = JSON.stringify(e.meta || {});
          const nombra = msg.includes(constraint) || det.includes(constraint);
          ok(name, got === code && nombra, `${got} ${constraint}${nombra ? '' : ' (NO en el mensaje) · ' + msg.split(String.fromCharCode(10)).filter((l) => /duplicate|violat|Key|constraint|Code/i.test(l)).join(' | ').slice(0, 300) + ' · meta ' + det.slice(0, 200)}`);
        }
      };

      // Fixtures (todas dentro de la tx)
      const doc = (slug) => tx.doctor.create({ data: relleno('Doctor', { slug }) });
      const D1 = await doc('probe-t1-d1-' + Date.now()), D2 = await doc('probe-t1-d2-' + Date.now());
      const pac = (d, n) => tx.patient.create({ data: relleno('Patient', { doctorId: d.id, internalId: 'PROBE-' + n + '-' + Date.now(), lastName: n }) });
      const P1a = await pac(D1, 'a'), P1b = await pac(D1, 'b'), P2 = await pac(D2, 'c');
      const cita = (d, p) => tx.booking.create({ data: relleno('Booking', { doctorId: d.id, patientId: p.id }) });
      const B1 = await cita(D1, P1a), B2 = await cita(D2, P2);
      const vis = (d, p) => tx.visita.create({ data: { doctorId: d.id, patientId: p.id, fecha: new Date('2026-09-29'), origen: 'manual' } });
      const V1a = await vis(D1, P1a), V1b = await vis(D1, P1b), V1a2 = await vis(D1, P1a);
      const TT = await tx.encounterTemplate.create({ data: relleno('EncounterTemplate', { doctorId: D1.id, name: 'probe-' + Date.now() }) });

      const insT = (id, p, d, extra = '') => `INSERT INTO medical_records.tratamientos (id, patient_id, doctor_id, nombre${extra ? ', plantilla_sugerida_id' : ''}) VALUES ('${id}', '${p}', '${d}', 'probe'${extra ? `, '${extra}'` : ''})`;
      const insS = (id, t, p, d, n, b = null, v = null) => `INSERT INTO medical_records.tratamiento_sesiones (id, tratamiento_id, patient_id, doctor_id, numero, booking_id, visita_id) VALUES ('${id}', '${t}', '${p}', '${d}', ${n}, ${b ? `'${b}'` : 'NULL'}, ${v ? `'${v}'` : 'NULL'})`;

      await rechaza('T1-1 tratamiento con paciente de otro doctor', insT('trX', P2.id, D1.id), '23503', 'tratamientos_patient_id_doctor_id_fkey');
      await run(insT('tr1', P1a.id, D1.id, TT.id));
      await rechaza('T1-2 sesión con paciente ≠ el del tratamiento', insS('sX', 'tr1', P1b.id, D1.id, 9), '23503', 'tratamiento_sesiones_tratamiento_id_patient_id_fkey');
      await run(insS('s1', 'tr1', P1a.id, D1.id, 1, B1.id));
      await rechaza('T1-3a misma cita en dos sesiones', insS('sX', 'tr1', P1a.id, D1.id, 2, B1.id), '23505', 'Key (booking_id)=');
      await rechaza('T1-3b número repetido', insS('sX', 'tr1', P1a.id, D1.id, 1), '23505', 'Key (tratamiento_id, numero)=');
      await run(insS('s2', 'tr1', P1a.id, D1.id, 2, null, V1a.id));
      await rechaza('T1-3c misma visita en dos sesiones', insS('sX', 'tr1', P1a.id, D1.id, 3, null, V1a.id), '23505', 'Key (visita_id)=');
      await rechaza('T1-4a cita de OTRO doctor', insS('sX', 'tr1', P1a.id, D1.id, 4, B2.id), '23503', 'tratamiento_sesiones_booking_id_doctor_id_fkey');
      await rechaza('T1-4b doctor_id de la sesión ≠ el del paciente', insS('sX', 'tr1', P1a.id, D2.id, 4), '23503', 'tratamiento_sesiones_patient_id_doctor_id_fkey');
      await rechaza('T1-5 visita de OTRO paciente', insS('sX', 'tr1', P1a.id, D1.id, 4, null, V1b.id), '23503', 'tratamiento_sesiones_visita_id_patient_id_fkey');
      await rechaza('CHECK número > 0', insS('sX', 'tr1', P1a.id, D1.id, 0), '23514', 'tratamiento_sesiones_numero_check');
      await rechaza('CHECK estado', `UPDATE medical_records.tratamientos SET estado='raro' WHERE id='tr1'`, '23514', 'tratamientos_estado_check');
      await rechaza('CHECK sesiones_planeadas > 0', `UPDATE medical_records.tratamientos SET sesiones_planeadas=0 WHERE id='tr1'`, '23514', 'tratamientos_sesiones_planeadas_check');
      await rechaza('CHECK intervalo_dias > 0', `UPDATE medical_records.tratamientos SET intervalo_dias=0 WHERE id='tr1'`, '23514', 'tratamientos_intervalo_dias_check');
      await rechaza('CHECK precio_paquete >= 0', `UPDATE medical_records.tratamientos SET precio_paquete=-1 WHERE id='tr1'`, '23514', 'tratamientos_precio_paquete_check');
      // y los bordes válidos pasan (precio 0 sí; 1 sesión sí; intervalo 1 sí)
      await run(`UPDATE medical_records.tratamientos SET sesiones_planeadas=1, intervalo_dias=1, precio_paquete=0 WHERE id='tr1'`);
      ok('CHECK bordes válidos (1 sesión, intervalo 1, precio 0) pasan', true);

      await tx.booking.delete({ where: { id: B1.id } });
      const [s1] = await q(`SELECT booking_id FROM medical_records.tratamiento_sesiones WHERE id='s1'`);
      ok('T1-6 borrar la cita → la sesión sigue, booking_id NULL', s1 && s1.booking_id === null);

      await tx.visita.delete({ where: { id: V1a.id } });
      const [s2] = await q(`SELECT visita_id FROM medical_records.tratamiento_sesiones WHERE id='s2'`);
      ok('T1-7 borrar la visita → la sesión sigue, visita_id NULL', s2 && s2.visita_id === null);

      await tx.encounterTemplate.delete({ where: { id: TT.id } });
      const [t1] = await q(`SELECT plantilla_sugerida_id FROM medical_records.tratamientos WHERE id='tr1'`);
      ok('T1-12 borrar la plantilla sugerida → NULL', t1 && t1.plantilla_sugerida_id === null);

      const B3 = await cita(D1, P1a);
      await run(insS('s4', 'tr1', P1a.id, D1.id, 4, B3.id));
      const sp11 = `sp${++sp}`; await run(`SAVEPOINT ${sp11}`);
      try { await tx.booking.update({ where: { id: B3.id }, data: { patientId: P1b.id } }); ok('T1-11 re-ligar el paciente de una cita que es sesión NO se bloquea', true); }
      catch (e) { await run(`ROLLBACK TO SAVEPOINT ${sp11}`); ok('T1-11 re-ligar el paciente de una cita que es sesión NO se bloquea', false, String(e.message).slice(0, 200)); }

      const V1a3 = await vis(D1, P1a);
      await run(insS('s8', 'tr1', P1a.id, D1.id, 8, null, V1a3.id));   // sesión de tr1 CON visita viva
      await run(`DELETE FROM medical_records.tratamientos WHERE id='tr1'`);
      const [{ n: sesTr1 }] = await q(`SELECT count(*)::int n FROM medical_records.tratamiento_sesiones WHERE tratamiento_id='tr1'`);
      const b3 = await tx.booking.findUnique({ where: { id: B3.id } }); const v1a3 = await tx.visita.findUnique({ where: { id: V1a3.id } });
      ok('T1-8 borrar el tratamiento → sus sesiones se van; su cita (s4) y su visita (s8) quedan', sesTr1 === 0 && !!b3 && !!v1a3,
        `sesiones ${sesTr1} · cita ${!!b3} · visita ${!!v1a3}`);

      // T1-9: paciente con tratamiento + sesión con cita + sesión con visita → borrar el paciente
      const B4 = await cita(D1, P1a);
      await run(insT('tr2', P1a.id, D1.id));
      await run(insS('s5', 'tr2', P1a.id, D1.id, 1, B4.id));
      await run(insS('s6', 'tr2', P1a.id, D1.id, 2, null, V1a2.id));
      const sp9 = `sp${++sp}`; await run(`SAVEPOINT ${sp9}`);
      try {
        await tx.patient.delete({ where: { id: P1a.id } });
        const [{ n }] = await q(`SELECT (SELECT count(*) FROM medical_records.tratamientos WHERE patient_id='${P1a.id}') + (SELECT count(*) FROM medical_records.tratamiento_sesiones WHERE patient_id='${P1a.id}') AS n`);
        ok('T1-9 borrar el paciente → no truena y no queda nada suyo', Number(n) === 0, `restan ${n}`);
      } catch (e) { await run(`ROLLBACK TO SAVEPOINT ${sp9}`); ok('T1-9 borrar el paciente → no truena y no queda nada suyo', false, String(e.message).slice(0, 300)); }

      // T1-10: doctor con paciente + tratamiento + sesión con cita → borrar el doctor
      const V2 = await vis(D2, P2);
      await run(insT('tr3', P2.id, D2.id));
      await run(insS('s7', 'tr3', P2.id, D2.id, 1, B2.id));
      await run(insS('s9', 'tr3', P2.id, D2.id, 2, null, V2.id));
      const sp10 = `sp${++sp}`; await run(`SAVEPOINT ${sp10}`);
      try {
        await tx.doctor.delete({ where: { id: D2.id } });
        const [{ n }] = await q(`SELECT (SELECT count(*) FROM medical_records.tratamientos WHERE doctor_id='${D2.id}') + (SELECT count(*) FROM medical_records.tratamiento_sesiones WHERE doctor_id='${D2.id}') + (SELECT count(*) FROM medical_records.visitas WHERE doctor_id='${D2.id}') + (SELECT count(*) FROM public.bookings WHERE doctor_id='${D2.id}') AS n`);
        ok('T1-10 borrar el doctor (sesión con cita + sesión con visita) → no truena y no queda nada suyo', Number(n) === 0, `restan ${n}`);
      } catch (e) { await run(`ROLLBACK TO SAVEPOINT ${sp10}`); ok('T1-10 borrar el doctor → no truena', false, String(e.message).slice(0, 300)); }

      // T1-14 estructura exacta
      const defs = await q(`SELECT conname, pg_get_constraintdef(oid) def FROM pg_constraint
        WHERE conrelid IN ('medical_records.tratamientos'::regclass, 'medical_records.tratamiento_sesiones'::regclass) AND contype='f' ORDER BY conname`);
      const esperado = {
        tratamientos_patient_id_doctor_id_fkey: 'FOREIGN KEY (patient_id, doctor_id) REFERENCES medical_records.patients(id, doctor_id) ON DELETE CASCADE',
        tratamientos_plantilla_sugerida_id_fkey: 'FOREIGN KEY (plantilla_sugerida_id) REFERENCES medical_records.encounter_templates(id) ON DELETE SET NULL',
        tratamientos_doctor_id_fkey: 'FOREIGN KEY (doctor_id) REFERENCES doctors(id) ON DELETE CASCADE',
        tratamiento_sesiones_patient_id_doctor_id_fkey: 'FOREIGN KEY (patient_id, doctor_id) REFERENCES medical_records.patients(id, doctor_id) ON DELETE CASCADE',
        tratamiento_sesiones_tratamiento_id_patient_id_fkey: 'FOREIGN KEY (tratamiento_id, patient_id) REFERENCES medical_records.tratamientos(id, patient_id) ON DELETE CASCADE',
        tratamiento_sesiones_booking_id_doctor_id_fkey: 'FOREIGN KEY (booking_id, doctor_id) REFERENCES bookings(id, doctor_id) ON DELETE SET NULL (booking_id)',
        tratamiento_sesiones_visita_id_patient_id_fkey: 'FOREIGN KEY (visita_id, patient_id) REFERENCES medical_records.visitas(id, patient_id) ON DELETE SET NULL (visita_id)',
      };
      const got = Object.fromEntries(defs.map((d) => [d.conname, d.def]));
      const faltan = Object.entries(esperado).filter(([k, v]) => got[k] !== v);
      const sobran = Object.keys(got).filter((k) => !(k in esperado));
      ok('T1-14a FKs con su definición exacta', faltan.length === 0 && sobran.length === 0,
        JSON.stringify({ distintas: faltan.map(([k]) => [k, got[k] || 'NO EXISTE']), sobran }));
      const checks = await q(`SELECT conname, pg_get_constraintdef(oid) def FROM pg_constraint
        WHERE conrelid IN ('medical_records.tratamientos'::regclass, 'medical_records.tratamiento_sesiones'::regclass) AND contype='c' ORDER BY conname`);
      const chkEsperado = {
        tratamientos_estado_check: "CHECK (((estado)::text = ANY ((ARRAY['activo'::character varying, 'terminado'::character varying, 'cancelado'::character varying])::text[])))",
        tratamientos_sesiones_planeadas_check: 'CHECK (((sesiones_planeadas IS NULL) OR (sesiones_planeadas > 0)))',
        tratamientos_intervalo_dias_check: 'CHECK (((intervalo_dias IS NULL) OR (intervalo_dias > 0)))',
        tratamientos_precio_paquete_check: 'CHECK (((precio_paquete IS NULL) OR (precio_paquete >= (0)::numeric)))',
        tratamiento_sesiones_numero_check: 'CHECK ((numero > 0))',
      };
      const chkGot = Object.fromEntries(checks.map((d) => [d.conname, d.def]));
      const chkMal = Object.entries(chkEsperado).filter(([k, v]) => chkGot[k] !== v).map(([k]) => [k, chkGot[k] || 'NO EXISTE']);
      const chkSobran = Object.keys(chkGot).filter((k) => !(k in chkEsperado));
      ok('T1-14b CHECKs con su definición exacta', chkMal.length === 0 && chkSobran.length === 0, JSON.stringify({ chkMal, chkSobran }));

      const idx = await q(`SELECT c.relname, pg_get_indexdef(i.indexrelid) def FROM pg_index i JOIN pg_class c ON c.oid=i.indexrelid
        WHERE i.indrelid IN ('medical_records.tratamientos'::regclass, 'medical_records.tratamiento_sesiones'::regclass) ORDER BY c.relname`);
      const idxEsperado = {
        tratamientos_pkey: 'CREATE UNIQUE INDEX tratamientos_pkey ON medical_records.tratamientos USING btree (id)',
        tratamientos_patient_id_estado_idx: 'CREATE INDEX tratamientos_patient_id_estado_idx ON medical_records.tratamientos USING btree (patient_id, estado)',
        tratamientos_doctor_id_estado_idx: 'CREATE INDEX tratamientos_doctor_id_estado_idx ON medical_records.tratamientos USING btree (doctor_id, estado)',
        tratamientos_id_patient_id_key: 'CREATE UNIQUE INDEX tratamientos_id_patient_id_key ON medical_records.tratamientos USING btree (id, patient_id)',
        tratamientos_id_doctor_id_key: 'CREATE UNIQUE INDEX tratamientos_id_doctor_id_key ON medical_records.tratamientos USING btree (id, doctor_id)',
        tratamientos_plantilla_sugerida_id_idx: 'CREATE INDEX tratamientos_plantilla_sugerida_id_idx ON medical_records.tratamientos USING btree (plantilla_sugerida_id)',
        tratamiento_sesiones_pkey: 'CREATE UNIQUE INDEX tratamiento_sesiones_pkey ON medical_records.tratamiento_sesiones USING btree (id)',
        tratamiento_sesiones_tratamiento_id_numero_key: 'CREATE UNIQUE INDEX tratamiento_sesiones_tratamiento_id_numero_key ON medical_records.tratamiento_sesiones USING btree (tratamiento_id, numero)',
        tratamiento_sesiones_booking_id_key: 'CREATE UNIQUE INDEX tratamiento_sesiones_booking_id_key ON medical_records.tratamiento_sesiones USING btree (booking_id)',
        tratamiento_sesiones_visita_id_key: 'CREATE UNIQUE INDEX tratamiento_sesiones_visita_id_key ON medical_records.tratamiento_sesiones USING btree (visita_id)',
        tratamiento_sesiones_patient_id_idx: 'CREATE INDEX tratamiento_sesiones_patient_id_idx ON medical_records.tratamiento_sesiones USING btree (patient_id)',
      };
      const idxGot = Object.fromEntries(idx.map((r) => [r.relname, r.def]));
      const idxMal = Object.entries(idxEsperado).filter(([k, v]) => idxGot[k] !== v).map(([k]) => [k, idxGot[k] || 'NO EXISTE']);
      const idxSobran = Object.keys(idxGot).filter((k) => !(k in idxEsperado));
      ok('T1-14c índices con su definición exacta (tabla, columnas, único, sin WHERE)', idxMal.length === 0 && idxSobran.length === 0, JSON.stringify({ idxMal, idxSobran }));

      throw ROLLBACK;
    }, { timeout: 60000, maxWait: 10000 });
  } catch (e) {
    if (e !== ROLLBACK) console.log('ERROR FUERA DE LAS COMPROBACIONES:', String(e.message).slice(0, 800));
  } finally {
    for (const r of results) console.log(r.pass ? 'PASS' : 'FAIL', '·', r.name, r.extra ? '· ' + r.extra : '');
    console.log(`\n${results.filter((r) => r.pass).length}/${results.length} PASS`);
    const quedo = await prisma.$queryRawUnsafe(`SELECT to_regclass('medical_records.tratamientos')::text t, to_regclass('medical_records.tratamiento_sesiones')::text s`);
    console.log('¿quedó algo en prod?', quedo);
    await prisma.$disconnect();
  }
})();
