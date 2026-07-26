// Fields of `Doctor` that must NEVER appear in a PUBLIC doctor payload.
//
// GET /api/doctors and GET /api/doctors/[slug] are intentionally unauthenticated
// (the public site builds profile pages and the sitemap from them). They fetch
// with `include` and no `select`, which returns EVERY scalar column — so each
// new column added to the model has silently joined the public response.
//
// That is how live MercadoPago OAuth tokens, a Stripe account id, Google
// Calendar ids and Telegram chat ids ended up being served to anonymous callers,
// and how TIERS added the account's billing plan to it.
//
// Verified before removing (2026-07-26): no HTTP consumer reads any of these.
// The public site maps responses through `transformDoctorToProfile`
// (apps/public/src/lib/data.ts), which touches none of them; the admin app reads
// only profile fields; the server-side readers of stripe/mp/calendar fields
// (agent tools, google-calendar-sync) query Prisma directly, not this endpoint.
//
// Deliberately NOT removed: notification preferences, pdf/prescription settings
// and connection-status booleans. They are internal but not credentials, and
// they have live client-side consumers — narrowing those is a separate job.
export const DOCTOR_PRIVATE_FIELDS = {
  // Product plan (TIERS) — commercial data, not profile data.
  tier: true,
  // Payment provider credentials and account identifiers.
  mpAccessToken: true,
  mpRefreshToken: true,
  mpUserId: true,
  mpPublicKey: true,
  mpTokenExpiresAt: true,
  stripeAccountId: true,
  // Calendar identifiers + push-channel handles.
  googleCalendarId: true,
  googleChannelId: true,
  googleChannelResourceId: true,
  // Private chat identifier for the doctor's Telegram notifications.
  telegramChatId: true,
  // The doctor's handwritten SIGNATURE image. Populated for 4 doctors and hosted
  // on public object storage, so publishing the URL effectively publishes the
  // signature. Prescriptions stamp signature + cédula, and issuing them is
  // owner-only precisely because that pair is legally binding (NUEVOS USUARIOS
  // 00-REQUISITOS §3.5) — handing it to anonymous callers undercuts that.
  // `cedulaProfesional`, `prescriptionCredentials` and `prescriptionLogoUrl` stay
  // public: a cédula is a public registry number the profile page already shows.
  prescriptionSignatureUrl: true,
} as const;
