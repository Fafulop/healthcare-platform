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
 * Update CSD for an RFC (e.g., when certificate expires).
 * PUT /api-lite/csds/{rfc} — same body as upload.
 */
export async function updateCSD(rfc: string, payload: CSDUploadPayload): Promise<CSDStatus> {
  return request<CSDStatus>('PUT', `/api-lite/csds/${rfc}`, payload);
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

// Relations node — used by Egreso (credit notes) and cancel-with-replacement
export interface CfdiRelation {
  Type: string;                   // SAT relation type: "01" Nota de credito, "04" Sustitucion
  Cfdis: { Uuid: string }[];     // UUIDs of related CFDIs
}

// Complemento de Pago 2.0 — for REP (CfdiType "P")
export interface PaymentRelatedDocument {
  Uuid: string;                   // UUID of the original invoice being paid
  Serie?: string;
  Folio?: string;
  Currency: string;               // "MXN"
  PaymentMethod: string;          // Original invoice's payment method (always "PPD")
  PartialityNumber: number;       // Parcialidad number (1, 2, 3...)
  PreviousBalanceAmount: number;  // Saldo anterior
  AmountPaid: number;             // Monto pagado en esta parcialidad
  ImpSaldoInsoluto: number;       // Saldo pendiente (previous - paid)
  TaxObject?: string;             // "01" no taxes or "02" with taxes
  Taxes?: PaymentDocumentTax[];
}

export interface PaymentDocumentTax {
  Total: number;
  Name: string;                   // "IVA", "ISR"
  Rate: number;
  Base: number;
  IsRetention: boolean;
}

export interface PaymentComplementItem {
  Date: string;                   // Payment date ISO 8601 or YYYY-MM-DDTHH:mm:ss
  PaymentForm: string;            // How the payment was made (e.g. "03" transferencia)
  Amount: number;                 // Total payment amount
  Currency: string;               // "MXN"
  RelatedDocuments: PaymentRelatedDocument[];
}

export interface PaymentComplement {
  Payments: PaymentComplementItem[];
}

export interface CreateCfdiPayload {
  Issuer: CfdiIssuer;
  Receiver: CfdiReceiver;
  CfdiType: 'I' | 'E' | 'P';  // Ingreso, Egreso, Pago
  PaymentForm: string;          // Clave forma de pago SAT (e.g. "01" efectivo)
  PaymentMethod: string;        // "PUE" or "PPD"
  ExpeditionPlace: string;      // CP del lugar de expedicion
  Exportation?: string;         // "01" no export, "02" definitive, "03" temporary
  Items?: CfdiItem[];           // Required for I/E, omitted for P
  Folio?: string;
  Serie?: string;
  NameId?: string;              // "2" for Nota de Credito
  Relations?: CfdiRelation;     // Links to related CFDIs (Egreso, substitution)
  Complement?: PaymentComplement; // Complemento de Pago 2.0 (REP)
  // Optional non-fiscal fields (appear in PDF only)
  Observations?: string;
  PaymentBankName?: string;
  PaymentAccountNumber?: string;
  OrderNumber?: string;
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
 * Official endpoint: GET /api-lite/cfdis/{id}
 */
export async function getCFDI(facturamaId: string): Promise<CfdiResponse> {
  return request<CfdiResponse>('GET', `/api-lite/cfdis/${facturamaId}`);
}

/**
 * Get CFDI file as base64 string.
 * Multiemisor uses type "issuedLite" (NOT "issued" which is for API Web).
 * Supported formats: pdf, xml, html
 */
export async function getCFDIFile(facturamaId: string, format: 'pdf' | 'xml' | 'html'): Promise<string> {
  const result = await request<{ Content: string }>('GET', `/cfdi/${format}/issuedLite/${facturamaId}`);
  return result.Content;
}

/**
 * Get CFDI PDF as base64 string.
 */
export async function getCFDIPdf(facturamaId: string): Promise<string> {
  return getCFDIFile(facturamaId, 'pdf');
}

/**
 * Get CFDI XML as base64 string.
 */
export async function getCFDIXml(facturamaId: string): Promise<string> {
  return getCFDIFile(facturamaId, 'xml');
}

/**
 * Get CFDI HTML as base64 string (useful for in-browser preview).
 */
export async function getCFDIHtml(facturamaId: string): Promise<string> {
  return getCFDIFile(facturamaId, 'html');
}

/**
 * Cancel a CFDI.
 * @param motive - SAT cancellation motive: "01", "02", "03", "04"
 * @param uuidReplacement - Required when motive is "01" (replacement UUID)
 */
export interface CancelCfdiResponse {
  Status: string;           // "canceled" | "active" | "pending" | "accepted" | "rejected" | "expired"
  Message: string;
  IsCancelable?: string;    // "Cancelable sin aceptacion" | "Cancelable con aceptacion" | "No cancelable"
  Uuid?: string;
  RequestDate?: string;
  ExpirationDate?: string;  // Deadline for receiver response (72h)
  AcuseXmlBase64?: string;
  CancelationDate?: string;
  AcuseStatus?: number;     // 201-312 SAT status codes
  AcuseStatusDetails?: string;
}

export async function cancelCFDI(
  facturamaId: string,
  rfc: string,
  motive: string,
  uuidReplacement?: string
): Promise<CancelCfdiResponse> {
  let path = `/api-lite/cfdis/${facturamaId}?rfc=${rfc}&motive=${motive}`;
  if (uuidReplacement) {
    path += `&uuidReplacement=${uuidReplacement}`;
  }
  return request<CancelCfdiResponse>('DELETE', path);
}

/**
 * Download cancellation acknowledgment (acuse de cancelación) as base64.
 * Official endpoint: GET /acuse/{format}/issuedLite/{id}
 */
export async function getCancellationAcuse(
  facturamaId: string,
  format: 'pdf' | 'html' = 'pdf'
): Promise<string> {
  const result = await request<{ Content: string }>('GET', `/acuse/${format}/issuedLite/${facturamaId}`);
  return result.Content;
}

/**
 * Send CFDI by email to the receiver.
 * Official endpoint: POST /cfdi?CfdiType=issuedLite&CfdiId={id}&Email={email}
 * All parameters go in query string, NOT request body.
 */
export async function sendCFDIByEmail(
  facturamaId: string,
  email: string,
  options?: { subject?: string; comments?: string; issuerEmail?: string }
): Promise<{ success: boolean; msj: string }> {
  const params = new URLSearchParams({
    CfdiType: 'issuedLite',
    CfdiId: facturamaId,
    Email: email,
  });
  if (options?.subject) params.set('Subject', options.subject);
  if (options?.comments) params.set('Comments', options.comments);
  if (options?.issuerEmail) params.set('IssuerEmail', options.issuerEmail);

  return request<{ success: boolean; msj: string }>('POST', `/cfdi?${params.toString()}`);
}

/**
 * List CFDIs for a specific RFC via the filtered search endpoint.
 * Official endpoint: GET /cfdi?type=issuedLite with filter params.
 * NOT /api-lite/3/cfdis (that's the creation endpoint).
 * Pagination: 10 results per page, page starts at 0.
 * Date format: DD-MM-YYYY (e.g. "01-01-2019") per official docs.
 */
export async function listCFDIs(
  rfc: string,
  options?: {
    status?: 'all' | 'active' | 'pending' | 'canceled';
    page?: number;
    dateStart?: string;  // DD-MM-YYYY format (e.g. "01-01-2019")
    dateEnd?: string;    // DD-MM-YYYY format (e.g. "15-02-2019")
    folio?: string;
    folioStart?: string;
    folioEnd?: string;
    rfcReceiver?: string;
    taxEntityName?: string;
    orderNumber?: string | boolean;  // true/false to filter, or specific value
  }
): Promise<CfdiResponse[]> {
  const params = new URLSearchParams({
    type: 'issuedLite',
    rfcIssuer: rfc,
  });
  if (options?.status) params.set('status', options.status);
  if (options?.page !== undefined) params.set('page', String(options.page));
  if (options?.dateStart) params.set('dateStart', options.dateStart);
  if (options?.dateEnd) params.set('dateEnd', options.dateEnd);
  if (options?.folio) params.set('folio', options.folio);
  if (options?.folioStart) params.set('folioStart', options.folioStart);
  if (options?.folioEnd) params.set('folioEnd', options.folioEnd);
  if (options?.rfcReceiver) params.set('rfc', options.rfcReceiver);
  if (options?.taxEntityName) params.set('taxEntityName', options.taxEntityName);
  if (options?.orderNumber !== undefined) params.set('orderNumber', String(options.orderNumber));

  return request<CfdiResponse[]>('GET', `/cfdi?${params.toString()}`);
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
 * Accepts optional RFC — results vary by person type (fisica vs moral).
 */
export async function getCatalogUsoCfdi(rfc?: string): Promise<CatalogItem[]> {
  const path = rfc
    ? `/api-lite/catalogs/CfdiUses?keyword=${encodeURIComponent(rfc)}`
    : '/api-lite/catalogs/CfdiUses';
  return request<CatalogItem[]>('GET', path);
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
// Validations (each request consumes 1 folio)
// =============================================================================

export interface RfcValidationRequest {
  Rfc: string;
  Name: string;
  ZipCode: string;
  FiscalRegime: string;
}

export interface RfcValidationResponse {
  ExistRfc: boolean;
  MatchName: boolean;
  MatchZipCode: boolean;
  MatchFiscalRegime: boolean;
}

/**
 * Validate RFC data against SAT registry.
 * POST /customers/validate
 * WARNING: Each call consumes 1 folio. In sandbox, only test RFCs work.
 */
export async function validateRFC(data: RfcValidationRequest): Promise<RfcValidationResponse> {
  return request<RfcValidationResponse>('POST', '/customers/validate', data);
}

export interface CfdiStatusResponse {
  Status: string;           // "Vigente" | "Cancelado" | "No encontrado"
  IsCancelable: string;     // "No cancelable" | "Cancelable con aceptación" | "Cancelable sin aceptación"
  Uuid: string;
}

/**
 * Check CFDI status with SAT.
 * GET /cfdi/status?uuid=&issuerRfc=&receiverRfc=&total=
 * WARNING: Each call consumes 1 folio.
 */
export async function validateCFDIStatus(
  uuid: string,
  issuerRfc: string,
  receiverRfc: string,
  total: string
): Promise<CfdiStatusResponse> {
  const params = new URLSearchParams({ uuid, issuerRfc, receiverRfc, total });
  return request<CfdiStatusResponse>('GET', `/cfdi/status?${params.toString()}`);
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
