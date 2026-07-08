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

  // Comprobante header + timbre (used as metadata fallback when SAT's
  // metadata endpoint fails but the XML download succeeds)
  fecha: string | null;
  tipoDeComprobante: string | null;
  rfcEmisor: string | null;
  nombreEmisor: string | null;
  rfcReceptor: string | null;
  nombreReceptor: string | null;
  fechaTimbrado: string | null;
  rfcProvCertif: string | null;

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

  const emisor = extractParty(xml, 'Emisor');
  const receptor = extractParty(xml, 'Receptor');
  const timbre = extractTimbre(xml);

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
    fecha: extractAttrString(xml, 'Fecha'),
    tipoDeComprobante: extractAttrString(xml, 'TipoDeComprobante'),
    rfcEmisor: emisor.rfc,
    nombreEmisor: emisor.nombre,
    rfcReceptor: receptor.rfc,
    nombreReceptor: receptor.nombre,
    fechaTimbrado: timbre.fechaTimbrado,
    rfcProvCertif: timbre.rfcProvCertif,
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

  // Negative lookbehind prevents "Total" matching inside "SubTotal"
  const re = new RegExp(`(?<![a-zA-Z])${attr}="([^"]+)"`, 'i');
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

  // Negative lookbehind prevents partial attribute name matches
  const re = new RegExp(`(?<![a-zA-Z])${attr}="([^"]+)"`, 'i');
  const match = comprobanteMatch[0].match(re);
  return match ? match[1] : null;
}

/**
 * Extract Rfc + Nombre from the Emisor or Receptor node.
 * Negative lookbehind keeps Rfc from matching inside longer attribute names.
 */
function extractParty(xml: string, node: 'Emisor' | 'Receptor'): { rfc: string | null; nombre: string | null } {
  const nodeMatch = xml.match(new RegExp(`<[a-zA-Z0-9]*:?${node}\\s([^>]*?)/?>`, 'i'));
  if (!nodeMatch) return { rfc: null, nombre: null };
  const attrs = nodeMatch[1];
  const rfc = attrs.match(/(?<![a-zA-Z])Rfc="([^"]*)"/i);
  const nombre = attrs.match(/(?<![a-zA-Z])Nombre="([^"]*)"/i);
  return {
    rfc: rfc ? rfc[1] : null,
    nombre: nombre ? decodeXmlEntities(nombre[1]) : null,
  };
}

/**
 * Extract FechaTimbrado + RfcProvCertif from the TimbreFiscalDigital complement.
 */
function extractTimbre(xml: string): { fechaTimbrado: string | null; rfcProvCertif: string | null } {
  const nodeMatch = xml.match(/<[a-zA-Z0-9]*:?TimbreFiscalDigital\s[^>]*>/i);
  if (!nodeMatch) return { fechaTimbrado: null, rfcProvCertif: null };
  const fecha = nodeMatch[0].match(/FechaTimbrado="([^"]*)"/i);
  const pac = nodeMatch[0].match(/RfcProvCertif="([^"]*)"/i);
  return {
    fechaTimbrado: fecha ? fecha[1] : null,
    rfcProvCertif: pac ? pac[1] : null,
  };
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
  baseDr: number | null;
  ivaTrasladadoDr: number | null;
  isrRetenidoDr: number | null;
  ivaRetenidoDr: number | null;
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

    // Extract DoctoRelacionado nodes (may contain child elements like ImpuestosDR)
    const docRegex = /<[^>]*:?DoctoRelacionado\s([^>]+?)(?:\/>|>([\s\S]*?)<\/[^>]*:?DoctoRelacionado>)/gi;
    let docMatch;
    while ((docMatch = docRegex.exec(body)) !== null) {
      const docAttrs = docMatch[1];
      const docBody = docMatch[2] || '';
      const idDocumento = getAttr(docAttrs, 'IdDocumento');
      if (!idDocumento) continue;

      // Extract ImpuestosDR tax breakdown (Complemento de Pagos 2.0)
      let baseDr: number | null = null;
      let ivaTrasladadoDr: number | null = null;
      let isrRetenidoDr: number | null = null;
      let ivaRetenidoDr: number | null = null;

      // TrasladoDR: IVA trasladado (Impuesto="002")
      const trasladoRegex = /<[^>]*:?TrasladoDR\s([^>]+?)\/?\s*>/gi;
      let tMatch;
      while ((tMatch = trasladoRegex.exec(docBody)) !== null) {
        const tAttrs = tMatch[1];
        if (getAttr(tAttrs, 'ImpuestoDR') === '002') {
          baseDr = getAttrNum(tAttrs, 'BaseDR');
          ivaTrasladadoDr = getAttrNum(tAttrs, 'ImporteDR');
        }
      }

      // RetencionDR: ISR retenido (Impuesto="001"), IVA retenido (Impuesto="002")
      const retencionRegex = /<[^>]*:?RetencionDR\s([^>]+?)\/?\s*>/gi;
      let rMatch;
      while ((rMatch = retencionRegex.exec(docBody)) !== null) {
        const rAttrs = rMatch[1];
        const impuesto = getAttr(rAttrs, 'ImpuestoDR');
        if (impuesto === '001') {
          isrRetenidoDr = getAttrNum(rAttrs, 'ImporteDR');
        } else if (impuesto === '002') {
          ivaRetenidoDr = getAttrNum(rAttrs, 'ImporteDR');
        }
      }

      documentos.push({
        facturaUuid: idDocumento.toLowerCase(),
        serie: getAttr(docAttrs, 'Serie'),
        folio: getAttr(docAttrs, 'Folio'),
        montoPagado: getAttrNum(docAttrs, 'ImpPagado'),
        saldoAnterior: getAttrNum(docAttrs, 'ImpSaldoAnt'),
        saldoInsoluto: getAttrNum(docAttrs, 'ImpSaldoInsoluto'),
        numParcialidad: getAttrNum(docAttrs, 'NumParcialidad'),
        baseDr,
        ivaTrasladadoDr,
        isrRetenidoDr,
        ivaRetenidoDr,
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
