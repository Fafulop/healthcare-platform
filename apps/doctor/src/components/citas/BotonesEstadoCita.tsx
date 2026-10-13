"use client";

import { CalendarClock, Check } from "lucide-react";
import { BotonCita } from "./fila-cita";
// La regla «Vencida» vive en lib/citas/vencida (la usan también «Visitas» y la cuenta de «Cobros»).
import { citaVencida } from "@/lib/citas/vencida";

/**
 * Los botones de ESTADO de una cita: Confirmar · Completar · No asistió · Cancelar cita · Reagendar.
 *
 * VISITAS 09-PLAN L2 (nota N3): eran el grupo «Estado» de `StatusActions` (la agenda). Se sacaron aquí
 * para que la agenda, la visita y «Cobros» pinten los MISMOS con las MISMAS reglas. Sólo pinta: quien lo
 * monta decide qué hace cada uno. `onReagendar` ausente = aquí no se reagenda (gris).
 *
 * 2026-10-12 (pedido del usuario) — SIEMPRE en el MISMO lugar y con la MISMA forma (`BotonCita`): lo que no aplica a este estado
 * se ve gris, no clicable, con el porqué al pasar el ratón; y una cita ya cerrada dice en una línea que
 * ya no cambia. Antes los botones aparecían y desaparecían según el estado (pendiente → confirmada →
 * completada) y todo lo demás de la tarjeta se recorría a su lugar: la gente ubica las cosas por dónde
 * están. Las REGLAS no cambiaron (las transiciones del servidor, VALID_TRANSITIONS): sólo qué se ve.
 */

/** Por qué una cita ya cerrada no acepta ningún botón de estado. */
function motivoTerminal(status: string): string | null {
  if (status === "COMPLETED") return "Ya está completada";
  if (status === "CANCELLED") return "La cita está cancelada";
  if (status === "NO_SHOW") return "Está marcada como «No asistió»";
  return null;
}

/** La línea bajo los botones de una cita cerrada. */
function lineaTerminal(status: string): string | null {
  if (status === "COMPLETED") return "Completada: ya no cambia de estado.";
  if (status === "CANCELLED") return "Cancelada: ya no cambia de estado.";
  if (status === "NO_SHOW") return "No asistió: ya no cambia de estado.";
  return null;
}

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
  const terminal = motivoTerminal(status);
  const linea = lineaTerminal(status);
  // H-070: una Pendiente sólo se confirma o se cancela (VALID_TRANSITIONS del servidor).
  const motivoCompletar = terminal ?? (status === "PENDING" ? "Confírmala primero" : null);
  const ocupado = deshabilitado ? "Espera a que termine lo anterior" : null;

  const completar = (
    <BotonCita etiqueta="Completar" icono={<Check className="w-3 h-3" />} variante="principal" onClick={onCompletar} motivo={motivoCompletar ?? ocupado} />
  );
  if (soloCompletar) {
    return (
      <div className="space-y-1">
        <div className="flex gap-1.5 flex-wrap">{completar}</div>
        {linea && <p className="text-xs text-gray-500">{linea}</p>}
      </div>
    );
  }

  const motivoReagendar = terminal
    ?? (!onReagendar ? "Aquí no se reagenda" : !puedeReagendar ? "Confírmala primero (o espera a que pase su hora)" : null);

  return (
    <div className="space-y-1">
      <div className="flex gap-1.5 flex-wrap">
        {/* «Confirmar» sólo existe en una cita PENDIENTE — las que llegaban de la reserva pública (2026-10-12:
            ya no se usa; quedan unas viejas, y sin confirmarlas no se pueden completar). */}
        {status === "PENDING" && (
          <BotonCita etiqueta="Confirmar" onClick={onConfirmar} motivo={ocupado} />
        )}
        {completar}
        <BotonCita etiqueta="No asistió" onClick={onNoAsistio} motivo={motivoCompletar ?? ocupado} />
        {/* «Cancelar cita», no «Cancelar» (2026-10-12): en la sesión y el tratamiento conviven otros
            «Cancelar …» y uno suelto no decía qué. */}
        <BotonCita etiqueta="Cancelar cita" variante="peligro" onClick={onCancelar} motivo={terminal ?? ocupado} />
        <BotonCita etiqueta="Reagendar" icono={<CalendarClock className="w-3 h-3" />} onClick={onReagendar} motivo={motivoReagendar ?? ocupado} />
      </div>
      {linea && <p className="text-xs text-gray-500">{linea}</p>}
    </div>
  );
}

/** La regla de la agenda para «Reagendar»: agendada, o pendiente/agendada cuya hora de fin ya pasó. */
export function citaReagendable(status: string, fecha: string | null | undefined, horaFin: string | null | undefined): boolean {
  return status === "CONFIRMED" || citaVencida(status, fecha, horaFin);
}
