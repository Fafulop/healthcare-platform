import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@healthcare/database';
import { getAuthenticatedDoctor } from '@/lib/auth';
import {
  DEDUCTION_CATEGORIES,
  classifyConcepto,
  checkDeductibility,
} from '@/lib/deduction-categories';

/**
 * GET /api/sat-descarga/deductions — Categorized expense breakdown
 *
 * Queries received CFDIs (gastos), classifies each concepto into a deduction
 * category, aggregates by category and month, flags non-deductible items.
 *
 * Query params:
 *   year — optional, defaults to current year
 *
 * Response shape:
 * {
 *   data: {
 *     year, regimenFiscal,
 *     categories: [{ id, name, icon, count, subtotal, iva, flags, conceptos }],
 *     months: [{ month, categories: { [id]: { count, subtotal, iva } } }],
 *     totals: { count, subtotal, iva, nonDeductible, flagged },
 *     alerts: [{ type, message, count }],
 *     resicoMonitor?: { ytdIncome, limit, percentage }  // only for 626
 *   }
 * }
 */
export async function GET(request: NextRequest) {
  try {
    const { doctor } = await getAuthenticatedDoctor(request);
    const url = new URL(request.url);
    const year = parseInt(url.searchParams.get('year') || String(new Date().getFullYear()), 10);

    // Get doctor's fiscal profile for régimen
    const fiscalProfile = await prisma.doctorFiscalProfile.findUnique({
      where: { doctorId: doctor.id },
      select: { regimenFiscal: true },
    });
    const regimenFiscal = fiscalProfile?.regimenFiscal || '612';

    // Fetch received Vigente CFDIs: PUE/null by issuedAt, PPD by payment date
    // This ensures cross-year PPD invoices are included when paid in the target year
    const cfdiSelect = {
      uuid: true,
      issuerRfc: true,
      issuerName: true,
      monto: true,
      issuedAt: true,
      satStatus: true,
    } as const;

    // PUE + unknown: count at invoice date
    const pueCfdis = await prisma.satCfdiMetadata.findMany({
      where: {
        doctorId: doctor.id,
        direction: 'received',
        satStatus: 'Vigente',
        efecto: 'I',
        issuedAt: {
          gte: new Date(`${year}-01-01T00:00:00Z`),
          lt: new Date(`${year + 1}-01-01T00:00:00Z`),
        },
      },
      select: cfdiSelect,
    });

    // PPD invoices that have payments in the target year (regardless of invoice date)
    const ppdPagosInYear = await prisma.satPago.findMany({
      where: {
        doctorId: doctor.id,
        unlinkedAt: null,
        fechaPago: {
          gte: new Date(`${year}-01-01T00:00:00Z`),
          lt: new Date(`${year + 1}-01-01T00:00:00Z`),
        },
      },
      select: { facturaUuid: true, fechaPago: true },
    });
    // Map factura UUID → earliest payment date in year (for monthly bucketing)
    const ppdPaymentMonth = new Map<string, number>();
    for (const p of ppdPagosInYear) {
      const uuid = p.facturaUuid.toLowerCase();
      if (p.fechaPago) {
        const month = p.fechaPago.getMonth() + 1;
        // Use earliest payment month for the CFDI
        if (!ppdPaymentMonth.has(uuid) || month < ppdPaymentMonth.get(uuid)!) {
          ppdPaymentMonth.set(uuid, month);
        }
      }
    }
    const ppdUuidsWithPayment = [...new Set(ppdPagosInYear.map(p => p.facturaUuid.toLowerCase()))];

    // Fetch PPD invoice metadata (may be from previous years)
    // SAT metadata stores UUIDs uppercase, SatPago stores lowercase — query both cases
    const ppdCfdis = ppdUuidsWithPayment.length > 0
      ? await prisma.satCfdiMetadata.findMany({
          where: {
            doctorId: doctor.id,
            direction: 'received',
            satStatus: 'Vigente',
            efecto: 'I',
            uuid: { in: [
              ...ppdUuidsWithPayment.map(u => u.toLowerCase()),
              ...ppdUuidsWithPayment.map(u => u.toUpperCase()),
            ] },
          },
          select: cfdiSelect,
        })
      : [];

    // Merge, dedup (a PUE-issued CFDI in this year won't overlap with PPD set)
    const seenUuids = new Set<string>();
    const cfdis: typeof pueCfdis = [];
    for (const c of pueCfdis) {
      const lower = c.uuid.toLowerCase();
      if (!seenUuids.has(lower)) {
        seenUuids.add(lower);
        cfdis.push(c);
      }
    }
    for (const c of ppdCfdis) {
      const lower = c.uuid.toLowerCase();
      if (!seenUuids.has(lower)) {
        seenUuids.add(lower);
        cfdis.push(c);
      }
    }

    // Batch-fetch details for all CFDIs
    // Metadata stores UUIDs as-is from SAT (uppercase), but XML parser stores them lowercase.
    // Normalize to lowercase for matching.
    const uuids = cfdis.map(c => c.uuid.toLowerCase());
    const details = uuids.length > 0
      ? await prisma.satCfdiDetail.findMany({
          where: { doctorId: doctor.id, uuid: { in: uuids } },
          select: {
            uuid: true,
            subtotal: true,
            total: true,
            ivaTrasladado: true,
            isrRetenido: true,
            ivaRetenido: true,
            formaPago: true,
            metodoPago: true,
            usoCfdi: true,
            manualCategory: true,
            conceptos: {
              select: {
                claveProdServ: true,
                descripcion: true,
                importe: true,
                ivaTrasladado: true,
                isrRetenido: true,
              },
            },
          },
        })
      : [];

    const detailMap = new Map(details.map(d => [d.uuid.toLowerCase(), d]));

    // PPD CFDIs with complemento in this year (already fetched above)
    const ppdWithComplemento = new Set(ppdUuidsWithPayment);

    // Track PPD without complemento — excluded from deductions
    let ppdExcludedCount = 0;
    let ppdExcludedSubtotal = 0;

    // Initialize category aggregation
    type CategoryAgg = {
      id: string;
      name: string;
      icon: string;
      count: number;
      subtotal: number;
      iva: number;
      flaggedCount: number;
      cfdiSamples: Array<{
        uuid: string;
        issuerName: string | null;
        issuerRfc: string;
        subtotal: number;
        iva: number;
        issuedAt: string;
        month: number;
        categoryId: string;
        isManual: boolean;
        flags: Array<{ type: string; message: string }>;
      }>;
    };

    const categoryMap: Record<string, CategoryAgg> = {};
    for (const cat of DEDUCTION_CATEGORIES) {
      categoryMap[cat.id] = {
        id: cat.id,
        name: cat.name,
        icon: cat.icon,
        count: 0,
        subtotal: 0,
        iva: 0,
        flaggedCount: 0,
        cfdiSamples: [],
      };
    }

    // Monthly aggregation
    const monthlyMap: Record<number, Record<string, { count: number; subtotal: number; iva: number }>> = {};
    for (let m = 1; m <= 12; m++) {
      monthlyMap[m] = {};
      for (const cat of DEDUCTION_CATEGORIES) {
        monthlyMap[m][cat.id] = { count: 0, subtotal: 0, iva: 0 };
      }
    }

    // Alerts accumulation
    let cashOver2kCount = 0;
    let noXmlCount = 0;
    let proportionalCount = 0;
    let sinEfectosCount = 0;
    let sinClasificarCount = 0;
    let totalNonDeductible = 0;

    // Classify each CFDI
    for (const cfdi of cfdis) {
      const detail = detailMap.get(cfdi.uuid.toLowerCase());
      const cfdiUuidLower = cfdi.uuid.toLowerCase();

      // Exclude PPD invoices without complemento de pago (not yet paid = not deductible)
      if (detail?.metodoPago === 'PPD' && !ppdWithComplemento.has(cfdiUuidLower)) {
        ppdExcludedCount++;
        ppdExcludedSubtotal += detail ? Number(detail.subtotal) : Number(cfdi.monto);
        continue;
      }

      // For PPD with complemento, use payment month; for PUE, use invoice month
      const month = ppdPaymentMonth.has(cfdiUuidLower)
        ? ppdPaymentMonth.get(cfdiUuidLower)!
        : cfdi.issuedAt.getMonth() + 1;
      const cfdiSubtotal = detail ? Number(detail.subtotal) : Number(cfdi.monto);
      const cfdiIva = detail ? Number(detail.ivaTrasladado) : 0;

      let primaryCategory = 'sin_clasificar';
      const isManual = !!(detail?.manualCategory);

      if (isManual) {
        // Manual override takes precedence
        primaryCategory = detail!.manualCategory!;
      } else if (detail && detail.conceptos.length > 0) {
        // Auto-classify by the highest-value concepto
        let maxImporte = 0;
        for (const concepto of detail.conceptos) {
          const importe = Number(concepto.importe) || 0;
          const catId = classifyConcepto(concepto.claveProdServ, concepto.descripcion);
          if (importe > maxImporte) {
            maxImporte = importe;
            primaryCategory = catId;
          }
        }
      }

      // Check deductibility flags
      const cfdiTotal = Number(cfdi.monto) || (detail ? Number(detail.total) : 0);
      const flags = checkDeductibility({
        formaPago: detail?.formaPago || null,
        subtotal: cfdiSubtotal,
        total: cfdiTotal,
        satStatus: cfdi.satStatus,
        hasDetails: !!detail,
        categoryId: primaryCategory,
        usoCfdi: detail?.usoCfdi || null,
        regimenFiscal,
      });

      const hasNonDeductible = flags.some(f => f.type === 'cash_over_2k' || f.type === 'sin_efectos' || f.type === 'cancelled');
      if (hasNonDeductible) totalNonDeductible += cfdiSubtotal;
      if (flags.some(f => f.type === 'cash_over_2k')) cashOver2kCount++;
      if (flags.some(f => f.type === 'no_xml')) noXmlCount++;
      if (flags.some(f => f.type === 'proportional')) proportionalCount++;
      if (flags.some(f => f.type === 'sin_efectos')) sinEfectosCount++;
      if (flags.some(f => f.type === 'sin_clasificar')) sinClasificarCount++;

      // Aggregate into category
      const cat = categoryMap[primaryCategory] || categoryMap['sin_clasificar'];
      cat.count++;
      cat.subtotal += cfdiSubtotal;
      cat.iva += cfdiIva;
      if (flags.length > 0) cat.flaggedCount++;

      // Keep up to 100 samples per category for drill-down
      if (cat.cfdiSamples.length < 100) {
        cat.cfdiSamples.push({
          uuid: cfdi.uuid,
          issuerName: cfdi.issuerName,
          issuerRfc: cfdi.issuerRfc,
          subtotal: cfdiSubtotal,
          iva: cfdiIva,
          issuedAt: cfdi.issuedAt.toISOString(),
          month,
          categoryId: primaryCategory,
          isManual,
          flags,
        });
      }

      // Monthly
      const monthCat = monthlyMap[month]?.[primaryCategory] || monthlyMap[month]?.['sin_clasificar'];
      if (monthCat) {
        monthCat.count++;
        monthCat.subtotal += cfdiSubtotal;
        monthCat.iva += cfdiIva;
      }
    }

    // Build response
    const categories = Object.values(categoryMap)
      .filter(c => c.count > 0)
      .sort((a, b) => b.subtotal - a.subtotal);

    const months = Object.entries(monthlyMap)
      .map(([m, cats]) => ({
        month: parseInt(m),
        categories: Object.fromEntries(
          Object.entries(cats).filter(([, v]) => v.count > 0)
        ),
      }))
      .filter(m => Object.keys(m.categories).length > 0);

    const totalCount = categories.reduce((s, c) => s + c.count, 0);
    const totalSubtotal = categories.reduce((s, c) => s + c.subtotal, 0);
    const totalIva = categories.reduce((s, c) => s + c.iva, 0);
    const totalFlagged = categories.reduce((s, c) => s + c.flaggedCount, 0);

    // Build alerts
    const isResico = regimenFiscal === '626';
    const alerts: Array<{ type: string; message: string; count: number }> = [];
    if (sinEfectosCount > 0) {
      alerts.push({
        type: 'sin_efectos',
        message: `${sinEfectosCount} CFDI(s) con uso "S01 — Sin efectos fiscales" — no deducible(s), sin IVA acreditable`,
        count: sinEfectosCount,
      });
    }
    if (cashOver2kCount > 0) {
      alerts.push({
        type: 'cash_over_2k',
        message: isResico
          ? `${cashOver2kCount} gasto(s) en efectivo > $2,000 — IVA no acreditable sin bancarización`
          : `${cashOver2kCount} gasto(s) en efectivo > $2,000 — no deducible(s)`,
        count: cashOver2kCount,
      });
    }
    if (sinClasificarCount > 0) {
      alerts.push({
        type: 'sin_clasificar',
        message: `${sinClasificarCount} gasto(s) sin clasificar — revisa manualmente si son deducibles`,
        count: sinClasificarCount,
      });
    }
    if (noXmlCount > 0) {
      alerts.push({
        type: 'no_xml',
        message: `${noXmlCount} CFDI(s) sin detalles XML — clasificación aproximada`,
        count: noXmlCount,
      });
    }
    if (!isResico && proportionalCount > 0) {
      alerts.push({
        type: 'proportional',
        message: `${proportionalCount} gasto(s) proporcional(es) — revisa % de uso profesional`,
        count: proportionalCount,
      });
    }
    if (ppdExcludedCount > 0) {
      alerts.push({
        type: 'ppd_sin_complemento',
        message: `${ppdExcludedCount} factura(s) PPD sin complemento de pago excluidas ($${Math.round(ppdExcludedSubtotal).toLocaleString()}) — no deducible(s) hasta recibir complemento`,
        count: ppdExcludedCount,
      });
    }

    // RESICO monitor: YTD income vs $3.5M limit (cash-basis)
    let resicoMonitor = undefined;
    if (regimenFiscal === '626') {
      const [pueIncome, ppdIncome] = await Promise.all([
        prisma.$queryRaw<Array<{ total_income: number | null }>>`
          SELECT SUM(d.subtotal)::float AS total_income
          FROM practice_management.sat_cfdi_details d
          JOIN practice_management.sat_cfdi_metadata m
            ON m.doctor_id = d.doctor_id AND LOWER(m.uuid) = LOWER(d.uuid)
          WHERE d.doctor_id = ${doctor.id}
            AND m.sat_status = 'Vigente' AND m.direction = 'emitted' AND m.efecto = 'I'
            AND (d.metodo_pago = 'PUE' OR d.metodo_pago IS NULL)
            AND EXTRACT(YEAR FROM m.issued_at) = ${year}
        `,
        prisma.$queryRaw<Array<{ total_income: number | null }>>`
          SELECT SUM(COALESCE(p.base_dr, (p.monto_pagado / NULLIF(d.total, 0)) * d.subtotal))::float AS total_income
          FROM practice_management.sat_pagos p
          JOIN practice_management.sat_cfdi_metadata m ON m.doctor_id = p.doctor_id AND LOWER(m.uuid) = LOWER(p.factura_uuid)
          JOIN practice_management.sat_cfdi_details d ON d.doctor_id = p.doctor_id AND LOWER(d.uuid) = LOWER(p.factura_uuid)
          WHERE p.doctor_id = ${doctor.id}
            AND m.sat_status = 'Vigente' AND m.direction = 'emitted' AND m.efecto = 'I'
            AND p.unlinked_at IS NULL AND p.fecha_pago IS NOT NULL AND EXTRACT(YEAR FROM p.fecha_pago) = ${year}
        `,
      ]);
      const ytdIncome = (pueIncome[0]?.total_income || 0) + (ppdIncome[0]?.total_income || 0);
      const limit = 3500000;
      resicoMonitor = {
        ytdIncome: Math.round(ytdIncome * 100) / 100,
        limit,
        percentage: Math.round((ytdIncome / limit) * 10000) / 100, // e.g. 42.35%
      };
    }

    // Round all money values to 2 decimals
    const round2 = (n: number) => Math.round(n * 100) / 100;
    for (const cat of categories) {
      cat.subtotal = round2(cat.subtotal);
      cat.iva = round2(cat.iva);
    }

    return NextResponse.json({
      data: {
        year,
        regimenFiscal,
        categories,
        months,
        totals: {
          count: totalCount,
          subtotal: round2(totalSubtotal),
          iva: round2(totalIva),
          nonDeductible: round2(totalNonDeductible),
          flagged: totalFlagged,
        },
        alerts,
        resicoMonitor,
        allCategories: DEDUCTION_CATEGORIES.map(c => ({ id: c.id, name: c.name, icon: c.icon })),
      },
    });
  } catch (error: any) {
    if (error.name === 'AuthError') {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error('Error computing deductions:', error);
    return NextResponse.json({ error: 'Error al calcular deducciones' }, { status: 500 });
  }
}

/**
 * PATCH /api/sat-descarga/deductions — Manually classify a CFDI
 *
 * Body: { uuid: string, categoryId: string | null }
 *   categoryId = null clears the override (reverts to auto-classification)
 */
export async function PATCH(request: NextRequest) {
  try {
    const { doctor } = await getAuthenticatedDoctor(request);
    const body = await request.json();
    const { uuid, categoryId } = body;

    if (!uuid || typeof uuid !== 'string') {
      return NextResponse.json({ error: 'UUID requerido' }, { status: 400 });
    }

    // Validate categoryId if provided
    const validIds = DEDUCTION_CATEGORIES.map(c => c.id);
    if (categoryId !== null && categoryId !== undefined && !validIds.includes(categoryId)) {
      return NextResponse.json({ error: 'Categoría inválida' }, { status: 400 });
    }

    // Verify ownership and update
    const detail = await prisma.satCfdiDetail.findFirst({
      where: { doctorId: doctor.id, uuid: uuid.toLowerCase() },
      select: { id: true },
    });

    if (!detail) {
      return NextResponse.json({ error: 'CFDI no encontrado' }, { status: 404 });
    }

    await prisma.satCfdiDetail.update({
      where: { id: detail.id },
      data: { manualCategory: categoryId || null },
    });

    return NextResponse.json({ success: true, uuid, categoryId: categoryId || null });
  } catch (error: any) {
    if (error.name === 'AuthError') {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error('Error updating manual category:', error);
    return NextResponse.json({ error: 'Error al clasificar' }, { status: 500 });
  }
}
