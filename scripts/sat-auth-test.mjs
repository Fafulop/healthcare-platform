/**
 * SAT Descarga Masiva — Authentication Test (Step 1 only)
 *
 * Zero dependencies — uses only Node.js built-in crypto and https.
 *
 * Usage:
 *   node scripts/sat-auth-test.mjs <path-to-efirma.cer> <path-to-efirma.key> <password>
 *
 * What it does:
 *   1. Reads the e.Firma .cer and .key files
 *   2. Builds the SOAP XML envelope with WS-Security
 *   3. Signs it with RSA-SHA1 (Exclusive XML Canonicalization)
 *   4. POSTs to SAT authentication endpoint
 *   5. Prints the JWT token if successful
 *
 * Security note: password is visible in process list. For production, use env vars.
 */

import { readFileSync } from 'fs';
import { createHash, createSign, createPrivateKey, X509Certificate } from 'crypto';
import https from 'https';

// ---------------------------------------------------------------------------
// 1. Parse CLI args
// ---------------------------------------------------------------------------
const [,, cerPath, keyPath, password] = process.argv;

if (!cerPath || !keyPath || !password) {
  console.error('Usage: node scripts/sat-auth-test.mjs <efirma.cer> <efirma.key> <password>');
  console.error('');
  console.error('  efirma.cer  — path to the e.Firma certificate (.cer, DER format)');
  console.error('  efirma.key  — path to the e.Firma private key (.key, DER/PKCS8 encrypted)');
  console.error('  password    — password for the .key file');
  process.exit(1);
}

// ---------------------------------------------------------------------------
// 2. Load certificate and private key
// ---------------------------------------------------------------------------
console.log('--- Loading credentials ---');

const cerDer = readFileSync(cerPath);
const keyDer = readFileSync(keyPath);

// Convert DER certificate to PEM
const cerBase64 = cerDer.toString('base64');
const cerPem = `-----BEGIN CERTIFICATE-----\n${cerBase64.match(/.{1,64}/g).join('\n')}\n-----END CERTIFICATE-----`;

// Parse certificate to inspect it
try {
  const cert = new X509Certificate(cerPem);
  console.log('Certificate subject:', cert.subject);
  console.log('Certificate issuer:', cert.issuer);
  console.log('Valid from:', cert.validFrom);
  console.log('Valid to:', cert.validTo);

  // Check if it's FIEL or CSD by key usage count
  // FIEL has 4 key usages, CSD has 2
  const keyUsage = cert.keyUsage;
  if (keyUsage) {
    console.log('Key Usage:', keyUsage);
    if (keyUsage.length === 4) {
      console.log('OK: This is an e.Firma (4 key usages).');
    } else if (keyUsage.length <= 2) {
      console.warn('WARNING: This looks like a CSD (2 key usages), not e.Firma (4 key usages).');
      console.warn('SAT descarga masiva requires e.Firma. It may reject this certificate.');
    } else {
      console.warn('WARNING: Unexpected key usage count:', keyUsage.length);
    }
  }
} catch (e) {
  console.log('Could not parse certificate metadata (continuing anyway):', e.message);
}

// Convert DER encrypted private key to PEM and decrypt
// SAT .key files are PKCS#8 encrypted DER
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
  console.log('Private key loaded successfully.');
} catch (e) {
  console.error('ERROR loading private key. Wrong password or format?');
  console.error(e.message);
  process.exit(1);
}

// ---------------------------------------------------------------------------
// 3. Build SOAP envelope
// ---------------------------------------------------------------------------
console.log('\n--- Building SOAP envelope ---');

const now = new Date();
const expires = new Date(now.getTime() + 5 * 60 * 1000); // +5 min

const created = now.toISOString().replace(/\.\d{3}Z$/, '.000Z');
const expiresStr = expires.toISOString().replace(/\.\d{3}Z$/, '.000Z');

console.log('Timestamp Created:', created);
console.log('Timestamp Expires:', expiresStr);

// ---------------------------------------------------------------------------
// Exclusive XML Canonicalization (exc-c14n) notes:
//
// When canonicalizing a node subset, namespace declarations are rendered on
// an element if the namespace prefix is "visibly utilized" by that element
// or its attributes. In the envelope, <u:Timestamp> inherits xmlns:u from
// the root <s:Envelope>. But when SAT extracts and canonicalizes just the
// Timestamp node, exc-c14n WILL include the xmlns:u declaration because
// the u: prefix is visibly used on <u:Timestamp>, <u:Created>, <u:Expires>.
//
// So the canonical form of the Timestamp includes xmlns:u even though
// the envelope doesn't repeat it inline. We must compute the digest from
// this canonical form.
//
// Same logic applies to SignedInfo: when embedded inside <Signature> in the
// envelope, it inherits xmlns from <Signature xmlns="http://www.w3.org/2000/09/xmldsig#">.
// But the canonical form of SignedInfo for signing purposes includes the
// default namespace declaration because it's visibly used.
// ---------------------------------------------------------------------------

// Canonical form of Timestamp (what SAT will compute when verifying digest)
// exc-c14n adds xmlns:u because the u: prefix is visibly used
const c14nTimestamp =
  '<u:Timestamp xmlns:u="http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-wssecurity-utility-1.0.xsd" u:Id="_0">' +
  `<u:Created>${created}</u:Created>` +
  `<u:Expires>${expiresStr}</u:Expires>` +
  '</u:Timestamp>';

// Digest: SHA-1 of the canonicalized Timestamp, base64-encoded
const digestValue = createHash('sha1').update(c14nTimestamp).digest('base64');
console.log('DigestValue (SHA1 of Timestamp):', digestValue);

// Canonical form of SignedInfo (what gets signed with the private key)
// exc-c14n adds xmlns because the default namespace is visibly used by SignedInfo's children
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

// Sign: RSA-SHA1 of the canonicalized SignedInfo
const signer = createSign('RSA-SHA1');
signer.update(c14nSignedInfo);
const signatureValue = signer.sign(privateKey, 'base64');
console.log('SignatureValue (first 40 chars):', signatureValue.substring(0, 40) + '...');

// Full SOAP envelope
// Note: In the envelope, SignedInfo does NOT have xmlns because it inherits
// from <Signature xmlns="...">, and Timestamp does NOT have xmlns:u because
// it inherits from <s:Envelope xmlns:u="...">. The canonical forms above
// include those declarations because exc-c14n renders them for visibly used prefixes.
const soapEnvelope =
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

console.log('\n--- SOAP envelope size:', soapEnvelope.length, 'bytes ---');

// ---------------------------------------------------------------------------
// 4. Send to SAT
// ---------------------------------------------------------------------------
console.log('\n--- Sending to SAT ---');

const SAT_AUTH_URL = 'https://cfdidescargamasivasolicitud.clouda.sat.gob.mx/Autenticacion/Autenticacion.svc';

const response = await new Promise((resolve, reject) => {
  const url = new URL(SAT_AUTH_URL);
  const options = {
    hostname: url.hostname,
    path: url.pathname,
    method: 'POST',
    timeout: 30000,
    headers: {
      'Content-Type': 'text/xml; charset=utf-8',
      'SOAPAction': 'http://DescargaMasivaTerceros.gob.mx/IAutenticacion/Autentica',
      'Content-Length': Buffer.byteLength(soapEnvelope, 'utf-8'),
    },
  };

  const req = https.request(options, (res) => {
    let body = '';
    res.on('data', (chunk) => body += chunk);
    res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body }));
  });

  req.on('timeout', () => { req.destroy(); reject(new Error('Request timed out (30s)')); });
  req.on('error', reject);
  req.write(soapEnvelope);
  req.end();
});

console.log('HTTP Status:', response.status);

// ---------------------------------------------------------------------------
// 5. Parse response
// ---------------------------------------------------------------------------
console.log('\n--- Response ---');

if (response.status === 200) {
  // Try to extract token from response
  const tokenMatch = response.body.match(/<AutenticaResult>(.*?)<\/AutenticaResult>/i)
    || response.body.match(/<autenticaresult>(.*?)<\/autenticaresult>/i);

  if (tokenMatch) {
    const token = tokenMatch[1];
    console.log('SUCCESS! Got JWT token.');
    console.log('Token (first 80 chars):', token.substring(0, 80) + '...');
    console.log('Token length:', token.length);

    // Try to decode JWT payload
    try {
      const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString());
      console.log('\nJWT payload:');
      console.log('  Issued at:', new Date(payload.iat * 1000).toISOString());
      console.log('  Expires:', new Date(payload.exp * 1000).toISOString());
      console.log('  Issuer:', payload.iss);
    } catch {
      console.log('(Could not decode JWT payload)');
    }
  } else {
    console.log('Got 200 but no token found in response.');
    console.log('Response body:', response.body.substring(0, 500));
  }
} else {
  // Extract fault message
  const faultMatch = response.body.match(/<faultstring[^>]*>(.*?)<\/faultstring>/i);
  const faultCode = response.body.match(/<faultcode[^>]*>(.*?)<\/faultcode>/i);

  console.log('FAILED.');
  if (faultCode) console.log('Fault code:', faultCode[1]);
  if (faultMatch) console.log('Fault message:', faultMatch[1]);
  console.log('\nFull response body:');
  console.log(response.body.substring(0, 1000));
}
