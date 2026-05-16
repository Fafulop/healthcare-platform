/**
 * SAT CFDI 4.0 XML Parser — Zero dependencies
 *
 * Parses CFDI XML files extracted from SAT bulk download ZIPs.
 * Uses regex-based parsing (no DOM needed — CFDI structure is predictable).
 *
 * Key namespaces in CFDI 4.0:
 * - cfdi: http://www.sat.gob.mx/cfd/4 (main structure)
 * - tfd: http://www.sat.gob.mx/TimbreFiscalDigital (UUID, certification)
 * - pago20: http://www.sat.gob.mx/Pagos20 (payment complements)
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface CfdiDetail {
  uuid: string;

  // Financial breakdown
  subtotal: number | null;
  descuento: number | null;
  total: number | null;

  // Taxes
  ivaTrasladado: number | null;
  isrRetenido: number | null;
  ivaRetenido: number | null;
  ieps: number | null;

  // Payment info
  metodoPago: string | null;
  formaPago: string | null;
  usoCfdi: string | null;
  moneda: string | null;
  tipoCambio: number | null;

  // Series
  serie: string | null;
  folio: string | null;
  lugarExpedicion: string | null;

  // Line items
  conceptos: CfdiConcepto[];
}

export interface CfdiConcepto {
  claveProdServ: string | null;
  descripcion: string | null;
  cantidad: number | null;
  claveUnidad: string | null;
  unidad: string | null;
  valorUnitario: number | null;
  importe: number | null;
  descuento: number | null;
  ivaTrasladado: number | null;
  isrRetenido: number | null;
}

// ---------------------------------------------------------------------------
// Main Parser
// ---------------------------------------------------------------------------

/**
 * Parse a single CFDI XML string into structured detail data.
 * Returns null if UUID cannot be extracted (invalid/unrecognized format).
 */
export function parseCfdiXml(xml: string): CfdiDetail | null {
  const uuid = extractUuid(xml);
  if (!uuid) return null;

  return {
    uuid: uuid.toLowerCase(),
    subtotal: extractAttrNumber(xml, 'SubTotal'),
    descuento: extractAttrNumber(xml, 'Descuento'),
    total: extractAttrNumber(xml, 'Total'),
    ivaTrasladado: extractTaxTraslado(xml, '002'), // 002 = IVA
    isrRetenido: extractTaxRetencion(xml, '001'),  // 001 = ISR
    ivaRetenido: extractTaxRetencion(xml, '002'),  // 002 = IVA retenido
    ieps: extractTaxTraslado(xml, '003'),          // 003 = IEPS
    metodoPago: extractAttrString(xml, 'MetodoPago'),
    formaPago: extractAttrString(xml, 'FormaPago'),
    usoCfdi: extractUsoCfdi(xml),
    moneda: extractAttrString(xml, 'Moneda'),
    tipoCambio: extractAttrNumber(xml, 'TipoCambio'),
    serie: extractAttrString(xml, 'Serie'),
    folio: extractAttrString(xml, 'Folio'),
    lugarExpedicion: extractAttrString(xml, 'LugarExpedicion'),
    conceptos: extractConceptos(xml),
  };
}

// ---------------------------------------------------------------------------
// Extraction Helpers
// ---------------------------------------------------------------------------

/**
 * Extract UUID from TimbreFiscalDigital complement.
 */
function extractUuid(xml: string): string | null {
  // tfd:TimbreFiscalDigital UUID="..."
  const match = xml.match(/TimbreFiscalDigital[^>]+UUID="([^"]+)"/i);
  return match ? match[1] : null;
}

/**
 * Extract a numeric attribute from the root Comprobante node.
 */
function extractAttrNumber(xml: string, attr: string): number | null {
  // Look in the root <cfdi:Comprobante ...> tag (first occurrence)
  const comprobanteMatch = xml.match(/<[^>]*Comprobante[^>]*>/);
  if (!comprobanteMatch) return null;

  const re = new RegExp(`${attr}="([^"]+)"`, 'i');
  const match = comprobanteMatch[0].match(re);
  if (!match) return null;

  const val = parseFloat(match[1]);
  return isNaN(val) ? null : val;
}

/**
 * Extract a string attribute from the root Comprobante node.
 */
function extractAttrString(xml: string, attr: string): string | null {
  const comprobanteMatch = xml.match(/<[^>]*Comprobante[^>]*>/);
  if (!comprobanteMatch) return null;

  const re = new RegExp(`${attr}="([^"]+)"`, 'i');
  const match = comprobanteMatch[0].match(re);
  return match ? match[1] : null;
}

/**
 * Extract UsoCFDI from the Receptor node.
 */
function extractUsoCfdi(xml: string): string | null {
  const match = xml.match(/Receptor[^>]+UsoCFDI="([^"]+)"/i);
  return match ? match[1] : null;
}

/**
 * Extract total traslado tax amount by impuesto code from the Impuestos/Traslados section.
 * Looks at the summary level (not per-concepto).
 */
function extractTaxTraslado(xml: string, impuestoCode: string): number | null {
  // Find <cfdi:Impuestos ...> section (the top-level one, not inside conceptos)
  // The top-level Impuestos node has TotalImpuestosTrasladados attribute
  const impuestosSection = xml.match(/<[^>]*:?Impuestos[^>]*TotalImpuestos[^>]*>[\s\S]*?<\/[^>]*:?Impuestos>/i);
  if (!impuestosSection) {
    // Fallback: no top-level Impuestos found (rare for well-formed CFDIs).
    // Sum all Traslado nodes — may include per-concepto duplicates, but this
    // path only triggers for unusual/malformed XML structures.
    const re = new RegExp(`<[^>]*:?Traslado[^>]+Impuesto="${impuestoCode}"[^>]+Importe="([^"]+)"`, 'gi');
    let total = 0;
    let found = false;
    let match;
    while ((match = re.exec(xml)) !== null) {
      total += parseFloat(match[1]) || 0;
      found = true;
    }
    return found ? total : null;
  }

  // Within the Impuestos section, find Traslado with matching Impuesto code
  const re = new RegExp(`<[^>]*:?Traslado[^>]+Impuesto="${impuestoCode}"[^>]+Importe="([^"]+)"`, 'gi');
  let total = 0;
  let found = false;
  let match;
  while ((match = re.exec(impuestosSection[0])) !== null) {
    total += parseFloat(match[1]) || 0;
    found = true;
  }

  return found ? total : null;
}

/**
 * Extract total retencion tax amount by impuesto code.
 */
function extractTaxRetencion(xml: string, impuestoCode: string): number | null {
  // Look for Retencion nodes with matching Impuesto code in top-level Impuestos
  const re = new RegExp(`<[^>]*:?Retencion[^>]+Impuesto="${impuestoCode}"[^>]+Importe="([^"]+)"`, 'gi');
  let total = 0;
  let found = false;
  let match;
  while ((match = re.exec(xml)) !== null) {
    total += parseFloat(match[1]) || 0;
    found = true;
  }
  return found ? total : null;
}

/**
 * Extract Conceptos (line items) from the XML.
 */
function extractConceptos(xml: string): CfdiConcepto[] {
  const conceptos: CfdiConcepto[] = [];

  // Match each <cfdi:Concepto ...> or <Concepto ...> tag (may be self-closing or have children)
  const conceptoRegex = /<[^>]*:?Concepto\s([^>]+?)(?:\/>|>([\s\S]*?)<\/[^>]*:?Concepto>)/gi;
  let match;

  while ((match = conceptoRegex.exec(xml)) !== null) {
    const attrs = match[1];
    const body = match[2] || '';

    const concepto: CfdiConcepto = {
      claveProdServ: getAttr(attrs, 'ClaveProdServ'),
      descripcion: getAttr(attrs, 'Descripcion'),
      cantidad: getAttrNum(attrs, 'Cantidad'),
      claveUnidad: getAttr(attrs, 'ClaveUnidad'),
      unidad: getAttr(attrs, 'Unidad'),
      valorUnitario: getAttrNum(attrs, 'ValorUnitario'),
      importe: getAttrNum(attrs, 'Importe'),
      descuento: getAttrNum(attrs, 'Descuento'),
      ivaTrasladado: extractConceptoTax(body, 'Traslado', '002'),
      isrRetenido: extractConceptoTax(body, 'Retencion', '001'),
    };

    conceptos.push(concepto);
  }

  return conceptos;
}

/**
 * Extract tax amount from within a Concepto's body (per-concept taxes).
 */
function extractConceptoTax(body: string, type: string, impuestoCode: string): number | null {
  if (!body) return null;
  const re = new RegExp(`<[^>]*:?${type}[^>]+Impuesto="${impuestoCode}"[^>]+Importe="([^"]+)"`, 'i');
  const match = body.match(re);
  return match ? (parseFloat(match[1]) || null) : null;
}

// ---------------------------------------------------------------------------
// Attribute Helpers
// ---------------------------------------------------------------------------

function getAttr(attrs: string, name: string): string | null {
  const re = new RegExp(`${name}="([^"]*)"`, 'i');
  const match = attrs.match(re);
  return match ? decodeXmlEntities(match[1]) : null;
}

function getAttrNum(attrs: string, name: string): number | null {
  const val = getAttr(attrs, name);
  if (!val) return null;
  const num = parseFloat(val);
  return isNaN(num) ? null : num;
}

function decodeXmlEntities(str: string): string {
  return str
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'");
}

// ---------------------------------------------------------------------------
// Payment Complement Parser (pago20)
// ---------------------------------------------------------------------------

export interface PagoDoctoRelacionado {
  facturaUuid: string;
  serie: string | null;
  folio: string | null;
  montoPagado: number | null;
  saldoAnterior: number | null;
  saldoInsoluto: number | null;
  numParcialidad: number | null;
}

export interface PagoComplement {
  pagoUuid: string;
  fechaPago: string | null;
  formaPago: string | null;
  monto: number | null;
  documentos: PagoDoctoRelacionado[];
}

/**
 * Parse payment complement (pago20) from a CFDI tipo P XML.
 * Returns null if no pago20 section found.
 */
export function parsePagoComplement(xml: string): PagoComplement | null {
  const pagoUuid = extractUuid(xml);
  if (!pagoUuid) return null;

  // Find <pago20:Pago ...> or <Pago ...> nodes
  const pagoRegex = /<[^>]*:?Pago\s([^>]+?)(?:\/>|>([\s\S]*?)<\/[^>]*:?Pago>)/gi;
  const documentos: PagoDoctoRelacionado[] = [];
  let fechaPago: string | null = null;
  let formaPago: string | null = null;
  let monto: number | null = null;

  let pagoMatch;
  while ((pagoMatch = pagoRegex.exec(xml)) !== null) {
    const attrs = pagoMatch[1];
    const body = pagoMatch[2] || '';

    // Skip if this is "Pagos" (plural) container instead of "Pago" (singular)
    // Check: the tag name should end with just "Pago" not "Pagos"
    const tagCheck = pagoMatch[0].match(/<([^\s>]+)/);
    if (tagCheck && tagCheck[1].endsWith('Pagos')) continue;

    fechaPago = fechaPago || getAttr(attrs, 'FechaPago');
    formaPago = formaPago || getAttr(attrs, 'FormaDePagoP');
    monto = monto || getAttrNum(attrs, 'Monto');

    // Extract DoctoRelacionado nodes
    const docRegex = /<[^>]*:?DoctoRelacionado\s([^>]+?)(?:\/>|>[^<]*<\/[^>]*:?DoctoRelacionado>)/gi;
    let docMatch;
    while ((docMatch = docRegex.exec(body)) !== null) {
      const docAttrs = docMatch[1];
      const idDocumento = getAttr(docAttrs, 'IdDocumento');
      if (!idDocumento) continue;

      documentos.push({
        facturaUuid: idDocumento.toLowerCase(),
        serie: getAttr(docAttrs, 'Serie'),
        folio: getAttr(docAttrs, 'Folio'),
        montoPagado: getAttrNum(docAttrs, 'ImpPagado'),
        saldoAnterior: getAttrNum(docAttrs, 'ImpSaldoAnt'),
        saldoInsoluto: getAttrNum(docAttrs, 'ImpSaldoInsoluto'),
        numParcialidad: getAttrNum(docAttrs, 'NumParcialidad'),
      });
    }
  }

  if (documentos.length === 0) return null;

  return {
    pagoUuid: pagoUuid.toLowerCase(),
    fechaPago,
    formaPago,
    monto,
    documentos,
  };
}
