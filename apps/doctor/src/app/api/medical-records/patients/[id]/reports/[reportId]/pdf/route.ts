import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@healthcare/database';
import { requireDoctorAuth, logAudit } from '@/lib/medical-auth';
import { handleApiError } from '@/lib/api-error-handler';
import { dictParaRender, formatoDe, leerPdfBase } from '@/lib/informe-medico/formatos';
import { renderBorrador, renderFinal } from '@/lib/informe-medico/render-pdf';
import { leerAnswers } from '@/lib/informe-medico/types';

// GET /api/medical-records/patients/:id/reports/:reportId/pdf?tipo=borrador|final
//
// BORRADOR: dos capas de color, sólo lectura, con la barra roja. Para el médico.
// FINAL:    limpio y APLANADO. Es el que ve la aseguradora.
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; reportId: string }> }
) {
  try {
    const { doctorId, userId, role } = await requireDoctorAuth(request);
    const { id: patientId, reportId } = await params;
    const tipo = request.nextUrl.searchParams.get('tipo') === 'final' ? 'final' : 'borrador';

    const report = await prisma.medicalReport.findFirst({
      where: { id: reportId, patientId, doctorId },
      include: { form: true },
    });
    if (!report) return NextResponse.json({ error: 'Informe no encontrado' }, { status: 404 });

    const formato = formatoDe(report.form);
    if (!formato) {
      return NextResponse.json(
        { error: `Este build no sabe generar "${report.form.insurer} — ${report.form.name}" versión ${report.form.version}` },
        { status: 409 }
      );
    }

    // 🔴 El FINAL es el documento que sale hacia la aseguradora. No se genera sin
    // el consentimiento registrado (LFPDPPP: transferencia a un tercero). El
    // borrador sí, porque no sale del consultorio.
    if (tipo === 'final' && !report.consentGiven) {
      return NextResponse.json(
        { error: 'Falta registrar el consentimiento del paciente antes de generar el informe final.' },
        { status: 409 }
      );
    }

    const answers = leerAnswers(report.answers);
    const dict = dictParaRender(formato, report.form.fieldDict);
    const base = await leerPdfBase(formato);
    const r = tipo === 'final'
      ? await renderFinal(base, answers, dict)
      : await renderBorrador(base, answers, dict);

    await logAudit({
      patientId, doctorId, userId, userRole: role,
      action: 'EXPORT', resourceType: 'MedicalReport', resourceId: reportId,
      changes: { tipo, llenados: r.llenados, omitidos: r.omitidos.length }, request,
    });

    const nombre = `informe-${report.form.insurer.toLowerCase()}-${tipo}-${reportId.slice(0, 8)}.pdf`;
    return new NextResponse(Buffer.from(r.pdf), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${nombre}"`,
        // ⚠️ Un campo que no se pudo escribir NO se traga: viaja en la cabecera
        // para que la UI pueda decir exactamente qué falta (un `β` o un `≥` que
        // WinAnsi no codifica tumbaría el `save()` entero si no se omitiera).
        'X-Informe-Llenados': String(r.llenados),
        'X-Informe-Omitidos': String(r.omitidos.length),
        // PHI: que no quede en cachés intermedias.
        'Cache-Control': 'private, no-store',
      },
    });
  } catch (error) {
    return handleApiError(error, 'GET /api/medical-records/patients/:id/reports/:reportId/pdf');
  }
}
