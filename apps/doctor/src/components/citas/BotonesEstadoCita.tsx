"use client";

import { CalendarClock } from "lucide-react";
// La regla «Vencida» vive en lib/citas/vencida (la usan también «Visitas» y la cuenta de «Cobros»).
import { citaVencida } from "@/lib/citas/vencida";

/**
 * Los botones de ESTADO de una cita: Confirmar · Completar · No asistió · Cancelar cita · Reagendar.
 *
 * VISITAS 09-PLAN L2 (nota N3): eran el grupo «Estado» de `StatusActions` (la agenda). Se sacaron aquí
 * para que la agenda, la visita y «Cobros» pinten los MISMOS con las MISMAS reglas. Sólo pinta: quien lo
 * monta decide qué hace cada uno. `onReagendar` ausente = aquí no se reagenda (gris).
 *
 * 2026-10-12 (pedido del usuario) — SIEMPRE los cinco, en el MISMO lugar: lo que no aplica a este estado
 * se ve gris, no clicable, con el porqué al pasar el ratón; y una cita ya cerrada dice en una línea que
 * ya no cambia. Antes los botones aparecían y desaparecían según el estado (pendiente → confirmada →
 * completada) y todo lo demás de la tarjeta se recorría a su lugar: la gente ubica las cosas por dónde
 * están. Las REGLAS no cambiaron (las transiciones del servidor, VALID_TRANSITIONS): sólo qué se ve.
 */

const APAGADO = "bg-gray-100 text-gray-400 cursor-not-allowed";

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

function Boton({ etiqueta, motivo, onClick, deshabilitado, color, icono }: {
  etiqueta: string;
  /** null = aplica (clicable); un texto = gris, y ese texto es el porqué. */
  motivo: string | null;
  onClick?: () => void;
  deshabilitado: boolean;
  color: string;
  icono?: React.ReactNode;
}) {
  const activo = motivo === null && !!onClick;
  return (
    <button
      type="button"
      onClick={activo ? onClick : undefined}
      disabled={!activo || deshabilitado}
      aria-disabled={!activo}
      title={motivo ?? undefined}
      className={`text-xs px-2 py-1 rounded flex items-center gap-1 ${activo ? `${color} disabled:opacity-50` : APAGADO}`}
    >
      {icono}
      {etiqueta}
    </button>
  );
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

  if (soloCompletar) {
    return (
      <div className="space-y-1">
        <div className="flex gap-1 flex-wrap">
          <Boton etiqueta="Completar" motivo={motivoCompletar} onClick={onCompletar} deshabilitado={deshabilitado} color="bg-green-100 text-green-700 hover:bg-green-200 font-medium" />
        </div>
        {linea && <p className="text-xs text-gray-500">{linea}</p>}
      </div>
    );
  }

  const motivoReagendar = terminal
    ?? (!onReagendar ? "Aquí no se reagenda" : !puedeReagendar ? "Confírmala primero (o espera a que pase su hora)" : null);

  return (
    <div className="space-y-1">
      <div className="flex gap-1 flex-wrap">
        <Boton
          etiqueta={status === "PENDING" ? "Confirmar" : "Confirmada"}
          motivo={terminal ?? (status === "PENDING" ? null : "Ya está confirmada")}
          onClick={onConfirmar} deshabilitado={deshabilitado}
          color="bg-blue-100 text-blue-700 hover:bg-blue-200"
        />
        <Boton etiqueta="Completar" motivo={motivoCompletar} onClick={onCompletar} deshabilitado={deshabilitado} color="bg-green-100 text-green-700 hover:bg-green-200 font-medium" />
        <Boton etiqueta="No asistió" motivo={motivoCompletar} onClick={onNoAsistio} deshabilitado={deshabilitado} color="bg-orange-100 text-orange-700 hover:bg-orange-200" />
        {/* «Cancelar cita», no «Cancelar» (2026-10-12): en la sesión y el tratamiento conviven otros
            «Cancelar …» y uno suelto no decía qué. */}
        <Boton etiqueta="Cancelar cita" motivo={terminal} onClick={onCancelar} deshabilitado={deshabilitado} color="bg-red-100 text-red-700 hover:bg-red-200" />
        <Boton
          etiqueta="Reagendar" motivo={motivoReagendar} onClick={onReagendar} deshabilitado={deshabilitado}
          color="bg-amber-100 text-amber-700 hover:bg-amber-200" icono={<CalendarClock className="w-3 h-3" />}
        />
      </div>
      {linea && <p className="text-xs text-gray-500">{linea}</p>}
    </div>
  );
}

/** La regla de la agenda para «Reagendar»: agendada, o pendiente/agendada cuya hora de fin ya pasó. */
export function citaReagendable(status: string, fecha: string | null | undefined, horaFin: string | null | undefined): boolean {
  return status === "CONFIRMED" || citaVencida(status, fecha, horaFin);
}
