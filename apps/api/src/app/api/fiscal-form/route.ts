// GET  /api/fiscal-form?token={token} — Public. Validate token, return patient + doctor context.
// POST /api/fiscal-form               — Public. Submit fiscal data (JSON or FormData with constancia).
// No authentication required — called by patients from apps/public.

import { NextResponse } from 'next/server';
import { prisma } from '@healthcare/database';
import { UTApi } from 'uploadthing/server';

const FISCAL_TEMPLATE_ID = 'FISCAL';

// SAT catalogs (offline, same as facturacion fallbacks)
const REGIMENES_FISCALES = [
  { Value: '601', Name: 'General de Ley Personas Morales' },
  { Value: '603', Name: 'Personas Morales con Fines no Lucrativos' },
  { Value: '605', Name: 'Sueldos y Salarios e Ingresos Asimilados a Salarios' },
  { Value: '606', Name: 'Arrendamiento' },
  { Value: '608', Name: 'Demás ingresos' },
  { Value: '612', Name: 'Personas Físicas con Actividades Empresariales y Profesionales' },
  { Value: '616', Name: 'Sin obligaciones fiscales' },
  { Value: '621', Name: 'Incorporación Fiscal' },
  { Value: '625', Name: 'Régimen de las Actividades Empresariales con ingresos a través de Plataformas Tecnológicas' },
  { Value: '626', Name: 'Régimen Simplificado de Confianza' },
];

const USOS_CFDI = [
  { Value: 'D01', Name: 'Honorarios médicos, dentales y gastos hospitalarios' },
  { Value: 'D02', Name: 'Gastos médicos por incapacidad o discapacidad' },
  { Value: 'G03', Name: 'Gastos en general' },
  { Value: 'S01', Name: 'Sin efectos fiscales' },
];

// SAT compatibility: which uso CFDI values are valid for each régimen fiscal
// Source: Anexo 20 del SAT — Catálogo de UsoCFDI por RegimenFiscalReceptor
const REGIMEN_USO_CFDI_VALID: Record<string, string[]> = {
  '601': ['G03', 'S01'],           // General de Ley PM
  '603': ['G03', 'S01'],           // PM sin Fines Lucrativos
  '605': ['D01', 'D02', 'S01'],    // Sueldos y Salarios
  '606': ['D01', 'D02', 'G03', 'S01'], // Arrendamiento
  '608': ['D01', 'D02', 'G03', 'S01'], // Demás ingresos
  '612': ['D01', 'D02', 'G03', 'S01'], // Actividades Empresariales y Profesionales
  '616': ['S01'],                  // Sin obligaciones fiscales
  '621': ['D01', 'D02', 'G03', 'S01'], // Incorporación Fiscal
  '625': ['D01', 'D02', 'G03', 'S01'], // Plataformas Tecnológicas
  '626': ['G03', 'S01'],           // RESICO
};

// GET — Validate token and return context for the fiscal form
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const token = searchParams.get('token');

    if (!token) {
      return NextResponse.json(
        { success: false, error: 'Se requiere el token' },
        { status: 400 }
      );
    }

    const formLink = await prisma.appointmentFormLink.findUnique({
      where: { token },
      include: {
        doctor: {
          select: {
            doctorFullName: true,
            primarySpecialty: true,
          },
        },
        patient: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            rfc: true,
            razonSocial: true,
            regimenFiscal: true,
            usoCfdi: true,
            codigoPostalFiscal: true,
            requiereFactura: true,
          },
        },
      },
    });

    if (!formLink) {
      return NextResponse.json(
        { success: false, error: 'Este enlace no es válido' },
        { status: 404 }
      );
    }

    if (formLink.templateId !== FISCAL_TEMPLATE_ID) {
      return NextResponse.json(
        { success: false, error: 'Este enlace no corresponde a un formulario fiscal' },
        { status: 400 }
      );
    }

    if (formLink.status === 'SUBMITTED') {
      return NextResponse.json(
        { success: false, error: 'Este formulario ya fue enviado', alreadySubmitted: true },
        { status: 410 }
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        patientName: formLink.patientName,
        doctorName: formLink.doctor.doctorFullName,
        doctorSpecialty: formLink.doctor.primarySpecialty,
        // Pre-fill with existing fiscal data if patient already has it
        existingFiscalData: formLink.patient ? {
          rfc: formLink.patient.rfc,
          razonSocial: formLink.patient.razonSocial,
          regimenFiscal: formLink.patient.regimenFiscal,
          usoCfdi: formLink.patient.usoCfdi,
          codigoPostalFiscal: formLink.patient.codigoPostalFiscal,
        } : null,
        catalogos: {
          regimenesFiscales: REGIMENES_FISCALES,
          usosCfdi: USOS_CFDI,
          regimenUsoCfdiValid: REGIMEN_USO_CFDI_VALID,
        },
      },
    });
  } catch (error) {
    console.error('Error validating fiscal form token:', error);
    return NextResponse.json(
      { success: false, error: 'Error al validar el enlace' },
      { status: 500 }
    );
  }
}

// POST — Submit fiscal data
export async function POST(request: Request) {
  try {
    const contentType = request.headers.get('content-type') || '';
    let token: string | null = null;
    let fiscalData: Record<string, string> = {};
    let constanciaFile: File | null = null;

    if (contentType.includes('multipart/form-data')) {
      const formData = await request.formData();
      token = formData.get('token') as string;
      const dataStr = formData.get('data') as string;
      fiscalData = dataStr ? JSON.parse(dataStr) : {};
      constanciaFile = formData.get('constancia') as File | null;
    } else {
      const body = await request.json();
      token = body.token;
      fiscalData = body.data || {};
    }

    if (!token) {
      return NextResponse.json(
        { success: false, error: 'Se requiere el token' },
        { status: 400 }
      );
    }

    // Validate required fiscal fields (trim all inputs)
    const rfc = fiscalData.rfc?.trim() || '';
    const razonSocial = fiscalData.razonSocial?.trim() || '';
    const regimenFiscal = fiscalData.regimenFiscal?.trim() || '';
    const usoCfdi = fiscalData.usoCfdi?.trim() || '';
    const codigoPostalFiscal = fiscalData.codigoPostalFiscal?.trim() || '';
    if (!rfc || !razonSocial || !regimenFiscal || !usoCfdi || !codigoPostalFiscal) {
      return NextResponse.json(
        { success: false, error: 'Todos los campos fiscales son obligatorios' },
        { status: 400 }
      );
    }

    // Basic RFC format validation (12-13 chars, alphanumeric)
    const rfcClean = rfc.toUpperCase();
    if (!/^[A-ZÑ&]{3,4}\d{6}[A-Z0-9]{3}$/.test(rfcClean)) {
      return NextResponse.json(
        { success: false, error: 'El formato del RFC no es válido' },
        { status: 400 }
      );
    }

    // SAT compatibility: validate uso CFDI is valid for the selected régimen fiscal
    const validUsos = REGIMEN_USO_CFDI_VALID[regimenFiscal];
    if (validUsos && !validUsos.includes(usoCfdi)) {
      return NextResponse.json(
        { success: false, error: `El uso de CFDI "${usoCfdi}" no es válido para el régimen fiscal "${regimenFiscal}". Opciones válidas: ${validUsos.join(', ')}` },
        { status: 400 }
      );
    }

    const formLink = await prisma.appointmentFormLink.findUnique({
      where: { token },
      include: {
        doctor: { select: { telegramChatId: true, telegramNotifyForm: true } },
      },
    });

    if (!formLink) {
      return NextResponse.json(
        { success: false, error: 'Este enlace no es válido' },
        { status: 404 }
      );
    }

    if (formLink.templateId !== FISCAL_TEMPLATE_ID) {
      return NextResponse.json(
        { success: false, error: 'Este enlace no corresponde a un formulario fiscal' },
        { status: 400 }
      );
    }

    if (formLink.status === 'SUBMITTED') {
      return NextResponse.json(
        { success: false, error: 'Este formulario ya fue enviado', alreadySubmitted: true },
        { status: 410 }
      );
    }

    if (!formLink.patientId) {
      return NextResponse.json(
        { success: false, error: 'Este formulario no está vinculado a un paciente' },
        { status: 400 }
      );
    }

    // Upload constancia if provided
    let constanciaUrl: string | null = null;
    let constanciaName: string | null = null;
    if (constanciaFile && constanciaFile.size > 0) {
      // Server-side file size validation (16 MB max)
      if (constanciaFile.size > 16 * 1024 * 1024) {
        return NextResponse.json(
          { success: false, error: 'El archivo no puede ser mayor a 16 MB' },
          { status: 400 }
        );
      }
      try {
        const utapi = new UTApi();
        const response = await utapi.uploadFiles(constanciaFile);
        if (response.data) {
          constanciaUrl = response.data.url;
          constanciaName = constanciaFile.name;
        }
      } catch (uploadErr) {
        console.error('Error uploading constancia fiscal:', uploadErr);
        // Non-blocking: continue without the file
      }
    }

    // Update Patient fiscal fields + mark form as submitted (transaction)
    await prisma.$transaction([
      prisma.patient.update({
        where: { id: formLink.patientId },
        data: {
          requiereFactura: true,
          rfc: rfcClean,
          razonSocial,
          regimenFiscal,
          usoCfdi,
          codigoPostalFiscal,
          ...(constanciaUrl ? {
            constanciaFiscalUrl: constanciaUrl,
            constanciaFiscalName: constanciaName,
          } : {}),
        },
      }),
      prisma.appointmentFormLink.update({
        where: { id: formLink.id },
        data: {
          status: 'SUBMITTED',
          submissionData: {
            rfc: rfcClean,
            razonSocial,
            regimenFiscal,
            usoCfdi,
            codigoPostalFiscal,
            constanciaUrl: constanciaUrl,
            constanciaName: constanciaName,
          },
          submittedAt: new Date(),
        },
      }),
    ]);

    return NextResponse.json(
      { success: true, message: '¡Datos fiscales guardados exitosamente!' },
      { status: 201 }
    );
  } catch (error) {
    console.error('Error submitting fiscal form:', error);
    return NextResponse.json(
      { success: false, error: 'Error al guardar los datos fiscales' },
      { status: 500 }
    );
  }
}
