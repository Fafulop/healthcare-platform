import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@healthcare/database';
import { requireDoctorAuth, logAudit } from '@/lib/medical-auth';
import { handleApiError } from '@/lib/api-error-handler';
import { renderToBuffer } from '@react-pdf/renderer';
import { PrescriptionPDF } from '@/lib/pdf/PrescriptionTemplate';

// GET /api/medical-records/patients/:id/prescriptions/:prescriptionId/pdf
// Generate and download prescription PDF
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; prescriptionId: string }> }
) {
  try {
    const { doctorId, userId, role } = await requireDoctorAuth(request);
    const { id: patientId, prescriptionId } = await params;

    // Verify patient belongs to doctor
    const patient = await prisma.patient.findFirst({
      where: { id: patientId, doctorId }
    });

    if (!patient) {
      return NextResponse.json(
        { error: 'Patient not found' },
        { status: 404 }
      );
    }

    // Fetch prescription with all data
    const prescription = await prisma.prescription.findFirst({
      where: {
        id: prescriptionId,
        patientId,
        doctorId
      },
      include: {
        patient: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            internalId: true,
            dateOfBirth: true,
            sex: true,
          }
        },
        medications: {
          orderBy: { order: 'asc' }
        },
        template: {
          select: { customFields: true }
        }
      }
    });

    if (!prescription) {
      return NextResponse.json(
        { error: 'Prescription not found' },
        { status: 404 }
      );
    }

    // Only generate PDF for issued prescriptions
    if (prescription.status !== 'issued') {
      return NextResponse.json(
        { error: 'Can only generate PDF for issued prescriptions' },
        { status: 400 }
      );
    }

    // Resolve template-based receta body: [label, value] pairs from the
    // template's field definitions (order + showInPdf + labelEs), falling back
    // to raw customData keys if the template is gone (FK is SET NULL).
    const customData = prescription.customData as Record<string, any> | null;
    let customContent: Array<{ label: string; value: string }> | undefined;
    if (customData && Object.keys(customData).length > 0) {
      const fields = (prescription.template?.customFields as any[] | null) || null;
      const formatValue = (v: any): string =>
        typeof v === 'boolean' ? (v ? 'Sí' : 'No') : Array.isArray(v) ? v.join(', ') : String(v);
      customContent = fields
        ? fields
            .slice()
            .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
            .filter((f) => f.showInPdf !== false)
            .filter((f) => {
              const v = customData[f.name];
              return v !== undefined && v !== null && v !== '';
            })
            .map((f) => ({
              label: f.labelEs || f.label || f.name,
              value: formatValue(customData[f.name]),
            }))
        : Object.entries(customData)
            .filter(([, v]) => v !== undefined && v !== null && v !== '')
            .map(([k, v]) => ({ label: k, value: formatValue(v) }));
    }

    // Validate prescription has content (medications, or custom template body)
    if (prescription.medications.length === 0 && (!customContent || customContent.length === 0)) {
      return NextResponse.json(
        { error: 'Cannot generate PDF for prescription without medications' },
        { status: 400 }
      );
    }

    // Get doctor/clinic info
    const doctor = await prisma.doctor.findUnique({
      where: { id: doctorId },
      select: {
        doctorFullName: true,
        clinicAddress: true,
        clinicPhone: true,
      }
    });

    if (!doctor) {
      return NextResponse.json(
        { error: 'Doctor not found' },
        { status: 404 }
      );
    }

    // Generate PDF
    const pdfBuffer = await renderToBuffer(
      <PrescriptionPDF
        prescription={{
          ...prescription,
          prescriptionDate: prescription.prescriptionDate.toISOString(),
          // Prisma Json → typed [{titulo, cedula}] (validated at creation)
          doctorCredentials: (prescription.doctorCredentials as { titulo: string; cedula: string }[] | null) ?? null,
          patient: {
            ...prescription.patient,
            dateOfBirth: prescription.patient.dateOfBirth.toISOString(),
          },
        }}
        clinicInfo={{
          name: doctor.doctorFullName,
          address: doctor.clinicAddress || undefined,
          phone: doctor.clinicPhone || undefined
        }}
        customContent={customContent}
      />
    );

    // Optional: Save PDF URL to prescription record
    // This would require implementing file storage (e.g., UploadThing)
    // For now, we just generate on-the-fly

    // Log audit
    await logAudit({
      patientId,
      doctorId,
      userId,
      userRole: role,
      action: 'generate_prescription_pdf',
      resourceType: 'prescription',
      resourceId: prescriptionId,
      request
    });

    // Return PDF
    return new NextResponse(new Uint8Array(pdfBuffer), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="prescription-${prescriptionId}.pdf"`
      }
    });
  } catch (error) {
    return handleApiError(error, 'GET /api/medical-records/patients/[id]/prescriptions/[prescriptionId]/pdf');
  }
}
