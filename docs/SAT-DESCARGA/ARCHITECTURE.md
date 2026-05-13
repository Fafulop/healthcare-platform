# SAT Descarga Masiva — Arquitectura

**Fecha:** 2026-05-12
**Status:** PoC completo — listo para integracion con app

---

## Flujo del SAT (4 pasos)

El SAT expone un servicio SOAP para descarga masiva de CFDIs. Son solo 4 operaciones:

### Paso 1 — Autenticacion

**Endpoint:** `https://cfdidescargamasivasolicitud.clouda.sat.gob.mx/Autenticacion/Autenticacion.svc`

Se genera:
- SOAP envelope con WS-Security
- BinarySecurityToken (certificado .cer en base64)
- Digest SHA1 del timestamp
- Firma RSA-SHA1 con la llave privada (.key)

SAT retorna: **token de autenticacion**

### Paso 2 — Solicitud de descarga

Se solicita:
- Tipo: emitidos o recibidos
- Formato: **metadata** o **XML**
- Rango de fechas
- Filtros por RFC

SAT retorna: **IdSolicitud** (NO los archivos todavia)

### Paso 3 — Verificacion (polling)

Se consulta el status de la solicitud:

| Status | Significado |
|--------|-------------|
| Aceptada | Solicitud registrada |
| En proceso | SAT esta preparando el paquete |
| Terminada | Paquete listo para descarga |
| Rechazada | Error o solicitud invalida |

Cuando status = Terminada, SAT retorna **IDs de paquetes**.

### Paso 4 — Descarga de paquetes

Se descargan archivos ZIP que contienen:
- **XMLs** de los CFDIs (si se solicito XML)
- **TXT con metadata** (si se solicito metadata)

---

## Descubrimiento Critico: SAT NO es tiempo real

El SAT puede tardar:
- Minutos
- Horas
- Hasta ~72 horas

en preparar paquetes.

**Implicacion arquitectonica:** El flujo NUNCA debe ser sincronico (doctor click → espera respuesta). Debe ser:

```
Doctor solicita sync
    |
Background job se crea
    |
Worker autentica con SAT
    |
Worker solicita descarga
    |
Polling periodico del status
    |
Descarga automatica cuando listo
    |
Parse y almacenamiento en DB
    |
Notificacion al doctor
```

---

## Estrategia: Metadata First

**Recomendacion fuerte: empezar solo con metadata, NO con XMLs.**

La metadata del SAT contiene 12 campos (confirmado por PoC 2026-05-12):

| Campo | Descripcion |
|-------|-------------|
| Uuid | Folio fiscal unico del CFDI |
| RfcEmisor | RFC de quien emitio |
| NombreEmisor | Razon social del emisor |
| RfcReceptor | RFC de quien recibio |
| NombreReceptor | Razon social del receptor |
| PacCertifico | RFC del PAC que certifico |
| FechaEmision | Fecha/hora de emision (`YYYY-MM-DD HH:mm:ss`) |
| FechaCertificacionSat | Fecha/hora de certificacion por el SAT |
| Monto | Monto total (decimal) |
| EfectoComprobante | Codigo: `I`=Ingreso, `E`=Egreso, `P`=Pago, `T`=Traslado |
| Estatus | `1`=Vigente, `0`=Cancelado |
| FechaCancelacion | Fecha de cancelacion (vacio si vigente) |

**Nota:** No incluye Subtotal ni IVA por separado — solo el Monto total. Para desglose se necesitan los XMLs (Phase 2).

Esto es suficiente para:
- Dashboards financieros
- Contabilidad basica
- Analytics de ingresos/gastos
- Verificacion de ingresos (para creditos)
- Deteccion de anomalias

Los XMLs completos se descargan on-demand (Phase 2).

---

## Modelo de Datos Propuesto

### Tabla: `sat_sync_jobs`

Registra cada solicitud de sincronizacion con el SAT.

```sql
CREATE TABLE practice_management.sat_sync_jobs (
  id              SERIAL PRIMARY KEY,
  doctor_id       TEXT NOT NULL REFERENCES public.doctors(id) ON DELETE CASCADE,
  status          VARCHAR(20) NOT NULL DEFAULT 'pending',
    -- pending | authenticating | requesting | polling | downloading | parsing | completed | failed
  request_id      VARCHAR(100),  -- IdSolicitud del SAT
  request_type    VARCHAR(10) NOT NULL,  -- 'metadata' | 'xml'
  direction       VARCHAR(10) NOT NULL,  -- 'emitted' | 'received'
  date_from       DATE NOT NULL,
  date_to         DATE NOT NULL,
  rfc_filter      VARCHAR(13),  -- filtro opcional por RFC contraparte
  package_ids     TEXT[],  -- IDs de paquetes listos para descarga
  attempts        INT NOT NULL DEFAULT 0,
  max_attempts    INT NOT NULL DEFAULT 10,
  last_error      TEXT,
  started_at      TIMESTAMP,
  completed_at    TIMESTAMP,
  created_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
```

### Tabla: `sat_cfdi_metadata`

Metadata de CFDIs descargados del SAT. Actualizado para reflejar los 12 campos confirmados por PoC.

```sql
CREATE TABLE practice_management.sat_cfdi_metadata (
  id              SERIAL PRIMARY KEY,
  doctor_id       TEXT NOT NULL REFERENCES public.doctors(id) ON DELETE CASCADE,
  uuid            VARCHAR(36) NOT NULL,
  direction       VARCHAR(10) NOT NULL,  -- 'emitted' | 'received'

  -- Emisor
  issuer_rfc      VARCHAR(13) NOT NULL,
  issuer_name     VARCHAR(300),

  -- Receptor
  receiver_rfc    VARCHAR(13) NOT NULL,
  receiver_name   VARCHAR(300),

  -- PAC que certifico
  pac_rfc         VARCHAR(13),

  -- Montos (metadata solo trae monto total, no subtotal/iva)
  monto           DECIMAL(14, 2) NOT NULL DEFAULT 0,

  -- Tipo (EfectoComprobante: I=Ingreso, E=Egreso, P=Pago, T=Traslado)
  efecto          VARCHAR(5),  -- I, E, P, T

  -- Status (SAT usa 1=Vigente, 0=Cancelado)
  sat_status      VARCHAR(20) NOT NULL DEFAULT 'Vigente',  -- Vigente | Cancelado
  cancelation_date TIMESTAMP,

  -- Fechas
  issued_at       TIMESTAMP NOT NULL,
  certified_at    TIMESTAMP,

  -- Sync tracking
  sync_job_id     INT REFERENCES practice_management.sat_sync_jobs(id),
  synced_at       TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

  created_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

  UNIQUE(doctor_id, uuid)
);

CREATE INDEX idx_sat_cfdi_doctor_direction ON practice_management.sat_cfdi_metadata(doctor_id, direction);
CREATE INDEX idx_sat_cfdi_issued_at ON practice_management.sat_cfdi_metadata(issued_at);
CREATE INDEX idx_sat_cfdi_uuid ON practice_management.sat_cfdi_metadata(uuid);
CREATE INDEX idx_sat_cfdi_issuer_rfc ON practice_management.sat_cfdi_metadata(issuer_rfc);
CREATE INDEX idx_sat_cfdi_receiver_rfc ON practice_management.sat_cfdi_metadata(receiver_rfc);
```

**Cambios vs version anterior:** Se removieron `subtotal`, `iva`, `currency`, `payment_method`, `payment_form`, `raw_metadata` (no vienen en metadata TXT). Se renombro `total` → `monto` y `cfdi_type`/`cfdi_effect` → `efecto` para reflejar la estructura real. Se agrego `pac_rfc`.

---

## Stack Tecnico (Node.js) — Confirmado por PoC

### XML / SOAP / Firma — ZERO DEPENDENCIES

El PoC completo (2026-05-12) demostro que **no se necesitan librerias externas** para ninguno de los 4 pasos:

| Componente | Solucion | Status |
|------------|----------|--------|
| Firma RSA-SHA1 | `crypto.createSign('RSA-SHA1')` (built-in) | Probado OK |
| Digest SHA-1 | `crypto.createHash('sha1')` (built-in) | Probado OK |
| Lectura .cer (DER) | `fs.readFileSync()` + base64 encode (built-in) | Probado OK |
| Lectura .key (PKCS#8 encrypted) | `crypto.createPrivateKey()` con passphrase (built-in) | Probado OK |
| Inspeccion certificado X.509 | `crypto.X509Certificate` (built-in) | Probado OK |
| Canonicalizacion exc-c14n | Manual (construir XML canonico como string) | Probado OK |
| SOAP envelope | Template strings (built-in) | Probado OK |
| HTTPS POST | `https.request()` (built-in) | Probado OK |
| ZIP extraction | `zlib.inflateRawSync()` + manual ZIP header parsing (built-in) | Probado OK |
| Metadata TXT parsing | `String.split('~')` (built-in) | Probado OK |

No se usan: `xml-crypto`, `xmlbuilder2`, `node-forge`, `adm-zip`, ni ninguna otra libreria.

### Jobs / Queue

| Opcion | Pros | Contras |
|--------|------|---------|
| **BullMQ** | Simple, Redis-based, buen retry/backoff | Requiere Redis |
| Cron + DB polling | Sin dependencia extra | Menos robusto |
| pg-boss | Postgres-native queues | Menos popular |

**Recomendacion inicial:** BullMQ si ya hay Redis, si no, cron + DB polling con la tabla `sat_sync_jobs`.

---

## Estrategia de Rangos de Fecha

**NO solicitar rangos grandes.** SAT se comporta mejor con rangos pequenos.

| Estrategia | Rango | Uso |
|------------|-------|-----|
| Sync inicial | Mes por mes | Primera carga historica |
| Sync periodico | Semanal o diario | Mantener actualizado |
| On-demand | Rango especifico | Doctor solicita periodo especifico |

---

## Fases de Implementacion

### Fase 1 — Metadata sync (MVP)

1. Autenticar con SAT usando CSD del doctor
2. Solicitar metadata (emitidos + recibidos)
3. Polling de status
4. Descarga de paquete metadata
5. Parse de TXT
6. Almacenamiento en `sat_cfdi_metadata`

**Valor:** Dashboard financiero completo sin necesidad de XMLs.

### Fase 2 — XML on-demand

- Descarga de XMLs individuales o por lote
- Cache local de XMLs
- Export para contadores

### Fase 3 — Inteligencia financiera

- Proyecciones fiscales
- Analisis de cashflow
- Scoring crediticio
- Categorizacion de gastos
- Deteccion de anomalias

---

## Ambos Sentidos: Emitidos + Recibidos

| Direccion | Datos | Valor |
|-----------|-------|-------|
| **Emitidos** | Ingresos del doctor | Revenue, tendencias, cobranza |
| **Recibidos** | Gastos del doctor | Deducciones, proveedores, cashflow |

Juntos = sistema financiero completo del doctor.

---

## Referencia: No hay API wrapper viable

No existe un servicio tipo "Plaid for SAT" que abstraiga completamente la integracion. Las opciones existentes son:
- Wrappers parciales sobre SOAP del SAT
- Soluciones enterprise con onboarding pesado
- Integraciones de consultoria

La mejor ruta es **conexion directa al SAT**, lo cual es viable porque ya tenemos las credenciales CSD por doctor.
