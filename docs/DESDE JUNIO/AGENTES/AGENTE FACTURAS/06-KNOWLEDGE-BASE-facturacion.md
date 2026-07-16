# 📚 Knowledge Base — facturación CFDI (consolidado y verificado contra código)

> **Qué es este doc.** LA base de conocimiento de la implementación de facturas: cómo se crean,
> qué opciones tienen, qué reglas SAT aplican, y dónde vive cada pieza en el código. Consolida
> `docs/TODO FACTURAS/` (PLAN-FACTURACION-CFDI, UNIFIED-FISCAL-REFERENCE, GUIA-FACTURACION-DOCTORES)
> + los docs de esta carpeta + **verificación contra el código vivo 2026-07-15** (todas las rutas
> y fórmulas citadas fueron leídas hoy). Es la materia prima del conocimiento del agente (R1-R5
> de `05-ANALISIS`) y la referencia para el builder server-side de F2.
>
> Jerarquía de fuentes: **el código gana**; para reglas SAT/legales,
> `UNIFIED-FISCAL-REFERENCE.md` es el canónico (incluye erratas de los demás docs de junio).

---

## 1. Mapa del sistema (verificado 2026-07-15)

**Proveedor:** Facturama **Multiemisor** — una cuenta de plataforma emite por N doctores (cada
uno con su CSD). Auth Basic (`FACTURAMA_USER`/`FACTURAMA_PASSWORD` — en Railway, no en .env
local). ⚠️ **`FACTURAMA_API_URL` = apisandbox.facturama.mx EN PROD — intencional** (decisión
usuario 2026-07-15): todo timbrado actual es de PRUEBA, no documento SAT real. Producción sería
`api.facturama.mx`. Multiemisor usa tipo `issuedLite` en descargas/listados (no `issued`).

**Cliente API:** `apps/api/src/lib/facturama.ts` (CSD, CFDI I/E/P, catálogos, validaciones,
email, acuses — auditado 4 veces contra docs oficiales en mayo, ver PLAN §reviews).

**Rutas (las 17 verificadas hoy):** `/api/facturacion/` → `profile` · `csd` · `csd/status` ·
`cfdi` (GET list + POST emit) · `cfdi/[id]` (+ `pdf`·`xml`·`html`·`email`·`cancel`·`acuse`) ·
`cfdi/rep` (Complemento de Pago 2.0) · `cfdi/egreso` (Nota de Crédito) · `catalogos/[tipo]` ·
`validar/[tipo]`; más `appointments/fiscal-form-link` + `fiscal-form` (el paciente llena sus
datos fiscales por link).

**UI:** `/dashboard/facturacion` (tabs: Config fiscal+CSD · Lista · Nueva Factura · REP ·
Nota de Crédito · Guía) + botón "Facturar" desde ledger (pre-fill) + emisión desde cita
(`useBookings.emitCfdi`) y desde expediente (pre-fill receptor).

**Modelos:** `DoctorFiscalProfile` (RFC, razón social, régimen, CP, csdUploaded,
facturamaStatus) · `CfdiEmitted` (facturamaId, uuid, folio, tipo, montos, status,
`ledgerEntryId?`) · `Patient.{rfc, razonSocial, regimenFiscal, usoCfdi, codigoPostalFiscal,
requiereFactura, constanciaFiscalUrl}`.

## 2. Flujo de emisión — POST `/api/facturacion/cfdi` (leído línea a línea)

Gates y pasos, en orden (`apps/api/src/app/api/facturacion/cfdi/route.ts:55-315`):

1. **Perfil fiscal existe** → si no: "configura tu perfil fiscal" (400).
2. **CSD activo**: `csdUploaded && facturamaStatus === 'active'` → si no, 400.
3. **Receptor completo**: rfc, name, cfdiUse, fiscalRegime, taxZipCode (400 si falta algo).
4. **Público en General** (RFC `XAXX010101000`): fuerza `cfdiUse='S01'` y `fiscalRegime='616'`
   (400 si no), `TaxZipCode` = CP del EMISOR, y agrega `GlobalInformation`
   (Periodicity default '04' mensual, Months/Year del mes actual MX).
5. **Tenancy del ledger**: `ledgerEntryId` debe pertenecer al doctor (404 si no).
6. **ISR atípico**: si un item trae ISR retención con tasa ≠ default del régimen
   (626→0.0125, otro→0.10, tolerancia 0.001) → **solo console.warn**, no rechaza (la UI permite
   override).
7. **Folio auto**: secuencial por perfil (último folio numérico + 1) — obligatorio en Multiemisor.
8. **Issuer.Name**: se obtiene el `TaxName` del CSD registrado en Facturama (`getCSDStatus`) —
   NO la razonSocial del perfil (deben coincidir con el CSD o Facturama rechaza). Fallback a
   razonSocial en mayúsculas si la consulta falla.
9. **Items**: defaults `ProductCode='85121800'`, `UnitCode='E48'`, qty 1;
   `TaxObject = '02'` si trae taxes, `'01'` si no — y con '01' **NO se incluye nodo Taxes**
   (ni array vacío; Facturama lo rechaza).
10. **Campos opcionales no-fiscales** (solo PDF): Observations, PaymentBankName,
    PaymentAccountNumber, OrderNumber. `Serie` opcional.
11. Llama `createCFDI` → guarda `CfdiEmitted` (uuid del timbre, folio, tipo mapeado
    Ingreso→I/Egreso→E/Pago→P por el VARCHAR(5), subtotal/iva/retencionIsr calculados de los
    items, total del RESPONSE de Facturama) → si hay `ledgerEntryId`, marca
    `ledgerEntry.hasFactura = true`.

**Errores Facturama** → status 4xx passthrough o 502, con `details`.

## 3. El builder de impuestos HOY (la fórmula que F2 debe replicar server-side)

⚠️ **Corrección al blueprint/00**: la fórmula NO vive en `useBookings.emitCfdi` (ese hook manda
items SIN taxes — tipo en `useBookings.ts:432-438`). Vive en el **formulario de Nueva Factura**
(`apps/doctor/src/app/dashboard/facturacion/page.tsx:1383-1421`):

- Por item, dos toggles: `withIva` y `withIsrRetention`.
- **IVA**: `Total = round2(subtotal × ivaRate)`, `Rate = ivaRate`, `IsRetention: false`.
  `ivaRate` default **0.16** (`DEFAULT_IVA_RATE`, page.tsx:1314), editable en la UI (custom se
  flaggea visualmente).
- **ISR retención**: `Rate = regimenFiscal === '626' ? 0.0125 : 0.10` (page.tsx:1331), editable;
  `IsRetention: true`.
- **Total del item** = subtotal + IVA − retención ISR, redondeado a centavos.
- Hints de la UI (verificados: `isReceiverPF` regex 13-chars, `isMedicalService` =
  productCode startsWith '8512', page.tsx:1334-1338): avisa que servicios médicos a PF suelen
  ser IVA-exentos, y que PF generalmente no retienen ISR.
- La nota de crédito (segundo builder, page.tsx:2243-2266) solo arma IVA, sin retenciones.

**Regla E7 para el agente (decisión de `00` §4, no re-litigar):** el modelo NUNCA arma
impuestos — aporta flags de negocio (withIva/withIsrRetention por concepto); la fórmula corre
server-side al armar la propuesta (precedente: `complete_booking` arma el payload de ledger
completo en `proposals.ts` y el executor lo manda tal cual).

## 4. Datos fiscales del receptor (de dónde sale y cuál es el gate)

- **Fuente ÚNICA para el agente: el expediente** (`Patient.*` fiscal) o Público en General
  explícito — NUNCA texto libre del chat (decisión `00` §6).
- **Veredicto server-side** (`modules/facturas.ts:190-216`): `completitudFiscal`
  (completo/parcial/vacío sobre los 5 campos: rfc, razonSocial, regimenFiscal, usoCfdi,
  codigoPostalFiscal), `camposFaltantes`, y `listoParaFacturar = completo && requiereFactura`
  — espejo exacto del gate del botón de emitir del expediente.
- **Si faltan datos**: el camino es el **formulario fiscal** al paciente
  (`POST /appointments/fiscal-form-link` → el paciente lo llena → `fiscal-form`). Es el
  `propose_send_fiscal_form` de F2+.
- Validación opcional contra SAT: `validar/rfc` (ExistRfc/MatchName/MatchZipCode/
  MatchFiscalRegime) — ⚠️ **consume 1 folio** por llamada; usar solo con propósito.

## 5. Reglas SAT operativas (curadas de UNIFIED-FISCAL-REFERENCE — el canónico legal)

**Claves ProdServ médicas** (ClaveUnidad `E48` en servicios):

| Servicio | Clave |
|---|---|
| Consulta médica general | 85121502 |
| Servicios médicos especializados (default de la app) | 85121800 |
| Psicología | 85121608 |
| Nutrición | 85121609 |
| Análisis clínicos/laboratorio | 85141600 |
| Medicamentos | 51101500-51251002 (unidad según presentación) |
| Material quirúrgico | 42311500 |
| (familia insumos médicos) | 42xxxxxx |

**Uso CFDI — depende del RÉGIMEN DEL RECEPTOR (regla de rechazo de PAC):**
- Receptor 612 u otros PF generales: D01 (honorarios médicos — el más común para pacientes que
  deducen), D02, G03, S01…
- **Receptor RESICO (626): D01-D10 son INVÁLIDOS — el PAC rechaza el timbrado.** Válidos:
  G01-G03, I01-I08, S01.
- Público en General: siempre S01 + régimen 616 (el endpoint lo fuerza, §2.4).
- REP: CP01.

**IVA en servicios médicos:** exentos a por el TIPO DE PRESTADOR (PF con título médico o SC,
Art. 15 frac. XIV LIVA) — la exención NO depende del cliente. Estéticos/cosméticos SIEMPRE 16%.
Prestador persona moral mercantil: 16% (y la PM receptora retiene 2/3 del IVA).

**Retención ISR** (cuando el receptor es persona moral): emisor 612 → 10%; emisor RESICO 626 →
1.25%. Pacientes PF normalmente NO retienen.

**PUE vs PPD:** PUE = ya cobrado, FormaPago real (01/03/04/28…). PPD = se cobrará después,
**FormaPago 99 obligatoria**, y CADA pago exige un **REP** (CFDI tipo P, plazo: 5 días naturales
del mes siguiente al pago, Regla 2.7.1.32 RMF 2026). En base de efectivo (ambos regímenes PF),
una PPD sin complemento NO es ingreso acumulable todavía. Default del agente: **PUE; PPD solo a
petición explícita** con advertencia del REP (decisión SESSION-REFRESCO).

**Cancelación:** motivos 01 (con reemplazo — timbrar el reemplazo PRIMERO y ligar su UUID),
02, 03, 04; receptor puede tener 72h para aceptar; plazo máximo PF 30-abril del año siguiente;
extemporánea = multa 5-10% del monto. **El agente NO cancela (nunca-v1)**; nota de crédito
(egreso, uso G02) ≠ cancelación y NO debe usarse para "cancelar".

**Errores comunes de timbrado** (para diagnóstico): CP del receptor equivocado (causa #1),
nombre no coincide EXACTO con constancia (mayúsculas — la app las fuerza), RFC inactivo,
PPD sin FormaPago 99 / PUE con 99, TaxObject 01 + nodo Taxes, Issuer.Name ≠ nombre del CSD.

**Aseguradoras:** SIEMPRE dos facturas (aseguradora por lo cubierto + paciente por copago) —
nunca una sola por el total.

## 6. Catálogos SAT (la fuente grounded para recomendaciones — R1)

`GET /api/facturacion/catalogos/[tipo]` con `?q=`: `productos` y `unidades` (búsqueda por
keyword, q obligatoria), `uso-cfdi` (acepta RFC — los resultados varían PF/PM),
`regimenes-fiscales`, `formas-pago`, `metodos-pago`. Con Facturama caído/no configurado hay
fallback offline hardcodeado de los valores comunes.

**Semántica post-review (2026-07-16, commit `d93a3fc3`):**
- **TODA respuesta de fallback lleva `_offline: true`** — incluida la rama "credenciales no
  configuradas", que antes lo omitía y hacía que `search_catalogo_sat` etiquetara el fallback
  hardcodeado como "catálogo oficial SAT" (hallazgo #1 del review). El tool decide su etiqueta
  de `fuente` por este flag.
- **Un 200 con body no-array se trata como FALLA, no como "catálogo vacío"** (guard
  `Array.isArray` en el camino de éxito del route): cae al offline con `_offline` o responde
  502 si no hay fallback (productos/unidades). Es la firma exacta del outage de `/api-lite` —
  `request()` en facturama.ts coerciona body vacío→`{}` y eso se DEJÓ así a propósito (otros
  endpoints POST dependen de ello); la defensa vive en el route de catálogos.
- **Cache in-process 12h** en facturama.ts para los catálogos ESTÁTICOS (regímenes,
  formas/métodos de pago, uso-cfdi por RFC) — solo se cachean arrays NO vacíos, para que una
  respuesta rota nunca quede fijada el TTL. Las búsquedas por keyword (productos/unidades) no
  se cachean.

⚠️ **Bug histórico (encontrado y corregido 2026-07-15, smoke F2a):** `facturama.ts` usaba
`/api-lite/catalogs/*`, que responde 200 con body VACÍO → todos los catálogos devolvían `{}`
en prod (la UI lo enmascaraba con su fallback de frontend). Path correcto: **`/catalogs/*`**,
y regímenes se llama **`FiscalRegimens`**. La búsqueda por keyword es LITERAL y sensible a
acentos ("cirugía" 52 · "quirófano" 2 · "material quirurgico" 0) — reintentar con otra
palabra, no con frases. Las validaciones de `validar/*` consumen
1 folio por llamada (declarado en código, facturama.ts:484); los catálogos no llevan esa
advertencia (y los docs de Facturama los tratan como gratuitos) — si el consumo importara,
verificar con Facturama antes de un tool de alto volumen.

## 7. El grafo de datos (cómo se rastrea qué está facturado)

```
Booking ←(bookingId @unique)─ LedgerEntry ─(ledgerEntryId?)→ CfdiEmitted
                                  ├─ patientId (denormalizado por webhooks/H1)
                                  ├─ counterpartyRfc/Name
                                  └─ hasFactura ← lo marca el POST al ligar; H8: la cancelación DEFINITIVA
                                     lo resetea SOLO si no queda otra señal (otro CFDI activo del entry, o
                                     satCfdiUuid ≠ este uuid) — cancellation_pending NO resetea (cancel/route.ts:99-127)
```

- Cadena expediente↔factura **transitiva vía LedgerEntry** (opción A de `00` §3, sin migración).
  Regla de diseño: el agente SIEMPRE liga `ledgerEntryId` al emitir.
- *"Facturada"* es señal COMPUESTA: `hasFactura ∧ (cfdi activo ∨ satCfdiUuid vigente)` —
  cuidado con `cancellation_pending`.
- **Fuente DUAL de CFDIs**: `cfdis_emitted` = solo lo emitido POR la plataforma;
  `sat_cfdi_metadata` (SAT descarga, por FIEL) = TODO el RFC con frescura por dirección.
  "¿Cuánto facturé?" usa la dual (`01-CONTEXTO-SAT-DESCARGA`).
- **Pendientes de factura (R3)**: ingresos del ledger con `hasFactura=false` × pacientes con
  `requiereFactura=true` (+ `listoParaFacturar` para saber si ya se puede emitir o hay que
  mandar formulario). Hoy NO hay tool compuesto de barrido — es el hueco a construir en F2.

## 8. Drift encontrado docs↔código (la razón de verificar)

1. Blueprint/`00` §4: "la fórmula vive en useBookings.emitCfdi" → **falso hoy**: vive en el
   form de `/dashboard/facturacion` (§3); el hook manda items sin taxes.
2. `PLAN-FACTURACION-CFDI` §Pendiente: "Verificar DB save", "Deploy a producción" → hechos hace
   tiempo (el doc quedó congelado en mayo); TODAS sus rutas existen (verificado §1).
3. `UNIFIED` ya documenta erratas de los docs de junio (arts. LISR, plazos) — al citar reglas
   legales usar UNIFIED, no los docs corregidos.
4. dr-prueba SÍ puede timbrar (csdUploaded + facturamaStatus active, verificado 2026-07-11) —
   en SANDBOX (§1): la validación en vivo de F2 timbra de prueba, no documentos reales.

## 9. Qué implica para el agente (el mapa a tools/conocimiento)

| Pieza | Dónde vive en el agente |
|---|---|
| Reglas duras (PG, tenancy, CSD gate, TaxObject) | Ya en el endpoint — el agente solo las NARRA si el server las rechaza |
| Fórmula de impuestos | Builder server-side en la propuesta (E7) — §3 |
| Claves de catálogo | Tool grounded sobre `catalogos/*` (§6) + defaults médicos (§5) como conocimiento |
| Uso CFDI por régimen receptor / IVA exento / PPD+REP | Conocimiento del módulo (prompt corto + get_guia para el detalle) — fuente: §5 |
| Completitud del receptor | `get_patient_profile` (ya existe) + camino formulario fiscal |
| Pendientes de factura | Tool compuesto NUEVO (§7) |
| Emisión | `propose_create_cfdi` (F2) con card tier-máximo ("se timbra ante el SAT") |
| Cancelar / consejo fiscal (qué régimen conviene, ISR) | FUERA — nunca-v1 / frontera E7 |

---

*Relacionado: [`05-ANALISIS-arquitectura-especializado-vs-modulo.md`](05-ANALISIS-arquitectura-especializado-vs-modulo.md)
(la decisión de arquitectura), [`00-FACTIBILIDAD-Y-ARQUITECTURA.md`](00-FACTIBILIDAD-Y-ARQUITECTURA.md)
(flujo E2E), `docs/TODO FACTURAS/UNIFIED-FISCAL-REFERENCE.md` (canónico legal, con erratas),
`02-FLUJO-SISTEMA` (grafo + matriz de 6 preguntas). Creado 2026-07-15; actualizar al cambiar
el endpoint de emisión, el builder de la UI, o al pasar Facturama a producción.*
