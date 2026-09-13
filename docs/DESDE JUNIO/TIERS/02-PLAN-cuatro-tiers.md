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

Los **12** prefijos de IA están en el route map con key **`OWNER_ONLY`**
(`route-permissions.ts:142-153`: **`appointments-chat`**, `encounter-chat`, `patient-chat`,
`prescription-chat`, `sale-chat`, `purchase-chat`, `quotation-chat`, `task-chat`, `ledger-chat`,
`form-builder-chat`, `voice`, `llm-assistant`).

> ⚠️ **`appointments-chat` faltaba en esta lista** (decía 11; son 12). Se encontró el 2026-09-13 al
> arrancar Q2, comparando el mapa contra `ls` de los directorios de rutas y contra un grep de
> quién importa un cliente LLM. Es un `gpt-4o` real (`appointments-chat/route.ts:22`). **Cómo se
> escapó:** la lista se escribió leyendo el route map por el bloque comentado "Legacy AI surfaces",
> y `appointments-chat` vive UNA línea más arriba, fuera del bloque. Método que sí cierra la lista:
> cruzar TRES fuentes — el route map, `ls` de `app/api/`, y un grep de importaciones de LLM — y
> ojo con que el grep de `route.ts` **subcuenta**: `llm-assistant` y `agenda-agent` llaman al
> modelo desde `lib/`, no desde su `route.ts`. `nearestFeatureKey` **salta a propósito** las reglas `OWNER_ONLY`/
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
| **`appointments-chat`** · `encounter-chat` · `patient-chat` · `prescription-chat` · `sale-chat` · `purchase-chat` · `quotation-chat` · `task-chat` · `ledger-chat` · `form-builder-chat` · `voice` · `llm-assistant` | OWNER_ONLY |
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
| **Q4 — cupo de archivos** | ~~14 rutas~~ **17 keys en 33 definiciones**, `assertStorageQuota` en middleware, tabla `StoredFile`, ~~backfill~~ **sin backfill (decisión del usuario)**, ~~medidor~~ **el medidor NO se construyó**. Helpers agnósticos de proveedor (§3.2.4) | ✅ (PRO = 50 GB, uso real **489.5 MB**, no ~0.2 GB — ver la medición de §8.2) | medio: 33 definiciones en 3 apps |
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

**Runbook A — ✅ EJECUTADO por el usuario (2026-09-13):** reportó que el admin *"works as
expected"*. Con eso **Q1 queda CERRADO**. (Lo verificó él, no yo: la ruta del navegador no estaba
disponible —la extensión de Chrome no conecta, con toda probabilidad por la misma razón que el
dictado por voz: esta sesión se autentica con `ANTHROPIC_API_KEY` y esas dos funciones se emparejan
con una cuenta de claude.ai. Si una sesión futura necesita manejar el navegador, ese es el
prerrequisito.)

**Runbook B — ✅ EJECUTADO por el usuario (2026-09-13), "all as expected":** dr-prueba a FREE desde
el modal del admin, candado + pantalla de plan en Facturación y Descarga SAT, Flujo intacto, y
**Ventas · Compras · Productos siguen disponibles** — la diferencia deliberada con el viejo CORE.
Con eso la cadena completa (route map → choke point → 403 → candado → upsell) queda observada en
vivo, no solo en verde.

> 🔎 **Estado de tiers tras la prueba — A PROPÓSITO, no lo "arregles":** la verificación en BD
> encontró **dr-prueba en `FREE`** y **dr-quebradita en `BASICO`**; el usuario decidió (2026-09-13)
> **dejarlas así**. dr-prueba en FREE es justamente el banco de pruebas que Q2 necesita (una cuenta
> real con recorte para probar el gating de IA). Las otras 10 siguen en `PRO`.
>
> Y la lección del método, que aplica a cualquier runbook de downgrade: **leer el estado de la BD
> DESPUÉS de la prueba, no solo antes**. Es barato y es la única forma de distinguir "se revirtió"
> de "se nos olvidó" — aquí resultó ser intencional, pero eso no se sabía hasta mirarlo.

### Q2a — el campo `feature` en el route map (2026-09-13)

**La mitad de servidor de Q2, deliberadamente NO-OP.** Se partió Q2 en dos al ver el inventario
real de puertas de cliente (26, no ~20): Q2a enseña al mapa de rutas a resolver `ia`, y **Q2b** es
el que muerde (meter `ia` en `TIER_EXCLUDED_KEYS` + las puertas del cliente). Misma disciplina que
Q1: lo que se despliega hoy no le cambia la conducta a nadie.

| Qué | Dónde |
|---|---|
| `RouteRule` gana `feature?: TierKey` — la lee SOLO `nearestFeatureKey`; `checkRoutePermission` la ignora, así que anotar una ruta no cambia quién entra hoy | `route-permissions.ts` |
| `nearestFeatureKey` resuelve `rule.feature ?? rule.key` y devuelve `TierKey \| null`; se salta la regla solo si lo RESUELTO es `NEUTRAL`/`OWNER_ONLY` — una regla OWNER_ONLY **con** `feature` ya cuenta | idem |
| Las **12** rutas de IA anotadas con `feature: 'ia'` | idem |
| **3 reglas nuevas** para la IA que vive dentro del expediente (`…/summary`, `…/reports/*/dictar`, `…/reports/*/chat`) con `key: 'expedientes'` (lo que ya heredaban) + `feature: 'ia'` | idem |
| `tierRouteDecision` devuelve `featureKey: TierKey \| null` | idem |
| El 403 del doctor-app ahora **lleva la key**: `medical-auth` la adjunta al error y `api-error-handler` la mete en el body | `medical-auth.ts`, `api-error-handler.ts` |
| Nota en `transcribir-audio.ts`: el gate por prefijo **no puede verlo** | `lib/voice/transcribir-audio.ts` |

**Verificación**, toda leída del LOG y no del código de salida (ver la trampa de método abajo):
`pnpm type-check` **5/5** en la segunda corrida —falló a la primera— y con **3 cache misses**, así
que `doctor`, `admin` y `api` se revisaron de verdad, no se replicaron de caché · `pnpm gates`
**76 OK / 0 FAIL** (el mapa pasó de 69 a 72 reglas) · y **33/33 comprobaciones EJECUTADAS contra el
árbol final**, que es lo que de verdad prueba el cambio:

- las 12 rutas de IA y las 3 del expediente resuelven a `'ia'` (incluido el comodín en medio:
  `…/patients/*/reports/*/chat`);
- **no se movió nada más**: `facturacion/csd`→`facturacion`, `sat-descarga/fiel`→`sat`,
  `agenda-agent`→`asistente_ia` (es de Q5), `bank-statement-parse`→`conciliacion`,
  `…/reports/*` (el padre, que NO llama a ningún LLM)→`expedientes`, `team`→`null`;
- **el check de MEMBER es idéntico**: `…/summary` sigue dando `toggle_on` con `expedientes` y
  `toggle_off` sin él; `encounter-chat` sigue siendo `owner_only`;
- **la prueba de que es NO-OP**: `tierRouteDecision('/api/encounter-chat','POST','FREE').blocked`
  = **false**, mientras que la misma llamada con `/api/facturacion` sí da `true` y su `featureKey`
  viaja. `gate:routes` NO puede verificar la cobertura de `ia` todavía (solo mira las keys que
  algún tier excluye, y ninguna lo hace aún) — por eso se probó ejecutando, no confiando en el gate.

**Tres correcciones al inventario, encontradas verificando en vez de asumir:**

1. **`appointments-chat` faltaba** en la lista cerrada del plan (eran 12, no 11) — ver §3.1.
2. El barrido de puertas **afirmó dos cosas falsas** que se cayeron al leer el código: que
   `bank-statement-parse` "no tiene regla propia" (sí la tiene, `route-permissions.ts:131`, key
   `conciliacion`) y que `…/reports/*` importa un LLM (no importa ninguno: cero coincidencias).
   Las tres rutas heredadas están completas. *Lección: un inventario de agente es una hipótesis
   sobre el código, no el código.*
3. **`transcribir-audio.ts` es un hueco REAL pero hoy VACÍO**: transcribe sin pasar por
   `/api/voice/*`, así que un gate por prefijo no lo ve — pero sus únicos dos llamadores son las
   dos rutas del informe, ya anotadas. Queda la nota en el archivo para el próximo que lo llame.

🔴 **La lección barata que casi se anota como cara: un `*/` dentro de un comentario de BLOQUE.**
La nota que se agregó a `transcribir-audio.ts` citaba la ruta `…/reports/` + `*` + `/dictar`. Ese
`*/` **cierra el JSDoc ahí mismo**, y el resto del comentario se parsea como código: 20+ errores de
sintaxis, `Tasks: 2 successful, 5 total`. En comentarios de bloque, cita las rutas con comodín como
`[reportId]`, no con `*`. (En comentarios de línea `//` no pasa nada — por eso el mismo texto en
`route-permissions.ts` está bien.)

⚠️ **Y la trampa de MÉTODO que lo hizo casi invisible:** el comando era
`pnpm type-check > log 2>&1; echo "exit=$?" >> log`. El `echo` final **siempre** sale 0, así que la
notificación de la tarea en segundo plano dijo **"exit code 0"** mientras el fallo real (`exit=2`)
vivía DENTRO del log. Estuve a un paso de escribir "type-check 5/5" en este doc apoyándome en esa
notificación. **El código de salida de una tarea encadenada no es el del comando que te importa:
lee el log, siempre.**

⚠️ **Deuda anotada, no arreglada:** en `apps/api` el `AuthError` de tier **sí** carga la key
(`lib/auth.ts:31`) pero **ningún handler la devuelve** — todos hacen
`NextResponse.json({ error: error.message })`, así que se pierde. Hoy no muerde (T4 deduce la key
del PATH en el cliente, y casi toda la IA vive en `apps/doctor`), pero significa que esa línea de
`apps/api` es decorativa. Arreglarlo toca cada handler; no entra en Q2a.

**Lo que falta para Q2b** (y su prerrequisito duro): `ia` a `TIER_EXCLUDED_KEYS` de FREE/BÁSICO ·
`can`/`lockedByTier` a `TierKey` · un componente de control bloqueado NUEVO (el candado del
sidebar **no se puede reusar**: funciona porque un item de nav es un `Link` a una página que
renderiza `TierUpgradeNotice`, y un micrófono no tiene destino) · candado en 3 archivos (el FAB del
hub + los DOS editores de notas) · ocultar las otras ~23 puertas, de las cuales **~12 no comprueban
nada hoy** (las 3 del informe, los 3 disparadores de "Generar Resumen", y los tiles del modal del
hub, que además se saltan por deep-link `?chat=true`). 🔴 **Prerrequisito:
`NEXT_PUBLIC_SALES_EMAIL` en Railway + redeploy** (verificado el 2026-09-13: NO está puesta): sin
ella `TierUpgradeNotice` omite el CTA y un micrófono con candado no ofrece salida — peor que
ocultarlo.

🔴 **Segundo prerrequisito de Q2b, descubierto al desplegar Q2a: hay que FORZAR el deploy de
`api` y `admin`.** El commit de Q2a tocó `packages/database` + tres archivos de `apps/doctor`, y
**solo `@healthcare/doctor` se redesplegó**: `api` y `admin` se quedaron en el commit anterior con
sus marcas de tiempo intactas. Confirmado que no hay NINGÚN `railway.json`/`railway.toml` en el
repo (los `watchPatterns` viven solo en el dashboard) y que **`packages/**` no está en los de
nadie** — el mismo incidente que ya estaba anotado. Hoy da igual porque Q2a es NO-OP, pero en Q2b
muerde de verdad: un `api` con el bundle viejo de `@healthcare/database` **no sabría que FREE
excluye `ia`** (ni `TIER_EXCLUDED_KEYS` ni el campo `feature` viajarían), así que las dos apps
aplicarían el techo de forma distinta — el peor modo de fallo, porque *parece* que funciona.
**Antes de que Q2b muerda: `railway up` por servicio** (no `railway redeploy`, que reconstruye el
commit viejo) y verificar el `commitHash` de los tres.

### Q2a — code review (2026-09-13), 5 hallazgos · 4 arreglados

⚠️ **Primero, el error de método: el review se corrió DESPUÉS de commitear y pushear**, porque fui
directo de "gates en verde" a proponer el commit. Lo pidió el usuario (*"no code review??"*). La
regla del repo —lógica de frontera y contenido que afirma hechos SIEMPRE llevan review— aplicaba a
Q2a por partida doble. Salió barato solo porque Q2a es NO-OP: nada de lo hallado muerde hoy.

| # | Hallazgo | Arreglo |
|---|---|---|
| 1 | 🔴 **El GET de `…/summary` NO es IA**: solo el POST llama al modelo; el GET lee de Postgres (`summary/route.ts` :9-41). Anotar el prefijo entero le habría quitado a un FREE la **lectura de un resumen que ya es suyo** | `methods: ['POST']` en la regla. Es el patrón que este repo YA pagó en vivo dos veces (`facturacion/csd/status`, `sat-descarga/fiel`, 2026-07-21) |
| 2 | 🔴 **`feature ?? key` SUSTITUÍA la key**: las 3 rutas del expediente resolvían a `ia` en vez de `expedientes`, así que un plan que excluyera `expedientes` habría negado todo `/api/medical-records/*` **menos esas tres**. Una anotación cuyo contrato es "no cambia quién entra" **ampliaba** el acceso | `routeTierKeys()` devuelve las DOS keys y **se apilan**: bloquea si CUALQUIERA está excluida. `tierRouteDecision` reporta la que CAUSÓ el bloqueo, no la "bonita" |
| 3 | **Las 2 rutas de `llm-assistant` no usaban `handleApiError`**: `TIER_EXCLUDED` caía al 500 genérico ⇒ el cliente recibiría un crash en vez de la pantalla de plan. Y ya se tragaba `PERMISSION_BLOCKED` desde ANTES de TIERS (bug vivo, ajeno a esta feature) | Las dos delegan los dos marcadores a `handleApiError` |
| 4 | **`bank-statement-parse` parsea con LLM** y se dejó sin anotar porque ya resuelve a `conciliacion` — pero la exclusión de `conciliacion` en BÁSICO está DIFERIDA, así que un BÁSICO seguiría pagando parseo con modelo | `feature: 'ia'` (solo es seguro gracias al apilamiento del #2) |
| 5 | `gate:routes` no verifica las 15 anotaciones hasta que `ia` esté excluida — y es el mecanismo que habría cazado #1 y #2 | Sin arreglo: es estructural. Por eso se prueba EJECUTANDO |

**Verificación** (leída de los logs): `pnpm type-check` **5/5** con 3 cache misses · `pnpm gates`
**76 OK / 0 FAIL** · **26/26 comprobaciones EJECUTADAS**, que demuestran cada arreglo: `summary`
GET→`expedientes` y POST→`ia`; `keys` = `["ia","expedientes"]` en las tres del expediente;
`bank-statement-parse` bloqueado en FREE **reportando `conciliacion`** (la causa real, no `ia`); y
`ia` sigue sin morder en ningún tier.

🔎 **Lo que NO está probado ejecutando: el #3.** Se verificó LEYENDO las dos ramas de
`handleApiError` (`PERMISSION_BLOCKED` :34, `TIER_EXCLUDED` :44) y la delegación de tres líneas en
cada ruta. Probarlo de verdad necesita una petición HTTP real desde una cuenta con recorte ⇒ va al
runbook en vivo de Q2b. *Anotarlo es la diferencia entre "revisado" y "probado".*

🔴 **Y la misma trampa del `*/`, DOS veces en la misma sesión.** El comentario nuevo de
`routeTierKeys` volvió a citar una ruta con comodín dentro de un bloque `/** */` y volvió a partir
el archivo (type-check exit 2, gates exit 1). Saber la regla no la aplica: **después de escribir un
comentario de bloque, pásale `grep -n '^\s*\*.*\S\*/'`**. Los literales de string con `*` no
molestan; solo los comentarios.

### Q2b — el candado de IA, y el FLIP (2026-09-13)

**Q2b-1 y Q2b-2 se fusionaron en un solo commit** (decisión del usuario tras el review): partirlos
dejaba toda la UI del candado sin ejecutarse nunca hasta el flip, o sea que su **primera corrida
real habría sido en producción**. Con dr-prueba ya en `FREE`, fusionarlos hace que se pruebe de
inmediato.

| Qué | Dónde |
|---|---|
| `ia` entra a `TIER_EXCLUDED_KEYS` de **FREE y BÁSICO** — el flip | `permissions.ts` |
| `can`/`lockedByTier` aceptan `TierKey` (antes `PermissionKey`) | `permissions-client.ts` |
| `useAiLock()` + `<AiUpgradeDialog>` — el candado no reusa `TierUpgradeNotice` porque ése reemplaza la PÁGINA, y la IA son controles sueltos DENTRO de páginas que el plan sí incluye | `components/layout/AiUpgradeDialog.tsx` (nuevo) |
| **CANDADO (3 archivos)**: el FAB del hub de voz y los DOS botones «Dictar» | `VoiceAssistantHubWidget`, `NoteEditor`, `PatientNoteEditor` |
| **OCULTAR (~23 puertas)**: 6 tarjetas del dashboard, 5 páginas `*/new` + sus hooks (incluidos los `?chat=true`), FormBuilder, ChatWidget, los tiles del modal del hub, las 3 del informe, los 3 disparadores de resumen | 14 archivos |
| El PDF de conciliación se bloquea **DENTRO del modal**, no en el botón | `StatementUploadModal` |

🔎 **`whatsapp` sigue FUERA de las listas**: no existe ninguna ruta suya, y `gate:routes` —que
ahora sí verifica `ia`— fallaría.

**Los 7 hallazgos del review (corrido ANTES del commit esta vez) y sus arreglos:**

| # | Hallazgo | Arreglo |
|---|---|---|
| 1 | 🔴 **Todas las puertas fallaban ABIERTAS mientras carga la sesión.** `permissions-client` hace fail-open (`isOwner ?? true`, `tier ?? PRO`), así que en esa ventana `can('ia')` era **true**: en FREE el micrófono se pintaba encendido, el doctor apretaba, **el navegador abría el micrófono y grababa de verdad** — y el 403 llegaba al soltar. `useAiLock` devolvía `loading` y nadie lo usaba | `!loading` en `useAiLock` **y** `!permsLoading` en las ~14 puertas que llaman `can('ia')` directo |
| 2 | `pdfBloqueado` era estado DERIVADO guardado: no se re-evaluaba si la sesión resolvía después de elegir el archivo ⇒ «Subir y Procesar» mandaba el PDF a un 403 | Derivado: `!aiAllowed && fileType === 'pdf'` |
| 3 | El diálogo de upsell podía pintarse **sin CTA** (env var ausente ⇒ `href` null): un callejón sin salida | Fallback fijo `hola@tusalud.pro`, el mismo patrón que ya usa `apps/public/src/lib/product-content.ts` |
| 4 | Con Q2b partido, **toda la UI del candado era inalcanzable** y se estrenaría en prod | Se fusionó el flip en este commit (arriba) |
| 5 | 🔴 **`PanelFuentes` afirmaba algo falso.** Meter `aiAllowed` dentro de `hayAsistente` mandaba al panel a su rama de "todavía no lo generas", que promete «el asistente podrá usarlo en cuanto lo generes» — a alguien que YA lo generó y nunca tendrá asistente. El doc del prop enumera EXACTAMENTE dos estados; le agregué un tercero sin decirlo | Prop nuevo `sinIaEnElPlan` + una tercera rama de copia. `hayAsistente` recupera su significado |
| 6 | Un 403 de tier se le mostraba al doctor como **«No se pudo transcribir el audio»**: `api-error-handler` devuelve `error` como STRING, así que `data.error?.message` era undefined | Mensaje propio para `TIER_EXCLUDED` en los dos hooks de notas |
| 7 | `ChatWidget` tenía un `return null` condicional ARRIBA de un `useEffect` (violación de las reglas de hooks). Preexistente, pero este PR le agrega un disparador: ahora lo cruza un **DUEÑO** en FREE/BÁSICO en cada carga | El return se movió debajo de los hooks |

**Verificación** (toda leída del LOG, no del código de salida): `pnpm type-check` **5/5** con 3 cache
misses · `pnpm gates` **76 OK / 0 FAIL**, y por primera vez la línea de TIERS dice
`keys excluibles por tier: facturacion, sat, conciliacion, **ia**` — o sea que `gate:routes`
**verificó de verdad** que las 15 anotaciones cubren la key · **37/37 comprobaciones EJECUTADAS**:
las rutas de IA bloqueadas en FREE y BÁSICO y abiertas en PRO/LAB; **`GET` de `…/summary` SIGUE
permitido** en los dos planes recortados (el hallazgo 1 del review anterior, ahora medido);
expedientes, ventas, citas y `agenda-agent` intactos; y el eje de MEMBER sin moverse.

⚠️ **Lo que NO está probado: que alguien lo haya VISTO.** La extensión de Chrome no conecta en esta
sesión (misma causa que el dictado: se emparejan con una cuenta de claude.ai y aquí se usa
`ANTHROPIC_API_KEY`), así que **ningún candado se ha renderizado nunca**. La lógica está ejecutada;
los píxeles no. Runbook para el usuario, con dr-prueba ya en `FREE`: el FAB del hub en gris con
candado → abre el diálogo con su CTA · «Dictar» en Notas y en Notas del paciente, igual · las 6
tarjetas de Acciones Rápidas y los botones «Chat IA» de las 5 páginas `*/new`, ausentes · en
Conciliación, el modal ofrece **sólo CSV** · en un informe, ni pestaña de chat ni «Llenar la hoja»,
y el panel de fuentes explica que el plan no incluye asistente (sin prometer uno).

🔴 **Prerrequisito de DESPLIEGUE, no de código:** este commit toca `packages/database`, que no está
en los `watchPatterns` de ningún servicio. Por eso lleva un cambio de comentario **dentro de
`apps/api` y de `apps/admin`** — los dos comentarios estaban además desactualizados — para que sus
propios watchPatterns disparen y las tres apps queden en el mismo commit. Con `api` viejo, FREE
seguiría teniendo IA por ese lado: **dos apps aplicando techos distintos, y pareciendo que
funciona**. (`railway up` NO sirve aquí: sube el árbol de trabajo, que todavía tiene BBVA.)

### Q3 — el cupo de pacientes (2026-09-13)

**Decisiones del usuario que lo destrabaron:** (1) el cupo cuenta **SOLO `status = 'active'`** —
archivar libera lugar, y archivar es lo que ya hace el DELETE (borrado suave); (2) un downgrade que
dejaría la cuenta por encima del tope **se RECHAZA en el admin**, en vez de permitir que exista una
cuenta por encima de su cupo.

**Por qué (1) importa más de lo que parece**, medido en prod el 2026-09-13: dr-prueba tiene **43
pacientes pero 9 activos** (34 archivados). Contándolos todos estaría casi en el tope por
expedientes que ya cerró. En la base solo hay `active` (263) y `archived` (40): `inactive` está en
el comentario del esquema y no lo usa nadie.

| Qué | Dónde |
|---|---|
| `assertPatientQuota(db, doctorId, entrantes, tier?)` + `maxPatientsFor()` + `QuotaExceededError` + `PATIENT_STATUS_COUNTED_AGAINST_QUOTA` | `permissions.ts` |
| Alta individual | `patients/route.ts` |
| Importación `.xlsx` — cuenta DENTRO de la transacción y rechaza el archivo ENTERO | `patient-import-commit.ts` |
| **Desarchivar** (`archived/inactive → active`) consume un lugar | `patients/[id]/route.ts` PUT |
| **Guard del downgrade** en el admin (409 con números y el arreglo) | `admin/doctor-tier/route.ts` |
| `QUOTA_EXCEEDED` → 403 con `{limit, current, incoming}` | `api-error-handler.ts`, y a mano en la ruta de importación (no pasa por el handler) |
| El contador `9 / 50 activos` y el `activeCount` que lo alimenta | `medical-records/page.tsx`, `patients/route.ts` GET |
| `/feature-usage` cuenta ACTIVOS (antes `_count.patients` pelado) | `analytics/feature-usage/route.ts` |

🔴 **Los TRES caminos, no dos.** El plan decía "2 caminos que crean pacientes". Son dos que
**crean**, pero el cupo tiene un tercero que lo **consume**: desarchivar. Lo cazó el review y es el
hallazgo grave — sin él el tope no existía: un doctor en 50/50 abre un archivado, lo guarda como
`active` y queda en 51, repetible sin límite, y el contador pintaba "51 / 50" afirmando un estado
que el servidor llama imposible. *Se guardaba la SALIDA y no el REGRESO.*

**Los 4 hallazgos del review (corrido ANTES del commit) y sus arreglos:**

| # | Hallazgo | Arreglo |
|---|---|---|
| 1 | La ruta de importación **no pasa por `handleApiError`**: el `QuotaExceededError` caía a un **500 genérico**, así que la rama nueva de `QUOTA_EXCEEDED` era código muerto ahí. Un límite de negocio se veía como avería de plataforma | Rama propia en el catch de esa ruta: 403 con los números |
| 2 | 🔴 **Desarchivar saltaba el cupo por completo** (arriba) | Guard en el PUT, sólo en la TRANSICIÓN a `active` |
| 3 | El lote se cobraba por TODOS los renglones, pero la plantilla trae columna `estatus` (`ESTATUS_MAP`) y el committer la respeta: 60 renglones con 55 `archivado` se rechazaban por 60 cuando solo 5 quedarían activos | Se cobra `entrantesActivos`, no `patients.length` |
| 4 | Carrera check-then-create: dos altas simultáneas en 49/50 pasan las dos ⇒ 51 | **NO se arregló** (decisión del usuario: sin trabajo a nivel BD). Deriva acotada de 1-2, no un bypass. Anotado aquí |

**Verificación**, toda leída del log: `pnpm type-check` **5/5** con 3 cache misses · `pnpm gates`
**76 OK / 0 FAIL** · **21/21 + 15/15 comprobaciones EJECUTADAS** (frontera exacta 49+1 pasa /
50+1 bloquea; lote todo-o-nada; fail-open con tier corrupto; las cinco transiciones de estado; el
filtro del importador) · y **smoke-test read-only contra prod de las DOS formas de consulta
nuevas** (`count` filtrado y `groupBy` filtrado): coinciden doctor por doctor, que es lo que
importa porque el número que se MUESTRA y el que se COBRA tienen que ser el mismo.

⚠️ **Y una trampa de método que casi se cuela:** las comprobaciones de los hallazgos 2 y 3 no
podían importar el código real (ni la condición del PUT ni el filtro del importador están
exportados), así que el script replicaba ambas. Eso valida **mi transcripción**, no el código: si
me hubiera equivocado al copiar, la prueba pasaba igual. Se cerró leyendo las dos líneas reales de
vuelta y comparándolas carácter por carácter. *Replicar una condición para probarla es un test de
uno mismo hasta que se lee el original.*

🔴 **Q3 NO es NO-OP**, aunque los caminos de escritura sí lo sean (ninguna cuenta FREE está cerca
de 50): **el guard del admin muerde desde el primer día**. Medido: bajar a FREE a
**dr-david-salazar-vela (94 activos)** o a **dr-jose (60)** se rechaza ya. dra-mariana-serratos va
en 46, a cuatro del tope.

**Despliegue:** `apps/api` y `apps/doctor` cambian en sus propias rutas, así que sus watchPatterns
disparan solos. **`apps/admin` NO necesita tocarse esta vez**: lo que consume de
`@healthcare/database` (`DOCTOR_TIERS`, `TIER_LIMITS`, `TIER_EXCLUDED_KEYS`) no cambió, y el 409
nuevo lo sirve `apps/api` en tiempo de ejecución — su modal ya lo muestra bien
(`doctors/page.tsx` lee `result.message`).

**Lo que NO está probado: los PÍXELES.** Nadie ha visto el contador ni el rechazo del admin. Runbook:
en dr-prueba (FREE, 9 activos) el contador debe decir `9 / 50 activos` y NO cambiar al filtrar por
archivados; en el admin, bajar a FREE a dr-david debe fallar con el mensaje que nombra 94 y 50.

### Q4 — el cupo de almacenamiento (CONSTRUIDO, sin commitear — 2026-09-13)

> **Estado: CÓDIGO ESCRITO Y EN VERDE (type-check + 5 gates), SIN COMMIT y SIN
> SQL aplicado.** El as-built está en §8.2, al final de esta sección. Lo que el
> plan de abajo prometía y NO se construyó (el medidor) está listado ahí.

**Lo que se midió antes de decidir nada** (read-only contra prod, 2026-09-13). Esto ya cambió el
plan dos veces, así que va primero:

| | Archivos | Peso real |
|---|---:|---:|
| `carousel_items.src` (fotos **y VIDEOS**) | 36 | **315.8 MB** |
| `patient_media.file_url` (imágenes clínicas) | 135 | 112.0 MB |
| certificados · portadas y fotos del blog | 50 | 48.9 MB |
| firmas, logos, hero, constancia, estados de cuenta, acuses | 30 | ~12.8 MB |
| **TOTAL del bucket** | **~250 refs** | **489.5 MB** |

🔴 **Los docs de IMAGE MIGRATION dicen "~150-200 MB" / "~0.2 GB": están mal por ~2.5×.** Nadie
mintió — **todas** las estimaciones anteriores sumaron las columnas que TIENEN `file_size`, y el
video es justo la categoría que no la tiene. **6 videos pesan 380 MB: el 72% de todo**, y el
archivo más grande del sistema son **156.8 MB**. La conclusión de "bajarse al plan gratis de 2 GB"
sigue siendo válida, pero con un margen 4× más delgado del que el doc afirma.

*Lección: una categoría sin instrumento no pesa cero, pesa lo que nadie midió.* Y un corolario de
método: el primer barrido midió 19 de 100 archivos con `HEAD` y yo reporté el subtotal como si
fuera el total —"nada de lo que existe habría sido rechazado"— y era **falso**: el fallback con
`Range: bytes=0-0` levantó 115 de 116 y apareció el archivo de 156.8 MB.

**Decisiones del usuario (2026-09-13):**

1. **Tope por archivo: 25 MB** para documentos e imágenes… **pero el VIDEO conserva tope propio de
   200 MB**, igual en las TRES apps. Un tope global de 25 MB habría roto `medicalVideos` (128 MB) y
   `doctorVideos` (1 GB), y habría rechazado el archivo de 156.8 MB que ya existe. Los 200 MB
   dejan pasar todo lo actual y hacen imposible que **una sola subida supere el cupo FREE entero**
   (hoy 1 GB = 2× los 500 MB del plan).
2. **Se rechaza ANTES de subir los bytes**, en el `middleware`. Verificado en los tipos instalados
   (`uploadthing@7.7.4`): `MiddlewareFn` recibe `{ files, input }` y cada `FileUploadData` trae
   `size: number`. **Nuestro `authMiddleware` no declara parámetros y tira esa información** en las
   33 definiciones. O sea: el gancho existe hoy, no hay que esperar a R2 — y en R2 el mismo
   contrato es el §3.4 de su plan (el servidor valida MIME y tamaño ANTES de firmar el PUT).
3. **NO hay backfill: se cuenta de hoy en adelante.** Y es lo correcto, no sólo lo barato: **toda
   cuenta que algún día tope empieza vacía** (una cuenta nueva nace FREE). De las 12 actuales, la
   única FREE es dr-prueba con 1.8 MB. Un backfill compraría precisión que nadie observaría.
4. **Cómo se mide el uso: una tabla `StoredFile`** (`doctorId`, `url`, `sizeBytes`, `kind`,
   `createdAt`), no sumar columnas ni un contador.

**Por qué `StoredFile` y no las otras dos opciones:**

- **Sumar `fileSize` de las tablas de dominio no alcanza**: de las 17 keys, **10 no tienen columna
  de tamaño y 6 no tienen fila propia** — las fotos de perfil caen en `Certificate.src` /
  `CarouselItem.src`, y las imágenes dentro de un artículo viven **incrustadas en el HTML** de
  `articles.content` (13 URLs medidas ahí). No hay dónde poner la columna.
- **Un contador `Doctor.storageUsedBytes` deriva** en cuanto algo borra fuera de la app, y sin
  forma de detectarlo. Una suma sobre un ledger se recalcula y se audita. A ~250 filas el costo es
  irrelevante.
- **Y paga dos veces:** la Fase 3 de la migración a R2 necesita exactamente esto —un inventario de
  cada archivo con su ubicación— para copiar y verificar antes de borrar.

**El inventario real de superficies de subida: 17 keys definidas 33 veces en 3 routers**, más 5
caminos que NO pasan por UploadThing. El plan decía "14 file routes": **es la TERCERA lista cerrada
del día que no se sostiene** (los prefijos de IA eran 12 y no 11; los caminos que crean pacientes
eran 3 y no 2).

🔴 **Tres huecos que el cupo tiene que cubrir o no cuenta nada:**

1. **El admin sube al perfil de OTRO doctor**, pero su `middleware` devuelve el `userId` del
   ADMIN. Un cupo con llave en `metadata.userId` le cobraría al admin y dejaría al doctor sin
   medir — *parece que funciona*. La llave tiene que ser el doctor DESTINO.
2. **El router de `apps/api` (12 keys) no tiene ningún cliente en el repo** — los helpers de
   `doctor` fijan `url: "/api/uploadthing"` (relativo, su propia app) y los de `admin` omiten
   `url`. Está vivo y autenticado con JWT: es una vía sin medir.
3. **`doctorVideos` es 1 GB en `doctor` y `admin` pero 64 MB en `api`** — misma key, dos topes.

**Qué se construye (Q4, un solo PR):**

| | |
|---|---|
| Tabla `StoredFile` + índice por `doctorId` | SQL manual (`prisma db execute`), nunca `db push` |
| `assertStorageQuota(db, doctorId, entrantes[])` en `permissions.ts` | espejo de `assertPatientQuota`: `null` ⇒ sin tope ⇒ ni consulta |
| `authMiddleware` pasa a recibir `{ files }` y valida **tamaño por archivo** y **cupo de la cuenta** antes de subir | las 33 definiciones |
| Registro en `StoredFile` al completar la subida | `onUploadComplete` + los POST que persisten |
| El doctor DESTINO como llave (no el admin) | routers de `admin` y `api` |
| Medidor `usado / tope` y `QUOTA_EXCEEDED` con números | perfil/plan + `handleApiError` |

**Verificación exigida:** type-check · gates · comprobaciones EJECUTADAS de la aritmética (frontera
exacta, lote, tier corrupto) · smoke read-only de la forma de consulta nueva contra prod · review
ANTES del commit · y el runbook con ojos humanos, que es lo único que prueba que un doctor VE el
rechazo.

## 8.2 As-built Q4 — el cupo de almacenamiento (2026-09-13)

> **Estado: construido, en verde, SIN COMMIT.** No está en prod. El SQL tampoco.

**Lo que se construyó, y en qué se APARTA del plan de arriba:**

| Plan decía | Se construyó | Por qué |
|---|---|---|
| Registro en `onUploadComplete` **+ los POST que persisten** | **Sólo en `onUploadComplete`**, vía `registrarArchivo` | El plan daba por hecho ~6 handlers de cliente. Son **19 archivos** que suben, con **tres idiomas** (componente, `useUploadThing`, `uploadFiles`): `onClientUploadComplete` sólo matchea 4 de ellos. En el servidor no hay cliente que se pueda olvidar, y es el mismo seam que firmará el PUT en R2 |
| `url` como llave del ledger | **`fileKey`** (`file.key`) | En v7 el mismo archivo tiene DOS URLs y el repo guarda una u otra según el sitio (~10 de 17 guardan `url`). Un ledger llaveado por URL no empata con las tablas de dominio: el borrado y la reconciliación de R2 devolverían 0 filas en silencio |
| Medidor `usado / tope` en perfil/plan | **NO se construyó** | Queda abierto. Hoy el muro es invisible hasta que pega |
| `fileSize` en las rutas = el tope real | `FileSize` de uploadthing sólo admite **potencias de 2** | 25 MB y 200 MB son inexpresables. Config = el permitido SUPERIOR (32MB/256MB); el tope REAL lo aplica el middleware |

**Las decisiones del usuario, como quedaron en código:**

1. **25 MB por archivo · 200 MB video** — `MAX_BYTES_POR_ARCHIVO` / `MAX_BYTES_POR_VIDEO`.
   ⚠️ **Unificar video a 200 MB SUBE dos topes**, no sólo baja el de 1 GB: `medicalVideos` pasó de
   128 MB a 200 MB (doctor y api) y `doctorVideos` de api, de 64 MB a 200 MB.
2. **Se rechaza antes de subir bytes** — en el `middleware`, que recibe `{ files }` con `size`.
3. **Sin backfill** — se cuenta de hoy en adelante.
4. **Admin: se APUNTA pero no se rechaza** por cupo de cuenta (opción B). El tope POR ARCHIVO sí
   aplica. Un límite comercial no debe bloquear al staff a media alta de un doctor.

**El code review encontró 12 hallazgos. Los 7 que se arreglaron:**

| # | Hallazgo | Arreglo |
|---|---|---|
| 1 | 🔴 **Cualquier cuenta de Google podía subir por el router de admin y ELEGIR a qué doctor cobrárselo** — `middleware.ts` exime `/api/uploadthing`, `AdminGuard` es de cliente, y `signIn` acepta cualquiera. Con `.input()` de Q4 eso se volvía "llénale el plan a un doctor ajeno", y sin tope (opción B) | Se exige `role === 'ADMIN'` en el middleware del router |
| 2 | 🔴 **Desplegar antes de correr el SQL mataba TODA subida** de `doctor` y `api` (29 de 33 definiciones): el error de Prisma no era de dominio, se re-lanzaba y salía como "Failed to run middleware". `admin` seguía vivo ⇒ parecía caída parcial | `assertStorageQuota` **falla ABIERTO** ante errores de infraestructura, como `FALLBACK_TIER` |
| 3 | Llave del ledger (`ufsUrl`) no empata con lo que guardan las tablas de dominio (`url`) | Se llavea por **`fileKey`**, que va dentro de las dos formas de URL |
| 4 | El mensaje decía "borra archivos" y **nada baja el uso**: ningún camino borra filas de `stored_files` | El mensaje ya no promete una salida que no existe |
| 5 | `formatearBytes(0)` devolvía `"1 KB"` — al que está exacto en su tope le decía que le quedaba espacio | Devuelve `0 B` |
| 6 | `No existe el doctor` salía como "Failed to run middleware" | Traducido a `UploadThingError` |
| 7 | **Exigir `doctorId` rompía subidas que ayer funcionaban**: antes de Q4 el middleware ni lo miraba, y `computeEffectiveAccess` devuelve null para un ADMIN (que `requireDoctorAuth` sí admite en endpoints de doctor) y para una membresía REVOKED. No se pudo contar cuántos son —el DNS de Railway no resuelve desde esta máquina—, así que se arregló en vez de medirlo | **Fail-open**: sin doctor no se mide ni se registra, pero se sube. Son cuentas que no tienen cupo que gastar |

**Lo que el review dejó ABIERTO (no se arregló):**

- **Nada borra filas de `stored_files`** ⇒ el uso sólo puede subir. Deuda real.
- **`fiscal-form` sube la constancia con `UTApi` fuera de los routers** ⇒ almacenamiento sin medir.
- **No hay medidor** ⇒ el doctor no puede ver su uso ni verificar el número del mensaje.
- **Los dropzones anuncian 32 MB / 256 MB** y el servidor rechaza a 25/200.
- **`registrarArchivo` nunca lanza** y `onUploadComplete` corre como daemon *fire-and-forget*: una
  escritura perdida no se entera nadie. Sin borrado ni reconciliación, la deriva no se cura sola.

**Verificación:** type-check ✅ (0 errores, 5/5; los cache misses cayeron en los paquetes que
cambiaron en cada corrida) · 5 gates ✅ —pero
**`gate:docs` no mira los docs de TIERS**, sólo AGENTES y NUEVOS USUARIOS, así que su verde no dice
nada de esta sección— · code review ✅ (12 hallazgos) · **smoke read-only contra prod ❌ IMPOSIBLE
HOY**: el DNS de Railway no resuelve, y además `stored_files` no existe todavía, así que
`storedFile.aggregate` y `createMany` **no se han ejecutado nunca**.

🔴 **Orden obligatorio al desplegar:** correr `add-stored-files.sql` en la consola SQL de Railway
**ANTES** del push. La tabla es aditiva y nadie la lee hasta que el código llegue.

## 8.1 🔄 Handoff — cierre de sesión 2026-09-12

- **Estado:** **Q1 CERRADO en prod** (`2779b2e6` + SQL + runbook A y B) y **Q2a construido**
  (as-built en §8). Sigue habiendo cambios ajenos en el working tree (informe BBVA,
  `scripts/demo-seed/`, `ANALISIS CAT/`) — no son de este plan, no mezclarlos en su commit.
- **Siguiente paso:** **Q2b** — es el que muerde, y su prerrequisito duro es
  `NEXT_PUBLIC_SALES_EMAIL` en Railway + redeploy (sin ella el candado no ofrece salida). Q3/Q4
  (cupos) son independientes y se pueden adelantar.
- **Banco de pruebas listo:** dr-prueba está en `FREE` a propósito — en cuanto Q2b entre, ahí se ve
  el micrófono con candado y el 403 de `/api/encounter-chat`.
- **§9 contestado:** 1, 3 y 4 el 2026-09-12; **2 el 2026-09-13** (candado en las dos puertas
  principales, el resto oculto). Quedan 5, 6, 7 y el nuevo 8.
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
2. ✅ **DECIDIDO (usuario, 2026-09-13): candado con CTA en las DOS puertas principales —el hub de
   voz y el micrófono de notas—, y el resto de las ~18 puertas de IA OCULTAS.** Es la
   recomendación original: la transcripción de voz es **la función de IA más usada**
   (`../AGENTES/INVENTARIO IA/02`), así que mostrarla bloqueada es el mejor upsell del producto,
   mientras que llenar la UI de candados no lo es. Consecuencia para Q2: hay que distinguir DOS
   tratamientos en el cliente (candado vs ocultar), no uno — y la lista de puertas es la parte que
   se escapa (lección de T4 §13.4.1: dos greps, escritorio **y** móvil).
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
