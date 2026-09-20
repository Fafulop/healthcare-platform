/**
 * «Quiero bajarme de plan» — TIERS 04 §12.6 #7 (versión corta).
 *
 * GET    devuelve la solicitud PENDIENTE del doctor (o null).
 * POST   crea una: guarda el veredicto de `cabeEnPlan()` y avisa al admin.
 * DELETE la cancela (sólo la suya, sólo si sigue pendiente).
 *
 * Esto NO baja el plan. Deja una fila que un humano atiende desde el admin. El
 * flujo completo —prorrateo, baja agendada a fin de periodo, webhook, «cancelar
 * el cambio»— es #7 y sigue sin construirse.
 *
 * - Vive bajo `/api/account/`, uno de los prefijos de `RUTAS_DE_CUENTA_CONGELADA`:
 *   una cuenta congelada también puede pedir bajarse, que es justo lo que querría.
 * - SÓLO el dueño: `account` es OWNER_ONLY en el route map, y aquí se revisa
 *   `isOwner` otra vez porque esto habla del dinero de la cuenta.
 * - SÓLO hacia ABAJO. Subir ya funciona solo y cobra de verdad (#3, #4); dejar
 *   pedir una subida por aquí sería ofrecer un camino peor al que ya existe.
 */

import { NextResponse } from 'next/server';
import {
  prisma,
  cabeEnPlan,
  DOCTOR_TIERS,
  TIER_LABELS,
  type DoctorTier,
} from '@healthcare/database';
import { getAuthenticatedDoctor } from '@/lib/auth';
import { avisarAdmin } from '@/lib/cobro-avisos';

const esTier = (v: unknown): v is DoctorTier =>
  typeof v === 'string' && (DOCTOR_TIERS as readonly string[]).includes(v);

/** `DOCTOR_TIERS` está ordenado por capacidad, así que el índice ES el orden. */
const posicion = (t: string) => (DOCTOR_TIERS as readonly string[]).indexOf(t);

function noAutorizado(error: unknown) {
  if ((error as { name?: string })?.name === 'AuthError') {
    const e = error as { message: string; status: number };
    return NextResponse.json({ error: e.message }, { status: e.status });
  }
  return null;
}

export async function GET(request: Request) {
  try {
    const { user, doctor } = await getAuthenticatedDoctor(request);
    if (!user.isOwner) return NextResponse.json({ solicitud: null });

    const solicitud = await prisma.solicitudCambioPlan.findFirst({
      where: { doctorId: doctor.id, estado: 'PENDIENTE' },
      orderBy: { creadoEn: 'desc' },
    });
    return NextResponse.json({ solicitud });
  } catch (error) {
    const auth = noAutorizado(error);
    if (auth) return auth;
    // NO se devuelve `{solicitud:null}` con 200: «no tienes ninguna» y «no se
    // pudo leer» se verían idénticos, la pantalla pintaría el formulario, el
    // doctor pediría otra vez y chocaría contra el índice con un 409 sobre una
    // solicitud que NO PUEDE VER NI CANCELAR. Un 500 deja que la pantalla
    // diga que no sabe.
    console.error('[CAMBIO-PLAN] no se pudo leer la solicitud', error);
    return NextResponse.json({ error: 'No se pudo leer tu solicitud' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const { user, doctor } = await getAuthenticatedDoctor(request);
    if (!user.isOwner) {
      return NextResponse.json(
        { error: 'Sólo el titular de la cuenta puede pedir un cambio de plan' },
        { status: 403 },
      );
    }

    const body = await request.json().catch(() => ({}));
    const destino = (body as { tier?: unknown }).tier;
    if (!esTier(destino)) {
      return NextResponse.json({ error: 'Plan no válido' }, { status: 400 });
    }

    // `user.tier` lo lee `validateAuthToken` FRESCO en cada request; el
    // `doctor` de `getAuthenticatedDoctor` no trae tier.
    const actual = user.tier;
    if (posicion(destino) >= posicion(actual)) {
      // No es un error del doctor: es que este camino no sirve para subir.
      return NextResponse.json(
        { error: 'Para cambiarte a un plan mayor puedes hacerlo tú mismo desde «Pago de tu plan».' },
        { status: 400 },
      );
    }

    // R4: sólo se baja si lo que YA usas cabe. No bloquea —el doctor que se
    // quiere ir no debe quedar atrapado— pero el motivo viaja con la solicitud
    // y el admin la ve marcada.
    const veredicto = await cabeEnPlan(prisma, doctor.id, destino);

    const solicitud = await prisma.solicitudCambioPlan.create({
      data: {
        doctorId: doctor.id,
        tierActual: actual,
        tierSolicitado: destino,
        cabe: veredicto.cabe,
        motivoNoCabe: veredicto.cabe ? null : veredicto.motivo.slice(0, 400),
        solicitadoPor: user.email ?? 'desconocido',
      },
    });

    // Hoy esto no sale a ningún lado: falta TELEGRAM_ADMIN_CHAT_ID y
    // `avisarAdmin()` se va sin mandar nada (deja el rastro en los logs). Se
    // llama igual para que el día que se ponga la variable empiece a funcionar
    // solo. La FILA es lo que no se pierde.
    await avisarAdmin(
      `📉 ${doctor.slug} pide bajar de ${TIER_LABELS[actual as DoctorTier] ?? actual} a ` +
        `${TIER_LABELS[destino]}${veredicto.cabe ? '' : ' — NO CABE: ' + veredicto.motivo}`,
    );

    return NextResponse.json({ solicitud }, { status: 201 });
  } catch (error) {
    const auth = noAutorizado(error);
    if (auth) return auth;
    // El índice parcial (una PENDIENTE por doctor) es quien gana la carrera de
    // los clics repetidos; que el segundo clic diga algo útil y no un 500.
    if ((error as { code?: string })?.code === 'P2002') {
      return NextResponse.json(
        { error: 'Ya tienes una solicitud pendiente.' },
        { status: 409 },
      );
    }
    console.error('[CAMBIO-PLAN] error', error);
    return NextResponse.json({ error: 'No se pudo enviar la solicitud' }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const { user, doctor } = await getAuthenticatedDoctor(request);
    if (!user.isOwner) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
    }

    // `updateMany` y no `update`: el `where` lleva el doctorId, así que nadie
    // puede cancelar la solicitud de otro ni con el id en la mano.
    const { count } = await prisma.solicitudCambioPlan.updateMany({
      where: { doctorId: doctor.id, estado: 'PENDIENTE' },
      data: { estado: 'CANCELADA', resueltaEn: new Date(), resueltaPor: user.email ?? 'doctor' },
    });

    return NextResponse.json({ cancelada: count > 0 });
  } catch (error) {
    return noAutorizado(error) ?? NextResponse.json({ error: 'No se pudo cancelar' }, { status: 500 });
  }
}
