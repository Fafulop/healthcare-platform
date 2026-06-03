# Database Connection Pool Exhaustion — Full Diagnosis

**Date:** 2026-06-03
**Symptom:** Intermittent 50-second response times on `/api/auth/session`, `/api/auth/get-token`, and all dashboard pages. Login page loads fine (6ms), but any authenticated route hangs ~50s before responding.

---

## 1. Prisma Client Configuration

### File: `packages/database/src/index.ts`

```typescript
export const prisma = globalForPrisma.prisma ?? new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
});
```

**Issues:**
- Singleton pattern is correctly implemented (prevents multiple instances in dev hot-reload)
- **No explicit connection pool configuration** — relies entirely on Prisma defaults
- In development, query logging (`['query', 'error', 'warn']`) adds overhead to every query
- No `errorFormat`, `transactionIsolationLevel`, or datasource URL overrides

### Prisma Default Pool Behavior
- Default pool size: `num_physical_cpus * 2 + 1` (typically ~5-10 on Railway)
- Default pool timeout: **10 seconds** (waits for a free connection, then throws)
- No statement timeout (queries can run indefinitely)
- No idle connection timeout

---

## 2. DATABASE_URL — Missing Pool Parameters

### File: `.env` / Railway environment

```
DATABASE_URL="postgresql://postgres:password@host:port/docs_mono"
```

**Critical:** The connection string has zero pool parameters. Should include:

| Parameter | Current | Recommended | Purpose |
|-----------|---------|-------------|---------|
| `connection_limit` | not set (auto ~5-10) | `15` | Max connections in pool |
| `pool_timeout` | not set (10s default) | `15` | Seconds to wait for free connection before error |
| `statement_timeout` | not set (unlimited) | `30000` | Kill queries running longer than 30s (ms) |
| `idle_in_transaction_session_timeout` | not set | `10000` | Kill idle transactions after 10s (ms) |
| `connect_timeout` | not set | `10` | Timeout for establishing new connection (s) |

**Recommended URL format:**
```
postgresql://user:pass@host:port/db?connection_limit=15&pool_timeout=15&statement_timeout=30000&connect_timeout=10
```

---

## 3. Second Prisma Client — LLM Assistant

### File: `apps/doctor/src/lib/llm-assistant/db.ts`

```typescript
export const prisma = globalForLlmPrisma.llmPrisma ??
  new PrismaClient({
    datasourceUrl,
    log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
  });
```

**Issue:** This creates a **completely separate Prisma client** with its own connection pool for the LLM/pgvector database. When both clients are active simultaneously:
- Pool 1 (main): ~5-10 connections to main DB
- Pool 2 (LLM): ~5-10 connections to LLM DB
- Total connections from a single server instance can reach 20+
- If both databases are on the same Postgres server, this doubles the pressure

**Impact:** If a doctor uses the AI assistant while other operations are running, the combined pool usage can exceed what the database allows.

---

## 4. NextAuth — Database Session Strategy

### File: `packages/auth/src/nextauth-config.ts`

```typescript
session: {
  strategy: "database" as const,
  maxAge: 30 * 24 * 60 * 60, // 30 days
}
```

**This is the single biggest contributor to pool pressure.**

Every authenticated API request goes through `validateAuthToken()` which:
1. Decodes the token
2. Runs `prisma.user.findUnique()` to verify the user exists and check `sessionVersion`
3. Only then does the actual route logic run (which makes its own queries)

**Math:** If a doctor has 3 tabs open and each tab makes 5 API calls on load, that's 15 session validation queries just from page load. Multiply by concurrent doctors.

Additionally, on every sign-in:
```typescript
await prisma.user.update({
  where: { email: user.email },
  data: { googleAccessToken: ... }
});
```
This runs without checking if the value actually changed — unnecessary writes on every login.

---

## 5. Fire-and-Forget Database Calls (Connection Leaks)

### File: `apps/api/src/app/api/appointments/bookings/route.ts`

The POST endpoint for creating a booking makes **7+ sequential database calls**, plus unawaited async operations:

```
Sequential (awaited):
1. prisma.appointmentSlot.findUnique()     — validate slot
2. prisma.doctor.findUnique()              — fetch booking field settings
3. prisma.service.count()                  — validate service exists
4. prisma.service.findFirst()              — fetch service details
5. prisma.$transaction([...])              — atomic booking creation
6. prisma.booking.findUnique()             — re-fetch with relations

Fire-and-forget (NOT awaited):
7. prisma.user.findUnique()                — inside getCalendarTokens().then(...)
8. prisma.appointmentSlot.update()         — update googleEventId
9. prisma.doctor.findUnique()              — for Telegram notification
```

**The fire-and-forget pattern is dangerous:**
```typescript
// Line ~293 — NOT awaited, holds connection after response sent
getCalendarTokens(slot.doctorId).then(async tokens => {
  if (!tokens) return;
  // ... multiple await calls inside
  await prisma.appointmentSlot.update({...});
}).catch((err) => console.error('[GCal sync] booking POST:', err))
.finally(() => {
  sendBookingConfirmationEmail(booking.id).catch(...);
});

// Line ~360 — NOT awaited, separate connection held
prisma.doctor.findUnique({...}).then((doc) => {
  if (!doc?.telegramChatId || !doc.telegramNotifyBooking) return;
  return sendNewBookingTelegram(...);
}).catch((err) => console.error('Telegram notification failed:', err));
```

**What happens:** The HTTP response is sent, but these promises still hold database connections. If the serverless function is frozen before they complete, those connections may never be properly returned to the pool.

---

## 6. SAT Cron Job — Query Loop

### File: `apps/api/src/app/api/cron/sat-auto-sync/route.ts`

```typescript
const profiles = await prisma.doctorFiscalProfile.findMany({...}); // 1 query

for (const profile of profiles) {                    // N doctors
  for (const direction of ['received', 'emitted']) { // x2
    for (const requestType of ['metadata', 'xml']) { // x2
      // Per iteration:
      const recentJob = await prisma.satSyncJob.findFirst({...});  // 1 query
      const activeJob = await prisma.satSyncJob.findFirst({...});  // 1 query
      await prisma.satSyncJob.create({...});                       // 1 query (conditional)
    }
  }
}
```

**Math:** 1 + (N doctors x 4 combinations x 2-3 queries) = **1 + N*8 to N*12 queries**

With 5 doctors: **41-61 sequential database calls per cron execution.**

These are sequential (not batched), so each one acquires and releases a pool connection. If this cron runs while doctors are actively using the app, it competes for the same limited pool.

---

## 7. Heavy Includes Without Pagination

### File: `apps/api/src/app/api/practice-management/ledger/route.ts`

```typescript
const [total, entries] = await prisma.$transaction([
  prisma.ledgerEntry.count({ where }),
  prisma.ledgerEntry.findMany({
    where,
    include: {
      attachments: true,
      facturas: true,
      facturasXml: true,
      client:   { select: { id: true, businessName: true, contactName: true } },
      supplier: { select: { id: true, businessName: true, contactName: true } },
      sale:     { select: { id: true, saleNumber: true, total: true } },
      purchase: { select: { id: true, purchaseNumber: true, total: true } },
    },
    orderBy: { transactionDate: 'desc' },
    skip: pagination.skip,
    take: pagination.limit,
  }),
]);
```

**7 nested relations** per entry. Even with pagination (`take: limit`), if the limit is high or the relations are large (many attachments/facturas per entry), Prisma generates expensive JOINs or subqueries that hold the connection longer than simple queries.

### File: `apps/api/src/app/api/appointments/slots/route.ts`

Fetches slots with nested `location` and all active `bookings` — no visible pagination. Could return thousands of records for busy doctors.

---

## 8. Duplicate Detection — Expensive Range Scans

### File: `apps/api/src/app/api/practice-management/ledger/route.ts` (POST)

```typescript
// Line ~256 — runs on every ledger entry creation
const duplicate = await prisma.ledgerEntry.findFirst({
  where: {
    doctorId,
    amount: { gte: amount * 0.99, lte: amount * 1.01 },
    transactionDate: { gte: minDate, lte: maxDate }, // +/- 3 days
    entryType,
  },
});
```

This range scan over amount + date + type runs on **every** new ledger entry. Without a composite index on `(doctorId, entryType, transactionDate, amount)`, it could cause full table scans on large datasets.

### File: `apps/api/src/app/api/sat-descarga/register-to-ledger/route.ts`

Similar pattern — smart matching searches for candidates within +/-7 days and +/-1% amount tolerance, scores them, and does this **per CFDI** in a loop.

---

## 9. Transaction Usage Across Codebase

**46 instances of `prisma.$transaction()` found.** Most are properly structured, but notable patterns:

- **Bookings:** Transaction wraps creation but post-hooks (email, calendar, telegram) run outside it with their own connections
- **SAT register-to-ledger:** Bulk transaction with a loop inside — if the loop fails mid-way, the transaction rolls back but the connection was held for the entire loop duration
- **Ledger bulk operations:** Some use interactive transactions (`prisma.$transaction(async (tx) => {...})`) which hold a connection for the entire callback duration

---

## 10. No Rate Limiting or Request Queuing

### File: `apps/api/src/middleware.ts`

Only handles CORS headers. No:
- Rate limiting per user/IP
- Request queuing to prevent thundering herd
- Connection-aware request throttling

When a doctor refreshes a page with 5+ parallel API calls, all of them compete for pool connections simultaneously.

---

## Fix Plan

### Phase 1 — Immediate (pool configuration)

| Fix | File | Effort |
|-----|------|--------|
| Add `connection_limit=15&pool_timeout=15&statement_timeout=30000` to DATABASE_URL | Railway env vars | 5 min |
| Add same params to LLM database URL | Railway env vars | 5 min |

### Phase 2 — Quick wins (1-2 hours)

NOTE: Database sessions strategy is CORRECT and must stay — it was chosen intentionally to fix the kill switch (50+ internal routes bypassed sessionVersion check with JWT). Do NOT switch back to JWT.

| Fix | File | Effort |
|-----|------|--------|
| Await fire-and-forget promises in bookings POST | `apps/api/src/app/api/appointments/bookings/route.ts` | 20 min |
| Skip unnecessary `user.update` on sign-in if values unchanged | `packages/auth/src/nextauth-config.ts` | 10 min |

### Phase 3 — Medium term (half day)

| Fix | File | Effort |
|-----|------|--------|
| Batch SAT cron queries (use `createMany`, `findMany` with `IN` clause) | `apps/api/src/app/api/cron/sat-auto-sync/route.ts` | 1 hr |
| Add composite index for duplicate detection | New migration | 15 min |
| Reduce ledger includes (lazy-load attachments/facturas) | `apps/api/src/app/api/practice-management/ledger/route.ts` | 30 min |
| Add pagination to appointment slots GET | `apps/api/src/app/api/appointments/slots/route.ts` | 20 min |
| Consider merging LLM Prisma client or using shared pool | `apps/doctor/src/lib/llm-assistant/db.ts` | 30 min |

### Phase 4 — Long term

| Fix | Details |
|-----|---------|
| Add Prisma Accelerate or PgBouncer | External connection pooler to handle burst traffic |
| Add request-level connection monitoring | Log pool usage per route to identify hot spots |
| Implement request queuing middleware | Limit concurrent DB-heavy requests per user |

---

## How to Verify the Fix

After applying Phase 1 + 2:

1. Open 3 browser tabs to different dashboard pages simultaneously
2. Check Railway logs for response times — should drop from 50s to <2s
3. Monitor Postgres `pg_stat_activity` for connection count:
   ```sql
   SELECT count(*), state FROM pg_stat_activity
   WHERE datname = 'docs_mono'
   GROUP BY state;
   ```
4. If `idle in transaction` connections appear, Phase 3 fixes are needed

If pool exhaustion recurs under higher load, Phase 4 (PgBouncer/Accelerate) becomes necessary.
