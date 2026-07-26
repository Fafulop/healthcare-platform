/**
 * Gate: nothing sensitive may ride the PUBLIC doctor payload.
 *
 * GET /api/doctors and GET /api/doctors/[slug] are unauthenticated by design.
 * They fetch with `include` and no `select`, so EVERY scalar column of `Doctor`
 * ships to anonymous callers unless it is listed in DOCTOR_PRIVATE_FIELDS. That
 * default is how live MercadoPago tokens, a Stripe account id, calendar ids,
 * Telegram chat ids, the account's billing tier and the doctors' signature image
 * ended up public (found 2026-07-26).
 *
 * Fixing those instances does not close the CATEGORY: the next sensitive column
 * added to the model leaks again, silently, and no test fails. This gate makes
 * that impossible to do by accident.
 *
 * It asserts:
 *   1. every Doctor field whose NAME looks sensitive is either omitted or
 *      explicitly allowed here with a reason;
 *   2. both public routes still apply `omit: DOCTOR_PRIVATE_FIELDS` (so deleting
 *      the omit is caught, not just forgetting to extend the list);
 *   3. every name in DOCTOR_PRIVATE_FIELDS is a real Doctor field (a rename must
 *      not leave a dead entry silently protecting nothing).
 *
 * Negative-tested: adding a fake `stripeSecretKey` column makes check 1 fail;
 * removing an `omit:` line makes check 2 fail.
 */

import { readFileSync } from 'fs';
import { join } from 'path';
import { DOCTOR_PRIVATE_FIELDS } from '../apps/api/src/lib/doctor-public-fields';

const ROOT = join(__dirname, '..');
const SCHEMA = join(ROOT, 'packages/database/prisma/schema.prisma');
const PUBLIC_ROUTES = [
  'apps/api/src/app/api/doctors/route.ts',
  'apps/api/src/app/api/doctors/[slug]/route.ts',
];

/** Name patterns that mean "this is a credential, a private handle, or commercial data". */
const SENSITIVE_PATTERN =
  /token|secret|password|credential|apikey|api_key|accountid|chatid|channelid|calendarid|signature|tier/i;

/**
 * Sensitive-LOOKING fields that are deliberately public, each with the reason.
 * Adding an entry here is a decision to publish the field — not a formality.
 */
const ALLOWED_PUBLIC: Record<string, string> = {
  prescriptionCredentials:
    'cédula + título: professional qualifications printed on the prescription header; a cédula is a public registry number the profile page already shows',
  googleCalendarEnabled:
    'boolean connection status, not an identifier — reveals nothing usable',
  mpConnected: 'boolean connection status, not an identifier',
  stripeOnboardingComplete: 'boolean onboarding status, not an identifier',
  stripeChargesEnabled: 'boolean capability status, not an identifier',
  stripePayoutsEnabled: 'boolean capability status, not an identifier',
};

const schema = readFileSync(SCHEMA, 'utf8');
const doctorBlock = schema.match(/^model Doctor \{([\s\S]*?)^\}/m)?.[1];
if (!doctorBlock) {
  console.error('FAIL — no se pudo leer el modelo Doctor de schema.prisma');
  process.exit(1);
}

// Only SCALAR columns matter: a relation (`llmTokenUsages LlmTokenUsage[]`,
// `user User?`) is never in the response unless explicitly included, so judging
// it by name would be a false positive. Match on the TYPE, not the name.
const PRISMA_SCALARS = new Set([
  'String', 'Boolean', 'Int', 'BigInt', 'Float', 'Decimal', 'DateTime', 'Json', 'Bytes',
]);
const fields = doctorBlock
  .split('\n')
  .map((l) => l.trim())
  .filter((l) => l && !l.startsWith('//') && !l.startsWith('@@'))
  .map((l) => l.split(/\s+/))
  .filter(([name, type]) => {
    if (!name || !type || !/^[a-zA-Z][a-zA-Z0-9]*$/.test(name)) return false;
    return PRISMA_SCALARS.has(type.replace(/[?[\]]/g, ''));
  })
  .map(([name]) => name);

const omitted = new Set(Object.keys(DOCTOR_PRIVATE_FIELDS));
let failed = false;

console.log('\nGate — payload público de doctores\n');
console.log(`Campos del modelo Doctor: ${fields.length}`);
console.log(`Campos omitidos del payload público: ${omitted.size}`);

// ── 1. sensitive-looking fields must be omitted or explicitly allowed ────────
const leaking = fields.filter(
  (f) => SENSITIVE_PATTERN.test(f) && !omitted.has(f) && !(f in ALLOWED_PUBLIC)
);
if (leaking.length) {
  failed = true;
  console.error(
    `\nFAIL — campos sensibles que SÍ saldrían en el payload público:\n  ${leaking.join('\n  ')}\n` +
      `  → agrégalos a DOCTOR_PRIVATE_FIELDS (apps/api/src/lib/doctor-public-fields.ts)\n` +
      `  → o, si de verdad deben ser públicos, a ALLOWED_PUBLIC de este script CON su razón.`
  );
} else {
  console.log('OK   ningún campo sensible sin omitir ni justificar');
}

// ── 2. both public routes must still apply the omit ─────────────────────────
for (const rel of PUBLIC_ROUTES) {
  const src = readFileSync(join(ROOT, rel), 'utf8');
  if (src.includes('omit: DOCTOR_PRIVATE_FIELDS')) {
    console.log(`OK   ${rel} aplica omit`);
  } else {
    failed = true;
    console.error(`FAIL — ${rel} ya NO aplica \`omit: DOCTOR_PRIVATE_FIELDS\` — el payload volvió a exponer todo`);
  }
}

// ── 3. no dead entries (a rename must not leave a no-op protection) ─────────
const dead = [...omitted].filter((f) => !fields.includes(f));
if (dead.length) {
  failed = true;
  console.error(
    `FAIL — DOCTOR_PRIVATE_FIELDS nombra campos que no existen en Doctor: ${dead.join(', ')}\n` +
      `  → un rename dejó una entrada muerta que ya no protege nada.`
  );
} else {
  console.log('OK   toda entrada de DOCTOR_PRIVATE_FIELDS es un campo real');
}

// ── 4. the fields the public site needs must NOT be omitted ─────────────────
// Mirrors transformDoctorToProfile (apps/public/src/lib/data.ts). Over-omitting
// breaks public profile pages silently — the gate cuts both ways.
const PUBLIC_SITE_NEEDS = [
  'slug', 'doctorFullName', 'lastName', 'primarySpecialty', 'subspecialties',
  'cedulaProfesional', 'heroImage', 'locationSummary', 'city', 'shortBio',
  'longBio', 'yearsExperience', 'conditions', 'procedures', 'nextAvailableDate',
  'appointmentModes', 'clinicAddress', 'clinicPhone', 'clinicWhatsapp',
  'clinicHours', 'clinicGeoLat', 'clinicGeoLng', 'socialLinkedin', 'socialTwitter',
  'socialInstagram', 'socialFacebook', 'socialTiktok', 'colorPalette', 'googleAdsId',
];
const overOmitted = PUBLIC_SITE_NEEDS.filter((f) => omitted.has(f));
if (overOmitted.length) {
  failed = true;
  console.error(`FAIL — campos que el sitio público necesita fueron omitidos: ${overOmitted.join(', ')}`);
} else {
  console.log('OK   ningún campo requerido por el sitio público fue omitido');
}

console.log(
  failed ? '\nGate FALLÓ.\n' : '\nAll checks passed.\n'
);
process.exit(failed ? 1 : 0);
