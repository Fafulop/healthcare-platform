/**
 * «Vencida» de la agenda (`getEffectiveStatus` en useBookings): pendiente/agendada cuya hora de fin ya pasó
 * (hora de la clínica). Vive aquí, no en un componente de botones: la usan los botones de estado, la
 * tarjeta «Visitas» y la cuenta del paciente («Cobros»).
 */
export function citaVencida(status: string, fecha: string | null | undefined, horaFin: string | null | undefined): boolean {
  const nowMx = new Date().toLocaleString("sv-SE", { timeZone: "America/Mexico_City" });
  const dia = (fecha ?? "").split("T")[0];
  return (status === "PENDING" || status === "CONFIRMED") && !!dia && !!horaFin && `${dia} ${horaFin}:00` < nowMx;
}

/**
 * ¿Ya pasó? Como `citaVencida`, y una cita SIN hora de fin (filas viejas o importadas) se decide por el DÍA:
 * si no, se quedaba «próxima» para siempre (code review de la cuenta, 2026-10-12).
 */
export function citaYaPaso(status: string, fecha: string | null | undefined, horaFin: string | null | undefined): boolean {
  if (horaFin) return citaVencida(status, fecha, horaFin);
  const dia = (fecha ?? "").split("T")[0];
  const hoy = new Date().toLocaleString("sv-SE", { timeZone: "America/Mexico_City" }).split(" ")[0];
  return (status === "PENDING" || status === "CONFIRMED") && !!dia && dia < hoy;
}
