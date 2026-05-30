import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@healthcare/database';
import { requireDoctorAuth, logAudit } from '@/lib/medical-auth';
import { handleApiError } from '@/lib/api-error-handler';
import { OpenAIChatProvider } from '@/lib/ai/providers/openai';

// GET /api/medical-records/patients/:id/summary
// Returns the latest saved summary (or null)
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { doctorId } = await requireDoctorAuth(request);
    const { id: patientId } = await params;

    const patient = await prisma.patient.findFirst({
      where: { id: patientId, doctorId },
      select: { id: true },
    });

    if (!patient) {
      return NextResponse.json({ error: 'Patient not found' }, { status: 404 });
    }

    const summary = await prisma.patientSummary.findFirst({
      where: { patientId, doctorId },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        content: true,
        dataPoints: true,
        createdAt: true,
      },
    });

    return NextResponse.json({ data: summary });
  } catch (error) {
    return handleApiError(error, 'GET /api/medical-records/patients/[id]/summary');
  }
}

// POST /api/medical-records/patients/:id/summary
// Generates a new AI summary, saves it, and returns it
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { doctorId, userId, role } = await requireDoctorAuth(request);
    const { id: patientId } = await params;

    // Fetch patient with baseline medical info
    const patient = await prisma.patient.findFirst({
      where: { id: patientId, doctorId },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        dateOfBirth: true,
        sex: true,
        bloodType: true,
        currentAllergies: true,
        currentChronicConditions: true,
        currentMedications: true,
        generalNotes: true,
        tags: true,
      },
    });

    if (!patient) {
      return NextResponse.json({ error: 'Patient not found' }, { status: 404 });
    }

    // Fetch all clinical data in parallel
    const [encounters, prescriptions, patientNotes] = await Promise.all([
      prisma.clinicalEncounter.findMany({
        where: { patientId, doctorId },
        orderBy: { encounterDate: 'desc' },
        select: {
          encounterDate: true,
          encounterType: true,
          chiefComplaint: true,
          status: true,
          subjective: true,
          objective: true,
          assessment: true,
          plan: true,
          clinicalNotes: true,
          vitalsBloodPressure: true,
          vitalsHeartRate: true,
          vitalsTemperature: true,
          vitalsWeight: true,
          vitalsHeight: true,
          vitalsOxygenSat: true,
          followUpDate: true,
          followUpNotes: true,
        },
      }),
      prisma.prescription.findMany({
        where: { patientId, doctorId },
        orderBy: { prescriptionDate: 'desc' },
        select: {
          prescriptionDate: true,
          status: true,
          diagnosis: true,
          medications: {
            select: {
              drugName: true,
              presentation: true,
              dosage: true,
              frequency: true,
              duration: true,
            },
            orderBy: { order: 'asc' },
          },
          imagingStudies: {
            select: { studyName: true, region: true, indication: true },
          },
          labStudies: {
            select: { studyName: true, indication: true },
          },
        },
      }),
      prisma.patientNote.findMany({
        where: { patientId, doctorId },
        orderBy: { createdAt: 'desc' },
        select: { content: true, createdAt: true },
      }),
    ]);

    // Build clinical context text
    const age = Math.floor(
      (Date.now() - new Date(patient.dateOfBirth).getTime()) / (365.25 * 24 * 60 * 60 * 1000)
    );

    let ctx = `DATOS DEL PACIENTE:\n`;
    ctx += `Nombre: ${patient.firstName} ${patient.lastName}\n`;
    ctx += `Edad: ${age} años | Sexo: ${patient.sex}\n`;
    if (patient.bloodType) ctx += `Tipo de sangre: ${patient.bloodType}\n`;
    if (patient.currentAllergies) ctx += `Alergias: ${patient.currentAllergies}\n`;
    if (patient.currentChronicConditions) ctx += `Condiciones crónicas: ${patient.currentChronicConditions}\n`;
    if (patient.currentMedications) ctx += `Medicamentos actuales: ${patient.currentMedications}\n`;
    if (patient.generalNotes) ctx += `Notas generales: ${patient.generalNotes}\n`;
    if (patient.tags.length > 0) ctx += `Etiquetas: ${patient.tags.join(', ')}\n`;

    if (encounters.length > 0) {
      ctx += `\n--- CONSULTAS CLÍNICAS (${encounters.length}) ---\n`;
      for (const enc of encounters) {
        const date = new Date(enc.encounterDate).toISOString().split('T')[0];
        ctx += `\n[${date}] ${enc.encounterType || 'Consulta'} (${enc.status})\n`;
        if (enc.chiefComplaint) ctx += `  Motivo: ${enc.chiefComplaint}\n`;
        if (enc.subjective) ctx += `  Subjetivo: ${enc.subjective}\n`;
        if (enc.objective) ctx += `  Objetivo: ${enc.objective}\n`;
        if (enc.assessment) ctx += `  Evaluación: ${enc.assessment}\n`;
        if (enc.plan) ctx += `  Plan: ${enc.plan}\n`;
        if (enc.clinicalNotes) ctx += `  Notas: ${enc.clinicalNotes}\n`;

        const vitals: string[] = [];
        if (enc.vitalsBloodPressure) vitals.push(`PA: ${enc.vitalsBloodPressure}`);
        if (enc.vitalsHeartRate) vitals.push(`FC: ${enc.vitalsHeartRate}`);
        if (enc.vitalsTemperature) vitals.push(`Temp: ${enc.vitalsTemperature}`);
        if (enc.vitalsWeight) vitals.push(`Peso: ${enc.vitalsWeight}`);
        if (enc.vitalsHeight) vitals.push(`Talla: ${enc.vitalsHeight}`);
        if (enc.vitalsOxygenSat) vitals.push(`SpO2: ${enc.vitalsOxygenSat}`);
        if (vitals.length > 0) ctx += `  Signos vitales: ${vitals.join(' | ')}\n`;

        if (enc.followUpDate) {
          ctx += `  Seguimiento: ${new Date(enc.followUpDate).toISOString().split('T')[0]}`;
          if (enc.followUpNotes) ctx += ` — ${enc.followUpNotes}`;
          ctx += '\n';
        }
      }
    }

    if (prescriptions.length > 0) {
      ctx += `\n--- PRESCRIPCIONES (${prescriptions.length}) ---\n`;
      for (const rx of prescriptions) {
        const date = new Date(rx.prescriptionDate).toISOString().split('T')[0];
        ctx += `\n[${date}] Estado: ${rx.status}\n`;
        if (rx.diagnosis) ctx += `  Diagnóstico: ${rx.diagnosis}\n`;
        for (const med of rx.medications) {
          ctx += `  - ${med.drugName}`;
          if (med.presentation) ctx += ` (${med.presentation})`;
          if (med.dosage) ctx += ` | Dosis: ${med.dosage}`;
          if (med.frequency) ctx += ` | Frecuencia: ${med.frequency}`;
          if (med.duration) ctx += ` | Duración: ${med.duration}`;
          ctx += '\n';
        }
        for (const img of rx.imagingStudies) {
          ctx += `  - Estudio imagen: ${img.studyName}`;
          if (img.region) ctx += ` (${img.region})`;
          if (img.indication) ctx += ` — ${img.indication}`;
          ctx += '\n';
        }
        for (const lab of rx.labStudies) {
          ctx += `  - Lab: ${lab.studyName}`;
          if (lab.indication) ctx += ` — ${lab.indication}`;
          ctx += '\n';
        }
      }
    }

    if (patientNotes.length > 0) {
      ctx += `\n--- NOTAS DEL MÉDICO (${patientNotes.length}) ---\n`;
      for (const note of patientNotes) {
        const date = new Date(note.createdAt).toISOString().split('T')[0];
        ctx += `[${date}] ${note.content}\n`;
      }
    }

    // Call the LLM
    const chatProvider = new OpenAIChatProvider();
    const result = await chatProvider.chatCompletion(
      [
        {
          role: 'system',
          content: `Eres un asistente médico especializado en generar resúmenes clínicos concisos y útiles para médicos.

Tu tarea es analizar toda la información clínica de un paciente y generar un resumen ejecutivo estructurado EN ESPAÑOL.

El resumen debe incluir las siguientes secciones (omite secciones si no hay datos relevantes):

1. **Datos Generales** — Edad, sexo, tipo de sangre, alergias conocidas
2. **Antecedentes Relevantes** — Condiciones crónicas, medicamentos de base
3. **Resumen de Consultas** — Síntesis de los motivos de consulta principales, patrones observados, evolución clínica
4. **Diagnósticos Principales** — Lista de diagnósticos encontrados en consultas y prescripciones
5. **Tratamientos y Medicamentos** — Resumen de medicamentos prescritos, cambios de tratamiento
6. **Estudios Solicitados** — Laboratorios e imágenes ordenados
7. **Signos Vitales Relevantes** — Tendencias o valores fuera de rango
8. **Seguimiento Pendiente** — Próximas citas programadas, pendientes por atender
9. **Observaciones Importantes** — Cualquier patrón, riesgo o punto de atención que el médico deba considerar

Reglas:
- Sé conciso pero completo. Un médico leerá esto para ponerse al día rápidamente.
- Usa terminología médica apropiada.
- Organiza cronológicamente cuando sea relevante.
- Si hay pocos datos, genera el resumen con lo disponible sin inventar información.
- NO incluyas datos de contacto, fiscales o administrativos del paciente.
- Responde SOLO con el resumen, sin preámbulos ni despedidas.`,
        },
        {
          role: 'user',
          content: `Genera un resumen clínico completo de este paciente basado en la siguiente información:\n\n${ctx}`,
        },
      ],
      {
        model: 'gpt-4o',
        temperature: 0.2,
        maxTokens: 4096,
      }
    );

    const dataPoints = {
      encounters: encounters.length,
      prescriptions: prescriptions.length,
      notes: patientNotes.length,
    };

    // Delete old summaries for this patient and create the new one
    await prisma.patientSummary.deleteMany({
      where: { patientId, doctorId },
    });

    const summary = await prisma.patientSummary.create({
      data: {
        patientId,
        doctorId,
        content: result.content,
        dataPoints,
      },
      select: {
        id: true,
        content: true,
        dataPoints: true,
        createdAt: true,
      },
    });

    // Audit log (fire and forget)
    logAudit({
      patientId,
      doctorId,
      userId,
      userRole: role,
      action: 'generate_ai_summary',
      resourceType: 'patient',
      resourceId: summary.id,
      request,
    }).catch((err) => console.error('Audit log failed:', err));

    return NextResponse.json({ data: summary });
  } catch (error) {
    return handleApiError(error, 'POST /api/medical-records/patients/[id]/summary');
  }
}
