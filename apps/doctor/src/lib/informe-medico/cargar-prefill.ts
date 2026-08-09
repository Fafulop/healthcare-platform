/**
 * INFORME MÉDICO — junta del expediente lo que el pre-llenado necesita.
 *
 * Es la ÚNICA capa que toca Prisma. `prefill.ts` sigue siendo una función pura
 * sobre datos planos, que es lo que permite verificarlo campo por campo sin
 * base de datos.
 */
import { prisma } from '@healthcare/database';
import { construirPrefillDeterminista, type ResultadoPrefill } from './prefill';

/** Lo que el llamador pidió no existe, o no es suyo. */
export class DatosDelInformeNoEncontrados extends Error {}

/**
 * Arma el pre-llenado de un informe.
 *
 * 🔴 Todo se lee acotado por `doctorId`. La FK compuesta de prod impide guardar
 * un informe con el paciente de otro doctor, pero la consulta también tiene que
 * negarse a LEERLO: una hoja generada es PHI aunque nunca se guarde.
 */
export async function cargarPrefill(params: {
  doctorId: string;
  patientId: string;
  encounterId: string;
}): Promise<ResultadoPrefill> {
  const { doctorId, patientId, encounterId } = params;

  const [paciente, consulta, medico] = await Promise.all([
    prisma.patient.findFirst({ where: { id: patientId, doctorId } }),
    prisma.clinicalEncounter.findFirst({ where: { id: encounterId, patientId, doctorId } }),
    prisma.doctor.findUnique({
      where: { id: doctorId },
      include: { user: { select: { email: true } } },
    }),
  ]);

  if (!paciente) throw new DatosDelInformeNoEncontrados('Paciente no encontrado');
  if (!consulta) throw new DatosDelInformeNoEncontrados('Consulta no encontrada');
  if (!medico) throw new DatosDelInformeNoEncontrados('Médico no encontrado');

  // Los medicamentos de las recetas de ESA consulta: alimentan la tabla de 10
  // renglones de AXA.
  //
  // 🔴 Sólo las que de verdad se le dieron al paciente. `status` es
  // `draft | issued | cancelled | expired` y el DEFAULT es `draft`: una receta
  // que el doctor empezó y nunca entregó se declararía a la aseguradora como el
  // tratamiento del paciente. `expired` sí entra — se emitió y fue el
  // tratamiento; que hoy esté vencida no lo borra de la historia.
  const recetas = await prisma.prescription.findMany({
    where: { encounterId, patientId, doctorId, status: { in: ['issued', 'expired'] } },
    orderBy: { prescriptionDate: 'asc' },
    include: { medications: { orderBy: { order: 'asc' } } },
  });

  return construirPrefillDeterminista({
    paciente,
    consulta,
    medico: { ...medico, email: medico.user?.email ?? null },
    medicamentos: recetas.flatMap((r) => r.medications),
  });
}
