# SAT Descarga Directa — Integracion con el SAT para Descarga de CFDIs

**Fecha:** 2026-05-12 (PoC) / 2026-05-15 (integracion app)
**Status:** FASE 1 COMPLETA — PoC + DB + API + Worker + UI integrados (2026-05-15)

---

## Objetivo

Integracion directa con el SAT (Servicio de Administracion Tributaria) para **descargar CFDIs** (emitidos y recibidos) de cada doctor. No se trata de emitir facturas (eso ya lo hace Facturama), sino de consultar y descargar lo que el SAT ya tiene registrado para cada RFC.

---

## Contexto

### Relacion con Facturama (TODO-FACTURAS)

La funcionalidad existente en `TODO-FACTURAS` usa **Facturama API Multiemisor** como PAC para **emitir** CFDIs. Es un flujo diferente:

| | Facturama (existente) | SAT Descarga (este modulo) |
|---|---|---|
| **Proposito** | Emitir CFDIs nuevos | Descargar CFDIs existentes del SAT |
| **Direccion** | App -> SAT (via PAC) | SAT -> App |
| **Credenciales** | Cuenta Facturama (nuestra) + CSD del doctor | e.Firma del doctor (.cer, .key, password) |
| **Autenticacion** | Basic Auth Facturama | Firma electronica directa con SAT (SOAP + WS-Security) |
| **Datos** | Lo que nosotros creamos | Todo lo que el SAT tiene del RFC |

---

## Credenciales: e.Firma (FIEL) — Obligatoria

### El web service del SAT requiere e.Firma, NO CSD

La documentacion oficial del SAT es clara:
- **Portal web:** acepta e.firma O password (CIEC)
- **Web Service (descarga masiva):** acepta **SOLO e.firma**

Los CSD que ya tenemos por doctor (para Facturama) **NO sirven** para descarga masiva. Son certificados diferentes.

### Diferencia entre e.Firma y CSD

| Aspecto | e.Firma (FIEL) | CSD |
|---------|---------------|-----|
| **Proposito** | Identificar al contribuyente (como firma manuscrita) | Sellar CFDIs (solo facturacion) |
| **Obtencion** | Presencial en oficinas SAT | Online via app Certifica (requiere FIEL vigente) |
| **Key Usage (X.509)** | 4 valores: Firma digital, Sin repudio, Cifrado de datos, Acuerdo de clave | 2 valores: Firma digital, Sin repudio |
| **branchName en cert** | Vacio | Contiene datos de sucursal |
| **Archivos** | `Clave_privada_FIEL_{rfc}.key` + `{rfc}.cer` | `CSD_{nombre}_{rfc}.key` + `CSD_{nombre}_{rfc}_{serial}.cer` |
| **Vigencia** | 4 anios | 4 anios |
| **Valido para descarga masiva** | SI | NO |
| **Valido para emitir CFDIs (Facturama)** | NO (no es su proposito) | SI |

### Impacto en la app

Los doctores necesitaran subir **dos conjuntos de credenciales** separados:

1. **CSD** (.cer + .key + password) — ya lo tenemos, para emitir CFDIs via Facturama
2. **e.Firma** (.cer + .key + password) — NUEVO, para descarga masiva del SAT

Esto no deberia ser problema: todo doctor que factura ya tiene ambos. La e.Firma es prerrequisito para obtener el CSD. La UI necesitara un segundo upload en la configuracion fiscal.

### Como diferenciar programaticamente

Para validar que el doctor suba la e.Firma correcta (no el CSD):
- Revisar `branchName` del certificado X.509: vacio = FIEL, con datos = CSD
- Revisar Key Usage: 4 valores = FIEL, 2 valores = CSD

**Nota (descubierto en PoC):** Node.js `X509Certificate.keyUsage` retorna `extendedKeyUsage` OIDs, no el campo `keyUsage` basico. Esto causa falsos positivos en la deteccion. La e.Firma de prueba mostro solo 2 OIDs (`1.3.6.1.5.5.7.3.4`, `1.3.6.1.5.5.7.3.2`) pero el SAT la acepto correctamente. Para deteccion confiable, usar `branchName` o revisar el nombre del archivo (`FIEL` vs `CSD` en el nombre).

---

## Alcance Inicial

1. **Descargar CFDIs emitidos** — facturas que el doctor ha emitido
2. **Descargar CFDIs recibidos** — facturas que el doctor ha recibido
3. **Obtener metadata** — UUID, RFC emisor/receptor, montos, fechas, status
4. **Descargar XML** — el CFDI completo en formato XML (on-demand, fase 2)
5. **Consultar status** — vigente, cancelado, etc.

---

## Notas Tecnicas

- El SAT expone un servicio SOAP (no REST) para descarga masiva — 4 endpoints
- La autenticacion requiere firmar XML con la e.Firma del contribuyente (WS-Security, RSA-SHA1)
- SAT es asincrono: solicitas, esperas (minutos a 72h), descargas cuando listo
- Los CFDIs se descargan en paquetes ZIP (metadata TXT o XMLs)
- Metadata TXT usa delimitador tilde `~`, 14 columnas, con gotchas de parsing conocidos

### Limites oficiales del SAT

| Via | XMLs | Metadata | Auth requerida |
|-----|------|----------|----------------|
| **Portal web** | 500 mostrados, 2,000/dia | 1,000,000 por consulta | e.firma o password |
| **Web Service** | 200,000 por solicitud | 1,000,000 por solicitud | Solo e.firma |

- Procesamiento: maximo 48 horas
- Disponibilidad: 72 horas despues de procesado
- No se puede descargar el mismo XML mas de 2 veces
- Historico: hasta 5 anios fiscales + anio actual

---

## Decision: Build Propio (sin librerias de terceros)

Se decidio **construir la integracion directamente** sin usar `@nodecfdi/sat-ws-descarga-masiva` ni ninguna libreria de terceros para la capa SOAP/firma. Razones:

1. **Sin dependencia externa** — no dependemos de mantenimiento de terceros
2. **Sin riesgo de codigo malicioso** — las credenciales e.Firma son altamente sensibles
3. **Zero dependencies** — solo Node.js built-in `crypto` y `https`
4. **Probado exitosamente** — el PoC de autenticacion funciono al primer intento

Las librerias open source (nodecfdi, phpcfdi, python-satcfdi) se usan como **referencia de implementacion** para entender los detalles del protocolo, pero no como dependencia de runtime.

---

## Progreso

### PoC: Autenticacion exitosa (2026-05-12)

**Script:** `scripts/sat-auth-test.mjs`

Resultado:
- Autenticacion con SAT via SOAP + WS-Security: **OK**
- JWT token recibido (395 chars, 10 min expiracion)
- Zero dependencies (solo Node.js built-in crypto + https)
- Firma XML con Exclusive C14N manual: **funciona correctamente**
- Token issuer: `LoadSolicitudDecargaMasivaTerceros`

Credenciales usadas:
- e.Firma de DIEGO PABLO LOPEZ FAFUTIS (RFC: LOFD9406276F8)
- Certificado emitido por: AC DEL SERVICIO DE ADMINISTRACION TRIBUTARIA
- Vigencia: Jul 2025 — Jul 2029

Lecciones:
1. Node.js `X509Certificate.keyUsage` retorna extendedKeyUsage OIDs, no keyUsage basico — no sirve para distinguir FIEL/CSD
2. La canonicalizacion manual funciona: construir el XML canonico como string sin usar libreria de c14n
3. El token JWT expira en 10 minutos (no 5 como indicaba la documentacion de SW SmartWeb)
4. SAT responde rapido (~2 segundos para autenticacion)

### PoC completo: 4 pasos exitosos (2026-05-12)

**Script:** `scripts/sat-request-metadata.mjs`

Resultados:
- **Recibidos abril 2026:** 19 CFDIs descargados (1 cancelado, 18 vigentes)
- **Emitidos abril 2026:** 12 CFDIs descargados
- Flujo completo auth → solicitud → verificacion → descarga: **OK**
- Tiempo de procesamiento SAT: ~30 segundos (mucho mas rapido que el maximo de 72h)
- Re-autenticacion no fue necesaria (proceso completo en <1 min)

Lecciones adicionales:
1. **RfcEmisor/RfcReceptor obligatorio**: SAT rechaza (301) si no se incluye `RfcEmisor` (emitidos) o `RfcReceptor` (recibidos) ademas de `RfcSolicitante`
2. **Metadata tiene 12 columnas** (no 14 como indicaban algunas fuentes): `Uuid~RfcEmisor~NombreEmisor~RfcReceptor~NombreReceptor~PacCertifico~FechaEmision~FechaCertificacionSat~Monto~EfectoComprobante~Estatus~FechaCancelacion`
3. **Estatus numerico**: `0` = Cancelado, `1` = Vigente (no texto como "Vigente"/"Cancelado")
4. **EfectoComprobante**: `I` = Ingreso, `P` = Pago (no "Ingreso"/"Pago")
5. La firma enveloped sobre `<des:solicitud>` funciona correctamente con X509Data (IssuerName + SerialNumber)
6. El atributo order en solicitud importa: deben ir en orden alfabetico para que el digest coincida
7. **ZIP parser zero deps**: Node.js `zlib.inflateRawSync` + lectura manual de ZIP local file headers funciona perfectamente
8. **Emitidos abril 2026**: 12 CFDIs, todos vigentes, total $199,620.00 MXN
9. **Recibidos abril 2026**: 19 CFDIs (18 vigentes + 1 cancelado), total vigentes $91,634.71 MXN

### Status de Implementacion (2026-05-15)

| Paso | Status | Descripcion |
|------|--------|-------------|
| Autenticacion | DONE | PoC exitoso, JWT token obtenido |
| Solicitud de metadata | DONE | Paso 2 — emitidos y recibidos funcionan (2026-05-12) |
| Verificacion | DONE | Paso 3 — polling funciona, SAT responde en ~30s |
| Descarga de paquetes | DONE | Paso 4 — ZIP descargado correctamente |
| Parsing de metadata | DONE | ZIP extraction + TXT parser, zero deps (zlib built-in) |
| Database | DONE | Migration: `sat_sync_jobs` + `sat_cfdi_metadata` + e.Firma fields en `DoctorFiscalProfile` |
| e.Firma upload API | DONE | `POST/GET/DELETE /api/sat-descarga/fiel` — valida, cifra (AES-256-GCM), almacena |
| e.Firma upload UI | DONE | Seccion paso 3 en `/dashboard/facturacion` (config tab) |
| SAT service library | DONE | `apps/api/src/lib/sat-descarga.ts` — port del PoC a TypeScript, zero deps |
| API routes sync | DONE | `POST/GET /api/sat-descarga/sync`, `GET/DELETE /api/sat-descarga/sync/[id]`, `GET /api/sat-descarga/metadata` |
| Background worker | DONE | `POST /api/cron/sat-sync-worker` — state machine, cron-based polling |
| Dashboard UI | DONE | `/dashboard/sat-descarga` — sync trigger, CFDI table, jobs list |
| Dashboard filters | DONE | Column filters: Fecha (sort), Dir, Monto (ranges), Tipo (financial impact), Status |
| Financial impact labels | DONE | Replaced raw SAT EfectoComprobante with doctor-perspective labels (Ingreso/Gasto/Pago/Nota crédito) |
| Expandable row details | DONE | Click row to see UUID, full emisor/receptor, PAC, certification date |
| Info tab | DONE | Explains sync process, available data, financial impact logic, SAT limitations |
| API select clause | DONE | Explicit field selection — no doctorId/syncJobId leaked to frontend |

### Deployed to Production (2026-05-15)

- Migration executed on Railway DB
- `FIEL_ENCRYPTION_KEY` env var added to API service
- SAT worker added to cron service (runs every 15 minutes)
- Sidebar nav link added (desktop + mobile drawer)
- First successful sync: 19 recibidos + 12 emitidos (abril 2026)

### Gotchas Discovered During Deployment

- **SAT rejects future `FechaFinal`** — dateTo capped to today when syncing the current month
- **RFC is in `x500UniqueIdentifier`** of cert subject, NOT `serialNumber` (which contains CURP)
- **Prisma DATE columns return midnight UTC** — use `timeZone: "UTC"` in frontend display and `Date.UTC()` in backend
- **Regex `s` flag requires ES2018+** — use `[\s\S]` instead for Next.js build compatibility

### Pendiente (Fase 2+)

| Feature | Status | Descripcion |
|---------|--------|-------------|
| Descarga de XMLs | Pendiente | On-demand download de XMLs completos (Phase 2) |
| Inteligencia financiera | Pendiente | Proyecciones, cashflow, scoring (Phase 3) |

---

## Archivos del Proyecto

### Documentacion (esta carpeta)

| Archivo | Contenido |
|---------|-----------|
| `OVERVIEW.md` | Este archivo — vision general, credenciales, alcance, status |
| `ARCHITECTURE.md` | Arquitectura async, modelo de datos SQL, fases de implementacion, stack tecnico |
| `SAT-API-TECHNICAL-REFERENCE.md` | Endpoints SOAP, SOAPAction headers, firma XML, metadata TXT format, codigos de error, limites |
| `SOAP-TEMPLATES.md` | XML templates exactos para cada operacion, diferencias de firma entre auth y solicitud/verifica/descarga |
| `OTHER-SAT-SERVICES.md` | Otros servicios SAT disponibles (retenciones, CSF, 32-D, validacion RFC) |

### PoC Scripts (raiz del repo)

| Archivo | Contenido |
|---------|-----------|
| `scripts/sat-auth-test.mjs` | PoC de autenticacion — zero deps, Node.js built-in crypto |
| `scripts/sat-request-metadata.mjs` | PoC completo — 4 pasos + ZIP extraction + metadata parsing, zero deps |

### Codigo de la App

| Archivo | Contenido |
|---------|-----------|
| `packages/database/prisma/migrations/add-sat-descarga-masiva-tables.sql` | Migration: e.Firma fields + sat_sync_jobs + sat_cfdi_metadata |
| `apps/api/src/lib/encryption.ts` | AES-256-GCM encrypt/decrypt para credenciales e.Firma |
| `apps/api/src/lib/sat-descarga.ts` | SAT SOAP service library (619 lineas, zero deps) |
| `apps/api/src/app/api/sat-descarga/fiel/route.ts` | API: upload/status/delete e.Firma |
| `apps/api/src/app/api/sat-descarga/sync/route.ts` | API: crear/listar sync jobs |
| `apps/api/src/app/api/sat-descarga/sync/[id]/route.ts` | API: status + delete sync job |
| `apps/api/src/app/api/sat-descarga/metadata/route.ts` | API: listar CFDIs descargados + summary (supports direction, month, status, sort params) |
| `apps/api/src/app/api/cron/sat-sync-worker/route.ts` | Background worker (state machine) |
| `apps/doctor/src/app/dashboard/sat-descarga/page.tsx` | Dashboard UI: sync trigger, CFDI table (expandable rows, column filters, financial impact labels), jobs list, info tab |

### Variables de Entorno Requeridas

| Variable | Donde | Proposito |
|----------|-------|-----------|
| `FIEL_ENCRYPTION_KEY` | `apps/api/.env.local` | 32-byte hex key para AES-256-GCM (generar: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`) |
| `CRON_SECRET` | Ya existente | Protege el worker endpoint |

---

## Referencias

### Documentacion Oficial SAT

- **Consulta y recuperacion de comprobantes (portal):** https://www.sat.gob.mx/consultas/42968/consulta-y-recuperacion-de-comprobantes-(nuevo)
- **Documentacion servicio de solicitud de descarga (PDF):** https://www.sat.gob.mx/cs/Satellite?blobcol=urldata&blobkey=id&blobtable=MungoBlobs&blobwhere=1461175195160&ssbinary=true
- **Documentacion servicio de verificacion (PDF):** https://www.sat.gob.mx/cs/Satellite?blobcol=urldata&blobkey=id&blobtable=MungoBlobs&blobwhere=1461175779527&ssbinary=true
- **Documentacion servicio de descarga masiva (PDF):** https://wwwmat.sat.gob.mx/cs/Satellite?blobcol=urldata&blobkey=id&blobtable=MungoBlobs&blobwhere=1461174995026&ssbinary=true
- **Documentacion servicio de consulta y recuperacion (PDF):** https://www.sat.gob.mx/cs/Satellite?blobcol=urldata&blobkey=id&blobtable=MungoBlobs&blobwhere=1461174995017&ssbinary=true
- **Descarga masiva de CFDI y retenciones (PDF general):** https://www.sat.gob.mx/cs/Satellite?blobcol=urldata&blobkey=id&blobtable=MungoBlobs&blobwhere=1461174995051&ssbinary=true
- **Portal de e.firma:** https://www.sat.gob.mx/portal/public/tramites/firma-electronica-avanzada-efirma
- **Como obtener e.firma:** https://www.gob.mx/sat/acciones-y-programas/como-obtener-tu-e-firma
- **Descarga certificado e.firma:** https://www.sat.gob.mx/aplicacion/44275/descarga-de-manera-directa-tu-certificado-de-e.firma
- **App Certifica (genera CSD y renueva e.firma):** https://www.sat.gob.mx/aplicacion/16660/genera-y-descarga-tus-archivos-a-traves-de-la-aplicacion-certifica

### Guias de Integracion (terceros)

- **SW SmartWeb — Consumo WebService v1.5 (overview):** https://developers.sw.com.mx/knowledge-base/consumo-webservice-descarga-masiva-sat/
- **SW SmartWeb — Autenticacion v1.5:** https://developers.sw.com.mx/knowledge-base/descarga-masiva-sat-autenticacion/
- **SW SmartWeb — Solicitud v1.5:** https://developers.sw.com.mx/knowledge-base/descarga-masiva-sat-solicitud/
- **SW SmartWeb — Verificacion v1.5:** https://developers.sw.com.mx/knowledge-base/descarga-masiva-sat-verificacion/
- **SW SmartWeb — v1.5 Release Notes (mayo 2025):** https://developers.sw.com.mx/knowledge-base/29-mayo-2025-nueva-version-del-web-service-de-descarga-masiva-sat-para-cfdi-y-cfdi-de-retenciones/
- **SW SmartWeb — Diferenciar FIEL vs CSD:** https://developers.sw.com.mx/knowledge-base/como-diferenciar-entre-fiel-y-csd/
- **Enlace Fiscal — Diferencia e.firma vs CSD:** https://soporte.enlacefiscal.com/article/13-diferencia-entre-fiel-y-csd
- **ElConta — Resumen v1.5:** https://elconta.mx/descarga-masiva-de-xml-web-service-sat-version-1-5-resumen/
- **ElConta — Metadata y Excel:** https://elconta.mx/descarga-masiva-xml-metadatos-desplegar-contenido-excel/
- **dSoft — Que es la Metadata SAT:** https://blog.dsoft.mx/2019/04/22/descargar-web-service-sat/
- **dSoft — Actualizacion masiva estatus CFDI con metadata:** https://blog.dsoft.mx/2023/11/20/actualizacion-de-estatus-de-los-cfdi-con-la-metadata-sat/

### Librerias Open Source (referencia de implementacion)

- **Node.js — @nodecfdi/sat-ws-descarga-masiva:** https://github.com/nodecfdi/sat-ws-descarga-masiva
- **Node.js — organizacion NodeCfdi:** https://github.com/nodecfdi
- **PHP — phpcfdi/sat-ws-descarga-masiva:** https://github.com/phpcfdi/sat-ws-descarga-masiva
- **PHP — phpcfdi/credentials (FIEL vs CSD detection):** https://github.com/phpcfdi/credentials
- **Python — SAT-CFDI/python-satcfdi (mas completa, 138 stars, 141 releases):** https://github.com/SAT-CFDI/python-satcfdi
- **Python — satcfdi docs:** https://satcfdi.readthedocs.io/en/stable/
- **Python — luisiturrios1/python-cfdiclient (simple, solo descarga):** https://github.com/luisiturrios1/python-cfdiclient
- **Community docs SAT (endpoints, gotchas):** https://github.com/BoxFactura/sat-community-docs
- **GitHub topic descargamasivasat:** https://github.com/topics/descargamasivasat

### Metadata TXT — Parsing Issues

- **phpcfdi issue #23 — caracteres inesperados en metadata:** https://github.com/phpcfdi/sat-ws-descarga-masiva/issues/23

### e.Firma General

- **Blog Mifiel — FIEL vs CSD:** https://blog.mifiel.com/fiel-efirma-vs-csd/
- **EasysWeb — Diferencia e.firma y CSD:** https://www.easysweb.com.mx/blog/diferencia-entre-e-firma-y-csd/
- **FiscalCloud — Diferencia sellos CSD y FIEL:** https://fiscalcloud.mx/manuales-facturacion-electronica/diferencia-sellos-csd-fiel/
- **Siempre al Dia — e.firma SAT 2026:** https://siemprealdia.co/mexico/fiscal/e-firma-sat-mexico/
