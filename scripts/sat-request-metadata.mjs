/**
 * SAT Descarga Masiva — Steps 1-2: Authenticate + Request Metadata
 *
 * Zero dependencies — uses only Node.js built-in crypto and https.
 *
 * Usage:
 *   node scripts/sat-request-metadata.mjs <efirma.cer> <efirma.key> <password> [emitted|received] [YYYY-MM]
 *
 * Examples:
 *   node scripts/sat-request-metadata.mjs c:/sat-test/efirma.cer c:/sat-test/efirma.key pass received 2026-04
 *   node scripts/sat-request-metadata.mjs c:/sat-test/efirma.cer c:/sat-test/efirma.key pass emitted 2026-01
 *
 * What it does:
 *   1. Authenticates with SAT (Step 1) — gets JWT token
 *   2. Requests metadata download (Step 2) — gets IdSolicitud
 *   3. Polls verification (Step 3) — waits until packages ready
 *   4. Downloads packages (Step 4) — saves ZIP and extracts metadata
 */

import { readFileSync, writeFileSync } from 'fs';
import { createHash, createSign, createPrivateKey, X509Certificate } from 'crypto';
import { inflateRawSync } from 'zlib';
import https from 'https';

// ---------------------------------------------------------------------------
// 1. Parse CLI args
// ---------------------------------------------------------------------------
const [,, cerPath, keyPath, password, direction = 'received', monthStr] = process.argv;

if (!cerPath || !keyPath || !password) {
  console.error('Usage: node scripts/sat-request-metadata.mjs <efirma.cer> <efirma.key> <password> [emitted|received] [YYYY-MM]');
  console.error('');
  console.error('  direction  — "emitted" or "received" (default: received)');
  console.error('  YYYY-MM    — month to query (default: previous month)');
  process.exit(1);
}

if (direction !== 'emitted' && direction !== 'received') {
  console.error('ERROR: direction must be "emitted" or "received", got:', direction);
  process.exit(1);
}

// Calculate date range
let dateFrom, dateTo;
if (monthStr) {
  const [y, m] = monthStr.split('-').map(Number);
  dateFrom = new Date(y, m - 1, 1);
  dateTo = new Date(y, m, 0, 23, 59, 59); // last day of month
} else {
  // Default: previous month
  const now = new Date();
  dateFrom = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  dateTo = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);
}

const fechaInicial = `${dateFrom.getFullYear()}-${String(dateFrom.getMonth() + 1).padStart(2, '0')}-${String(dateFrom.getDate()).padStart(2, '0')}T00:00:00`;
const fechaFinal = `${dateTo.getFullYear()}-${String(dateTo.getMonth() + 1).padStart(2, '0')}-${String(dateTo.getDate()).padStart(2, '0')}T23:59:59`;

console.log(`Direction: ${direction}`);
console.log(`Date range: ${fechaInicial} to ${fechaFinal}`);

// ---------------------------------------------------------------------------
// 2. Load credentials
// ---------------------------------------------------------------------------
console.log('\n--- Loading credentials ---');

const cerDer = readFileSync(cerPath);
const keyDer = readFileSync(keyPath);

const cerBase64 = cerDer.toString('base64');
const cerPem = `-----BEGIN CERTIFICATE-----\n${cerBase64.match(/.{1,64}/g).join('\n')}\n-----END CERTIFICATE-----`;

// Extract RFC and certificate info for solicitud
const cert = new X509Certificate(cerPem);
const rfcMatch = cert.subject.match(/x500UniqueIdentifier=([A-Z0-9]+)/);
const rfc = rfcMatch ? rfcMatch[1] : null;
console.log('RFC:', rfc);

if (!rfc) {
  console.error('ERROR: Could not extract RFC from certificate');
  process.exit(1);
}

// Extract issuer DN and serial number for signature KeyInfo
const issuerDN = cert.issuer
  .split('\n')
  .reverse()
  .map(line => line.trim())
  .filter(Boolean)
  .join(', ');
const serialNumber = BigInt('0x' + cert.serialNumber).toString(10);
console.log('Certificate serial:', serialNumber);

const keyBase64 = keyDer.toString('base64');
const encryptedKeyPem = `-----BEGIN ENCRYPTED PRIVATE KEY-----\n${keyBase64.match(/.{1,64}/g).join('\n')}\n-----END ENCRYPTED PRIVATE KEY-----`;

let privateKey;
try {
  privateKey = createPrivateKey({
    key: encryptedKeyPem,
    format: 'pem',
    type: 'pkcs8',
    passphrase: password,
  });
  console.log('Private key loaded.');
} catch (e) {
  console.error('ERROR loading private key:', e.message);
  process.exit(1);
}

// ---------------------------------------------------------------------------
// Helper: HTTPS POST
// ---------------------------------------------------------------------------
function httpsPost(url, body, headers = {}) {
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
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => resolve({ status: res.statusCode, body: data }));
    });
    req.on('timeout', () => { req.destroy(); reject(new Error('Timeout (30s)')); });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

// ---------------------------------------------------------------------------
// Helper: sign data with RSA-SHA1
// ---------------------------------------------------------------------------
function signRsaSha1(data) {
  const s = createSign('RSA-SHA1');
  s.update(data);
  return s.sign(privateKey, 'base64');
}

// ---------------------------------------------------------------------------
// Helper: SHA-1 digest, base64
// ---------------------------------------------------------------------------
function sha1Base64(data) {
  return createHash('sha1').update(data).digest('base64');
}

// ---------------------------------------------------------------------------
// STEP 1: Authenticate
// ---------------------------------------------------------------------------
async function authenticate() {
  console.log('\n=== STEP 1: Authenticate ===');

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

  const signatureValue = signRsaSha1(c14nSignedInfo);

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
    cerBase64 +
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

  const res = await httpsPost(
    'https://cfdidescargamasivasolicitud.clouda.sat.gob.mx/Autenticacion/Autenticacion.svc',
    envelope,
    { 'SOAPAction': 'http://DescargaMasivaTerceros.gob.mx/IAutenticacion/Autentica' }
  );

  if (res.status !== 200) {
    console.error('Auth failed. Status:', res.status);
    console.error(res.body.substring(0, 500));
    process.exit(1);
  }

  const match = res.body.match(/<AutenticaResult>(.*?)<\/AutenticaResult>/i);
  if (!match) {
    console.error('Auth failed. No token in response.');
    console.error(res.body.substring(0, 500));
    process.exit(1);
  }

  console.log('Auth OK. Token length:', match[1].length);
  return match[1];
}

// ---------------------------------------------------------------------------
// STEP 2: Request metadata download
// ---------------------------------------------------------------------------
async function requestMetadata(token) {
  console.log('\n=== STEP 2: Request Metadata ===');

  // Build the solicitud node with attributes
  // For emitted: SolicitaDescargaEmitidos, RfcReceptores for filter
  // For received: SolicitaDescargaRecibidos, RfcEmisor for filter
  const operationName = direction === 'emitted'
    ? 'SolicitaDescargaEmitidos'
    : 'SolicitaDescargaRecibidos';

  const soapAction = direction === 'emitted'
    ? 'http://DescargaMasivaTerceros.sat.gob.mx/ISolicitaDescargaService/SolicitaDescargaEmitidos'
    : 'http://DescargaMasivaTerceros.sat.gob.mx/ISolicitaDescargaService/SolicitaDescargaRecibidos';

  // Build solicitud attributes
  // For emitted: RfcEmisor = our RFC (we emitted them)
  // For received: RfcReceptor = our RFC (we received them)
  const rfcRole = direction === 'emitted'
    ? `RfcEmisor="${rfc}"`
    : `RfcReceptor="${rfc}"`;

  const solicitudAttrs =
    `FechaFinal="${fechaFinal}" ` +
    `FechaInicial="${fechaInicial}" ` +
    `${rfcRole} ` +
    `RfcSolicitante="${rfc}" ` +
    `TipoSolicitud="Metadata"`;

  // The solicitud node WITHOUT signature (used to compute digest for enveloped signature)
  // In enveloped signature, we digest the solicitud node itself
  // The canonical form needs the des: namespace declared
  const solicitudForDigest =
    `<des:solicitud xmlns:des="http://DescargaMasivaTerceros.sat.gob.mx" ${solicitudAttrs}>` +
    `</des:solicitud>`;

  const digestValue = sha1Base64(solicitudForDigest);

  // SignedInfo for the solicitud signature (enveloped)
  // Reference URI="" means the signature covers the parent element
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

  const signatureValue = signRsaSha1(c14nSignedInfo);

  // Build the signature block (goes inside the solicitud node — enveloped)
  const signatureBlock =
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
    `<X509IssuerName>${issuerDN}</X509IssuerName>` +
    `<X509SerialNumber>${serialNumber}</X509SerialNumber>` +
    '</X509IssuerSerial>' +
    `<X509Certificate>${cerBase64}</X509Certificate>` +
    '</X509Data>' +
    '</KeyInfo>' +
    '</Signature>';

  // Full SOAP envelope
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

  console.log('Sending solicitud...');

  const res = await httpsPost(
    'https://cfdidescargamasivasolicitud.clouda.sat.gob.mx/SolicitaDescargaService.svc',
    envelope,
    {
      'SOAPAction': soapAction,
      'Authorization': `WRAP access_token="${token}"`,
    }
  );

  console.log('HTTP Status:', res.status);

  // Parse response
  const idSolicitud = res.body.match(/IdSolicitud="([^"]+)"/i);
  const codEstatus = res.body.match(/CodEstatus="([^"]+)"/i);
  const mensaje = res.body.match(/Mensaje="([^"]+)"/i);

  if (codEstatus) console.log('CodEstatus:', codEstatus[1]);
  if (mensaje) console.log('Mensaje:', mensaje[1]);

  if (idSolicitud) {
    console.log('IdSolicitud:', idSolicitud[1]);
    return idSolicitud[1];
  }

  // Check for fault
  const fault = res.body.match(/<faultstring[^>]*>(.*?)<\/faultstring>/i);
  if (fault) console.error('SOAP Fault:', fault[1]);
  console.error('\nFull response:');
  console.error(res.body.substring(0, 1000));
  process.exit(1);
}

// ---------------------------------------------------------------------------
// STEP 3: Verify request status (polling)
// ---------------------------------------------------------------------------
async function verifyRequest(token, idSolicitud) {
  console.log('\n=== STEP 3: Verify Request ===');

  const solicitudAttrs =
    `IdSolicitud="${idSolicitud}" ` +
    `RfcSolicitante="${rfc}"`;

  // Digest of the solicitud node
  const solicitudForDigest =
    `<des:solicitud xmlns:des="http://DescargaMasivaTerceros.sat.gob.mx" ${solicitudAttrs}>` +
    `</des:solicitud>`;

  const digestValue = sha1Base64(solicitudForDigest);

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

  const signatureValue = signRsaSha1(c14nSignedInfo);

  const signatureBlock =
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
    `<X509IssuerName>${issuerDN}</X509IssuerName>` +
    `<X509SerialNumber>${serialNumber}</X509SerialNumber>` +
    '</X509IssuerSerial>' +
    `<X509Certificate>${cerBase64}</X509Certificate>` +
    '</X509Data>' +
    '</KeyInfo>' +
    '</Signature>';

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

  const res = await httpsPost(
    'https://cfdidescargamasivasolicitud.clouda.sat.gob.mx/VerificaSolicitudDescargaService.svc',
    envelope,
    {
      'SOAPAction': 'http://DescargaMasivaTerceros.sat.gob.mx/IVerificaSolicitudDescargaService/VerificaSolicitudDescarga',
      'Authorization': `WRAP access_token="${token}"`,
    }
  );

  // Parse response
  const estadoSolicitud = res.body.match(/EstadoSolicitud="([^"]+)"/i);
  const codEstatus = res.body.match(/CodEstatus="([^"]+)"/i);
  const numeroCFDIs = res.body.match(/NumeroCFDIs="([^"]+)"/i);
  const mensaje = res.body.match(/Mensaje="([^"]+)"/i);
  const packageIds = [...res.body.matchAll(/<IdsPaquetes>([^<]+)<\/IdsPaquetes>/gi)].map(m => m[1]);

  const estado = estadoSolicitud ? estadoSolicitud[1] : 'unknown';
  const estadoNames = { '1': 'Aceptada', '2': 'En proceso', '3': 'Terminada', '4': 'Error', '5': 'Rechazada', '6': 'Vencida' };

  console.log('EstadoSolicitud:', estado, `(${estadoNames[estado] || 'unknown'})`);
  if (codEstatus) console.log('CodEstatus:', codEstatus[1]);
  if (mensaje) console.log('Mensaje:', mensaje[1]);
  if (numeroCFDIs) console.log('NumeroCFDIs:', numeroCFDIs[1]);
  if (packageIds.length) console.log('Package IDs:', packageIds);

  // Check for fault
  if (res.status !== 200) {
    const fault = res.body.match(/<faultstring[^>]*>(.*?)<\/faultstring>/i);
    if (fault) console.error('SOAP Fault:', fault[1]);
    console.error(res.body.substring(0, 1000));
  }

  return { estado, packageIds };
}

// ---------------------------------------------------------------------------
// STEP 4: Download package
// ---------------------------------------------------------------------------
async function downloadPackage(token, packageId) {
  console.log(`\n=== STEP 4: Download Package ${packageId} ===`);

  const solicitudAttrs =
    `IdPaquete="${packageId}" ` +
    `RfcSolicitante="${rfc}"`;

  const solicitudForDigest =
    `<des:peticionDescarga xmlns:des="http://DescargaMasivaTerceros.sat.gob.mx" ${solicitudAttrs}>` +
    `</des:peticionDescarga>`;

  const digestValue = sha1Base64(solicitudForDigest);

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

  const signatureValue = signRsaSha1(c14nSignedInfo);

  const signatureBlock =
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
    `<X509IssuerName>${issuerDN}</X509IssuerName>` +
    `<X509SerialNumber>${serialNumber}</X509SerialNumber>` +
    '</X509IssuerSerial>' +
    `<X509Certificate>${cerBase64}</X509Certificate>` +
    '</X509Data>' +
    '</KeyInfo>' +
    '</Signature>';

  // Note: Download uses different subdomain and different element names
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

  // Different subdomain for download!
  const res = await httpsPost(
    'https://cfdidescargamasiva.clouda.sat.gob.mx/DescargaMasivaService.svc',
    envelope,
    {
      'SOAPAction': 'http://DescargaMasivaTerceros.sat.gob.mx/IDescargaMasivaTercerosService/Descargar',
      'Authorization': `WRAP access_token="${token}"`,
    }
  );

  console.log('HTTP Status:', res.status);

  // Extract base64 package content
  const paqueteMatch = res.body.match(/<Paquete>(.*?)<\/Paquete>/is)
    || res.body.match(/Paquete="([^"]+)"/i);

  const codEstatus = res.body.match(/CodEstatus="([^"]+)"/i);
  if (codEstatus) console.log('CodEstatus:', codEstatus[1]);

  if (paqueteMatch) {
    const zipBase64 = paqueteMatch[1];
    const zipBuffer = Buffer.from(zipBase64, 'base64');
    const filename = `sat-metadata-${direction}-${packageId}.zip`;
    writeFileSync(filename, zipBuffer);
    console.log(`Package saved: ${filename} (${zipBuffer.length} bytes)`);
    return filename;
  }

  console.error('No package content found in response.');
  console.error(res.body.substring(0, 1000));
  return null;
}

// ---------------------------------------------------------------------------
// ZIP parser (zero dependencies — reads ZIP local file entries manually)
// ---------------------------------------------------------------------------
function extractZipEntries(zipBuffer) {
  const entries = [];
  let offset = 0;

  while (offset + 30 <= zipBuffer.length) {
    // Local file header signature: PK\x03\x04
    if (zipBuffer.readUInt32LE(offset) !== 0x04034b50) break;

    const compressionMethod = zipBuffer.readUInt16LE(offset + 8);
    const compressedSize = zipBuffer.readUInt32LE(offset + 18);
    const uncompressedSize = zipBuffer.readUInt32LE(offset + 22);
    const nameLen = zipBuffer.readUInt16LE(offset + 26);
    const extraLen = zipBuffer.readUInt16LE(offset + 28);

    const name = zipBuffer.subarray(offset + 30, offset + 30 + nameLen).toString('utf8');
    const dataStart = offset + 30 + nameLen + extraLen;
    const compressedData = zipBuffer.subarray(dataStart, dataStart + compressedSize);

    let data;
    if (compressionMethod === 0) {
      data = compressedData; // stored (no compression)
    } else if (compressionMethod === 8) {
      data = inflateRawSync(compressedData); // deflate
    } else {
      throw new Error(`Unsupported compression method: ${compressionMethod}`);
    }

    entries.push({ name, data: data.toString('utf8') });
    offset = dataStart + compressedSize;
  }

  return entries;
}

// ---------------------------------------------------------------------------
// Metadata TXT parser
// ---------------------------------------------------------------------------
const METADATA_COLUMNS = [
  'uuid', 'rfcEmisor', 'nombreEmisor', 'rfcReceptor', 'nombreReceptor',
  'pacCertifico', 'fechaEmision', 'fechaCertificacionSat', 'monto',
  'efectoComprobante', 'estatus', 'fechaCancelacion'
];

function parseMetadataTxt(txt) {
  const lines = txt.split('\n').filter(l => l.trim());
  // Skip header line
  const dataLines = lines.slice(1);

  return dataLines.map(line => {
    const fields = line.split('~');
    const record = {};
    METADATA_COLUMNS.forEach((col, i) => {
      record[col] = fields[i] || '';
    });
    // Convert numeric fields
    record.monto = parseFloat(record.monto) || 0;
    record.estatus = record.estatus === '1' ? 'Vigente' : 'Cancelado';
    return record;
  });
}

function printMetadataSummary(records) {
  console.log(`\n${'='.repeat(70)}`);
  console.log(`METADATA SUMMARY: ${records.length} CFDIs`);
  console.log('='.repeat(70));

  const vigentes = records.filter(r => r.estatus === 'Vigente');
  const cancelados = records.filter(r => r.estatus === 'Cancelado');
  const totalMonto = vigentes.reduce((s, r) => s + r.monto, 0);

  console.log(`  Vigentes: ${vigentes.length} | Cancelados: ${cancelados.length}`);
  console.log(`  Total monto (vigentes): $${totalMonto.toLocaleString('es-MX', { minimumFractionDigits: 2 })}`);

  // Group by EfectoComprobante
  const byTipo = {};
  for (const r of vigentes) {
    const tipo = r.efectoComprobante || '?';
    if (!byTipo[tipo]) byTipo[tipo] = { count: 0, total: 0 };
    byTipo[tipo].count++;
    byTipo[tipo].total += r.monto;
  }
  console.log('\n  By tipo:');
  for (const [tipo, { count, total }] of Object.entries(byTipo)) {
    const label = tipo === 'I' ? 'Ingreso' : tipo === 'E' ? 'Egreso' : tipo === 'P' ? 'Pago' : tipo === 'T' ? 'Traslado' : tipo;
    console.log(`    ${label} (${tipo}): ${count} CFDIs, $${total.toLocaleString('es-MX', { minimumFractionDigits: 2 })}`);
  }

  // List each CFDI
  console.log(`\n  ${'─'.repeat(66)}`);
  console.log(`  ${'UUID'.padEnd(38)} ${'Emisor/Receptor'.padEnd(20)} ${'Monto'.padStart(12)} St`);
  console.log(`  ${'─'.repeat(66)}`);
  for (const r of records) {
    const counterpart = direction === 'received' ? r.nombreEmisor : r.nombreReceptor;
    const name = counterpart.length > 18 ? counterpart.substring(0, 18) + '..' : counterpart;
    const st = r.estatus === 'Vigente' ? 'OK' : 'XX';
    console.log(`  ${r.uuid} ${name.padEnd(20)} $${r.monto.toLocaleString('es-MX', { minimumFractionDigits: 2 }).padStart(11)} ${st}`);
  }
  console.log();

  return records;
}

// ---------------------------------------------------------------------------
// Main flow
// ---------------------------------------------------------------------------
async function main() {
  let token = await authenticate();

  const idSolicitud = await requestMetadata(token);

  // Step 3: Poll verification
  let attempts = 0;
  const maxAttempts = 20;
  const allFiles = [];

  while (attempts < maxAttempts) {
    attempts++;
    const { estado, packageIds } = await verifyRequest(token, idSolicitud);

    if (estado === '3') {
      console.log('\nPackages ready! Downloading...');
      for (const pkgId of packageIds) {
        const filename = await downloadPackage(token, pkgId);
        if (filename) allFiles.push(filename);
      }
      break;
    }

    if (estado === '4' || estado === '5' || estado === '6') {
      console.error(`\nRequest ended with status: ${estado}`);
      return;
    }

    const waitSec = 30;
    console.log(`\nWaiting ${waitSec}s before next check (attempt ${attempts}/${maxAttempts})...`);
    await new Promise(r => setTimeout(r, waitSec * 1000));

    // Re-authenticate if token might be expiring (every 5 attempts = ~2.5 min)
    if (attempts % 5 === 0) {
      console.log('Re-authenticating (token refresh)...');
      token = await authenticate();
    }
  }

  if (allFiles.length === 0) {
    console.log(`\nMax attempts (${maxAttempts}) reached. IdSolicitud: ${idSolicitud}`);
    return;
  }

  // Parse and display metadata from downloaded ZIPs
  let allRecords = [];
  for (const zipFile of allFiles) {
    const zipBuffer = readFileSync(zipFile);
    const entries = extractZipEntries(zipBuffer);
    for (const entry of entries) {
      if (entry.name.endsWith('.txt')) {
        const records = parseMetadataTxt(entry.data);
        allRecords = allRecords.concat(records);
      }
    }
  }

  if (allRecords.length > 0) {
    printMetadataSummary(allRecords);

    // Save as JSON for easy consumption
    const jsonFile = `sat-metadata-${direction}-${monthStr || 'all'}.json`;
    writeFileSync(jsonFile, JSON.stringify(allRecords, null, 2));
    console.log(`Parsed metadata saved to: ${jsonFile}`);
  }
}

main().catch(e => {
  console.error('Fatal error:', e.message);
  process.exit(1);
});
