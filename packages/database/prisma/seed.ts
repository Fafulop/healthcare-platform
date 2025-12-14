import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting database seed...');

  // Delete existing data
  await prisma.fAQ.deleteMany();
  await prisma.carouselItem.deleteMany();
  await prisma.certificate.deleteMany();
  await prisma.education.deleteMany();
  await prisma.service.deleteMany();
  await prisma.doctor.deleteMany();

  console.log('✅ Cleaned existing data');

  // Create Maria Lopez doctor profile
  const mariaLopez = await prisma.doctor.create({
    data: {
      slug: 'maria-lopez',
      doctorFullName: 'Dra. María López Hernández',
      lastName: 'López',
      primarySpecialty: 'Dermatóloga',
      subspecialties: ['Dermatología Cosmética', 'Tratamientos Láser', 'Anti-Envejecimiento'],
      cedulaProfesional: '987654321',
      heroImage: '/images/doctors/sample/doctor-placeholder.svg',
      locationSummary: 'Guadalajara, Jalisco',
      city: 'Guadalajara',

      // Biography
      shortBio: 'La Dra. María López es una dermatóloga certificada con más de 12 años de experiencia especializada en dermatología médica y cosmética. Le apasiona ayudar a sus pacientes a lograr una piel saludable y hermosa mediante tratamientos basados en evidencia y atención personalizada. La Dra. López se mantiene a la vanguardia de los avances dermatológicos asistiendo regularmente a conferencias internacionales e incorporando las últimas tecnologías en su práctica.',
      longBio: 'Después de completar su licenciatura en medicina en la Universidad de Guadalajara, la Dra. López realizó su especialización en dermatología en el prestigioso Hospital Civil de Guadalajara. Perfeccionó sus habilidades en dermatología cosmética a través de programas de formación avanzada en Estados Unidos y Europa. La Dra. López está comprometida en brindar atención integral que aborde tanto las preocupaciones médicas como estéticas de sus pacientes. Ella cree en educar a los pacientes sobre sus condiciones dermatológicas y trabajar de manera colaborativa para desarrollar planes de tratamiento efectivos. Fuera de su consulta, la Dra. López hace trabajo voluntario en clínicas de salud comunitarias brindando atención dermatológica a poblaciones desatendidas.',
      yearsExperience: 12,

      // Lists
      conditions: [
        'Acné y Cicatrices de Acné',
        'Eczema y Dermatitis Atópica',
        'Psoriasis',
        'Rosácea',
        'Melasma e Hiperpigmentación',
        'Detección de Cáncer de Piel',
        'Caída del Cabello (Alopecia)',
        'Trastornos de las Uñas',
        'Manchas de la Edad y Daño Solar',
        'Verrugas y Lesiones Cutáneas'
      ],
      procedures: [
        'Botox y Rellenos Dérmicos',
        'Peelings Químicos',
        'Microdermoabrasión',
        'Resurfacing Láser',
        'Fotofacial IPL',
        'Crioterapia',
        'Eliminación de Lunares y Lesiones',
        'Terapia con Plasma Rico en Plaquetas (PRP)',
        'Microagujas (Microneedling)',
        'Eliminación de Tatuajes'
      ],

      // Appointment info
      nextAvailableDate: new Date('2025-12-15'),
      appointmentModes: ['in_person', 'teleconsult'],

      // Clinic info
      clinicAddress: 'Av. Américas 1500, Colonia Providencia, Guadalajara, Jalisco 44630, Mexico',
      clinicPhone: '+52 33 1234 5678',
      clinicWhatsapp: '+52 33 1234 5678',
      clinicHours: {
        monday: '9:00 AM - 6:00 PM',
        tuesday: '9:00 AM - 6:00 PM',
        wednesday: '9:00 AM - 6:00 PM',
        thursday: '9:00 AM - 6:00 PM',
        friday: '9:00 AM - 5:00 PM',
        saturday: '9:00 AM - 1:00 PM',
        sunday: 'Closed'
      },
      clinicGeoLat: 20.6736,
      clinicGeoLng: -103.3954,

      // Social links
      socialLinkedin: 'https://www.linkedin.com/in/marialopezdermatologist',
      socialTwitter: 'https://twitter.com/dramarialopez',

      // Relations - Services
      services: {
        create: [
          {
            serviceName: 'Consulta General',
            shortDescription: 'Evaluación dermatológica completa y plan de tratamiento personalizado',
            durationMinutes: 30,
            price: 40
          },
          {
            serviceName: 'Tratamiento con Botox',
            shortDescription: 'Reducción de arrugas faciales con inyecciones de toxina botulínica',
            durationMinutes: 45,
            price: 120
          },
          {
            serviceName: 'Tratamiento para el Acné',
            shortDescription: 'Manejo integral del acné incluyendo medicamentos y tratamientos procedimentales',
            durationMinutes: 30,
            price: 50
          },
          {
            serviceName: 'Peeling Químico',
            shortDescription: 'Tratamiento de renovación cutánea para mejorar textura y tono de la piel',
            durationMinutes: 60,
            price: 80
          },
          {
            serviceName: 'Depilación Láser',
            shortDescription: 'Reducción permanente del vello usando tecnología láser avanzada',
            durationMinutes: 45,
            price: 60
          }
        ]
      },

      // Education
      educationItems: {
        create: [
          {
            institution: 'Universidad de Guadalajara',
            program: 'Licenciatura en Medicina',
            year: '2008',
            notes: 'Graduada con honores'
          },
          {
            institution: 'Hospital Civil de Guadalajara',
            program: 'Especialidad en Dermatología',
            year: '2012',
            notes: 'Jefe de Residentes 2011-2012'
          },
          {
            institution: 'American Academy of Dermatology',
            program: 'Fellowship en Dermatología Cosmética',
            year: '2013',
            notes: 'Entrenamiento avanzado en láser y tratamientos inyectables'
          },
          {
            institution: 'International Society of Dermatology',
            program: 'Educación Médica Continua',
            year: '2020',
            notes: 'Certificada en Técnicas Láser Avanzadas'
          }
        ]
      },

      // Certificates
      certificates: {
        create: [
          {
            src: '/images/doctors/sample/certificate-1.jpg',
            alt: 'Título de Medicina de la Universidad de Guadalajara',
            issuedBy: 'Universidad de Guadalajara',
            year: '2008'
          },
          {
            src: '/images/doctors/sample/certificate-2.jpg',
            alt: 'Certificación de especialidad en Dermatología',
            issuedBy: 'Consejo Mexicano de Dermatología',
            year: '2012'
          },
          {
            src: '/images/doctors/sample/certificate-3.jpg',
            alt: 'Certificado de fellowship en dermatología cosmética',
            issuedBy: 'American Academy of Dermatology',
            year: '2013'
          },
          {
            src: '/images/doctors/sample/certificate-4.jpg',
            alt: 'Certificación en tratamientos láser',
            issuedBy: 'International Society of Dermatology',
            year: '2020'
          }
        ]
      },

      // Carousel items
      carouselItems: {
        create: [
          {
            type: 'video_thumbnail',
            src: '/videos/doctors/sample/intro.mp4',
            thumbnail: '/images/doctors/sample/video-thumb-1.jpg',
            alt: 'Video de presentación de la Dra. María López',
            caption: 'Conoce a la Dra. López y su enfoque en dermatología',
            name: 'Presentación - Dra. María López Hernández',
            description: 'La Dra. María López se presenta y explica su filosofía de atención dermatológica integral y personalizada.',
            uploadDate: '2024-01-15',
            duration: 'PT45S'
          },
          {
            type: 'video_thumbnail',
            src: '/videos/doctors/sample/clinic-tour.mp4',
            thumbnail: '/images/doctors/sample/video-thumb-2.jpg',
            alt: 'Recorrido virtual por la clínica dermatológica',
            caption: 'Recorre nuestras instalaciones modernas',
            name: 'Tour Virtual - Clínica de Dermatología',
            description: 'Conoce nuestras instalaciones equipadas con tecnología de última generación para tratamientos dermatológicos.',
            uploadDate: '2024-01-15',
            duration: 'PT1M'
          },
          {
            type: 'image',
            src: '/images/doctors/sample/clinic-1.jpg',
            alt: 'Área de recepción moderna de la clínica dermatológica',
            caption: 'Nuestra acogedora área de recepción'
          },
          {
            type: 'image',
            src: '/images/doctors/sample/clinic-2.jpg',
            alt: 'Sala de tratamiento láser avanzado',
            caption: 'Salas de tratamiento de última generación'
          }
        ]
      },

      // FAQs
      faqs: {
        create: [
          {
            question: '¿Aceptan seguros médicos?',
            answer: 'Sí, aceptamos la mayoría de los planes de seguro principales. Por favor contacte a nuestro consultorio con su información de seguro para verificar cobertura antes de su cita.'
          },
          {
            question: '¿Qué debo llevar a mi primera cita?',
            answer: 'Por favor traiga una identificación válida, su tarjeta de seguro (si aplica), una lista de medicamentos actuales, y cualquier expediente médico relevante o resultados de estudios previos. Llegue 15 minutos antes para completar el papeleo.'
          },
          {
            question: '¿Ofrecen consultas virtuales?',
            answer: 'Sí, ofrecemos teleconsultas para evaluaciones iniciales y citas de seguimiento. Las visitas virtuales son convenientes y pueden atender muchas preocupaciones dermatológicas de manera remota.'
          },
          {
            question: '¿Cuánto cuesta una consulta?',
            answer: 'Una consulta general cuesta $40 USD. Esta tarifa puede aplicarse al tratamiento si procede con servicios el mismo día. También ofrecemos paquetes con precios especiales para múltiples tratamientos.'
          },
          {
            question: '¿Cuál es su política de cancelación?',
            answer: 'Requerimos al menos 24 horas de aviso para cancelaciones o reprogramaciones. Las cancelaciones tardías o inasistencias pueden incurrir en un cargo.'
          },
          {
            question: '¿Son seguros los tratamientos cosméticos?',
            answer: 'Todos nuestros tratamientos cosméticos se realizan usando productos y técnicas aprobadas por la FDA. La Dra. López discutirá los riesgos y beneficios potenciales durante su consulta y se asegurará de que sea un buen candidato para cualquier procedimiento.'
          },
          {
            question: '¿Cuánto duran los resultados del Botox?',
            answer: 'Los resultados del Botox típicamente duran de 3 a 4 meses. Los resultados individuales pueden variar según factores como el metabolismo, la actividad muscular y el área tratada. Recomendamos tratamientos de mantenimiento para sostener resultados óptimos.'
          }
        ]
      }
    }
  });

  console.log('✅ Created doctor profile: María López');
  console.log(`   - ${mariaLopez.slug}`);
  console.log('✅ Database seeding completed successfully!');
}

main()
  .catch((e) => {
    console.error('❌ Error seeding database:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
