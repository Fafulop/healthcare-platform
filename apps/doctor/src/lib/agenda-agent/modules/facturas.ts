/**
 * FACTURAS/PAGOS module — PR F1: READ-ONLY tools over facturación, pagos y
 * datos fiscales del expediente (scope: /dashboard/medical-records fiscal,
 * /facturacion, /sat-descarga, /pagos).
 *
 * Design (docs/DESDE JUNIO/AGENTES/AGENTE FACTURAS/):
 * - Regla 0: business definitions resolve SERVER-SIDE. "Facturada" is a
 *   COMPOSITE verdict (active platform CFDI, or SAT-matched UUID that is not
 *   Cancelado in sat_cfdi_metadata); a cancelled CFDI without reissue counts
 *   as NOT facturada. "Pagada" ≠ "completada" (a paid link creates the income
 *   before completion). The model NEVER reconstructs these.
 * - Dual CFDI source (01-CONTEXTO): sat_cfdi_metadata covers the WHOLE RFC
 *   (doctors who emit outside the platform); cfdis_emitted only the platform.
 *   Tools declare their source and expose sync freshness.
 * - Privacy tier (decided PR F1): patient reads are METADATA + demographic +
 *   fiscal fields ONLY — never encounter/note/prescription content (that is
 *   the future expediente-médico block).
 * - Timestamps render as MEXICO CITY calendar days (mxDayOf) — a link paid at
 *   19:00 MX is "today" for the doctor, not tomorrow's UTC date. Date-range
 *   filters on timestamp columns use MX-midnight boundaries (fixed UTC-6; MX
 *   abolished DST in 2022). `@db.Date` columns keep utcDateToKey.
 * - v1 has NO write proposals here (emission/cancel/links/fiscal form = F2).
 */

import { prisma } from '@healthcare/database';
import type { AnthropicTool } from '../anthropic';
import type { ToolContext } from '../tools';
import { utcDateToKey, mxTodayKey } from '../dates';
import type { AgentModule } from './types';

const LIST_CAP = 50;
const PATIENT_CITAS_CAP = 10; // billing status per patient — nested payloads must fit the 8KB tool-result cap
const MX_TZ = 'America/Mexico_City';
const DATE_KEY_RE = /^\d{4}-\d{2}-\d{2}$/;

// -----------------------------------------------------------------------------
// Tool definitions
// -----------------------------------------------------------------------------

const FACTURAS_TOOLS: AnthropicTool[] = [
  {
    name: 'get_billing_status',
    description:
      'EL diagnóstico completo de cobro/factura de una cita (o de las citas recientes de un paciente): expediente vinculado, datos fiscales del paciente, ingreso en Flujo de Dinero (y cómo nació), estado de pago (incluye links de pago), y si está FACTURADA (señal compuesta que resuelve el servidor — plataforma Y facturas externas del SAT). Úsala para "¿cómo va el cobro de X?", "¿ya se facturó la cita de Y?", "¿qué falta para facturarle?". Pasa bookingId (de get_bookings/get_day_schedule de ESTE turno) O patientId (de find_patient — sus 10 citas más recientes).',
    input_schema: {
      type: 'object',
      properties: {
        bookingId: { type: 'string', description: 'ID de la cita (una sola)' },
        patientId: { type: 'string', description: `ID del expediente (sus ${PATIENT_CITAS_CAP} citas más recientes)` },
      },
    },
  },
  {
    name: 'get_patient_profile',
    description:
      'Perfil de un expediente: datos de contacto y FISCALES (RFC, razón social, régimen, uso CFDI, CP) con "completitudFiscal" resuelta por el servidor (completo/parcial/vacío), si el paciente pidió factura (requiereFactura) y "listoParaFacturar" (ambas cosas — lo que exige el botón de emitir del expediente). NO devuelve contenido clínico (notas/consultas) — eso está fuera de tu alcance. El patientId sale de find_patient de ESTE turno.',
    input_schema: {
      type: 'object',
      properties: {
        patientId: { type: 'string', description: 'ID del expediente' },
      },
      required: ['patientId'],
    },
  },
  {
    name: 'get_fiscal_profile_status',
    description:
      'Estado del perfil fiscal del DOCTOR: si puede emitir facturas (CSD/Facturama activo), su RFC/régimen, y si tiene SAT Descarga configurado (e.Firma). Úsala ANTES de hablar de emitir facturas — si no puede timbrar, dilo honesto.',
    input_schema: { type: 'object', properties: {} },
  },
  {
    name: 'get_cfdis',
    description:
      'Facturas (CFDI) emitidas DESDE LA PLATAFORMA (Facturama). OJO: si el doctor también emite fuera de la plataforma, esta lista es INCOMPLETA — usa get_sat_cfdis para el panorama completo del RFC. Filtros opcionales por fechas/status/paciente.',
    input_schema: {
      type: 'object',
      properties: {
        startDate: { type: 'string', description: 'Desde "YYYY-MM-DD" (opcional, por fecha de emisión, día de México)' },
        endDate: { type: 'string', description: 'Hasta "YYYY-MM-DD" (opcional)' },
        status: { type: 'string', enum: ['active', 'cancelled', 'cancellation_pending'], description: 'Filtrar por status (opcional)' },
        patientId: { type: 'string', description: 'Solo facturas ligadas a este expediente (opcional)' },
      },
    },
  },
  {
    name: 'get_sat_cfdis',
    description:
      'CFDIs del RFC del doctor descargados del SAT — TODO lo que el SAT tiene (emitidos Y recibidos, incluya o no la plataforma). Es la fuente COMPLETA para "¿cuánto facturé?" cuando el doctor usa SAT Descarga; "received" son los GASTOS/deducciones del doctor. Devuelve también la FRESCURA de los datos (último sync exitoso y jobs fallidos recientes) — si los datos pueden estar desactualizados, DILO al doctor y menciona el botón "Sync mes actual" del dashboard SAT.',
    input_schema: {
      type: 'object',
      properties: {
        direction: { type: 'string', enum: ['emitted', 'received'], description: 'emitidos (facturación del doctor) o recibidos (sus gastos). Default: emitidos' },
        startDate: { type: 'string', description: 'Desde "YYYY-MM-DD" (opcional, por fecha de emisión, día de México)' },
        endDate: { type: 'string', description: 'Hasta "YYYY-MM-DD" (opcional)' },
        counterpartyRfc: { type: 'string', description: 'RFC de la contraparte (opcional)' },
      },
    },
  },
  {
    name: 'get_payment_links',
    description:
      'Links de pago del doctor (Stripe y Mercado Pago) con su estado (pendiente/pagado/expirado/cancelado) y a qué cita están ligados. Úsala para "¿ya me pagaron el link de X?", "¿qué links tengo sin pagar?".',
    input_schema: {
      type: 'object',
      properties: {
        bookingId: { type: 'string', description: 'Solo el link de esta cita (opcional)' },
        status: { type: 'string', enum: ['PENDING', 'PAID', 'EXPIRED', 'CANCELLED'], description: 'Filtrar por estado (opcional)' },
      },
    },
  },
];

// -----------------------------------------------------------------------------
// Shared helpers
// -----------------------------------------------------------------------------

function num(d: unknown): number | null {
  if (d === null || d === undefined) return null;
  const n = Number(d);
  return Number.isFinite(n) ? n : null;
}

/** Calendar day in Mexico City for a REAL timestamp (paidAt, issuedAt, …) —
 * toISOString() would attribute an MX-evening event to the next UTC day. */
function mxDayOf(d: Date): string {
  return d.toLocaleDateString('en-CA', { timeZone: MX_TZ });
}

/** MX-midnight of a YYYY-MM-DD key as a UTC instant, for filtering timestamp
 * columns by Mexico-City day (fixed UTC-6 — MX abolished DST in 2022). */
function mxDayStartUtc(dateKey: string): Date {
  return new Date(dateKey + 'T06:00:00Z');
}

/** Model-supplied date key: string + format guard (an object or number would
 * become an Invalid Date inside the Prisma filter and blow up the tool call). */
function asDateKey(v: unknown): string | null {
  return typeof v === 'string' && DATE_KEY_RE.test(v) ? v : null;
}

/** MX-day range filter for a timestamp column, or an error message. */
function timestampRange(
  startDate: unknown,
  endDate: unknown
): { filter: { gte?: Date; lt?: Date } | null } | { error: string } {
  const hasStart = startDate !== undefined && startDate !== null && startDate !== '';
  const hasEnd = endDate !== undefined && endDate !== null && endDate !== '';
  if (!hasStart && !hasEnd) return { filter: null };
  const start = hasStart ? asDateKey(startDate) : undefined;
  const end = hasEnd ? asDateKey(endDate) : undefined;
  if ((hasStart && !start) || (hasEnd && !end)) {
    return { error: 'Fechas inválidas — usa el formato "YYYY-MM-DD".' };
  }
  const filter: { gte?: Date; lt?: Date } = {};
  if (start) filter.gte = mxDayStartUtc(start);
  if (end) {
    const lt = mxDayStartUtc(end);
    lt.setUTCDate(lt.getUTCDate() + 1);
    filter.lt = lt;
  }
  return { filter };
}

/** Regla 0: fiscal-data completeness is a server verdict, never field-counting
 * by the model. The 5 fields are what emission requires (receptor completo);
 * "listoParaFacturar" mirrors the expediente page's emit gate (fields AND
 * requiereFactura) so the agent never contradicts the UI. */
function fiscalCompleteness(p: {
  requiereFactura: boolean;
  rfc: string | null;
  razonSocial: string | null;
  regimenFiscal: string | null;
  usoCfdi: string | null;
  codigoPostalFiscal: string | null;
}): {
  completitudFiscal: 'completo' | 'parcial' | 'vacío';
  camposFaltantes: string[];
  listoParaFacturar: boolean;
} {
  const fields: [string, string | null][] = [
    ['rfc', p.rfc],
    ['razonSocial', p.razonSocial],
    ['regimenFiscal', p.regimenFiscal],
    ['usoCfdi', p.usoCfdi],
    ['codigoPostalFiscal', p.codigoPostalFiscal],
  ];
  const missing = fields.filter(([, v]) => !v || !String(v).trim()).map(([k]) => k);
  const completo = missing.length === 0;
  return {
    completitudFiscal: completo ? 'completo' : missing.length === fields.length ? 'vacío' : 'parcial',
    camposFaltantes: missing,
    listoParaFacturar: completo && p.requiereFactura,
  };
}

const PATIENT_FISCAL_SELECT = {
  id: true,
  firstName: true,
  lastName: true,
  email: true,
  phone: true,
  requiereFactura: true,
  rfc: true,
  razonSocial: true,
  regimenFiscal: true,
  usoCfdi: true,
  codigoPostalFiscal: true,
  constanciaFiscalUrl: true,
} as const;

type PatientFiscal = {
  id: string;
  firstName: string;
  lastName: string;
  email: string | null;
  phone: string | null;
  requiereFactura: boolean;
  rfc: string | null;
  razonSocial: string | null;
  regimenFiscal: string | null;
  usoCfdi: string | null;
  codigoPostalFiscal: string | null;
  constanciaFiscalUrl: string | null;
};

function mapPatientFiscal(p: PatientFiscal) {
  return {
    patientId: p.id,
    nombre: `${p.firstName} ${p.lastName}`.trim(),
    requiereFactura: p.requiereFactura,
    ...fiscalCompleteness(p),
    rfc: p.rfc,
    razonSocial: p.razonSocial,
    regimenFiscal: p.regimenFiscal,
    usoCfdi: p.usoCfdi,
    codigoPostalFiscal: p.codigoPostalFiscal,
    tieneConstancia: !!p.constanciaFiscalUrl,
  };
}

// -----------------------------------------------------------------------------
// Billing status (the 6-question matrix of 02 §3) — batched
// -----------------------------------------------------------------------------

const LINK_SELECT = {
  status: true,
  isActive: true,
  amount: true,
  paidAt: true,
  createdAt: true,
  description: true,
  bookingId: true,
} as const;

const BILLING_BOOKING_SELECT = {
  id: true,
  patientName: true,
  status: true,
  date: true,
  startTime: true,
  serviceName: true,
  finalPrice: true,
  patientId: true,
  patient: { select: PATIENT_FISCAL_SELECT },
  slot: { select: { date: true, startTime: true } },
  paymentLink: { select: LINK_SELECT },
  mpPaymentPreference: { select: LINK_SELECT },
  ledgerEntry: {
    select: {
      id: true,
      amount: true,
      amountPaid: true,
      paymentStatus: true,
      formaDePago: true,
      origin: true,
      hasFactura: true,
      satCfdiUuid: true,
    },
  },
} as const;

type BillingBooking = NonNullable<
  Awaited<ReturnType<typeof prisma.booking.findFirst<{ select: typeof BILLING_BOOKING_SELECT }>>>
>;

interface CfdiForVerdict {
  ledgerEntryId: number | null;
  status: string;
  uuid: string;
  folio: string | null;
  total: unknown;
  nombreReceptor: string;
  rfcReceptor: string;
  issuedAt: Date;
}

/** Batch-fetch everything the composite factura verdict needs for a set of
 * ledger entries: their platform CFDIs (doctor-scoped as defense-in-depth) and
 * the SAT status of any matched external UUID (H8/H5: a satCfdiUuid whose
 * metadata says Cancelado must NOT count as facturada). */
async function fetchVerdictData(doctorId: string, entries: { id: number; satCfdiUuid: string | null }[]) {
  const entryIds = entries.map((e) => e.id);
  const satUuids = entries
    .map((e) => e.satCfdiUuid)
    .filter((u): u is string => !!u)
    .flatMap((u) => [u.toUpperCase(), u.toLowerCase()]);

  const [cfdis, satMetas] = await Promise.all([
    entryIds.length > 0
      ? prisma.cfdiEmitted.findMany({
          where: { ledgerEntryId: { in: entryIds }, fiscalProfile: { doctorId } },
          orderBy: { issuedAt: 'desc' },
          select: {
            ledgerEntryId: true, status: true, uuid: true, folio: true, total: true,
            nombreReceptor: true, rfcReceptor: true, issuedAt: true,
          },
        })
      : Promise.resolve([] as CfdiForVerdict[]),
    satUuids.length > 0
      ? prisma.satCfdiMetadata.findMany({
          where: { doctorId, uuid: { in: Array.from(new Set(satUuids)) } },
          select: { uuid: true, satStatus: true },
        })
      : Promise.resolve([] as { uuid: string; satStatus: string }[]),
  ]);

  const cfdisByEntry = new Map<number, CfdiForVerdict[]>();
  for (const c of cfdis) {
    if (c.ledgerEntryId == null) continue;
    const list = cfdisByEntry.get(c.ledgerEntryId) ?? [];
    list.push(c);
    cfdisByEntry.set(c.ledgerEntryId, list);
  }
  const satStatusByUuid = new Map(satMetas.map((m) => [m.uuid.toLowerCase(), m.satStatus]));
  return { cfdisByEntry, satStatusByUuid };
}

/** COMPOSITE "facturada" verdict (regla 0 + H8 + H5), pure over prefetched data. */
function facturaVerdict(
  entry: { id: number; hasFactura: boolean; satCfdiUuid: string | null },
  cfdisByEntry: Map<number, CfdiForVerdict[]>,
  satStatusByUuid: Map<string, string>
) {
  const cfdis = cfdisByEntry.get(entry.id) ?? [];
  const activeCfdi = cfdis.find((c) => c.status === 'active');
  if (activeCfdi) {
    return {
      facturada: true as const,
      via: 'plataforma' as const,
      cfdi: {
        uuid: activeCfdi.uuid,
        folio: activeCfdi.folio,
        total: num(activeCfdi.total),
        receptor: `${activeCfdi.nombreReceptor} (${activeCfdi.rfcReceptor})`,
        emitida: mxDayOf(activeCfdi.issuedAt),
      },
    };
  }
  if (entry.satCfdiUuid) {
    const satStatus = satStatusByUuid.get(entry.satCfdiUuid.toLowerCase());
    if (satStatus === 'Cancelado') {
      return {
        facturada: false as const,
        nota: 'Tuvo una factura externa (vía SAT) que fue CANCELADA ante el SAT y no se ha re-emitido.',
      };
    }
    return {
      facturada: true as const,
      via: 'externa_sat' as const,
      satCfdiUuid: entry.satCfdiUuid,
      nota:
        satStatus === 'Vigente'
          ? 'Factura emitida FUERA de la plataforma, Vigente según el último sync del SAT.'
          : 'Factura emitida FUERA de la plataforma, detectada vía SAT Descarga (una cancelación reciente podría no reflejarse hasta el siguiente sync de metadata).',
    };
  }
  const cancelledCfdi = cfdis.find((c) => c.status === 'cancelled' || c.status === 'cancellation_pending');
  return {
    facturada: false as const,
    ...(cancelledCfdi
      ? {
          nota: `Tuvo una factura que fue ${cancelledCfdi.status === 'cancelled' ? 'CANCELADA' : 'enviada a cancelación (pendiente de aceptación)'}${cancelledCfdi.folio ? ` (folio ${cancelledCfdi.folio})` : ''} y no se ha re-emitido.`,
        }
      : {}),
  };
}

/** One cita's full billing diagnosis, pure over prefetched verdict data. */
function buildBillingStatus(
  booking: BillingBooking,
  cfdisByEntry: Map<number, CfdiForVerdict[]>,
  satStatusByUuid: Map<string, string>
) {
  const date = booking.slot?.date ?? booking.date;
  const entry = booking.ledgerEntry;

  const links = [
    booking.paymentLink ? { proveedor: 'Stripe', ...booking.paymentLink } : null,
    booking.mpPaymentPreference ? { proveedor: 'Mercado Pago', ...booking.mpPaymentPreference } : null,
  ]
    .filter((l): l is NonNullable<typeof l> => l !== null)
    .map((l) => ({
      proveedor: l.proveedor,
      estado: l.status,
      activo: l.isActive,
      monto: num(l.amount),
      pagadoEl: l.paidAt ? mxDayOf(l.paidAt) : null,
    }));

  return {
    cita: {
      bookingId: booking.id,
      paciente: booking.patientName,
      fecha: date ? utcDateToKey(date) : null,
      hora: booking.slot?.startTime ?? booking.startTime ?? null,
      estado: booking.status,
      servicio: booking.serviceName ?? null,
      precio: num(booking.finalPrice),
    },
    expediente: booking.patient
      ? { vinculado: true, ...mapPatientFiscal(booking.patient) }
      : { vinculado: false, nota: 'Walk-in sin expediente — para link de pago o factura nominativa primero hay que crear/vincular el expediente.' },
    // "Pagada" authority: the LEDGER (estadoPago) is the hub and wins; link
    // states are the evidence trail (a paid link is what CREATED the entry).
    ingreso: entry
      ? {
          registrado: true,
          ledgerEntryId: entry.id,
          monto: num(entry.amount),
          origen: entry.origin,
          origenExplicado:
            entry.origin === 'webhook_pago'
              ? 'pagado con link de pago (el ingreso nació del webhook, ANTES o sin completar la cita)'
              : entry.origin === 'cita'
                ? 'registrado al completar la cita'
                : entry.origin,
          formaDePago: entry.formaDePago,
          estadoPago: entry.paymentStatus,
          montoPagado: num(entry.amountPaid),
        }
      : { registrado: false, nota: 'Sin ingreso en Flujo de Dinero (la cita no se ha completado ni pagado por link).' },
    linksDePago: links.length > 0 ? links : null,
    factura: entry
      ? facturaVerdict(entry, cfdisByEntry, satStatusByUuid)
      : { facturada: false as const, nota: 'Sin ingreso registrado — no hay nada que facturar todavía.' },
  };
}

async function billingStatusesFor(doctorId: string, bookings: BillingBooking[]) {
  const entries = bookings
    .map((b) => b.ledgerEntry)
    .filter((e): e is NonNullable<typeof e> => e !== null)
    .map((e) => ({ id: e.id, satCfdiUuid: e.satCfdiUuid }));
  const { cfdisByEntry, satStatusByUuid } = await fetchVerdictData(doctorId, entries);
  return bookings.map((b) => buildBillingStatus(b, cfdisByEntry, satStatusByUuid));
}

// -----------------------------------------------------------------------------
// Executors
// -----------------------------------------------------------------------------

async function getBillingStatus(
  ctx: ToolContext,
  input: { bookingId?: string; patientId?: string }
) {
  if (input.bookingId && typeof input.bookingId === 'string') {
    const booking = await prisma.booking.findFirst({
      where: { id: input.bookingId, doctorId: ctx.doctorId },
      select: BILLING_BOOKING_SELECT,
    });
    if (!booking) return { error: 'Cita no encontrada — usa un bookingId de las tools de lectura de ESTE turno.' };
    const [status] = await billingStatusesFor(ctx.doctorId, [booking]);
    return status;
  }
  if (input.patientId && typeof input.patientId === 'string') {
    const patient = await prisma.patient.findFirst({
      where: { id: input.patientId, doctorId: ctx.doctorId },
      select: { id: true, firstName: true, lastName: true },
    });
    if (!patient) return { error: 'Expediente no encontrado — usa un patientId de find_patient de ESTE turno.' };
    const [totalCitas, bookings] = await Promise.all([
      prisma.booking.count({ where: { patientId: patient.id, doctorId: ctx.doctorId } }),
      prisma.booking.findMany({
        where: { patientId: patient.id, doctorId: ctx.doctorId },
        select: BILLING_BOOKING_SELECT,
        orderBy: { createdAt: 'desc' },
        take: PATIENT_CITAS_CAP,
      }),
    ]);
    const statuses = await billingStatusesFor(ctx.doctorId, bookings);
    return {
      paciente: `${patient.firstName} ${patient.lastName}`.trim(),
      totalCitas,
      mostradas: statuses.length,
      ...(totalCitas > statuses.length
        ? { nota: `Solo las ${statuses.length} citas más recientes de ${totalCitas} — para una cita específica pásame su bookingId.` }
        : {}),
      citas: statuses,
    };
  }
  return { error: 'Pasa bookingId (una cita) o patientId (citas del paciente).' };
}

async function getPatientProfile(ctx: ToolContext, input: { patientId?: string }) {
  if (!input.patientId || typeof input.patientId !== 'string') {
    return { error: 'patientId requerido — sale de find_patient de ESTE turno.' };
  }
  const patient = await prisma.patient.findFirst({
    where: { id: input.patientId, doctorId: ctx.doctorId },
    select: { ...PATIENT_FISCAL_SELECT, createdAt: true },
  });
  if (!patient) return { error: 'Expediente no encontrado.' };
  const [citas, facturables] = await Promise.all([
    prisma.booking.count({ where: { patientId: patient.id, doctorId: ctx.doctorId } }),
    prisma.ledgerEntry.count({
      where: { doctorId: ctx.doctorId, patientId: patient.id, hasFactura: false, origin: { in: ['cita', 'webhook_pago'] } },
    }),
  ]);
  return {
    ...mapPatientFiscal(patient),
    contacto: { email: patient.email || null, telefono: patient.phone || null },
    expedienteCreado: mxDayOf(patient.createdAt),
    citasVinculadas: citas,
    ingresosSinFactura: facturables,
    nota: 'Solo datos de contacto y fiscales — el contenido clínico del expediente no está disponible para este asistente.',
  };
}

async function getFiscalProfileStatus(ctx: ToolContext) {
  const profile = await prisma.doctorFiscalProfile.findUnique({
    where: { doctorId: ctx.doctorId },
    select: {
      rfc: true,
      razonSocial: true,
      regimenFiscal: true,
      regimenFiscalDesc: true,
      csdUploaded: true,
      csdValidUntil: true,
      facturamaStatus: true,
      fielUploaded: true,
      autoSyncEnabled: true,
    },
  });
  if (!profile) {
    return {
      configurado: false,
      puedeTimbrar: false,
      motivo: 'El doctor no ha configurado su perfil fiscal (Dashboard → Facturación).',
    };
  }
  const csdVencido = !!profile.csdValidUntil && profile.csdValidUntil < new Date();
  const puedeTimbrar = profile.csdUploaded && profile.facturamaStatus === 'active' && !csdVencido;
  return {
    configurado: true,
    rfc: profile.rfc,
    razonSocial: profile.razonSocial,
    regimenFiscal: `${profile.regimenFiscal}${profile.regimenFiscalDesc ? ` (${profile.regimenFiscalDesc})` : ''}`,
    puedeTimbrar,
    ...(puedeTimbrar
      ? {}
      : {
          motivo: !profile.csdUploaded
            ? 'No ha subido su CSD (sello digital).'
            : csdVencido
              ? `Su CSD venció el ${mxDayOf(profile.csdValidUntil!)}.`
              : `Facturama no está activo (status: ${profile.facturamaStatus}).`,
        }),
    csdValidoHasta: profile.csdValidUntil ? mxDayOf(profile.csdValidUntil) : null,
    satDescargaConfigurado: profile.fielUploaded,
    nota: profile.fielUploaded
      ? 'Tiene SAT Descarga (e.Firma) — para "¿cuánto facturé?" usa get_sat_cfdis (fuente completa del RFC).'
      : 'Sin SAT Descarga — solo verás las facturas emitidas desde la plataforma (get_cfdis).',
  };
}

async function getCfdis(
  ctx: ToolContext,
  input: { startDate?: string; endDate?: string; status?: string; patientId?: string }
) {
  const profile = await prisma.doctorFiscalProfile.findUnique({
    where: { doctorId: ctx.doctorId },
    select: { id: true },
  });
  if (!profile) return { totalEncontradas: 0, facturas: [], nota: 'El doctor no tiene perfil fiscal — no ha emitido facturas desde la plataforma.' };

  const range = timestampRange(input.startDate, input.endDate);
  if ('error' in range) return range;

  const where: Record<string, unknown> = { fiscalProfileId: profile.id };
  if (input.status && typeof input.status === 'string') where.status = input.status;
  if (range.filter) where.issuedAt = range.filter;
  if (input.patientId && typeof input.patientId === 'string') {
    where.ledgerEntry = { patientId: input.patientId, doctorId: ctx.doctorId };
  }

  const [total, cfdis] = await Promise.all([
    prisma.cfdiEmitted.count({ where }),
    prisma.cfdiEmitted.findMany({
      where,
      orderBy: { issuedAt: 'desc' },
      take: LIST_CAP,
      select: {
        uuid: true, folio: true, cfdiType: true, rfcReceptor: true, nombreReceptor: true,
        total: true, status: true, metodoPago: true, issuedAt: true, ledgerEntryId: true,
      },
    }),
  ]);

  return {
    fuente: 'plataforma (Facturama) — si el doctor también emite fuera, usa get_sat_cfdis para el panorama completo',
    totalEncontradas: total,
    mostradas: cfdis.length,
    facturas: cfdis.map((c) => ({
      uuid: c.uuid,
      folio: c.folio,
      tipo: c.cfdiType,
      receptor: `${c.nombreReceptor} (${c.rfcReceptor})`,
      total: num(c.total),
      status: c.status,
      metodoPago: c.metodoPago,
      emitida: mxDayOf(c.issuedAt),
      ligadaAIngreso: c.ledgerEntryId != null,
    })),
  };
}

async function getSatCfdis(
  ctx: ToolContext,
  input: { direction?: string; startDate?: string; endDate?: string; counterpartyRfc?: string }
) {
  const direction = input.direction === 'received' ? 'received' : 'emitted';
  const isEmitted = direction === 'emitted';

  const range = timestampRange(input.startDate, input.endDate);
  if ('error' in range) return range;

  const where: Record<string, unknown> = { doctorId: ctx.doctorId, direction };
  if (range.filter) where.issuedAt = range.filter;
  if (input.counterpartyRfc && typeof input.counterpartyRfc === 'string') {
    const rfc = input.counterpartyRfc.trim().toUpperCase();
    // Counterparty side depends on direction: emitted → receiver, received → issuer.
    if (isEmitted) where.receiverRfc = rfc;
    else where.issuerRfc = rfc;
  }

  const [total, cfdis, vigentesSum, syncStatus] = await Promise.all([
    prisma.satCfdiMetadata.count({ where }),
    prisma.satCfdiMetadata.findMany({
      where,
      orderBy: { issuedAt: 'desc' },
      take: LIST_CAP,
      select: {
        uuid: true, efecto: true, satStatus: true, monto: true, issuedAt: true,
        issuerRfc: true, issuerName: true, receiverRfc: true, receiverName: true,
      },
    }),
    prisma.satCfdiMetadata.aggregate({
      where: { ...where, satStatus: 'Vigente', efecto: 'I' },
      _sum: { monto: true },
      _count: true,
    }),
    satFreshness(ctx.doctorId, direction),
  ]);

  return {
    fuente: 'SAT Descarga (todo el RFC del doctor, emitido dentro o fuera de la plataforma)',
    direccion: isEmitted ? 'emitidos (facturación del doctor)' : 'recibidos (gastos/deducciones del doctor)',
    frescura: syncStatus,
    totalEncontradas: total,
    mostradas: cfdis.length,
    // Direction decides the fiscal meaning: emitted I = the doctor's income;
    // received I = invoices OTHERS issued to the doctor (his expenses).
    resumenVigentes: {
      cantidad: vigentesSum._count,
      montoTotal: num(vigentesSum._sum.monto) ?? 0,
      nota: isEmitted
        ? 'Facturación del doctor: CFDIs Vigentes con efecto I del filtro actual.'
        : 'GASTOS del doctor: CFDIs Vigentes con efecto I que le emitieron (deducciones), del filtro actual.',
    },
    cfdis: cfdis.map((c) => ({
      uuid: c.uuid,
      efecto: c.efecto,
      satStatus: c.satStatus,
      monto: num(c.monto),
      emitida: mxDayOf(c.issuedAt),
      contraparte: isEmitted
        ? `${c.receiverName ?? '?'} (${c.receiverRfc})`
        : `${c.issuerName ?? '?'} (${c.issuerRfc})`,
    })),
  };
}

/** Data freshness for the SAT source: last completed metadata sync for the
 * direction + failed metadata jobs OF THAT DIRECTION in the last 3 days (the
 * July-2026 flakiness class). Other directions/types must not taint this one. */
async function satFreshness(doctorId: string, direction: string) {
  const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);
  const [lastCompleted, recentFailed] = await Promise.all([
    prisma.satSyncJob.findFirst({
      where: { doctorId, requestType: 'metadata', direction, status: 'completed' },
      orderBy: { completedAt: 'desc' },
      select: { completedAt: true, dateTo: true },
    }),
    prisma.satSyncJob.count({
      where: { doctorId, requestType: 'metadata', direction, status: 'failed', createdAt: { gte: threeDaysAgo } },
    }),
  ]);
  return {
    ultimoSyncExitoso: lastCompleted?.completedAt ? mxDayOf(lastCompleted.completedAt) : null,
    cubreHasta: lastCompleted?.dateTo ? utcDateToKey(lastCompleted.dateTo) : null,
    jobsFallidosUltimos3Dias: recentFailed,
    posiblementeDesactualizado:
      !lastCompleted ||
      recentFailed > 0 ||
      (lastCompleted.dateTo ? utcDateToKey(lastCompleted.dateTo) < mxTodayKey() : true),
  };
}

async function getPaymentLinks(
  ctx: ToolContext,
  input: { bookingId?: string; status?: string }
) {
  const whereBase: Record<string, unknown> = { doctorId: ctx.doctorId };
  if (input.bookingId && typeof input.bookingId === 'string') whereBase.bookingId = input.bookingId;
  if (input.status && typeof input.status === 'string') whereBase.status = input.status;

  const linkSelect = {
    ...LINK_SELECT,
    booking: { select: { patientName: true, date: true, startTime: true } },
  };
  const [stripeCount, mpCount, stripe, mp] = await Promise.all([
    prisma.paymentLink.count({ where: whereBase }),
    prisma.mpPaymentPreference.count({ where: whereBase }),
    prisma.paymentLink.findMany({ where: whereBase, orderBy: { createdAt: 'desc' }, take: LIST_CAP, select: linkSelect }),
    prisma.mpPaymentPreference.findMany({ where: whereBase, orderBy: { createdAt: 'desc' }, take: LIST_CAP, select: linkSelect }),
  ]);

  type LinkRow = (typeof stripe)[number];
  const merged: { proveedor: string; row: LinkRow }[] = [
    ...stripe.map((row) => ({ proveedor: 'Stripe', row })),
    ...mp.map((row) => ({ proveedor: 'Mercado Pago', row })),
  ]
    // Real timestamp sort (day-string sort shuffled same-day links across providers)
    .sort((a, b) => b.row.createdAt.getTime() - a.row.createdAt.getTime())
    .slice(0, LIST_CAP);

  const links = merged.map(({ proveedor, row: l }) => ({
    proveedor,
    estado: l.status,
    activo: l.isActive,
    monto: num(l.amount),
    descripcion: l.description ?? null,
    creado: mxDayOf(l.createdAt),
    pagadoEl: l.paidAt ? mxDayOf(l.paidAt) : null,
    cita: l.booking
      ? {
          bookingId: l.bookingId,
          paciente: l.booking.patientName,
          fecha: l.booking.date ? utcDateToKey(l.booking.date) : null,
          hora: l.booking.startTime ?? null,
        }
      : null,
    ligadoACita: l.bookingId != null,
  }));

  return {
    totalEncontrados: stripeCount + mpCount,
    mostrados: links.length,
    nota: 'Los links SIN cita ligada ("ligadoACita": false) generan ingresos huérfanos — el flujo recomendado es crearlos desde la cita (botón Cobro).',
    links,
  };
}

async function executeFacturasTool(
  ctx: ToolContext,
  name: string,
  input: Record<string, unknown>
): Promise<unknown> {
  switch (name) {
    case 'get_billing_status':
      return getBillingStatus(ctx, input as any);
    case 'get_patient_profile':
      return getPatientProfile(ctx, input as any);
    case 'get_fiscal_profile_status':
      return getFiscalProfileStatus(ctx);
    case 'get_cfdis':
      return getCfdis(ctx, input as any);
    case 'get_sat_cfdis':
      return getSatCfdis(ctx, input as any);
    case 'get_payment_links':
      return getPaymentLinks(ctx, input as any);
    default:
      return { error: `Tool desconocida: ${name}` };
  }
}

// -----------------------------------------------------------------------------
// Prompt sections
// -----------------------------------------------------------------------------

const FACTURAS_DOMAIN_MODEL = `## Cómo funcionan facturación y pagos (invariantes — razona SIEMPRE con este modelo)
- El **ingreso** (Flujo de Dinero) es el hub: una cita tiene a lo más UN ingreso, que nace al
  COMPLETAR la cita o al pagarse un LINK DE PAGO (webhook) — lo que ocurra primero; el sistema
  nunca lo duplica. "Pagada" ≠ "completada": un link pagado crea el ingreso aunque la cita siga
  agendada, y completar registra el ingreso aunque no haya pago electrónico. Para "¿ya me
  pagaron?" manda el estadoPago del INGRESO; los links son la evidencia de cómo se pagó.
- **"Facturada" la decide el servidor** (get_billing_status/get_cfdis) con una señal compuesta:
  factura de plataforma ACTIVA, o factura externa detectada vía SAT y no cancelada. NUNCA lo
  infieras tú — una factura cancelada sin re-emitir cuenta como NO facturada.
- Hay DOS fuentes de facturas: la plataforma (get_cfdis, solo lo emitido aquí) y el SAT
  (get_sat_cfdis, TODO el RFC — la fuente completa si el doctor emite fuera). Para "¿cuánto
  facturé?" usa la del SAT cuando esté configurada, y SIEMPRE di qué fuente usaste y su
  frescura. OJO: en el SAT, "emitidos" es la facturación del doctor; "recibidos" son sus GASTOS.
- Los **links de pago** requieren cita con expediente vinculado; una cita admite UN link
  pagado/activo (entre ambos proveedores). Un link suelto (sin cita) genera un ingreso huérfano.
- El expediente muestra una vista PARCIAL del dinero — tú ves el grafo completo con
  get_billing_status; si detectas algo que la página no muestra (p. ej. factura externa del
  SAT), acláraselo al doctor.`;

const FACTURAS_RULES = `## Facturación y pagos — reglas (por ahora SOLO CONSULTA)
- **Todavía NO puedes**: emitir ni cancelar facturas (CFDI), crear links de pago, ni enviar el
  formulario fiscal al paciente. Si el doctor lo pide: dile qué encontraste (estado, qué falta)
  y que la acción se hace desde la página correspondiente (facturas: tabla de citas o
  Facturación; links: botón Cobro de la cita).
- Para "¿cómo va la cita X?" (cobro/factura/expediente) usa **get_billing_status** — un solo
  golpe, no reconstruyas el diagnóstico con varias tools.
- La completitud de datos fiscales de un paciente la da el servidor (completitudFiscal +
  camposFaltantes + listoParaFacturar de get_patient_profile) — no cuentes campos tú. OJO:
  facturar desde el expediente exige datos completos Y requiereFactura activo
  (listoParaFacturar los combina). Si faltan datos y el doctor quiere facturar, el camino es
  el formulario fiscal (desde la cita, botón Facturación).
- Del expediente solo ves contacto y datos fiscales — el contenido clínico (notas, consultas,
  recetas) NO está a tu alcance; dilo honesto si te lo piden.
- No des consejos fiscales/legales (deducibilidad, régimen óptimo, IVA) — eso es del contador.
  Tú reportas datos del sistema.`;

// -----------------------------------------------------------------------------
// Module
// -----------------------------------------------------------------------------

export const facturasModule: AgentModule = {
  name: 'facturas',
  readTools: FACTURAS_TOOLS,
  proposalTools: [],
  executeRead: executeFacturasTool,
  // No proposal tools in F1 — the registry never routes here (proposalTools is
  // empty); null mirrors the registry's own unknown-proposal contract.
  executeProposal: async () => null,
  prompt: {
    domainModel: FACTURAS_DOMAIN_MODEL,
    domainRules: FACTURAS_RULES,
  },
};
