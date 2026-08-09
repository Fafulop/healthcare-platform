import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@healthcare/database';
import { requireDoctorAuth } from '@/lib/medical-auth';
import { handleApiError } from '@/lib/api-error-handler';
import { formatoDe, leerPdfBaseParaVisor } from '@/lib/informe-medico/formatos';

// GET /api/medical-records/insurance-forms/:formId/pdf
//
// La hoja EN BLANCO del formato, para que el visor la pinte de fondo.
// No lleva ningún dato del paciente: es el documento que la aseguradora publica.
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ formId: string }> }
) {
  try {
    await requireDoctorAuth(request);
    const { formId } = await params;

    const form = await prisma.insuranceForm.findUnique({ where: { id: formId } });
    if (!form) return NextResponse.json({ error: 'Formato no encontrado' }, { status: 404 });

    const formato = formatoDe(form);
    if (!formato) {
      return NextResponse.json(
        { error: `Este build no tiene el PDF de "${form.insurer} — ${form.name}" ${form.version}` },
        { status: 409 }
      );
    }

    // Con las casillas apagadas: si no, el lienzo del visor enseña las 9 marcas
    // de fábrica debajo de casillas HTML vacías.
    const base = await leerPdfBaseParaVisor(formato);
    return new NextResponse(Buffer.from(base), {
      headers: {
        'Content-Type': 'application/pdf',
        // La hoja en blanco es inmutable y la misma para todos: cachearla en el
        // navegador evita volver a bajar ~330KB en cada informe. `private`
        // porque la ruta exige sesión.
        'Cache-Control': 'private, max-age=86400',
      },
    });
  } catch (error) {
    return handleApiError(error, 'GET /api/medical-records/insurance-forms/:formId/pdf');
  }
}
