# 🗺️ PLAN — de dos tiers a cuatro (FREE · BÁSICO · PRO · LAB)

> **Tipo: PLAN.** Escrito 2026-09-12 contra el código real (archivos citados). **Nada de esto
> está en código todavía.** Al terminar cada PR, anota el as-built en §8 y actualiza el
> `README` de esta carpeta.
>
> **Prerrequisito de lectura:** [`01-DISENO-tecnico.md`](01-DISENO-tecnico.md) §1–§2 (la decisión
> de que un tier es un TECHO sobre `PermissionKey`, no un sistema nuevo). Este plan **no la
> cambia**: la extiende con dos cosas que el diseño v1 no tenía —una key para los flujos de IA
> sueltos y **límites de cantidad** (almacenamiento, pacientes)— y renombra el vocabulario.

---

## 0. La decisión de producto (usuario, 2026-09-12)

| Tier | Precio | Qué tiene |
|---|---|---|
| **FREE** | 0 | Todo el software **excepto** Facturación, Descarga SAT y **cualquier IA**. Tope: **500 MB** de archivos, **50 pacientes** |
| **BÁSICO** | 149 MXN + IVA | FREE + Facturación + Descarga SAT. Sin IA. Tope **15 GB** |
| **PRO** | 299 MXN + IVA | BÁSICO + **los flujos de IA de hoy** (dictado, chats por pantalla) + **WhatsApp automático a pacientes** (confirmaciones, recordatorios, envío de información; después, con agente — §3.5). Tope **50 GB**. Elegible a préstamos (futuro) |
| **LAB** | — (invitación / por definir) | PRO + **el asistente unificado** (panel 🟢) y la línea "Jarvis" que se construye ahí. Cuando sus costos estén medidos, sus funciones se PROMUEVEN a PRO |

**El orden de trabajo también es decisión del usuario:** primero los tres tiers comerciales
(+ LAB como interruptor, sin construir nada nuevo dentro), después una pasada de bugs y
funcionalidad general, y **solo entonces** empieza el desarrollo del LAB (documentado en
`../AGENTES/`, no aquí).

## 1. Qué se reusa tal cual (y por qué el 80% ya está)

| Pieza | Estado | Qué pasa con ella |
|---|---|---|
| `Doctor.tier String` + `DOCTOR_TIERS` + `TIER_EXCLUDED_KEYS` + `tierAllows` (`packages/database/src/permissions.ts`) | ✅ en prod | Se quedan. Cambia el CONTENIDO de las dos constantes |
| Los 3 sitios de enforcement (2 choke points + `doctorTierAllows` para público/cron) | ✅ en prod | Sin cambios |
| `nearestFeatureKey` / `tierRouteDecision` (`route-permissions.ts`) | ✅ en prod | Gana UNA capacidad nueva (§3.1) |
| Agente tier-aware: `resolveAgentScope` dropea módulos y tools por tier; `asistente_ia` ya es key mapeada a `agenda-agent` | ✅ en prod | Es exactamente el interruptor de LAB (§5) |
| Cliente: `lockedByTier`, candado en Sidebar + MobileDrawer, pantalla de plan, `PermissionGate` | ✅ en prod | Sin cambios; ojo con la asimetría de `BottomNav` (§7) |
| Admin: columna Plan + modal, derivado de `DOCTOR_TIERS` / `TIER_EXCLUDED_KEYS` (`apps/admin/src/app/doctors/page.tsx`) | ✅ en prod | Se adapta solo al cambiar las constantes (no hay lista a mano) |
| Gate de cobertura de tier (toda key excluida resuelve a ≥1 ruta) | ✅ | Cubre la key nueva automáticamente |
| Conteo de pacientes por doctor en el admin (`/feature-usage`, campo `patients`) | ✅ | Se reusa para MOSTRAR "23/50"; **no sirve para hacer cumplir** (el tope se impone en el write path, §4.2) |

## 2. Los huecos que este plan cierra (además de los G1–G4 del diseño v1)

### G5 — 🔴 Los flujos de IA de hoy NO son gateables por tier

Los 11 prefijos de IA están en el route map con key **`OWNER_ONLY`**
(`route-permissions.ts:143-153`: `encounter-chat`, `patient-chat`, `prescription-chat`,
`sale-chat`, `purchase-chat`, `quotation-chat`, `task-chat`, `ledger-chat`, `form-builder-chat`,
`voice`, `llm-assistant`). `nearestFeatureKey` **salta a propósito** las reglas `OWNER_ONLY`/
`NEUTRAL` (`route-permissions.ts:238`) — así que **ningún tier puede excluirlas hoy**: un doctor
FREE podría dictar una consulta y pagar gpt-4o con nuestra cuenta.

Además hay IA **fuera** de esos prefijos: `medical-records/patients/[id]/summary`,
`.../reports/[reportId]/dictar` y `.../reports/[reportId]/chat` (el informe transcribe con
`lib/voice/transcribir-audio` **precisamente para no pasar por `/api/voice`**, que es
OWNER_ONLY — `transcribir-audio.ts:7`). Un gate por prefijo `voice` los dejaría fuera.

### G6 — Los límites de CANTIDAD no existen como concepto

El diseño v1 gatea **funciones** (on/off). "500 MB" y "50 pacientes" son **cupos**: necesitan
un contador, un tope por tier y un punto de imposición en cada escritura. Hoy:

- **Pacientes:** se crean por **dos** caminos reales — `POST /api/medical-records/patients`
  (`patients/route.ts`) y la importación por `.xlsx` (`packages/database/src/patient-import-commit.ts`).
  (El tercer `patient.create` es `seed-emr.ts`, dev.)
- **Archivos:** **14 file routes** de UploadThing en `apps/doctor/src/app/api/uploadthing/core.ts`
  (+ duplicados de ledger en `apps/api` y las de perfil en `apps/admin`, ver
  `../IMAGE MIGRATION/02-PLAN-migracion-a-r2.md` §2.1). `fileSize` existe pero es **nullable**
  en `PatientMedia`, `LedgerAttachment` y los medios de perfil; para muchas filas viejas no se
  guardó. Y el bucket tiene huérfanos que la BD no ve (el mismo plan lo advierte).

### G7 — Vocabulario, default y fail-open

`DOCTOR_TIERS = ['FULL','CORE']`, `DEFAULT_TIER = 'FULL'`, y **un tier desconocido cae a FULL**
(fail-open). Con un tier gratuito, "desconocido = todo" pasa de ser "no dejar a nadie fuera" a
ser una fuga de ingreso. Y el nombre `FULL` deja de significar "todo" (ahora "todo" es LAB).

### G8 — El asistente está oculto por FLAG de código, no por tier

`ASISTENTE_IA_VISIBLE = false` (`lib/agenda-agent/feature-flag.ts`) tapa las 3 puertas del panel
para TODOS. Con LAB, el tier debe ser el interruptor y el flag sobra — si conviven, un LAB no vería
el panel y nadie sabría por qué.

### G9 — Un `PermissionKey` nuevo se vuelve un TOGGLE de member

`PERMISSION_KEYS` alimenta los 19 toggles de la pestaña Equipo (`TeamSection.tsx`) y los gates
verifican ese número. Agregar `ia` ahí lo convierte en el toggle #20 y **cambia la semántica de
los flujos de IA para members** (hoy OWNER_ONLY por decisión de NUEVOS USUARIOS §5.3).

## 3. Diseño de lo nuevo

### 3.1 La key `ia` y cómo se cuelga de rutas OWNER_ONLY (G5 + G9)

**Decisión propuesta:** las reglas del route map ganan un campo opcional **`feature`** —la key
de función a la que pertenece una ruta cuyo `key` es `OWNER_ONLY`:

```ts
{ prefix: 'encounter-chat', key: 'OWNER_ONLY', feature: 'ia' },
```

- `checkRoutePermission` (members) **ignora `feature`** ⇒ los flujos siguen OWNER_ONLY para
  members. Cero cambio de conducta.
- `nearestFeatureKey` (tier) usa **`feature ?? key`** ⇒ la ruta cae bajo el techo del tier.
- Es la generalización del hueco **G1** del diseño v1 (`facturacion/csd` OWNER_ONLY bajo
  `facturacion`): ahí se resolvió porque había un prefijo padre con key de función; los de IA
  **no tienen padre**, por eso hace falta la anotación.

**`ia` NO entra a `PERMISSION_KEYS`.** Se introduce un tipo `TierKey = PermissionKey | 'ia' | 'whatsapp'`
y `TIER_EXCLUDED_KEYS: Record<DoctorTier, readonly TierKey[]>`. `tierAllows(tier, key: TierKey)`.
Así los 19 toggles no se mueven, `gate:rutas↔permisos` no cambia de número, y el techo del tier
puede hablar de una función que un member nunca togglea.

**Cobertura obligatoria de `feature: 'ia'`** (lista cerrada, se verifica con el gate de cobertura):

| Prefijo / ruta | Hoy |
|---|---|
| `encounter-chat` · `patient-chat` · `prescription-chat` · `sale-chat` · `purchase-chat` · `quotation-chat` · `task-chat` · `ledger-chat` · `form-builder-chat` · `voice` · `llm-assistant` | OWNER_ONLY |
| `medical-records/patients/*/summary` | hereda `expedientes` → **agregar regla con `feature: 'ia'`** |
| `medical-records/patients/*/reports/*/dictar` y `.../chat` | hereda `expedientes` → **agregar reglas con `feature: 'ia'`** |
| `bank-statement-parse` | ya es `conciliacion` (excluida en FREE/BÁSICO) — no necesita `ia` |
| `agenda-agent` | `asistente_ia` (key propia; es el interruptor de LAB, no de PRO) |

⚠️ Las reglas de `medical-records/...` tienen un prefijo con comodín en medio; verificar que
`nearestFeatureKey` matchea `*` como lo hace para `doctors/*/google-calendar`.

**Cliente (las puertas):** ~20 hooks/componentes abren estos flujos (`useVoiceSession`,
`useEncounterChat`, `usePrescriptionChat`, `useBasePracticeChat` y familia, `FormBuilder`,
`VoiceAssistantHubWidget`, los micrófonos de notas/consulta/receta/informe). Con `can('ia')`
respetando el tier, **se ocultan** (política de T4 §13.4 para botones sueltos). **Decisión
pendiente (§9.2):** si el micrófono en FREE se muestra con candado + upsell (es el punto de
conversión más fuerte del producto) o se oculta.

### 3.2 Límites de cantidad (G6)

```ts
export const TIER_LIMITS: Record<DoctorTier, { storageBytes: number; maxPatients: number | null }> = {
  FREE:   { storageBytes: 500 * MB,  maxPatients: 50 },
  BASICO: { storageBytes: 15 * GB,   maxPatients: null },
  PRO:    { storageBytes: 50 * GB,   maxPatients: null },
  LAB:    { storageBytes: 50 * GB,   maxPatients: null },
};
```

**Pacientes** — un helper `assertPatientQuota(doctorId)` (cuenta `Patient` activos del doctor
vs `TIER_LIMITS[tier].maxPatients`) llamado en los DOS caminos de §2/G6. La importación `.xlsx`
lo evalúa **antes** de escribir el lote (rechaza el archivo entero si `actual + filas > tope`,
con mensaje claro; no importa "los primeros N"). Error tipado `QUOTA_EXCEEDED` → 402/403 con
`{ limit, current }` para que el cliente pinte "23 / 50" y el CTA de plan.

**Archivos** — la BD es el libro mayor, no el bucket:

1. **Toda subida registra `fileSize`** (las 14 rutas; hoy varias lo dejan null). En el
   `middleware` de UploadThing ya llegan los archivos con tamaño ⇒ ahí va la pre-comprobación
   `assertStorageQuota(doctorId, incomingBytes)`; en `onUploadComplete` se guarda el tamaño.
2. **`storageUsedBytes(doctorId)`** = suma de `fileSize` de las tablas con archivos del doctor
   (`PatientMedia`, `LedgerAttachment`, medios de perfil, blog, receta). Consulta agregada;
   si resulta lenta, columna `Doctor.storageUsedBytes` mantenida en subida/borrado (decidir al
   medir — con ~232 archivos hoy, la suma es trivial).
3. **Backfill** de `fileSize` nulos: script one-shot que pide el tamaño al proveedor
   (`HEAD` a la URL o `utapi`) y lo escribe. Lo que no se pueda medir cuenta 0 y **se reporta**
   (regla del repo: un contador que cuenta lo que se intentó, no lo que salió, miente).
4. **Coordinación con R2:** el plan de migración define un seam `lib/storage` con la misma forma
   que las file routes. **Los helpers de cuota se escriben UNA vez, agnósticos de proveedor**, y
   tanto la middleware de UploadThing como el seam de R2 los llaman. Así la migración no
   re-implementa el tope.

**Borrado:** al borrar un archivo se descuenta (o simplemente la suma deja de contarlo). Downgrade
**nunca borra** (§9 del diseño v1): un doctor FREE con 2 GB queda **por encima del tope** — puede
ver y borrar, **no** subir. Mismo trato para pacientes: por encima del tope no se crean nuevos,
todo lo demás sigue.

**Admin:** `/doctors` gana "Almacenamiento" y "Pacientes" con `usado / tope`; `/feature-usage`
ya trae el conteo de pacientes — reusarlo.

### 3.3 Vocabulario, migración y fail-open (G7)

```ts
export const DOCTOR_TIERS = ['FREE', 'BASICO', 'PRO', 'LAB'] as const;
export const DEFAULT_TIER: DoctorTier = 'FREE';        // default de COLUMNA para cuentas nuevas
export const FALLBACK_TIER: DoctorTier = 'PRO';        // fail-open para valor desconocido/ausente

export const TIER_EXCLUDED_KEYS: Record<DoctorTier, readonly TierKey[]> = {
  FREE:   ['facturacion', 'sat', 'conciliacion', 'ia', 'whatsapp', 'asistente_ia'],
  BASICO: ['conciliacion', 'ia', 'whatsapp', 'asistente_ia'],
  PRO:    ['asistente_ia'],
  LAB:    [],
};
```

- **`ventas`, `compras`, `productos` quedan en FREE** (decisión del usuario: FREE = "todo el
  software" menos factura/SAT/IA). Es un cambio respecto a CORE v1, que las excluía.
- **`conciliacion`** hoy está oculta para todos por flag (`ui-visibility.ts`). Se propone
  mantenerla excluida en FREE/BÁSICO (como CORE) y decidir su destino aparte — §9.3.
- **Dos defaults, no uno.** `DEFAULT_TIER` es lo que recibe una cuenta NUEVA (FREE). El
  **fail-open** de un valor corrupto/desconocido va a **PRO**, no a LAB: no deja fuera a nadie
  que paga y no regala el laboratorio. `tierAllows` hoy usa `DEFAULT_TIER` para ambas cosas —
  hay que separarlos.
- **Migración de filas (SQL manual, `prisma db execute`, NUNCA `db push`):**
  `UPDATE doctors SET tier='PRO' WHERE tier='FULL';` (11 filas; no hay `CORE` en prod) y
  `ALTER TABLE doctors ALTER COLUMN tier SET DEFAULT 'FREE';` **después** de desplegar el código
  que conoce los 4 nombres (si la columna cambia antes, un valor `FREE` cae al fail-open = PRO, no
  se rompe nada, pero el orden correcto es código → datos).
- **El write del admin valida contra `DOCTOR_TIERS`** (requisito duro ya existente, §7 v1).
  El modal se adapta solo: deriva la lista de exclusiones de `TIER_EXCLUDED_KEYS`; hay que
  agregarle la fila de cupos desde `TIER_LIMITS`.

### 3.4 Elegibilidad a préstamos

No es una key: es `tier === 'PRO' || 'LAB'` leído por el admin de préstamos
(`apps/admin/src/app/loans/`). Fuera de este plan; se anota para que nadie lo modele como gate.

### 3.5 WhatsApp automático a pacientes (PRO) — key `whatsapp`

**Decisión del usuario (2026-09-12):** PRO incluye notificaciones y mensajes automáticos por
WhatsApp a pacientes (confirmación de cita, recordatorios, envío de información) y, más
adelante, **un agente detrás** del número (el paciente le escribe y le contesta). **Bloqueado
hoy por Meta:** la cuenta de Tech Provider sigue en aprobación (`../AGENTES/AGENTE WHATSAPP/`,
`../CANALES`-memoria). Nada de esto se construye en este plan; aquí solo se le deja el hueco:

- Es una función on/off ⇒ **key `whatsapp` de tier** (`TierKey`, igual que `ia`: no es toggle
  de member por ahora). Excluida en FREE y BÁSICO.
- Sus rutas futuras (webhook de Meta, envío de plantillas, conversación) se anotan con
  `feature: 'whatsapp'`; el webhook es **público** ⇒ cae en el tercer sitio de enforcement
  (`doctorTierAllows`, G3 del diseño v1) — igual que `fiscal-form`.
- El agente de WhatsApp, cuando exista, es un **canal** del mismo asistente (misma regla 0,
  mismo tool layer, política de identidad de `../AGENTES/AGENTE ELEVENLABS/00` §5). Su
  interruptor de tier es `whatsapp`, no `asistente_ia`: un PRO lo tiene aunque no tenga el
  panel 🟢.
- **Costo por conversación** (Meta cobra por ventana de 24 h iniciada por el negocio) ⇒ es el
  primer candidato natural a **extra medido** (§3.6).

### 3.6 Precio base + extras por uso (PRO y LAB)

**Decisión del usuario (2026-09-12):** además del precio mensual, PRO y LAB pueden necesitar
**créditos adicionales** que se cobren por uso (más LLM, más conversaciones de WhatsApp, más
almacenamiento, etc.). Diseño mínimo para que el plan de tiers no lo estorbe después:

| Recurso medido | Ya se mide | Ya se acota | Qué falta |
|---|---|---|---|
| LLM (asistente) | `llm_token_usage.budgetTokens` por doctor, con precio en `/llm-usage` | cap **semanal 2M** budget tokens, único para todos (`agenda-agent/route.ts`) | que el cap salga de `TIER_LIMITS[tier].llmBudget` + **créditos extra** por cuenta |
| LLM (flujos sueltos: dictado, chats) | sí, por endpoint y `surface` | **no** (solo el asistente tiene cap) | decidir si los flujos de PRO entran al mismo cap o van sin tope |
| Whisper (minutos) | sí, `durationSeconds` | no | igual |
| WhatsApp (conversaciones) | — (no existe) | — | contador por doctor cuando exista |
| Almacenamiento | Q4 de este plan | Q4 | overage = créditos de GB extra |

**Modelo propuesto (no se construye aquí):**

1. **`TIER_LIMITS` gana la dimensión de consumo** (p. ej. `llmBudgetWeekly`, `whatsappConversations`).
   El tope base es del tier; **los créditos extra viven en la cuenta** (`Doctor.extraCredits`
   o tabla `account_credits` con vigencia), y el tope efectivo = base + extra. Los créditos los
   asigna el **admin** (igual que el tier); no hay billing self-serve (no-meta vigente).
2. **Un solo punto de imposición por recurso** — el que ya existe para el asistente es la
   plantilla: comprobación server-side antes de gastar, respuesta tipada al topar, y **UI que
   dice cuánto queda** (la `BudgetBar` del panel ya lo hace para el LLM).
3. **Precio en pesos de un crédito ≠ costo en dólares del proveedor**: las cuatro trampas de
   `../AGENTES/INVENTARIO IA/02-COSTO-y-uso-por-doctor.md` §3 aplican tal cual (no se puede
   poner precio a un total de tokens; el asistente se cobra por `budgetTokens`; Whisper por
   minuto). El crédito se define en la unidad que ya se mide por recurso, no en "tokens".
4. **Primero medir, luego poner precio.** El dato que decide el tamaño del cap base de PRO y
   el precio del crédito es el uso real por doctor, que **no existe todavía** (todo es
   dr-prueba). Q5 (LAB con dos cuentas reales) es lo que lo produce. Por eso el modelo de
   créditos se **diseña** aquí y se **construye** después de Q6.

## 4. Enforcement — dónde muerde cada cosa (resumen)

| Qué | Server (frontera) | Cliente (cortesía) |
|---|---|---|
| Funciones (facturación, SAT, IA) | 2 choke points vía `tierRouteDecision` + `feature` (§3.1); público/cron via `doctorTierAllows` | candado en Sidebar/Drawer + pantalla de plan (existente); botones sueltos ocultos o con candado (§9.2) |
| Asistente (LAB) | ya: `agenda-agent` → `asistente_ia`; `resolveAgentScope` | las 3 puertas del panel condicionadas a `can('asistente_ia')`, se retira el flag (§5) |
| Pacientes | `assertPatientQuota` en 2 write paths | contador "n / 50" en la lista de pacientes + mensaje al topar |
| Archivos | `assertStorageQuota` en la middleware de subida (14 rutas) | medidor "usado / tope" en Perfil/plan + mensaje al topar |

## 5. LAB = un interruptor, no una feature nueva

LAB en este plan es **solo** "el único tier que no excluye `asistente_ia`". Todo lo que ya existe
(panel 🟢, 5 módulos, 38 tools, evals, budget) queda detrás. Lo que se hace aquí:

1. Retirar `ASISTENTE_IA_VISIBLE`; las 3 puertas leen `can('asistente_ia')` (que ya respeta
   tier ∩ toggle).
2. **Ocultar, no candado**, para `asistente_ia` en PRO: la pestaña verde del borde no es un item
   de sidebar y anunciar con candado un laboratorio a los PRO es ruido. Anotar la excepción junto
   a `lockedByTier`.
3. dr-prueba y la cuenta del usuario a LAB. **Eso produce por fin el dato que falta**: uso real
   por doctor en `/llm-usage` (hueco #1 de `../AGENTES/OPTIMIZACION COSTOS/`).
4. El desarrollo de la línea Jarvis (navegación, voz, plantillas) **NO empieza hasta cerrar §6**.
   Se documenta en `../AGENTES/` cuando toque.

## 6. Secuencia de PRs

Cada PR: `pnpm type-check` (api con `NODE_OPTIONS=--max-old-space-size=6144`) + `pnpm gates` +
smoke read-only de cualquier query nueva + **prueba en vivo con dr-prueba en el tier que se
está probando, verificando en la BD que de verdad está en ese tier** (README, runbook B).
Todo cambio que toque el agente ⇒ suite de evals.

| PR | Qué | NO-OP en deploy | Riesgo |
|---|---|---|---|
| **Q1 — vocabulario** ✅ | `DOCTOR_TIERS`×4, `TierKey`, `DEFAULT_TIER`/`FALLBACK_TIER` separados, `TIER_EXCLUDED_KEYS` nuevos, `TIER_LIMITS` (solo declarado), labels; SQL de migración de filas | ✅ (12 → PRO; **PRO no excluye NADA en Q1** — `asistente_ia` se movió a Q5, ver §8) | bajo; el orden código→SQL es seguro en ambos sentidos (fail-open simétrico), código primero acorta la ventana de chips rojos |
| **Q2 — key `ia`** | campo `feature` en el route map, `nearestFeatureKey` lo honra, 11 prefijos + 3 rutas de informe/summary anotadas, gate de cobertura extendido, `can('ia')` en las ~20 puertas del cliente (política de §9.2) | ✅ mientras todos sean PRO | medio: **la lista de puertas es la parte que se escapa** (lección de T4 §13.4.1: dos greps, desktop Y móvil) |
| **Q3 — cupo de pacientes** | `assertPatientQuota` en los 2 caminos, error tipado, contador en UI, columna en admin | ✅ (PRO = sin tope) | bajo |
| **Q4 — cupo de archivos** | `fileSize` en las 14 rutas, `assertStorageQuota` en middleware, `storageUsedBytes`, backfill, medidor en UI, columna en admin. Helpers agnósticos de proveedor (§3.2.4) | ✅ (PRO = 50 GB, uso real ~0.2 GB) | medio: 14 rutas en 3 apps; backfill con reporte de lo no medible |
| **Q5 — LAB** | **agregar `asistente_ia` a `TIER_EXCLUDED_KEYS` de FREE/BÁSICO/PRO** (heredado de Q1, §8), retirar el flag, puertas del panel por `can('asistente_ia')`, excepción ocultar-no-candado, dr-prueba + usuario a LAB | ❌ **prende el panel para LAB** (2 cuentas) y **cierra `/api/agenda-agent` con 403 para el resto** | bajo en código; alto en producto (por eso va al final) |
| **Q6 — caza de bugs por tier** | Runbooks A/B/C por tier con dr-prueba en FREE, BÁSICO, PRO (rutas + UI desktop + móvil + agente); herencia de T6 (fuga read-only en reportes; residuo #28) | — | es la "pasada de bugs" que el usuario pidió ANTES del LAB |

Q3 y Q4 son independientes de Q2 y entre sí; Q5 depende de Q1. Q6 cierra.

## 7. Cosas ya documentadas que este plan HEREDA (no re-descubrir)

- **`BottomNav` sin candado** (`01-DISENO` §13.4.1): sus 4 tabs siguen incluidos en FREE, así que
  la condición que lo activa **no se dispara**. Sigue latente.
- **Fuga de member preexistente** (`01-DISENO` §11.6): `pagos` OFF sigue recibiendo tools de pago
  en el módulo `facturas`. Ajena al tier; `TOOL_FEATURE_KEY` ya da la pieza.
- **Residuo #28** (~50%: el agente redirige a Conciliación en un tier que no la tiene) y la
  **auditoría de fuga read-only** en reportes/analytics — lo que T6 siempre fue. Van en Q6.
- **`NEXT_PUBLIC_SALES_EMAIL`** en Railway + redeploy: sin ella la pantalla de plan no ofrece
  botón de contacto. **Acción de usuario, confirmada NO hecha al 2026-07-27** — preguntar.
- **UploadThing:** el plan gratuito puede cerrar la puerta a archivos privados
  (`../IMAGE MIGRATION/02-PLAN` §0). Los cupos de Q4 no dependen de esa decisión, pero el seam
  compartido sí conviene definirlo antes de escribir la middleware dos veces.

## 8. As-built (se llena al terminar cada PR)

### Q1 — vocabulario (2026-09-12)

**Decisiones del usuario que lo destrabaron:** nombres = los placeholders (`FREE` · `BASICO` ·
`PRO` · `LAB`, guardados tal cual; el nombre comercial vive en `TIER_LABELS` y sí puede cambiar);
`conciliacion` excluida en FREE/BÁSICO y el flag de ocultamiento sin tocar; fail-open a **PRO**.
LAB por invitación vs de pago sigue abierto — no toca código.

**Lo construido** (`packages/database/src/permissions.ts` es la fuente): `DOCTOR_TIERS` × 4 ·
`TIER_LABELS` · `DEFAULT_TIER='FREE'` (columna) **separado de** `FALLBACK_TIER='PRO'` (fail-open;
`tierAllows`, `membership.ts` ×4, `medical-auth.ts`, `permissions-client.ts` y el admin lo usan) ·
`TierKey = PermissionKey | 'ia' | 'whatsapp'` + `TIER_KEY_LABELS` · `TIER_LIMITS` declarado
(500 MB/50 pacientes · 15 GB · 50 GB · 50 GB) · el admin pinta un color por tier (mapa tipado,
`TIER_CHIP_STYLE`) y una línea de cupos en el modal · `rename-tiers-to-four.sql`.

**Dos correcciones al plan, encontradas al revisar contra el código antes de escribir:**

1. **`ia`/`whatsapp` NO entran a `TIER_EXCLUDED_KEYS` en Q1.** `gate:routes`
   (`check-route-permission-coverage.ts:93-112`) exige que toda key excluida resuelva a ≥1 ruta, y
   ninguna ruta resuelve a esas dos hasta que Q2 agregue el campo `feature`. El tipo `TierKey` ya
   existe; las listas las ganan en Q2 junto con sus rutas.
2. **`asistente_ia` tampoco — se mueve a Q5.** Excluirlo no toca la composición del agente
   (`resolveAgentScope` lo ignora: es el interruptor maestro, no está en
   `AGENT_MODULE_REQUIREMENTS`); lo que hace es que el choke point devuelva **403
   `TIER_EXCLUDED` en `/api/agenda-agent`** para toda cuenta que no sea LAB. Con las 12 cuentas en
   PRO eso apagaba la ruta para todos — invisible solo porque `ASISTENTE_IA_VISIBLE=false` tapa el
   panel, pero alcanzable por llamada directa (que es como se prueba el agente hoy). Va en Q5, junto
   con las puertas `can('asistente_ia')` y el paso de dr-prueba + usuario a LAB. **Consecuencia:
   en Q1 PRO y LAB son idénticos** (`[]`) y el modal del admin los muestra iguales; es cierto y es
   temporal.

**Y una corrección a una suposición mía que habría borrado un tripwire:** creí que "ningún tier
con asistente excluye nada" dejaba sin sujeto a los 13 evals `tier-core-*` y a los ~25 asserts de
`gate:prompt`, y propuse retirarlos. Falso: para el agente **FREE tiene exactamente la forma de
CORE** (excluye facturacion/sat/conciliacion; las tres que CORE también quitaba —ventas, compras,
productos— nunca fueron keys del agente). Los 13 casos corren ahora con `tier: 'FREE'` sin cambiar
un check, conservan sus ids (los citan las bitácoras y los cuenta `gate:evals=65`), y el tripwire
de la bitácora #28 sigue vivo. Lección para el repo: *el techo del tier tiene DOS efectos
distintos —recortar la composición del agente y cerrar rutas— y la key `asistente_ia` solo hace el
segundo.*

**Verificación:** `pnpm gates` **76 OK / 0 FAIL** con los cuatro tiers en el loop de
`gate:prompt` y `gate:prosa`; `gate:routes` reporta `facturacion, sat, conciliacion` con
cobertura. Pre-flight read-only en prod: **12 filas `FULL`** (no 11: entró un doctor desde julio),
ninguna `CORE`, **cero CHECK constraints** en `doctors` ⇒ el `UPDATE` no puede fallar.

**Code review (`/code-review high`, 10 hallazgos, 0 refutados) — lo que cambió por él:**

| # | Hallazgo | Qué se hizo |
|---|---|---|
| 1 | **BASICO `['conciliacion']` daba al dueño BÁSICO la prosa `FLUJO_RULES_PARTIAL`** (escrita para una cuenta SIN fiscal — le dice al modelo que no estime IVA "si no tienes la tool", y BÁSICO sí la tiene). Ningún eval ni assert corre con BASICO. Medido: 36/37 tools, prompt MÁS largo que el completo | **Entrada diferida** (`BASICO: []`). La decisión §9.3 se mantiene; entra cuando BASICO tenga sus asserts en `gate:prompt` y evals propios (→ Q6 o un Q1.5). Consecuencia: en Q1 **FREE es la única forma con recorte** |
| 2 | El SQL solo mapeaba `FULL→PRO`: un `CORE` escrito en la ventana quedaría desconocido ⇒ PRO ⇒ **ascendido en silencio** | `UPDATE … 'FREE' WHERE tier='CORE'` + la lectura de vuelta es una ASERCIÓN (`NOT IN` los cuatro = 0), a repetir tras verificar cada servicio |
| 3 | **Yo tenía invertido quién decide el tier de una cuenta nueva.** El cliente Prisma lleva el `@default` del schema DENTRO y lo mete él en el INSERT (medido en el cliente generado: `"default":"FULL"`); el DEFAULT de la columna solo aplica a inserts crudos. `DEFAULT_TIER` no tenía ningún lector | `POST /api/doctors` pasa `tier: DEFAULT_TIER` explícito; los tres comentarios reescritos. El `ALTER DEFAULT` se queda por coherencia |
| 4 | `tierAllows('constructor')` reventaba en `.includes` (clave heredada de `Object.prototype` pasa el `??`) ⇒ 500 en cada request, no fail-open | `Object.hasOwn` |
| 5 | `doctorTierAllows` devolvía `true` pelado en el catch — un tercer significado de "fail-open"; además **no tiene llamadores** y 01-DISENO §G3 dice que `fiscal-form` lo usa — falso, llama `tierAllows` directo | catch ⇒ `tierAllows(null, key)`. La afirmación de 01-DISENO queda corregida aquí (no se reescribe el doc congelado) |
| 6 | Mi assert nuevo comparaba scopes por `===` y hardcodeaba `'PRO'`: pasaba solo porque ambos caen en el singleton | Importa `FALLBACK_TIER`, compara módulos/tools/parciales por nombre |
| 7 | Cuenta nueva nace FREE **sin aviso en el alta del admin**; `/producto` sigue vendiendo FULL/CORE (`product-content.ts:10-14` lo advierte) | **Seguimiento, no en Q1:** nota en el formulario de alta (Q3, junto con el contador de pacientes) y la copia pública (Q6). Anotado en §9 |
| 8 | Comentarios `FULL` obsoletos en `api/auth.ts`, `medical-auth.ts`, `membership.ts`, `registry.ts:162` ("unknown ⇒ fast path", ya semánticamente falso) | Reescritos |
| 9 | `02-CAPACIDADES` (doc de referencia que 08-EMPIEZA-AQUI exige al día) decía `tier: 'CORE'` en presente; la cabecera del SESSION-REFRESCO de agenda no se tocó (§8: la cabecera va PRIMERO) | Ambos actualizados |
| 10 | El script de pre-flight no estaba gitignoreado | `packages/database/tmp-*.ts` en `.gitignore`; se borra tras la lectura de vuelta |

Descartados por el propio review (4): endurecer `EvalCase.tier` a la unión, reusar `fmtStorage`,
una nota de diseño sobre `TierKey` a medias, un comentario en español en un archivo en inglés.

**Corrida real (2026-09-13).** Commit **`2779b2e6`**, pusheado. `api` · `doctor` · `admin` los tres
en ese hash con deploy **SUCCESS**; `@healthcare/public` se quedó en `6aba1f33` y **es correcto**:
el commit no toca sus `watchPatterns` y no lee `tier` en runtime (su copia de `/producto` sigue
describiendo FULL/CORE — eso es el hallazgo 7, va a Q6). Con los tres servicios verificados se
aplicó el SQL (`prisma db execute --url`) y se leyó de vuelta:

| | antes | después |
|---|---|---|
| filas por tier | `FULL` × 12 | **`PRO` × 12** |
| aserción `tier NOT IN` los cuatro | 12 | **0** |
| default de columna | `'FULL'::text` | **`'FREE'::text`** |

⚠️ **El re-review de los arreglos NO se corrió** — el usuario lo detuvo, y en su lugar se **EJECUTÓ**
el único arreglo en el camino caliente: `tierAllows` contra 17 entradas —`constructor` · `toString`
· `__proto__` (que antes reventaban en `.includes` ⇒ 500 en cada request), `FULL` · `CORE` ·
`ENTERPRISE` · `null` · `undefined` · `free` (⇒ PRO), y las cuatro formas canónicas— **17/17 OK,
cero throws**. Los otros tres arreglos se leyeron hunk por hunk. Ejecutar el arreglo vale MÁS que
una segunda lectura (la lección de `turnoEncolado`), pero no cubre el resto del diff: si algo de Q1
muerde, el sospechoso #1 es lo que no se ejecutó.

**Lo único que falta de Q1:** el **runbook A** en el admin — 12 chips azules `Pro`, y el modal con
los cuatro planes (etiqueta + código + cupos). Son ojos humanos, no código.

## 8.1 🔄 Handoff — cierre de sesión 2026-09-12

- **Estado:** **Q1 construido** (as-built en §8), a la espera de type-check + OK al diff + push +
  SQL. Sigue habiendo cambios ajenos en el working tree (informe BBVA, `scripts/demo-seed/`,
  `ANALISIS CAT/`) — no son de este plan, no mezclarlos en su commit.
- **Siguiente paso:** cerrar Q1 (los pendientes listados al final de §8). Después **Q2** (key `ia`
  + campo `feature`) o **Q3/Q4** (cupos) — son independientes entre sí; §9.2 (candado vs ocultar el
  micrófono) bloquea la parte de cliente de Q2, no la de servidor.
- **§9 contestado el 2026-09-12:** 1 (placeholders como nombres), 3 (conciliación excluida) y 4
  (fail-open PRO). Quedan 2, 5, 6 y 7.
- **Contexto de la sesión** (por si se pierde): la visión "Jarvis" (hablarle al app, que navegue
  y llene plantillas) se analizó contra el código: el asistente unificado ya existe pero está
  oculto, tiene **cero escrituras en expediente** (privacidad v1 = solo metadatos), y la
  navegación + prellenado ya tiene un cable en el voice hub (`sessionStorage` + `?voice=true`).
  La conclusión fue un **híbrido**: el asistente navega y orquesta, los flujos de extracción
  siguen aparte. Todo eso es trabajo de LAB y se documentará en `../AGENTES/` cuando toque —
  **después** de Q6. El costo por turno está medido y es confiable; el uso por doctor real, no.
- **Acción de usuario pendiente desde julio:** `NEXT_PUBLIC_SALES_EMAIL` en Railway + redeploy.

## 9. Decisiones que bloquean (no inventar)

1. **Nombres definitivos** de los cuatro tiers (aquí FREE/BASICO/PRO/LAB como placeholders) y
   si LAB es por invitación o un plan de pago.
2. **"Sin IA" en FREE/BÁSICO, ¿oculta o muestra con candado** el micrófono/dictado? Hoy la
   transcripción de voz en notas es **la función de IA más usada** (`../AGENTES/INVENTARIO IA/02`).
   Mostrarla bloqueada es el mejor upsell del producto; ocultarla es la política vigente de T4
   para botones sueltos. Recomendación: **candado con CTA solo en el hub de voz y el micrófono de
   notas** (2 puertas, las más visibles); el resto oculto.
3. **`conciliacion`:** ¿excluida en FREE/BÁSICO (como CORE) o queda fuera del vocabulario de
   tiers porque está oculta para todos? Recomendación: excluirla en FREE/BÁSICO y no tocar el flag.
4. **Fail-open a PRO** (propuesto) vs a LAB (como hoy, FULL). Recomendación: PRO.
5. **¿Existe alta self-service?** Un tier FREE solo tiene sentido si un doctor puede crearse la
   cuenta solo. Hoy las cuentas las crea el admin. Si sigue así, FREE es "el admin da de alta en
   FREE" y el default de columna importa menos; si se abre el registro, es OTRO proyecto (y
   el primero que necesita el cupo de pacientes de verdad).
6. **Créditos extra (§3.6):** ¿los flujos de IA de PRO (dictado, chats) entran al mismo cap que
   el asistente o van sin tope? Y ¿los créditos vencen? Recomendación: un solo cap por cuenta
   para TODO el LLM (hoy el dictado no tiene tope y es lo más usado), créditos con vigencia
   mensual.
7. **Por encima del tope tras downgrade:** confirmar la política "ver y borrar sí, subir/crear
   no" (§3.2). Alternativa: periodo de gracia. Recomendación: sin gracia, con mensaje claro.
8. *(nuevo, review de Q1)* **El alta nace en FREE sin aviso.** Desde Q1 toda cuenta nueva es FREE
   (sin factura/SAT) hasta que el admin la sube en `/doctors`; el formulario de alta no lo dice.
   ¿Selector de plan en el alta, o una nota "nace en FREE, súbela desde /doctors"? Recomendación:
   la nota, en Q3 (que ya toca el admin). Y `/producto` sigue describiendo FULL/CORE → Q6.

---

*Relacionado: [`01-DISENO-tecnico.md`](01-DISENO-tecnico.md) (la arquitectura que se reusa) ·
[`../IMAGE MIGRATION/02-PLAN-migracion-a-r2.md`](../IMAGE%20MIGRATION/02-PLAN-migracion-a-r2.md)
(el seam de almacenamiento que comparte los cupos) ·
[`../AGENTES/INVENTARIO IA/01-INVENTARIO-donde-vive-cada-chat.md`](../AGENTES/INVENTARIO%20IA/01-INVENTARIO-donde-vive-cada-chat.md)
(las 19 superficies que la key `ia` tiene que cubrir) ·
[`../NUEVOS USUARIOS/`](../NUEVOS%20USUARIOS/) (por qué los flujos de IA son OWNER_ONLY para members).*
