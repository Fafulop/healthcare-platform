import { NextResponse } from 'next/server';

/**
 * POST /api/practice-management/ledger/tratamiento-pago — APAGADA (410).
 *
 * TRATAMIENTOS v2 · V2 (2026-10-02, decisión del usuario): ya no hay paquetes. El total de un
 * tratamiento es la suma de sus sesiones y cada sesión se cobra al concluir su cita, así que ya no
 * existe «Registrar pago del paquete». Los movimientos que esta ruta creó (T6) se quedan en Flujo de
 * Dinero tal como están. Plan: docs/DESDE JUNIO/VISITAS/06-PLAN-tratamientos-v2.md §5.
 */
export async function POST() {
  return NextResponse.json(
    { error: 'Ya no hay paquetes: cada sesión se cobra al concluir su cita.' },
    { status: 410 },
  );
}
