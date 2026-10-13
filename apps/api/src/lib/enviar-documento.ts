// POST /api/enviar-documento/receta/[id] y /api/enviar-documento/venta/[id]   body: { pdfBase64, nombreArchivo }
// (dos rutas fijas —no `[tipo]`— para que cada una tenga SU permiso en route-permissions; ésta es la lógica común)
//
// 2026-10-12 (pedido del usuario) — mandar la RECETA o la NOTA DE VENTA por correo desde la visita, con el
// PDF ADJUNTO, desde el Gmail del doctor (como la confirmación). El PDF lo dibuja el navegador: es el mismo
// que el doctor ve en la vista previa y descarga. El DESTINATARIO lo decide el servidor: el correo del
// expediente del paciente dueño de esa receta / venta (nunca una dirección que mande el cliente).
// Receta: sólo EMITIDA. Permisos (route-permissions): las tres (receta, venta, cita) → OWNER_ONLY (el PDF lo arma el navegador y sale
// del Gmail del titular con su nombre: un ayudante no manda nada como «Tu receta»).
//
// 2026-10-12 — y …/cita/[id]: la «Nota de venta» de una CITA (la que se genera al vuelo de su cobro, GET
// /api/appointments/bookings/:id/nota). Mismas reglas que esa nota (cobro propio, no una sesión cubierta por
// su paquete); destinatario: el correo del expediente, o —cita sin expediente— el de la cita (el de las
// confirmaciones). Sin expediente no hay bitácora del paciente donde anotarlo: queda en el log del servidor.

import { createHash } from 'crypto';
import { NextResponse } from 'next/server';
import { prisma } from '@healthcare/database';
import { AuthError, getAuthenticatedDoctor } from '@/lib/auth';
import { resolveTokens } from '@/lib/google-calendar';
import { sendDocumentoEmail, type TipoDocumento } from '@/lib/gmail';

// Un PDF de receta / nota pesa decenas de KB (con logo y firma, cientos). Gmail (`messages.send` con `raw`)
// acepta ~5 MB por mensaje y el base64url crece ~1.33×: tope de 3.5 MB de base64 (code review).
const MAX_BASE64 = 3.5 * 1024 * 1024;
// Un correo sin saltos de línea ni comas (una dirección, nada que se cuele como otro encabezado).
const CORREO_VALIDO = /^[^\s@,;<>]+@[^\s@,;<>]+\.[^\s@,;<>]+$/;
// Los marcadores de AuthError (cuenta congelada, plan, permiso) dichos en español — no el código crudo.
const MOTIVO_403: Record<string, string> = {
  ACCOUNT_FROZEN: 'tu cuenta está congelada (revisa «Mi Cuenta»).',
  TIER_EXCLUDED: 'tu plan no incluye esta función.',
  PERMISSION_BLOCKED: 'no tienes permiso para esto.',
};

/** Qué se manda: la receta, la nota de una venta o la nota del cobro de una cita (correo = el de nota de venta). */
export type TipoEnvio = TipoDocumento | 'cita';

export function postEnviarDocumento(tipoFijo: TipoEnvio) {
  return async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  let doctor: Awaited<ReturnType<typeof getAuthenticatedDoctor>>['doctor'];
  let quien: Awaited<ReturnType<typeof getAuthenticatedDoctor>>['user'];
  try {
    ({ doctor, user: quien } = await getAuthenticatedDoctor(request));
  } catch (err) {
    // El código y el mensaje REALES (sin permiso, plan, cuenta congelada) — no uno genérico.
    const status = err instanceof AuthError ? err.status : 401;
    const codigo = err instanceof Error ? err.message : '';
    const motivo = MOTIVO_403[codigo] ?? 'esta cuenta no puede mandar documentos.';
    return NextResponse.json({ success: false, error: status === 403 ? `No se puede mandar: ${motivo}` : 'No autorizado', code: codigo || undefined }, { status });
  }

  try {
    const { id } = await params;
    const tipo = tipoFijo;
    // Antes de leer el cuerpo: uno gigante se rechaza sin cargarlo en memoria.
    if (Number(request.headers.get('content-length') || 0) > MAX_BASE64 + 64 * 1024) {
      return NextResponse.json({ success: false, error: 'El PDF es demasiado grande para mandarlo por correo (revisa el tamaño del logo y la firma en «Receta PDF»).' }, { status: 413 });
    }
    const body = await request.json().catch(() => null);
    const pdfBase64 = typeof body?.pdfBase64 === 'string' ? body.pdfBase64.replace(/^data:application\/pdf;[^,]*,/, '') : '';
    // Sin caracteres de control y corto (va en un encabezado del correo).
    const nombreLimpio = typeof body?.nombreArchivo === 'string' ? body.nombreArchivo.replace(/[\x00-\x1f\x7f]/g, '').trim().slice(0, 120) : '';
    const nombreArchivo = nombreLimpio || `${tipo}.pdf`;
    if (pdfBase64.length > MAX_BASE64) {
      return NextResponse.json({ success: false, error: 'El PDF es demasiado grande para mandarlo por correo (revisa el tamaño del logo y la firma en «Receta PDF»).' }, { status: 413 });
    }
    if (!pdfBase64 || !/^[A-Za-z0-9+/=\s]+$/.test(pdfBase64)) {
      return NextResponse.json({ success: false, error: 'El PDF no es válido' }, { status: 400 });
    }
    // Que de verdad sea un PDF (sus primeros bytes: «%PDF»).
    if (!Buffer.from(pdfBase64.slice(0, 16), 'base64').toString('latin1').startsWith('%PDF')) {
      return NextResponse.json({ success: false, error: 'El archivo no es un PDF' }, { status: 400 });
    }

    // El paciente dueño del documento — y que el documento sea de ESTE doctor.
    let patientId: string | null = null;
    // Cita sin expediente: su propio correo y nombre (los de la confirmación).
    let correoDeLaCita: string | null = null;
    let nombreDeLaCita = '';
    if (tipo === 'cita') {
      const cita = await prisma.booking.findFirst({
        where: { id, doctorId: doctor.id },
        select: {
          patientId: true, patientEmail: true, patientName: true,
          ledgerEntry: { select: { amount: true, tratamientoId: true, doctorId: true } },
        },
      });
      if (!cita) return NextResponse.json({ success: false, error: 'Cita no encontrada' }, { status: 404 });
      // Las mismas reglas que la nota misma (bookings/[id]/nota): sin cobro, o cubierta por su paquete, no hay nota.
      const cobro = cita.ledgerEntry && cita.ledgerEntry.doctorId === doctor.id ? cita.ledgerEntry : null;
      if (!cobro) return NextResponse.json({ success: false, error: 'Esta cita no tiene cobro registrado' }, { status: 409 });
      if (cobro.tratamientoId && Number(cobro.amount) <= 0) {
        return NextResponse.json({ success: false, error: 'Sesión cubierta por el paquete de su tratamiento: no tiene cobro que documentar' }, { status: 409 });
      }
      patientId = cita.patientId;
      correoDeLaCita = cita.patientEmail;
      nombreDeLaCita = cita.patientName;
    } else if (tipo === 'receta') {
      const rx = await prisma.prescription.findFirst({ where: { id, doctorId: doctor.id }, select: { patientId: true, status: true } });
      if (!rx) return NextResponse.json({ success: false, error: 'Receta no encontrada' }, { status: 404 });
      if (rx.status !== 'issued') {
        return NextResponse.json({ success: false, error: 'Sólo se manda una receta emitida.' }, { status: 409 });
      }
      patientId = rx.patientId;
    } else {
      const ventaId = Number(id);
      if (!Number.isInteger(ventaId)) return NextResponse.json({ success: false, error: 'Venta no encontrada' }, { status: 404 });
      const venta = await prisma.sale.findFirst({ where: { id: ventaId, doctorId: doctor.id }, select: { patientId: true, status: true } });
      if (!venta) return NextResponse.json({ success: false, error: 'Venta no encontrada' }, { status: 404 });
      if (venta.status === 'CANCELLED') {
        return NextResponse.json({ success: false, error: 'La venta está cancelada.' }, { status: 409 });
      }
      patientId = venta.patientId;
    }
    if (!patientId && tipo !== 'cita') {
      return NextResponse.json({ success: false, error: 'Este documento no está ligado a un paciente.' }, { status: 409 });
    }
    const paciente = patientId
      ? await prisma.patient.findFirst({ where: { id: patientId, doctorId: doctor.id }, select: { firstName: true, lastName: true, email: true } })
      : null;
    if (patientId && !paciente) {
      return NextResponse.json({ success: false, error: 'Paciente no encontrado' }, { status: 404 });
    }
    const destinatario = (paciente ? paciente.email : correoDeLaCita)?.trim() || '';
    if (!destinatario) {
      return NextResponse.json({ success: false, error: paciente ? 'El paciente no tiene correo en su expediente.' : 'La cita no tiene correo del paciente.' }, { status: 400 });
    }
    const nombrePaciente = paciente ? `${paciente.firstName} ${paciente.lastName ?? ''}`.trim() : nombreDeLaCita;
    if (!CORREO_VALIDO.test(destinatario)) {
      return NextResponse.json({ success: false, error: paciente
        ? `El correo del expediente no es válido («${destinatario.slice(0, 80)}»): corrígelo en su expediente.`
        : `El correo de la cita no es válido («${destinatario.slice(0, 80)}»).` }, { status: 400 });
    }

    // Tokens de Google (mismo manejo que send-email / enviar-enlace).
    // El usuario de Google del doctor por `doctor.user` (como send-email), no por el `doctorId` heredado.
    const usuario = (await prisma.doctor.findUnique({
      where: { id: doctor.id },
      select: { user: { select: { id: true, email: true, googleAccessToken: true, googleRefreshToken: true, googleTokenExpiry: true } } },
    }))?.user ?? null;
    if (!usuario?.googleAccessToken) {
      return NextResponse.json(
        { success: false, error: 'Necesitas conectar tu cuenta de Google para enviar correos. Cierra sesión e inicia sesión de nuevo.', code: 'NO_GOOGLE_TOKEN' },
        { status: 422 },
      );
    }
    let accessToken: string;
    let refreshToken: string | null;
    try {
      const resolved = await resolveTokens(usuario);
      accessToken = resolved.accessToken;
      refreshToken = resolved.refreshToken;
      if (resolved.updatedToken) {
        await prisma.user.update({
          where: { id: usuario.id },
          data: { googleAccessToken: resolved.updatedToken.accessToken, googleTokenExpiry: resolved.updatedToken.expiresAt },
        });
      }
    } catch {
      return NextResponse.json(
        { success: false, error: 'Tu sesión de Google expiró. Cierra sesión e inicia sesión de nuevo para renovar los permisos.', code: 'TOKEN_EXPIRED' },
        { status: 422 },
      );
    }

    const doctorName = doctor.doctorFullName;
    try {
      await sendDocumentoEmail(
        {
          // La nota de una cita es una nota de venta: el mismo correo.
          tipo: tipo === 'cita' ? 'venta' : tipo, patientName: nombrePaciente, patientEmail: destinatario,
          doctorName, nombreArchivo, pdfBase64: pdfBase64.replace(/\s/g, ''),
        },
        accessToken, refreshToken, doctorName, usuario.email!,
      );
    } catch (gmailError: any) {
      const status = gmailError?.status ?? gmailError?.code;
      if (status === 403 || status === 401) {
        return NextResponse.json(
          { success: false, error: 'Tu cuenta de Google no tiene permisos para enviar correos. Cierra sesión e inicia sesión de nuevo para otorgar el permiso.', code: 'GMAIL_SCOPE_MISSING' },
          { status: 422 },
        );
      }
      if (status === 400) {
        // La dirección ya pasó CORREO_VALIDO: un 400 suele ser el mensaje (tamaño / formato), no el paciente.
        console.error('[enviar-documento] Gmail 400:', gmailError?.message);
        return NextResponse.json({ success: false, error: 'Gmail rechazó el correo (puede ser el tamaño del PDF). Descárgalo y mándalo a mano, o vuelve a intentarlo.' }, { status: 400 });
      }
      throw gmailError;
    }

    // Bitácora del expediente: qué se mandó, a quién y la HUELLA del PDF (lo armó el navegador: así queda
    // constancia de qué archivo salió). Una cita sin expediente no tiene bitácora: va al log del servidor.
    const sha256 = createHash('sha256').update(Buffer.from(pdfBase64.replace(/\s/g, ''), 'base64')).digest('hex');
    if (!patientId) {
      console.log('[enviar-documento] nota de cita sin expediente enviada:', { bookingId: id, doctorId: doctor.id, userId: quien.userId, destinatario, sha256 });
    } else {
      await prisma.patientAuditLog.create({
        data: {
          // Quién lo mandó DE VERDAD (un ADMIN no es el titular) y desde dónde.
          patientId, doctorId: doctor.id, userId: quien.userId, userRole: quien.role,
          ipAddress: (request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || request.headers.get('x-real-ip') || null)?.slice(0, 45) ?? null,
          userAgent: request.headers.get('user-agent'),
          action: tipo === 'receta' ? 'send_prescription_email' : tipo === 'venta' ? 'send_sale_email' : 'send_booking_nota_email',
          resourceType: tipo === 'receta' ? 'prescription' : tipo === 'venta' ? 'sale' : 'booking', resourceId: String(id),
          changes: { destinatario, archivo: nombreArchivo, sha256 },
        },
      }).catch((err) => console.error('[enviar-documento] bitácora:', err));
    }

    return NextResponse.json({ success: true, message: `Se envió ${tipo === 'receta' ? 'la receta' : 'la nota de venta'} a ${destinatario}` });
  } catch (error) {
    console.error('[enviar-documento] error:', error);
    return NextResponse.json({ success: false, error: 'No se pudo enviar el correo' }, { status: 500 });
  }
  };
}
