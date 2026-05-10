/**
 * Facturama API Multiemisor Client
 * Handles CFDI emission for multiple RFC issuers (doctors) from a single platform account.
 *
 * Docs: https://facturama.elevio.help/es/articles/141
 * Sandbox: https://apisandbox.facturama.mx
 * Production: https://api.facturama.mx
 *
 * Auth: HTTP Basic Auth (user:password base64 encoded)
 */

const FACTURAMA_API_URL = process.env.FACTURAMA_API_URL || 'https://apisandbox.facturama.mx';
const FACTURAMA_USER = process.env.FACTURAMA_USER || '';
const FACTURAMA_PASSWORD = process.env.FACTURAMA_PASSWORD || '';

function getAuthHeader(): string {
  const credentials = Buffer.from(`${FACTURAMA_USER}:${FACTURAMA_PASSWORD}`).toString('base64');
  return `Basic ${credentials}`;
}

function isConfigured(): boolean {
  return !!(FACTURAMA_USER && FACTURAMA_PASSWORD);
}

export class FacturamaError extends Error {
  status: number;
  details: any;

  constructor(message: string, status: number, details?: any) {
    super(message);
    this.name = 'FacturamaError';
    this.status = status;
    this.details = details;
  }
}

async function request<T>(
  method: string,
  path: string,
  body?: any
): Promise<T> {
  if (!isConfigured()) {
    throw new FacturamaError(
      'Facturama no está configurado. Faltan FACTURAMA_USER y/o FACTURAMA_PASSWORD.',
      503
    );
  }

  const url = `${FACTURAMA_API_URL}${path}`;
  const options: RequestInit = {
    method,
    headers: {
      'Authorization': getAuthHeader(),
      'Content-Type': 'application/json',
    },
  };

  if (body && method !== 'GET') {
    options.body = JSON.stringify(body);
  }

  const response = await fetch(url, options);

  if (!response.ok) {
    let errorBody: any;
    try {
      errorBody = await response.json();
    } catch {
      errorBody = await response.text();
    }

    throw new FacturamaError(
      errorBody?.Message || errorBody?.message || `Facturama API error: ${response.status}`,
      response.status,
      errorBody
    );
  }

  // Some endpoints return empty body (e.g., DELETE)
  const text = await response.text();
  if (!text) return {} as T;

  return JSON.parse(text) as T;
}

// =============================================================================
// CSD Management (Certificate upload for each doctor/RFC)
// =============================================================================

export interface CSDUploadPayload {
  Rfc: string;
  Certificate: string;       // Base64 encoded .cer file
  PrivateKey: string;        // Base64 encoded .key file
  PrivateKeyPassword: string;
  TaxName?: string;          // Razon social (may be optional in multiemisor)
  FiscalRegime?: string;     // Clave regimen fiscal SAT (may be optional in multiemisor)
}

export interface CSDStatus {
  Rfc: string;
  TaxName: string;
  FiscalRegime: string;
  CertificateNumber: string;
  ValidFrom: string;
  ValidTo: string;
}

/**
 * Upload CSD (digital certificate) for an RFC issuer.
 * This registers the doctor as an issuer in our Facturama account.
 */
export async function uploadCSD(payload: CSDUploadPayload): Promise<CSDStatus> {
  return request<CSDStatus>('POST', '/api-lite/csds', payload);
}

/**
 * Get CSD status for an RFC.
 */
export async function getCSDStatus(rfc: string): Promise<CSDStatus> {
  return request<CSDStatus>('GET', `/api-lite/csds/${rfc}`);
}

/**
 * Delete CSD for an RFC (remove issuer).
 */
export async function deleteCSD(rfc: string): Promise<void> {
  await request<void>('DELETE', `/api-lite/csds/${rfc}`);
}

/**
 * List all registered CSDs (all issuers in our account).
 */
export async function listCSDs(): Promise<CSDStatus[]> {
  return request<CSDStatus[]>('GET', '/api-lite/csds');
}

// =============================================================================
// CFDI Operations
// =============================================================================

export interface CfdiIssuer {
  Rfc: string;
  Name: string;
  FiscalRegime: string;
}

export interface CfdiReceiver {
  Rfc: string;
  Name: string;
  CfdiUse: string;          // Clave uso CFDI (e.g. "D01" for honorarios medicos)
  FiscalRegime: string;
  TaxZipCode: string;
}

export interface CfdiTax {
  Total: number;
  Name: string;             // "IVA", "ISR"
  Rate: number;             // 0.16 for 16% IVA
  Base: number;
  IsRetention: boolean;
}

export interface CfdiItem {
  ProductCode: string;      // Clave producto SAT (e.g. "85121800" for servicios medicos)
  Description: string;
  Quantity: number;
  UnitCode: string;         // Clave unidad SAT (e.g. "E48" for servicio)
  UnitPrice: number;
  Subtotal: number;
  TaxObject: string;        // "01" no taxes, "02" with taxes, "03" not subject
  Taxes: CfdiTax[];
  Total: number;
}

export interface CreateCfdiPayload {
  Issuer: CfdiIssuer;
  Receiver: CfdiReceiver;
  CfdiType: 'I' | 'E' | 'P';  // Ingreso, Egreso, Pago
  PaymentForm: string;          // Clave forma de pago SAT (e.g. "01" efectivo)
  PaymentMethod: string;        // "PUE" or "PPD"
  ExpeditionPlace: string;      // CP del lugar de expedicion
  Exportation?: string;         // "01" no export, "02" definitive, "03" temporary
  Items: CfdiItem[];
  Folio?: string;
  Serie?: string;
}

export interface CfdiResponse {
  Id: string;                // Facturama internal ID
  CfdiType: string;
  Serie: string;
  Folio: string;
  Complement: {
    TaxStamp: {
      Uuid: string;
      Date: string;
      CfdiSign: string;
      SatCertNumber: string;
      SatSign: string;
    };
  };
  Issuer: CfdiIssuer;
  Receiver: CfdiReceiver;
  Total: number;
  Subtotal: number;
  Date: string;
  PaymentMethod: string;
  PaymentForm: string;
  Currency: string;
  Status: string;
}

/**
 * Create (emit) a new CFDI via Facturama Multiemisor API.
 */
export async function createCFDI(payload: CreateCfdiPayload): Promise<CfdiResponse> {
  return request<CfdiResponse>('POST', '/api-lite/3/cfdis', payload);
}

/**
 * Get CFDI details by Facturama ID.
 */
export async function getCFDI(facturamaId: string): Promise<CfdiResponse> {
  return request<CfdiResponse>('GET', `/api-lite/3/cfdis/${facturamaId}`);
}

/**
 * Get CFDI PDF as base64 string.
 */
export async function getCFDIPdf(facturamaId: string): Promise<string> {
  const result = await request<{ Content: string }>('GET', `/cfdi/pdf/issued/${facturamaId}`);
  return result.Content;
}

/**
 * Get CFDI XML as base64 string.
 */
export async function getCFDIXml(facturamaId: string): Promise<string> {
  const result = await request<{ Content: string }>('GET', `/cfdi/xml/issued/${facturamaId}`);
  return result.Content;
}

/**
 * Cancel a CFDI.
 * @param motive - SAT cancellation motive: "01", "02", "03", "04"
 * @param uuidReplacement - Required when motive is "01" (replacement UUID)
 */
export async function cancelCFDI(
  facturamaId: string,
  rfc: string,
  motive: string,
  uuidReplacement?: string
): Promise<{ Status: string; Message: string }> {
  let path = `/api-lite/cfdis/${facturamaId}?rfc=${rfc}&motive=${motive}`;
  if (uuidReplacement) {
    path += `&uuidReplacement=${uuidReplacement}`;
  }
  return request<{ Status: string; Message: string }>('DELETE', path);
}

/**
 * Send CFDI by email to the receiver.
 */
export async function sendCFDIByEmail(
  facturamaId: string,
  email: string
): Promise<void> {
  await request<void>('POST', `/api-lite/cfdis/${facturamaId}/email`, {
    Email: email,
  });
}

/**
 * List CFDIs for a specific RFC.
 */
export async function listCFDIs(
  rfc: string,
  options?: { status?: string; year?: number; month?: number }
): Promise<CfdiResponse[]> {
  let path = `/api-lite/3/cfdis?rfc=${rfc}`;
  if (options?.status) path += `&status=${options.status}`;
  if (options?.year) path += `&year=${options.year}`;
  if (options?.month) path += `&month=${options.month}`;
  return request<CfdiResponse[]>('GET', path);
}

// =============================================================================
// SAT Catalogs
// =============================================================================

export interface CatalogItem {
  Value: string;
  Name: string;
  Description?: string;
}

/**
 * Get SAT catalog for "Uso CFDI" (invoice uses).
 */
export async function getCatalogUsoCfdi(): Promise<CatalogItem[]> {
  return request<CatalogItem[]>('GET', '/api-lite/catalogs/CfdiUses');
}

/**
 * Get SAT catalog for "Regimenes Fiscales".
 */
export async function getCatalogRegimenesFiscales(): Promise<CatalogItem[]> {
  return request<CatalogItem[]>('GET', '/api-lite/catalogs/FiscalRegimes');
}

/**
 * Get SAT catalog for "Formas de Pago".
 */
export async function getCatalogFormasPago(): Promise<CatalogItem[]> {
  return request<CatalogItem[]>('GET', '/api-lite/catalogs/PaymentForms');
}

/**
 * Get SAT catalog for "Metodos de Pago".
 */
export async function getCatalogMetodosPago(): Promise<CatalogItem[]> {
  return request<CatalogItem[]>('GET', '/api-lite/catalogs/PaymentMethods');
}

/**
 * Search SAT product/service codes by keyword.
 */
export async function searchProductCodes(query: string): Promise<CatalogItem[]> {
  return request<CatalogItem[]>('GET', `/api-lite/catalogs/ProductsOrServices?keyword=${encodeURIComponent(query)}`);
}

/**
 * Search SAT unit codes by keyword.
 */
export async function searchUnitCodes(query: string): Promise<CatalogItem[]> {
  return request<CatalogItem[]>('GET', `/api-lite/catalogs/Units?keyword=${encodeURIComponent(query)}`);
}

// =============================================================================
// Utility
// =============================================================================

/**
 * Check if Facturama is properly configured.
 */
export function isFacturamaConfigured(): boolean {
  return isConfigured();
}

/**
 * Get the current Facturama environment (sandbox vs production).
 */
export function getFacturamaEnvironment(): 'sandbox' | 'production' {
  return FACTURAMA_API_URL.includes('sandbox') ? 'sandbox' : 'production';
}
