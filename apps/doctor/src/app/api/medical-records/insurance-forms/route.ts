import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@healthcare/database';
import { requireDoctorAuth } from '@/lib/medical-auth';
import { handleApiError } from '@/lib/api-error-handler';
import { formatoDe } from '@/lib/informe-medico/formatos';

// GET /api/medical-records/insurance-forms
// Los formatos que el doctor puede elegir en el dropdown del informe.
export async function GET(request: NextRequest) {
  try {
    await requireDoctorAuth(request);

    const filas = await prisma.insuranceForm.findMany({
      where: { isActive: true },
      orderBy: [{ insurer: 'asc' }, { name: 'asc' }],
      select: { id: true, insurer: true, name: true, version: true, fieldsAddedByUs: true },
    });

    // 🔴 Un formato que la BD conoce pero que ESTE build no sabe generar (una
    // versión nueva dada de alta antes de que su diccionario llegue al repo) NO
    // se ofrece: elegirlo daría un PDF vacío que se ve exitoso.
    const disponibles = filas.filter((f) => formatoDe(f) !== undefined);

    return NextResponse.json({
      forms: disponibles,
      // Se reporta aparte en vez de callarlo: si el dropdown sale corto, esto
      // dice por qué.
      sinDiccionarioEnEsteBuild: filas.length - disponibles.length,
    });
  } catch (error) {
    return handleApiError(error, 'GET /api/medical-records/insurance-forms');
  }
}
