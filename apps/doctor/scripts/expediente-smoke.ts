/**
 * Smoke test — expediente module query shapes vs PROD (READ-ONLY).
 * Run: railway run --service pgvector -- npx tsx scripts/expediente-smoke.ts
 * Scratch script for the F1 PR; not part of the app.
 */

(async () => {
  if (!process.env.DATABASE_PUBLIC_URL) {
    console.error('Falta DATABASE_PUBLIC_URL — corre con: railway run --service pgvector -- npx tsx scripts/expediente-smoke.ts');
    process.exit(1);
  }
  process.env.DATABASE_URL = process.env.DATABASE_PUBLIC_URL;
  const { expedienteModule } = await import('../src/lib/agenda-agent/modules/expediente');
  const { prisma } = await import('@healthcare/database');

  const ctx = { doctorId: 'cmni1bov90000mk0lyeztr3ad', doctorSlug: 'dr-prueba' };

  // Pick a real patient id (read-only) so the resumen shape runs on live data.
  const anyPatient = await prisma.patient.findFirst({
    where: { doctorId: ctx.doctorId },
    select: { id: true, firstName: true },
    orderBy: { lastVisitDate: 'desc' },
  });
  console.log('paciente de prueba:', anyPatient?.firstName, anyPatient?.id);

  async function run(name: string, input: Record<string, unknown>) {
    const t0 = Date.now();
    try {
      const out = await expedienteModule.executeRead(ctx, name, input);
      const json = JSON.stringify(out);
      console.log(`\n=== ${name} ${JSON.stringify(input)} — ${Date.now() - t0}ms, ${json.length} bytes ===`);
      console.log(json.length > 3000 ? json.slice(0, 3000) + ' …[truncado]' : json);
      // Privacy tripwire: no clinical-content field may ever appear.
      const banned = ['subjective', 'objective', 'assessment', 'chiefComplaint', 'clinicalNotes', 'diagnosis', 'currentAllergies', 'currentMedications', 'currentChronicConditions', 'bloodType"'];
      const leak = banned.filter((b) => json.includes(b));
      if (leak.length) { console.log('!!! CONTENIDO CLINICO FILTRADO:', leak); process.exitCode = 1; }
    } catch (err) {
      console.log(`\n=== ${name} ${JSON.stringify(input)} — ERROR ===`);
      console.log(err);
      process.exitCode = 1;
    }
  }

  if (anyPatient) await run('get_expediente_resumen', { patientId: anyPatient.id });
  await run('get_expediente_resumen', { patientId: 'no-existe-123' }); // negative
  await run('get_pacientes_overview', {});
  await run('get_pacientes_overview', { status: 'active' });
  await run('get_pacientes_overview', { sinVisitaMeses: 6 });
  await run('get_pacientes_overview', { nuevosMeses: 1 });
  await run('get_pacientes_overview', { tag: 'diabetic' });
  await run('get_pacientes_overview', { sinVisitaMeses: 999 }); // out of bounds → ignored
  console.log('\nDone.');
  process.exit(process.exitCode ?? 0);
})();
