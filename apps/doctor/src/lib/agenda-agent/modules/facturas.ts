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
 * - PR F2b (2026-07-16) added the module's FIRST proposal: propose_create_cfdi
 *   (max-tier card — stamps a legal document at the SAT). Taxes are built
 *   server-side at proposal time (cfdi-builder.ts, regla E7); the receiver
 *   comes ONLY from the expediente; double emission is blocked HERE on
 *   hasFactura (the endpoint does not check it). A generic-RFC expediente
 *   (XAXX010101000) emits as Público en General with the UI's exact recipe
 *   (user decision 2026-07-16). Still out of scope: cancel CFDI (never-v1),
 *   manual incomes, payment links, fiscal form, email (F3).
 *   F2a (2026-07-15) added two more READ tools: search_catalogo_sat (grounded
 *   SAT-catalog recommendations via the authenticated apps/api route — needs
 *   ctx.apiToken) and get_pendientes_factura (per-patient sweep of unbilled
 *   consultation incomes — WHERE clause in strict parity with the
 *   ingresosSinFactura verdict below).
 */

import { prisma } from '@healthcare/database';
import type { AnthropicTool } from '../anthropic';
import { API_URL, type ToolContext } from '../tools';
import { utcDateToKey, mxTodayKey } from '../dates';
import { dateWhere } from './flujo';
import type { AgentModule } from './types';
import { CAP_ERROR, type ProposalContext } from '../proposals';
import {
  buildCfdiItems,
  LEDGER_FORMA_TO_SAT,
  SAT_PAYMENT_FORMS,
  type ConceptInput,
} from '../cfdi-builder';
import { SAT_FORMA_PAGO_LABELS } from '@/app/dashboard/practice/flujo-de-dinero/_components/ledger-types';

const LIST_CAP = 50;
const PATIENT_CITAS_CAP = 10; // billing status per patient — nested payloads must fit the 8KB tool-result cap
const PENDIENTES_CAP = 10; // sweep rows shown (totals stay real)
const CATALOGO_CAP = 10; // catalog matches shown per search
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
  {
    name: 'get_payment_provider_status',
    description:
      'Estado de conexión de las pasarelas de pago del doctor (Stripe y Mercado Pago): si están conectadas y habilitadas para cobrar. Úsala ANTES de hablar de links de pago si hay duda de que el doctor pueda cobrar en línea. OJO: es el estado CACHEADO en el sistema — el detalle vivo (requisitos pendientes, depósitos) está en la página Pagos.',
    input_schema: { type: 'object', properties: {} },
  },
  {
    name: 'get_guia',
    description:
      'Resumen CURADO de las guías del dashboard (las pestañas "Guía"): facturación (CFDI, REP, cancelación, retenciones), pagos en línea (Stripe/Mercado Pago, links, depósitos), SAT Descarga (sincronización, deducciones, declaraciones), o claves_y_reglas_cfdi (claves SAT médicas, uso de CFDI por régimen, IVA/retenciones, PUE/PPD — para armar bien una factura). Úsala cuando el doctor pregunte CÓMO FUNCIONA algo o CÓMO SE HACE en la plataforma — responde con el resumen y dirígelo a la pestaña correspondiente para el detalle completo.',
    input_schema: {
      type: 'object',
      properties: {
        tema: {
          type: 'string',
          enum: ['facturacion', 'pagos', 'sat_descarga', 'claves_y_reglas_cfdi'],
          description: 'Qué guía: facturacion (CFDI/REP/fiscal), pagos (Stripe/MP/links), sat_descarga (sync/deducciones/declaraciones) o claves_y_reglas_cfdi (cómo armar un CFDI: claves, usos, IVA, retenciones)',
        },
      },
      required: ['tema'],
    },
  },
  {
    name: 'search_catalogo_sat',
    description:
      'Busca en los CATÁLOGOS OFICIALES del SAT (vía Facturama): claves de producto/servicio (ClaveProdServ — "¿qué clave uso para insumos/quirófano/medicamentos?"), unidades (ClaveUnidad), usos de CFDI, regímenes fiscales y formas/métodos de pago. Devuelve resultados REALES del catálogo — recomienda SOLO entre esos resultados, NUNCA inventes ni completes una clave de memoria. Para "productos" y "unidades", "query" es obligatoria: la búsqueda es LITERAL y los acentos importan — usa UNA palabra específica en español ("cirugía", "quirófano", "laboratorio", "medicamentos"); si devuelve 0, reintenta con OTRA palabra (sinónimo/término más general) — MÁXIMO 2 reintentos: tras 3 búsquedas sin resultados, di honesto que no encontraste la clave y dirige a la búsqueda de la pestaña Nueva Factura. Para "uso-cfdi" puedes pasar el RFC del receptor como query (los usos válidos varían entre persona física y moral).',
    input_schema: {
      type: 'object',
      properties: {
        tipo: {
          type: 'string',
          enum: ['productos', 'unidades', 'uso-cfdi', 'regimenes-fiscales', 'formas-pago', 'metodos-pago'],
          description: 'Qué catálogo consultar',
        },
        query: {
          type: 'string',
          description: 'Palabra clave a buscar (obligatoria para productos/unidades; para uso-cfdi opcionalmente el RFC del receptor)',
        },
      },
      required: ['tipo'],
    },
  },
  {
    name: 'get_pendientes_factura',
    description:
      'BARRIDO "¿a quién le falta factura?": agrupa POR PACIENTE los ingresos de citas/pagos de cita que NO tienen factura (la misma señal hasFactura que mantiene el sistema), con monto total y el veredicto del servidor de si ya se le puede facturar (requiereFactura + listoParaFacturar + camposFaltantes). Úsala para "¿qué pacientes necesitan factura?", "¿qué me falta facturar?". DESEMPATES: facturas PPD ya emitidas sin complemento de pago = get_ppd_cobranza; ingresos que NO te han pagado = get_movimientos con estatusPago POR_COBRAR — esta tool es sobre ingresos YA registrados a los que les falta la FACTURA.',
    input_schema: {
      type: 'object',
      properties: {
        startDate: { type: 'string', description: 'Desde "YYYY-MM-DD" (opcional, por fecha del movimiento)' },
        endDate: { type: 'string', description: 'Hasta "YYYY-MM-DD" (opcional)' },
        soloListos: {
          type: 'boolean',
          description: 'true = solo pacientes LISTOS para facturar (datos fiscales completos Y requiereFactura activo)',
        },
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

// -----------------------------------------------------------------------------
// Provider connection status (cached flags — the live check hits Stripe's API
// and belongs to the Pagos page, not to an autonomous read tool)
// -----------------------------------------------------------------------------

async function getPaymentProviderStatus(ctx: ToolContext) {
  const doctor = await prisma.doctor.findUnique({
    where: { id: ctx.doctorId },
    select: {
      stripeAccountId: true,
      stripeOnboardingComplete: true,
      stripeChargesEnabled: true,
      stripePayoutsEnabled: true,
      mpConnected: true,
      mpTokenExpiresAt: true,
    },
  });
  if (!doctor) return { error: 'Doctor no encontrado.' };
  const mpExpira = doctor.mpTokenExpiresAt;
  const mpPorExpirar = !!mpExpira && mpExpira.getTime() - Date.now() < 30 * 24 * 60 * 60 * 1000;
  return {
    stripe: {
      conectado: !!doctor.stripeAccountId,
      onboardingCompleto: doctor.stripeOnboardingComplete ?? false,
      cobrosHabilitados: doctor.stripeChargesEnabled ?? false,
      depositosHabilitados: doctor.stripePayoutsEnabled ?? false,
    },
    mercadoPago: {
      conectado: doctor.mpConnected ?? false,
      tokenExpira: mpExpira ? mxDayOf(mpExpira) : null,
      tokenPorExpirar: mpPorExpirar,
      ...(mpPorExpirar ? { nota: 'El token de Mercado Pago expira en menos de 30 días — reconectar desde la página Pagos.' } : {}),
    },
    nota: 'Estado cacheado en el sistema — el estado vivo (requisitos pendientes de Stripe, último depósito) se consulta en Dashboard → Pagos.',
  };
}

// -----------------------------------------------------------------------------
// F2a: SAT catalog search — GROUNDED recommendations (the model recommends
// among REAL catalog rows, it never invents codes). Data lives behind the
// authenticated apps/api route (Facturama creds are api-side); ctx.apiToken is
// the per-turn Bearer minted from the doctor's session (api-token.ts).
// -----------------------------------------------------------------------------

const CATALOGO_TIPOS = [
  'productos',
  'unidades',
  'uso-cfdi',
  'regimenes-fiscales',
  'formas-pago',
  'metodos-pago',
] as const;

async function searchCatalogoSat(
  ctx: ToolContext,
  input: { tipo?: unknown; query?: unknown }
) {
  const tipo = typeof input.tipo === 'string' ? input.tipo : '';
  if (!(CATALOGO_TIPOS as readonly string[]).includes(tipo)) {
    return { error: `Tipo inválido — usa uno de: ${CATALOGO_TIPOS.join(', ')}.` };
  }
  const query = typeof input.query === 'string' ? input.query.trim() : '';
  if ((tipo === 'productos' || tipo === 'unidades') && !query) {
    return { error: 'Para productos/unidades se requiere "query" (palabra clave a buscar, p. ej. "material quirúrgico").' };
  }
  if (!ctx.apiToken) {
    return { error: 'Catálogo no disponible en este contexto (sin token de API) — dirige al doctor a la búsqueda de claves de la pestaña Nueva Factura.' };
  }

  let res: Response;
  try {
    res = await fetch(
      `${API_URL}/api/facturacion/catalogos/${tipo}${query ? `?q=${encodeURIComponent(query)}` : ''}`,
      {
        headers: { authorization: `Bearer ${ctx.apiToken}` },
        cache: 'no-store',
        signal: AbortSignal.timeout(8_000),
      }
    );
  } catch {
    return { error: 'No se pudo consultar el catálogo SAT (red/timeout) — reintenta, o usa la búsqueda de la pestaña Nueva Factura.' };
  }
  const body = (await res.json().catch(() => null)) as
    | { data?: unknown; _offline?: boolean; error?: string }
    | null;
  if (!res.ok || !body) {
    return { error: `Catálogo no disponible (HTTP ${res.status})${body?.error ? `: ${body.error}` : ''}.` };
  }

  // Lesson from the Facturama integration: catalogs can return ANY shape —
  // always Array.isArray before mapping.
  const raw = Array.isArray(body.data) ? body.data : [];
  const items = raw
    .filter((it): it is { Value?: unknown; Name?: unknown } => !!it && typeof it === 'object')
    .map((it) => ({ clave: String(it.Value ?? ''), descripcion: String(it.Name ?? '') }))
    .filter((it) => it.clave !== '');

  return {
    tipo,
    ...(query ? { busqueda: query } : {}),
    totalEncontrados: items.length,
    resultados: items.slice(0, CATALOGO_CAP),
    ...(items.length > CATALOGO_CAP
      ? { nota: `Mostrando ${CATALOGO_CAP} de ${items.length} — pide una palabra clave más específica si ninguna encaja.` }
      : {}),
    ...(items.length === 0 && query
      ? { sugerencia: 'Cero resultados: la búsqueda es literal (acentos incluidos) — reintenta con UNA palabra distinta (sinónimo/término más general, acento correcto). Máximo 2 reintentos; después dilo honesto y dirige a la pestaña Nueva Factura.' }
      : {}),
    fuente: body._offline
      ? 'catálogo OFFLINE de respaldo (Facturama no disponible — solo valores comunes, puede estar incompleto)'
      : 'catálogo oficial SAT (vía Facturama)',
    regla: 'Recomienda SOLO claves de estos resultados — el doctor decide. Si nada encaja, dilo honesto y dirige a la búsqueda de la pestaña Nueva Factura.',
  };
}

// -----------------------------------------------------------------------------
// F2a: pending-facturas sweep. PARITY RULE (audit A3: partial WHERE replicas
// are the dominant bug class): the base clause is EXACTLY the one behind
// get_patient_profile's `ingresosSinFactura` verdict — hasFactura:false +
// origin in (cita, webhook_pago) — ONE definition of "consulta sin factura".
// To harden it, change the source verdict first, never just this sweep.
// -----------------------------------------------------------------------------

async function getPendientesFactura(
  ctx: ToolContext,
  input: { startDate?: unknown; endDate?: unknown; soloListos?: unknown }
) {
  const hasStart = input.startDate !== undefined && input.startDate !== null && input.startDate !== '';
  const hasEnd = input.endDate !== undefined && input.endDate !== null && input.endDate !== '';
  const start = hasStart ? asDateKey(input.startDate) : undefined;
  const end = hasEnd ? asDateKey(input.endDate) : undefined;
  if ((hasStart && !start) || (hasEnd && !end)) {
    return { error: 'Fechas inválidas — usa el formato "YYYY-MM-DD".' };
  }

  const baseWhere = {
    doctorId: ctx.doctorId,
    hasFactura: false,
    origin: { in: ['cita', 'webhook_pago'] },
    // transactionDate is @db.Date (UTC-day convention) — dateWhere is flujo's
    // shared builder, ONE definition of the deployed ledger date boundaries.
    ...dateWhere(start ?? undefined, end ?? undefined),
  };

  const [grouped, sinExpediente] = await Promise.all([
    prisma.ledgerEntry.groupBy({
      by: ['patientId'],
      where: { ...baseWhere, patientId: { not: null } },
      _count: { _all: true },
      _sum: { amount: true },
    }),
    // Honesty count: same clause but WITHOUT expediente — these can't be
    // grouped by patient, but hiding them would understate the backlog.
    prisma.ledgerEntry.count({ where: { ...baseWhere, patientId: null } }),
  ]);

  const patientIds = grouped.map((g) => g.patientId).filter((id): id is string => !!id);
  const patients = patientIds.length
    ? await prisma.patient.findMany({
        // Tenancy defense-in-depth: entries are already doctor-scoped, but the
        // patient rows re-check doctorId like every other read here.
        where: { id: { in: patientIds }, doctorId: ctx.doctorId },
        select: PATIENT_FISCAL_SELECT,
      })
    : [];
  const byId = new Map(patients.map((p) => [p.id, p]));

  let rows = grouped.flatMap((g) => {
    const p = g.patientId ? byId.get(g.patientId) : undefined;
    if (!p) return [];
    const fc = fiscalCompleteness(p);
    return [{
      paciente: `${p.firstName} ${p.lastName}`.trim(),
      patientId: p.id,
      ingresosSinFactura: g._count._all,
      montoTotal: Math.round(Number(g._sum.amount ?? 0) * 100) / 100,
      requiereFactura: p.requiereFactura,
      listoParaFacturar: fc.listoParaFacturar,
      ...(fc.camposFaltantes.length ? { camposFaltantes: fc.camposFaltantes } : {}),
    }];
  });
  if (input.soloListos === true) rows = rows.filter((r) => r.listoParaFacturar);
  rows.sort((a, b) => b.montoTotal - a.montoTotal);

  return {
    periodo: start || end ? `${start ?? 'inicio'} a ${end ?? 'hoy'}` : 'todo el historial',
    ...(input.soloListos === true ? { filtro: 'solo pacientes listos para facturar' } : {}),
    totalPacientes: rows.length,
    totalIngresosSinFactura: rows.reduce((s, r) => s + r.ingresosSinFactura, 0),
    montoTotalSinFactura: Math.round(rows.reduce((s, r) => s + r.montoTotal, 0) * 100) / 100,
    pacientesQueRequierenFactura: rows.filter((r) => r.requiereFactura).length,
    ...(rows.length > PENDIENTES_CAP
      ? { nota: `Mostrando top ${PENDIENTES_CAP} por monto de ${rows.length} pacientes.` }
      : {}),
    pacientes: rows.slice(0, PENDIENTES_CAP),
    ...(sinExpediente > 0
      ? { ingresosSinExpediente: sinExpediente, notaSinExpediente: 'Ingresos de citas/pagos sin factura Y sin expediente vinculado — no se pueden agrupar por paciente; vincular el expediente desde la cita.' }
      : {}),
    alcance:
      'Solo ingresos nacidos de citas o pagos de cita (origins cita/webhook_pago) sin factura (señal hasFactura del sistema). Ingresos manuales o del SAT no entran. Facturas PPD emitidas sin complemento son OTRA pregunta (get_ppd_cobranza); ingresos sin PAGAR es otra más (get_movimientos POR_COBRAR).',
  };
}

// -----------------------------------------------------------------------------
// Guías — curated summaries of the dashboard "Guía" tabs, returned ON DEMAND
// (never in the prompt: the full guides are ~25k tokens; these are ~600-800
// tokens each and only cost when asked). Keep aligned with the guide tabs.
// -----------------------------------------------------------------------------

const GUIAS: Record<string, { resumen: string; pestana: string }> = {
  facturacion: {
    pestana: 'Dashboard → Facturación → pestaña Guía (12 secciones + preguntas frecuentes)',
    resumen: `GUÍA DE FACTURACIÓN (resumen — el detalle completo está en la pestaña):
1. CFDI 4.0 exige del receptor: RFC, nombre/razón social EXACTOS a su constancia, régimen fiscal, código postal fiscal y uso de CFDI.
2. Existen claves SAT específicas para servicios médicos (la plataforma las aplica al emitir).
3. Uso del CFDI: D01 (honorarios médicos — el más común, pacientes que deducen gastos médicos); G03 (gastos en general — empresas que pagan servicios médicos).
4. Para que la factura sea deducible al paciente (D01): pagos en efectivo MAYORES a $2,000 MXN no son deducibles — tarjeta o transferencia.
5. El régimen del doctor (612 vs RESICO 626) cambia retenciones e ISR — la plataforma lo maneja al emitir.
6. Forma de pago = CÓMO pagó (efectivo/tarjeta/transferencia); método = PUE (pagado ya) vs PPD (pago diferido).
7. Facturar a aseguradoras: normalmente exigen desglose y retenciones — sección propia en la guía.
8. REP (Recibo Electrónico de Pago): OBLIGATORIO cuando emites PPD y te pagan después — pestaña REP.
9. Cancelación de CFDIs: requiere motivo SAT y puede requerir aceptación del receptor; hay plazos.
10. Retenciones: personas MORALES te retienen ISR (y a veces IVA); honorarios médicos a personas físicas van típicamente exentos de IVA.
11. Errores comunes: RFC/nombre que no coinciden con la constancia, CP incorrecto, uso de CFDI equivocado.
12. CSD (sello digital): sin CSD activo no se puede timbrar — pestaña Configuración.`,
  },
  pagos: {
    pestana: 'Dashboard → Pagos → pestaña Guía (Stripe y Mercado Pago paso a paso)',
    resumen: `GUÍA DE PAGOS EN LÍNEA (resumen — el detalle completo está en la pestaña):
- Dos pasarelas: STRIPE (tarjetas, OXXO, Apple/Google Pay) y MERCADO PAGO (la más popular en México). Se conectan una vez desde la página Pagos (Stripe: crear cuenta Express y completar verificación; MP: autorizar con tu cuenta).
- Links de pago: se crean desde la CITA (botón Cobro — recomendado, queda ligado al expediente y al ingreso) y se comparten por WhatsApp o copiando el link. El paciente elige su método al abrirlo.
- Estados de un link: PENDIENTE (creado, sin pagar) → PAGADO (el ingreso se registra SOLO en Flujo de Dinero) · EXPIRADO · CANCELADO.
- Depósitos: cada pasarela deposita a tu cuenta bancaria en su propio calendario; el panel de Stripe Express y el panel de MP administran depósitos, reembolsos y disputas.
- Problemas de cuenta (restringida/deshabilitada): se resuelven en el panel del proveedor — la guía tiene la sección "Problemas con tu cuenta".
- Requisito de la plataforma: crear un link desde la cita exige que la cita tenga EXPEDIENTE vinculado.`,
  },
  sat_descarga: {
    pestana: 'Dashboard → SAT Descarga → pestañas Guía y Ayuda',
    resumen: `GUÍA DE SAT DESCARGA (resumen — el detalle completo está en la pestaña):
- Qué es: descarga DIRECTA del SAT (con tu e.Firma) de TODOS tus CFDIs — emitidos y recibidos, los hayas hecho en la plataforma o fuera.
- Cómo funciona: por cada mes se autentica con tu e.Firma, pide el listado (metadata), espera al SAT (segundos a 72h), y baja los XML con el desglose fiscal completo. Un worker lo procesa cada 15 min — no hay que dejar la página abierta. Botón "Sync mes actual" para forzar el mes en curso.
- Dos capas: METADATA (listado: UUID, emisor, monto, Vigente/Cancelado — la tabla principal) y XML (desglose: subtotal, IVA, ISR, conceptos, PUE/PPD).
- PUE vs PPD: PUE se paga al emitir; PPD se paga después y requiere COMPLEMENTO de pago (REP) — la pestaña PPD rastrea qué facturas siguen sin pagarse.
- Deducciones: tus CFDIs recibidos se clasifican por categoría automáticamente; banderas de deducibilidad (efectivo >$2,000, sin XML, etc.) — pestaña Deducciones.
- Declaraciones: agregados mensuales en base de efectivo + estimación de ISR/IVA según tu régimen (612 acumulativo / RESICO tasa fija) — pestaña Declaraciones.
- Régimen: en RESICO los gastos NO reducen ISR pero su IVA sí es acreditable; en 612 las deducciones sí reducen la base.`,
  },
  // Fuente: docs/DESDE JUNIO/AGENTES/AGENTE FACTURAS/06-KNOWLEDGE-BASE-facturacion.md §5
  // (verificado contra código y UNIFIED-FISCAL-REFERENCE 2026-07-15) — si cambian las
  // reglas ahí, actualizar aquí.
  claves_y_reglas_cfdi: {
    pestana: 'Dashboard → Facturación → Nueva Factura (búsqueda de claves al capturar conceptos) y pestaña Guía',
    resumen: `CLAVES Y REGLAS PARA ARMAR UN CFDI (resumen curado):
1. Claves de producto/servicio (ClaveProdServ) médicas: consulta médica general 85121502 · servicios médicos especializados 85121800 (el default de la plataforma) · psicología 85121608 · nutrición 85121609 · análisis clínicos/laboratorio 85141600 · material quirúrgico 42311500 · medicamentos 51101500-51251002 (unidad según presentación). Unidad para servicios: E48. Para otros conceptos, buscar en el catálogo (search_catalogo_sat).
2. Conceptos MIXTOS (p. ej. consulta + insumos + quirófano): cada concepto lleva su PROPIA clave y su propio tratamiento de IVA dentro de la misma factura.
3. Uso de CFDI — depende del RÉGIMEN DEL RECEPTOR: D01 (honorarios médicos, el común para pacientes que deducen) y el resto de D01-D10 NO son válidos si el receptor es RESICO 626 — el timbrado se RECHAZA; para receptor RESICO van G01/G03/I01-I08/S01. Público en General: siempre S01 + régimen 616 (la plataforma lo fuerza).
4. IVA: servicios médicos prestados por persona física con título (o sociedad civil) van EXENTOS (Art. 15-XIV LIVA — depende del PRESTADOR, no del cliente); procedimientos estéticos/cosméticos SIEMPRE 16%; medicamentos tasa 0%; otros insumos/productos normalmente 16%.
5. Retenciones (solo si el receptor es persona MORAL): ISR 10% (régimen 612) o 1.25% (RESICO 626); la PM además retiene 2/3 del IVA cuando la factura lleva IVA. Pacientes (personas físicas) NO retienen.
6. PUE vs PPD: PUE = pago ya recibido, con la forma de pago real; PPD = cobro diferido, forma de pago 99 obligatoria, y cada pago EXIGE complemento (REP) a más tardar el día 5 del mes siguiente al pago.
7. Deducible para el paciente (D01): pagos en efectivo MAYORES a $2,000 no son deducibles — tarjeta o transferencia.
8. Errores comunes de timbrado: código postal del receptor equivocado (causa #1), nombre no EXACTO a la constancia, RFC inactivo, PPD sin forma 99, uso de CFDI inválido para el régimen del receptor.`,
  },
};

function getGuia(input: { tema?: string }) {
  const tema = typeof input.tema === 'string' ? input.tema : '';
  const guia = GUIAS[tema];
  if (!guia) {
    return { error: 'Tema inválido — usa "facturacion", "pagos", "sat_descarga" o "claves_y_reglas_cfdi".' };
  }
  return {
    tema,
    resumen: guia.resumen,
    detalleCompleto: guia.pestana,
    nota: 'Este es un resumen curado — para pasos con capturas y la lista completa de secciones, dirige al doctor a la pestaña indicada.',
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
    case 'get_payment_provider_status':
      return getPaymentProviderStatus(ctx);
    case 'get_guia':
      return getGuia(input as { tema?: string });
    case 'search_catalogo_sat':
      return searchCatalogoSat(ctx, input as any);
    case 'get_pendientes_factura':
      return getPendientesFactura(ctx, input as any);
    default:
      return { error: `Tool desconocida: ${name}` };
  }
}

// -----------------------------------------------------------------------------
// PR F2b — propose_create_cfdi (max-tier proposal: stamps a legal document)
// -----------------------------------------------------------------------------

const FACTURAS_PROPOSAL_TOOLS: AnthropicTool[] = [
  {
    name: 'propose_create_cfdi',
    description:
      'PROPONE emitir una factura (CFDI de Ingreso) sobre un INGRESO existente — tier MÁXIMO: al confirmarse se TIMBRA ante el SAT un documento fiscal legal. El ledgerEntryId sale de get_billing_status de ESTE turno (nunca lo inventes). El receptor sale SOLO del expediente vinculado al ingreso (si faltan datos fiscales, el tool te dirá cuáles — el camino es el formulario fiscal desde la cita, no inventar datos). Por concepto tú aportas descripción, clave (de search_catalogo_sat o los defaults médicos), precio y los FLAGS withIva/withIsrRetention según las reglas del dominio — los IMPUESTOS los calcula el servidor, NUNCA tú. paymentForm: si el ingreso ya tiene forma de pago clara el tool la usa; si es ambigua te pedirá preguntarla. PPD SOLO si el doctor lo pidió explícito. Si el expediente trae el RFC genérico XAXX010101000, el tool emite a PÚBLICO EN GENERAL (S01/616, sin efectos fiscales — la card lo advierte). Si el ingreso nace de una cita sin completar, primero se completa la cita (propose_complete_booking) y la factura va en el turno SIGUIENTE.',
    input_schema: {
      type: 'object',
      properties: {
        ledgerEntryId: {
          type: 'number',
          description: 'ID del ingreso (de get_billing_status de ESTE turno)',
        },
        items: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              description: { type: 'string', description: 'Descripción del concepto (aparece en la factura)' },
              unitPrice: { type: 'number', description: 'Precio unitario SIN impuestos' },
              quantity: { type: 'number', description: 'Cantidad (default 1)' },
              productCode: { type: 'string', description: 'Clave SAT del producto/servicio (de search_catalogo_sat o los defaults médicos; default 85121800)' },
              unitCode: { type: 'string', description: 'Clave de unidad SAT (default E48 para servicios)' },
              withIva: { type: 'boolean', description: 'true si el concepto lleva IVA 16% (consulta médica de PF con título: false — exenta; estético/insumos: true)' },
              withIsrRetention: { type: 'boolean', description: 'true SOLO si el receptor es persona MORAL que retiene ISR (pacientes persona física: false)' },
            },
            required: ['description', 'unitPrice', 'withIva', 'withIsrRetention'],
          },
          description: 'Conceptos de la factura (cada uno con su clave y sus flags de impuestos)',
        },
        paymentForm: {
          type: 'string',
          enum: [...SAT_PAYMENT_FORMS],
          description: 'Forma de pago SAT (01 efectivo, 02 cheque, 03 transferencia, 04 tarjeta crédito, 28 tarjeta débito, 99 por definir) — omítela para usar la del ingreso; si es ambigua el tool te pedirá preguntarla',
        },
        paymentMethod: {
          type: 'string',
          enum: ['PUE', 'PPD'],
          description: 'PUE (pago ya recibido — default) o PPD (diferido, SOLO si el doctor lo pidió explícito; fuerza forma 99 y exigirá complementos de pago)',
        },
        observations: { type: 'string', description: 'Observaciones (opcional — solo aparecen en el PDF, sin efecto fiscal)' },
      },
      required: ['ledgerEntryId', 'items'],
    },
  },
];

/** D5-parallel fixed warning for the max tier (the panel renders 🧾 in red). */
const CFDI_WARNING =
  '🧾 Esto TIMBRA un CFDI ante el SAT — un documento fiscal LEGAL a nombre del receptor. Cancelarlo después es un trámite ante el SAT (y este asistente no cancela CFDIs).';

const CFDI_ITEMS_CAP = 10;

function asPositiveNumber(v: unknown): number | null {
  const n = typeof v === 'number' ? v : typeof v === 'string' ? Number(v) : NaN;
  return Number.isFinite(n) && n > 0 ? n : null;
}

async function proposeCreateCfdi(
  ctx: ProposalContext,
  input: {
    ledgerEntryId?: unknown;
    items?: unknown;
    paymentForm?: unknown;
    paymentMethod?: unknown;
    observations?: unknown;
  }
) {
  // --- 1. Emitter gate: fiscal profile + active CSD (mirror of the endpoint,
  //        checked here so the doctor never confirms a card doomed to 400) ---
  const profile = await prisma.doctorFiscalProfile.findUnique({
    where: { doctorId: ctx.doctorId },
    select: { csdUploaded: true, facturamaStatus: true, regimenFiscal: true, codigoPostal: true },
  });
  if (!profile) {
    return { error: 'El doctor no tiene perfil fiscal configurado — la emisión se habilita en Dashboard → Facturación (pestaña Configuración). No propongas nada.' };
  }
  if (!profile.csdUploaded || profile.facturamaStatus !== 'active') {
    return { error: 'Los certificados CSD del doctor no están activos — sin CSD activo no se puede timbrar. El camino es Dashboard → Facturación → Configuración. No propongas nada.' };
  }

  // --- 2. The income: doctor's, ingreso, cita-born, not already invoiced ---
  const entryId = asPositiveNumber(input.ledgerEntryId);
  if (!entryId || !Number.isInteger(entryId)) {
    return { error: 'ledgerEntryId inválido — usa el ledgerEntryId que devuelve get_billing_status en ESTE turno.' };
  }
  const entry = await prisma.ledgerEntry.findFirst({
    where: { id: entryId, doctorId: ctx.doctorId },
    select: {
      id: true, amount: true, entryType: true, origin: true, hasFactura: true,
      patientId: true, formaDePago: true, concept: true,
    },
  });
  if (!entry) {
    return { error: 'Ningún ingreso con ese id pertenece a este doctor — usa el ledgerEntryId de get_billing_status de ESTE turno, nunca lo inventes.' };
  }
  if (entry.entryType !== 'ingreso') {
    return { error: 'Ese movimiento no es un ingreso — solo se facturan ingresos.' };
  }
  if (entry.origin !== 'cita' && entry.origin !== 'webhook_pago') {
    return { error: `Ese ingreso es de origen "${entry.origin ?? 'manual'}" — por ahora solo propongo facturas de ingresos nacidos de citas o de links de pago (los demás se facturan desde la pestaña Nueva Factura).` };
  }
  if (entry.hasFactura) {
    return { error: 'Ese ingreso YA está facturado (hasFactura) — no se emite dos veces. Si el doctor cree que no (p. ej. una factura cancelada), el detalle está en get_billing_status y la re-emisión se hace desde la página de Facturación.' };
  }

  // --- 3. Receiver: ONLY the linked expediente (00 §6 — never free text) ---
  if (!entry.patientId) {
    return { error: 'El ingreso no tiene expediente vinculado — sin expediente no hay datos fiscales del receptor. El camino: vincular el expediente desde la cita y reintentar.' };
  }
  const patient = await prisma.patient.findFirst({
    where: { id: entry.patientId, doctorId: ctx.doctorId },
    select: PATIENT_FISCAL_SELECT,
  });
  if (!patient) {
    return { error: 'El expediente vinculado al ingreso no existe o no es de este doctor.' };
  }
  const nombre = `${patient.firstName} ${patient.lastName}`.trim();
  // Público en General (decisión del usuario 2026-07-16, revirtiendo el "no
  // PG" inicial de 08-PLAN §9.1): cuando el EXPEDIENTE trae el RFC genérico,
  // se emite como PG con la MISMA receta de la UI (page.tsx:1471 — nombre
  // 'PUBLICO EN GENERAL', S01, 616; TaxZipCode = CP del EMISOR, como el server
  // lo fuerza de todos modos). Se decide ANTES del gate de completitud (review
  // F2b hallazgo #2): PG sobreescribe nombre/uso/régimen/CP, así que al
  // expediente genérico solo se le exige el RFC — pedirle los 5 campos era
  // bloquear emisiones válidas.
  const esPublicoGeneral = !!patient.rfc && patient.rfc.trim().toUpperCase() === 'XAXX010101000';
  const fc = fiscalCompleteness(patient);
  if (!esPublicoGeneral && fc.completitudFiscal !== 'completo') {
    return {
      error: `Los datos fiscales de ${nombre} están incompletos — faltan: ${fc.camposFaltantes.join(', ')}. Sin receptor completo no se puede timbrar. El camino es el formulario fiscal al paciente (desde la cita, botón Facturación) — NUNCA inventes ni pidas dictar estos datos en el chat.`,
      camposFaltantes: fc.camposFaltantes,
    };
  }

  // --- 4. Concepts → server-built taxes (E7) ---
  if (!Array.isArray(input.items) || input.items.length === 0) {
    return { error: 'Se requiere al menos un concepto (items).' };
  }
  if (input.items.length > CFDI_ITEMS_CAP) {
    return { error: `Máximo ${CFDI_ITEMS_CAP} conceptos por factura.` };
  }
  const concepts: ConceptInput[] = [];
  for (const [i, raw] of (input.items as unknown[]).entries()) {
    const it = (raw ?? {}) as Record<string, unknown>;
    const description = typeof it.description === 'string' ? it.description.trim() : '';
    const unitPrice = asPositiveNumber(it.unitPrice);
    const quantity = it.quantity === undefined ? 1 : asPositiveNumber(it.quantity);
    if (!description) return { error: `Concepto ${i + 1}: falta la descripción.` };
    if (!unitPrice) return { error: `Concepto ${i + 1}: unitPrice debe ser un número > 0 (SIN impuestos).` };
    if (!quantity) return { error: `Concepto ${i + 1}: quantity debe ser un número > 0.` };
    if (typeof it.withIva !== 'boolean' || typeof it.withIsrRetention !== 'boolean') {
      return { error: `Concepto ${i + 1}: withIva y withIsrRetention son obligatorios y booleanos — decídelos con las reglas del dominio (consulta médica exenta; estético/insumos con IVA; PF no retiene).` };
    }
    concepts.push({
      description,
      unitPrice,
      quantity,
      productCode: typeof it.productCode === 'string' && it.productCode.trim() ? it.productCode.trim() : '85121800',
      unitCode: typeof it.unitCode === 'string' && it.unitCode.trim() ? it.unitCode.trim() : 'E48',
      withIva: it.withIva,
      withIsrRetention: it.withIsrRetention,
    });
  }
  const { items, totals } = buildCfdiItems(concepts, profile.regimenFiscal);

  // --- 5. Payment method/form ---
  const paymentMethod = input.paymentMethod === 'PPD' ? 'PPD' : 'PUE';
  let paymentForm: string;
  if (paymentMethod === 'PPD') {
    paymentForm = '99'; // SAT rule: PPD always "por definir"
  } else if (typeof input.paymentForm === 'string' && (SAT_PAYMENT_FORMS as readonly string[]).includes(input.paymentForm)) {
    paymentForm = input.paymentForm;
  } else if (input.paymentForm !== undefined) {
    return { error: `paymentForm inválida — usa una de: ${SAT_PAYMENT_FORMS.join(', ')}.` };
  } else {
    const mapped = entry.formaDePago ? LEDGER_FORMA_TO_SAT[entry.formaDePago] : null;
    if (!mapped) {
      return {
        error: `La forma de pago del ingreso (${entry.formaDePago ?? 'sin registrar'}) no mapea sola a un código SAT — pregunta al doctor cómo pagó el paciente y repite con paymentForm (01 efectivo, 03 transferencia, 04 tarjeta de crédito, 28 tarjeta de débito, 02 cheque).`,
        formaDePagoDelIngreso: entry.formaDePago ?? null,
      };
    }
    paymentForm = mapped;
  }

  // --- 6. The card ---
  const advertencias: string[] = [CFDI_WARNING];
  if (esPublicoGeneral) {
    advertencias.push(
      'El expediente trae el RFC genérico XAXX010101000 — se emite a PÚBLICO EN GENERAL (uso S01 "sin efectos fiscales", régimen 616): el paciente NO podrá deducirla. Si el paciente tiene RFC propio, mejor actualizarlo con el formulario fiscal antes de emitir.'
    );
  }
  if (paymentMethod === 'PPD') {
    advertencias.push('PPD: la factura queda como pago DIFERIDO (forma 99) — cada pago exigirá un COMPLEMENTO (REP) a más tardar el día 5 del mes siguiente. Este asistente no emite complementos.');
  }
  const montoIngreso = Number(entry.amount);
  if (Math.abs(totals.total - montoIngreso) > 0.01) {
    advertencias.push(`El total de la factura ($${totals.total}) NO coincide con el ingreso registrado ($${montoIngreso}) — confirma con el doctor que es intencional.`);
  }
  if (!patient.requiereFactura) {
    advertencias.push('El expediente NO tiene marcada "requiere factura" — se emite porque el doctor lo pidió explícitamente.');
  }

  const conceptLines = items.map((it) => {
    const ivaTax = it.taxes.find((t) => t.Name === 'IVA');
    const isrTax = it.taxes.find((t) => t.Name === 'ISR');
    const partes = [`$${it.subtotal}`];
    if (ivaTax) partes.push(`+ IVA $${ivaTax.Total}`);
    if (isrTax) partes.push(`− ret. ISR $${isrTax.Total}`);
    return `${it.description} · clave ${it.productCode} (${it.unitCode}) ×${it.quantity} · ${partes.join(' ')} = $${it.total}`;
  });

  const observations =
    typeof input.observations === 'string' && input.observations.trim() ? input.observations.trim() : undefined;

  const proposal = ctx.collector.add({
    type: 'create_cfdi',
    titulo: `Emitir CFDI $${totals.total} · ${esPublicoGeneral ? 'PÚBLICO EN GENERAL' : nombre}`,
    detalle: [
      esPublicoGeneral
        ? `Receptor: PUBLICO EN GENERAL · RFC XAXX010101000 · uso S01 · régimen 616 (expediente: ${nombre})`
        : `Receptor: ${patient.razonSocial} · RFC ${patient.rfc} · uso ${patient.usoCfdi} · régimen ${patient.regimenFiscal} · CP ${patient.codigoPostalFiscal}`,
      ...conceptLines,
      `Total: $${totals.subtotal} + IVA $${totals.iva} − ret. ISR $${totals.retencionIsr} = $${totals.total} MXN`,
      `Pago: ${paymentMethod} · forma ${paymentForm} (${SAT_FORMA_PAGO_LABELS[paymentForm] ?? paymentForm})`,
      `Folio automático · queda ligado al ingreso #${entry.id} ("${entry.concept}")`,
      ...(observations ? [`Observaciones (solo PDF): ${observations}`] : []),
    ],
    advertencias,
    params: {
      // PG mirrors the UI recipe exactly (page.tsx:1471); the endpoint
      // additionally swaps TaxZipCode for the emitter's CP and appends
      // GlobalInformation (cfdi/route.ts:175,205). Emitter CP here because the
      // expediente's CP may be empty (PG skips the completeness gate).
      receiver: esPublicoGeneral
        ? {
            rfc: 'XAXX010101000',
            name: 'PUBLICO EN GENERAL',
            cfdiUse: 'S01',
            fiscalRegime: '616',
            taxZipCode: profile.codigoPostal,
          }
        : {
            rfc: patient.rfc,
            name: patient.razonSocial,
            cfdiUse: patient.usoCfdi,
            fiscalRegime: patient.regimenFiscal,
            taxZipCode: patient.codigoPostalFiscal,
          },
      items,
      cfdiType: 'I',
      paymentForm,
      paymentMethod,
      ledgerEntryId: entry.id,
      ...(observations ? { observations } : {}),
    },
  });
  if (!proposal) return { error: CAP_ERROR };

  return {
    propuestaId: proposal.id,
    orden: proposal.orden,
    receptor: esPublicoGeneral ? `PÚBLICO EN GENERAL — S01, sin efectos fiscales (expediente: ${nombre})` : `${nombre} (${patient.rfc})`,
    totales: totals,
    pago: `${paymentMethod} · ${paymentForm}`,
    nota: 'Propuesta registrada — RECUERDA al doctor que al confirmar se timbra un documento fiscal LEGAL ante el SAT. Usa EXACTAMENTE los totales de "totales" al narrar, no los recalcules.',
  };
}

async function executeFacturasProposal(
  ctx: ProposalContext,
  name: string,
  input: Record<string, unknown>
): Promise<unknown> {
  if (name === 'propose_create_cfdi') return proposeCreateCfdi(ctx, input);
  return null;
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

const FACTURAS_RULES = `## Facturación y pagos — reglas
- **EMITIR una factura (propose_create_cfdi) SÍ está a tu alcance** — es la acción de MÁXIMO
  tier: al confirmarse la card se timbra un documento fiscal LEGAL ante el SAT. Reglas duras:
  (1) SOLO cuando el doctor lo pidió explícitamente en ESTE hilo — nunca la propongas
  espontáneamente; (2) SIEMPRE verifica primero el ingreso con get_billing_status en ESTE
  turno (de ahí sale el ledgerEntryId — nunca lo inventes); (3) el receptor sale SOLO del
  expediente — si faltan datos fiscales NO se emite (el camino es el formulario fiscal desde
  la cita), jamás pidas dictar RFC/datos en el chat; (4) los impuestos los calcula el
  servidor con tus flags withIva/withIsrRetention — narra los totales que el tool te devuelve,
  NUNCA los recalcules tú; (5) PPD solo si el doctor lo pidió explícito; (6) si la cita no
  está completada, primero se completa (propose_complete_booking) y la factura va en el turno
  SIGUIENTE (el ingreso debe existir antes de proponer).
- **Sigues SIN poder**: cancelar facturas (CFDI) o emitir complementos de pago (se hacen desde
  Facturación), facturar ingresos manuales (pestaña Nueva Factura), crear links de pago
  (botón Cobro de la cita), ni enviar el formulario fiscal al paciente. Si el doctor lo pide:
  dile qué encontraste y el camino correcto en la plataforma. Público en General: solo cuando
  el EXPEDIENTE trae el RFC genérico (la card lo advierte — S01, el paciente no deduce).
- Para "¿cómo va la cita X?" (cobro/factura/expediente) usa **get_billing_status** — un solo
  golpe, no reconstruyas el diagnóstico con varias tools.
- La completitud de datos fiscales de un paciente la da el servidor (completitudFiscal +
  camposFaltantes + listoParaFacturar de get_patient_profile) — no cuentes campos tú. OJO:
  facturar desde el expediente exige datos completos Y requiereFactura activo
  (listoParaFacturar los combina). Si faltan datos y el doctor quiere facturar, el camino es
  el formulario fiscal (desde la cita, botón Facturación).
- Del expediente solo ves contacto y datos fiscales — el contenido clínico (notas, consultas,
  recetas) NO está a tu alcance; dilo honesto si te lo piden.
- **Claves SAT de los conceptos:** defaults médicos — consulta general 85121502, servicios
  médicos especializados 85121800 (el default de la plataforma), unidad E48. Medicamentos e
  insumos/material llevan SU PROPIA clave: búscala con search_catalogo_sat. Si el doctor pide
  algo GENÉRICO ("insumos", "material quirúrgico") y el catálogo no da un match limpio, ofrece
  el default 42311500 (material quirúrgico) y ofrece afinar buscando el insumo concreto (la
  búsqueda es literal: mejor "gasas" o "suturas" que "insumos"). Una factura puede mezclar
  conceptos (consulta + insumos + quirófano) y
  cada uno lleva su clave y su tratamiento de IVA. NUNCA cites una clave que no venga del
  catálogo o de estos defaults.
- **Reglas CFDI clave** (detalle: get_guia tema claves_y_reglas_cfdi): el uso de CFDI depende
  del RÉGIMEN DEL RECEPTOR — D01 (honorarios médicos) NO es válido si el receptor es RESICO
  626, el timbrado se rechaza (para RESICO: G01/G03/I0x/S01). IVA: servicios médicos de
  persona física con título van EXENTOS (no depende del cliente); estéticos SIEMPRE 16%;
  medicamentos tasa 0%. Retención ISR solo con receptor persona MORAL (10% en 612 · 1.25% en
  RESICO). Método: PUE = ya cobrado (lo normal); PPD = diferido, forma 99 y EXIGE complemento
  (REP) por cada pago — no lo sugieras salvo que el doctor lo pida.
- **"¿A quién le falta factura?"** → get_pendientes_factura (ingresos de citas sin factura,
  por paciente). OJO, "¿quién me debe?" tiene TRES lecturas distintas: dinero sin pagar
  (get_movimientos POR_COBRAR), facturas PPD sin complemento (get_ppd_cobranza) y consultas
  sin facturar (get_pendientes_factura) — si la pregunta es ambigua, da UNA cifra con su
  fuente y nombra las otras lecturas.
- No des consejos fiscales/legales (deducibilidad, régimen óptimo, qué régimen conviene) —
  eso es del contador. Tú reportas datos del sistema y las reglas de operación de arriba.`;

// -----------------------------------------------------------------------------
// Module
// -----------------------------------------------------------------------------

export const facturasModule: AgentModule = {
  name: 'facturas',
  readTools: FACTURAS_TOOLS,
  proposalTools: FACTURAS_PROPOSAL_TOOLS,
  executeRead: executeFacturasTool,
  executeProposal: executeFacturasProposal,
  prompt: {
    domainModel: FACTURAS_DOMAIN_MODEL,
    domainRules: FACTURAS_RULES,
  },
};
