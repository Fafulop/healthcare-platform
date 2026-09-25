import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@healthcare/database';
import { requireDoctorAuth, logAudit } from '@/lib/medical-auth';
import { logEncounterUpdated, logEncounterDeleted } from '@/lib/activity-logger';
import { handleApiError } from '@/lib/api-error-handler';
import { moverConsultaDeVisita, resolverVisitaDeHijo } from '@/lib/visitas';

// GET /api/medical-records/patients/:id/encounters/:encounterId
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; encounterId: string }> }
) {
  try {
    const { doctorId, userId, role } = await requireDoctorAuth(request);
    const { id: patientId, encounterId } = await params;

    const encounter = await prisma.clinicalEncounter.findFirst({
      where: {
        id: encounterId,
        patientId,
        doctorId
      },
      include: {
        patient: {
          select: {
            id: true,
            internalId: true,
            firstName: true,
            lastName: true,
            dateOfBirth: true,
            sex: true,
          }
        },
        media: {
          select: {
            id: true,
            mediaType: true,
            fileName: true,
            fileUrl: true,
            fileSize: true,
            mimeType: true,
            thumbnailUrl: true,
            category: true,
            description: true,
            captureDate: true,
          },
          orderBy: { captureDate: 'desc' }
        }
      }
    });

    if (!encounter) {
      return NextResponse.json(
        { error: 'Encounter not found' },
        { status: 404 }
      );
    }

    // Log audit
    await logAudit({
      patientId,
      doctorId,
      userId,
      userRole: role,
      action: 'view_encounter',
      resourceType: 'encounter',
      resourceId: encounterId,
      request
    });

    return NextResponse.json({ data: encounter });
  } catch (error) {
    return handleApiError(error, 'GET /api/medical-records/patients/[id]/encounters/[encounterId]');
  }
}

// PUT /api/medical-records/patients/:id/encounters/:encounterId
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; encounterId: string }> }
) {
  try {
    const { doctorId, userId, role } = await requireDoctorAuth(request);
    const { id: patientId, encounterId } = await params;
    const body = await request.json();

    // Verify encounter belongs to doctor
    const existingEncounter = await prisma.clinicalEncounter.findFirst({
      where: {
        id: encounterId,
        patientId,
        doctorId
      },
      include: {
        patient: { select: { firstName: true, lastName: true } }
      }
    });

    if (!existingEncounter) {
      return NextResponse.json(
        { error: 'Encounter not found' },
        { status: 404 }
      );
    }

    // VISITAS D3: validate a visit change BEFORE writing anything (404/400 must not leave a
    // version snapshot behind). `undefined` = the body didn't touch the visit.
    const nuevaVisita = await resolverVisitaDeHijo(doctorId, patientId, {
      visitaId: body.visitaId, encounterId: null, encounterCambio: false,
    });
    const cambiaVisita = nuevaVisita !== undefined && nuevaVisita !== existingEncounter.visitaId;

    // VISITAS D3: a PUT that ONLY carries `visitaId` (the «¿A qué visita pertenece?» control) just
    // moves the consultation. It must not run the full update below: that one clears
    // followUpDate when absent, stamps amendedAt and writes a version snapshot for a change
    // that touched no clinical content.
    const soloVisita = body.visitaId !== undefined && Object.keys(body).every((k) => k === 'visitaId');
    if (soloVisita) {
      if (cambiaVisita) {
        const arrastrados = await prisma.$transaction((tx) =>
          moverConsultaDeVisita(tx, encounterId, nuevaVisita ?? null),
        );
        await logAudit({
          patientId, doctorId, userId, userRole: role,
          action: 'move_encounter_visita', resourceType: 'encounter', resourceId: encounterId,
          changes: { visitaId: { from: existingEncounter.visitaId, to: nuevaVisita ?? null }, arrastrados },
          request,
        });
      }
      const moved = await prisma.clinicalEncounter.findUnique({ where: { id: encounterId } });
      return NextResponse.json({ data: moved });
    }

    // Create version snapshot before updating
    const versionCount = await prisma.encounterVersion.count({
      where: { encounterId }
    });

    await prisma.encounterVersion.create({
      data: {
        encounterId,
        versionNumber: versionCount + 1,
        encounterData: existingEncounter as any,
        createdBy: userId,
        changeReason: body.amendmentReason || 'Updated encounter',
      }
    });

    // Update encounter — and, if the visit changes, move it WITH its photos, prescriptions and
    // reports in the SAME transaction (VISITAS D3): if the update fails, nothing moved.
    const { encounter, arrastrados } = await prisma.$transaction(async (tx) => {
      const arrastrados = cambiaVisita
        ? await moverConsultaDeVisita(tx, encounterId, nuevaVisita ?? null)
        : null;
      const encounter = await tx.clinicalEncounter.update({
        where: { id: encounterId },
        data: {
          encounterDate: body.encounterDate ? new Date(body.encounterDate) : undefined,
          encounterType: body.encounterType,
          chiefComplaint: body.chiefComplaint,
          location: body.location,
          status: body.status,
          clinicalNotes: body.clinicalNotes,
          subjective: body.subjective,
          objective: body.objective,
          assessment: body.assessment,
          plan: body.plan,
          vitalsBloodPressure: body.vitalsBloodPressure,
          vitalsHeartRate: body.vitalsHeartRate,
          vitalsTemperature: body.vitalsTemperature,
          vitalsWeight: body.vitalsWeight,
          vitalsHeight: body.vitalsHeight,
          vitalsOxygenSat: body.vitalsOxygenSat,
          vitalsOther: body.vitalsOther,
          followUpDate: body.followUpDate ? new Date(body.followUpDate) : null,
          followUpNotes: body.followUpNotes,
          customData: body.customData !== undefined ? body.customData : undefined,
          templateId: body.templateId !== undefined ? body.templateId : undefined,
          amendedAt: new Date(),
          amendmentReason: body.amendmentReason,
        }
      });
      return { encounter, arrastrados };
    });

    // The visit move is audited from → to, with the ids of the dragged children (NOM-024).
    if (arrastrados) {
      await logAudit({
        patientId, doctorId, userId, userRole: role,
        action: 'move_encounter_visita', resourceType: 'encounter', resourceId: encounterId,
        changes: { visitaId: { from: existingEncounter.visitaId, to: nuevaVisita ?? null }, arrastrados },
        request,
      });
    }

    // Log audit
    await logAudit({
      patientId,
      doctorId,
      userId,
      userRole: role,
      action: 'update_encounter',
      resourceType: 'encounter',
      resourceId: encounterId,
      changes: body,
      request
    });

    // Log activity for dashboard
    logEncounterUpdated({
      doctorId,
      encounterId,
      patientName: `${existingEncounter.patient.firstName} ${existingEncounter.patient.lastName}`,
      userId,
    });

    return NextResponse.json({ data: encounter });
  } catch (error) {
    return handleApiError(error, 'PUT /api/medical-records/patients/[id]/encounters/[encounterId]');
  }
}

// DELETE /api/medical-records/patients/:id/encounters/:encounterId
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; encounterId: string }> }
) {
  try {
    const { doctorId, userId, role } = await requireDoctorAuth(request);
    const { id: patientId, encounterId } = await params;

    // Verify encounter belongs to doctor
    const encounter = await prisma.clinicalEncounter.findFirst({
      where: {
        id: encounterId,
        patientId,
        doctorId
      },
      include: {
        patient: { select: { firstName: true, lastName: true } }
      }
    });

    if (!encounter) {
      return NextResponse.json(
        { error: 'Encounter not found' },
        { status: 404 }
      );
    }

    // Un INFORME MÉDICO enviado a una aseguradora se construyó a partir de esta
    // consulta; borrarla dejaría el informe sin poder reconstruirse. La BD lo
    // impide (FK diferida, SQLSTATE 23503), pero ese error sale como un 400
    // genérico de "referencia inválida" — que dice lo contrario de la verdad:
    // el recurso relacionado SÍ existe, y justamente por eso bloquea.
    const informes = await prisma.medicalReport.count({ where: { encounterId } });
    if (informes > 0) {
      return NextResponse.json(
        {
          error: `No se puede eliminar esta consulta: tiene ${informes} informe(s) médico(s) que se generaron a partir de ella. Elimina primero los informes.`,
        },
        { status: 409 }
      );
    }

    // Delete encounter
    await prisma.clinicalEncounter.delete({
      where: { id: encounterId }
    });

    // Log audit
    await logAudit({
      patientId,
      doctorId,
      userId,
      userRole: role,
      action: 'delete_encounter',
      resourceType: 'encounter',
      resourceId: encounterId,
      request
    });

    // Log activity for dashboard
    logEncounterDeleted({
      doctorId,
      encounterId,
      patientName: `${encounter.patient.firstName} ${encounter.patient.lastName}`,
      userId,
    });

    return NextResponse.json({ data: { success: true } });
  } catch (error) {
    return handleApiError(error, 'DELETE /api/medical-records/patients/[id]/encounters/[encounterId]');
  }
}
