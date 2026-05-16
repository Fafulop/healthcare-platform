/**
 * SAT Descarga Masiva — Service Library
 *
 * Ported from scripts/sat-request-metadata.mjs (PoC 2026-05-12).
 * Zero dependencies — uses only Node.js built-in crypto, https, zlib.
 *
 * Flow: authenticate() → requestMetadata() → verifyRequest() → downloadPackage() → parseMetadata()
 */

import crypto from 'crypto';
import https from 'https';
import zlib from 'zlib';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface SatCredentials {
  /** Base64-encoded .cer (DER format) */
  cerBase64: string;
  /** Base64-encoded .key (PKCS#8 encrypted, DER format) */
  keyBase64: string;
  /** Password for the private key */
  password: string;
}

export interface SatCredentialInfo {
  rfc: string;
  issuerDN: string;
  serialNumber: string;
  validFrom: Date;
  validTo: Date;
  privateKey: crypto.KeyObject;
  cerBase64: string;
}

export type SyncDirection = 'emitted' | 'received';

export interface MetadataRecord {
  uuid: string;
  rfcEmisor: string;
  nombreEmisor: string;
  rfcReceptor: string;
  nombreReceptor: string;
  pacCertifico: string;
  fechaEmision: string;
  fechaCertificacionSat: string;
  monto: number;
  efectoComprobante: string;
  estatus: string; // 'Vigente' | 'Cancelado'
  fechaCancelacion: string;
}

export interface VerifyResult {
  estado: string;
  estadoName: string;
  codEstatus: string;
  numeroCFDIs: number;
  packageIds: string[];
}

export class SatError extends Error {
  code: string;
  constructor(message: string, code: string = 'SAT_ERROR') {
    super(message);
    this.name = 'SatError';
    this.code = code;
  }
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const SAT_ENDPOINTS = {
  auth: 'https://cfdidescargamasivasolicitud.clouda.sat.gob.mx/Autenticacion/Autenticacion.svc',
  solicitud: 'https://cfdidescargamasivasolicitud.clouda.sat.gob.mx/SolicitaDescargaService.svc',
  verificacion: 'https://cfdidescargamasivasolicitud.clouda.sat.gob.mx/VerificaSolicitudDescargaService.svc',
  descarga: 'https://cfdidescargamasiva.clouda.sat.gob.mx/DescargaMasivaService.svc',
};

const ESTADO_NAMES: Record<string, string> = {
  '1': 'Aceptada',
  '2': 'En proceso',
  '3': 'Terminada',
  '4': 'Error',
  '5': 'Rechazada',
  '6': 'Vencida',
};

const METADATA_COLUMNS = [
  'uuid', 'rfcEmisor', 'nombreEmisor', 'rfcReceptor', 'nombreReceptor',
  'pacCertifico', 'fechaEmision', 'fechaCertificacionSat', 'monto',
  'efectoComprobante', 'estatus', 'fechaCancelacion',
];

// ---------------------------------------------------------------------------
// Credential Loading
// ---------------------------------------------------------------------------

/**
 * Load and validate SAT credentials from base64 strings (from encrypted DB fields).
 * Returns RFC, issuerDN, serialNumber, and the loaded private key.
 */
export function loadCredentials(creds: SatCredentials): SatCredentialInfo {
  const { cerBase64, keyBase64, password } = creds;

  // Load certificate
  const cerPem = `-----BEGIN CERTIFICATE-----\n${cerBase64.match(/.{1,64}/g)!.join('\n')}\n-----END CERTIFICATE-----`;
  const cert = new crypto.X509Certificate(cerPem);

  // Extract RFC from certificate subject
  const rfcMatch = cert.subject.match(/x500UniqueIdentifier=([A-Z0-9]+)/);
  if (!rfcMatch) {
    throw new SatError('No se pudo extraer el RFC del certificado', 'INVALID_CERT');
  }
  const rfc = rfcMatch[1];

  // Extract issuer DN (reversed, comma-separated)
  const issuerDN = cert.issuer
    .split('\n')
    .reverse()
    .map((line: string) => line.trim())
    .filter(Boolean)
    .join(', ');

  // Serial number as decimal
  const serialNumber = BigInt('0x' + cert.serialNumber).toString(10);

  // Load private key
  const keyPem = `-----BEGIN ENCRYPTED PRIVATE KEY-----\n${keyBase64.match(/.{1,64}/g)!.join('\n')}\n-----END ENCRYPTED PRIVATE KEY-----`;
  const privateKey = crypto.createPrivateKey({
    key: keyPem,
    format: 'pem',
    type: 'pkcs8',
    passphrase: password,
  });

  return {
    rfc,
    issuerDN,
    serialNumber,
    validFrom: new Date(cert.validFrom),
    validTo: new Date(cert.validTo),
    privateKey,
    cerBase64,
  };
}

// ---------------------------------------------------------------------------
// Crypto Helpers
// ---------------------------------------------------------------------------

function sha1Base64(data: string): string {
  return crypto.createHash('sha1').update(data).digest('base64');
}

function signRsaSha1(data: string, privateKey: crypto.KeyObject): string {
  const s = crypto.createSign('RSA-SHA1');
  s.update(data);
  return s.sign(privateKey, 'base64');
}

// ---------------------------------------------------------------------------
// HTTPS Helper
// ---------------------------------------------------------------------------

function httpsPost(url: string, body: string, headers: Record<string, string> = {}): Promise<{ status: number; body: string }> {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const options = {
      hostname: u.hostname,
      path: u.pathname,
      method: 'POST',
      timeout: 30000,
      headers: {
        'Content-Type': 'text/xml; charset=utf-8',
        'Content-Length': Buffer.byteLength(body, 'utf-8'),
        ...headers,
      },
    };
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk: string) => data += chunk);
      res.on('end', () => resolve({ status: res.statusCode!, body: data }));
    });
    req.on('timeout', () => { req.destroy(); reject(new SatError('Timeout (30s)', 'TIMEOUT')); });
    req.on('error', (e) => reject(new SatError(`HTTPS error: ${e.message}`, 'NETWORK')));
    req.write(body);
    req.end();
  });
}

// ---------------------------------------------------------------------------
// Signature Builders
// ---------------------------------------------------------------------------

/**
 * Build an enveloped XML signature block for solicitud/verifica/descarga nodes.
 * Different from auth signature (which signs the Timestamp).
 */
function buildEnvelopedSignature(
  nodeForDigest: string,
  cred: SatCredentialInfo,
): string {
  const digestValue = sha1Base64(nodeForDigest);

  const c14nSignedInfo =
    '<SignedInfo xmlns="http://www.w3.org/2000/09/xmldsig#">' +
    '<CanonicalizationMethod Algorithm="http://www.w3.org/2001/10/xml-exc-c14n#"></CanonicalizationMethod>' +
    '<SignatureMethod Algorithm="http://www.w3.org/2000/09/xmldsig#rsa-sha1"></SignatureMethod>' +
    '<Reference URI="">' +
    '<Transforms>' +
    '<Transform Algorithm="http://www.w3.org/2000/09/xmldsig#enveloped-signature"></Transform>' +
    '</Transforms>' +
    '<DigestMethod Algorithm="http://www.w3.org/2000/09/xmldsig#sha1"></DigestMethod>' +
    `<DigestValue>${digestValue}</DigestValue>` +
    '</Reference>' +
    '</SignedInfo>';

  const signatureValue = signRsaSha1(c14nSignedInfo, cred.privateKey);

  return (
    '<Signature xmlns="http://www.w3.org/2000/09/xmldsig#">' +
    '<SignedInfo>' +
    '<CanonicalizationMethod Algorithm="http://www.w3.org/2001/10/xml-exc-c14n#"></CanonicalizationMethod>' +
    '<SignatureMethod Algorithm="http://www.w3.org/2000/09/xmldsig#rsa-sha1"></SignatureMethod>' +
    '<Reference URI="">' +
    '<Transforms>' +
    '<Transform Algorithm="http://www.w3.org/2000/09/xmldsig#enveloped-signature"></Transform>' +
    '</Transforms>' +
    '<DigestMethod Algorithm="http://www.w3.org/2000/09/xmldsig#sha1"></DigestMethod>' +
    `<DigestValue>${digestValue}</DigestValue>` +
    '</Reference>' +
    '</SignedInfo>' +
    `<SignatureValue>${signatureValue}</SignatureValue>` +
    '<KeyInfo>' +
    '<X509Data>' +
    '<X509IssuerSerial>' +
    `<X509IssuerName>${cred.issuerDN}</X509IssuerName>` +
    `<X509SerialNumber>${cred.serialNumber}</X509SerialNumber>` +
    '</X509IssuerSerial>' +
    `<X509Certificate>${cred.cerBase64}</X509Certificate>` +
    '</X509Data>' +
    '</KeyInfo>' +
    '</Signature>'
  );
}

// ---------------------------------------------------------------------------
// STEP 1: Authenticate
// ---------------------------------------------------------------------------

/**
 * Authenticate with SAT. Returns JWT token (valid ~10 min).
 */
export async function authenticate(cred: SatCredentialInfo): Promise<string> {
  const now = new Date();
  const expires = new Date(now.getTime() + 5 * 60 * 1000);
  const created = now.toISOString().replace(/\.\d{3}Z$/, '.000Z');
  const expiresStr = expires.toISOString().replace(/\.\d{3}Z$/, '.000Z');

  // Canonical Timestamp (exc-c14n includes xmlns:u because prefix is visibly used)
  const c14nTimestamp =
    '<u:Timestamp xmlns:u="http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-wssecurity-utility-1.0.xsd" u:Id="_0">' +
    `<u:Created>${created}</u:Created>` +
    `<u:Expires>${expiresStr}</u:Expires>` +
    '</u:Timestamp>';

  const digestValue = sha1Base64(c14nTimestamp);

  const c14nSignedInfo =
    '<SignedInfo xmlns="http://www.w3.org/2000/09/xmldsig#">' +
    '<CanonicalizationMethod Algorithm="http://www.w3.org/2001/10/xml-exc-c14n#"></CanonicalizationMethod>' +
    '<SignatureMethod Algorithm="http://www.w3.org/2000/09/xmldsig#rsa-sha1"></SignatureMethod>' +
    '<Reference URI="#_0">' +
    '<Transforms>' +
    '<Transform Algorithm="http://www.w3.org/2001/10/xml-exc-c14n#"></Transform>' +
    '</Transforms>' +
    '<DigestMethod Algorithm="http://www.w3.org/2000/09/xmldsig#sha1"></DigestMethod>' +
    `<DigestValue>${digestValue}</DigestValue>` +
    '</Reference>' +
    '</SignedInfo>';

  const signatureValue = signRsaSha1(c14nSignedInfo, cred.privateKey);

  const envelope =
    '<s:Envelope xmlns:s="http://schemas.xmlsoap.org/soap/envelope/" xmlns:u="http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-wssecurity-utility-1.0.xsd">' +
    '<s:Header>' +
    '<o:Security s:mustUnderstand="1" xmlns:o="http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-wssecurity-secext-1.0.xsd">' +
    '<u:Timestamp u:Id="_0">' +
    `<u:Created>${created}</u:Created>` +
    `<u:Expires>${expiresStr}</u:Expires>` +
    '</u:Timestamp>' +
    '<o:BinarySecurityToken u:Id="BinarySecurityToken" ' +
    'ValueType="http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-x509-token-profile-1.0#X509v3" ' +
    'EncodingType="http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-soap-message-security-1.0#Base64Binary">' +
    cred.cerBase64 +
    '</o:BinarySecurityToken>' +
    '<Signature xmlns="http://www.w3.org/2000/09/xmldsig#">' +
    '<SignedInfo>' +
    '<CanonicalizationMethod Algorithm="http://www.w3.org/2001/10/xml-exc-c14n#"></CanonicalizationMethod>' +
    '<SignatureMethod Algorithm="http://www.w3.org/2000/09/xmldsig#rsa-sha1"></SignatureMethod>' +
    '<Reference URI="#_0">' +
    '<Transforms>' +
    '<Transform Algorithm="http://www.w3.org/2001/10/xml-exc-c14n#"></Transform>' +
    '</Transforms>' +
    '<DigestMethod Algorithm="http://www.w3.org/2000/09/xmldsig#sha1"></DigestMethod>' +
    `<DigestValue>${digestValue}</DigestValue>` +
    '</Reference>' +
    '</SignedInfo>' +
    `<SignatureValue>${signatureValue}</SignatureValue>` +
    '<KeyInfo>' +
    '<o:SecurityTokenReference>' +
    '<o:Reference ValueType="http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-x509-token-profile-1.0#X509v3" URI="#BinarySecurityToken"></o:Reference>' +
    '</o:SecurityTokenReference>' +
    '</KeyInfo>' +
    '</Signature>' +
    '</o:Security>' +
    '</s:Header>' +
    '<s:Body>' +
    '<Autentica xmlns="http://DescargaMasivaTerceros.gob.mx"/>' +
    '</s:Body>' +
    '</s:Envelope>';

  const res = await httpsPost(SAT_ENDPOINTS.auth, envelope, {
    'SOAPAction': 'http://DescargaMasivaTerceros.gob.mx/IAutenticacion/Autentica',
  });

  if (res.status !== 200) {
    throw new SatError(`Auth failed (HTTP ${res.status})`, 'AUTH_FAILED');
  }

  const match = res.body.match(/<AutenticaResult>(.*?)<\/AutenticaResult>/i);
  if (!match) {
    const fault = res.body.match(/<faultstring[^>]*>(.*?)<\/faultstring>/i);
    throw new SatError(`Auth failed: ${fault?.[1] || 'No token in response'}`, 'AUTH_FAILED');
  }

  return match[1];
}

// ---------------------------------------------------------------------------
// STEP 2: Request Metadata Download
// ---------------------------------------------------------------------------

/**
 * Request metadata download from SAT. Returns IdSolicitud.
 */
export async function requestMetadata(
  token: string,
  cred: SatCredentialInfo,
  direction: SyncDirection,
  dateFrom: Date,
  dateTo: Date,
): Promise<string> {
  const fechaInicial = formatSatDate(dateFrom, '00:00:00');
  const fechaFinal = formatSatDate(dateTo, '23:59:59');

  const operationName = direction === 'emitted'
    ? 'SolicitaDescargaEmitidos'
    : 'SolicitaDescargaRecibidos';

  const soapAction = direction === 'emitted'
    ? 'http://DescargaMasivaTerceros.sat.gob.mx/ISolicitaDescargaService/SolicitaDescargaEmitidos'
    : 'http://DescargaMasivaTerceros.sat.gob.mx/ISolicitaDescargaService/SolicitaDescargaRecibidos';

  const rfcRole = direction === 'emitted'
    ? `RfcEmisor="${cred.rfc}"`
    : `RfcReceptor="${cred.rfc}"`;

  // Attributes MUST be in alphabetical order for digest to match
  const solicitudAttrs =
    `FechaFinal="${fechaFinal}" ` +
    `FechaInicial="${fechaInicial}" ` +
    `${rfcRole} ` +
    `RfcSolicitante="${cred.rfc}" ` +
    `TipoSolicitud="Metadata"`;

  const solicitudForDigest =
    `<des:solicitud xmlns:des="http://DescargaMasivaTerceros.sat.gob.mx" ${solicitudAttrs}>` +
    `</des:solicitud>`;

  const signatureBlock = buildEnvelopedSignature(solicitudForDigest, cred);

  const envelope =
    '<s:Envelope xmlns:des="http://DescargaMasivaTerceros.sat.gob.mx" xmlns:s="http://schemas.xmlsoap.org/soap/envelope/">' +
    '<s:Header/>' +
    '<s:Body>' +
    `<des:${operationName}>` +
    `<des:solicitud ${solicitudAttrs}>` +
    signatureBlock +
    '</des:solicitud>' +
    `</des:${operationName}>` +
    '</s:Body>' +
    '</s:Envelope>';

  const res = await httpsPost(SAT_ENDPOINTS.solicitud, envelope, {
    'SOAPAction': soapAction,
    'Authorization': `WRAP access_token="${token}"`,
  });

  const idSolicitud = res.body.match(/IdSolicitud="([^"]+)"/i);
  const codEstatus = res.body.match(/CodEstatus="([^"]+)"/i);
  const mensaje = res.body.match(/Mensaje="([^"]+)"/i);

  if (!idSolicitud) {
    const fault = res.body.match(/<faultstring[^>]*>(.*?)<\/faultstring>/i);
    throw new SatError(
      `Solicitud failed: ${mensaje?.[1] || fault?.[1] || `HTTP ${res.status}`} (code: ${codEstatus?.[1] || 'unknown'})`,
      codEstatus?.[1] || 'REQUEST_FAILED',
    );
  }

  return idSolicitud[1];
}

// ---------------------------------------------------------------------------
// STEP 2b: Request XML (CFDI) Download
// ---------------------------------------------------------------------------

/**
 * Request XML (CFDI) download from SAT. Returns IdSolicitud.
 * Same as requestMetadata but with TipoSolicitud="CFDI".
 */
export async function requestXml(
  token: string,
  cred: SatCredentialInfo,
  direction: SyncDirection,
  dateFrom: Date,
  dateTo: Date,
): Promise<string> {
  const fechaInicial = formatSatDate(dateFrom, '00:00:00');
  const fechaFinal = formatSatDate(dateTo, '23:59:59');

  const operationName = direction === 'emitted'
    ? 'SolicitaDescargaEmitidos'
    : 'SolicitaDescargaRecibidos';

  const soapAction = direction === 'emitted'
    ? 'http://DescargaMasivaTerceros.sat.gob.mx/ISolicitaDescargaService/SolicitaDescargaEmitidos'
    : 'http://DescargaMasivaTerceros.sat.gob.mx/ISolicitaDescargaService/SolicitaDescargaRecibidos';

  const rfcRole = direction === 'emitted'
    ? `RfcEmisor="${cred.rfc}"`
    : `RfcReceptor="${cred.rfc}"`;

  // TipoSolicitud="CFDI" + EstadoComprobante="Vigente" for recibidos
  // SAT rejects XML downloads that include cancelados for recibidos.
  // Attributes MUST be in alphabetical order for digest to match.
  const estadoFilter = direction === 'received' ? `EstadoComprobante="Vigente" ` : '';
  const solicitudAttrs =
    `${estadoFilter}` +
    `FechaFinal="${fechaFinal}" ` +
    `FechaInicial="${fechaInicial}" ` +
    `${rfcRole} ` +
    `RfcSolicitante="${cred.rfc}" ` +
    `TipoSolicitud="CFDI"`;

  console.log('[SAT requestXml]', { direction, estadoFilter: estadoFilter.trim(), solicitudAttrs });

  const solicitudForDigest =
    `<des:solicitud xmlns:des="http://DescargaMasivaTerceros.sat.gob.mx" ${solicitudAttrs}>` +
    `</des:solicitud>`;

  const signatureBlock = buildEnvelopedSignature(solicitudForDigest, cred);

  const envelope =
    '<s:Envelope xmlns:des="http://DescargaMasivaTerceros.sat.gob.mx" xmlns:s="http://schemas.xmlsoap.org/soap/envelope/">' +
    '<s:Header/>' +
    '<s:Body>' +
    `<des:${operationName}>` +
    `<des:solicitud ${solicitudAttrs}>` +
    signatureBlock +
    '</des:solicitud>' +
    `</des:${operationName}>` +
    '</s:Body>' +
    '</s:Envelope>';

  const res = await httpsPost(SAT_ENDPOINTS.solicitud, envelope, {
    'SOAPAction': soapAction,
    'Authorization': `WRAP access_token="${token}"`,
  });

  const idSolicitud = res.body.match(/IdSolicitud="([^"]+)"/i);
  const codEstatus = res.body.match(/CodEstatus="([^"]+)"/i);
  const mensaje = res.body.match(/Mensaje="([^"]+)"/i);

  if (!idSolicitud) {
    const fault = res.body.match(/<faultstring[^>]*>(.*?)<\/faultstring>/i);
    throw new SatError(
      `Solicitud XML failed: ${mensaje?.[1] || fault?.[1] || `HTTP ${res.status}`} (code: ${codEstatus?.[1] || 'unknown'})`,
      codEstatus?.[1] || 'REQUEST_FAILED',
    );
  }

  return idSolicitud[1];
}

// ---------------------------------------------------------------------------
// STEP 3: Verify Request Status
// ---------------------------------------------------------------------------

/**
 * Check status of a metadata request. Returns estado + packageIds when ready.
 */
export async function verifyRequest(
  token: string,
  cred: SatCredentialInfo,
  idSolicitud: string,
): Promise<VerifyResult> {
  const solicitudAttrs =
    `IdSolicitud="${idSolicitud}" ` +
    `RfcSolicitante="${cred.rfc}"`;

  const solicitudForDigest =
    `<des:solicitud xmlns:des="http://DescargaMasivaTerceros.sat.gob.mx" ${solicitudAttrs}>` +
    `</des:solicitud>`;

  const signatureBlock = buildEnvelopedSignature(solicitudForDigest, cred);

  const envelope =
    '<s:Envelope xmlns:des="http://DescargaMasivaTerceros.sat.gob.mx" xmlns:s="http://schemas.xmlsoap.org/soap/envelope/">' +
    '<s:Header/>' +
    '<s:Body>' +
    '<des:VerificaSolicitudDescarga>' +
    `<des:solicitud ${solicitudAttrs}>` +
    signatureBlock +
    '</des:solicitud>' +
    '</des:VerificaSolicitudDescarga>' +
    '</s:Body>' +
    '</s:Envelope>';

  const res = await httpsPost(SAT_ENDPOINTS.verificacion, envelope, {
    'SOAPAction': 'http://DescargaMasivaTerceros.sat.gob.mx/IVerificaSolicitudDescargaService/VerificaSolicitudDescarga',
    'Authorization': `WRAP access_token="${token}"`,
  });

  const estadoSolicitud = res.body.match(/EstadoSolicitud="([^"]+)"/i);
  const codEstatus = res.body.match(/CodEstatus="([^"]+)"/i);
  const numeroCFDIs = res.body.match(/NumeroCFDIs="([^"]+)"/i);
  const packageIds = [...res.body.matchAll(/<IdsPaquetes>([^<]+)<\/IdsPaquetes>/gi)].map(m => m[1]);

  const estado = estadoSolicitud?.[1] || 'unknown';

  return {
    estado,
    estadoName: ESTADO_NAMES[estado] || 'Desconocido',
    codEstatus: codEstatus?.[1] || '',
    numeroCFDIs: parseInt(numeroCFDIs?.[1] || '0', 10),
    packageIds,
  };
}

// ---------------------------------------------------------------------------
// STEP 4: Download Package
// ---------------------------------------------------------------------------

/**
 * Download a package by ID. Returns the raw ZIP buffer.
 */
export async function downloadPackage(
  token: string,
  cred: SatCredentialInfo,
  packageId: string,
): Promise<Buffer> {
  const solicitudAttrs =
    `IdPaquete="${packageId}" ` +
    `RfcSolicitante="${cred.rfc}"`;

  const solicitudForDigest =
    `<des:peticionDescarga xmlns:des="http://DescargaMasivaTerceros.sat.gob.mx" ${solicitudAttrs}>` +
    `</des:peticionDescarga>`;

  const signatureBlock = buildEnvelopedSignature(solicitudForDigest, cred);

  const envelope =
    '<s:Envelope xmlns:des="http://DescargaMasivaTerceros.sat.gob.mx" xmlns:s="http://schemas.xmlsoap.org/soap/envelope/">' +
    '<s:Header/>' +
    '<s:Body>' +
    '<des:PeticionDescargaMasivaTercerosEntrada>' +
    `<des:peticionDescarga ${solicitudAttrs}>` +
    signatureBlock +
    '</des:peticionDescarga>' +
    '</des:PeticionDescargaMasivaTercerosEntrada>' +
    '</s:Body>' +
    '</s:Envelope>';

  // Note: download uses a DIFFERENT subdomain
  const res = await httpsPost(SAT_ENDPOINTS.descarga, envelope, {
    'SOAPAction': 'http://DescargaMasivaTerceros.sat.gob.mx/IDescargaMasivaTercerosService/Descargar',
    'Authorization': `WRAP access_token="${token}"`,
  });

  const paqueteMatch = res.body.match(/<Paquete>([\s\S]*?)<\/Paquete>/i)
    || res.body.match(/Paquete="([^"]+)"/i);

  if (!paqueteMatch) {
    const codEstatus = res.body.match(/CodEstatus="([^"]+)"/i);
    throw new SatError(
      `Download failed (code: ${codEstatus?.[1] || 'unknown'})`,
      'DOWNLOAD_FAILED',
    );
  }

  return Buffer.from(paqueteMatch[1], 'base64');
}

// ---------------------------------------------------------------------------
// ZIP Parser (zero dependencies)
// ---------------------------------------------------------------------------

interface ZipEntry {
  name: string;
  data: string;
}

export function extractZipEntries(zipBuffer: Buffer): ZipEntry[] {
  const entries: ZipEntry[] = [];
  let offset = 0;

  while (offset + 30 <= zipBuffer.length) {
    // Local file header signature: PK\x03\x04
    if (zipBuffer.readUInt32LE(offset) !== 0x04034b50) break;

    const compressionMethod = zipBuffer.readUInt16LE(offset + 8);
    const compressedSize = zipBuffer.readUInt32LE(offset + 18);
    const nameLen = zipBuffer.readUInt16LE(offset + 26);
    const extraLen = zipBuffer.readUInt16LE(offset + 28);

    const name = zipBuffer.subarray(offset + 30, offset + 30 + nameLen).toString('utf8');
    const dataStart = offset + 30 + nameLen + extraLen;
    const compressedData = zipBuffer.subarray(dataStart, dataStart + compressedSize);

    let data: Buffer;
    if (compressionMethod === 0) {
      data = compressedData;
    } else if (compressionMethod === 8) {
      data = zlib.inflateRawSync(compressedData);
    } else {
      throw new SatError(`Unsupported ZIP compression: ${compressionMethod}`, 'ZIP_ERROR');
    }

    entries.push({ name, data: data.toString('utf8') });
    offset = dataStart + compressedSize;
  }

  return entries;
}

// ---------------------------------------------------------------------------
// Metadata TXT Parser
// ---------------------------------------------------------------------------

/**
 * Parse SAT metadata TXT (tilde-delimited, 12 columns).
 */
export function parseMetadataTxt(txt: string): MetadataRecord[] {
  const lines = txt.split('\n').filter(l => l.trim());
  const dataLines = lines.slice(1); // skip header

  return dataLines.map(line => {
    const fields = line.split('~');
    const record: Record<string, string> = {};
    METADATA_COLUMNS.forEach((col, i) => {
      record[col] = (fields[i] || '').trim();
    });

    return {
      ...record,
      monto: parseFloat(record.monto) || 0,
      estatus: record.estatus === '1' ? 'Vigente' : 'Cancelado',
    } as MetadataRecord;
  });
}

/**
 * Parse all metadata from a ZIP buffer (may contain multiple TXT files).
 */
export function parseMetadataFromZip(zipBuffer: Buffer): MetadataRecord[] {
  const entries = extractZipEntries(zipBuffer);
  let records: MetadataRecord[] = [];
  for (const entry of entries) {
    if (entry.name.endsWith('.txt')) {
      records = records.concat(parseMetadataTxt(entry.data));
    }
  }
  return records;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatSatDate(date: Date, time: string): string {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, '0');
  const d = String(date.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}T${time}`;
}
