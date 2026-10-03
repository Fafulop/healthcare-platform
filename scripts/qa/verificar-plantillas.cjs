// SÓLO LECTURA — la «prueba en la BD» de las plantillas de docs/DESDE JUNIO/PRUEBAS Y GUIAS/.
// Imprime cada plantilla de dr-prueba cuyo nombre contiene el texto, con sus campos
// (tipo · nombre · etiqueta · etiqueta ES · opciones) y las plantillas LLENAS (clinical_encounters)
// que la usan, con los valores guardados.
//   railway run --service pgvector node scripts/qa/verificar-plantillas.cjs "QA Plantilla"
const path = require('path');
const { PrismaClient } = require(path.join(__dirname, '../../packages/database/node_modules/@prisma/client'));
const DR_PRUEBA = 'cmni1bov90000mk0lyeztr3ad';
const arg = process.argv[2] || 'QA';
const prisma = new PrismaClient({ datasources: { db: { url: process.env.DATABASE_PUBLIC_URL || process.env.DATABASE_URL } } });
(async () => {
  try {
    const ts = await prisma.encounterTemplate.findMany({
      where: { doctorId: DR_PRUEBA, name: { contains: arg, mode: 'insensitive' } },
      orderBy: { createdAt: 'asc' },
      include: { encounters: { orderBy: { createdAt: 'asc' } } },
    });
    for (const t of ts) {
      console.log(`■ «${t.name}» · ${t.id} · custom=${t.isCustom} activa=${t.isActive} precita=${t.isPreAppointment} receta=${t.isReceta} · uso=${t.usageCount} · creada ${t.createdAt.toISOString()} · act ${t.updatedAt.toISOString()}`);
      for (const f of t.customFields ?? []) {
        console.log(`   - ${f.type} · ${f.name} · «${f.label}» / ES «${f.labelEs ?? '—'}»${f.required ? ' · requerido' : ''}${f.options ? ` · opciones ${JSON.stringify(f.options)}` : ''}${f.section ? ` · sección ${f.section}` : ''}`);
      }
      console.log(`   LLENAS (${t.encounters.length})`);
      for (const e of t.encounters) {
        const { customData, ...rest } = e;
        console.log(`   · ${e.id} · paciente ${e.patientId} · visita ${e.visitaId ?? '—'} · fecha ${e.encounterDate?.toISOString?.().slice(0, 10) ?? '—'} · estado ${e.status ?? '—'}`);
        console.log(`     datos ${JSON.stringify(e.customData ?? null)}`);
      }
    }
    if (!ts.length) console.log('Ninguna plantilla con ese nombre en dr-prueba.');
  } catch (e) { console.log('ERROR:', e.message); } finally { await prisma.$disconnect(); }
})();
