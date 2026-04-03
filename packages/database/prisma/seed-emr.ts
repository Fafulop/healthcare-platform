/**
 * Mock EMR seed for sismo.sistema1@gmail.com
 * Creates patients, encounters, prescriptions and tasks.
 *
 * Run from repo root:
 *   pnpm --filter @healthcare/database exec tsx prisma/seed-emr.ts
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// ---------------------------------------------------------------------------
// Raw data
// ---------------------------------------------------------------------------

const PATIENTS = [
  {
    internalId: 'P-001',
    firstName: 'Carlos',
    lastName: 'Ramírez Jiménez',
    dateOfBirth: new Date('1968-03-14'),
    sex: 'male',
    phone: '55 3412 8800',
    city: 'Ciudad de México',
    bloodType: 'O+',
    currentChronicConditions: 'Diabetes mellitus tipo 2, Hipertensión arterial sistémica',
    currentMedications: 'Metformina 850 mg, Enalapril 10 mg',
    currentAllergies: 'Penicilina (urticaria)',
    tags: ['diabético', 'hipertenso'],
    firstVisitDate: new Date('2023-01-10'),
    lastVisitDate: new Date('2024-11-05'),
  },
  {
    internalId: 'P-002',
    firstName: 'Laura',
    lastName: 'González Vega',
    dateOfBirth: new Date('1985-07-22'),
    sex: 'female',
    phone: '55 6721 3300',
    city: 'Ciudad de México',
    bloodType: 'A+',
    currentChronicConditions: 'Hipotiroidismo',
    currentMedications: 'Levotiroxina 50 mcg',
    currentAllergies: null,
    tags: ['hipotiroidismo'],
    firstVisitDate: new Date('2023-04-18'),
    lastVisitDate: new Date('2024-10-20'),
  },
  {
    internalId: 'P-003',
    firstName: 'Miguel Ángel',
    lastName: 'Torres Sánchez',
    dateOfBirth: new Date('1975-11-03'),
    sex: 'male',
    phone: '55 9900 1122',
    city: 'Naucalpan',
    bloodType: 'B+',
    currentChronicConditions: 'Asma leve persistente, Rinitis alérgica',
    currentMedications: 'Salbutamol inhalado (SOS), Loratadina 10 mg',
    currentAllergies: 'Ácaros del polvo, polen',
    tags: ['asma', 'alérgico'],
    firstVisitDate: new Date('2022-09-07'),
    lastVisitDate: new Date('2024-12-01'),
  },
  {
    internalId: 'P-004',
    firstName: 'Ana Sofía',
    lastName: 'Mendoza Flores',
    dateOfBirth: new Date('1992-02-28'),
    sex: 'female',
    phone: '55 4455 6677',
    city: 'Tlalnepantla',
    bloodType: 'AB-',
    currentChronicConditions: null,
    currentMedications: null,
    currentAllergies: null,
    tags: [],
    firstVisitDate: new Date('2024-02-14'),
    lastVisitDate: new Date('2024-09-10'),
  },
  {
    internalId: 'P-005',
    firstName: 'Roberto',
    lastName: 'Hernández Cruz',
    dateOfBirth: new Date('1960-08-19'),
    sex: 'male',
    phone: '55 2233 4455',
    city: 'Ciudad de México',
    bloodType: 'O-',
    currentChronicConditions: 'Cardiopatía isquémica, Dislipidemia, Diabetes mellitus tipo 2',
    currentMedications: 'Atorvastatina 40 mg, Ácido acetilsalicílico 100 mg, Metformina 1 g, Bisoprolol 5 mg',
    currentAllergies: 'Ibuprofeno (broncoespasmo)',
    tags: ['cardiopatía', 'diabético', 'dislipidemia', 'alto-riesgo'],
    firstVisitDate: new Date('2021-05-15'),
    lastVisitDate: new Date('2024-11-28'),
  },
  {
    internalId: 'P-006',
    firstName: 'Valeria',
    lastName: 'López Ramos',
    dateOfBirth: new Date('2001-06-12'),
    sex: 'female',
    phone: '55 8899 0011',
    city: 'Ecatepec',
    bloodType: 'A-',
    currentChronicConditions: null,
    currentMedications: null,
    currentAllergies: 'Mariscos (anafilaxia)',
    tags: ['alergia-alimentaria'],
    firstVisitDate: new Date('2024-05-30'),
    lastVisitDate: new Date('2024-05-30'),
  },
  {
    internalId: 'P-007',
    firstName: 'Jorge Luis',
    lastName: 'Pérez Morales',
    dateOfBirth: new Date('1955-12-01'),
    sex: 'male',
    phone: '55 5544 3322',
    city: 'Ciudad de México',
    bloodType: 'B-',
    currentChronicConditions: 'EPOC moderado, Hipertensión arterial sistémica',
    currentMedications: 'Tiotropio 18 mcg, Amlodipino 5 mg',
    currentAllergies: null,
    tags: ['epoc', 'hipertenso', 'exfumador'],
    firstVisitDate: new Date('2020-11-22'),
    lastVisitDate: new Date('2024-10-14'),
  },
  {
    internalId: 'P-008',
    firstName: 'Carmen',
    lastName: 'Ruiz Ortega',
    dateOfBirth: new Date('1978-04-05'),
    sex: 'female',
    phone: '55 3344 5566',
    city: 'Ciudad de México',
    bloodType: 'O+',
    currentChronicConditions: 'Lupus eritematoso sistémico en remisión',
    currentMedications: 'Hidroxicloroquina 200 mg, Prednisona 5 mg',
    currentAllergies: 'Sulfamidas',
    tags: ['lupus', 'autoinmune'],
    firstVisitDate: new Date('2022-03-08'),
    lastVisitDate: new Date('2024-12-03'),
  },
];

// Encounter templates per patient (patientIndex -> encounters array)
const ENCOUNTERS: Record<number, Array<{
  encounterDate: Date;
  encounterType: string;
  chiefComplaint: string;
  subjective: string;
  objective: string;
  assessment: string;
  plan: string;
  vitalsBloodPressure?: string;
  vitalsHeartRate?: number;
  vitalsTemperature?: number;
  vitalsWeight?: number;
  vitalsHeight?: number;
  vitalsOxygenSat?: number;
  followUpDate?: Date;
  status: string;
}>> = {
  0: [ // Carlos - diabetes + hypertension
    {
      encounterDate: new Date('2024-11-05'),
      encounterType: 'follow-up',
      chiefComplaint: 'Control de diabetes e hipertensión. Refiere cefalea ocasional matutina.',
      subjective: 'Paciente masculino de 56 años con DM2 e HAS. Refiere glucemias en ayuno entre 140-160 mg/dL en automonitoreo. Cefalea occipital leve en las mañanas. Niega polidipsia, poliuria, visión borrosa. Cumple con dieta en un 70%.',
      objective: 'Consciente, orientado, bien hidratado. Sin edema en extremidades. Fondo de ojo: no realizado. FC 78 lpm, regular.',
      assessment: 'Diabetes mellitus tipo 2 con control subóptimo (HbA1c 7.8%). Hipertensión arterial con cifras en límite superior.',
      plan: 'Ajuste de metformina a 1 g c/12h. Continuar enalapril. Solicitar HbA1c, química sanguínea completa, EGO, microalbuminuria. Referir a nutrición. Cita en 8 semanas.',
      vitalsBloodPressure: '142/88',
      vitalsHeartRate: 78,
      vitalsTemperature: 36.5,
      vitalsWeight: 88.4,
      vitalsHeight: 170,
      vitalsOxygenSat: 97,
      followUpDate: new Date('2025-01-07'),
      status: 'completed',
    },
    {
      encounterDate: new Date('2024-07-12'),
      encounterType: 'follow-up',
      chiefComplaint: 'Control trimestral. Sin síntomas nuevos.',
      subjective: 'Paciente refiere buena tolerancia a medicamentos. Glucemias en ayuno de 130-145 mg/dL. TA en casa 135/85 en promedio. Sigue dieta y caminata 30 min 4 veces por semana.',
      objective: 'TA 138/85, FC 76, Peso 90.1 kg. Sin edemas. Laboratorios previos: HbA1c 8.1%, colesterol total 210 mg/dL, LDL 130 mg/dL, creatinina 1.0 mg/dL.',
      assessment: 'DM2 con control mejorado. HAS controlada. Dislipidemia leve.',
      plan: 'Mantener esquema actual. Agregar atorvastatina 20 mg/día. Solicitar perfil lipídico en 3 meses. Próxima cita en octubre.',
      vitalsBloodPressure: '138/85',
      vitalsHeartRate: 76,
      vitalsTemperature: 36.3,
      vitalsWeight: 90.1,
      vitalsHeight: 170,
      vitalsOxygenSat: 97,
      status: 'completed',
    },
    {
      encounterDate: new Date('2024-01-10'),
      encounterType: 'consultation',
      chiefComplaint: 'Evaluación anual. Revisión de control metabólico.',
      subjective: 'Paciente cumple un año en seguimiento. Trae resultados de laboratorio. Refiere síntomas de hipoglucemia en 2 ocasiones el mes pasado.',
      objective: 'TA 145/90, Peso 91.5 kg. Laboratorios: HbA1c 8.4%, glucosa 155 mg/dL, creatinina 1.1 mg/dL, TFG 72 mL/min, microalbuminuria 28 mg/g (levemente elevada).',
      assessment: 'DM2 con control subóptimo. HAS. Nefropatía diabética incipiente (microalbuminuria). Episodios hipoglucémicos.',
      plan: 'Reducir metformina a 850 mg c/12h por hipoglucemias. Agregar losartán 50 mg por microalbuminuria y cardioprotección. Referir a nefrología para seguimiento. Revisar técnica de automonitoreo.',
      vitalsBloodPressure: '145/90',
      vitalsHeartRate: 80,
      vitalsTemperature: 36.6,
      vitalsWeight: 91.5,
      vitalsHeight: 170,
      vitalsOxygenSat: 96,
      status: 'completed',
    },
  ],
  1: [ // Laura - hypothyroidism
    {
      encounterDate: new Date('2024-10-20'),
      encounterType: 'follow-up',
      chiefComplaint: 'Control de hipotiroidismo. Fatiga persistente.',
      subjective: 'Paciente femenina de 39 años. Refiere fatiga moderada, somnolencia diurna y ligero aumento de peso (2 kg en 2 meses). Levotiroxina tomada en ayuno. Trae resultados de TSH.',
      objective: 'TSH 6.8 mUI/L (elevada), T4 libre 0.8 ng/dL (baja). Peso 68 kg. TA 118/74. Cabello con aspecto seco, sin bocio palpable.',
      assessment: 'Hipotiroidismo primario con control subóptimo. Ajuste de dosis requerido.',
      plan: 'Ajuste de levotiroxina a 75 mcg diarios. Tomar 30-60 min antes del desayuno. Evitar calcio y hierro 4h después. TSH en 6-8 semanas. Próxima cita en enero 2025.',
      vitalsBloodPressure: '118/74',
      vitalsHeartRate: 62,
      vitalsTemperature: 36.2,
      vitalsWeight: 68,
      vitalsHeight: 162,
      vitalsOxygenSat: 98,
      followUpDate: new Date('2025-01-20'),
      status: 'completed',
    },
    {
      encounterDate: new Date('2024-04-18'),
      encounterType: 'consultation',
      chiefComplaint: 'Primera consulta. Diagnóstico reciente de hipotiroidismo hecho en laboratorio de otra institución.',
      subjective: 'Paciente refiere 4 meses de fatiga, caída de cabello, constipación y sensación de frío. TSH previa 9.2 mUI/L, T4 libre 0.7 ng/dL. Sin antecedente familiar conocido.',
      objective: 'Bien orientada, habitus leptosómico. Piel ligeramente seca. Sin bocio palpable. TA 110/70, FC 58 lpm, Peso 66 kg, Talla 162 cm.',
      assessment: 'Hipotiroidismo primario confirmado. Inicio de tratamiento de sustitución.',
      plan: 'Iniciar levotiroxina 50 mcg/día en ayunas. Explicar importancia de consistencia en toma. Solicitar anticuerpos anti-TPO y anti-tiroglobulina. Control TSH y T4L en 8 semanas.',
      vitalsBloodPressure: '110/70',
      vitalsHeartRate: 58,
      vitalsTemperature: 36.0,
      vitalsWeight: 66,
      vitalsHeight: 162,
      vitalsOxygenSat: 98,
      followUpDate: new Date('2024-06-15'),
      status: 'completed',
    },
  ],
  2: [ // Miguel - asthma + allergic rhinitis
    {
      encounterDate: new Date('2024-12-01'),
      encounterType: 'follow-up',
      chiefComplaint: 'Exacerbación leve de asma. Tos nocturna frecuente en la última semana.',
      subjective: 'Paciente masculino de 49 años. Desde hace 7 días tos nocturna que interrumpe el sueño, uso de salbutamol 3-4 veces por semana. Exposición a polvo por remodelación en oficina. Sin fiebre, sin disnea en reposo.',
      objective: 'FR 16 rpm, SatO2 95%. Auscultación: sibilancias espiratorias bilaterales leves. Sin uso de músculos accesorios. FEM 68% del teórico.',
      assessment: 'Exacerbación leve de asma por exposición a polvo. Control inadecuado.',
      plan: 'Agregar budesonida/formoterol 160/4.5 mcg inhalado c/12h x 2 semanas. Continuar salbutamol SOS. Medidas de control ambiental. Consultar neumología si no mejora en 2 semanas.',
      vitalsBloodPressure: '125/78',
      vitalsHeartRate: 88,
      vitalsTemperature: 36.7,
      vitalsWeight: 82,
      vitalsHeight: 175,
      vitalsOxygenSat: 95,
      followUpDate: new Date('2024-12-15'),
      status: 'completed',
    },
    {
      encounterDate: new Date('2024-06-10'),
      encounterType: 'follow-up',
      chiefComplaint: 'Control semestral de asma y rinitis. Temporada de pólenes.',
      subjective: 'Paciente bien. Uso de salbutamol solo 1 vez por semana. Rinitis controlada con loratadina. Rinorrea hialina en mañanas. Sin crisis de asma desde el último control.',
      objective: 'Auscultación limpia. SatO2 98%. FEM 85% del teórico. Mucosa nasal eritematosa.',
      assessment: 'Asma leve persistente en buen control. Rinitis alérgica activa en temporada.',
      plan: 'Mantener salbutamol SOS. Agregar fluticasona nasal 50 mcg c/12h por rinitis. Evitar salidas en días de alta concentración de pólenes. Cita en 6 meses.',
      vitalsBloodPressure: '122/76',
      vitalsHeartRate: 74,
      vitalsTemperature: 36.4,
      vitalsWeight: 81.5,
      vitalsHeight: 175,
      vitalsOxygenSat: 98,
      status: 'completed',
    },
  ],
  3: [ // Ana Sofía - sin enfermedades crónicas
    {
      encounterDate: new Date('2024-09-10'),
      encounterType: 'consultation',
      chiefComplaint: 'Infección respiratoria alta. Fiebre, odinofagia y malestar general desde hace 3 días.',
      subjective: 'Paciente femenina de 32 años. Fiebre de 38.5°C, odinofagia intensa, rinorrea clara, cefalea frontal. Sin tos productiva. Contacto con compañero de trabajo enfermo la semana pasada.',
      objective: 'Faringe eritematosa con exudado blanquecino bilateral. Adenopatías submandibulares bilaterales dolorosas. Temp 38.3°C, FC 92. Sin dificultad respiratoria.',
      assessment: 'Faringoamigdalitis bacteriana aguda. Score de Centor 4/4.',
      plan: 'Amoxicilina 500 mg c/8h x 10 días. Paracetamol 500 mg c/6h PRN. Reposo 48h. Revisión si empeora o no mejora en 72h.',
      vitalsBloodPressure: '116/72',
      vitalsHeartRate: 92,
      vitalsTemperature: 38.3,
      vitalsWeight: 58,
      vitalsHeight: 165,
      vitalsOxygenSat: 98,
      status: 'completed',
    },
    {
      encounterDate: new Date('2024-02-14'),
      encounterType: 'consultation',
      chiefComplaint: 'Chequeo general anual. Sin síntomas específicos.',
      subjective: 'Primera consulta. Paciente sin antecedentes de importancia. Niega tabaquismo, alcoholismo. Ejercicio moderado 3 veces por semana. Ciclos menstruales regulares. Anticonceptivos orales desde hace 2 años.',
      objective: 'Paciente en buen estado general. TA 112/70, FC 68, Peso 57 kg, Talla 165 cm, IMC 20.9. Exploración física normal. Papanicolaou pendiente.',
      assessment: 'Paciente sana. Chequeo preventivo. Solicitar estudios de tamizaje.',
      plan: 'BH, QS, perfil tiroideo, examen general de orina. Papanicolaou. Vacunas al día (revisar esquema). Cita anual.',
      vitalsBloodPressure: '112/70',
      vitalsHeartRate: 68,
      vitalsTemperature: 36.3,
      vitalsWeight: 57,
      vitalsHeight: 165,
      vitalsOxygenSat: 99,
      status: 'completed',
    },
  ],
  4: [ // Roberto - cardiopatía + DM2
    {
      encounterDate: new Date('2024-11-28'),
      encounterType: 'follow-up',
      chiefComplaint: 'Control cardiometabólico mensual. Refiere disnea de esfuerzo leve al subir escaleras.',
      subjective: 'Paciente masculino de 64 años con antecedente de IAM hace 3 años. Disnea clase funcional II (NYHA). Glucemias en ayuno 115-130 mg/dL. Monitoreo domiciliario TA 130/80 en promedio. Niega angina, palpitaciones, síncope.',
      objective: 'TA 132/82, FC 68, Peso 94 kg. Edema pretibial ++/IV bilateral. SatO2 96%. Auscultación: soplo sistólico II/VI en ápex. Laboratorios recientes: LDL 88 mg/dL, HbA1c 6.9%, creatinina 1.3 mg/dL.',
      assessment: 'Cardiopatía isquémica en seguimiento. IC leve (NYHA II). DM2 con buen control. Edema por posible retención.',
      plan: 'Agregar furosemida 20 mg/día por edema. Control de peso diario. Ecocardiograma actualizado. Interconsulta cardiología. Restricción de sodio <2g/día.',
      vitalsBloodPressure: '132/82',
      vitalsHeartRate: 68,
      vitalsTemperature: 36.5,
      vitalsWeight: 94,
      vitalsHeight: 172,
      vitalsOxygenSat: 96,
      followUpDate: new Date('2024-12-20'),
      status: 'completed',
    },
    {
      encounterDate: new Date('2024-08-05'),
      encounterType: 'follow-up',
      chiefComplaint: 'Seguimiento. Trae resultados de laboratorio y Holter de 24 horas.',
      subjective: 'Paciente estable. Niega dolor torácico. Buena adherencia a medicamentos. Control de dieta aceptable. Caminata 20 min diarios.',
      objective: 'TA 128/80, FC 70, Peso 93 kg. Holter: ritmo sinusal, extrasístoles ventriculares aisladas <1%, sin taquicardia sostenida. Eco previo: FE 48%, hipocinesia segmentaria anterior.',
      assessment: 'Disfunción sistólica leve estable. Extrasístoles ventriculares benignas.',
      plan: 'Continuar bisoprolol. Agregar sacubitrilo/valsartán 24/26 mg c/12h (suspender enalapril). Explicar importancia. Ecocardiograma de control en 3 meses.',
      vitalsBloodPressure: '128/80',
      vitalsHeartRate: 70,
      vitalsTemperature: 36.4,
      vitalsWeight: 93,
      vitalsHeight: 172,
      vitalsOxygenSat: 97,
      status: 'completed',
    },
    {
      encounterDate: new Date('2024-05-15'),
      encounterType: 'follow-up',
      chiefComplaint: 'Control trimestral. Sin nuevos síntomas cardíacos.',
      subjective: 'Paciente se presenta acompañado por familiar. Refiere mejoría general. Adecuada tolerancia a medicamentos. Glucemias en ayuno 120-140 mg/dL.',
      objective: 'TA 135/83, FC 72, Peso 92 kg. BH normal, creatinina 1.2 mg/dL, HbA1c 7.2%, LDL 95 mg/dL.',
      assessment: 'DM2 con control moderado. HAS controlada. Cardiopatía isquémica estable.',
      plan: 'Intensificar dieta baja en azúcares simples. Mantener esquema farmacológico. Seguimiento en 3 meses con laboratorios.',
      vitalsBloodPressure: '135/83',
      vitalsHeartRate: 72,
      vitalsTemperature: 36.6,
      vitalsWeight: 92,
      vitalsHeight: 172,
      vitalsOxygenSat: 97,
      status: 'completed',
    },
  ],
  5: [ // Valeria - alergia alimentaria
    {
      encounterDate: new Date('2024-05-30'),
      encounterType: 'consultation',
      chiefComplaint: 'Reacción alérgica severa después de ingesta de camarones. Fue a urgencias.',
      subjective: 'Paciente femenina de 23 años. 2 semanas previas tuvo episodio de urticaria generalizada, edema de labios y dificultad respiratoria leve 15 minutos después de comer camarones. Acudió a urgencias, recibió adrenalina y antihistamínico IV. Egresó bien. Nunca había tenido reacción similar.',
      objective: 'En este momento sin síntomas. TA 110/68, FC 76. Piel sin lesiones. Auscultación limpia.',
      assessment: 'Anafilaxia leve-moderada por alérgeno alimentario (mariscos). Primera reacción documentada.',
      plan: 'Prescribir adrenalina autoinyectable 0.3 mg para portar siempre. Evitar estrictamente todos los mariscos y derivados. Referir a alergología. Plan de acción escrito para anafilaxia. Pulsera médica recomendada.',
      vitalsBloodPressure: '110/68',
      vitalsHeartRate: 76,
      vitalsTemperature: 36.4,
      vitalsWeight: 55,
      vitalsHeight: 163,
      vitalsOxygenSat: 99,
      status: 'completed',
    },
  ],
  6: [ // Jorge - EPOC + HAS
    {
      encounterDate: new Date('2024-10-14'),
      encounterType: 'follow-up',
      chiefComplaint: 'Control de EPOC. Mayor producción de esputo en los últimos días.',
      subjective: 'Paciente masculino de 69 años, ex-fumador (40 paquetes-año). Esputo purulento amarillo-verdoso desde hace 4 días, disnea basal incrementada. Sin fiebre. Usa tiotropio regularmente.',
      objective: 'FR 20 rpm, SatO2 91% (basal habitual 94%). Auscultación: murmullo vesicular disminuido bibasalmente, sibilancias difusas espiratorias. Tórax en tonel. Rx tórax portátil: hiperinsuflación, sin condensaciones.',
      assessment: 'Exacerbación moderada de EPOC (Anthonisen tipo II). Sin neumonía.',
      plan: 'Azitromicina 500 mg c/24h x 5 días. Prednisona 40 mg/día x 5 días. Salbutamol nebulizado c/4h x 48h, luego cada 6h. SatO2 objetivo 88-92%. Si empeora, valorar hospitalización. Control en 5 días.',
      vitalsBloodPressure: '145/90',
      vitalsHeartRate: 96,
      vitalsTemperature: 37.1,
      vitalsWeight: 71,
      vitalsHeight: 168,
      vitalsOxygenSat: 91,
      followUpDate: new Date('2024-10-19'),
      status: 'completed',
    },
    {
      encounterDate: new Date('2024-07-22'),
      encounterType: 'follow-up',
      chiefComplaint: 'Control semestral. Trae espirometría.',
      subjective: 'Paciente estable. Disnea basal MMRC 2 (se detiene al caminar en plano). Sin exacerbaciones desde enero. Cumple con tiotropio. Dejó de fumar hace 6 años.',
      objective: 'TA 140/88, SatO2 94% en reposo. Espirometría: FEV1 52% del teórico, FEV1/FVC 0.58. Clasificación GOLD II moderado.',
      assessment: 'EPOC moderado (GOLD II) estable. Buena adherencia. HAS con cifras en límite.',
      plan: 'Continuar tiotropio. Agregar salmeterol/fluticasona 50/500 mcg c/12h por disnea de esfuerzo. Vacuna anti-neumocócica y refuerzo anti-influenza. Rehabilitación pulmonar.',
      vitalsBloodPressure: '140/88',
      vitalsHeartRate: 80,
      vitalsTemperature: 36.5,
      vitalsWeight: 70,
      vitalsHeight: 168,
      vitalsOxygenSat: 94,
      status: 'completed',
    },
    {
      encounterDate: new Date('2024-02-08'),
      encounterType: 'follow-up',
      chiefComplaint: 'Control post-exacerbación. Revisión a los 30 días.',
      subjective: 'Paciente refiere mejoría tras antibiótico y esteroide en enero. Disnea regresó a basal. Sin esputo purulento.',
      objective: 'SatO2 93%, FR 18. Auscultación: sibilancias espiratorias leves. Mejor que en consulta previa.',
      assessment: 'Recuperación adecuada post-exacerbación EPOC. Estabilización alcanzada.',
      plan: 'Mantener tiotropio. Introducir programa de respiración diafragmática. Oximetría domiciliaria en noches. Cita en 6 meses.',
      vitalsBloodPressure: '138/86',
      vitalsHeartRate: 82,
      vitalsTemperature: 36.3,
      vitalsWeight: 70.5,
      vitalsHeight: 168,
      vitalsOxygenSat: 93,
      status: 'completed',
    },
  ],
  7: [ // Carmen - Lupus
    {
      encounterDate: new Date('2024-12-03'),
      encounterType: 'follow-up',
      chiefComplaint: 'Control de lupus. Artralgia en manos y muñecas desde hace 2 semanas.',
      subjective: 'Paciente femenina de 46 años con LES en remisión hace 18 meses. Refiere artralgia en MCF y muñecas bilaterales, rigidez matutina 30 min. Sin fotosensibilidad nueva, sin fiebre, sin alopecia. Cumple con hidroxicloroquina y prednisona.',
      objective: 'SLEDAI actual: 4 (artralgia). Artralgias a la palpación de muñecas y MCF bilaterales sin sinovitis activa. Sin rash malar. Anti-dsDNA 1:40 (estable). Complemento C3 88 mg/dL (ligeramente bajo), C4 normal.',
      assessment: 'LES con actividad leve (artralgia). Sin brote sistémico. Monitoreo.',
      plan: 'Ajuste de prednisona a 7.5 mg/día x 2 semanas, luego regresar a 5 mg. Naproxeno 500 mg c/12h x 10 días por artralgia. Solicitar BH, QS, examen de orina, complemento. Cita en 4 semanas.',
      vitalsBloodPressure: '120/76',
      vitalsHeartRate: 74,
      vitalsTemperature: 36.8,
      vitalsWeight: 64,
      vitalsHeight: 160,
      vitalsOxygenSat: 98,
      followUpDate: new Date('2024-12-31'),
      status: 'completed',
    },
    {
      encounterDate: new Date('2024-08-20'),
      encounterType: 'follow-up',
      chiefComplaint: 'Control bimestral. Asintomática.',
      subjective: 'Paciente sin quejas. Buen control desde hace un año. Tolera medicamentos sin efectos secundarios referidos. Protección solar rigurosa.',
      objective: 'SLEDAI 0. Exploración física sin hallazgos patológicos. Laboratorios: anti-dsDNA 1:20 (bajo), C3 y C4 normales, creatinina 0.8 mg/dL, sedimento urinario normal.',
      assessment: 'LES en remisión completa. Excelente control farmacológico.',
      plan: 'Mantener hidroxicloroquina y prednisona 5 mg. Intentar reducción de esteroide a 2.5 mg en 2 meses si permanece estable. Densitometría ósea anual. Cita en 2 meses.',
      vitalsBloodPressure: '118/74',
      vitalsHeartRate: 70,
      vitalsTemperature: 36.4,
      vitalsWeight: 63.5,
      vitalsHeight: 160,
      vitalsOxygenSat: 99,
      status: 'completed',
    },
  ],
};

// Prescriptions per patient (patientIndex -> prescriptions)
const PRESCRIPTIONS: Record<number, Array<{
  prescriptionDate: Date;
  status: string;
  diagnosis: string;
  medications: Array<{
    drugName: string;
    presentation: string;
    dosage: string;
    frequency: string;
    duration: string;
    quantity: string;
    instructions: string;
  }>;
}>> = {
  0: [
    {
      prescriptionDate: new Date('2024-11-05'),
      status: 'issued',
      diagnosis: 'Diabetes mellitus tipo 2 con control subóptimo. Hipertensión arterial sistémica.',
      medications: [
        {
          drugName: 'Metformina',
          presentation: 'Tableta',
          dosage: '1 g',
          frequency: 'Cada 12 horas',
          duration: '60 días',
          quantity: '120 tabletas',
          instructions: 'Tomar con los alimentos para reducir molestias gastrointestinales.',
        },
        {
          drugName: 'Enalapril',
          presentation: 'Tableta',
          dosage: '10 mg',
          frequency: 'Cada 24 horas (mañana)',
          duration: '60 días',
          quantity: '60 tabletas',
          instructions: 'Tomar en la mañana. Vigilar mareos al incorporarse.',
        },
        {
          drugName: 'Atorvastatina',
          presentation: 'Tableta',
          dosage: '20 mg',
          frequency: 'Cada 24 horas (noche)',
          duration: '60 días',
          quantity: '60 tabletas',
          instructions: 'Tomar por la noche. Reportar dolor muscular intenso.',
        },
      ],
    },
  ],
  1: [
    {
      prescriptionDate: new Date('2024-10-20'),
      status: 'issued',
      diagnosis: 'Hipotiroidismo primario con control subóptimo.',
      medications: [
        {
          drugName: 'Levotiroxina',
          presentation: 'Tableta',
          dosage: '75 mcg',
          frequency: 'Cada 24 horas (ayuno)',
          duration: '60 días',
          quantity: '60 tabletas',
          instructions: 'Tomar en ayuno 30-60 minutos antes del desayuno. No tomar con calcio, hierro o antiácidos en las 4 horas siguientes.',
        },
      ],
    },
  ],
  2: [
    {
      prescriptionDate: new Date('2024-12-01'),
      status: 'issued',
      diagnosis: 'Exacerbación leve de asma bronquial. Rinitis alérgica.',
      medications: [
        {
          drugName: 'Budesonida / Formoterol',
          presentation: 'Inhalador',
          dosage: '160/4.5 mcg',
          frequency: 'Cada 12 horas',
          duration: '14 días',
          quantity: '1 inhalador',
          instructions: 'Técnica inhalatoria correcta. Enjuagar boca con agua al terminar para evitar candidiasis oral.',
        },
        {
          drugName: 'Salbutamol',
          presentation: 'Inhalador',
          dosage: '100 mcg (2 disparos)',
          frequency: 'Cada 4-6 horas según necesidad',
          duration: 'Indefinido (SOS)',
          quantity: '1 inhalador',
          instructions: 'Usar solo en caso de broncoespasmo agudo. Si necesita más de 4 veces al día, consultar urgente.',
        },
        {
          drugName: 'Loratadina',
          presentation: 'Tableta',
          dosage: '10 mg',
          frequency: 'Cada 24 horas',
          duration: '30 días',
          quantity: '30 tabletas',
          instructions: 'Puede causar somnolencia leve. Tomar preferentemente por la noche.',
        },
      ],
    },
  ],
  3: [
    {
      prescriptionDate: new Date('2024-09-10'),
      status: 'issued',
      diagnosis: 'Faringoamigdalitis bacteriana aguda.',
      medications: [
        {
          drugName: 'Amoxicilina',
          presentation: 'Cápsula',
          dosage: '500 mg',
          frequency: 'Cada 8 horas',
          duration: '10 días',
          quantity: '30 cápsulas',
          instructions: 'Completar todo el esquema aunque mejore antes. Tomar con alimentos.',
        },
        {
          drugName: 'Paracetamol',
          presentation: 'Tableta',
          dosage: '500 mg',
          frequency: 'Cada 6 horas según necesidad',
          duration: '5 días',
          quantity: '20 tabletas',
          instructions: 'Solo si hay fiebre o dolor. No exceder 4 g/día.',
        },
      ],
    },
  ],
  4: [
    {
      prescriptionDate: new Date('2024-11-28'),
      status: 'issued',
      diagnosis: 'Insuficiencia cardíaca leve (NYHA II). Cardiopatía isquémica. Diabetes mellitus tipo 2.',
      medications: [
        {
          drugName: 'Furosemida',
          presentation: 'Tableta',
          dosage: '20 mg',
          frequency: 'Cada 24 horas (mañana)',
          duration: '30 días',
          quantity: '30 tabletas',
          instructions: 'Tomar por la mañana para evitar nocturia. Registrar peso diario. Si sube >2 kg en 24h, acudir a urgencias.',
        },
        {
          drugName: 'Bisoprolol',
          presentation: 'Tableta',
          dosage: '5 mg',
          frequency: 'Cada 24 horas',
          duration: '30 días',
          quantity: '30 tabletas',
          instructions: 'No suspender abruptamente. Vigilar pulso (>50 lpm).',
        },
        {
          drugName: 'Atorvastatina',
          presentation: 'Tableta',
          dosage: '40 mg',
          frequency: 'Cada 24 horas (noche)',
          duration: '30 días',
          quantity: '30 tabletas',
          instructions: 'Reportar mialgia intensa o debilidad muscular.',
        },
        {
          drugName: 'Ácido acetilsalicílico',
          presentation: 'Tableta (con cubierta entérica)',
          dosage: '100 mg',
          frequency: 'Cada 24 horas',
          duration: '30 días',
          quantity: '30 tabletas',
          instructions: 'Tomar con alimentos. No tomar ibuprofeno ni naproxeno.',
        },
        {
          drugName: 'Metformina',
          presentation: 'Tableta',
          dosage: '1 g',
          frequency: 'Cada 12 horas',
          duration: '30 días',
          quantity: '60 tabletas',
          instructions: 'Con los alimentos. Suspender 48h antes de cualquier medio de contraste IV.',
        },
      ],
    },
  ],
  5: [
    {
      prescriptionDate: new Date('2024-05-30'),
      status: 'issued',
      diagnosis: 'Anafilaxia por alérgeno alimentario (mariscos). Plan de acción.',
      medications: [
        {
          drugName: 'Epinefrina (adrenalina) autoinyectable',
          presentation: 'Pluma autoinyectable',
          dosage: '0.3 mg / 0.3 mL',
          frequency: 'Dosis única ante síntomas de anafilaxia, repetir en 5-15 min si no mejora',
          duration: 'Indefinido (emergencia)',
          quantity: '2 plumas autoinyectables',
          instructions: 'Inyectar en cara lateral del muslo. Llamar a emergencias (911) inmediatamente después. Llevar siempre consigo. Revisar fecha de caducidad cada 6 meses.',
        },
        {
          drugName: 'Difenhidramina',
          presentation: 'Tableta',
          dosage: '50 mg',
          frequency: 'Dosis única (reacción leve sin anafilaxia)',
          duration: 'Indefinido (emergencia)',
          quantity: '10 tabletas',
          instructions: 'Solo para reacciones leves sin dificultad respiratoria. Si hay disnea, usar adrenalina primero.',
        },
      ],
    },
  ],
  6: [
    {
      prescriptionDate: new Date('2024-10-14'),
      status: 'issued',
      diagnosis: 'Exacerbación moderada de EPOC. Hipertensión arterial.',
      medications: [
        {
          drugName: 'Azitromicina',
          presentation: 'Tableta',
          dosage: '500 mg',
          frequency: 'Cada 24 horas',
          duration: '5 días',
          quantity: '5 tabletas',
          instructions: 'Tomar con o sin alimentos, a la misma hora cada día.',
        },
        {
          drugName: 'Prednisona',
          presentation: 'Tableta',
          dosage: '40 mg',
          frequency: 'Cada 24 horas (mañana)',
          duration: '5 días',
          quantity: '5 tabletas',
          instructions: 'Tomar con desayuno. No suspender abruptamente (dosis única por 5 días).',
        },
        {
          drugName: 'Salbutamol para nebulización',
          presentation: 'Solución para nebulizar',
          dosage: '2.5 mg / 2.5 mL',
          frequency: 'Cada 4 horas las primeras 48h, luego cada 6h',
          duration: '7 días',
          quantity: '14 ampollas',
          instructions: 'Nebulizar con mascarilla o boquilla. Solicitar nebulizador en farmacia o alquilar.',
        },
        {
          drugName: 'Amlodipino',
          presentation: 'Tableta',
          dosage: '5 mg',
          frequency: 'Cada 24 horas',
          duration: '30 días',
          quantity: '30 tabletas',
          instructions: 'Puede causar edema en tobillos. Tomar a la misma hora.',
        },
      ],
    },
  ],
  7: [
    {
      prescriptionDate: new Date('2024-12-03'),
      status: 'issued',
      diagnosis: 'Lupus eritematoso sistémico con actividad leve (artralgia). Artritis inflamatoria.',
      medications: [
        {
          drugName: 'Prednisona',
          presentation: 'Tableta',
          dosage: '7.5 mg',
          frequency: 'Cada 24 horas (mañana)',
          duration: '14 días luego reducir a 5 mg',
          quantity: '30 tabletas',
          instructions: 'Tomar con desayuno y protector gástrico. No suspender abruptamente. Regresar a 5 mg después de 14 días.',
        },
        {
          drugName: 'Hidroxicloroquina',
          presentation: 'Tableta',
          dosage: '200 mg',
          frequency: 'Cada 12 horas',
          duration: '60 días',
          quantity: '120 tabletas',
          instructions: 'Tomar con alimentos. Requiere revisión oftalmológica anual por riesgo de retinopatía.',
        },
        {
          drugName: 'Naproxeno',
          presentation: 'Tableta',
          dosage: '500 mg',
          frequency: 'Cada 12 horas',
          duration: '10 días',
          quantity: '20 tabletas',
          instructions: 'Tomar con alimentos o leche. Usar omeprazol 20 mg si hay dolor gástrico.',
        },
      ],
    },
  ],
};

const TASKS = [
  {
    title: 'Solicitar HbA1c y microalbuminuria - Carlos Ramírez',
    description: 'Paciente P-001. Solicitar HbA1c, química sanguínea completa, EGO y microalbuminuria. Control de diabetes.',
    dueDate: new Date('2024-11-20'),
    priority: 'ALTA',
    status: 'COMPLETADA',
    category: 'LABORATORIO',
  },
  {
    title: 'Referencia a nefrología - Carlos Ramírez',
    description: 'Paciente P-001. Elaborar hoja de referencia a nefrología por nefropatía diabética incipiente (microalbuminuria elevada).',
    dueDate: new Date('2024-11-12'),
    priority: 'ALTA',
    status: 'COMPLETADA',
    category: 'REFERENCIA',
  },
  {
    title: 'Verificar TSH de seguimiento - Laura González',
    description: 'Paciente P-002. Confirmar que la paciente se realizó TSH y T4 libre 6-8 semanas después del ajuste de levotiroxina. Llamar si no hay resultados.',
    dueDate: new Date('2024-12-10'),
    priority: 'MEDIA',
    status: 'PENDIENTE',
    category: 'SEGUIMIENTO',
  },
  {
    title: 'Cita de seguimiento asma - Miguel Ángel Torres',
    description: 'Paciente P-003. Agendar consulta de revisión en 2 semanas para evaluar respuesta a budesonida/formoterol y control de exacerbación.',
    dueDate: new Date('2024-12-15'),
    priority: 'MEDIA',
    status: 'PENDIENTE',
    category: 'SEGUIMIENTO',
  },
  {
    title: 'Referencia a alergología - Valeria López',
    description: 'Paciente P-006. Enviar hoja de referencia a alergología para estudio de alergia alimentaria (mariscos) y posible inmunoterapia.',
    dueDate: new Date('2024-06-10'),
    priority: 'ALTA',
    status: 'COMPLETADA',
    category: 'REFERENCIA',
  },
  {
    title: 'Ecocardiograma de control - Roberto Hernández',
    description: 'Paciente P-005. Solicitar ecocardiograma transtorácico de control para evaluar fracción de eyección. Último FE 48%.',
    dueDate: new Date('2024-12-20'),
    priority: 'ALTA',
    status: 'PENDIENTE',
    category: 'ESTUDIO',
  },
  {
    title: 'Seguimiento post-exacerbación EPOC - Jorge Pérez',
    description: 'Paciente P-007. Verificar recuperación 5 días después de exacerbación. Confirmar SatO2 y auscultación. Evaluar si completó antibiótico.',
    dueDate: new Date('2024-10-19'),
    priority: 'ALTA',
    status: 'COMPLETADA',
    category: 'SEGUIMIENTO',
  },
  {
    title: 'Control de laboratorios - Carmen Ruiz (Lupus)',
    description: 'Paciente P-008. Revisar resultados de BH, QS, anti-dsDNA y complemento solicitados en última consulta. Evaluar actividad de enfermedad.',
    dueDate: new Date('2024-12-20'),
    priority: 'ALTA',
    status: 'PENDIENTE',
    category: 'LABORATORIO',
  },
  {
    title: 'Densitometría ósea - Carmen Ruiz',
    description: 'Paciente P-008. Solicitar densitometría ósea anual por uso crónico de corticosteroides (prednisona). Riesgo de osteoporosis.',
    dueDate: new Date('2025-01-15'),
    priority: 'MEDIA',
    status: 'PENDIENTE',
    category: 'ESTUDIO',
  },
  {
    title: 'Revisión de esquema de vacunación - Miguel Ángel Torres',
    description: 'Paciente P-003 asmático. Verificar vacuna anti-influenza y anti-neumocócica al día. Administrar si no tiene registro.',
    dueDate: new Date('2025-01-10'),
    priority: 'BAJA',
    status: 'PENDIENTE',
    category: 'PREVENTIVO',
  },
];

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  console.log('🌱 Seeding mock EMR data for sismo.sistema1@gmail.com...\n');

  // 1. Find user
  const user = await prisma.user.findUnique({
    where: { email: 'sismo.sistema1@gmail.com' },
    include: { doctor: true },
  });

  if (!user) {
    throw new Error('User sismo.sistema1@gmail.com not found in database.');
  }
  if (!user.doctor) {
    throw new Error('User sismo.sistema1@gmail.com has no linked doctor profile.');
  }

  const { doctor } = user;
  console.log(`✅ Found doctor: ${doctor.doctorFullName} (${doctor.slug})`);
  console.log(`   Doctor ID: ${doctor.id}`);
  console.log(`   User ID:   ${user.id}\n`);

  // 2. Guard: skip if data already exists
  const existingPatients = await prisma.patient.count({
    where: { doctorId: doctor.id },
  });
  if (existingPatients > 0) {
    console.log(`⚠️  Doctor already has ${existingPatients} patients. Skipping to avoid duplicates.`);
    console.log('   Delete existing EMR data first if you want to re-seed.');
    return;
  }

  // 3. Create patients + their encounters and prescriptions
  for (let i = 0; i < PATIENTS.length; i++) {
    const patientData = PATIENTS[i]!;

    const patient = await prisma.patient.create({
      data: {
        doctorId: doctor.id,
        internalId: patientData.internalId,
        firstName: patientData.firstName,
        lastName: patientData.lastName,
        dateOfBirth: patientData.dateOfBirth,
        sex: patientData.sex,
        phone: patientData.phone,
        city: patientData.city,
        bloodType: patientData.bloodType,
        currentChronicConditions: patientData.currentChronicConditions,
        currentMedications: patientData.currentMedications,
        currentAllergies: patientData.currentAllergies,
        tags: patientData.tags,
        firstVisitDate: patientData.firstVisitDate,
        lastVisitDate: patientData.lastVisitDate,
        status: 'active',
      },
    });

    console.log(`  👤 Patient created: ${patient.firstName} ${patient.lastName} (${patient.internalId})`);

    // Encounters
    const encounterList = ENCOUNTERS[i] ?? [];
    for (const enc of encounterList) {
      await prisma.clinicalEncounter.create({
        data: {
          patientId: patient.id,
          doctorId: doctor.id,
          encounterDate: enc.encounterDate,
          encounterType: enc.encounterType,
          chiefComplaint: enc.chiefComplaint,
          subjective: enc.subjective,
          objective: enc.objective,
          assessment: enc.assessment,
          plan: enc.plan,
          vitalsBloodPressure: enc.vitalsBloodPressure,
          vitalsHeartRate: enc.vitalsHeartRate,
          vitalsTemperature: enc.vitalsTemperature !== undefined ? enc.vitalsTemperature : null,
          vitalsWeight: enc.vitalsWeight !== undefined ? enc.vitalsWeight : null,
          vitalsHeight: enc.vitalsHeight !== undefined ? enc.vitalsHeight : null,
          vitalsOxygenSat: enc.vitalsOxygenSat,
          followUpDate: enc.followUpDate,
          status: enc.status,
          completedAt: enc.status === 'completed' ? enc.encounterDate : null,
          createdBy: user.id,
        },
      });
    }
    if (encounterList.length > 0) {
      console.log(`     📋 ${encounterList.length} encounter(s) created`);
    }

    // Prescriptions
    const prescriptionList = PRESCRIPTIONS[i] ?? [];
    for (const rx of prescriptionList) {
      await prisma.prescription.create({
        data: {
          patientId: patient.id,
          doctorId: doctor.id,
          prescriptionDate: rx.prescriptionDate,
          status: rx.status,
          diagnosis: rx.diagnosis,
          doctorFullName: doctor.doctorFullName,
          doctorLicense: doctor.cedulaProfesional ?? 'Sin cédula',
          issuedAt: rx.status === 'issued' ? rx.prescriptionDate : null,
          medications: {
            create: rx.medications.map((med, order) => ({
              drugName: med.drugName,
              presentation: med.presentation,
              dosage: med.dosage,
              frequency: med.frequency,
              duration: med.duration,
              quantity: med.quantity,
              instructions: med.instructions,
              order,
            })),
          },
        },
      });
    }
    if (prescriptionList.length > 0) {
      console.log(`     💊 ${prescriptionList.length} prescription(s) created`);
    }
  }

  // 4. Create tasks
  console.log('\n  Creating tasks...');
  for (const task of TASKS) {
    await prisma.task.create({
      data: {
        doctorId: doctor.id,
        title: task.title,
        description: task.description,
        dueDate: task.dueDate,
        priority: task.priority,
        status: task.status,
        category: task.category,
        completedAt: task.status === 'COMPLETADA' ? task.dueDate : null,
      },
    });
  }
  console.log(`  ✅ ${TASKS.length} tasks created`);

  // 5. Summary
  console.log('\n🎉 Seeding complete!\n');
  console.log('📊 Summary:');
  console.log(`   Patients:      ${PATIENTS.length}`);
  const totalEncounters = Object.values(ENCOUNTERS).reduce((s, arr) => s + arr.length, 0);
  const totalPrescriptions = Object.values(PRESCRIPTIONS).reduce((s, arr) => s + arr.length, 0);
  console.log(`   Encounters:    ${totalEncounters}`);
  console.log(`   Prescriptions: ${totalPrescriptions}`);
  console.log(`   Tasks:         ${TASKS.length}`);
}

main()
  .catch((e) => {
    console.error('❌ Error:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
