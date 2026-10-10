'use client';

import { useState } from 'react';
import type { PatientBooking } from '@/components/medical-records/CitaBadges';
import { BotonesEstadoCita } from './BotonesEstadoCita';
import { CompleteBookingModal, citaParaCompletarDe } from './CompleteBookingModal';
import { cambiarEstadoCita, completarCita } from '@/lib/citas/acciones-cita';

/**
 * VISITAS 09-PLAN L2 (nota N3) — las acciones de ESTADO de una cita fuera de la agenda (la visita y la
 * sesión del tratamiento): los mismos botones (`BotonesEstadoCita`), las mismas acciones
 * (`lib/citas/acciones-cita`) y el mismo «Completar cita». Un solo cableado para las dos pantallas:
 * cada una sólo dice qué hace DESPUÉS (`despues`, con el estado aplicado) y cómo se reagenda.
 */
export function useAccionesDeCita({ booking, patientName, despues }: {
  booking: PatientBooking | undefined;
  patientName: string;
  /** Tras un cambio APLICADO por el servidor: recargar, o salir si la visita ya no existe. */
  despues: (status: string) => Promise<void>;
}) {
  const [completando, setCompletando] = useState(false);
  const [trabajando, setTrabajando] = useState(false);

  const cambiar = async (status: string) => {
    if (!booking) return;
    setTrabajando(true);
    try {
      if (await cambiarEstadoCita(booking.id, status)) await despues(status);
    } finally {
      setTrabajando(false);
    }
  };

  const botones = (opts: { puedeReagendar: boolean; onReagendar?: () => void; deshabilitado?: boolean }) => booking ? (
    <BotonesEstadoCita
      status={booking.status}
      puedeReagendar={opts.puedeReagendar}
      onConfirmar={() => cambiar('CONFIRMED')}
      onCompletar={() => setCompletando(true)}
      onNoAsistio={() => cambiar('NO_SHOW')}
      onCancelar={() => cambiar('CANCELLED')}
      onReagendar={opts.onReagendar}
      deshabilitado={trabajando || !!opts.deshabilitado}
    />
  ) : null;

  const modal = completando && booking ? (
    <CompleteBookingModal
      booking={citaParaCompletarDe(booking, patientName || 'Paciente')}
      onClose={() => setCompletando(false)}
      onConfirm={async (precio, forma) => {
        const r = await completarCita(booking.id, precio, forma);
        // Bien o mal se re-lee (como la agenda): si falló porque la cita cambió en otro lado, que se vea.
        await despues(r.ok ? 'COMPLETED' : 'SIN_CAMBIO');
        return r.ok ? { ledgerEntryId: r.ledgerEntryId } : {};
      }}
    />
  ) : null;

  return { botones, modal };
}
