# Doctor Profile vs Google Business Profile — Field Comparison

## Purpose

Map every field in the tusalud.pro doctor profile against what Google Business Profile (GBP) supports, to ensure maximum data parity for local SEO.

---

## Direct Matches — Same Info in Both

| Our Field | GBP Field | Notes |
|-----------|-----------|-------|
| `doctor_full_name` | Business name | Use "Dr. [Name] — [Specialty]" format |
| `primary_specialty` | Primary category | GBP has medical categories (e.g. "Ophthalmologist") |
| `subspecialties` | Additional categories | GBP allows up to 9 additional categories |
| `clinic_info.address` | Address | Exact match |
| `clinic_info.phone` | Phone number | GBP allows primary + additional numbers |
| `clinic_info.hours` | Business hours | Mon–Sun, same format |
| `clinic_info.geo` | Pin location | Lat/lng coordinates |
| `short_bio` | Business description | GBP limit is 750 characters |
| `services_list` | Services | GBP has a services section with name + description + price |
| `hero_image` | Profile photo | Direct match |
| `carousel_items` | Photos & Videos | GBP accepts interior, exterior, team, work photos |
| `faqs` | Q&A section | GBP has a public Q&A section |
| `reviews` | Google Reviews | GBP is the source of truth for reviews |
| `clinic_info.whatsapp` | Messaging / Phone | Can add as additional phone number |

---

## We Have It — GBP Doesn't or It's Limited

| Our Field | GBP Status |
|-----------|-----------|
| `long_bio` | GBP caps at 750 chars — only `short_bio` fits |
| `education_items` | Not available in GBP |
| `certificate_images` | Not available in GBP |
| `conditions` | Not a GBP field — can mention in description |
| `procedures` | Can be added as services |
| `years_experience` | Not a GBP field — mention in description |
| `cedula_profesional` | Not a GBP field |
| `social_links.linkedin` | GBP recently added social links (LinkedIn, Twitter) |
| `social_links.twitter` | GBP recently added social links |
| `color_palette` | Not applicable |
| `google_ads_id` | Not applicable |

---

## GBP Has It — We Are Missing or Underusing

| GBP Field | Our Status | Recommended Action |
|-----------|-----------|-------------------|
| **Booking link** | We have the URL | Add `tusalud.pro/doctores/[slug]` as the GBP booking link |
| **Website link** | Exists | Point to the doctor's profile page |
| **Opening date** | Not stored in DB | Could add `practice_since` field to doctors table |
| **Attributes** | Not stored | e.g. "Accepts insurance", "Wheelchair accessible", "Online appointments available", "Teleconsult available" |
| **Google Posts** | Not connected | Doctor blog posts could be mirrored as GBP Posts |

---

## Priority Order for Filling GBP (Most SEO Impact First)

1. **Name + Category** — exact specialty match (`primary_specialty` → GBP primary category)
2. **Address + geo pin** — critical for local search ranking
3. **Phone + hours** — affects GBP completeness score
4. **Description** — use `short_bio` (keep under 750 chars)
5. **Services** — copy from `services_list` with names, descriptions, and prices
6. **Photos** — `hero_image` + items from `carousel_items`
7. **Booking link** — `https://tusalud.pro/doctores/[slug]`
8. **Attributes** — "Online appointments", "Teleconsult available", "Accepts new patients"
9. **Q&A** — seed with the doctor's existing `faqs`

---

## Biggest Gap: GBP Attributes

GBP Attributes are structured yes/no or multiple-choice flags that appear prominently in search results and Maps. They are not stored anywhere in the current database. Relevant attributes for doctors:

- Accepts new patients
- Online appointments available
- Teleconsult / video visit available
- Accepts insurance
- Wheelchair accessible entrance
- Parking available
- Languages spoken

These are worth adding as a future DB field (`clinic_attributes` or similar) so they can be managed from the admin/doctor portal and kept in sync with GBP manually or via the GBP API.

---

## Notes on Data Sync

GBP does not have an official write API for all fields (it is mostly read-only or manual). The recommended workflow is:

1. Doctor fills out their profile on tusalud.pro
2. Admin or doctor manually copies the relevant fields into GBP
3. The booking link in GBP points back to the doctor's tusalud.pro profile

There is no automatic sync between tusalud.pro and GBP at this time.
