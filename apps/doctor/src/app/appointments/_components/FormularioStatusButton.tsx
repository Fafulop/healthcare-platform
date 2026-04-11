'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { CheckCircle, ChevronDown, Clock, LinkIcon } from 'lucide-react';
import type { Booking } from '../_hooks/useBookings';

interface Props {
  booking: Booking;
  onCreateForm: () => void;
  onDeleteForm: () => void;
}

function isFormLinkExpired(booking: Booking): boolean {
  if (!booking.formLink) return false;
  const today = new Date().toLocaleString('sv-SE', { timeZone: 'America/Mexico_City' }).split(' ')[0];
  if (booking.slot?.date) {
    return booking.slot.date.split('T')[0] < today;
  }
  // Freeform: 7-day window from createdAt
  const createdAt = new Date(booking.formLink.createdAt);
  const expiryDate = new Date(createdAt.getTime() + 7 * 24 * 60 * 60 * 1000);
  return expiryDate < new Date();
}

export function FormularioStatusButton({ booking, onCreateForm, onDeleteForm }: Props) {
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!dropdownOpen) return;
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [dropdownOpen]);

  // State 5: SUBMITTED
  if (booking.formLink?.status === 'SUBMITTED') {
    return (
      <Link
        href={`/dashboard/medical-records/formularios/${booking.formLink.id}`}
        className="text-xs px-2 py-1 rounded bg-green-100 text-green-700 border border-green-200 flex items-center gap-1 hover:bg-green-200"
      >
        <CheckCircle className="w-3 h-3" /> Formulario recibido
      </Link>
    );
  }

  // State 1: No patientId linked
  if (!booking.patientId) {
    return (
      <button
        disabled
        title="Vincular expediente primero"
        className="text-xs px-2 py-1 rounded bg-gray-100 text-gray-400 border border-gray-200 cursor-not-allowed"
      >
        Formulario
      </button>
    );
  }

  // State 2: Has patientId, no formLink
  if (!booking.formLink) {
    return (
      <button
        onClick={onCreateForm}
        className="text-xs px-2 py-1 rounded bg-purple-100 text-purple-700 hover:bg-purple-200"
      >
        Crear formulario
      </button>
    );
  }

  // States 3 & 4: PENDING (expired or not)
  const expired = isFormLinkExpired(booking);

  return (
    <div className="relative" ref={containerRef}>
      <div className="flex items-center">
        <button
          className={`text-xs px-2 py-1 rounded-l flex items-center gap-1 ${
            expired
              ? 'bg-red-50 text-red-600 border border-red-200'
              : 'bg-amber-50 text-amber-700 border border-amber-200'
          }`}
          disabled
        >
          <Clock className="w-3 h-3" />
          {expired ? 'Enlace expirado' : 'Esperando respuesta'}
        </button>
        <button
          onClick={() => setDropdownOpen((o) => !o)}
          className={`text-xs px-1 py-1 rounded-r border-l-0 ${
            expired
              ? 'bg-red-50 text-red-600 border border-red-200 hover:bg-red-100'
              : 'bg-amber-50 text-amber-700 border border-amber-200 hover:bg-amber-100'
          }`}
        >
          <ChevronDown className="w-3 h-3" />
        </button>
      </div>
      {dropdownOpen && (
        <div className="absolute left-0 top-full mt-1 z-20 bg-white border border-gray-200 rounded shadow-md min-w-[120px]">
          <button
            onClick={() => { setDropdownOpen(false); onCreateForm(); }}
            className="w-full text-left text-xs px-3 py-2 hover:bg-gray-50 flex items-center gap-1.5"
          >
            <LinkIcon className="w-3 h-3" /> Reenviar
          </button>
          <button
            onClick={() => { setDropdownOpen(false); onDeleteForm(); }}
            className="w-full text-left text-xs px-3 py-2 hover:bg-red-50 text-red-600 flex items-center gap-1.5"
          >
            Cancelar formulario
          </button>
        </div>
      )}
    </div>
  );
}
