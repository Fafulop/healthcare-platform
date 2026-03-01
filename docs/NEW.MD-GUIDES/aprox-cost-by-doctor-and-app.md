# Approximate Cost Per Doctor & App — Platform Cost Analysis

> Last updated: March 2026
> Scope: All external services used by the platform, excluding Twilio SMS (not active).

---

## Overview

Platform costs split into two categories:

- **Fixed infrastructure** — shared across all doctors, barely changes with scale
- **Variable per-doctor** — grows with each active doctor and their usage of AI features

---

## 1. Railway (Hosting)

### Billing Model

Railway charges per second of actual resource consumption, not flat per service.

| Resource | Rate | Per month (always-on) |
|----------|------|----------------------|
| RAM | $0.00000386 / GB·sec | **$10.01 / GB** |
| CPU | $0.00000772 / vCPU·sec | **$20.01 / vCPU** |
| Disk (volumes) | $0.00000006 / GB·sec | **$0.16 / GB** |
| Egress (outbound) | $0.05 / GB | — |

### 5 Services — Resource Estimates

| Service | Idle RAM | Avg CPU | RAM cost/mo | CPU cost/mo |
|---------|----------|---------|-------------|-------------|
| `public` (patients) | 250 MB | 0.02 vCPU | $2.50 | $0.40 |
| `doctor` portal | 300 MB | 0.02 vCPU | $3.00 | $0.40 |
| `admin` panel | 200 MB | 0.01 vCPU | $2.00 | $0.20 |
| `api` backend | 300 MB | 0.03 vCPU | $3.00 | $0.60 |
| PostgreSQL | 350 MB | 0.02 vCPU | $3.50 | $0.40 |
| **Subtotal** | **~1.4 GB** | **~0.10 vCPU** | **$14** | **$2** |

Disk: ~$0.16/GB/mo. Egress at small scale: ~$0.15/mo.

### Plans

| Plan | Monthly fee | Included credits | Effective bill at ~$16 compute |
|------|------------|-----------------|-------------------------------|
| Hobby | $5 | $5 | $16/mo |
| **Pro** | $20 | $20 | **$20/mo** ✓ recommended |

### Railway Cost by Scale

| # Doctors | Monthly compute | **Total Railway/mo** | Per doctor |
|-----------|----------------|----------------------|-----------|
| 1–10 | ~$16 | **$20** | $2–4 |
| 10–30 | ~$22 | **$22** | $0.75–2 |
| 30–100 | ~$35 | **$35** | $0.35–1.15 |
| 100–300 | ~$70 | **$70** | $0.23–0.70 |

**Key insight:** Railway is the cheapest per-doctor cost at scale. RAM is the dominant driver; CPU stays low because Next.js is mostly I/O-bound.

**Spikes to watch:**
- Build deployments spike RAM to 1–2 GB for ~2 min per deploy
- Traffic bursts on the `public` app (marketing campaigns)
- Database growth: ~$0.16/GB/mo added as data accumulates

---

## 2. OpenAI

Two separate products are used: **Whisper** (voice transcription) and a **GPT model** (AI assistant + encounter template generation).

### Current Pricing

| Model | Input | Output | Notes |
|-------|-------|--------|-------|
| GPT-4o | $2.50 / 1M tokens | $10.00 / 1M tokens | Highest quality |
| **GPT-4o-mini** | $0.15 / 1M tokens | $0.60 / 1M tokens | ~16× cheaper, recommended |
| Whisper | $0.006 / min | — | Classic transcription |
| GPT-4o Mini Transcribe | $0.003 / min | — | Half price alternative |

### A — Whisper (Voice dictation for encounter notes)

The biggest OpenAI cost driver — scales directly with how actively the doctor dictates notes.

| Doctor workload | Minutes dictated/mo | Whisper cost | Mini Transcribe cost |
|----------------|--------------------|-----------|--------------------|
| Light (5 encounters/day, 2 min avg) | ~220 min | $1.32 | $0.66 |
| Moderate (10 encounters/day, 3 min avg) | ~660 min | $3.96 | $1.98 |
| Heavy (20 encounters/day, 4 min avg) | ~1,760 min | $10.56 | $5.28 |

> Doctor who never uses voice dictation: **$0**.

### B — GPT (AI assistant + template generation)

Tokens are small — this cost is nearly negligible with GPT-4o-mini.

**AI assistant chat (Asistente IA):**

| Usage | Tokens/mo | GPT-4o-mini | GPT-4o |
|-------|-----------|-------------|--------|
| 5 chats/week | ~65K | $0.03 | $0.49 |
| 20 chats/week | ~260K | $0.11 | $1.95 |

**Encounter template generation:**

| Usage | Tokens/mo | GPT-4o-mini | GPT-4o |
|-------|-----------|-------------|--------|
| 10 templates/mo | ~70K | $0.02 | $0.42 |
| 30 templates/mo | ~210K | $0.06 | $1.26 |

### OpenAI Total Per Doctor/Month

| Doctor type | Whisper | GPT (mini) | **Total/mo** |
|-------------|---------|------------|-------------|
| Never uses AI features | $0 | $0 | **$0** |
| Light | $1.32 | $0.05 | **~$1.40** |
| Moderate | $3.96 | $0.15 | **~$4.10** |
| Heavy power user | $10.56 | $0.30 | **~$11** |

**Cost levers:**
- Switch GPT-4o → GPT-4o-mini: ~16× cheaper LLM cost
- Switch Whisper → GPT-4o Mini Transcribe: ~50% cheaper transcription
- The `LlmTokenUsage` table already exists in the schema — use it to set per-doctor budget alerts

---

## 3. UploadThing (File Storage)

### Current Pricing

| | |
|--|--|
| Base fee | $25/month |
| Included storage | 250 GB |
| Extra storage | $0.08/GB |
| Bandwidth | **Free** |
| Per-request fees | **None** |

### Storage Estimate Per Doctor

| Asset type | Typical size | Notes |
|-----------|-------------|-------|
| Hero image | 1–4 MB | 1 per doctor |
| Certificates | 5–40 MB | ~5–10 certs |
| Clinic photos | 5–20 MB | ~5–10 photos |
| Profile videos | 0–200 MB | Optional |
| Medical images per encounter | 2–10 MB | Accumulates over time |
| Medical audio / video per encounter | 5–30 MB | If consultations are recorded |
| Ledger attachments | 1–5 MB / entry | Receipts, invoices |

**Profile only (no medical media):** ~20–60 MB/doctor
**Active EMR usage:** +50–500 MB/doctor/month

### UploadThing Cost at Scale

| # Doctors | Approx total storage | Cost/mo |
|-----------|---------------------|---------|
| 1–10, profile only | < 1 GB | **$25 flat** |
| 1–10, active EMR | 2–5 GB | **$25 flat** |
| 50 doctors, active EMR | 25–50 GB | **$25 flat** |
| 50 doctors, heavy video | 100–200 GB | **$25 flat** |
| 200+ doctors | 250+ GB | $25 + $0.08/extra GB |

**Key insight:** $25/month flat covers the platform comfortably up to ~200 active doctors using media. Essentially a fixed cost at any realistic early-stage scale.

> Note: The platform uses **two separate UploadThing accounts** — one for the `doctor` app and one for the `admin` app. Both are included in this estimate; they share the same storage pool under separate project IDs.

---

## 4. Google Services

| Service | Cost |
|---------|------|
| Google OAuth (login for doctors/admins) | **Free** — no limit on users or logins |
| Google Analytics GA4 (patient site) | **Free** |
| Google Ads conversion tracking | **Free** — doctors pay for their own ad spend separately |

---

## Full Platform Cost Summary

### Monthly totals (no Twilio, GPT-4o-mini, moderate AI usage)

| Service | 5 doctors | 20 doctors | 50 doctors |
|---------|-----------|------------|------------|
| Railway | $20 | $22 | $30 |
| UploadThing | $25 | $25 | $25 |
| OpenAI (avg moderate) | $20 | $82 | $205 |
| Google | $0 | $0 | $0 |
| **Total/mo** | **$65** | **$129** | **$260** |
| **Per doctor/mo** | **$13** | **$6.45** | **$5.20** |

### Cost structure at a glance

- **Railway** → nearly flat, cheapest per-doctor at scale
- **UploadThing** → flat $25/mo until ~200 doctors
- **OpenAI** → dominant variable cost, grows linearly with active AI-using doctors
- **Google** → free

---

## Suggested SaaS Pricing for Doctors

| Target margin | Price at 10 doctors | Price at 50 doctors |
|--------------|---------------------|---------------------|
| Break-even | ~$13/mo | ~$6/mo |
| ~50% margin | $25–30/mo | $12–15/mo |
| ~70% margin | $40–45/mo | $20–25/mo |

> OpenAI cost varies significantly per doctor based on AI feature adoption. Consider offering a base plan (no AI) and a premium plan (AI features included) to protect margins.
