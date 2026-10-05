/**
 * TIERS Q3 — lo que se le dice al doctor cuando su plan ya no admite otro paciente ACTIVO (el servidor
 * responde `QUOTA_EXCEEDED` con `limit`/`current`). Con números: sin ellos no sabe si le falta 1 lugar
 * o 40, ni que archivar libera uno. Lo usan los dos caminos que piden un lugar desde la pantalla:
 * «Nuevo paciente» y «Reactivar» (H-041), para que digan lo mismo.
 */
export function mensajeSinCupo(d: { current?: number | null; limit?: number | null }): string {
  return d.current != null && d.limit != null
    ? `Tu plan incluye ${d.limit} pacientes activos y ya tienes ${d.current}. ` +
      `Archiva un expediente para liberar lugar (archivar no borra nada) o cambia de plan.`
    : 'Tu plan no permite más pacientes activos. Archiva un expediente para liberar lugar o cambia de plan.';
}
