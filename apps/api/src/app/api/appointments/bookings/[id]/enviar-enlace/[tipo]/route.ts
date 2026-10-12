// POST /api/appointments/bookings/[id]/enviar-enlace/[tipo]   (tipo: formulario | pago | fiscal)
//
// N11/N13 (2026-10-12) — «Formulario», «Link de pago» y «Datos fiscales» funcionan como «Confirmación
// cita»: un clic y el correo le sale al paciente desde el Gmail del doctor. El cliente crea el enlace
// (con las rutas de siempre) y luego llama aquí SÓLO con el tipo: el ENLACE lo busca el servidor — el
// vivo de ESTA cita (o, el fiscal, el pendiente de su paciente) —, así esta ruta no puede mandar por
// correo cualquier URL que le llegue.
//
// Permisos: `appointments` = citas; `…/enviar-enlace/pago` = pagos (route-permissions), como crear el link.

import { NextResponse } from 'next/server';
import { prisma } from '@healthcare/database';
import { AuthError, getAuthenticatedDoctor } from '@/lib/auth';
import { resolveTokens } from '@/lib/google-calendar';
import { sendEnlaceEmail, type TipoEnlace } from '@/lib/gmail';

const TIPOS: TipoEnlace[] = ['formulario', 'pago', 'fiscal'];
const BASE = () => process.env.NEXT_PUBLIC_BASE_URL || 'https://tusalud.pro';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string; tipo: string }> }
) {
  let doctor: Awaited<ReturnType<typeof getAuthenticatedDoctor>>['doctor'];
  try {
    ({ doctor } = await getAuthenticatedDoctor(request));
  } catch (err) {
    // El código REAL: un 403 (sin permiso de Pagos / Facturación, o el plan) no es «sesión vencida» —
    // con 401 el cliente manda a /login y sacaba al ayudante de la sesión (code review N11).
    const status = err instanceof AuthError ? err.status : 401;
    return NextResponse.json(
      { success: false, error: status === 403 ? 'No tienes permiso para mandar esto.' : 'No autorizado' },
      { status },
    );
  }

  try {
    const { id: bookingId, tipo: tipoCrudo } = await params;
    const tipo = tipoCrudo as TipoEnlace;
    if (!TIPOS.includes(tipo)) {
      return NextResponse.json({ success: false, error: 'Tipo de enlace inválido' }, { status: 400 });
    }

    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
      select: {
        id: true, doctorId: true, patientId: true, patientName: true, patientEmail: true, date: true,
        patient: { select: { email: true } },
        slot: { select: { date: true } },
        doctor: {
          select: {
            doctorFullName: true,
            user: { select: { id: true, email: true, googleAccessToken: true, googleRefreshToken: true, googleTokenExpiry: true } },
          },
        },
      },
    });
    if (!booking) {
      return NextResponse.json({ success: false, error: 'Cita no encontrada' }, { status: 404 });
    }
    if (booking.doctorId !== doctor.id) {
      return NextResponse.json({ success: false, error: 'No tienes permiso para esta cita' }, { status: 403 });
    }

    // Mismo destinatario que la confirmación (send-email): el EXPEDIENTE manda, la copia de la cita respalda.
    const destinatario = booking.patient?.email?.trim() || booking.patientEmail?.trim() || '';
    if (!destinatario) {
      return NextResponse.json({ success: false, error: 'El paciente no tiene correo registrado' }, { status: 400 });
    }

    // El enlace VIVO, buscado aquí.
    let url: string | null = null;
    let monto: number | null = null;
    if (tipo === 'formulario') {
      const fl = await prisma.appointmentFormLink.findFirst({
        where: { bookingId, doctorId: booking.doctorId, templateId: { not: 'FISCAL' }, status: 'PENDING' },
        select: { token: true },
      });
      // Misma regla que la página pública (appointment-form): vence si la fecha de la cita ya pasó.
      const dia = (booking.slot?.date ?? booking.date)?.toISOString().slice(0, 10);
      const hoy = new Date().toLocaleString('sv-SE', { timeZone: 'America/Mexico_City' }).slice(0, 10);
      if (fl && dia && dia < hoy) {
        return NextResponse.json(
          { success: false, error: 'El enlace del formulario ya expiró (la fecha de la cita ya pasó).' },
          { status: 409 }
        );
      }
      if (fl) url = `${BASE()}/formulario-cita/${fl.token}`;
    } else if (tipo === 'fiscal') {
      if (booking.patientId) {
        const fl = await prisma.appointmentFormLink.findFirst({
          where: { doctorId: booking.doctorId, patientId: booking.patientId, templateId: 'FISCAL', status: 'PENDING' },
          orderBy: { createdAt: 'desc' },
          select: { token: true },
        });
        if (fl) url = `${BASE()}/formulario-fiscal/${fl.token}`;
      }
    } else {
      const [stripe, mp] = await Promise.all([
        // Vivos = PENDING y EXPIRED (EXPIRED: venció una ficha OXXO, el link sigue cobrando) — los mismos
        // que `STATUS_VIVOS` de desactivar-link y que la tarjeta trata como «link activo».
        prisma.paymentLink.findFirst({
          where: { bookingId, doctorId: booking.doctorId, isActive: true, status: { in: ['PENDING', 'EXPIRED'] } },
          select: { stripePaymentLinkUrl: true, amount: true },
        }),
        prisma.mpPaymentPreference.findFirst({
          where: { bookingId, doctorId: booking.doctorId, isActive: true, status: { in: ['PENDING', 'EXPIRED'] } },
          select: { mpInitPoint: true, amount: true },
        }),
      ]);
      if (stripe) { url = stripe.stripePaymentLinkUrl; monto = Number(stripe.amount); }
      else if (mp) { url = mp.mpInitPoint; monto = Number(mp.amount); }
    }
    if (!url) {
      return NextResponse.json(
        { success: false, error: 'No hay un enlace activo que enviar: créalo primero desde la cita.' },
        { status: 409 }
      );
    }

    // Tokens de Google (mismo manejo que send-email).
    const doctorUser = booking.doctor.user;
    if (!doctorUser?.googleAccessToken) {
      return NextResponse.json(
        { success: false, error: 'Necesitas conectar tu cuenta de Google para enviar correos. Cierra sesión e inicia sesión de nuevo.', code: 'NO_GOOGLE_TOKEN' },
        { status: 422 }
      );
    }
    let accessToken: string;
    let refreshToken: string | null;
    try {
      const resolved = await resolveTokens(doctorUser);
      accessToken = resolved.accessToken;
      refreshToken = resolved.refreshToken;
      if (resolved.updatedToken) {
        await prisma.user.update({
          where: { id: doctorUser.id },
          data: { googleAccessToken: resolved.updatedToken.accessToken, googleTokenExpiry: resolved.updatedToken.expiresAt },
        });
      }
    } catch {
      return NextResponse.json(
        { success: false, error: 'Tu sesión de Google expiró. Cierra sesión e inicia sesión de nuevo para renovar los permisos.', code: 'TOKEN_EXPIRED' },
        { status: 422 }
      );
    }

    // La fecha de la cita es @db.Date: se lee en UTC (en local saldría un día antes).
    const fecha = booking.slot?.date ?? booking.date ?? null;
    const fechaCita = fecha && tipo !== 'fiscal'
      ? fecha.toLocaleDateString('es-MX', { timeZone: 'UTC', weekday: 'long', day: 'numeric', month: 'long' })
      : null;
    const doctorName = booking.doctor.doctorFullName ?? doctor.doctorFullName;

    try {
      await sendEnlaceEmail(
        { tipo, patientName: booking.patientName, patientEmail: destinatario, doctorName, url, fechaCita, monto },
        accessToken, refreshToken, doctorName, doctorUser.email!,
      );
    } catch (gmailError: any) {
      const status = gmailError?.status ?? gmailError?.code;
      if (status === 403 || status === 401) {
        return NextResponse.json(
          { success: false, error: 'Tu cuenta de Google no tiene permisos para enviar correos. Cierra sesión e inicia sesión de nuevo para otorgar el permiso.', code: 'GMAIL_SCOPE_MISSING' },
          { status: 422 }
        );
      }
      throw gmailError;
    }

    const que = tipo === 'formulario' ? 'el formulario' : tipo === 'pago' ? 'el link de pago' : 'el formulario de datos fiscales';
    return NextResponse.json({ success: true, message: `Se envió ${que} a ${destinatario}` });
  } catch (error) {
    console.error('[enviar-enlace] error:', error);
    return NextResponse.json({ success: false, error: 'No se pudo enviar el correo' }, { status: 500 });
  }
}
