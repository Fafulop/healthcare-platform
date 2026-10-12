"use client";

import { CalendarClock } from "lucide-react";

/**
 * Los botones de ESTADO de una cita: Confirmar · Completar · No asistió · Cancelar · Reagendar.
 *
 * VISITAS 09-PLAN L2 (nota N3): eran el grupo «Estado» de `StatusActions` (la agenda). La visita y la
 * sesión del tratamiento ofrecen los MISMOS, así que se sacaron aquí sin cambiar sus reglas — una
 * copia en cada pantalla es justo la lógica replicada que deriva en cuanto alguien toca una sola.
 * Sólo pinta: quien lo monta decide qué hace cada uno (la agenda, la visita y la sesión recargan cosas
 * distintas). `onReagendar` ausente = no se ofrece.
 */
export function BotonesEstadoCita({
  status, puedeReagendar, onConfirmar, onCompletar, onNoAsistio, onCancelar, onReagendar, deshabilitado = false,
  soloCompletar = false,
}: {
  status: string;
  /** Agendada, o pendiente/agendada ya vencida (la regla de la agenda). */
  puedeReagendar: boolean;
  onConfirmar: () => void;
  onCompletar: () => void;
  onNoAsistio: () => void;
  onCancelar: () => void;
  onReagendar?: () => void;
  deshabilitado?: boolean;
  /** «Cobros» del expediente: sólo «Completar» (completar y cobrar); lo demás vive en la visita. */
  soloCompletar?: boolean;
}) {
  if (status !== "PENDING" && status !== "CONFIRMED") return null;
  if (soloCompletar) {
    // Una pendiente se confirma antes de completarse (VALID_TRANSITIONS): sin «Completar», nada.
    if (status !== "CONFIRMED") return null;
    return (
      <div className="flex gap-1 flex-wrap">
        <button
          onClick={onCompletar} disabled={deshabilitado}
          className="text-xs px-2 py-1 rounded bg-green-100 text-green-700 hover:bg-green-200 font-medium disabled:opacity-50"
        >
          Completar
        </button>
      </div>
    );
  }
  return (
    <div className="flex gap-1 flex-wrap">
      {status === "PENDING" && (
        <button
          onClick={onConfirmar} disabled={deshabilitado}
          className="text-xs px-2 py-1 rounded bg-blue-100 text-blue-700 hover:bg-blue-200 disabled:opacity-50"
        >
          Confirmar
        </button>
      )}
      {/* H-070: a Pendiente can only be confirmed or cancelled (the server's VALID_TRANSITIONS); these
          two used to show anyway and fail with «transición no permitida». */}
      {status === "CONFIRMED" && (
        <>
          <button
            onClick={onCompletar} disabled={deshabilitado}
            className="text-xs px-2 py-1 rounded bg-green-100 text-green-700 hover:bg-green-200 font-medium disabled:opacity-50"
          >
            Completar
          </button>
          <button
            onClick={onNoAsistio} disabled={deshabilitado}
            className="text-xs px-2 py-1 rounded bg-orange-100 text-orange-700 hover:bg-orange-200 disabled:opacity-50"
          >
            No asistió
          </button>
        </>
      )}
      <button
        onClick={onCancelar} disabled={deshabilitado}
        className="text-xs px-2 py-1 rounded bg-red-100 text-red-700 hover:bg-red-200 disabled:opacity-50"
      >
        {/* «Cancelar cita», no «Cancelar» (2026-10-12): en la sesión y el tratamiento conviven otros
            «Cancelar …» y uno suelto no decía qué. */}
        Cancelar cita
      </button>
      {puedeReagendar && onReagendar && (
        <button
          onClick={onReagendar} disabled={deshabilitado}
          className="text-xs px-2 py-1 rounded bg-amber-100 text-amber-700 hover:bg-amber-200 flex items-center gap-1 disabled:opacity-50"
        >
          <CalendarClock className="w-3 h-3" />
          Reagendar
        </button>
      )}
    </div>
  );
}

/** «Vencida» de la agenda (`getEffectiveStatus` en useBookings): pendiente/agendada cuya hora de fin ya pasó. */
export function citaVencida(status: string, fecha: string | null | undefined, horaFin: string | null | undefined): boolean {
  const nowMx = new Date().toLocaleString("sv-SE", { timeZone: "America/Mexico_City" });
  const dia = (fecha ?? "").split("T")[0];
  return (status === "PENDING" || status === "CONFIRMED") && !!dia && !!horaFin && `${dia} ${horaFin}:00` < nowMx;
}

/** La regla de la agenda para «Reagendar»: agendada, o pendiente/agendada cuya hora de fin ya pasó. */
export function citaReagendable(status: string, fecha: string | null | undefined, horaFin: string | null | undefined): boolean {
  return status === "CONFIRMED" || citaVencida(status, fecha, horaFin);
}
