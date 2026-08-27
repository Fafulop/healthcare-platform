'use client';

import { X, Clock, User, Mail, Phone, ExternalLink } from 'lucide-react';
import { NotasCita } from '@/components/citas/NotasCita';
import Link from 'next/link';

const BOOKING_STATUS_COLORS: Record<string, string> = {
  PENDING: 'bg-yellow-100 text-yellow-800',
  CONFIRMED: 'bg-blue-100 text-blue-800',
  COMPLETED: 'bg-green-100 text-green-800',
  NO_SHOW: 'bg-red-100 text-red-800',
  CANCELLED: 'bg-gray-100 text-gray-600',
};

const BOOKING_STATUS_LABELS: Record<string, string> = {
  PENDING: 'Pendiente',
  CONFIRMED: 'Confirmada',
  COMPLETED: 'Completada',
  NO_SHOW: 'No asistió',
  CANCELLED: 'Cancelada',
};

export interface Booking {
  id: string;
  patientName: string;
  patientEmail: string;
  patientPhone: string;
  status: string;
  /** Notas que el doctor escribió AL AGENDAR. Ya venían en el payload —
   *  `tasks/calendar/route.ts` y el endpoint de slots las seleccionan— pero no se
   *  pintaban en ningún lado: 107 de 482 citas de prod tienen texto real aquí. */
  notes?: string | null;
}

export interface AppointmentSlot {
  id: string;
  date: string;
  startTime: string;
  endTime: string;
  isOpen: boolean;
  currentBookings: number;
  maxBookings: number;
  bookings?: Booking[];
}

interface Props {
  slot: AppointmentSlot | null;
  onClose: () => void;
  zIndex?: string;
}

export function AppointmentDetailModal({ slot, onClose, zIndex = 'z-50' }: Props) {
  if (!slot) return null;

  const activeBookings = slot.bookings?.filter(b => b.status !== 'CANCELLED') ?? [];

  return (
    <div className={`fixed inset-0 ${zIndex} flex items-center justify-center`}>
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-xl shadow-2xl w-full max-w-md mx-4 max-h-[85vh] overflow-y-auto">

        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-gray-200 px-5 py-4 flex items-start justify-between gap-3">
          <div>
            <span className="px-2 py-0.5 text-xs font-semibold rounded bg-green-100 text-green-800 mb-2 inline-block">
              Cita
            </span>
            <div className="flex items-center gap-2 text-gray-900">
              <Clock className="w-4 h-4 text-yellow-600" />
              <span className="font-semibold">{slot.startTime} – {slot.endTime}</span>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 flex-shrink-0 transition-colors">
            <X className="w-4 h-4 text-gray-500" />
          </button>
        </div>

        {/* Body */}
        <div className="px-5 py-4 space-y-3">
          {/* Sólo cuando el cupo es múltiple: en una cita freeform siempre sería "1 / 1". */}
          {slot.maxBookings > 1 && (
            <p className="text-sm text-gray-600">
              <span className="font-medium">{slot.currentBookings}</span> / {slot.maxBookings} reservados
            </p>
          )}

          {activeBookings.length === 0 ? (
            <p className="text-sm text-gray-400 italic">Sin reservas activas</p>
          ) : (
            <div className="space-y-3">
              {activeBookings.map(booking => (
                <div key={booking.id} className="bg-gray-50 rounded-lg p-3 space-y-1.5">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 text-sm font-medium text-gray-900">
                      <User className="w-4 h-4 text-gray-400 flex-shrink-0" />
                      {booking.patientName}
                    </div>
                    <span className={`px-2 py-0.5 text-xs font-semibold rounded-full flex-shrink-0 ${BOOKING_STATUS_COLORS[booking.status] ?? 'bg-gray-100 text-gray-700'}`}>
                      {BOOKING_STATUS_LABELS[booking.status] ?? booking.status}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-gray-500">
                    <Mail className="w-3.5 h-3.5 flex-shrink-0" />
                    {booking.patientEmail}
                  </div>
                  <div className="flex items-center gap-2 text-xs text-gray-500">
                    <Phone className="w-3.5 h-3.5 flex-shrink-0" />
                    {booking.patientPhone}
                  </div>
                  {/* Notas de la cita. Sólo si hay texto: `trim()` porque en prod hay
                      29 citas con notes = "" y una sección vacía se lee como un error. */}
                  <NotasCita notes={booking.notes} className="pt-1.5 mt-1.5 border-t border-gray-200" />
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="px-5 py-4 border-t border-gray-200">
          <Link
            href="/dashboard/appointments"
            className="flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg text-sm font-medium bg-green-50 text-green-700 hover:bg-green-100 transition-colors w-full"
          >
            Gestionar citas
            <ExternalLink className="w-3.5 h-3.5" />
          </Link>
        </div>
      </div>
    </div>
  );
}
