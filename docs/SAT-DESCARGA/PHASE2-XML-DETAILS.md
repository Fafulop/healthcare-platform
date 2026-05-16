# SAT Descarga Masiva — Phase 2: XML Download & Parsing

**Date:** 2026-05-16
**Status:** COMPLETE & TESTED (backend + UI deployed, confirmed working 2026-05-16)
**Depends on:** Phase 1 (metadata sync — working since 2026-05-15)

---

## What This Adds

Phase 1 downloads only **metadata** (12 fields per CFDI — UUID, monto, emisor, receptor, etc.).
Phase 2 downloads the **full XML** to extract detailed fields not available in metadata:

| Field | Example | Use Case |
|-------|---------|----------|
| Subtotal | 8,620.69 | Pre-tax revenue |
| IVA Trasladado | 1,379.31 | Tax liability |
| ISR Retenido | 862.07 | Withholdings |
| IVA Retenido | 689.66 | Withholdings |
| IEPS | 0.00 | Special taxes |
| MetodoPago | PUE / PPD | Cash vs credit tracking |
| FormaPago | 03 (Transferencia) | Payment method |
| UsoCFDI | G03 (Gastos en general) | Tax deduction category |
| Moneda / TipoCambio | USD / 17.50 | Multi-currency support |
| Serie / Folio | A / 1234 | Internal numbering |
| Conceptos (line items) | "Consulta medica", qty 1, $1,500 | Detailed breakdown |

---

## How It Works

Same 4-step SAT flow as metadata, but with `TipoSolicitud = "CFDI"` instead of `"Metadata"`.

```
Doctor selects "XML" in sync type dropdown
    |
POST /api/sat-descarga/sync { requestType: "xml", direction, month }
    |
Worker authenticates with SAT (same as metadata)
    |
Worker requests download with TipoSolicitud="CFDI"
    |
SAT prepares ZIP with individual .xml files (one per CFDI)
    |
Worker downloads ZIP, parses each XML, stores in DB
    |
Doctor clicks "Ver detalles XML" on any CFDI row
    |
GET /api/sat-descarga/details/{uuid} returns parsed data
```

---

## Database Tables

### `practice_management.sat_cfdi_details`

Stores the parsed XML header for each CFDI.

| Column | Type | Description |
|--------|------|-------------|
| id | SERIAL PK | |
| doctor_id | TEXT FK | References doctors |
| uuid | VARCHAR(36) | Links to sat_cfdi_metadata |
| subtotal | DECIMAL(14,2) | Pre-tax amount |
| descuento | DECIMAL(14,2) | Discount applied |
| total | DECIMAL(14,2) | Final total |
| iva_trasladado | DECIMAL(14,2) | IVA charged |
| isr_retenido | DECIMAL(14,2) | ISR withheld |
| iva_retenido | DECIMAL(14,2) | IVA withheld |
| ieps | DECIMAL(14,2) | Special tax |
| metodo_pago | VARCHAR(10) | PUE or PPD |
| forma_pago | VARCHAR(10) | 01-99 SAT catalog |
| uso_cfdi | VARCHAR(10) | G01, G03, P01, etc. |
| moneda | VARCHAR(5) | MXN, USD |
| tipo_cambio | DECIMAL(10,4) | Exchange rate |
| serie | VARCHAR(25) | Invoice series |
| folio | VARCHAR(40) | Invoice number |
| lugar_expedicion | VARCHAR(5) | Postal code |
| sync_job_id | INT FK | References sat_sync_jobs |

**Unique constraint:** `(doctor_id, uuid)`

### `practice_management.sat_cfdi_conceptos`

Line items for each CFDI (one-to-many from sat_cfdi_details).

| Column | Type | Description |
|--------|------|-------------|
| id | SERIAL PK | |
| detail_id | INT FK | References sat_cfdi_details |
| clave_prod_serv | VARCHAR(10) | SAT product catalog code |
| descripcion | VARCHAR(1000) | Item description |
| cantidad | DECIMAL(14,6) | Quantity |
| clave_unidad | VARCHAR(10) | Unit code (E48, H87, etc.) |
| unidad | VARCHAR(50) | Unit name |
| valor_unitario | DECIMAL(14,6) | Unit price |
| importe | DECIMAL(14,2) | Line total |
| descuento | DECIMAL(14,2) | Line discount |
| iva_trasladado | DECIMAL(14,2) | Per-line IVA |
| isr_retenido | DECIMAL(14,2) | Per-line ISR |

---

## Key Files

| File | Purpose |
|------|---------|
| `packages/database/prisma/migrations/add-sat-cfdi-details-tables.sql` | DB migration |
| `packages/database/prisma/schema.prisma` | SatCfdiDetail + SatCfdiConcepto models |
| `apps/api/src/lib/sat-xml-parser.ts` | Zero-dep CFDI 4.0 XML parser |
| `apps/api/src/lib/sat-descarga.ts` | Added `requestXml()` function |
| `apps/api/src/app/api/cron/sat-sync-worker/route.ts` | XML job processing in worker |
| `apps/api/src/app/api/sat-descarga/sync/route.ts` | Accepts `requestType: 'xml'` |
| `apps/api/src/app/api/sat-descarga/details/[uuid]/route.ts` | GET parsed XML details |
| `apps/doctor/src/app/dashboard/sat-descarga/page.tsx` | UI: detail viewer + sync type selector |

---

## XML Parser Design

**Zero dependencies** — uses regex-based parsing (no DOM, no xml2js).

CFDI 4.0 XML structure is predictable:
- Root: `<cfdi:Comprobante ...>` — header attributes (SubTotal, Total, MetodoPago, etc.)
- `<cfdi:Receptor UsoCFDI="G03">` — usage category
- `<cfdi:Conceptos>` → `<cfdi:Concepto ...>` — line items
- `<cfdi:Impuestos>` → `<cfdi:Traslados>` / `<cfdi:Retenciones>` — tax summary
- `<tfd:TimbreFiscalDigital UUID="...">` — unique identifier

The parser handles:
- Namespace prefixes (`cfdi:`, `tfd:`, or unprefixed)
- Self-closing and non-self-closing Concepto tags
- Per-concept vs summary-level tax extraction
- XML entity decoding (&amp;, &lt;, etc.)
- Returns `null` for unrecognizable XMLs (logged in worker)

---

## UI Flow

1. **Sync trigger** — Doctor selects month + type ("Completa" default = metadata+XML), clicks "Descargar Todo" (fires both recibidos + emitidos in one click). Individual "Solo Recibidos"/"Solo Emitidos" buttons also available.
2. **Background processing** — Worker handles 4-step SAT flow (up to 3 jobs per cron run), parses XMLs on completion
3. **Jobs history** — "Historial de Syncs" tab shows all jobs with a "Tipo" column (Metadata/XML badge)
4. **Viewing details** — Doctor expands any CFDI row, clicks "Ver detalles XML (desglose fiscal)"
5. **Detail panel** — Shows:
   - Financial breakdown (subtotal, taxes, total)
   - Payment info (method, form, uso CFDI, currency)
   - Conceptos table (description, quantity, unit price, importe, IVA)

If XML hasn't been downloaded yet, shows "No hay detalles XML descargados para este CFDI."

**Re-sync behavior:** Completed jobs don't block re-syncing the same period. This allows picking up new CFDIs that appeared since the last download (useful for current month). Only active/in-progress jobs are blocked as duplicates.

---

## Important Gotchas

1. **XML for recibidos requires `EstadoComprobante="Vigente"`** — SAT rejects XML downloads for recibidos if cancelados exist in the range. The request MUST include `EstadoComprobante="Vigente"` (string, not numeric "1"). Emitidos works without this filter.
2. **EstadoComprobante uses string values** — SAT expects `"Vigente"`, `"Cancelado"`, or `"Todos"` in SOAP requests. The numeric `"0"`/`"1"` notation is only used in metadata TXT output, NOT in request attributes.
3. **Metadata not strictly required first** — XML download from SAT is independent (SAT returns all XMLs in date range). However, without metadata, the CFDI list table won't show entries to click "Ver detalles" on. The default "Completa" sync type handles both together.
4. **Raw XMLs are NOT stored** — Only parsed fields are saved (storage optimization)
5. **Conceptos are replaced on re-sync** — delete + recreate pattern (not diff/merge)
6. **SAT limits** — Same as metadata: can take hours, max 1M records per request, 5-year history
7. **Attribute order matters** — All solicitud attributes must be in alphabetical order for the XML signature digest to match
8. **UUID case mismatch** — Metadata TXT from SAT stores UUIDs in UPPERCASE, but the XML parser extracts them in lowercase. Any JOIN between `sat_cfdi_details` and `sat_cfdi_metadata` must use `LOWER()` on both sides.

---

## API Reference

### POST /api/sat-descarga/sync

Create XML sync job:
```json
{
  "direction": "received",
  "month": "2026-05",
  "requestType": "xml"
}
```

### GET /api/sat-descarga/details/{uuid}

Returns parsed XML details:
```json
{
  "data": {
    "uuid": "abc123...",
    "subtotal": 8620.69,
    "ivaTrasladado": 1379.31,
    "isrRetenido": null,
    "total": 10000.00,
    "metodoPago": "PUE",
    "formaPago": "03",
    "usoCfdi": "G03",
    "moneda": "MXN",
    "conceptos": [
      {
        "descripcion": "Consulta medica general",
        "cantidad": 1,
        "valorUnitario": 8620.69,
        "importe": 8620.69,
        "ivaTrasladado": 1379.31,
        "claveProdServ": "85121800"
      }
    ]
  }
}
```

Returns 404 if XML hasn't been downloaded for this UUID.
