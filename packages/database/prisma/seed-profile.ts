/**
 * Mock profile seed for sismo.sistema1@gmail.com
 * Updates the doctor profile with realistic content across all sections.
 *
 * Run from repo root (Git Bash):
 *   DATABASE_URL="postgresql://postgres:<PASSWORD>@yamanote.proxy.rlwy.net:51502/railway" \
 *     node "packages/database/node_modules/tsx/dist/cli.mjs" \
 *     "packages/database/prisma/seed-profile.ts"
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const TARGET_EMAIL = 'sismo.sistema1@gmail.com';

async function main() {
  console.log(`🌱 Seeding doctor profile for ${TARGET_EMAIL}...\n`);

  // 1. Find user + doctor
  const user = await prisma.user.findUnique({
    where: { email: TARGET_EMAIL },
    include: { doctor: true },
  });

  if (!user?.doctor) {
    throw new Error(`User ${TARGET_EMAIL} not found or has no linked doctor profile.`);
  }

  const doctorId = user.doctor.id;
  const slug = user.doctor.slug;
  console.log(`✅ Doctor found: ${user.doctor.doctorFullName} (${slug})\n`);

  // -------------------------------------------------------------------------
  // 2. Update base doctor fields
  // -------------------------------------------------------------------------
  await prisma.doctor.update({
    where: { id: doctorId },
    data: {
      doctorFullName: 'Dr. Alejandro Morales Gutiérrez',
      lastName: 'Morales Gutiérrez',
      primarySpecialty: 'Medicina Interna',
      subspecialties: ['Diabetología', 'Cardiología Clínica', 'Neumología'],
      cedulaProfesional: '4872310',
      city: 'Ciudad de México',
      locationSummary: 'Col. Polanco, Ciudad de México',
      yearsExperience: 18,
      appointmentModes: ['in_person', 'teleconsult'],
      nextAvailableDate: new Date('2025-04-07'),
      colorPalette: 'blue',

      shortBio:
        'El Dr. Alejandro Morales es internista certificado con 18 años de experiencia en el manejo integral de enfermedades crónicas. Especializado en diabetes, hipertensión, enfermedades cardiovasculares y pulmonares, ofrece atención personalizada y basada en evidencia para mejorar la calidad de vida de sus pacientes.',

      longBio:
        'Egresado de la Facultad de Medicina de la UNAM con especialidad en Medicina Interna en el Hospital General de México, el Dr. Morales Gutiérrez ha dedicado su carrera al manejo integral del paciente adulto con enfermedades crónicas complejas. Su formación de subespecialidad incluye diplomados en Diabetología Clínica por la Federación Mexicana de Diabetes y en Cardiología Preventiva por la Sociedad Mexicana de Cardiología.\n\nCon más de 18 años de práctica clínica, el Dr. Morales ha atendido a miles de pacientes con diabetes mellitus tipo 2, hipertensión arterial, dislipidemia, enfermedades pulmonares obstructivas y trastornos autoinmunes. Su enfoque se basa en una medicina centrada en el paciente: escucha activa, diagnósticos precisos y planes de tratamiento individualizados que contemplan no solo el control farmacológico, sino también cambios en el estilo de vida y seguimiento a largo plazo.\n\nEs miembro activo de la Sociedad Mexicana de Medicina Interna (SMMI) y del Colegio de Medicina Interna de México (CMIM). Participa como ponente en congresos nacionales y colabora con el programa de residentes del Hospital General de México.',

      conditions: [
        'Diabetes mellitus tipo 2',
        'Hipertensión arterial sistémica',
        'Insuficiencia cardíaca',
        'Cardiopatía isquémica',
        'Dislipidemia',
        'Hipotiroidismo',
        'Hipertiroidismo',
        'EPOC',
        'Asma del adulto',
        'Lupus eritematoso sistémico',
        'Artritis reumatoide',
        'Enfermedad renal crónica',
        'Anemia crónica',
        'Síndrome metabólico',
        'Obesidad',
        'Infecciones respiratorias complejas',
        'Alergias e inmunodeficiencias',
      ],

      procedures: [
        'Consulta de medicina interna',
        'Evaluación cardiometabólica integral',
        'Interpretación de electrocardiograma (ECG)',
        'Lectura e interpretación de espirometría',
        'Ajuste y titulación de insulina',
        'Manejo de enfermedades autoinmunes',
        'Control y seguimiento de EPOC',
        'Teleconsulta médica',
        'Segunda opinión médica',
        'Evaluación preoperatoria',
        'Manejo de polifarmacia en adultos mayores',
        'Interpretación de laboratorios y gabinete',
      ],

      // Legacy clinic fields (backward compat)
      clinicAddress: 'Av. Presidente Masaryk 123, Col. Polanco, Alcaldía Miguel Hidalgo, Ciudad de México, CP 11560',
      clinicPhone: '55 5280 4422',
      clinicWhatsapp: '55 5280 4422',
      clinicHours: {
        monday:    '8:00 AM - 7:00 PM',
        tuesday:   '8:00 AM - 7:00 PM',
        wednesday: '8:00 AM - 7:00 PM',
        thursday:  '8:00 AM - 7:00 PM',
        friday:    '8:00 AM - 4:00 PM',
        saturday:  '9:00 AM - 1:00 PM',
        sunday:    'Cerrado',
      },
      clinicGeoLat: 19.4328,
      clinicGeoLng: -99.1963,

      // Social
      socialLinkedin:  'https://www.linkedin.com/in/dr-alejandro-morales',
      socialInstagram: 'https://www.instagram.com/dralejandroMD',
      socialFacebook:  'https://www.facebook.com/dralejandroMoralesInternista',
    },
  });
  console.log('✅ Base doctor fields updated');

  // -------------------------------------------------------------------------
  // 3. Clinic locations (delete existing → create new)
  // -------------------------------------------------------------------------
  await prisma.clinicLocation.deleteMany({ where: { doctorId } });

  await prisma.clinicLocation.createMany({
    data: [
      {
        doctorId,
        name: 'Consultorio Polanco',
        address: 'Av. Presidente Masaryk 123, Piso 4, Col. Polanco, Alcaldía Miguel Hidalgo, CDMX, CP 11560',
        phone: '55 5280 4422',
        whatsapp: '55 5280 4422',
        hours: {
          monday:    '8:00 AM - 7:00 PM',
          tuesday:   '8:00 AM - 7:00 PM',
          wednesday: '8:00 AM - 7:00 PM',
          thursday:  '8:00 AM - 7:00 PM',
          friday:    '8:00 AM - 4:00 PM',
          saturday:  '9:00 AM - 1:00 PM',
          sunday:    'Cerrado',
        },
        geoLat: 19.4328,
        geoLng: -99.1963,
        isDefault: true,
        displayOrder: 0,
      },
      {
        doctorId,
        name: 'Consultorio Satélite',
        address: 'Circuito Médicos 45, Consultorio 12, Ciudad Satélite, Naucalpan, Estado de México, CP 53100',
        phone: '55 5393 1170',
        whatsapp: '55 5393 1170',
        hours: {
          monday:    'Cerrado',
          tuesday:   '3:00 PM - 7:00 PM',
          wednesday: 'Cerrado',
          thursday:  '3:00 PM - 7:00 PM',
          friday:    'Cerrado',
          saturday:  '10:00 AM - 2:00 PM',
          sunday:    'Cerrado',
        },
        geoLat: 19.5069,
        geoLng: -99.2346,
        isDefault: false,
        displayOrder: 1,
      },
    ],
  });
  console.log('✅ Clinic locations created (2)');

  // -------------------------------------------------------------------------
  // 4. Services (delete existing → create new)
  // -------------------------------------------------------------------------
  await prisma.service.deleteMany({ where: { doctorId } });

  await prisma.service.createMany({
    data: [
      {
        doctorId,
        serviceName: 'Consulta de Medicina Interna',
        shortDescription: 'Evaluación integral del paciente adulto, diagnóstico diferencial y plan de tratamiento personalizado.',
        durationMinutes: 45,
        price: 900,
        isBookingActive: true,
      },
      {
        doctorId,
        serviceName: 'Consulta de Seguimiento',
        shortDescription: 'Revisión de resultados de laboratorio, ajuste de medicamentos y evolución de enfermedades crónicas.',
        durationMinutes: 30,
        price: 650,
        isBookingActive: true,
      },
      {
        doctorId,
        serviceName: 'Evaluación Cardiometabólica',
        shortDescription: 'Análisis integral de riesgo cardiovascular: perfil lipídico, glucemia, TA, ECG e interpretación.',
        durationMinutes: 60,
        price: 1200,
        isBookingActive: true,
      },
      {
        doctorId,
        serviceName: 'Teleconsulta',
        shortDescription: 'Consulta médica por videollamada. Ideal para seguimiento de pacientes crónicos o segunda opinión.',
        durationMinutes: 30,
        price: 550,
        isBookingActive: true,
      },
      {
        doctorId,
        serviceName: 'Segunda Opinión Médica',
        shortDescription: 'Revisión de expediente, estudios previos y diagnósticos para dar una opinión independiente y fundamentada.',
        durationMinutes: 60,
        price: 1500,
        isBookingActive: false,
      },
      {
        doctorId,
        serviceName: 'Evaluación Preoperatoria',
        shortDescription: 'Valoración de riesgo quirúrgico, ajuste de medicamentos perioperatorios y carta para anestesiología.',
        durationMinutes: 45,
        price: 1000,
        isBookingActive: false,
      },
    ],
  });
  console.log('✅ Services created (6)');

  // -------------------------------------------------------------------------
  // 5. Education items (delete existing → create new)
  // -------------------------------------------------------------------------
  await prisma.education.deleteMany({ where: { doctorId } });

  await prisma.education.createMany({
    data: [
      {
        doctorId,
        institution: 'Universidad Nacional Autónoma de México (UNAM)',
        program: 'Licenciatura en Medicina General',
        year: '2001',
        notes: 'Generación 1995-2001. Médico Cirujano. Mención honorífica.',
      },
      {
        doctorId,
        institution: 'Hospital General de México "Dr. Eduardo Liceaga"',
        program: 'Especialidad en Medicina Interna',
        year: '2006',
        notes: 'Residencia de 4 años. Jefe de residentes 2005-2006.',
      },
      {
        doctorId,
        institution: 'Federación Mexicana de Diabetes A.C.',
        program: 'Diplomado en Diabetología Clínica',
        year: '2009',
        notes: 'Manejo avanzado de diabetes mellitus tipo 1 y tipo 2, insulinoterapia y tecnología aplicada.',
      },
      {
        doctorId,
        institution: 'Sociedad Mexicana de Cardiología',
        program: 'Diplomado en Cardiología Preventiva',
        year: '2012',
        notes: 'Riesgo cardiovascular, síndrome coronario agudo y falla cardíaca en el internista.',
      },
      {
        doctorId,
        institution: 'Colegio de Medicina Interna de México (CMIM)',
        program: 'Certificación y recertificación en Medicina Interna',
        year: '2022',
        notes: 'Certificación vigente por el Consejo Mexicano de Medicina Interna (CMMI).',
      },
    ],
  });
  console.log('✅ Education items created (5)');

  // -------------------------------------------------------------------------
  // 6. FAQs (delete existing → create new)
  // -------------------------------------------------------------------------
  await prisma.fAQ.deleteMany({ where: { doctorId } });

  await prisma.fAQ.createMany({
    data: [
      {
        doctorId,
        question: '¿Qué enfermedades atiende el Dr. Morales?',
        answer: 'El Dr. Morales se especializa en el manejo de enfermedades crónicas del adulto: diabetes mellitus, hipertensión arterial, enfermedades cardiovasculares (cardiopatía isquémica, insuficiencia cardíaca), enfermedades pulmonares (EPOC, asma), trastornos tiroideos, enfermedades autoinmunes (lupus, artritis reumatoide) y síndrome metabólico, entre otras.',
      },
      {
        doctorId,
        question: '¿Cuánto cuesta la consulta?',
        answer: 'La consulta de primera vez tiene un costo de $900 MXN (45 minutos). Las consultas de seguimiento son $650 MXN (30 minutos). La evaluación cardiometabólica integral cuesta $1,200 MXN. También ofrecemos teleconsultas desde $550 MXN. Todos los precios incluyen el tiempo de consulta, revisión de estudios y receta médica si es necesaria.',
      },
      {
        doctorId,
        question: '¿Aceptan seguros médicos?',
        answer: 'Sí, trabajamos con las principales aseguradoras: GNP Seguros, AXA, Seguros Atlas, MetLife y MAPFRE. También atendemos pacientes de BUPA México. Le recomendamos verificar con anticipación si su póliza cubre consultas de medicina interna y si requiere referencia de médico de primer nivel.',
      },
      {
        doctorId,
        question: '¿Qué debo traer a mi primera consulta?',
        answer: 'Traiga una identificación oficial vigente, su tarjeta de seguro médico (si aplica), lista de todos los medicamentos que toma actualmente (con dosis), resultados de laboratorio o estudios de imagen recientes, y cualquier expediente médico relevante de consultas previas. Si tiene glucómetro, lleve su registro de glucemias.',
      },
      {
        doctorId,
        question: '¿Ofrecen teleconsultas?',
        answer: 'Sí. Las teleconsultas se realizan por videollamada (Zoom o Google Meet) y son ideales para pacientes en seguimiento estable, revisión de resultados de laboratorio o para quienes se encuentran fuera de la ciudad. Puede agendar su teleconsulta directamente desde esta página.',
      },
      {
        doctorId,
        question: '¿Con cuánta anticipación debo agendar?',
        answer: 'Para consultas presenciales recomendamos agendar con 3-5 días de anticipación. En casos de urgencia no emergente (sin riesgo de vida), intentamos dar espacio el mismo día o al siguiente. Si es una emergencia, acuda a urgencias del hospital más cercano.',
      },
      {
        doctorId,
        question: '¿Cuál es la política de cancelación?',
        answer: 'Le pedimos cancelar o reprogramar con al menos 24 horas de anticipación para que podamos ofrecer el espacio a otro paciente. Cancelaciones con menos de 2 horas de antelación o inasistencias sin aviso pueden generar un cargo del 50% de la consulta.',
      },
      {
        doctorId,
        question: '¿El Dr. Morales atiende pacientes hospitalizados?',
        answer: 'Sí. El Dr. Morales tiene convenio con el Hospital Ángeles Polanco y el Hospital Satélite para atender pacientes hospitalizados que requieran interconsulta o manejo de medicina interna. Si usted o un familiar está hospitalizado, puede solicitar su participación a través del médico tratante.',
      },
    ],
  });
  console.log('✅ FAQs created (8)');

  // -------------------------------------------------------------------------
  // Done
  // -------------------------------------------------------------------------
  console.log('\n🎉 Profile seeding complete!\n');
  console.log('📊 Summary:');
  console.log('   Base fields:       updated (name, bio, specialty, conditions, procedures)');
  console.log('   Clinic locations:  2  (Polanco + Satélite)');
  console.log('   Services:          6');
  console.log('   Education:         5');
  console.log('   FAQs:              8');
  console.log('\n💡 Note: hero image, certificates and carousel items need to be');
  console.log('   uploaded manually from the /dashboard/mi-perfil page (requires files).');
}

main()
  .catch((e) => {
    console.error('❌ Error:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
