/**
 * Who a sale was sold to — VENTAS PACIENTE paso 3. New sales go to a PATIENT (`sale.patient`, attached
 * by the API from `sales.patient_id`); old ones (test accounts) only have their `client`. Every screen
 * that names the buyer goes through here instead of reading `sale.client` (which is now nullable and
 * would crash a patient sale at runtime — the local types used to say it always exists).
 */
/** Name + internal id only: the Ventas API doesn't hand out the patient's contact/fiscal data. */
export interface VentaPatient {
  id: string;
  firstName: string;
  lastName: string;
  internalId: string;
}

export interface VentaClient {
  id: number;
  businessName: string;
  contactName: string | null;
  email: string | null;
  phone: string | null;
  rfc?: string | null;
  street?: string | null;
  city?: string | null;
  state?: string | null;
  postalCode?: string | null;
}

export interface Comprador {
  esPaciente: boolean;
  nombre: string;
  /** Second line under the name: the patient's internal id, or the client's contact person. */
  detalle: string | null;
  email: string | null;
  phone: string | null;
  rfc: string | null;
  direccion: string | null;
}

export function compradorDeVenta(sale: { patient?: VentaPatient | null; client?: VentaClient | null }): Comprador {
  const p = sale.patient;
  if (p) {
    return {
      esPaciente: true,
      nombre: `${p.firstName} ${p.lastName}`.trim(),
      detalle: p.internalId ? `ID ${p.internalId}` : null,
      email: null, phone: null, rfc: null, direccion: null,
    };
  }
  const c = sale.client;
  if (c) {
    const direccion = [c.street, c.city, c.state, c.postalCode].map((s) => s?.trim()).filter(Boolean).join(', ');
    return {
      esPaciente: false,
      nombre: c.businessName,
      detalle: c.contactName && c.contactName !== c.businessName ? c.contactName : null,
      email: c.email, phone: c.phone, rfc: c.rfc ?? null, direccion: direccion || null,
    };
  }
  // A patient sale whose patient was deleted (plain link, no FK): say it, don't render blank.
  return { esPaciente: true, nombre: 'Paciente eliminado', detalle: null, email: null, phone: null, rfc: null, direccion: null };
}
