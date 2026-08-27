'use client';

import { useCallback, useEffect, useState } from 'react';
import { ArrowLeft, Edit, Plus, FileText, User, Clock, Image, Pill, Loader2, Trash2, NotebookPen, CalendarDays, ClipboardList, DollarSign, Receipt, AlertCircle, CheckCircle, Sparkles, RefreshCw } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { EncounterCard } from '@/components/medical-records/EncounterCard';
import { PatientSummaryModal } from '@/components/medical-records/PatientSummaryModal';
import { formatSex } from '@/components/medical-records/patient-display';
import { usePatientProfile } from '../_components/usePatientProfile';
import { authFetch } from '@/lib/auth-fetch';
import { toast } from '@/lib/practice-toast';

interface RecentNote {
  id: string;
  content: string;
  updatedAt: string;
}

interface PatientFormulario {
  id: string;
  templateName: string | null;
  submittedAt: string;
  appointmentDate: string | null;
  appointmentTime: string | null;
}

interface BookingCfdi {
  id: number;
  uuid: string;
  folio: string | null;
  status: string;
  total: number;
  rfcReceptor: string;
  nombreReceptor: string;
  usoCfdi: string;
  formaPago: string;
  issuedAt: string;
}

interface BookingPaymentLink {
  url: string;
  status: string;
  isActive: boolean;
  paidAt: string | null;
  amount: number;
}

interface PatientBooking {
  id: string;
  date: string | null;
  startTime: string | null;
  endTime: string | null;
  serviceName: string | null;
  status: string;
  appointmentMode: string | null;
  finalPrice: number | null;
  /** Notas escritas al AGENDAR la cita. Puede venir "" — tratar como vacío. */
  notes?: string | null;
  formLinkId?: string | null;
  /** Casilla "¿Necesita factura?" de la tabla de citas. Pregunta por CITA —
   *  distinta de `patient.requiereFactura`, que es del expediente. */
  facturaSolicitada?: boolean | null;
  // Financial
  ledgerEntryId: number | null;
  amount: number | null;
  formaDePago: string | null;
  /** Del INGRESO: 'PENDING' | 'PARTIAL' | 'PAID'. null = no hay ingreso todavía. */
  paymentStatus?: string | null;
  amountPaid?: number | null;
  /** VEREDICTO de cobro del servidor (ingreso + links juntos) y su método ya legible. */
  estadoPago?: 'PAGADO' | 'PARCIAL' | 'PENDIENTE' | 'SIN_REGISTRO';
  metodoPago?: string | null;
  /** VEREDICTO del servidor (resolveFacturaVerdict) — no se re-deriva aquí. */
  facturada?: boolean;
  facturadaVia?: 'plataforma' | 'subida' | 'externa_sat' | null;
  cfdi: BookingCfdi | null;
  // Payment links (linked cobro)
  stripeLink?: BookingPaymentLink | null;
  mpLink?: BookingPaymentLink | null;
}

interface PatientSummaryData {
  id: string;
  content: string;
  dataPoints: { encounters: number; prescriptions: number; notes: number };
  createdAt: string;
}

const API_URL = process.env.NEXT_PUBLIC_API_URL || '';

// (Las etiquetas de forma de pago se fueron al servidor: la ruta manda
// `metodoPago` ya legible, resuelto junto con el veredicto de cobro.)

function BookingStatusPill({ status }: { status: string }) {
  const map: Record<string, string> = {
    CONFIRMED:  'bg-blue-100 text-blue-700',
    PENDING:    'bg-yellow-100 text-yellow-700',
    COMPLETED:  'bg-green-100 text-green-700',
    CANCELLED:  'bg-red-100 text-red-700',
    NO_SHOW:    'bg-orange-100 text-orange-700',
  };
  const label: Record<string, string> = {
    CONFIRMED: 'Agendada',
    PENDING:   'Pendiente',
    COMPLETED: 'Completada',
    CANCELLED: 'Cancelada',
    NO_SHOW:   'No asistió',
  };
  return (
    <span className={`text-xs px-2 py-0.5 rounded ${map[status] ?? 'bg-gray-100 text-gray-600'}`}>
      {label[status] ?? status}
    </span>
  );
}

/** ¿Ya se cobró? El veredicto —y el método— los resuelve el SERVIDOR mirando el
 *  ingreso Y los links juntos (`estadoPago`/`metodoPago` en la ruta de bookings).
 *  Aquí solo se pinta: dos componentes leyendo mitades distintas es lo que hacía
 *  que una misma tarjeta dijera "Por cobrar" y "Pagado" a la vez.
 *
 *  Siempre pinta algo (los cuatro estados tienen chip), a diferencia de la
 *  versión anterior, que se callaba cuando no había ingreso. */
function PagoBadge({
  estadoPago, metodoPago,
}: { estadoPago: 'PAGADO' | 'PARCIAL' | 'PENDIENTE' | 'SIN_REGISTRO'; metodoPago: string | null }) {
  // Gris y neutro: no afirma una deuda, dice que no hay registro. Es el estado de
  // las 49 citas anteriores a que completar creara el ingreso (may–jun 2026).
  if (estadoPago === 'SIN_REGISTRO') {
    return <span className="text-[11px] px-1.5 py-0.5 rounded bg-gray-100 text-gray-600">Sin cobro registrado</span>;
  }
  if (estadoPago === 'PENDIENTE') {
    return <span className="text-[11px] px-1.5 py-0.5 rounded bg-amber-100 text-amber-800">Por cobrar</span>;
  }
  if (estadoPago === 'PARCIAL') {
    return (
      <span className="text-[11px] px-1.5 py-0.5 rounded bg-amber-100 text-amber-800">
        Pago parcial{metodoPago ? ` · ${metodoPago}` : ''}
      </span>
    );
  }
  return (
    <span className="text-[11px] px-1.5 py-0.5 rounded bg-green-100 text-green-700">
      Pagado{metodoPago ? ` · ${metodoPago}` : ''}
    </span>
  );
}

/** Dos hechos INDEPENDIENTES en un solo chip, por orden de importancia: ya está
 *  facturada (veredicto del servidor) gana sobre la petición. Si la pidieron y no
 *  está, ese es el pendiente que hay que ver. */
function FacturaBadge({ facturada, solicitada }: { facturada: boolean; solicitada: boolean }) {
  if (facturada) {
    return <span className="text-[11px] px-1.5 py-0.5 rounded bg-teal-100 text-teal-800">Facturado</span>;
  }
  if (solicitada) {
    return <span className="text-[11px] px-1.5 py-0.5 rounded bg-orange-100 text-orange-800">Necesita factura</span>;
  }
  return null;
}

function parseNoteTitle(content: string): string {
  const first = content.split('\n').map((l) => l.trim()).find((l) => l !== '');
  return first || 'Nota vacía';
}

function formatCurrency(n: number) {
  return new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(n);
}

// SAT catalogs for the fiscal edit modal
const REGIMENES_FISCALES = [
  { value: '601', label: '601 - General de Ley PM' },
  { value: '603', label: '603 - PM sin Fines Lucrativos' },
  { value: '605', label: '605 - Sueldos y Salarios' },
  { value: '606', label: '606 - Arrendamiento' },
  { value: '608', label: '608 - Demás ingresos' },
  { value: '612', label: '612 - Actividades Empresariales y Profesionales' },
  { value: '616', label: '616 - Sin obligaciones fiscales' },
  { value: '621', label: '621 - Incorporación Fiscal' },
  { value: '625', label: '625 - Plataformas Tecnológicas' },
  { value: '626', label: '626 - RESICO' },
];

const USOS_CFDI = [
  { value: 'D01', label: 'D01 - Honorarios médicos' },
  { value: 'D02', label: 'D02 - Gastos médicos por incapacidad' },
  { value: 'G03', label: 'G03 - Gastos en general' },
  { value: 'S01', label: 'S01 - Sin efectos fiscales' },
];

const REGIMEN_USO_VALID: Record<string, string[]> = {
  '601': ['G03', 'S01'],
  '603': ['G03', 'S01'],
  '605': ['D01', 'D02', 'S01'],
  '606': ['D01', 'D02', 'G03', 'S01'],
  '608': ['D01', 'D02', 'G03', 'S01'],
  '612': ['D01', 'D02', 'G03', 'S01'],
  '616': ['S01'],
  '621': ['D01', 'D02', 'G03', 'S01'],
  '625': ['D01', 'D02', 'G03', 'S01'],
  '626': ['G03', 'S01'],
};

interface DatosFiscalesCardProps {
  patient: import('../_components/patient-types').Patient;
  patientId: string;
  onUpdate: () => void;
}

function DatosFiscalesCard({ patient, patientId, onUpdate }: DatosFiscalesCardProps) {
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    rfc: patient.rfc || '',
    razonSocial: patient.razonSocial || '',
    regimenFiscal: patient.regimenFiscal || '',
    usoCfdi: patient.usoCfdi || '',
    codigoPostalFiscal: patient.codigoPostalFiscal || '',
  });

  const validUsos = form.regimenFiscal ? REGIMEN_USO_VALID[form.regimenFiscal] : null;
  const filteredUsos = validUsos ? USOS_CFDI.filter(u => validUsos.includes(u.value)) : USOS_CFDI;

  const handleRegimenChange = (val: string) => {
    setForm(prev => {
      const newValid = REGIMEN_USO_VALID[val];
      const usoStillValid = newValid && prev.usoCfdi ? newValid.includes(prev.usoCfdi) : true;
      return { ...prev, regimenFiscal: val, usoCfdi: usoStillValid ? prev.usoCfdi : '' };
    });
  };

  const handleSave = async () => {
    if (!form.rfc || !form.razonSocial || !form.regimenFiscal || !form.usoCfdi || !form.codigoPostalFiscal) {
      toast.error('Todos los campos son requeridos');
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(`/api/medical-records/patients/${patientId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          requiereFactura: true,
          rfc: form.rfc.toUpperCase().trim(),
          razonSocial: form.razonSocial.trim(),
          regimenFiscal: form.regimenFiscal,
          usoCfdi: form.usoCfdi,
          codigoPostalFiscal: form.codigoPostalFiscal.trim(),
        }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success('Datos fiscales actualizados');
        setEditing(false);
        onUpdate();
      } else {
        toast.error(data.error || 'Error al actualizar');
      }
    } catch {
      toast.error('Error de conexión');
    } finally {
      setSaving(false);
    }
  };

  const inputClass = "w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-teal-500 focus:border-transparent";

  return (
    // `id` + `scroll-mt-4`: las tarjetas de cita enlazan aquí con #datos-fiscales
    // cuando faltan datos del receptor para poder facturar.
    <div id="datos-fiscales" className="bg-white rounded-lg shadow p-6 scroll-mt-4">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-semibold text-gray-900 flex items-center gap-2">
          <FileText className="w-5 h-5 text-teal-600" />
          Datos Fiscales
        </h2>
        {!editing && (
          <button
            onClick={() => setEditing(true)}
            className="text-sm text-gray-500 hover:text-gray-700 flex items-center gap-1 px-2 py-1 rounded hover:bg-gray-100 transition-colors"
          >
            {patient.rfc ? (<><Edit className="w-3.5 h-3.5" />Editar</>) : (<><Plus className="w-3.5 h-3.5" />Agregar</>)}
          </button>
        )}
      </div>

      {editing ? (
        <div className="space-y-3">
          {/* Dos columnas, igual que la vista de lectura: los campos cortos van
              en pareja y solo Razón Social ocupa el ancho. */}
          <div className="grid grid-cols-2 gap-x-3 gap-y-3">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">RFC</label>
              <input
                value={form.rfc}
                onChange={e => setForm(p => ({ ...p, rfc: e.target.value.toUpperCase() }))}
                maxLength={13}
                className={inputClass}
                placeholder="XAXX010101000"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Código Postal Fiscal</label>
              <input
                value={form.codigoPostalFiscal}
                onChange={e => setForm(p => ({ ...p, codigoPostalFiscal: e.target.value.replace(/\D/g, '').slice(0, 5) }))}
                maxLength={5}
                className={inputClass}
                placeholder="44100"
              />
            </div>
            <div className="col-span-2">
              <label className="block text-xs font-medium text-gray-500 mb-1">Razón Social</label>
              <input
                value={form.razonSocial}
                onChange={e => setForm(p => ({ ...p, razonSocial: e.target.value }))}
                className={inputClass}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Régimen Fiscal</label>
              <select
                value={form.regimenFiscal}
                onChange={e => handleRegimenChange(e.target.value)}
                className={inputClass}
              >
                <option value="">Seleccionar</option>
                {REGIMENES_FISCALES.map(r => (
                  <option key={r.value} value={r.value}>{r.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Uso CFDI</label>
              <select
                value={form.usoCfdi}
                onChange={e => setForm(p => ({ ...p, usoCfdi: e.target.value }))}
                className={inputClass}
              >
                <option value="">Seleccionar</option>
                {filteredUsos.map(u => (
                  <option key={u.value} value={u.value}>{u.label}</option>
                ))}
              </select>
              {validUsos && (
                <p className="text-xs text-gray-400 mt-1">Filtrado por régimen fiscal</p>
              )}
            </div>
          </div>
          <div className="flex gap-2 pt-2">
            <button
              onClick={() => setEditing(false)}
              disabled={saving}
              className="px-4 py-2 text-sm border border-gray-200 text-gray-600 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Cancelar
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-4 py-2 text-sm bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-colors disabled:opacity-50 flex items-center gap-1"
            >
              {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle className="w-3.5 h-3.5" />}
              {saving ? 'Guardando...' : 'Guardar'}
            </button>
          </div>
        </div>
      ) : (
        // DOS COLUMNAS siempre (antes `lg:grid-cols-1` la volvía una pila de 5–6
        // filas): son cinco datos cortos y la tarjeta ocupaba media pantalla para
        // decir muy poco. Razón Social y Constancia ocupan el ancho porque son
        // las únicas que se alargan.
        <div className="grid grid-cols-2 gap-x-4 gap-y-3">
          <div>
            <label className="text-xs font-medium text-gray-500">RFC</label>
            <p className="text-sm text-gray-900 font-mono break-all">{patient.rfc}</p>
          </div>
          <div>
            <label className="text-xs font-medium text-gray-500">Código Postal Fiscal</label>
            <p className="text-sm text-gray-900">{patient.codigoPostalFiscal || '—'}</p>
          </div>
          <div className="col-span-2">
            <label className="text-xs font-medium text-gray-500">Razón Social</label>
            <p className="text-sm text-gray-900 break-words">{patient.razonSocial || '—'}</p>
          </div>
          <div>
            <label className="text-xs font-medium text-gray-500">Régimen Fiscal</label>
            <p className="text-sm text-gray-900">{patient.regimenFiscal || '—'}</p>
          </div>
          <div>
            <label className="text-xs font-medium text-gray-500">Uso CFDI</label>
            <p className="text-sm text-gray-900">{patient.usoCfdi || '—'}</p>
          </div>
          {patient.constanciaFiscalUrl && (
            <div className="col-span-2">
              <label className="text-xs font-medium text-gray-500">Constancia Fiscal</label>
              <p>
                <a href={patient.constanciaFiscalUrl} target="_blank" rel="noopener noreferrer" className="text-sm text-blue-600 hover:underline break-all">
                  {patient.constanciaFiscalName || 'Ver constancia'}
                </a>
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

interface CitasIngresosSectionProps {
  bookings: PatientBooking[];
  patient: import('../_components/patient-types').Patient;
}

interface CfdiDraft {
  id: number;
  ledgerEntryId: number | null;
  items: { description: string; unitPrice: number; quantity: number }[];
  createdAt: string;
}

/** F2c: pending CFDI drafts of this patient (prepared by the agent). Fetched
 *  ONCE per expediente and repartidos por ingreso — cada borrador se pinta
 *  DENTRO de la tarjeta de su cita, no flotando encima de la lista: un borrador
 *  siempre cuelga de un ingreso (`ledgerEntryId`), o sea de una cita concreta,
 *  y suelto arriba no se sabía de cuál. */
function useCfdiDrafts(patientId: string, bookingEntryIds: Set<number>) {
  const [drafts, setDrafts] = useState<CfdiDraft[]>([]);

  const fetchDrafts = useCallback(async () => {
    try {
      const res = await authFetch(`${API_URL}/api/facturacion/drafts?patientId=${patientId}&status=draft`);
      if (res.ok) {
        const { data } = await res.json();
        if (Array.isArray(data)) setDrafts(data);
      }
    } catch { /* silent: sin borradores la tarjeta se pinta igual */ }
  }, [patientId]);

  useEffect(() => { fetchDrafts(); }, [fetchDrafts]);

  const discard = useCallback(async (id: number) => {
    try {
      const res = await authFetch(`${API_URL}/api/facturacion/drafts/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ action: 'discard' }),
      });
      if (!res.ok) throw new Error();
      toast.success('Borrador descartado');
      fetchDrafts();
    } catch {
      toast.error('No se pudo descartar el borrador');
    }
  }, [fetchDrafts]);

  // El reparto NO puede ser "null ⇒ suelto, lo demás ⇒ su tarjeta": un borrador
  // puede colgar de un ingreso que NO es ninguna de estas citas (un ingreso
  // manual con paciente, un sat_recibido, una entrada fusionada). Ese borrador no
  // encontraría tarjeta donde pintarse y quedaría INVISIBLE — y no es cosmético:
  // la API rechaza crear un segundo borrador para el mismo ingreso (409), así que
  // uno invisible bloquea para siempre preparar otro y no deja botón para
  // descartarlo. Sin tarjeta que lo aloje, arriba.
  const byLedgerEntry = new Map<number, CfdiDraft[]>();
  const sueltos: CfdiDraft[] = [];
  for (const d of drafts) {
    if (d.ledgerEntryId == null || !bookingEntryIds.has(d.ledgerEntryId)) {
      sueltos.push(d);
      continue;
    }
    byLedgerEntry.set(d.ledgerEntryId, [...(byLedgerEntry.get(d.ledgerEntryId) ?? []), d]);
  }
  return { byLedgerEntry, sueltos, discard };
}

function CfdiDraftRow({
  draft, onDiscard, ingresoYaFacturado = false,
}: { draft: CfdiDraft; onDiscard: (id: number) => void; ingresoYaFacturado?: boolean }) {
  const router = useRouter();
  const items = draft.items ?? [];
  const total = items.reduce((s, it) => s + it.unitPrice * (it.quantity || 1), 0);

  // Borrador MUERTO: su ingreso ya se facturó por otro camino. Abrirlo solo
  // llevaría al 409 de POST /cfdi ("ese ingreso ya tiene una factura ligada"),
  // así que se ofrece lo único que queda por hacer con él: descartarlo.
  if (ingresoYaFacturado) {
    return (
      <div className="flex items-center justify-between gap-2 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2">
        <div className="text-xs text-gray-500 min-w-0">
          <span className="font-medium">Borrador de factura #{draft.id}</span> — este ingreso ya se
          facturó por otro camino, así que el borrador ya no aplica.
        </div>
        <button
          onClick={() => onDiscard(draft.id)}
          className="text-xs px-2 py-1 rounded bg-white text-gray-600 border border-gray-200 hover:bg-gray-50 transition-colors shrink-0"
        >
          Descartar
        </button>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-between gap-2 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2">
      <div className="text-xs text-blue-900 min-w-0">
        <span className="font-medium">Borrador de factura #{draft.id}</span>
        <span className="text-blue-700"> · {items.length} concepto(s) · subtotal {formatCurrency(total)}</span>
        <span className="text-blue-600 ml-1">
          ({new Date(draft.createdAt).toLocaleDateString('es-MX', { day: 'numeric', month: 'short' })})
        </span>
        <p className="text-[11px] text-blue-700 mt-0.5">
          Preparado por el asistente — nada se ha timbrado. Se emite en Facturación, cuando tú lo confirmes ahí.
        </p>
      </div>
      <div className="flex items-center gap-1.5 shrink-0">
        {/* "Revisar y emitir" prometía de más: este botón NO timbra, solo abre el
            formulario de Nueva Factura con el borrador cargado. Quien timbra es
            el doctor, en esa página. */}
        <button
          onClick={() => router.push(`/dashboard/facturacion?draft=${draft.id}`)}
          className="text-xs px-2.5 py-1.5 rounded bg-blue-600 text-white hover:bg-blue-700 transition-colors font-medium"
        >
          Revisar en Facturación
        </button>
        <button
          onClick={() => onDiscard(draft.id)}
          className="text-xs px-2 py-1.5 rounded bg-white text-gray-600 border border-gray-200 hover:bg-gray-50 transition-colors"
        >
          Descartar
        </button>
      </div>
    </div>
  );
}

function CitasIngresosSection({ bookings, patient }: CitasIngresosSectionProps) {
  const router = useRouter();
  // Las CANCELADAS no se listan: no hay nada que cobrar ni que facturar en una
  // cita que no ocurrió, y ocupaban la lista con chips que no llevaban a ninguna
  // acción. (Medido antes de decidirlo: cero citas canceladas en prod tienen un
  // ingreso, así que esto no esconde dinero de nadie.)
  const citasVisibles = bookings.filter((b) => b.status !== 'CANCELLED');
  const bookingEntryIds = new Set(
    citasVisibles.map((b) => b.ledgerEntryId).filter((id): id is number => id != null)
  );
  const { byLedgerEntry: draftsByEntry, sueltos: draftsSueltos, discard: discardDraft } =
    useCfdiDrafts(patient.id, bookingEntryIds);

  // ⚠️ DOS preguntas distintas, antes mezcladas en un solo `hasFiscalData`:
  //   · ¿PODEMOS facturar?  → los cinco campos del receptor. Es lo único que
  //     condiciona el botón: sin ellos el SAT rechaza el timbrado.
  //   · ¿QUIERE factura?    → `requiereFactura` (expediente) y, por cita, la
  //     casilla `facturaSolicitada` de la tabla de citas.
  // Mezcladas, una cita marcada "necesita factura" para un paciente cuyo
  // `requiereFactura` está en false escondía el botón sin decir por qué.
  const fiscalDataComplete = !!(
    patient.rfc &&
    patient.razonSocial &&
    patient.regimenFiscal &&
    patient.usoCfdi &&
    patient.codigoPostalFiscal
  );

  const handleEmitCfdi = (booking: PatientBooking) => {
    if (!fiscalDataComplete || !booking.ledgerEntryId || !booking.amount) return;
    const params = new URLSearchParams({
      from: 'booking',
      ledgerId: String(booking.ledgerEntryId),
      concept: booking.serviceName || 'Consulta médica',
      amount: String(booking.amount),
      clientName: patient.razonSocial!,
      formaDePago: booking.formaDePago || 'efectivo',
      rfc: patient.rfc!,
      fiscalRegime: patient.regimenFiscal!,
      cfdiUse: patient.usoCfdi!,
      taxZipCode: patient.codigoPostalFiscal!,
    });
    router.push(`/dashboard/facturacion?${params.toString()}`);
  };

  const handleDownloadFile = async (cfdiId: number, format: 'pdf' | 'xml') => {
    try {
      const res = await authFetch(`${API_URL}/api/facturacion/cfdi/${cfdiId}/${format}`);
      if (!res.ok) throw new Error(`Error al descargar ${format.toUpperCase()}`);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `factura_${cfdiId}.${format}`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err: any) {
      toast.error(err.message || `Error al descargar ${format.toUpperCase()}`);
    }
  };

  return (
    <div className="bg-white rounded-lg shadow p-6">
      {/* Factura que NO nace de una cita (insumos, quirófano, un saldo aparte).
          Va ARRIBA y a lo ancho: es la acción de entrada de la sección, no un
          accesorio del encabezado. Lleva al form con este paciente ya elegido
          como receptor — sus datos fiscales los deriva el servidor. */}
      <Link
        href={`/dashboard/facturacion?patient=${patient.id}`}
        className="w-full mb-4 px-4 py-3 rounded-lg bg-teal-600 text-white text-sm font-semibold hover:bg-teal-700 transition-colors flex items-center justify-center gap-2 shadow-sm"
      >
        <Receipt className="w-4 h-4" /> Nueva factura manual
      </Link>

      <div className="flex items-center justify-between mb-4 gap-3 flex-wrap">
        <h2 className="text-xl font-semibold text-gray-900 flex items-center gap-2">
          <CalendarDays className="w-5 h-5" />
          Citas e Ingresos
        </h2>
      </div>

      {/* Borradores SIN tarjeta donde vivir: sin ingreso (el campo es nullable en
          el esquema) o colgados de un ingreso que no es ninguna de estas citas.
          Si no se pintaran aquí serían invisibles, y un borrador invisible
          bloquea crear otro (409) sin dejar cómo descartarlo. */}
      {draftsSueltos.length > 0 && (
        <div className="mb-4 space-y-2">
          {draftsSueltos.map((d) => (
            <CfdiDraftRow key={d.id} draft={d} onDiscard={discardDraft} />
          ))}
        </div>
      )}
      {citasVisibles.length > 0 ? (
        <div className="space-y-3">
          {citasVisibles.map((b) => {
            const isCompleted = b.status === 'COMPLETED';
            const drafts = b.ledgerEntryId ? (draftsByEntry.get(b.ledgerEntryId) ?? []) : [];
            return (
              <div key={b.id} className="rounded-lg border border-gray-200 overflow-hidden">
                {/* Top row: date, service, status */}
                <div className="flex items-center justify-between px-4 py-3 bg-gray-50">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-800">
                      {b.date
                        ? new Date(b.date + 'T00:00:00').toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' })
                        : '—'}
                      {b.startTime && ` · ${b.startTime}`}
                      {b.endTime && `–${b.endTime}`}
                    </p>
                    <p className="text-xs text-gray-500 mt-0.5">{b.serviceName || '—'}</p>
                    {/* Notas de la cita — contexto clínico que el doctor escribió al
                        agendar ("seguimiento Wegovy") y que hasta hoy no se veía en
                        ninguna pantalla. `trim()`: hay citas con notes = "" y un
                        bloque vacío se lee como un error de carga. */}
                    {b.notes?.trim() && (
                      <p className="text-xs text-gray-700 mt-1 whitespace-pre-wrap break-words bg-amber-50 border border-amber-100 rounded px-2 py-1">
                        {b.notes.trim()}
                      </p>
                    )}
                    {/* El PAPELEO de un vistazo. Los DOS veredictos —cobro y
                        factura— los resuelve el servidor; aquí no se deduce nada. */}
                    <div className="flex items-center gap-1.5 flex-wrap mt-1.5">
                      <PagoBadge estadoPago={b.estadoPago ?? 'SIN_REGISTRO'} metodoPago={b.metodoPago ?? null} />
                      <FacturaBadge
                        facturada={b.facturada === true}
                        solicitada={b.facturaSolicitada === true}
                      />
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0 ml-2">
                    {b.formLinkId && (
                      <Link
                        href={`/dashboard/medical-records/formularios/${b.formLinkId}`}
                        className="text-xs px-2 py-0.5 rounded bg-purple-100 text-purple-700 hover:bg-purple-200 transition-colors"
                      >
                        Formulario
                      </Link>
                    )}
                    <BookingStatusPill status={b.status} />
                  </div>
                </div>

                {/* La fila de COBRO (crear/compartir link de Stripe o Mercado Pago)
                    se quitó del expediente a propósito: aquí lo que importa es el
                    ESTADO —pagado o no, y con qué— y eso ya lo dice el chip de
                    arriba. Crear y compartir links sigue viviendo en Mis Citas,
                    que es donde se cobra. */}

                {/* Fila financiera. La condición ya NO es `isCompleted`: el ingreso
                    nace por DOS caminos y el del link de pago no espera a que la
                    cita se complete, así que una cita agendada y ya cobrada
                    mostraba la tarjeta vacía justo cuando había algo que decir. */}
                {b.amount != null && (
                  <div className="px-4 py-3 border-t border-gray-100 space-y-2">
                    {/* Monto. La FORMA de pago ya va en el chip "Pagado · Efectivo"
                        de arriba, así que aquí no se repite. */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 flex-wrap">
                        <DollarSign className="w-4 h-4 text-teal-600" />
                        <span className="text-sm font-semibold text-teal-700">{formatCurrency(b.amount)}</span>
                        {/* Un cobro a medias se DICE con su número: el chip solo no
                            deja saber cuánto falta. */}
                        {b.paymentStatus === 'PARTIAL' && b.amountPaid != null && (
                          <span className="text-xs text-amber-700">
                            · cobrado {formatCurrency(b.amountPaid)} de {formatCurrency(b.amount)}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Factura: el estado y, si ya está, sus archivos */}
                    <div className="flex items-center justify-between gap-2">
                      {b.facturada ? (
                        <div className="flex items-center gap-2 min-w-0">
                          <CheckCircle className="w-4 h-4 text-green-500 shrink-0" />
                          <span className="text-xs text-green-700 font-medium">
                            Facturado{b.cfdi?.folio ? ` · Folio ${b.cfdi.folio}` : ''}
                          </span>
                          {b.cfdi && (
                            <span className="text-xs text-gray-400">
                              {new Date(b.cfdi.issuedAt).toLocaleDateString('es-MX', { day: 'numeric', month: 'short' })}
                            </span>
                          )}
                        </div>
                      ) : (
                        <div className="flex items-center gap-2">
                          <AlertCircle className={`w-4 h-4 ${b.facturaSolicitada ? 'text-orange-500' : 'text-amber-500'}`} />
                          <span className={`text-xs font-medium ${b.facturaSolicitada ? 'text-orange-700' : 'text-amber-700'}`}>
                            {b.facturaSolicitada ? 'Pendiente de facturar' : 'Sin factura'}
                          </span>
                        </div>
                      )}

                      {/* Actions */}
                      <div className="flex items-center gap-1.5 shrink-0">
                        {b.cfdi ? (
                          <>
                            <button
                              onClick={() => handleDownloadFile(b.cfdi!.id, 'pdf')}
                              className="text-xs px-2 py-1 rounded bg-gray-100 text-gray-600 hover:bg-gray-200 transition-colors"
                            >
                              PDF
                            </button>
                            <button
                              onClick={() => handleDownloadFile(b.cfdi!.id, 'xml')}
                              className="text-xs px-2 py-1 rounded bg-gray-100 text-gray-600 hover:bg-gray-200 transition-colors"
                            >
                              XML
                            </button>
                          </>
                        ) : b.facturada ? null : !b.ledgerEntryId ? (
                          /* Sin ingreso no hay qué facturar (la factura se ancla al
                             ingreso). Antes esto no pintaba NADA y la cita marcada
                             "necesita factura" parecía rota. */
                          <span className="text-xs text-gray-400">Se factura al registrar el cobro</span>
                        ) : drafts.length > 0 ? (
                          /* DOS CAMINOS SOBRE EL MISMO INGRESO. Con un borrador vivo,
                             un botón "Facturar" al lado abre el form SIN el borrador
                             (prefill por query params) y, al timbrar, NO lo cierra —
                             cfdi/route.ts solo marca `emitted` si recibe `draftId`.
                             El borrador quedaba huérfano y su botón ya solo podía dar
                             409. Se deja UN camino: el borrador manda, y para ignorarlo
                             está Descartar (y entonces reaparece Facturar). */
                          <span className="text-xs text-blue-700">Hay un borrador preparado ↓</span>
                        ) : fiscalDataComplete ? (
                          <button
                            onClick={() => handleEmitCfdi(b)}
                            className="text-sm px-3.5 py-2 rounded-lg bg-teal-600 text-white font-medium hover:bg-teal-700 transition-colors flex items-center gap-1.5 shadow-sm"
                          >
                            <Receipt className="w-4 h-4" /> Facturar
                          </button>
                        ) : (
                          /* Faltan datos del receptor: el camino es el formulario
                             fiscal (desde la cita) o capturarlos en Datos Fiscales,
                             arriba en este mismo expediente. Antes decía "Sin datos
                             fiscales" y ahí se acababa. */
                          <span className="text-xs text-gray-500">
                            Faltan datos fiscales —{' '}
                            <a href="#datos-fiscales" className="text-blue-600 hover:underline">captúralos</a>
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Borradores de ESTA cita (F2c). Viven aquí, no flotando encima
                        de la lista: un borrador cuelga de un ingreso, o sea de una
                        cita concreta. */}
                    {drafts.length > 0 && (
                      <div className="space-y-2 pt-1">
                        {drafts.map((d) => (
                          <CfdiDraftRow
                            key={d.id}
                            draft={d}
                            onDiscard={discardDraft}
                            ingresoYaFacturado={b.facturada === true}
                          />
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* Completada sin ingreso: el chip "Sin cobro registrado" de arriba
                    ya lo dice, así que aquí solo queda la vía para facturarla si
                    hiciera falta (sin ingreso no hay a qué anclar la factura). */}
                {isCompleted && b.amount == null && b.facturaSolicitada && (
                  <div className="px-4 py-2 border-t border-gray-100">
                    <span className="text-xs text-gray-400">Se factura al registrar el cobro</span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        <div className="text-center py-6 text-gray-500">
          <CalendarDays className="w-8 h-8 text-gray-300 mx-auto mb-2" />
          <p className="text-sm">No hay citas vinculadas a este paciente.</p>
        </div>
      )}

    </div>
  );
}

export default function PatientProfilePage() {
  const {
    patientId,
    sessionStatus,
    patient,
    loading,
    error,
    isArchiving,
    calculateAge,
    handleArchive,
    refreshPatient,
  } = usePatientProfile();

  const [recentNotes, setRecentNotes] = useState<RecentNote[]>([]);
  const [patientBookings, setPatientBookings] = useState<PatientBooking[]>([]);
  const [patientFormularios, setPatientFormularios] = useState<PatientFormulario[]>([]);
  const [summary, setSummary] = useState<PatientSummaryData | null>(null);
  const [loadingSummary, setLoadingSummary] = useState(true);
  const [generatingSummary, setGeneratingSummary] = useState(false);
  const [showSummaryModal, setShowSummaryModal] = useState(false);

  useEffect(() => {
    if (!patientId) return;
    fetch(`/api/medical-records/patients/${patientId}/notes`)
      .then((r) => r.json())
      .then((d) => {
        if (d.success) setRecentNotes(d.data.slice(0, 3));
      })
      .catch(() => {});
    fetch(`/api/medical-records/patients/${patientId}/bookings`)
      .then((r) => r.json())
      .then((d) => {
        if (d.success) setPatientBookings(d.data);
      })
      .catch(() => {});
    fetch(`/api/medical-records/patients/${patientId}/formularios`)
      .then((r) => r.json())
      .then((d) => {
        if (d.success) setPatientFormularios(d.data);
      })
      .catch(() => {});
    fetch(`/api/medical-records/patients/${patientId}/summary`)
      .then((r) => r.json())
      .then((d) => {
        if (d.data) setSummary(d.data);
      })
      .catch(() => {})
      .finally(() => setLoadingSummary(false));
  }, [patientId]);

  const handleGenerateSummary = async () => {
    if (!patientId) return;
    setGeneratingSummary(true);
    try {
      const res = await fetch(`/api/medical-records/patients/${patientId}/summary`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      const d = await res.json();
      if (d.data) {
        setSummary(d.data);
        toast.success('Resumen generado exitosamente');
      } else {
        toast.error(d.error || 'Error al generar resumen');
      }
    } catch {
      toast.error('Error al generar resumen');
    } finally {
      setGeneratingSummary(false);
    }
  };

  if (sessionStatus === 'loading' || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <Loader2 className="inline-block h-12 w-12 animate-spin text-blue-600" />
          <p className="mt-4 text-gray-600 font-medium">Cargando paciente...</p>
        </div>
      </div>
    );
  }

  if (error || !patient) {
    return (
      <div className="p-4 sm:p-6">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-red-800">{error || 'Paciente no encontrado'}</p>
          <Link href="/dashboard/medical-records" className="text-red-600 hover:text-red-800 mt-2 inline-block">
            Volver a la lista
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <Link
          href="/dashboard/medical-records"
          className="inline-flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-4"
        >
          <ArrowLeft className="w-5 h-5" />
          Volver a Pacientes
        </Link>

        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          <div className="flex items-start gap-4">
            {/* Photo */}
            {patient.photoUrl ? (
              <img
                src={patient.photoUrl}
                alt={`${patient.firstName} ${patient.lastName}`}
                className="w-20 h-20 rounded-full object-cover"
              />
            ) : (
              <div className="w-20 h-20 rounded-full bg-gray-200 flex items-center justify-center">
                <User className="w-10 h-10 text-gray-400" />
              </div>
            )}

            {/* Basic Info — just the name and the tags. "Editar" lives in the
                Información de Contacto card now. */}
            <div>
              <h1 className="text-xl sm:text-3xl font-bold text-gray-900">
                {patient.firstName} {patient.lastName}
              </h1>
              {patient.tags.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-2">
                  {patient.tags.map(tag => (
                    <span key={tag} className="px-2 py-1 text-xs bg-blue-100 text-blue-700 rounded">
                      {tag}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Actions — three tiers: the three the doctor actually uses (Nueva
              Consulta · Recetas · Informe), then the rest, then Archivar. */}
          <div className="flex flex-wrap items-center gap-2">
            <Link
              href={`/dashboard/medical-records/patients/${patient.id}/encounters/new`}
              className="px-3 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 flex items-center gap-1.5 text-sm font-semibold transition-colors"
            >
              <Plus className="w-4 h-4 flex-shrink-0" />
              <span>Nueva Consulta</span>
            </Link>
            <Link
              href={`/dashboard/medical-records/patients/${patient.id}/prescriptions`}
              className="px-3 py-2 border border-blue-200 bg-blue-50 text-blue-700 rounded-md hover:bg-blue-100 flex items-center gap-1.5 text-sm font-medium transition-colors"
            >
              <Pill className="w-4 h-4 flex-shrink-0" />
              <span>Recetas</span>
            </Link>
            <Link
              href={`/dashboard/medical-records/patients/${patient.id}/informe`}
              className="px-3 py-2 border border-blue-200 bg-blue-50 text-blue-700 rounded-md hover:bg-blue-100 flex items-center gap-1.5 text-sm font-medium transition-colors"
              title="Llenar el formato de una aseguradora con el expediente de este paciente"
            >
              <FileText className="w-4 h-4 flex-shrink-0" />
              <span>Informe</span>
            </Link>

            <div className="w-px h-6 bg-gray-200 hidden sm:block" />

            <Link
              href={`/dashboard/medical-records/patients/${patient.id}/timeline`}
              className="px-3 py-2 border border-gray-300 rounded-md hover:bg-gray-50 flex items-center gap-1.5 text-sm transition-colors"
            >
              <Clock className="w-4 h-4 flex-shrink-0" />
              <span>Línea de Tiempo</span>
            </Link>
            <Link
              href={`/dashboard/medical-records/patients/${patient.id}/media`}
              className="px-3 py-2 border border-gray-300 rounded-md hover:bg-gray-50 flex items-center gap-1.5 text-sm transition-colors"
            >
              <Image className="w-4 h-4 flex-shrink-0" />
              <span>Docs y Galería</span>
            </Link>
            <Link
              href={`/dashboard/medical-records/patients/${patient.id}/notas`}
              className="px-3 py-2 border border-gray-300 rounded-md hover:bg-gray-50 flex items-center gap-1.5 text-sm transition-colors"
            >
              <NotebookPen className="w-4 h-4 flex-shrink-0" />
              <span>Notas</span>
            </Link>

            <div className="w-px h-6 bg-gray-200 hidden sm:block" />
            <button
              onClick={handleArchive}
              disabled={isArchiving}
              className="px-3 py-2 border border-red-200 text-red-600 rounded-md hover:bg-red-50 disabled:opacity-50 flex items-center gap-1.5 text-sm transition-colors"
            >
              <Trash2 className="w-4 h-4 flex-shrink-0" />
              <span>{isArchiving ? 'Archivando...' : 'Archivar'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Main Content — 3/5 · 2/5 instead of the old 2/3 · 1/3: the right column
          now carries Datos Fiscales + Citas e Ingresos and needed the room. */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* Left Column — también va PRIMERA en móvil. El `order-1` de la
            derecha tenía sentido cuando esa columna era "Información Rápida"
            (una tarjeta corta de resumen); ahora carga Resumen + Datos
            Fiscales + Citas e Ingresos, y en un teléfono eso dejaba el
            expediente clínico debajo de todo el ledger de cobros. */}
        <div className="lg:col-span-3 space-y-6">
          {/* Contact Information */}
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold text-gray-900">Información de Contacto</h2>
              <Link
                href={`/dashboard/medical-records/patients/${patient.id}/edit`}
                className="text-sm text-gray-500 hover:text-gray-700 flex items-center gap-1 px-2 py-1 rounded hover:bg-gray-100 transition-colors"
              >
                <Edit className="w-3.5 h-3.5" />
                Editar
              </Link>
            </div>
            {/* Folio · Edad · Sexo — vivían en la línea gris bajo el nombre; se
                quitó de ahí y este es el único lugar donde se ven ya. */}
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-gray-500 mb-4 pb-4 border-b border-gray-100">
              <span>ID: <span className="text-gray-900 font-medium">{patient.internalId}</span></span>
              <span className="text-gray-300">•</span>
              <span><span className="text-gray-900 font-medium">{calculateAge(patient.dateOfBirth)}</span> años</span>
              <span className="text-gray-300">•</span>
              <span className="text-gray-900 font-medium">{formatSex(patient.sex)}</span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-gray-500">Teléfono</label>
                <p className="text-gray-900">{patient.phone || 'No registrado'}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-500">Email</label>
                <p className="text-gray-900">{patient.email || 'No registrado'}</p>
              </div>
              <div className="md:col-span-2">
                <label className="text-sm font-medium text-gray-500">Dirección</label>
                <p className="text-gray-900">
                  {patient.address ? (
                    <>
                      {patient.address}
                      {patient.city && `, ${patient.city}`}
                      {patient.state && `, ${patient.state}`}
                      {patient.postalCode && ` ${patient.postalCode}`}
                    </>
                  ) : (
                    'No registrada'
                  )}
                </p>
              </div>
            </div>
          </div>

          {/* Emergency Contact */}
          {patient.emergencyContactName && (
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">Contacto de Emergencia</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-gray-500">Nombre</label>
                  <p className="text-gray-900">{patient.emergencyContactName}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500">Teléfono</label>
                  <p className="text-gray-900">{patient.emergencyContactPhone || 'No registrado'}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500">Relación</label>
                  <p className="text-gray-900">{patient.emergencyContactRelation || 'No especificada'}</p>
                </div>
              </div>
            </div>
          )}

          {/* Encounters List */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-semibold text-gray-900 flex items-center gap-2 mb-4">
              <FileText className="w-5 h-5" />
              Historial de Consultas
            </h2>

            {patient.encounters && patient.encounters.length > 0 ? (
              <div className="space-y-3">
                {patient.encounters.map(encounter => (
                  <EncounterCard key={encounter.id} encounter={encounter} patientId={patient.id} />
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-gray-500">
                <FileText className="w-12 h-12 text-gray-300 mx-auto mb-2" />
                <p>No hay consultas registradas</p>
                <Link
                  href={`/dashboard/medical-records/patients/${patient.id}/encounters/new`}
                  className="text-blue-600 hover:text-blue-800 text-sm mt-2 inline-block"
                >
                  Crear primera consulta
                </Link>
              </div>
            )}
          </div>
          {/* Formularios */}
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold text-gray-900 flex items-center gap-2">
                <ClipboardList className="w-5 h-5" />
                Formularios
              </h2>

            </div>
            {patientFormularios.length > 0 ? (
              <div className="space-y-2">
                {patientFormularios.map((f) => (
                  <Link
                    key={f.id}
                    href={`/dashboard/medical-records/formularios/${f.id}`}
                    className="flex items-center justify-between px-3 py-2.5 rounded-md border border-gray-100 hover:border-violet-200 hover:bg-violet-50 transition-colors"
                  >
                    <div>
                      <p className="text-sm font-medium text-gray-900">
                        {f.templateName ?? 'Formulario pre-cita'}
                      </p>
                      <p className="text-xs text-gray-400 mt-0.5">
                        {f.appointmentDate
                          ? `Cita: ${new Date(f.appointmentDate + 'T00:00:00').toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' })}${f.appointmentTime ? ` · ${f.appointmentTime}` : ''}`
                          : new Date(f.submittedAt).toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' })}
                      </p>
                    </div>
                    <span className="text-xs px-2 py-0.5 rounded bg-violet-100 text-violet-700 shrink-0 ml-2">
                      Recibido
                    </span>
                  </Link>
                ))}
              </div>
            ) : (
              <div className="text-center py-6 text-gray-500">
                <ClipboardList className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                <p className="text-sm">No hay formularios recibidos.</p>
              </div>
            )}
          </div>

          {/* General Notes */}
          {patient.generalNotes && (
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">Notas Generales</h2>
              <p className="text-gray-900 whitespace-pre-wrap">{patient.generalNotes}</p>
            </div>
          )}

          {/* Recent Notes */}
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold text-gray-900 flex items-center gap-2">
                <NotebookPen className="w-5 h-5" />
                Notas Recientes
              </h2>
              <Link
                href={`/dashboard/medical-records/patients/${patient.id}/notas`}
                className="text-sm text-blue-600 hover:text-blue-800 transition-colors"
              >
                Ver todas
              </Link>
            </div>
            {recentNotes.length > 0 ? (
              <div className="space-y-2">
                {recentNotes.map((note) => (
                  <Link
                    key={note.id}
                    href={`/dashboard/medical-records/patients/${patient.id}/notas`}
                    className="block px-3 py-2.5 rounded-md border border-gray-100 hover:border-gray-200 hover:bg-gray-50 transition-colors"
                  >
                    <p className="text-sm font-medium text-gray-900 truncate">
                      {parseNoteTitle(note.content)}
                    </p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {new Date(note.updatedAt).toLocaleDateString('es-MX', {
                        day: 'numeric', month: 'short', year: 'numeric'
                      })}
                    </p>
                  </Link>
                ))}
              </div>
            ) : (
              <div className="text-center py-6 text-gray-500">
                <NotebookPen className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                <p className="text-sm">No hay notas</p>
                <Link
                  href={`/dashboard/medical-records/patients/${patient.id}/notas`}
                  className="text-blue-600 hover:text-blue-800 text-sm mt-1 inline-block"
                >
                  Crear primera nota
                </Link>
              </div>
            )}
          </div>
        </div>

        {/* Right Column */}
        <div className="lg:col-span-2 space-y-6">
          {/* Resumen Paciente — first card of the column on purpose: it's the
              one the doctor reads before anything else, and buried at the
              bottom nobody found the "Generar Resumen" button. */}
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2 mb-3">
              <Sparkles className="w-5 h-5 text-purple-500" />
              Resumen Paciente
            </h3>

            {loadingSummary ? (
              <div className="flex items-center justify-center py-6">
                <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
              </div>
            ) : summary ? (
              <div>
                <p className="text-xs font-medium text-purple-600 mb-2">
                  Generado el {new Date(summary.createdAt).toLocaleDateString('es-MX', {
                    day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
                  })}
                </p>
                <button
                  onClick={() => setShowSummaryModal(true)}
                  className="w-full text-left"
                >
                  <p className="text-sm text-gray-700 line-clamp-4 leading-relaxed">
                    {summary.content}
                  </p>
                  <p className="text-xs text-purple-600 mt-2 hover:text-purple-800 transition-colors font-medium">
                    Ver resumen completo
                  </p>
                </button>
                <div className="mt-3 pt-3 border-t border-gray-100">
                  <button
                    onClick={handleGenerateSummary}
                    disabled={generatingSummary}
                    className="w-full px-3 py-2 text-sm border border-gray-200 text-gray-600 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50 flex items-center justify-center gap-1.5"
                  >
                    {generatingSummary ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <RefreshCw className="w-3.5 h-3.5" />
                    )}
                    {generatingSummary ? 'Regenerando...' : 'Regenerar Resumen'}
                  </button>
                </div>
              </div>
            ) : (
              <div className="text-center py-4">
                <p className="text-sm text-gray-500 mb-3">No hay resumen generado</p>
                <button
                  onClick={handleGenerateSummary}
                  disabled={generatingSummary}
                  className="w-full px-3 py-2.5 text-sm bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-1.5 font-medium"
                >
                  {generatingSummary ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Sparkles className="w-4 h-4" />
                  )}
                  {generatingSummary ? 'Generando...' : 'Generar Resumen'}
                </button>
              </div>
            )}
          </div>

          {/* Fiscal Data — ALWAYS rendered (F2c follow-up #1): the old gate
              (requiereFactura && rfc) hid the card exactly for the patients
              that NEED fiscal capture — chicken-and-egg the user hit live. */}
          <DatosFiscalesCard patient={patient} patientId={patient.id} onUpdate={refreshPatient} />

          {/* Citas e Ingresos — moved here from the bottom of the left column so
              it sits with the fiscal data it feeds (emitir factura reads the RFC). */}
          <CitasIngresosSection
            bookings={patientBookings}
            patient={patient}
          />
        </div>
      </div>

      {/* Summary Modal — outside the grid: it used to be a grid child, so with
          the 5-column split an open modal pushed the right column to a new row. */}
      {summary && (
        <PatientSummaryModal
          isOpen={showSummaryModal}
          onClose={() => setShowSummaryModal(false)}
          summary={summary}
          patientName={`${patient.firstName} ${patient.lastName}`}
          onRegenerate={handleGenerateSummary}
          isRegenerating={generatingSummary}
        />
      )}
    </div>
  );
}
