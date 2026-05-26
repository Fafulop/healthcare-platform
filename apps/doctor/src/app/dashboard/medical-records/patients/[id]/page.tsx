'use client';

import { useEffect, useState } from 'react';
import { ArrowLeft, Edit, Plus, FileText, User, Clock, Image, Pill, Loader2, Trash2, NotebookPen, CalendarDays, ClipboardList, DollarSign, Receipt, AlertCircle, CheckCircle, ExternalLink } from 'lucide-react';
import Link from 'next/link';
import { EncounterCard } from '@/components/medical-records/EncounterCard';
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

interface PatientBooking {
  id: string;
  date: string | null;
  startTime: string | null;
  endTime: string | null;
  serviceName: string | null;
  status: string;
  appointmentMode: string | null;
  finalPrice: number | null;
  formLinkId?: string | null;
  // Financial
  ledgerEntryId: number | null;
  amount: number | null;
  formaDePago: string | null;
  cfdi: BookingCfdi | null;
}

const API_URL = process.env.NEXT_PUBLIC_API_URL || '';

const FORMA_PAGO_LABEL: Record<string, string> = {
  efectivo: 'Efectivo',
  transferencia: 'Transferencia',
  tarjeta: 'Tarjeta',
  cheque: 'Cheque',
  deposito: 'Depósito',
};

const FORMA_TO_SAT: Record<string, string> = {
  efectivo: '01',
  transferencia: '03',
  tarjeta: '04',
  cheque: '02',
  deposito: '03',
};

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
    <div className="bg-white rounded-lg shadow p-6">
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
            <Edit className="w-3.5 h-3.5" />
            Editar
          </button>
        )}
      </div>

      {editing ? (
        <div className="space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
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
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="text-sm font-medium text-gray-500">RFC</label>
            <p className="text-gray-900 font-mono">{patient.rfc}</p>
          </div>
          <div>
            <label className="text-sm font-medium text-gray-500">Razón Social</label>
            <p className="text-gray-900">{patient.razonSocial || '—'}</p>
          </div>
          <div>
            <label className="text-sm font-medium text-gray-500">Régimen Fiscal</label>
            <p className="text-gray-900">{patient.regimenFiscal || '—'}</p>
          </div>
          <div>
            <label className="text-sm font-medium text-gray-500">Uso CFDI</label>
            <p className="text-gray-900">{patient.usoCfdi || '—'}</p>
          </div>
          <div>
            <label className="text-sm font-medium text-gray-500">Código Postal Fiscal</label>
            <p className="text-gray-900">{patient.codigoPostalFiscal || '—'}</p>
          </div>
          {patient.constanciaFiscalUrl && (
            <div>
              <label className="text-sm font-medium text-gray-500">Constancia Fiscal</label>
              <p>
                <a href={patient.constanciaFiscalUrl} target="_blank" rel="noopener noreferrer" className="text-sm text-blue-600 hover:underline">
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
  patientId: string;
  onBookingsChange: (bookings: PatientBooking[]) => void;
}

function CitasIngresosSection({ bookings, patient, patientId, onBookingsChange }: CitasIngresosSectionProps) {
  const [emittingCfdiFor, setEmittingCfdiFor] = useState<string | null>(null);

  const hasFiscalData = !!(
    patient.requiereFactura &&
    patient.rfc &&
    patient.razonSocial &&
    patient.regimenFiscal &&
    patient.usoCfdi &&
    patient.codigoPostalFiscal
  );

  const handleEmitCfdi = async (booking: PatientBooking) => {
    if (!hasFiscalData || !booking.ledgerEntryId || !booking.amount) return;
    setEmittingCfdiFor(booking.id);
    try {
      const res = await authFetch(`${API_URL}/api/facturacion/cfdi`, {
        method: 'POST',
        body: JSON.stringify({
          receiver: {
            rfc: patient.rfc,
            name: patient.razonSocial,
            cfdiUse: patient.usoCfdi,
            fiscalRegime: patient.regimenFiscal,
            taxZipCode: patient.codigoPostalFiscal,
          },
          items: [{
            productCode: '85121800',
            description: booking.serviceName || 'Consulta médica',
            quantity: 1,
            unitCode: 'E48',
            unitPrice: booking.amount,
            subtotal: booking.amount,
            total: booking.amount,
          }],
          paymentForm: FORMA_TO_SAT[booking.formaDePago || 'efectivo'] || '03',
          paymentMethod: 'PUE',
          cfdiType: 'I',
          ledgerEntryId: booking.ledgerEntryId,
        }),
      });
      const data = await res.json();
      if (data.data?.id) {
        toast.success('Factura (CFDI) emitida correctamente');
        // Refresh bookings to show the new CFDI
        const refreshRes = await fetch(`/api/medical-records/patients/${patientId}/bookings`);
        const refreshData = await refreshRes.json();
        if (refreshData.success) onBookingsChange(refreshData.data);
      } else {
        toast.error(data.error || 'Error al emitir factura');
      }
    } catch {
      toast.error('Error de conexión al emitir factura');
    } finally {
      setEmittingCfdiFor(null);
    }
  };

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h2 className="text-xl font-semibold text-gray-900 flex items-center gap-2 mb-4">
        <CalendarDays className="w-5 h-5" />
        Citas e Ingresos
      </h2>
      {bookings.length > 0 ? (
        <div className="space-y-3">
          {bookings.map((b) => {
            const isCompleted = b.status === 'COMPLETED';
            const isEmitting = emittingCfdiFor === b.id;
            return (
              <div key={b.id} className="rounded-lg border border-gray-200 overflow-hidden">
                {/* Top row: date, service, status */}
                <div className="flex items-center justify-between px-4 py-3 bg-gray-50">
                  <div>
                    <p className="text-sm font-medium text-gray-800">
                      {b.date
                        ? new Date(b.date + 'T00:00:00').toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' })
                        : '—'}
                      {b.startTime && ` · ${b.startTime}`}
                      {b.endTime && `–${b.endTime}`}
                    </p>
                    <p className="text-xs text-gray-500 mt-0.5">{b.serviceName || '—'}</p>
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

                {/* Financial row: only for completed bookings with ledger data */}
                {isCompleted && b.amount != null && (
                  <div className="px-4 py-3 border-t border-gray-100 space-y-2">
                    {/* Amount + forma de pago */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <DollarSign className="w-4 h-4 text-teal-600" />
                        <span className="text-sm font-semibold text-teal-700">{formatCurrency(b.amount)}</span>
                        {b.formaDePago && (
                          <span className="text-xs text-gray-500">· {FORMA_PAGO_LABEL[b.formaDePago] || b.formaDePago}</span>
                        )}
                      </div>
                    </div>

                    {/* CFDI status */}
                    <div className="flex items-center justify-between">
                      {b.cfdi ? (
                        <div className="flex items-center gap-2">
                          <CheckCircle className="w-4 h-4 text-green-500" />
                          <span className="text-xs text-green-700 font-medium">
                            CFDI emitida{b.cfdi.folio ? ` · Folio ${b.cfdi.folio}` : ''}
                          </span>
                          <span className="text-xs text-gray-400">
                            {new Date(b.cfdi.issuedAt).toLocaleDateString('es-MX', { day: 'numeric', month: 'short' })}
                          </span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2">
                          <AlertCircle className="w-4 h-4 text-amber-500" />
                          <span className="text-xs text-amber-700 font-medium">Sin factura</span>
                        </div>
                      )}

                      {/* Actions */}
                      <div className="flex items-center gap-1.5">
                        {b.cfdi ? (
                          <>
                            <a
                              href={`${API_URL}/api/facturacion/cfdi/${b.cfdi.id}/pdf`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-xs px-2 py-1 rounded bg-gray-100 text-gray-600 hover:bg-gray-200 transition-colors"
                            >
                              PDF
                            </a>
                            <a
                              href={`${API_URL}/api/facturacion/cfdi/${b.cfdi.id}/xml`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-xs px-2 py-1 rounded bg-gray-100 text-gray-600 hover:bg-gray-200 transition-colors"
                            >
                              XML
                            </a>
                          </>
                        ) : hasFiscalData && b.ledgerEntryId ? (
                          <button
                            onClick={() => handleEmitCfdi(b)}
                            disabled={isEmitting}
                            className="text-xs px-2.5 py-1 rounded bg-teal-50 text-teal-700 border border-teal-200 hover:bg-teal-100 transition-colors disabled:opacity-50 flex items-center gap-1"
                          >
                            {isEmitting ? (
                              <><Loader2 className="w-3 h-3 animate-spin" /> Emitiendo...</>
                            ) : (
                              <><Receipt className="w-3 h-3" /> Emitir factura</>
                            )}
                          </button>
                        ) : !hasFiscalData && b.ledgerEntryId ? (
                          <span className="text-xs text-gray-400">Sin datos fiscales</span>
                        ) : null}
                      </div>
                    </div>
                  </div>
                )}

                {/* Completed but no ledger entry (legacy bookings before bookingId link) */}
                {isCompleted && b.amount == null && (
                  <div className="px-4 py-2 border-t border-gray-100">
                    <span className="text-xs text-gray-400">Sin datos financieros registrados</span>
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
    formatDate,
    handleArchive,
    refreshPatient,
  } = usePatientProfile();

  const [recentNotes, setRecentNotes] = useState<RecentNote[]>([]);
  const [patientBookings, setPatientBookings] = useState<PatientBooking[]>([]);
  const [patientFormularios, setPatientFormularios] = useState<PatientFormulario[]>([]);

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
  }, [patientId]);

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

            {/* Basic Info */}
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-xl sm:text-3xl font-bold text-gray-900">
                  {patient.firstName} {patient.lastName}
                </h1>
                <Link
                  href={`/dashboard/medical-records/patients/${patient.id}/edit`}
                  className="px-2 py-1 text-sm border border-gray-300 rounded-md hover:bg-gray-50 flex items-center gap-1.5 text-gray-600 flex-shrink-0"
                >
                  <Edit className="w-3.5 h-3.5" />
                  Editar
                </Link>
              </div>
              <p className="text-gray-600 mt-1">
                ID: {patient.internalId} • {calculateAge(patient.dateOfBirth)} años • {patient.sex}
              </p>
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

          {/* Actions */}
          <div className="flex flex-wrap items-center gap-2">
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
              href={`/dashboard/medical-records/patients/${patient.id}/prescriptions`}
              className="px-3 py-2 border border-gray-300 rounded-md hover:bg-gray-50 flex items-center gap-1.5 text-sm transition-colors"
            >
              <Pill className="w-4 h-4 flex-shrink-0" />
              <span>Prescripciones</span>
            </Link>
            <Link
              href={`/dashboard/medical-records/patients/${patient.id}/notas`}
              className="px-3 py-2 border border-gray-300 rounded-md hover:bg-gray-50 flex items-center gap-1.5 text-sm transition-colors"
            >
              <NotebookPen className="w-4 h-4 flex-shrink-0" />
              <span>Notas</span>
            </Link>
            <Link
              href={`/dashboard/medical-records/patients/${patient.id}/encounters/new`}
              className="px-3 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 flex items-center gap-1.5 text-sm font-semibold transition-colors"
            >
              <Plus className="w-4 h-4 flex-shrink-0" />
              <span>Nueva Consulta</span>
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

      {/* Main Content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column */}
        <div className="lg:col-span-2 space-y-6 order-2 lg:order-1">
          {/* Contact Information */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Información de Contacto</h2>
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

          {/* Fiscal Data */}
          {patient.requiereFactura && patient.rfc && (
            <DatosFiscalesCard patient={patient} patientId={patient.id} onUpdate={refreshPatient} />
          )}

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

          {/* Citas e Ingresos */}
          <CitasIngresosSection
            bookings={patientBookings}
            patient={patient}
            patientId={patient.id}
            onBookingsChange={setPatientBookings}
          />
        </div>

        {/* Right Column - Quick Info */}
        <div className="space-y-6 order-1 lg:order-2">
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Información Rápida</h3>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-gray-600">Nacimiento</span>
                <span className="font-medium">{formatDate(patient.dateOfBirth)}</span>
              </div>
              {patient.firstVisitDate && (
                <div className="flex items-center justify-between">
                  <span className="text-gray-600">Primera Visita</span>
                  <span className="font-medium">{formatDate(patient.firstVisitDate)}</span>
                </div>
              )}
              {patient.lastVisitDate && (
                <div className="flex items-center justify-between">
                  <span className="text-gray-600">Última Visita</span>
                  <span className="font-medium">{formatDate(patient.lastVisitDate)}</span>
                </div>
              )}
              <div className="flex items-center justify-between">
                <span className="text-gray-600">Estado</span>
                <span className={`px-2 py-1 text-xs rounded ${
                  patient.status === 'active' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                }`}>
                  {patient.status === 'active' ? 'Activo' : patient.status}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
