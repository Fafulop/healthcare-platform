# 📊 Análisis — salir de UploadThing: cuánto guardamos, qué cuesta y a dónde nos vamos

> **Qué es este doc.** El análisis que llevó a elegir **Cloudflare R2**. Números de
> almacenamiento levantados de PROD el **2026-08-27**; precios y datos de las empresas
> verificados el mismo día contra sus páginas oficiales.
>
> 🔒 **Tipo SNAPSHOT en lo que toca a PRECIOS y VOLUMEN** — esos números envejecen. Si vuelves
> a decidir algo con este doc, re-verifica las dos tablas contra las fuentes del §6. La
> DECISIÓN y el porqué (§5) siguen valiendo.
>
> El plan de ejecución vive en [`02-PLAN-migracion-a-r2.md`](02-PLAN-migracion-a-r2.md).

---

## 1. Lo que guardamos hoy (medido en prod, no estimado)

**232 archivos en total.** Los levantó un barrido de TODAS las columnas de texto de los cinco
schemas buscando `utfs.io` / `ufs.sh` / `uploadthing`:

| Archivos | Tabla · columna | Qué es |
|---:|---|---|
| 124 | `medical_records.patient_media.file_url` | **imágenes clínicas** — el grueso |
| 36 | `public.carousel_items.src` | marketing del sitio público |
| 22 | `public.certificates.src` | diplomas y certificados del doctor |
| 15 | `public.articles.thumbnail` | portadas del blog |
| 7 | `medical_records.prescriptions.doctor_signature` | firma en la receta |
| 6 | `public.articles.content` | ⚠️ URLs **incrustadas en el HTML** del artículo |
| 5 | `practice_management.bank_statements.file_url` | estados de cuenta (PDF) |
| 5 | `public.doctors.hero_image` | foto de perfil |
| 4 | `public.doctors.prescription_signature_url` | firma para recetas |
| 4 | `public.doctors.prescription_logo_url` | logo para recetas |
| 2 | `practice_management.ledger_facturas.file_url` | facturas del flujo de dinero |
| 1 | `medical_records.patients.constancia_fiscal_url` | constancia fiscal |
| 1 | `practice_management.sat_declaration_receipts.pdf_url` | acuse del SAT |

**Peso real:** `patient_media` son **124 archivos / 99 MB / 0.8 MB de promedio**. Con el resto,
el total anda por **~150–200 MB**.

> ⚠️ **Esto cuenta REFERENCIAS EN LA BASE, no el bucket.** Un archivo subido y luego
> desvinculado sigue ocupando lugar en UploadThing y aquí no aparece. Antes de dar por bueno el
> 232, contrástalo con el panel de UploadThing.

## 2. Lo que cuesta hoy

**$10 USD/mes** en UploadThing (confirmado por el usuario) para guardar ~0.2 GB. Su plan de
$10 incluye 100 GB, o sea que **estamos pagando por dos órdenes de magnitud que no usamos**.

## 3. Las opciones, con precios verificados 2026-08-27

| | Almacenamiento | Egress (salida) | Gratis | API S3 | A nuestros 0.2 GB |
|---|---|---|---|---|---|
| **Cloudflare R2** | $0.015 / GB-mes | **$0, siempre** | 10 GB + 1M clase A + 10M clase B | ✅ | **$0** |
| **Backblaze B2** | $0.007 / GB-mes ($6.95/TB) | 3× lo almacenado gratis, luego $0.01/GB | 10 GB · clases A/B/C gratis | ✅ | **$0** |
| **UploadThing** (hoy) | 2 GB gratis · $10/mes 100 GB · $25/mes 250 GB + $0.08/GB extra | no publicado | 2 GB | ❌ | **$10/mes** |

**A escala de 1 TB** (por si algún día): B2 ~$6.95/mes · R2 ~$15/mes · UploadThing ~$85/mes.

## 4. ¿Son empresas serias?

**Backblaze** — sí, sin discusión. Pública en NASDAQ (**BLZE**). Q2 2026: ingresos **$42.7M
(+18% interanual)**, de los cuales **B2 son $26.6M (+34%)**; **500,000+ clientes**; y un
acuerdo **de $335M con CoreWeave** a varios años y múltiples exabytes.

**Cloudflare** — infraestructura de internet a escala global, pública, y ya corre parte del
tráfico del mundo. La duda nunca fue su solidez sino su cobertura contractual (§5.2).

## 5. La decisión: **Cloudflare R2**

### 5.1 Por qué, en los criterios que importaban

El precio **no** decidió: a 0.2 GB —y a 20 GB— R2 y B2 cuestan **$0** los dos. Pagar en
fricción de desarrollo por ahorrar dinero que no gastamos es mal negocio. Decidieron estos:

- **Facilidad de integración.** R2 habla la API de S3, así que `@aws-sdk/client-s3` funciona
  cambiando el endpoint: URLs prefirmadas, multipart, todo. B2 también es compatible con S3,
  pero **el material específico de Next.js para R2 es mucho más profundo** (demos oficiales de
  Cloudflare, tutoriales al día, comunidad grande haciendo exactamente esto).
- **Herramientas.** R2 trae cosas que B2 no, porque Backblaze es una empresa de
  almacenamiento y Cloudflare es una plataforma: **dominio propio sobre el bucket**,
  **Cloudflare Images/Transformations** (redimensionar al vuelo en vez de mandarle 16 MB al
  navegador), **notificaciones de eventos**, **bindings de Workers** y `wrangler` para
  guionizar la migración.
- **Modernidad.** R2 parte de que el egress debe ser gratis: **$0 siempre**, sin umbral que
  razonar. B2 da 3× lo almacenado y después cobra, o egress gratis sólo vía un CDN socio.

### 5.2 La parte legal, resuelta

La pregunta "¿firman BAA?" era **la pregunta equivocada para nosotros**: HIPAA es ley de
EE.UU. y obliga a *covered entities* estadounidenses. Aquí aplica **LFPDPPP 2025** y las NOM
de salud, y lo que el regulador pide es un **contrato con el encargado**, no un BAA gringo.

| | Qué encontramos |
|---|---|
| **Cloudflare DPA** | La v6.3 (jun-2025) **cubre a clientes Self-Serve**, no sólo Enterprise ⇒ al momento de pagar tenemos el acuerdo de tratamiento y la lista pública de subprocesadores con 30 días de aviso antes de cambios |
| **Cloudflare BAA (HIPAA)** | **Sólo Enterprise**, y R2 **no** aparece claramente entre los servicios en alcance (los nombrados son CDN, WAF, Bot Management) |
| **Backblaze BAA** | A solicitud, **sin puerta Enterprise** |

⚠️ **La única condición que dejaría mal a R2: atender pacientes de EE.UU.** Ese día el BAA
importa y hay que volver a esta tabla. Mientras el negocio sea México, el DPA de Self-Serve es
lo que se necesita — y recuerda que con la LFPDPPP 2025 **el encargado también es responsable**.

### 5.3 Por qué AHORA y no cuando duela

El argumento no es el dinero, son **$120 al año**. Es que **el costo de migrar escala con los
datos**: hoy son 232 archivos y ~200 MB; a 100 GB es otro proyecto. Se migra barato ahora o
caro después.

Y hay una propiedad que lo vuelve inusualmente seguro: **la BD guarda URLs ABSOLUTAS**. Los
archivos viejos siguen sirviéndose desde `utfs.io` sin tocarlos mientras los nuevos van a R2 —
las dos épocas conviven solas, sin capa de compatibilidad ni día de corte.

## 6. Fuentes (verificadas 2026-08-27)

- [Precios R2](https://developers.cloudflare.com/r2/pricing/) · [Precios B2](https://www.backblaze.com/cloud-storage/pricing) · [Precios UploadThing](https://uploadthing.com/pricing)
- [Resultados Q2 2026 de Backblaze](https://ir.backblaze.com/news/news-details/2026/Backblaze-Announces-Second-Quarter-2026-Financial-Results/default.aspx)
- [DPA de Cloudflare](https://www.cloudflare.com/cloudflare-customer-dpa/) · [Subprocesadores](https://www.cloudflare.com/gdpr/subprocessors/) · [FAQ HIPAA de Cloudflare](https://www.cloudflare.com/en-in/trust-hub/compliance-resources/hipaa/)
- [BAA de Backblaze](https://help.backblaze.com/hc/en-us/articles/360056961133-Backblaze-Business-Associate-Agreement-BAA)

---

*Índice: [`README.md`](README.md) · El plan: [`02-PLAN-migracion-a-r2.md`](02-PLAN-migracion-a-r2.md).*
