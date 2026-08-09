import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@healthcare/database';
import { requireDoctorAuth } from '@/lib/medical-auth';
import { handleApiError } from '@/lib/api-error-handler';
import { dictParaRender, formatoDe, leerPdfBase } from '@/lib/informe-medico/formatos';
import { geometriaDelFormato } from '@/lib/informe-medico/geometria-formato';
import { etiquetaCanonica } from '@/lib/informe-medico/canonical';

// GET /api/medical-records/insurance-forms/:formId/geometria
//
// Dónde cae cada campo del diccionario sobre la hoja: con esto el visor pone un
// input encima de cada blanco del formato real.
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
        { error: `Este build no sabe generar "${form.insurer} — ${form.name}" ${form.version}` },
        { status: 409 }
      );
    }

    const dict = dictParaRender(formato, form.fieldDict);
    const geo = await geometriaDelFormato(await leerPdfBase(formato), dict);

    return NextResponse.json({
      paginas: geo.paginas,
      cajas: geo.cajas.map((c) => ({ ...c, etiqueta: etiquetaCanonica(c.clave) })),
      // Se devuelve, no se calla: un campo del diccionario que no se pudo ubicar
      // es un blanco que el visor NO va a dibujar, y la hoja se vería completa.
      sinUbicar: geo.sinUbicar,
    });
  } catch (error) {
    return handleApiError(error, 'GET /api/medical-records/insurance-forms/:formId/geometria');
  }
}
