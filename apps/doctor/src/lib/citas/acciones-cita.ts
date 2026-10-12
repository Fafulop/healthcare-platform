import { authFetch } from "@/lib/auth-fetch";
import { toast } from "@/lib/practice-toast";
import { practiceConfirm } from "@/lib/practice-confirm";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "";

const NOMBRE_PROVEEDOR: Record<string, string> = { stripe: "Stripe", mercadopago: "Mercado Pago" };

/**
 * VISITAS 09-PLAN L2 (nota N3) — las acciones de ESTADO de una cita, en un solo lugar. Vivían dentro de
 * `useBookings` (la agenda); la visita y la sesión del tratamiento ofrecen las MISMAS, así que se
 * sacaron aquí sin cambiarles nada: mismas confirmaciones, mismo PATCH, mismos avisos. Quien llama
 * recarga lo suyo después.
 */

/**
 * H-010 / H-054: al concluir (con cobro), cancelar, marcar «No asistió» o eliminar, el servidor
 * apaga el link de pago vivo de la cita (`linksDesactivados` en la respuesta). Se le dice al doctor.
 * Si el proveedor no respondió, el link SIGUE activo: se dice dónde desactivarlo. (Y no se promete
 * «ya no puede pagarlo»: una ficha de OXXO generada antes todavía se puede pagar.)
 */
export function avisarLinksDesactivados(
  links:
    | { desactivados: string[]; fallidos: string[]; imposibles?: string[]; errorLectura?: boolean }
    | undefined
) {
  if (!links) return;
  const nombres = (ps: string[]) => ps.map((p) => NOMBRE_PROVEEDOR[p] ?? p).join(" y ");
  if (links.fallidos.length > 0) {
    toast.warning(`No se pudo desactivar el link de pago en ${nombres(links.fallidos)}: sigue activo. Desactívalo desde «Pagos».`);
  }
  if (links.imposibles && links.imposibles.length > 0) {
    const q = nombres(links.imposibles);
    toast.warning(`El link de pago de la cita sigue activo en ${q} y no podemos desactivarlo desde aquí: desactívalo desde tu cuenta de ${q}.`);
  }
  if (links.errorLectura) {
    toast.warning("No pudimos revisar si la cita tenía un link de pago activo. Revísalo en «Pagos».");
  }
  if (links.desactivados.length > 0 && links.fallidos.length === 0 && !links.imposibles?.length) {
    toast.success("Se desactivó el link de pago de la cita: ya no acepta pagos nuevos.");
  }
}

/**
 * Cancelar una cita SIN preguntar: la pregunta ya la hizo quien llama (cancelar la sesión o el tratamiento
 * cancela SU cita — decisión del usuario 2026-10-12: una acción, un resultado). Mismo PATCH que la agenda,
 * con sus efectos (aviso al paciente, Google Calendar, apagar el link). Sin toast de éxito: lo dice quien
 * llama. `error` = el motivo del servidor, para decir cuál falló.
 */
export async function cancelarCitaSinPreguntar(bookingId: string): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const response = await authFetch(
      `${API_URL}/api/appointments/bookings/${bookingId}`,
      { method: "PATCH", body: JSON.stringify({ status: "CANCELLED" }) }
    );
    const data = await response.json().catch(() => null);
    if (response.ok && data?.success) {
      avisarLinksDesactivados(data.linksDesactivados);
      return { ok: true };
    }
    return { ok: false, error: data?.error || "no se pudo cancelar" };
  } catch {
    return { ok: false, error: "no se pudo cancelar" };
  }
}

/**
 * Confirmar / Cancelar / No asistió. Cancelar y No asistió piden confirmación (H-031: «No asistió» es
 * final). Devuelve `true` sólo si el servidor lo aplicó (`false` = el doctor dijo que no, o falló).
 */
export async function cambiarEstadoCita(bookingId: string, newStatus: string): Promise<boolean> {
  if (
    newStatus === "CANCELLED" &&
    !await practiceConfirm("¿Estás seguro de que quieres cancelar esta cita?")
  )
    return false;
  // H-031: «No asistió» is final too (no way back) — it used to be a single click with no confirmation.
  if (
    newStatus === "NO_SHOW" &&
    !await practiceConfirm("¿Marcar que el paciente no asistió? No se puede deshacer.")
  )
    return false;

  try {
    const response = await authFetch(
      `${API_URL}/api/appointments/bookings/${bookingId}`,
      { method: "PATCH", body: JSON.stringify({ status: newStatus }) }
    );
    const data = await response.json();

    if (data.success) {
      toast.success(data.message || "Estado actualizado exitosamente");
      avisarLinksDesactivados(data.linksDesactivados);
      return true;
    }
    toast.error(data.error || "Error al actualizar estado");
    return false;
  } catch {
    toast.error("Error al actualizar estado");
    return false;
  }
}

/** Completar = COMPLETED + el ingreso en UNA llamada (lo que pide «Completar cita»). */
export async function completarCita(
  bookingId: string, price: number, formaDePago: string,
): Promise<{ ok: boolean; ledgerEntryId?: number }> {
  try {
    // Mark COMPLETED + record income in ONE call. The income LedgerEntry is created by
    // the API as an internal effect of the (citas-permitted) completion — NOT a separate
    // flujo-gated POST — so it also works for secondary users without `flujo`
    // (00-REQUISITOS §3.6). The server rebuilds concept/area/patient identity from the
    // booking; the client only supplies the price + forma de pago the user entered.
    const res = await authFetch(
      `${API_URL}/api/appointments/bookings/${bookingId}`,
      {
        method: "PATCH",
        body: JSON.stringify({
          status: "COMPLETED",
          income: { price, formaDePago },
        }),
      }
    );
    const data = await res.json();
    if (!data.success) {
      toast.error(data.error || "Error al completar la cita");
      return { ok: false };
    }
    if (data.ledgerWarning) {
      toast.error("Cita completada, pero hubo un error al crear el movimiento en Flujo de Dinero");
    } else if (data.ledgerAlreadyExisted) {
      // H2: a paid payment link already created this cita's income via webhook.
      toast.success("Cita completada · el ingreso ya estaba registrado (pagado con link de pago)");
    } else if (data.cobroRegistrado) {
      toast.success("Cita completada · ingreso registrado en Flujo de Dinero");
    } else {
      // El servidor no registró cobro (monto 0).
      toast.success("Cita completada · no se registró ningún ingreso");
    }
    avisarLinksDesactivados(data.linksDesactivados);
    return { ok: true, ledgerEntryId: data.ledgerEntryId };
  } catch {
    toast.error("Error al completar la cita");
    return { ok: false };
  }
}
