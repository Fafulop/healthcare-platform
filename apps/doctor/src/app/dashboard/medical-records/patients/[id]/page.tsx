'use client';

import { useEffect, useState } from 'react';
import { ArrowLeft, Edit, Plus, FileText, User, Clock, Image, Pill, Loader2, Trash2, NotebookPen, ClipboardList, CheckCircle, Sparkles, RefreshCw, ChevronDown, ChevronUp, ArchiveRestore, Wallet } from 'lucide-react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { NuevaVisitaModal } from '@/components/medical-records/visitas/NuevaVisitaModal';
import { VisitasCard } from '@/components/medical-records/visitas/VisitasCard';
import { ConsultasSinVisitaCard } from '@/components/medical-records/visitas/ConsultasSinVisitaCard';
import { ListaColapsable } from '@/components/medical-records/ListaColapsable';
import { useVisitasDelPaciente } from '@/components/medical-records/visitas/useVisitasDelPaciente';
import { TratamientosCard } from '@/components/medical-records/tratamientos/TratamientosCard';
import { NuevoTratamientoModal } from '@/components/medical-records/tratamientos/NuevoTratamientoModal';
import { StandaloneFormularioModal } from '@/app/dashboard/appointments/_components/StandaloneFormularioModal';
import { useTratamientosDelPaciente } from '@/components/medical-records/tratamientos/useTratamientosDelPaciente';
import { tratamientosUiActiva } from '@/lib/tratamientos-ui';
import { PatientSummaryModal } from '@/components/medical-records/PatientSummaryModal';
import { formatSex } from '@/components/medical-records/patient-display';
import { usePatientProfile } from '../_components/usePatientProfile';
import { toast } from '@/lib/practice-toast';
import { usePermissions } from '@/lib/permissions-client';
// Sólo el TIPO (se borra al compilar): qué bloques de las citas puede ver quien mira.
// Sin `citas` la lista llega VACÍA a propósito — NO quiere decir que no tenga citas.
import type { BookingPermisos } from '@/lib/booking-permisos';
import { getClinicDateString } from '@/lib/dates';
import type { PatientBooking } from '@/components/medical-records/CitaBadges';
import type { BookingsEstado } from '@/components/medical-records/cobros/CitasIngresosSection';
import { ResumenCobros } from '@/components/medical-records/cobros/ResumenCobros';

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

interface PatientSummaryData {
  id: string;
  content: string;
  dataPoints: { encounters: number; prescriptions: number; notes: number };
  createdAt: string;
}

// (Las etiquetas de forma de pago se fueron al servidor: la ruta manda
// `metodoPago` ya legible, resuelto junto con el veredicto de cobro.)

function parseNoteTitle(content: string): string {
  const first = content.split('\n').map((l) => l.trim()).find((l) => l !== '');
  return first || 'Nota vacía';
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
    // `id` + `scroll-mt-4`: las tarjetas de cita (página «Cobros») enlazan aquí con …/patients/<id>#datos-fiscales
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

export default function PatientProfilePage() {
  const {
    patientId,
    sessionStatus,
    doctorId,
    patient,
    loading,
    error,
    isArchiving,
    isReactivating,
    avisoReactivar,
    calculateAge,
    handleArchive,
    handleReactivate,
    refreshPatient,
  } = usePatientProfile();

  const [recentNotes, setRecentNotes] = useState<RecentNote[]>([]);
  const [patientBookings, setPatientBookings] = useState<PatientBooking[]>([]);
  const [bookingPermisos, setBookingPermisos] = useState<BookingPermisos | null>(null);
  const [bookingsEstado, setBookingsEstado] = useState<BookingsEstado>('cargando');
  const [patientFormularios, setPatientFormularios] = useState<PatientFormulario[]>([]);
  const [summary, setSummary] = useState<PatientSummaryData | null>(null);
  const [loadingSummary, setLoadingSummary] = useState(true);
  const [generatingSummary, setGeneratingSummary] = useState(false);
  const [showSummaryModal, setShowSummaryModal] = useState(false);
  // VISITAS — abiertas para todos desde 2026-09-29 (el interruptor `visitasUiActiva` se quitó en la
  // limpieza del 2026-10-01). Sólo esperan a que haya doctor en la sesión.
  const conVisitas = !!doctorId;
  const visitasDelPaciente = useVisitasDelPaciente(patientId, conVisitas);
  // TRATAMIENTOS — `tratamientosUiActiva` (lib/tratamientos-ui.ts): abierta para todos desde el lanzamiento.
  const conTratamientos = tratamientosUiActiva(doctorId);
  const tratamientosDelPaciente = useTratamientosDelPaciente(patientId, conTratamientos);
  const [showNuevoTratamiento, setShowNuevoTratamiento] = useState(false);
  const [showNuevaVisita, setShowNuevaVisita] = useState(false);
  const [showNuevoFormulario, setShowNuevoFormulario] = useState(false);
  // «Nueva Visita» desde otra pantalla (Línea de Tiempo) llega con `?nuevaVisita=1`: abre el modal
  // una vez y quita el parámetro, para que recargar la página no lo vuelva a abrir.
  const routerPerfil = useRouter();
  const searchParams = useSearchParams();
  useEffect(() => {
    if (!conVisitas || searchParams.get('nuevaVisita') !== '1') return;
    setShowNuevaVisita(true);
    const resto = new URLSearchParams(searchParams.toString());
    resto.delete('nuevaVisita');
    const qs = resto.toString();
    routerPerfil.replace(`/dashboard/medical-records/patients/${patientId}${qs ? `?${qs}` : ''}`, { scroll: false });
  }, [conVisitas, searchParams, patientId, routerPerfil]);
  // Contacto de Emergencia y Notas Generales viven DENTRO de «Información de Contacto», plegados.
  const [contactoAbierto, setContactoAbierto] = useState(false);
  // TIERS Q2b — el resumen del paciente lo GENERA un modelo (POST …/summary).
  // Son TRES disparadores para la misma acción (Generar, Regenerar y el de
  // dentro del modal): gatear solo uno deja los otros dos vivos, que es justo
  // lo que señaló el review. Ojo: LEER un resumen ya guardado NO es IA — por
  // eso la regla de ruta lleva `methods: ['POST']` y aquí solo se esconden los
  // botones que lo vuelven a generar.
  // `!permsLoading`: mientras la sesión carga, permissions-client hace
  // fail-open (`isOwner ?? true`, `tier ?? PRO`), así que `can('ia')` sería
  // true en esa ventana y la puerta se pintaría ENCENDIDA en un plan sin IA.
  const { can, loading: permsLoading } = usePermissions();
  const aiAllowed = !permsLoading && can('ia');

  useEffect(() => {
    if (!patientId) return;
    fetch(`/api/medical-records/patients/${patientId}/notes`)
      .then((r) => r.json())
      .then((d) => {
        // TODAS (ya vienen por `updatedAt` desc): la tarjeta enseña 3 y abre el resto.
        if (d.success) setRecentNotes(d.data);
      })
      .catch(() => {});
    fetch(`/api/medical-records/patients/${patientId}/bookings`)
      .then((r) => r.json())
      .then((d) => {
        if (d.success && Array.isArray(d.data) && d.permisos) {
          setPatientBookings(d.data);
          setBookingPermisos(d.permisos);
          setBookingsEstado('ok');
        } else {
          setBookingsEstado('error');
        }
      })
      .catch(() => setBookingsEstado('error'));
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

  // La flecha de «Información de Contacto» aparece si hay ALGO que abrir: cualquier dato del contacto
  // de emergencia (el nombre no es obligatorio en el formulario) o notas que no sean sólo espacios.
  const tieneContactoEmergencia = [patient.emergencyContactName, patient.emergencyContactPhone, patient.emergencyContactRelation]
    .some((x) => x?.trim());
  const notasGenerales = patient.generalNotes?.trim();
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
              {/* H-041: an archived record used to look exactly like an active one. */}
              {patient.status !== 'active' && (
                <span className="inline-block mt-1 px-2 py-0.5 text-xs font-medium rounded-full bg-gray-100 text-gray-700 border border-gray-300">
                  {patient.status === 'archived' ? 'Archivado' : 'Inactivo'} · no cuenta para tu cupo
                </span>
              )}
              {avisoReactivar && (
                <p className="mt-2 max-w-md text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-md px-3 py-2">
                  {avisoReactivar}
                </p>
              )}
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
            <button
              onClick={() => setShowNuevaVisita(true)}
              className="px-3 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 flex items-center gap-1.5 text-sm font-semibold transition-colors"
            >
              <Plus className="w-4 h-4 flex-shrink-0" />
              <span>Nueva Visita</span>
            </button>
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
            {/* 10-PLAN P2 — el estado de cuenta del paciente: citas (cobro y factura), ventas y totales. */}
            <Link
              href={`/dashboard/medical-records/patients/${patient.id}/cobros`}
              className="px-3 py-2 border border-gray-300 rounded-md hover:bg-gray-50 flex items-center gap-1.5 text-sm transition-colors"
            >
              <Wallet className="w-4 h-4 flex-shrink-0" />
              <span>Cobros</span>
            </Link>

            <div className="w-px h-6 bg-gray-200 hidden sm:block" />
            {/* An archived record offers «Reactivar» instead; an «Inactivo» one (only the assistant sets
                it) can still be archived, and reactivated too. */}
            {patient.status !== 'archived' && (
              <button
                onClick={() => {
                  // H-042: archiving does not cancel its upcoming citas — say how many there are.
                  // `null` = the citas didn't load (or no permission): no count, rather than a false «0».
                  const hoy = getClinicDateString();
                  const proximas = bookingsEstado === 'ok'
                    ? patientBookings.filter((b) => (b.status === 'PENDING' || b.status === 'CONFIRMED') && !!b.date && b.date.slice(0, 10) >= hoy).length
                    : null;
                  handleArchive(proximas);
                }}
                disabled={isArchiving}
                className="px-3 py-2 border border-red-200 text-red-600 rounded-md hover:bg-red-50 disabled:opacity-50 flex items-center gap-1.5 text-sm transition-colors"
              >
                <Trash2 className="w-4 h-4 flex-shrink-0" />
                <span>{isArchiving ? 'Archivando...' : 'Archivar'}</span>
              </button>
            )}
            {patient.status !== 'active' && (
              <button
                onClick={handleReactivate}
                disabled={isReactivating}
                className="px-3 py-2 border border-green-300 text-green-700 rounded-md hover:bg-green-50 disabled:opacity-50 flex items-center gap-1.5 text-sm transition-colors"
              >
                <ArchiveRestore className="w-4 h-4 flex-shrink-0" />
                <span>{isReactivating ? 'Reactivando...' : 'Reactivar'}</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Main Content — 3/5 · 2/5 instead of the old 2/3 · 1/3: the right column
          now carries Datos Fiscales + the Cobros summary (10-PLAN P3) and needed the room. */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* Left Column — también va PRIMERA en móvil. El `order-1` de la
            derecha tenía sentido cuando esa columna era "Información Rápida"
            (una tarjeta corta de resumen); ahora carga Resumen + Datos
            Fiscales + el resumen de Cobros, y en un teléfono eso dejaba el
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
            {/* H-044: the clinical baseline was saved but shown nowhere on the profile. Only what's filled. */}
            {(() => {
              const clinicos = [
                ['Tipo de sangre', patient.bloodType],
                ['Alergias', patient.currentAllergies],
                ['Condiciones crónicas', patient.currentChronicConditions],
                ['Medicamentos actuales', patient.currentMedications],
              ].filter(([, v]) => v && String(v).trim()) as [string, string][];
              return clinicos.length > 0 ? (
                <dl className="grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-2 text-sm mb-4 pb-4 border-b border-gray-100">
                  {clinicos.map(([k, v]) => (
                    <div key={k}>
                      <dt className="font-medium text-gray-500">{k}</dt>
                      <dd className="text-gray-900 whitespace-pre-wrap">{v}</dd>
                    </div>
                  ))}
                </dl>
              ) : null;
            })()}
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

            {/* Contacto de Emergencia y Notas Generales: antes dos tarjetas sueltas en la página;
                ahora dentro de esta, plegadas tras la flecha. Sin ninguno de los dos, no hay flecha
                (no hay nada que abrir). */}
            {(tieneContactoEmergencia || notasGenerales) && (
              <>
                {contactoAbierto && (
                  <div className="mt-4 pt-4 border-t border-gray-100 space-y-4">
                    {tieneContactoEmergencia && (
                      <div>
                        <h3 className="text-sm font-semibold text-gray-700 mb-2">Contacto de Emergencia</h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                            <label className="text-sm font-medium text-gray-500">Nombre</label>
                            <p className="text-gray-900">{patient.emergencyContactName || 'No registrado'}</p>
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
                    {notasGenerales && (
                      <div>
                        <h3 className="text-sm font-semibold text-gray-700 mb-2">Notas Generales</h3>
                        <p className="text-gray-900 whitespace-pre-wrap">{notasGenerales}</p>
                      </div>
                    )}
                  </div>
                )}
                <button
                  type="button"
                  onClick={() => setContactoAbierto((a) => !a)}
                  aria-expanded={contactoAbierto}
                  aria-label={contactoAbierto ? 'Ocultar contacto de emergencia y notas generales' : 'Ver contacto de emergencia y notas generales'}
                  title={contactoAbierto ? 'Ver menos' : 'Contacto de emergencia y notas generales'}
                  className="mt-3 w-full flex justify-center py-1 text-gray-400 hover:text-gray-600 rounded-md hover:bg-gray-50 transition-colors"
                >
                  {contactoAbierto ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                </button>
              </>
            )}
          </div>

          {/* Visitas (D4) · «Consultas sin visita» en su PROPIA tarjeta · Tratamientos. */}
          <VisitasCard
            patientId={patient.id}
            estado={visitasDelPaciente.estado}
            visitas={visitasDelPaciente.visitas}
            bookings={patientBookings}
            permisos={bookingPermisos}
            onNuevaVisita={() => setShowNuevaVisita(true)}
          />
          <ConsultasSinVisitaCard
            patientId={patient.id}
            estado={visitasDelPaciente.estado}
            sueltas={visitasDelPaciente.sueltas}
          />
          {conTratamientos && (
            <TratamientosCard
              patientId={patient.id}
              estado={tratamientosDelPaciente.estado}
              tratamientos={tratamientosDelPaciente.tratamientos}
              onNuevo={() => setShowNuevoTratamiento(true)}
            />
          )}
          {/* Formularios */}
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold text-gray-900 flex items-center gap-2">
                <ClipboardList className="w-5 h-5" />
                Formularios
              </h2>
              {/* El enlace se crea en `appointments/form-links` (apps/api) ⇒ exige `citas`. */}
              {!permsLoading && can('citas') && (
                <button
                  onClick={() => setShowNuevoFormulario(true)}
                  className="text-sm text-blue-600 hover:text-blue-800 flex items-center gap-1 px-2 py-1 rounded hover:bg-blue-50"
                >
                  <Plus className="w-4 h-4" />Nuevo formulario
                </button>
              )}
            </div>
            {patientFormularios.length > 0 ? (
              <ListaColapsable className="space-y-2">
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
              </ListaColapsable>
            ) : (
              <div className="text-center py-6 text-gray-500">
                <ClipboardList className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                <p className="text-sm">No hay formularios recibidos.</p>
              </div>
            )}
          </div>

          {/* Recent Notes */}
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold text-gray-900 flex items-center gap-2">
                <NotebookPen className="w-5 h-5" />
                Notas Recientes
              </h2>
              <div className="flex items-center gap-1">
                <Link
                  href={`/dashboard/medical-records/patients/${patient.id}/notas`}
                  className="text-sm text-blue-600 hover:text-blue-800 transition-colors px-2 py-1"
                >
                  Ver todas
                </Link>
                {/* `?nueva=1` abre una nota en blanco (que pregunta «¿A qué visita pertenece?»). */}
                <Link
                  href={`/dashboard/medical-records/patients/${patient.id}/notas?nueva=1`}
                  className="text-sm text-blue-600 hover:text-blue-800 flex items-center gap-1 px-2 py-1 rounded hover:bg-blue-50"
                >
                  <Plus className="w-4 h-4" />Nueva nota
                </Link>
              </div>
            </div>
            {recentNotes.length > 0 ? (
              <ListaColapsable className="space-y-2">
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
              </ListaColapsable>
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
                {aiAllowed && (
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
                )}
              </div>
            ) : (
              <div className="text-center py-4">
                <p className="text-sm text-gray-500 mb-3">No hay resumen generado</p>
                {aiAllowed && (
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
                )}
              </div>
            )}
          </div>

          {/* Fiscal Data — ALWAYS rendered (F2c follow-up #1): the old gate
              (requiereFactura && rfc) hid the card exactly for the patients
              that NEED fiscal capture — chicken-and-egg the user hit live. */}
          <DatosFiscalesCard patient={patient} patientId={patient.id} onUpdate={refreshPatient} />

          {/* 10-PLAN P3 — «Citas e Ingresos» se mudó a la página «Cobros» (citas con su cobro y factura,
              totales, ventas). Aquí queda un resumen con la entrada y «Nueva factura manual». */}
          <ResumenCobros
            patientId={patient.id}
            bookings={patientBookings}
            permisos={bookingPermisos}
            estado={bookingsEstado}
          />
        </div>
      </div>

      {showNuevaVisita && (
        <NuevaVisitaModal
          patientId={patient.id}
          onClose={() => setShowNuevaVisita(false)}
          bookings={patientBookings}
          verCitas={bookingPermisos?.citas ?? false}
          visitas={visitasDelPaciente.visitas}
          visitasEstado={visitasDelPaciente.estado}
          citasEstado={bookingsEstado}
          recargarVisitas={visitasDelPaciente.recargar}
          tratamientos={conTratamientos ? tratamientosDelPaciente.tratamientos : []}
        />
      )}

      {showNuevoTratamiento && (
        <NuevoTratamientoModal patientId={patient.id} onClose={() => setShowNuevoTratamiento(false)} />
      )}

      {/* «Nuevo formulario» del expediente: el mismo «Formulario libre» de la agenda, con ESTE paciente. */}
      <StandaloneFormularioModal
        isOpen={showNuevoFormulario}
        onClose={() => setShowNuevoFormulario(false)}
        pacienteFijo={{
          id: patient.id, firstName: patient.firstName, lastName: patient.lastName,
          phone: patient.phone ?? null, email: patient.email ?? null,
        }}
      />

      {/* Summary Modal — outside the grid: it used to be a grid child, so with
          the 5-column split an open modal pushed the right column to a new row. */}
      {summary && (
        <PatientSummaryModal
          isOpen={showSummaryModal}
          onClose={() => setShowSummaryModal(false)}
          summary={summary}
          patientName={`${patient.firstName} ${patient.lastName}`}
          onRegenerate={aiAllowed ? handleGenerateSummary : undefined}
          isRegenerating={generatingSummary}
        />
      )}
    </div>
  );
}
