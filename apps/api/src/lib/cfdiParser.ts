/**
 * CFDI XML Parser
 * Parses Mexican electronic invoices (Comprobante Fiscal Digital por Internet)
 *
 * NOTE: Requires xml2js package
 * Install with: npm install xml2js @types/xml2js
 */

import xml2js from 'xml2js';

export interface CFDIData {
  uuid: string;
  folio: string;
  fecha: Date;
  subtotal: number;
  total: number;
  iva: number;
  moneda: string;
  metodoPago: string;
  formaPago: string;
  rfcEmisor: string;
  nombreEmisor?: string;
  rfcReceptor: string;
  nombreReceptor?: string;
}

/**
 * Parse CFDI XML and extract key fiscal data
 */
export async function parseCFDIXml(xmlContent: string): Promise<CFDIData> {
  try {
    const parser = new xml2js.Parser({
      explicitArray: false,
      mergeAttrs: true
    });

    const result = await parser.parseStringPromise(xmlContent);

    // CFDI 3.3 and 4.0 support
    // Try different namespaces
    const comprobante =
      result['cfdi:Comprobante'] ||
      result['Comprobante'] ||
      result['cfdi33:Comprobante'];

    if (!comprobante) {
      throw new Error('Formato XML inválido: no se encontró el elemento Comprobante');
    }

    // Extract UUID from Timbre Fiscal Digital
    let uuid = '';
    const complemento = comprobante['cfdi:Complemento'] || comprobante['Complemento'];

    if (complemento) {
      const timbre =
        complemento['tfd:TimbreFiscalDigital'] ||
        complemento['TimbreFiscalDigital'];

      if (timbre) {
        uuid = timbre.UUID || timbre['$']?.UUID || '';
      }
    }

    // Extract emisor data
    const emisor = comprobante['cfdi:Emisor'] || comprobante['Emisor'];
    const rfcEmisor = emisor?.Rfc || emisor?.['$']?.Rfc || '';
    const nombreEmisor = emisor?.Nombre || emisor?.['$']?.Nombre;

    // Extract receptor data
    const receptor = comprobante['cfdi:Receptor'] || comprobante['Receptor'];
    const rfcReceptor = receptor?.Rfc || receptor?.['$']?.Rfc || '';
    const nombreReceptor = receptor?.Nombre || receptor?.['$']?.Nombre;

    // Extract amounts
    const subtotal = parseFloat(comprobante.SubTotal || '0');
    const total = parseFloat(comprobante.Total || '0');

    // Calculate IVA (usually total - subtotal, or from Impuestos section)
    let iva = total - subtotal;

    // Try to get IVA from Impuestos if available
    const impuestos = comprobante['cfdi:Impuestos'] || comprobante['Impuestos'];
    if (impuestos) {
      const totalImpuestosTrasladados = impuestos.TotalImpuestosTrasladados || impuestos['$']?.TotalImpuestosTrasladados;
      if (totalImpuestosTrasladados) {
        iva = parseFloat(totalImpuestosTrasladados);
      }
    }

    // Extract other fields
    const folio = comprobante.Folio || 'S/N';
    const fecha = new Date(comprobante.Fecha);
    const moneda = comprobante.Moneda || 'MXN';
    const metodoPago = comprobante.MetodoPago || '';
    const formaPago = comprobante.FormaPago || '';

    // Validate required fields
    if (!uuid) {
      throw new Error('UUID no encontrado en el XML');
    }

    if (!rfcEmisor || !rfcReceptor) {
      throw new Error('RFC del emisor o receptor no encontrado');
    }

    if (isNaN(total) || total <= 0) {
      throw new Error('Total inválido en el XML');
    }

    return {
      uuid,
      folio,
      fecha,
      subtotal,
      total,
      iva,
      moneda,
      metodoPago,
      formaPago,
      rfcEmisor,
      nombreEmisor,
      rfcReceptor,
      nombreReceptor
    };
  } catch (error: any) {
    console.error('Error parsing CFDI XML:', error);

    if (error.message.includes('UUID') || error.message.includes('RFC') || error.message.includes('Total')) {
      throw error;
    }

    throw new Error(`Error al parsear XML: ${error.message}`);
  }
}

/**
 * Validate if string is valid XML
 */
export function isValidXML(xmlString: string): boolean {
  try {
    const parser = new xml2js.Parser();
    parser.parseStringPromise(xmlString);
    return true;
  } catch {
    return false;
  }
}

/**
 * Extract UUID from XML without full parsing (quick check)
 */
export async function extractUUID(xmlContent: string): Promise<string | null> {
  try {
    const data = await parseCFDIXml(xmlContent);
    return data.uuid;
  } catch {
    return null;
  }
}
