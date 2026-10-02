import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@healthcare/database';
import { getAuthenticatedDoctor } from '@/lib/auth';
import { SALE_PATIENT_SELECT } from '@/lib/practice-utils';

// GET /api/practice-management/ventas/pacientes — the buyer picker of Nueva Venta / Editar Venta.
//
// VENTAS PACIENTE paso 3: the buyer is always a patient, but the patient list lives behind the
// `expedientes` toggle (/api/medical-records/patients). A helper with `ventas` and without
// `expedientes` could not sell to anyone. This route is under `practice-management/ventas` (toggle
// `ventas`) and returns ONLY what picking a buyer needs — name and internal id, no contact or
// clinical data — so the Ventas toggle doesn't become a back door into the expediente.
//
//   (none)         → the doctor's active patients, by name
//   ?include=a,b   → the same list PLUS those patients whatever their status (the archived patient of
//                    an existing sale or visita), in ONE query — so pickers never stitch two lists.
//
// Not paginated, like the expediente list Nueva Venta used before (a <select> of every active patient).
export async function GET(request: NextRequest) {
  try {
    const { doctor } = await getAuthenticatedDoctor(request);
    const includeParam = new URL(request.url).searchParams.get('include');
    const include = includeParam ? includeParam.split(',').map((s) => s.trim()).filter(Boolean).slice(0, 50) : [];

    const patients = await prisma.patient.findMany({
      where: {
        doctorId: doctor.id,
        OR: [{ status: 'active' }, ...(include.length ? [{ id: { in: include } }] : [])],
      },
      select: SALE_PATIENT_SELECT,
      orderBy: [{ firstName: 'asc' }, { lastName: 'asc' }],
    });
    return NextResponse.json({ data: patients });
  } catch (error: any) {
    console.error('Error al obtener pacientes para ventas:', error);
    if (error.message?.includes('Doctor') || error.message?.includes('access required')) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}
