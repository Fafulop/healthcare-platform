# SAT Descarga — Re-Sync Guide

**Date:** 2026-06-08
**Purpose:** How to force re-download all XML data from SAT when parser fixes or schema changes require fresh data.

---

## When You Need This

- Parser bug was fixed (e.g., regex matched wrong attribute) and existing `sat_cfdi_details` rows have bad data
- New fields were added to the parser and you need to re-parse all XMLs
- `sat_pagos` records need to be regenerated from complemento XMLs

---

## Prerequisites

- **CRON_SECRET**: `cc1f7f1c5d771ddd92a0f0268aded018c165858cd0eb10589c992997d9e537a8`
- **API URL**: `https://healthcareapi-production-fb70.up.railway.app`
- Worker diagnostic endpoint: `GET /api/cron/sat-sync-worker?secret=CRON_SECRET`
- Worker process endpoint: `POST /api/cron/sat-sync-worker` with `Authorization: Bearer CRON_SECRET`

---

## Step 1: Bump the XML FechaInicial Offset

SAT has a **2-request lifetime limit** per exact date range for XML downloads (error 5002). Each re-sync needs a new offset so SAT treats it as a fresh request.

**File:** `apps/api/src/lib/sat-descarga.ts` — function `requestXml()`

```typescript
// Increment the seconds offset each time you re-sync
const fechaInicial = formatSatDate(dateFrom, '00:00:XX');
```

**Offset history:**

| Offset | Used for | Date |
|--------|----------|------|
| `00:00:00` | Metadata requests (always, never change) | — |
| `00:00:01` | First XML backfill | 2026-06-06 |
| `00:00:02` | Re-sync after parser bug (Total matched SubTotal) | 2026-06-08 |
| `00:00:03` | Next re-sync (update this row) | — |

**Important:** Commit and push this change. Wait for Railway deploy (~2 min) before proceeding.

---

## Step 2: Reset All Completed XML Jobs to Pending

```bash
curl -s "https://healthcareapi-production-fb70.up.railway.app/api/cron/sat-sync-worker?secret=CRON_SECRET&reset=force-xml"
```

Expected response: `{"reset":85,"param":"force-xml"}` (number = how many XML jobs were reset)

Also reset any failed jobs:

```bash
curl -s "https://healthcareapi-production-fb70.up.railway.app/api/cron/sat-sync-worker?secret=CRON_SECRET&reset=all-xml"
```

### Reset Options Reference

| Param | What it resets |
|-------|---------------|
| `reset=force-xml` | All **completed** XML jobs → pending |
| `reset=all-xml` | All **failed** XML jobs → pending |
| `reset=<jobId>` | Single job (any status) → pending |

---

## Step 3: Verify State

```bash
curl -s "https://healthcareapi-production-fb70.up.railway.app/api/cron/sat-sync-worker?secret=CRON_SECRET" | node -e "let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>{const j=JSON.parse(d);console.log(j.summary)})"
```

You should see `pending: ~85` (all XML jobs), `completed: ~59` (metadata jobs stay).

---

## Step 4: Loop the Worker

The cron runs every 2 minutes and processes 3 jobs per run. To speed it up, call the worker endpoint in a loop:

```bash
for i in $(seq 1 80); do
  echo "=== Run $i ($(date +%H:%M:%S)) ==="
  curl -s -X POST "https://healthcareapi-production-fb70.up.railway.app/api/cron/sat-sync-worker" \
    -H "Authorization: Bearer CRON_SECRET" \
    | node -e "let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>{try{const j=JSON.parse(d);console.log('Processed:',j.data?.processed,'|',j.data?.results?.map(r=>r.jobId+':'+r.status).join(', '))}catch(e){console.log('parse error')}})"
  sleep 5
done
```

### What the output means

| Status | Meaning |
|--------|---------|
| `33:polling` | Job sent request to SAT, now waiting for SAT to prepare ZIP |
| `33:polling: estado=2` | SAT still processing (normal, wait) |
| `33:downloading` | SAT ready, downloading ZIP |
| `33:completed: 12 XML CFDIs parsed` | Done! XMLs downloaded and parsed into DB |
| `33:failed: SAT: Rechazada codSol=5002` | Lifetime limit hit — need to bump offset again |

### How long it takes

- Each job goes through: `pending → polling → downloading → completed`
- SAT usually takes 30s-5min per batch to prepare ZIPs
- Worker processes 3 jobs per call
- ~85 XML jobs / 3 per batch = ~28 batches
- At ~2-5 min per batch = **1-2.5 hours total**

---

## Step 5: Monitor Progress

Check the summary periodically:

```bash
curl -s "https://healthcareapi-production-fb70.up.railway.app/api/cron/sat-sync-worker?secret=CRON_SECRET" | node -e "let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>{const j=JSON.parse(d);console.log(j.summary)})"
```

Done when `pending: 0` and `polling: 0`.

---

## Troubleshooting

### Jobs stuck in polling for 5+ minutes

SAT might be slow or the request got lost. Reset the stuck jobs and let the worker retry:

```bash
# Reset specific stuck job
curl -s "https://healthcareapi-production-fb70.up.railway.app/api/cron/sat-sync-worker?secret=CRON_SECRET&reset=<jobId>"
```

### Error 5002 (lifetime limit)

The offset was already used for those date ranges. Bump `00:00:XX` to the next second in `sat-descarga.ts`, commit, push, wait for deploy, then reset the failed jobs with `reset=all-xml`.

### Jobs fail with max attempts

The worker increments `attempts` on each state transition. After 10 attempts a job is marked `failed`. Reset it:

```bash
curl -s "https://healthcareapi-production-fb70.up.railway.app/api/cron/sat-sync-worker?secret=CRON_SECRET&reset=<jobId>"
```

### Alternative: Let cron handle it

If you don't want to loop manually, the Railway cron calls the worker every 2 minutes automatically. It will eventually process all pending jobs — just slower (~6 hours for 85 jobs).

---

## What Gets Updated

When XML jobs complete, the worker:

1. Downloads ZIP from SAT containing individual .xml files
2. Parses each XML with `sat-xml-parser.ts` (regex-based, zero deps)
3. Upserts into `sat_cfdi_details` (subtotal, total, IVA, ISR, metodoPago, etc.)
4. Upserts into `sat_cfdi_conceptos` (line items per CFDI)
5. Detects tipo P CFDIs and upserts `sat_pagos` records (complementos de pago)

All tabs in `/dashboard/sat-descarga` that depend on XML data will reflect the new values:
- CFDIs Descargados (detail panel)
- Resumen Fiscal (IVA/ISR aggregation)
- Declaraciones (ISR/IVA calculation)
- Deducciones (deducibility flags)
- Cobranza (PPD payment tracking)
- PPD/Pagos tab (complemento linking)

---

## History

| Date | Reason | Offset | Jobs Reset | Result |
|------|--------|--------|------------|--------|
| 2026-06-06 | First XML backfill | 00:00:01 | 69 (new) | All completed after error 5002 fix |
| 2026-06-08 | Parser bug: Total regex matched SubTotal | 00:00:02 | 85 (force-xml) | In progress |
