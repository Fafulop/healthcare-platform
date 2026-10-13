import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@healthcare/database';
import { getAuthenticatedDoctor } from '@/lib/auth';
import { cancelCFDI } from '@/lib/facturama';

// POST /api/facturacion/cfdi/:id/cancel - Cancel a CFDI
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const cfdiId = parseInt(id);

  try {
    const { doctor } = await getAuthenticatedDoctor(request);

    if (isNaN(cfdiId)) {
      return NextResponse.json({ error: 'ID inválido' }, { status: 400 });
    }

    const profile = await prisma.doctorFiscalProfile.findUnique({
      where: { doctorId: doctor.id },
    });

    if (!profile) {
      return NextResponse.json({ error: 'Perfil fiscal no encontrado' }, { status: 404 });
    }

    const cfdi = await prisma.cfdiEmitted.findFirst({
      where: { id: cfdiId, fiscalProfileId: profile.id },
    });

    if (!cfdi) {
      return NextResponse.json({ error: 'CFDI no encontrado' }, { status: 404 });
    }

    if (cfdi.status !== 'active') {
      return NextResponse.json(
        { error: `No se puede cancelar un CFDI con status: ${cfdi.status}` },
        { status: 400 }
      );
    }

    const body = await request.json();
    const { motive, uuidReplacement } = body;

    // Validate motive
    const validMotives = ['01', '02', '03', '04'];
    if (!motive || !validMotives.includes(motive)) {
      return NextResponse.json(
        { error: 'Motivo de cancelación requerido (01, 02, 03, 04)' },
        { status: 400 }
      );
    }

    // Motive 01 requires a replacement UUID
    if (motive === '01' && !uuidReplacement) {
      return NextResponse.json(
        { error: 'Motivo 01 requiere UUID del CFDI que sustituye' },
        { status: 400 }
      );
    }

    // Cancel in Facturama
    const result = await cancelCFDI(cfdi.facturamaId, profile.rfc, motive, uuidReplacement);

    // Reject if Facturama says it's not cancelable (e.g., has linked documents)
    if (result.Status === 'active' && result.IsCancelable?.toLowerCase().includes('no cancelable')) {
      return NextResponse.json(
        { error: 'Este CFDI no puede ser cancelado (tiene documentos relacionados activos)', details: result },
        { status: 400 }
      );
    }

    // Handle receiver rejection
    if (result.Status === 'rejected') {
      return NextResponse.json(
        { error: 'El receptor rechazó la solicitud de cancelación', details: result },
        { status: 400 }
      );
    }

    // Determine local status based on Facturama response
    // canceled/accepted/expired → cancelled | pending → cancellation_pending
    const isPending = result.Status === 'pending' ||
      result.IsCancelable?.toLowerCase().includes('con aceptacion');
    const newStatus = isPending ? 'cancellation_pending' : 'cancelled';

    // Update status in our DB
    await prisma.cfdiEmitted.update({
      where: { id: cfdi.id },
      data: {
        status: newStatus,
        cancelledAt: isPending ? null : new Date(),
        cancelMotivo: motive,
      },
    });

    // H8: cancelling un-invoices the linked income — reset hasFactura so
    // "consultas sin factura" picks the entry up again — UNLESS another factura
    // signal remains: a different active CFDI on the same entry, or a SAT-matched
    // UUID that is NOT this same (now cancelled) CFDI. Only on definitive cancel;
    // a cancellation_pending CFDI can still end up active if the receiver rejects.
    if (!isPending && cfdi.ledgerEntryId) {
      try {
        const [entry, otherActiveCount] = await Promise.all([
          prisma.ledgerEntry.findUnique({
            where: { id: cfdi.ledgerEntryId },
            select: { id: true, satCfdiUuid: true },
          }),
          prisma.cfdiEmitted.count({
            where: { ledgerEntryId: cfdi.ledgerEntryId, status: 'active', id: { not: cfdi.id } },
          }),
        ]);
        const satUuidIsThisCfdi =
          !!entry?.satCfdiUuid && entry.satCfdiUuid.toLowerCase() === cfdi.uuid.toLowerCase();
        if (entry && otherActiveCount === 0 && (!entry.satCfdiUuid || satUuidIsThisCfdi)) {
          await prisma.ledgerEntry.update({
            where: { id: entry.id },
            // Also clear the uuid when it belongs to THIS (now cancelled) CFDI
            // — otherwise the entry keeps claiming a dead factura and blocks
            // re-emission from stamping the new uuid (unique column).
            data: { hasFactura: false, ...(satUuidIsThisCfdi ? { satCfdiUuid: null } : {}) },
          });
        }
      } catch (err) {
        // Non-fatal: the CFDI is cancelled either way; the flag can be fixed manually.
        console.error('[cfdi-cancel] hasFactura reset failed:', err);
      }
    }

    // VISITAS 11-PLAN (2026-10-12): la factura de una visita cubre además otros ingresos (sus ventas,
    // `cfdi_ingresos`). Al cancelar EN DEFINITIVA vuelven a «sin factura» — con la MISMA regla que el
    // principal: salvo que otra factura viva lo cubra (como principal o como adicional). Después se BORRAN
    // los enlaces de esta factura: si se quedaran, la FK de `cfdi_ingresos` impediría para siempre borrar o
    // cancelar esas ventas por una factura que ya no vale. El uuid del SAT sólo lo lleva el principal.
    if (!isPending) {
      try {
        const extras = await prisma.cfdiIngreso.findMany({
          where: { cfdiEmittedId: cfdi.id, ledgerEntryId: cfdi.ledgerEntryId ? { not: cfdi.ledgerEntryId } : undefined },
          select: { ledgerEntryId: true },
        });
        // Las MISMAS señales que deja vivas el principal (code review): otra factura activa (como principal o
        // adicional), un uuid del SAT ligado (los extras no llevan el de ésta) o una factura subida a mano.
        const aLimpiar: number[] = [];
        for (const { ledgerEntryId } of extras) {
          const [comoPrincipal, comoAdicional, entry] = await Promise.all([
            prisma.cfdiEmitted.count({ where: { ledgerEntryId, status: 'active', id: { not: cfdi.id } } }),
            prisma.cfdiIngreso.count({ where: { ledgerEntryId, cfdiEmittedId: { not: cfdi.id }, cfdi: { status: 'active' } } }),
            prisma.ledgerEntry.findUnique({ where: { id: ledgerEntryId }, select: { satCfdiUuid: true, _count: { select: { facturas: true, facturasXml: true } } } }),
          ]);
          const otraSenal = !!entry?.satCfdiUuid || (entry?._count.facturas ?? 0) > 0 || (entry?._count.facturasXml ?? 0) > 0;
          if (comoPrincipal === 0 && comoAdicional === 0 && !otraSenal) aLimpiar.push(ledgerEntryId);
        }
        // Todo o nada: si falla, los enlaces se quedan y las ventas siguen bloqueadas (no quedan a medias).
        await prisma.$transaction([
          prisma.ledgerEntry.updateMany({ where: { id: { in: aLimpiar } }, data: { hasFactura: false } }),
          prisma.cfdiIngreso.deleteMany({ where: { cfdiEmittedId: cfdi.id } }),
        ]);
      } catch (err) {
        console.error('[cfdi-cancel] extra ingresos reset failed — FIX BY HAND:', cfdi.id, err);
      }
    }

    return NextResponse.json({
      data: {
        status: newStatus,
        motive,
        isCancelable: result.IsCancelable,
        expirationDate: result.ExpirationDate,
        acuseStatus: result.AcuseStatus,
        acuseStatusDetails: result.AcuseStatusDetails,
        facturamaResponse: result,
      }
    });
  } catch (error: any) {
    if (error.name === 'AuthError') {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    if (error.name === 'FacturamaError') {
      console.error('Facturama cancel error:', error.details);

      // If SAT returns "en proceso", mark as pending
      if (error.details?.Status === 'pending' || error.message?.includes('proceso')) {
        await prisma.cfdiEmitted.update({
          where: { id: cfdiId },
          data: { status: 'cancellation_pending' },
        });
        return NextResponse.json({
          data: { status: 'cancellation_pending', message: 'La cancelación está en proceso ante el SAT' }
        });
      }

      return NextResponse.json(
        { error: `Error al cancelar CFDI: ${error.message}`, details: error.details },
        { status: error.status >= 400 && error.status < 500 ? error.status : 502 }
      );
    }
    console.error('Error cancelling CFDI:', error);
    return NextResponse.json({ error: 'Error al cancelar factura' }, { status: 500 });
  }
}
