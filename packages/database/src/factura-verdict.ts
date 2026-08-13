/**
 * COMPOSITE "facturada" verdict — SINGLE SOURCE OF TRUTH.
 *
 * "¿Ya se facturó este ingreso?" has THREE independent pieces of evidence, and
 * every surface used to answer with a DIFFERENT subset of them:
 *
 *   surface                                     platform CFDI · uploaded PDF/XML · external (SAT)
 *   agenda      api/appointments/bookings            ✅              ✅                ❌
 *   expediente  doctor/api/medical-records/…         ✅              ❌                ❌
 *   agent       agenda-agent/modules/facturas        ✅              ❌                ✅
 *
 * So the agenda missed facturas the SAT found, the agent missed PDFs the doctor
 * uploaded, and the expediente missed both — while all three rendered a
 * "Sin factura" state next to a button that stamps a NEW CFDI. A false "not
 * invoiced" costs a duplicate legal document that can only be undone by trámite
 * ante el SAT; a false "invoiced" costs the doctor one look. The rule is built
 * around that asymmetry: ANY credible evidence of a factura wins.
 *
 * The verdict is resolved SERVER-SIDE and shipped as a boolean (regla 0) — no
 * client re-derives it from the raw signals.
 */

/** Which evidence carried the verdict (for copy: "factura subida", "vía SAT"…). */
export type FacturaVia = 'plataforma' | 'subida' | 'externa_sat';

export interface FacturaEvidence {
  /**
   * Dueño del ingreso. NO es decorativo: `SatCfdiMetadata` es
   * `@@unique([doctorId, uuid])`, o sea que un mismo uuid tiene UNA FILA POR
   * DOCTOR (el que lo emitió y el que lo recibió), y sus `satStatus` pueden
   * DISCREPAR — el fallback por XML del worker escribe `satStatus: 'Vigente'`
   * a ciegas (cron/sat-sync-worker, "emitidos may include cancelados we can't
   * detect from the XML"). Buscar solo por uuid dejaba ganar a una fila
   * arbitraria, de otro doctor.
   */
  doctorId: string;
  /**
   * ALL `CfdiEmitted` rows of the ledger entry — do NOT pre-filter by status in
   * the query: the status rule lives here, and a caller that filters to
   * `status: 'active'` silently re-introduces the drift this file exists to end.
   */
  cfdisEmitted: { status: string }[];
  /** `LedgerFactura` (PDF subida a mano) — presence is the whole signal. */
  facturas: { id: number }[];
  /** `LedgerFacturaXml` (XML subido a mano) — presence is the whole signal. */
  facturasXml: { id: number }[];
  /** UUID of a CFDI detected vía SAT Descarga (see the ordering note below). */
  satCfdiUuid: string | null;
}

export interface FacturaVerdict {
  facturada: boolean;
  via: FacturaVia | null;
}

/**
 * A CFDI sent to cancellation but NOT yet accepted by the SAT still exists as a
 * legal document, so it counts as invoiced: re-emitting on top of it is exactly
 * the duplicate this verdict prevents. Only a confirmed `cancelled` un-invoices
 * the income (H8 — the cancel route resets `hasFactura` for the same reason).
 */
const CANCELLED_STATUS = 'cancelled';

/**
 * @param evidence  the entry's evidence, or null when the cita never generated
 *                  an income at all (⇒ never invoiced).
 * @param satStatusByDoctorUuid  clave de `satStatusKey` → `SatCfdiMetadata.satStatus`
 *                  ('Vigente' | 'Cancelado'), construida con `buildSatStatusMap`.
 *                  OPCIONAL: quien no pueda pagar la consulta la omite y el uuid
 *                  externo se toma al pie de la letra — "no lo encontré" no es
 *                  "está cancelado", y la asimetría de arriba dice que ante la
 *                  duda hay que errar hacia "ya está facturada".
 */
export function resolveFacturaVerdict(
  evidence: FacturaEvidence | null | undefined,
  satStatusByDoctorUuid?: ReadonlyMap<string, string>
): FacturaVerdict {
  if (!evidence) return { facturada: false, via: null };

  // 1. Emitida por la plataforma.
  if (evidence.cfdisEmitted.some((c) => c.status !== CANCELLED_STATUS)) {
    return { facturada: true, via: 'plataforma' };
  }

  // 2. Subida a mano. El doctor que factura por fuera la registra así, y para
  //    él la cita SÍ está facturada — no hay CFDI nuestro que encontrar.
  if (evidence.facturas.length > 0 || evidence.facturasXml.length > 0) {
    return { facturada: true, via: 'subida' };
  }

  // 3. Externa, detectada vía SAT Descarga. Va AL FINAL a propósito: al timbrar
  //    nosotros también estampamos `satCfdiUuid` en el ingreso, y al cancelar se
  //    limpia si era nuestro — así que un uuid que sobrevive hasta aquí es de
  //    verdad una factura ajena a la plataforma.
  if (evidence.satCfdiUuid) {
    const satStatus = satStatusByDoctorUuid?.get(satStatusKey(evidence.doctorId, evidence.satCfdiUuid));
    if (satStatus !== 'Cancelado') return { facturada: true, via: 'externa_sat' };
  }

  return { facturada: false, via: null };
}

/**
 * Clave del lookup: doctor + uuid en minúsculas. Las DOS mitades importan.
 *  · el doctor, porque el mismo uuid vive una vez por doctor (ver `doctorId`);
 *  · el case, porque `satCfdiUuid` se escribe en MAYÚSCULAS por unos caminos
 *    (facturacion/cfdi al timbrar) y VERBATIM por otros (sat-auto-register
 *    copia el uuid de la metadata tal cual), así que las dos tablas no
 *    garantizan el mismo case.
 */
export function satStatusKey(doctorId: string, uuid: string): string {
  return `${doctorId}|${uuid.toLowerCase()}`;
}

/** Builds the lookup `resolveFacturaVerdict` expects from `SatCfdiMetadata` rows. */
export function buildSatStatusMap(
  metas: { doctorId: string; uuid: string; satStatus: string }[]
): Map<string, string> {
  return new Map(metas.map((m) => [satStatusKey(m.doctorId, m.uuid), m.satStatus]));
}

/**
 * Los valores que hay que mandarle a `WHERE uuid IN (…)`. Postgres compara
 * `VarChar` con case sensitivity, así que un lookup con el valor crudo del
 * ledger PIERDE la fila cuando las tablas difieren en case — y perderla se lee
 * como "no está cancelada". Mismo hedge que `fetchVerdictData` en el módulo de
 * facturas del agente, que ya lo traía.
 */
export function satUuidQueryVariants(uuids: string[]): string[] {
  return Array.from(new Set(uuids.flatMap((u) => [u.toUpperCase(), u.toLowerCase()])));
}
