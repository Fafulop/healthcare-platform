import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@healthcare/database';
import { requireDoctorAuth, logAudit } from '@/lib/medical-auth';
import { handleApiError } from '@/lib/api-error-handler';
import { catalogoDeFuentes, PRESUPUESTO_TOKENS_FUENTES } from '@/lib/informe-medico/contexto-clinico';

/**
 * GET /api/medical-records/patients/:id/fuentes
 *
 * Lo que el doctor puede elegir como FUENTE de un informe (07-PLAN §4):
 * consultas · notas · recetas emitidas o vencidas. Es también la lista de la que
 * se elige la consulta ANCLA.
 *
 * 🔴 El catálogo NO trae el contenido clínico completo: sólo el título, una
 * primera línea recortada para reconocerla, y lo que ocuparía en el prompt. Un
 * panel de casillas no necesita el expediente entero en el navegador.
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { doctorId, userId, role } = await requireDoctorAuth(request);
    const { id: patientId } = await params;

    // El paciente TIENE que ser de este doctor. `catalogoDeFuentes` ya acota
    // todas sus consultas por `doctorId`, pero sin esto un id ajeno devolvería
    // una lista vacía —"este paciente no tiene nada"— en vez de un 404, que es
    // afirmar algo falso sobre el expediente de otro médico.
    const paciente = await prisma.patient.findFirst({
      where: { id: patientId, doctorId },
      select: { id: true },
    });
    if (!paciente) return NextResponse.json({ error: 'Paciente no encontrado' }, { status: 404 });

    const fuentes = await catalogoDeFuentes(patientId, doctorId);

    await logAudit({
      patientId, doctorId, userId, userRole: role,
      action: 'VIEW', resourceType: 'MedicalReportSources', resourceId: patientId,
      changes: { total: fuentes.length }, request,
    });

    return NextResponse.json({ fuentes, presupuestoTokens: PRESUPUESTO_TOKENS_FUENTES });
  } catch (error) {
    return handleApiError(error, 'GET /api/medical-records/patients/:id/fuentes');
  }
}
