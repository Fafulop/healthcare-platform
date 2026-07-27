# 01 · Diseño técnico — TIERS (planes del producto)

> Feature-gating por CUENTA (doctor), apilado sobre el sistema de permisos de `NUEVOS USUARIOS`.
> Estado: **T1–T3 y T5 SHIPPED a prod · T4 CONSTRUIDO (2026-07-27, sin desplegar) · falta T6.** El
> gating sigue siendo **NO-OP** mientras los 11 doctores sean FULL — lo que T5 cambia es que ahora
> se puede dejar de serlo sin SQL a mano, y lo que T4 agrega es que el doctor VEA por qué. Este doc
> es la fuente de verdad del plan (§1–§10) y el as-built de lo construido (§11 = T3, §12 = T5,
> §13 = T4).
>
> *(Hasta 2026-07-26 esta cabecera decía "DISEÑO, sin implementar" con cuatro PRs ya en producción.)*

---

## 1. La decisión de arquitectura (por qué NO es un sistema nuevo)

Las 6 funciones que el tier CORE excluye **ya son `PermissionKey`** con mapeo preciso y probado a
rutas, páginas y módulos del agente (`packages/database/src/permissions.ts`,
`route-permissions.ts`):

| Función (UI) | `PermissionKey` | Ya mapeada a |
|---|---|---|
| Facturación | `facturacion` | `facturacion/*` · `/dashboard/facturacion` · módulos agente `facturas`,`fiscal` |
| Descarga SAT | `sat` | `sat-descarga/*` · `/dashboard/sat-descarga` |
| Conciliación Bancaria | `conciliacion` | `practice-management/conciliacion-bancaria`, `bank-statement-import/parse` |
| Ventas | `ventas` | `practice-management/ventas\|cotizaciones\|clients` |
| Compras | `compras` | `practice-management/compras\|proveedores` |
| Productos y Servicios | `productos` | `practice-management/products\|product-attributes\|areas\|master-data` |

**Por eso el tier NO es un vocabulario nuevo:** es un **techo (ceiling) a nivel de cuenta sobre el
mismo conjunto de `PermissionKey`**. Un tier = "qué keys están disponibles para toda la cuenta".

Esto reutiliza toda la maquinaria de enforcement existente (route map, page map, sidebar, módulos
del agente). La alternativa (un sistema de feature-flags paralelo) duplicaría enforcement y
garantizaría drift. Rechazada.

## 2. El modelo de composición

Hoy (NUEVOS USUARIOS):
- **Owner** → `permissions: null` = todo.
- **Member** → su set de toggles, chequeado ruta por ruta en los dos choke points.

Con tiers se agrega **un factor de cuenta**:

```
acceso efectivo(key) = tierAllows(tier, key)  AND  (isOwner ? true : hasPermission(memberPerms, key))
```

- El techo del tier aplica a **owner Y member** (es lo que la cuenta paga).
- El check de toggles sigue siendo **solo de members**.
- Un member nunca excede ni sus toggles ni el tier de la cuenta.

⚠️ **El único cambio de conducta real:** hoy los owners "nunca llegan al check"
(`route-permissions.ts` los deja pasar). Con tiers, el owner queda **acotado por el tier** (no por
toggles). Es barato — solo resolución ruta→key + `tierAllows` — pero hay que introducirlo en los
DOS choke points y en el agente (§4).

## 3. Modelo de datos

### 3.1 Campo `tier` en `Doctor` (= la cuenta)

El `Doctor` ES la cuenta (los members cuelgan de un `doctorId`), así que el tier vive ahí.

```prisma
model Doctor {
  // …
  tier String @default("FULL")  // 'FULL' | 'CORE' (unión validada en código)
}
```

- **`String`, NO enum de Postgres.** El usuario planea "más tiers después"; agregar un valor a un
  enum de PG requiere `ALTER TYPE` (migración, no transaccionable limpio). Un `String` + unión en
  código agrega un tier con **cero migración de BD**.
- **Default `'FULL'`** ⇒ todo doctor existente queda full-featured; un downgrade es una acción
  deliberata del admin. **Fail-open a FULL** ante tier ausente/desconocido (mismo espíritu que el
  fallback owner de `membership.ts`: nunca dejar a nadie fuera por un dato faltante).
- **Migración = SQL manual vía `prisma db execute`** (regla dura del repo: `prisma db push`
  revierte el composite FK de `bookings` y los índices parciales de `doctor_members`).
  `ALTER TABLE ... ADD COLUMN tier text NOT NULL DEFAULT 'FULL';`

### 3.2 La tabla tier→keys excluidas (fuente única, en código)

Junto a `PERMISSION_KEYS` en `packages/database/src/permissions.ts`:

```ts
export const DOCTOR_TIERS = ['FULL', 'CORE'] as const;
export type DoctorTier = (typeof DOCTOR_TIERS)[number];

/** Keys que el tier EXCLUYE de toda la cuenta. Fuente única (§1). */
export const TIER_EXCLUDED_KEYS: Record<DoctorTier, readonly PermissionKey[]> = {
  FULL: [],
  CORE: ['facturacion', 'sat', 'conciliacion', 'ventas', 'compras', 'productos'],
};

/** ¿La cuenta con este tier tiene acceso a esta key? Fail-open a permitido si
 * el tier es desconocido/ausente (no bloquear por dato faltante). */
export function tierAllows(tier: string | null | undefined, key: PermissionKey): boolean {
  const excluded = TIER_EXCLUDED_KEYS[(tier ?? 'FULL') as DoctorTier];
  if (!excluded) return true;          // tier desconocido ⇒ fail-open
  return !excluded.includes(key);
}
```

## 4. Enforcement — dónde se aplica el techo

### 4.1 Los DOS choke points de auth (server, la frontera real)

`apps/api/src/lib/auth.ts` (`validateAuthToken` → `enforceMemberRoute`) y
`apps/doctor/src/lib/medical-auth.ts` (`requireDoctorAuth`) ya resuelven `EffectiveAccess` y, **solo
para members**, corren `checkRoutePermission`. Cambios:

1. **`EffectiveAccess` gana `tier`** (`membership.ts`). Se lee **FRESCO de la fila `Doctor`** (ver
   §5.4 / hueco G4), no del JWT. La query de membership ya resuelve el doctor; se agrega `tier` al
   `select` (o un join). `computeEffectiveAccess` lo propaga.
2. **El techo del tier aplica a owner Y member**, antes/además del check de toggles. Ver la nueva
   resolución en §4.3.

### 4.2 La regla efectiva por ruta

```
decision(route, method, access):
  featureKey = nearestFeatureKey(route, method)     // ver §4.3 (hueco G1)
  if featureKey != null AND NOT tierAllows(access.tier, featureKey):
      → BLOCK  (reason: 'tier_excluded')            // aplica a owner y member
  if access.isOwner OR role == ADMIN:
      → (owner ya no bypassa el tier, pero sí los toggles) ALLOW
  else:
      → checkRoutePermission(route, method, access.permissions)  // member, sin cambios
```

`admin` (role ADMIN) sigue bypasseando TODO (gestiona cuentas).

### 4.3 ⚠️ Hueco G1 — DOS resoluciones ruta→key sobre el mismo map

El check de MEMBER usa **la regla más específica** (leaf). Pero algunas rutas dentro de una función
excluida tienen leaf key `OWNER_ONLY`, no la key de la función:
`facturacion/csd` (subir CSD) y `sat-descarga/fiel` POST/DELETE (credencial e.Firma). Un **owner**
CORE bypassa el check de member y, como su leaf key es `OWNER_ONLY`, `tierAllows` no tendría
`facturacion`/`sat` que cazar ⇒ **fuga: un doctor CORE podría subir un CSD.**

**Fix:** el TIER usa una resolución distinta — **"nearest feature key"**: la regla más larga que
matchea cuya key ∈ `PERMISSION_KEYS` (ignorando `OWNER_ONLY`/`NEUTRAL`). `facturacion/csd` → nearest
feature key `facturacion` → excluida → bloqueada.

- **Member gating:** most-specific-rule (como hoy, sin cambios).
- **Tier gating:** nearest-feature-key.
- Dos resoluciones, **un solo map** (`ROUTE_PERMISSION_MAP`). Se agrega
  `nearestFeatureKey(pathname, method)` a `route-permissions.ts`.

## 5. Los cuatro huecos del análisis (y cómo se cierran)

### 5.1 G1 — OWNER_ONLY bajo función excluida → resuelto en §4.3.

### 5.2 G2 — el módulo `flujo` del agente NO se puede gatear a nivel de módulo

Confirmado en `modules/flujo.ts`: el módulo `flujo` empaqueta `get_conciliacion_bancaria` (tool de
conciliacion) junto a las de flujo/pagos, y `AGENT_MODULE_REQUIREMENTS.flujo = ['flujo','pagos','conciliacion']`.
CORE conserva `flujo` pero excluye `conciliacion` ⇒ un intersect a nivel de módulo **tira el módulo
`flujo` entero en CORE**, contradiciendo "CORE conserva flujo".

**Decisión del usuario: gating a nivel de TOOL (opción "proper").** Reglas:

1. **Requisito efectivo del módulo = `AGENT_MODULE_REQUIREMENTS[m]` menos las keys tier-excluidas.**
   - `facturas` = [facturacion, sat] → en CORE ambas excluidas ⇒ requisito vacío ⇒ **módulo se
     dropea** (todas sus keys excluidas). Igual `fiscal`.
   - `flujo` = [flujo, pagos, conciliacion] → en CORE cae `conciliacion` ⇒ requisito [flujo, pagos]
     ⇒ **módulo se CONSERVA**.
   - `agenda`=[citas], `expediente`=[expedientes] → sin cambios en CORE.
   - **Regla:** si TODAS las keys requeridas del módulo están excluidas ⇒ dropea el módulo. Si
     SOBREVIVE ≥1 ⇒ conserva el módulo y filtra sus tools (abajo).
2. **Filtro de tools dentro de un módulo conservado.** Nueva metadata: `TOOL_FEATURE_KEY:
   Record<string, PermissionKey>` (solo las tools cuya sub-función difiere de la key base del
   módulo la declaran; hoy la única es `get_conciliacion_bancaria` → `conciliacion`). El filtro
   del tier dropea las tools cuya feature key esté tier-excluida. En CORE el módulo `flujo` pierde
   `get_conciliacion_bancaria` y conserva `get_flujo_status`, `get_movimientos`,
   `get_movimiento_detail`, `get_balance`.
3. **Dónde:** *(⚠️ el as-built difiere — ver §11.2: la composición quedó en
   **`resolveAgentScope(access)`**, y `enabledModules` se dejó SIN EXPORTAR como la regla de
   toggles sola, para que nadie se salte el techo del tier. Lo de abajo es el diseño original.)*
   `enabledModules(access)` en `modules/registry.ts` gana el `tier` y aplica (1); un
   nuevo filtro de tools aplica (2) al construir el toolset. `buildTools`/`ALL_TOOLS` ya componen
   por módulo — el filtro se inserta ahí.

> 🔎 **Asimetría documentada:** el gating de MEMBER sigue siendo a nivel de MÓDULO (un member tiene
> el módulo `flujo` completo o no). El gating de TIER es más fino (nivel tool). Es la PRIMERA vez
> que el código gatea a nivel de tool; se introduce solo para el tier. Consistencia: como el
> requisito efectivo del módulo ya resta las keys tier-excluidas, un member en cuenta CORE con
> `flujo`+`pagos` obtiene el módulo `flujo` (sin la tool de conciliacion) igual que el owner CORE.

> 💰 **Efecto colateral bueno:** en CORE el prefijo del agente baja (dropea módulos `facturas`
> 8.7k + `fiscal` 1.6k + la tool de conciliacion) ⇒ el agente CORE es más barato. Se cruza con el
> trabajo de `../AGENTES/OPTIMIZACION COSTOS/`. `gate:prompt` sigue OK: el prompt owner FULL no
> cambia (CORE es otra variante memoizada, como ya pasa con members).

### 5.3 G3 — flujos PÚBLICOS y de FONDO no pasan por los choke points

Por diseño, rutas public/webhook/cron nunca llaman los checks de auth
(`UNMAPPED_PUBLIC_PREFIXES`). Dos consecuencias:

- **`fiscal-form` (público):** el paciente manda su RFC para pedir un CFDI. En CORE (facturacion
  excluida) esa entrada debe estar apagada según el tier del doctor — pero ningún choke point la
  cubre.
- **Worker de SAT (cron):** corre por doctor. En CORE (sat excluida) debe **saltarse los doctores
  CORE**, o pagas costo de sync SAT por una función que no tienen.

**Fix:** helper server `doctorTierAllows(doctorId, key)` (query directa a `Doctor.tier` +
`tierAllows`) que estos puntos llaman explícitamente:
- `fiscal-form` (entrada pública) chequea `doctorTierAllows(doctorId, 'facturacion')` antes de
  aceptar; si no, muestra "no disponible".
- El worker de SAT filtra su lista de doctores por `tierAllows(doctor.tier, 'sat')`.

⇒ El enforcement del tier vive en **TRES** sitios, no dos: los 2 choke points + este helper para
public/cron. Documentarlo para que un flujo public/cron nuevo bajo una función tier-able no se
olvide (candidato a assertion de gate, §7).

### 5.4 G4 — un cambio de tier debe surtir efecto sin re-login

Si el tier viaja en el JWT (como `isOwner`/`permissions`), un downgrade del admin no aplica hasta
que la sesión se refresque. **Fix:** los choke points leen el tier **FRESCO de la fila `Doctor`**
(un campo extra en la query que ya corren), no del JWT. La copia en sesión/JWT es **solo cortesía
de cliente** (puede ir atrasada hasta el refresh; el sidebar es courtesy, la frontera es server —
§6). Así un downgrade aplica inmediato server-side. (Existe `sessionVersion`; leer fresco es más
simple y estrictamente correcto — no dependemos de bumpearlo.)

## 6. Cliente (doctor-app) — mostrar CON CANDADO

Decisión: las funciones tier-excluidas se **muestran bloqueadas con CTA de upgrade** (no se
ocultan). El gating de MEMBER sigue **ocultando**. Requiere distinguir el PORQUÉ:

1. **`usePermissions()` devuelve el motivo, no un booleano.** Nueva forma:
   ```ts
   interface ClientPermissions {
     loading: boolean;
     isOwner: boolean;
     tier: string;                              // de la sesión (cortesía)
     can: (key) => boolean;                     // efectivo: tierAllows && (owner || hasPermission)
     lockedByTier: (key) => boolean;            // true ⇒ mostrar candado+upgrade (no ocultar)
   }
   ```
   La sesión/JWT gana `tier` (callback de sesión, junto a `isOwner`/`permissions`). Legacy/ausente
   ⇒ `'FULL'` (igual que `isOwner` default true).
2. **El sidebar bifurca:** `lockedByTier(key)` ⇒ renderiza el item **deshabilitado con candado**;
   oculto por member ⇒ se omite (como hoy). `pagePermissionKey` ya da la key de cada página.
3. **El `PermissionGate` de página:** si `lockedByTier` ⇒ muestra una pantalla de upsell (no el
   404/redirect de member). Como el server igual bloquea los datos, es cortesía+conversión.
4. **Destino del "Upgrade":** página de **contacto/ventas** (no hay billing self-serve). Una ruta
   nueva tipo `/dashboard/upgrade` (o modal) con copy + CTA de contacto. Product decide el copy.

## 7. Administración (admin app) + gates

- **Set del tier:** selector en `apps/admin/src/app/doctors/[slug]/edit/page.tsx` (ya existe) +
  columna en `doctors/page.tsx`. Escribe `Doctor.tier` vía ruta admin-guarded
  (`/api/admin/...`, `requireAdminAuth`). Es la "administración desde el admin app" pedida. **No**
  hay billing self-serve; el tier es un atributo que fija el admin (billing puede manejarlo
  después sin tocar este diseño).
  - ⚠️ **REQUISITO DURO del write (surgido en el review de T1):** la ruta que escribe `Doctor.tier`
    DEBE validar contra `DOCTOR_TIERS` con el CASE canónico (`'FULL'`/`'CORE'`). `tierAllows` es
    **case-sensitive y fail-open**: un `'core'` en minúsculas no matchearía `TIER_EXCLUDED_KEYS`
    y **desactivaría el gating en silencio** (la cuenta quedaría FULL de facto). El write es la
    única barrera; rechaza cualquier valor fuera de `DOCTOR_TIERS`.
- **Gates nuevos** (espíritu del `check-route-permission-coverage.ts` existente):
  - Toda key en `TIER_EXCLUDED_KEYS[*]` debe resolver a ≥1 ruta vía `nearestFeatureKey` (si no, la
    exclusión no muerde nada = bug).
  - Test de la resolución nearest-feature-key para `facturacion/csd` y `sat-descarga/fiel` (G1).
  - (Opcional) un inventario de entradas public/cron tocando funciones tier-able (G3), para no
    olvidar el `doctorTierAllows` en una nueva.

## 8. Secuencia de implementación (PRs sugeridos)

Cada PR con su verificación; todo cambio de agente ⇒ suite de 65 evals (regla del repo).

1. ✅ **PR T1 — fundación (database) — SHIPPED 2026-07-24 (`c639a0ca`).** Campo `Doctor.tier`
   (SQL manual aplicado a prod), `DOCTOR_TIERS`, `TIER_EXCLUDED_KEYS`, `tierAllows`,
   `tiersExcluding`, `nearestFeatureKey`, `doctorTierAllows`; `EffectiveAccess` gana `tier`
   (string crudo, lectura fresca). Cero conducta (todos FULL). Smoke read-only OK.
2. ✅ **PR T2 — enforcement server — SHIPPED 2026-07-24.** Techo en los 2 choke points
   (owner+member) vía `tierRouteDecision`/nearest-feature-key; 3er sitio public/cron
   (`fiscal-form` GET+POST, `sat-auto-sync` filtra por tier). Fix: `TIER_EXCLUDED` → 403 en el
   error handler del doctor-app (habría sido 500). Gate de cobertura de tier agregado. **NO-OP
   en el deploy** (todos FULL); probado 20/20 offline + downgrade dr-prueba→CORE→revert en vivo.
3. ✅ **PR T3 — agente tier-aware — SHIPPED 2026-07-25** (`b26898f5`, desplegado). Ver §11 para el
   as-built, las 4 correcciones al diseño, el bug hunt (§11.5) y el gate `gate:prosa` (§11.5.2).
4. ✅ **PR T4 — cliente show-locked — CONSTRUIDO 2026-07-27.** `usePermissions` con `lockedByTier`,
   sidebar con candado, pantalla de upsell con CTA de contacto. As-built en **§13**.
5. ✅ **PR T5 — admin — SHIPPED 2026-07-26** (`b5414a19`). Selector de tier + columna + ruta
   admin-guarded. Ver §12 para el as-built, la desviación del §7 y el hallazgo de seguridad que
   destapó (`faa7e829`).
6. **PR T6 — degradación de cruces flujo.** Pasada por el ledger: entradas ligadas a
   factura/venta/compra se RENDERIZAN sin error en CORE, ocultando solo las ACCIONES de cruce
   (no borrar datos). Audit de funciones conservadas que puedan filtrar datos de funciones
   excluidas (reportes/analytics con cifras de CFDI/SAT — decidir si el agregado read-only es
   aceptable).

## 9. Invariantes y no-metas

- **La frontera es el server** (los 3 sitios de §4–§5.3). El cliente es cortesía.
- **Downgrade = gating, NUNCA borrado.** Los datos de una función bloqueada persisten y reaparecen
  al re-upgrade.
- **Default FULL, fail-open a FULL** ante tier ausente/desconocido (no bloquear por dato faltante).
- **Admin bypassa el tier** (gestiona cuentas). El tier acota owner y member.
- **No-meta v1:** billing/subscripción self-serve. El tier lo fija el admin; billing es futuro y no
  cambia este diseño (solo pasaría a ESCRIBIR `Doctor.tier`).
- **No-meta v1:** overrides de cap del agente por tier (hook futuro, anotado).

## 10. Preguntas abiertas (bloquean, no inventar)

1. **Copy/destino exacto del upsell** — product (§6.4). El diseño solo fija que hay una página de
   contacto/ventas.
2. **Fuga read-only en funciones conservadas** (reportes con cifras de CFDI/SAT) — decidir en T6 si
   se acota o se acepta.
3. ~~¿CORE tiene `pagos`?~~ ✅ **RESUELTO (usuario, 2026-07-24): SÍ, CORE conserva `pagos`.** Los
   links de pago (Stripe/MP) están en el tier base; `pagos` NO va en `TIER_EXCLUDED_KEYS.CORE`.
   Consistente con que el módulo `flujo` del agente (requiere flujo+pagos+conciliacion) sobrevive
   en CORE con [flujo, pagos] tras restar la conciliacion excluida (§5.2).

---

## 11. PR T3 — as-built (2026-07-25) · ✅ SHIPPED Y DESPLEGADO

> Commits: **`b26898f5`** (T3) · **`cddecc19`** + **`a47bc4c9`** (`gate:prosa`) · **`dd8964d8`**
> (docs de los huecos abiertos). Deploy `@healthcare/doctor` verificado SUCCESS.

Construido según §5.2 con **cuatro correcciones al diseño**, todas encontradas leyendo el código
o corriendo los evals — ninguna era visible desde el diseño en papel.

### 11.1 Las cuatro correcciones

**C1 — el diseño perdía capacidad que CORE SÍ paga.** §5.2 detectó `get_conciliacion_bancaria`
(tool de `conciliacion`) dentro del módulo `flujo` que CORE CONSERVA, pero no el caso espejo:
`get_payment_links` y `get_payment_provider_status` son tools de **`pagos`** dentro del módulo
`facturas` que CORE **dropea**. Como CORE incluye `pagos` (§10 Q3), la regla "si TODAS las keys
del módulo están excluidas ⇒ dropea el módulo" le quitaba al doctor CORE consultas de su propio
plan. **Decisión del usuario: rescatarlas.** La regla quedó:

- Requisito BASE del módulo = sobrevive si **al menos UNA** de sus keys sigue en el plan.
- Una tool con `TOOL_FEATURE_KEY` propia se decide **por esa key sola** — lo que a la vez rescata
  una tool de `pagos` de un módulo caído y tira una de `conciliacion` de un módulo vivo.
- Módulo con **cero tools vivas ⇒ se dropea** entero.

`get_guia` se dejó FUERA de CORE a propósito: 3 de sus 4 temas son funciones excluidas y gatear
por VALOR DE ARGUMENTO es un patrón que el repo no tiene. La UI de Guía no se toca.

**C2 — la nota de alcance culpaba al dueño.** `MEMBER_SCOPE_NOTE` dice "según lo que haya
habilitado el dueño del consultorio". Un OWNER de cuenta CORE recibe por primera vez un set
recortado ⇒ le habríamos dicho que su dueño lo limitó. Nuevo `TIER_SCOPE_NOTE` con encuadre de
PLAN. Los dos conviven (member sobre cuenta CORE = doble techo).

**C3 — "Tools bajo demanda" peleaba contra el filtrado (bug PREEXISTENTE de members).** Esa
sección (2026-07-24, POSTERIOR a PR C) afirma que "todas las de facturación, fiscal, flujo de
dinero y expedientes existen aunque no aparezcan en tu lista". Para **cualquier** scope recortado
—member desde hace días, tier desde hoy— era falso: mandaba al modelo a buscar tools inexistentes.
Ahora se compone por scope, nombrando solo los dominios presentes. El path FULL usa la constante
original, byte a byte.

**C4 — el recorte de TOOLS no tapaba el recorte de DATOS.** Decisión del usuario: arreglarlo aquí
en vez de diferirlo a T6. Dropear `get_conciliacion_bancaria` no impedía que `get_flujo_status`
siguiera devolviendo el bloque `conciliacionBancaria` completo, ni que cada fila de
`get_movimientos` trajera `bancoConciliado`/`evidenciaFiscal`. `evidenceScope(ctx)` (flujo.ts)
omite ahora, según `tierAllows`: el bloque de conciliación y su alerta, la matriz factura×banco
(cruza DOS ejes: necesita ambos), los porcentajes de factura, `autoVinculacion` y los campos por
fila. **Omite CAMPOS, nunca recalcula un veredicto** ⇒ regla 0 intacta, y las QUERIES quedan como
estaban (unas cuantas cuentas de más) para no forkear la lógica réplica. Los **input schemas NO
varían por tier** — un schema por cuenta forkearía el cache del prefijo de tools sin ganancia.

### 11.2 Lo construido

| Pieza | Qué |
|---|---|
| `modules/registry.ts` | `TOOL_FEATURE_KEY` (3 entradas), `AgentScope`, `FULL_SCOPE` (por REFERENCIA), `resolveAgentScope(access)`. `enabledModules` se queda como la regla de **toggles sola** — las dos capas nunca se enredan |
| `modules/types.ts` | `prompt.partial` opcional: secciones alternativas para un módulo que el tier recortó |
| `modules/flujo.ts` | `evidenceScope` (C4) + variante `partial` sin la prosa de conciliación ni los desempates contra tools fiscales ausentes |
| `modules/facturas.ts` | Variante `partial` "solo pagos en línea" (~700 chars) en lugar de ~8.7k de reglas CFDI |
| `prompt.ts` | `buildSystemPrompt(scope)`; `TIER_SCOPE_NOTE`; `buildToolSearchNote(scope)` (C3); memo key = módulos + parciales + los dos motivos de recorte |
| `run-turn.ts` / `route.ts` | `scope` sustituye a `modules`; `ctx.tier` llega a las tools; el `allowedToolNames` de defensa en profundidad ahora corta a nivel de TOOL |
| `tools.ts` | `ToolContext.tier` |

### 11.3 Verificación

- **`gate:prompt` — 39 checks verdes**, incluidos 21 nuevos de tier. El owner FULL sigue en
  **sha256 `4a66a438…`** (sin cambio) y `git diff` confirma que ninguna línea de
  INTRO/RESILIENCE/TOOL_SEARCH_NOTE/HOW_TO_PROPOSE/RULES/FORMAT se tocó ⇒ **cero invalidación de
  cache en prod al desplegar**. El gate también asserta que todo nombre de `TOOL_FEATURE_KEY` es
  una tool real (un rename dejaría una entrada muerta filtrando nada) y que ningún módulo queda
  vivo con cero tools.
- **`pnpm gates` verde · `tsc` limpio** en apps/doctor.
- **Evals de frontera** (11 casos `tier-core-*` nuevos + los 3 `member-*`, read-only contra prod;
  la suite pasa de 65 a **76** casos): **14/14 al 1er intento** en la corrida final. Los 3 casos
  que destaparon conducta se re-corrieron **3 veces cada uno** tras el fix (lección de varianza:
  una corrida no distingue regresión de ruido).
- **Prefijo CORE: 22,137 chars vs 28,200 (−21%) y 26 tools vs 39** ⇒ el agente CORE es
  efectivamente más barato, como anticipaba §5.2.

### 11.4 Hallazgos de conducta (canónicos en AGENTES)

Los tres fallos de conducta que destaparon los evals —redirigir al "administrador", sustituir en
silencio la pregunta por un dato parecido, e **inventar una sección de conciliación a partir de
campos ajenos** cuando el payload ya venía recortado— viven en
[`../AGENTES/AGENTE AGENDA/SESSION-REFRESCO.md`](../AGENTES/AGENTE%20AGENDA/SESSION-REFRESCO.md)
bitácora **#25**, con la medición antes/después. Aquí solo se resumen (regla de reparto de
`08-EMPIEZA-AQUI` §2).

**La lección que generaliza:** recortar tools NO basta. El prompt que sobrevive sigue afirmando
capacidades, y el modelo rellena el hueco con lo que tenga a mano — sustituyendo la pregunta o
deduciendo el dato faltante de campos que no lo dicen. Cada recorte de tools necesita su recorte
de PROSA y una regla explícita de "nombra la frontera antes de responder otra cosa".

### 11.5 Bug hunt dirigido (2026-07-25) — 3 bugs + el defecto de diseño que los causaba

Hecho DESPUÉS de que los evals estuvieran verdes, con el método de `02-METODO` §3.2 (dos
criterios, no uno). El primer filtrado fue por **empaquetado de módulos**, así que el punto ciego
era el simétrico: **tools que SOBREVIVEN pero cuyo texto o payload habla de una función excluida**
— la misma clase que C4, que solo se había cazado en `flujo`.

**B1 — módulos vivos mandaban al doctor CORE a usar funciones que no tiene.** Cuatro sitios:
`AGENDA_CITAS_RULES` ("la factura NO se emite aquí — se emite desde la tabla de citas… **dilo si
el doctor la menciona**", o sea INSTRUYE el redirect), la descripción de
`propose_complete_booking`, el `nota` en tiempo de ejecución de esa misma propuesta (llega a la
card), y `EXPEDIENTE_RULES` + la descripción y el `alcance` de `get_expediente_resumen`, que
enrutan a `get_billing_status`/`get_patient_profile` (tools DROPEADAS en CORE). El prompt CORE
quedaba con órdenes **contradictorias**: `TIER_SCOPE_NOTE` dice "no lo mandes a otra sección",
agenda decía "dilo". Y pegaba en el flujo MÁS común de CORE (completar una cita), que los evals
no cubrían.

**B2 — se ocultó el CAMPO pero quedó el FILTRO.** `get_movimientos` conservaba `hasFactura` y
`needsReview` en su schema (los schemas se congelaron a propósito). Un doctor CORE preguntando
"¿qué movimientos no tienen factura?" recibía el filtro aplicado y `totalEncontradas` — o sea,
**exactamente la señal de evidencia fiscal que C4 había quitado de las filas**. El recorte era
evitable a través de sus propios filtros. Ahora el filtro excluido se DESCARTA y se ECHOA
(`filtrosNoDisponibles`, mismo contrato que una fecha malformada) — descartarlo en silencio sería
peor: el modelo reportaría sumas de todo el historial como si fueran el subconjunto pedido.

**B3 — `ProposalContext` no llevaba `tier`** (solo `ToolContext`), así que el `nota` de B1 no podía
ser tier-aware. Plomería agregada.

**El defecto de diseño detrás de B1:** `partialModules` se derivaba del **filtrado de TOOLS**.
`agenda` y `expediente` conservan TODAS sus tools en CORE, así que **nunca** podían recibir una
variante `partial`, por más que su prosa dependiera de una función caída. El mecanismo no sabía
expresar *"la prosa necesita adaptarse aunque las tools no"*. Corregido con
`prompt.prosaDependsOn: PermissionKey[]` (types.ts): la variante se activa si se filtraron tools
**o** si una key de la que depende la prosa está excluida.

Para las DESCRIPCIONES de tools (que viajan en el prefijo cacheado) se agregó
`TOOL_DESCRIPTION_OVERRIDES`, aplicado **solo a scopes recortados** — el array del owner se
comparte por referencia y debe seguir byte-idéntico, así que reescribir el texto compartido habría
invalidado el cache de TODOS los doctores por un caso que no les aplica.

**Guardas nuevas en `gate:prompt`** (los fixes son text-matching: un reword aguas arriba los
convertiría en no-ops silenciosos y ningún test fallaría):
todo módulo `partial` tiene variante · ninguna variante es copia idéntica de la completa (caza un
`.replace()` que no encontró nada) · todo `from` de un override sigue matcheando su tool real · la
prosa y las descripciones de CORE no enrutan a las tools dropeadas · **y el path FULL CONSERVA el
texto original** (que ningún fix se derrame al owner).

> ⚠️ Lo que estas guardas NO pueden exigir: `INTRO` es **compartido y byte-congelado** y enumera
> las 9 capacidades, así que el prompt CORE sí menciona `get_billing_status` ahí. Neutralizarlo es
> trabajo de las notas de alcance (tradeoff de PR C, `../NUEVOS USUARIOS/01-DISENO` §13);
> exigir su ausencia contradiría la identidad de bytes. El check apunta a la prosa de MÓDULO.

**Re-verificación:** `gate:prompt` (46 checks) · `pnpm gates` · tsc limpio · **14/14 evals al 1er
intento, 0 WARN**. sha256 del owner **sin cambio**.

### 11.5.1 El eval de la forma REAL del member — encontró un bug PREEXISTENTE

Los 3 casos `member-*` corrían un scope de UN módulo, pero el member real en prod
(andreabarbagal) resuelve a **CUATRO** (agenda + expediente + facturas + fiscal). Se agregaron 2
casos con sus toggles EXACTOS, y el de decline falló **0/3**:

- El agente contestó *"¿cuánto me quedó en junio?"* con **`get_resumen_fiscal`** — base de efectivo
  del SAT — presentado como el balance del mes. **Cifra de OTRA cosa, con confianza y sin avisar.**
- **Causa raíz — ⚠️ corregida 2026-07-25 tras verificarla contra el código.** La primera redacción
  de esta sección decía que el desempate vive solo en `FLUJO_RULES` y que al member "le falta la
  regla". **Es FALSO y no se verificó antes de escribirlo:** `FISCAL_RULES` (fiscal.ts) TIENE su
  propio desempate, y este member SÍ lo recibe. El problema real es peor que una ausencia: esa
  regla **apunta a tools que él no tiene** — dice que los gastos del día a día "viven en el ledger
  (get_balance/get_movimientos — regla de desempate del módulo de flujo)". Al modelo se le dice
  dónde está la respuesta y no puede ir; improvisa con la tool fiscal que sí tiene.
  ⇒ **NO es una clase nueva: es exactamente el defecto de `prosaDependsOn` (§11.5) en el eje de
  MEMBER** — prosa de un módulo vivo que cross-referencia un módulo ausente. `fiscal` necesita
  variante `partial` cuando falta `flujo`, y `partialModules` debe mirar también la ausencia por
  toggles, no solo por tier.
  (La regla anti-sustitución sí faltaba en `MEMBER_SCOPE_NOTE`; eso es cierto y se corrigió.)
- **NO lo introdujo T3**: cualquier member con `fiscal` y sin `flujo` lo tenía desde PR C. Lo que
  T3 aporta es el eval que lo DETECTA.
- **Fix en dos pasos, y el primero NO bastó** (vale la pena para la próxima vez):
  1. *Mitigación de prompt* — el desempate + "di la frontera antes de contestar otra cosa" en
     `MEMBER_SCOPE_NOTE`. Midió **0/3 → 2/3**: mejor, pero seguía contestando mal 1 de cada 3.
  2. *Fix ESTRUCTURAL* — se cerró el defecto real: `fiscal` gana variante `partial` +
     `prosaDependsOn: ['flujo']`, y `partialModules` pasa a evaluarse contra **lo que el scope
     PROVEE**, no contra el tier. Midió **3/3 en 3 corridas.**

  La lección: cuando la prosa apunta a tools ausentes, agregar MÁS prosa que lo contradiga es un
  parche; quitar la prosa equivocada lo resuelve.

**⚠️ Cómo se evalúa `prosaDependsOn` (importante, y no es obvio):** contra las capacidades que el
toolset FINAL provee, **no** contra el toggle ni contra el tier. Un member con `flujo: true` pero
sin `pagos`/`conciliacion` **no tiene módulo flujo** (su requisito es ALL), así que `get_balance`
no existe para él aunque la key `flujo` se vea concedida. Chequear la key habría dejado pasar ese
caso; chequear lo que el scope provee, no. Hay gate dedicado para esa combinación.

⇒ Con esto, el defecto de `prosaDependsOn` queda cerrado en AMBOS ejes (tier y member), no solo
en el del tier.

### 11.5.2 `gate:prosa` — la clase, cerrada por construcción (2026-07-25)

`prompt.partial` + `prosaDependsOn` arreglan INSTANCIAS. Este gate cierra la CATEGORÍA:
`scripts/check-agent-prose-references.ts` (`pnpm gate:prosa`, ya dentro de `pnpm gates`).

**Cómo, sin heurísticas:** enumera los **66 scopes alcanzables** (cada subconjunto de módulos
concedible por toggles × cada tier de `DOCTOR_TIERS`, más el dueño), los resuelve con
`resolveAgentScope` REAL, y para cada módulo vivo lee la prosa que el composer REAL le daría —
`sectionsFor`, exportado justo para esto, respetando la variante `partial`. Toda tool nombrada en
esa prosa **o en las descripciones de sus tools** debe estar en el toolset de ese scope. Nada de
adivinar qué "debería" pasar: se pregunta al mismo código que corre en producción.

**Fuera de alcance a propósito:** las secciones COMPARTIDAS (INTRO/RESILIENCE/RULES). Enumeran
las 9 capacidades y son byte-congeladas para el dueño; neutralizarlas es trabajo de las notas de
alcance (tradeoff de PR C). Exigir su ausencia contradiría la identidad de bytes.

**Encontró 7 cross-references. Triaje con UN criterio: ¿el modelo puede CONTESTAR con otra cosa
en vez de declinar?**

- **1 BUG REAL — `flujo` → `get_resumen_fiscal`/`get_ppd_cobranza`.** Es el **espejo exacto de
  §11.5.1**: `FLUJO_RULES` manda los números de DECLARAR a las tools fiscales; un member con
  `flujo`+`pagos`+`conciliacion` pero SIN `facturacion`/`sat` no las tiene ⇒ puede presentar
  cifras del ledger como si fueran fiscales. **Arreglado**: `flujo` gana `prosaDependsOn`
  y su variante se reescribió **neutral**, de modo que sirve a los DOS casos (CORE sin
  conciliación, y member sin facturación) — antes era texto específico de CORE. Eval nuevo
  `member-flujo-sin-fiscal-no-inventa-declaracion`, 2/2 corridas.
- **6 toleradas, cada una con su razón en el `ALLOWED` del script** (deuda VISIBLE, no barrida):
  `fiscal`↔`facturas` comparten requisitos idénticos ⇒ co-presentes por construcción; el resto
  (`facturas`/`expediente` → tools de agenda) hace que el modelo **pierda de dónde SACAR un dato
  y tenga que preguntárselo al doctor** — degradación de usabilidad, no cifra inventada. El
  receptor de un CFDI siempre sale del expediente validado server-side, nunca del chat.

> La regla para agregar una exención está escrita en el script: si el modelo podría CONTESTAR en
> vez de declinar, **no es exención — es el bug de §11.5.1** y necesita `prosaDependsOn` + variante.

**Segunda clase, agregada el mismo día: redirects a una SECCIÓN.** El chequeo de tools no ve
frases como *"se emite desde la tabla de citas"* o *"entra a Flujo de Dinero"* — y ahí vivían los
PEORES hallazgos, porque mandar al doctor a una puerta cerrada se siente producto roto, no una
pista perdida. Se agregó un léxico `FEATURE_PHRASES` (sección → `PermissionKey`) que solo dispara
con una **pista de ruteo** delante ("en la página X", "entra a X", "se emite desde X"): nombrar
una función para NEGARLA es honesto y no se persigue. Encontró 1 caso, y resultó **falso
positivo conservado a propósito**: *"El ingreso se registra EN Flujo de Dinero automáticamente"*
es un HECHO cierto incluso para un member sin `flujo` (efecto server-side, `../NUEVOS
USUARIOS/01-DISENO` §17) — callarlo sería peor.

**Prueba NEGATIVA del gate** (un gate que pasa no prueba nada si nunca podría fallar): se quitó
temporalmente el `prosaDependsOn` de `fiscal` y el gate **disparó** con
`fiscal → get_balance` + `get_movimientos`, es decir, caza exactamente el bug de §11.5.1. Restaurado, verde.

**Tripwire ítem 2 — CERRADO:** eval `tier-core-completar-cita` (el flujo más común de CORE).
2/3 corridas al 1er intento; el WARN es la sobre-declaración conocida de la bitácora #24 (ofreció
"si necesitas emitir factura después, avísame" pese a la prohibición explícita del prompt) — check
`soft`, mismo criterio que #24. Nota de fixture: la HORA va en el mensaje porque dr-prueba tiene
DOS citas de Diki el 28; sin ella el agente pide desambiguar (conducta CORRECTA) y el caso nunca
llega a probar lo de CORE.

Suite: **80 casos**. Gates: `gate:routes` · `gate:prompt` · `gate:docs` · **`gate:prosa`**.

> 🔭 **Observación fuera de alcance (para otra sesión):** en una corrida el agente emitió
> `propose_complete_booking` **3 veces** para UNA cita ⇒ 3 cards para la misma acción. No es de
> tiers ni lo introdujo T3, y el check de tipos pasa igual; queda anotado porque es UX confusa.

### 11.6 Abierto (no bloquea T3)

- ⚠️ **Fuga de member PREEXISTENTE, ajena al tier** (encontrada en el review, angle 8): el gating
  de member es por MÓDULO, así que un member con `facturacion`+`sat` pero **`pagos` OFF** recibe
  igualmente `get_payment_links`/`get_payment_provider_status`, porque viven dentro del módulo
  `facturas`. Existe desde PR C; T3 no lo empeora, pero `TOOL_FEATURE_KEY` ya da la pieza para
  cerrarlo (aplicar la key propia de la tool también al eje de member).
  **DECISIÓN 2026-07-25: se documenta, NO se arregla por ahora.** Está VIVO en prod (andreabarbagal
  tiene esa forma exacta). Ficha completa —alcance del daño, cómo cerrarlo, qué re-correr— en el
  doc canónico de esa feature: [`../NUEVOS USUARIOS/SESSION-REFRESCO.md`](../NUEVOS%20USUARIOS/SESSION-REFRESCO.md)
  §"HUECO ABIERTO". Aquí solo se referencia (regla de reparto de `08-EMPIEZA-AQUI` §2).
- ⚠️ **Propuestas duplicadas en un turno** (visto en los evals de T3, ajeno a tiers): el modelo
  llamó `propose_complete_booking` 3 veces para una cita ⇒ 3 cards; `ProposalCollector` no
  deduplica. Confusión, no datos malos (el ingreso es idempotente). **DECISIÓN 2026-07-25: se
  documenta, NO se arregla.** Ficha en `../AGENTES/AGENTE AGENDA/05-REFERENCIA-TECNICA-AGENTE.md`
  §11 límite **L6**.
- `porOrigen` de `get_flujo_status` sigue mostrando agregados de origen `sat_emitido`/
  `sat_recibido` en CORE. Se dejó A PROPÓSITO: son movimientos reales del ledger (una función que
  CORE SÍ tiene) y quitarlos descuadraría los totales del propio doctor — "downgrade = gating,
  nunca borrado" (§9). El `partial` de flujo le dice al modelo que los reporte como movimientos y
  nada más. Si se quiere otra política, es parte de la auditoría de fuga read-only de **T6**.
  > 🔴 **La prueba en vivo del 2026-07-27 le puso evidencia (§12.6, bitácora #28): esa instrucción
  > PERDIÓ las 4 corridas.** El modelo usó los buckets SAT para narrar historia de la cuenta
  > ("en algún momento tuvo habilitada la emisión de CFDIs") y, en una corrida, para **fabricar**
  > un análisis de conciliación. Decir "repórtalos y nada más" no basta cuando el payload invita
  > la narrativa. Forma de fix que encaja con el precedente **C4** (omitir CAMPOS, nunca recalcular
  > un veredicto): **colapsar los buckets `sat_*` en una etiqueta histórica neutral solo en CORE** —
  > los totales siguen cuadrando (gating, no borrado) y desaparece el gancho semántico.
  > ✅ **HECHO el 2026-07-27, el mismo día** (bitácora #28): buckets → `historico` sin total mezclado,
  > el mismo relabel en filas y detalle, el eje de FILTRO cerrado con el contrato B2, y la prosa del
  > `partial` deja de nombrar los buckets. Conservación verificada contra prod (692=692, 371+306→677)
  > y sha256 del dueño sin cambio. ⚠️ **Residuo:** la SUSTITUCIÓN sobrevive ~50% de las veces (3 de 6 corridas) (redirect de
  > despedida a la sección Conciliación) — eso sí sigue abierto. **Lo que T6 hereda ya NO es la
  > política de `porOrigen`** (decidida), sino reportes/analytics + ese residuo de conducta.

---

## 12. PR T5 — as-built (2026-07-26) · ✅ SHIPPED

> Commits: **`b5414a19`** (T5) · **`faa7e829`** (el hallazgo de seguridad que T5 destapó, ver §12.3).
> Sin migración: la columna `Doctor.tier` existe desde T1.

Lo que T5 resuelve: hasta ahora mover a un doctor a CORE exigía **SQL a mano contra prod**, que es
la peor forma de hacer el primer downgrade.

### 12.1 La desviación del §7 (deliberada)

El diseño apuntaba al wizard de edición del admin. **No se hizo ahí.** Ese formulario guarda con
`PUT /api/doctors/[slug]`, y esa ruta la puede llamar un **DOCTOR dueño para su propio perfil**
(`route.ts:111-126`): meter el tier en ese payload lo habría vuelto auto-asignable — el doctor se
sube de plan solo. El tier tiene entonces su **propia ruta admin-only**, y el PUT de perfil no lo
toca (verificado: `tier` no aparece en su mapeo de campos, y ninguno de los 20 call sites de
`doctor.update` hace spread del body).

**Lección reusable:** antes de agregar un campo a un formulario existente, preguntar *quién más
puede llamar al endpoint que lo guarda*. "Es la pantalla de admin" no implica "es una ruta de admin".

### 12.2 Lo construido

| Pieza | Qué |
|---|---|
| `PATCH /api/admin/doctor-tier` | `requireAdminAuth`. Valida contra `DOCTOR_TIERS` con **case canónico y RECHAZA** lo demás en vez de normalizarlo (§7): `tierAllows` es case-sensitive Y fail-open, así que un `'core'` guardado desactivaría el gating EN SILENCIO. Loguea admin + tier previo + nuevo |
| `GET /api/admin/doctor-tier` | El tier ya NO viaja en el payload público (§12.3) ⇒ la UI de admin lo lee aquí. Mismo split que `/helpers` |
| `/doctors` (admin) | Columna "Plan" + modal (patrón de los modales de Paleta/Ads). Exclusiones derivadas de `TIER_EXCLUDED_KEYS` + `PERMISSION_LABELS`, nunca escritas a mano |
| `route-permissions.ts` | `{prefix:'admin'}` NEUTRAL → **OWNER_ONLY** (§12.4) |

**Tres estados en la columna, para no señalar la causa equivocada:** valor ausente ("el API no
devolvió el plan" — deploy viejo, gris) vs valor presente pero no canónico (alarma roja real:
fail-open a FULL) vs canónico. La primera versión los mezclaba: un `@healthcare/api` desactualizado
habría pintado a los 11 doctores en rojo como si la columna estuviera corrupta.

El modal advierte que **mientras no exista T4** el doctor SEGUIRÁ viendo las secciones excluidas y
solo recibirá un error al usarlas. Verificado que la promesa "aplica sin re-login" es cierta:
`membership.ts:115` relee `Doctor.tier` por request en los dos choke points.

### 12.3 ⚠️ El hallazgo de seguridad que destapó (`faa7e829`)

Revisando por qué `tier` aparecía en el payload de `GET /api/doctors` se encontró la causa raíz:
**esa ruta y `GET /api/doctors/[slug]` son públicas y consultaban con `include` y sin `select`** —
Prisma devuelve TODOS los escalares, así que **cada columna nueva del modelo se sumaba sola a la
respuesta anónima**. Verificado con curl sin token contra prod, salían:

| Qué | Alcance real |
|---|---|
| `mpAccessToken` + `mpRefreshToken`, `stripeAccountId` | **dr-prueba** (cuenta de pruebas) |
| `prescriptionSignatureUrl` | 4 doctores, **3 reales** — la firma vive en storage público, así que publicar la URL publica la firma; va junto a la cédula, que es justo el par con el que se timbra una receta (00-REQUISITOS §3.5) |
| `googleCalendarId` (8), `telegramChatId` (7) | doctores reales; el chatId solo es explotable con el bot token, que NO estaba expuesto |
| `tier` | el hilo del que se jaló |

**Fix:** `DOCTOR_PRIVATE_FIELDS` + `omit` en las dos rutas. Se CONSERVAN preferencias de
notificación, ajustes de PDF y booleanos de estado de conexión (no son credenciales y sí tienen
consumidores vivos), y `cedulaProfesional`/`prescriptionCredentials` (dato profesional que el perfil
público ya muestra).

**`pnpm gate:payload` cierra la CATEGORÍA, no el caso** — el default de este endpoint es "todo es
público", así que la próxima columna sensible se filtraría en silencio y ningún test fallaría. El
gate asserta: todo campo sensible omitido o justificado CON razón · las dos rutas siguen aplicando
el `omit` · sin entradas muertas por un rename · y **al revés**, que no se omita de más lo que el
sitio público necesita. **Probado en NEGATIVO** en los dos sentidos (columna falsa
`stripeSecretKey` ⇒ falla; quitar un `omit:` ⇒ falla).

⚠️ **El fix corta la exposición futura, no la pasada.** Las URLs de firma ya servidas siguen vivas
(remediarlas = re-subir esas firmas para que las viejas dejen de resolver) y el token de MP se rota
**después** de desplegar — rotarlo antes solo republica el nuevo.

### 12.4 `admin` de NEUTRAL a OWNER_ONLY

`requireAdminAuth` en cada handler sigue siendo el gate real (los ADMIN saltan el enforcement y
nunca llegan a esta regla), pero con NEUTRAL el write de un MEMBER **pasaba** el check de ruta y se
escribía en `member_audit_log` ANTES del 403 del handler — rompiendo el invariante *"ningún 403
logueado"* que 01-DISENO §18 de NUEVOS USUARIOS verificó en prod. Con OWNER_ONLY el member se
rechaza antes y no deja fila. Verificado que solo el admin app llama `/api/admin/*`.

*(Nota: `{prefix:'users'}` tiene la MISMA forma y también es admin-only en la práctica. Se dejó
como estaba — apretarlo es correcto pero excede lo que este hallazgo justificaba.)*

### 12.5 Verificación

- Smoke read-only contra prod de las query shapes nuevas, incluido un **write-probe del `update`
  dentro de una transacción revertida a propósito** (cero filas comiteadas, tier de dr-prueba
  intacto) y de las dos shapes con `omit` (0 campos privados, relaciones y campos públicos intactos).
- `tsc` limpio en `apps/admin` y `apps/api` · **5 gates** verdes (nuevo `gate:payload`) · 236 rutas.
- ✅ **PRUEBA EN VIVO EJECUTADA 2026-07-27 (Runbooks A y B del README) — T5 CERRADO.**

### 12.6 La prueba en vivo (2026-07-27) — A y B

**Runbook A (UI, sin escribir).** Columna "Plan" presente; los 11 doctores en chip azul `FULL`
(coincide con el baseline read-only tomado antes: 11 filas, todas `FULL`, cero valores no
canónicos); modal con las 6 exclusiones y los dos avisos; "Guardar" deshabilitado con el plan
actual. **Cancelar no escribió**: re-query read-only tras cerrar el modal = 11 FULL sin cambios.

**Precondición verificada antes de empezar** (para no interpretar mal un chip gris): `railway
status --json` per-service → `@healthcare/api` y `@healthcare/admin` ambos SUCCESS en `b5414a19`.

**Runbook B (downgrade real de dr-prueba, revertido al final).**

| Paso | Resultado |
|---|---|
| Downgrade desde el modal | ✅ escribió `CORE` **en case canónico** (10 FULL + 1 CORE, cero no canónicos) — primer ejercicio real del write path de §12.2 |
| `GET /api/facturacion/profile` | ✅ **403 `TIER_EXCLUDED`** |
| `GET /api/sat-descarga/metadata` | ✅ **403 `TIER_EXCLUDED`** |
| `GET /api/practice-management/ledger` | ✅ **200** (CORE conserva flujo) |
| Agente | ⚠️ **3/4** — ver abajo |
| Revertir a FULL | ✅ 11 FULL; las TRES rutas vuelven a **200** |

**"Aplica sin re-login" queda probado más fuerte de lo que pedía el runbook, y por estructura, no
por observación:** el JWT de dr-prueba contiene solo `email`/`sub`/`sessionVersion`/`iat`/`exp` —
**no hay claim de `tier`**. Con EL MISMO token las rutas dieron 403 bajo CORE y 200 tras revertir,
así que el techo solo pudo salir de la lectura fresca de `Doctor.tier` por request
(`membership.ts:115`). No existe copia stale que pudiera haberse leído.

**Agente — 3 de 4 pasan.** `get_balance` responde el mes (flujo vivo); *"hazme una factura"*
declina **por PLAN**, sin culpar al dueño y sin mandar a otra sección (C2 + los fixes de B1
funcionando en vivo); *"¿tengo links de pago pendientes?"* responde con `get_payment_links` —
confirma en vivo el rescate C1 (§11.1), la tool sobrevive a la caída de su módulo porque CORE
paga `pagos`.

⚠️ **El 4º falla y es REPRODUCIBLE (4 corridas, no varianza): "¿cómo va mi conciliación
bancaria?"** Ficha canónica en
[`../AGENTES/AGENTE AGENDA/SESSION-REFRESCO.md`](../AGENTES/AGENTE%20AGENDA/SESSION-REFRESCO.md)
bitácora **#28** (regla de reparto de `08-EMPIEZA-AQUI` §2). Resumen: 4/4 sustituyó la pregunta
por un volcado de `get_flujo_status` en vez de nombrar la frontera primero; 2/4 mandó al doctor a
la sección **Conciliación** (puerta cerrada en CORE) encuadrando el límite como *faltan estados de
cuenta* y no como *plan*; 1/4 **no nombró la frontera en absoluto** y fabricó un análisis de
conciliación a partir de los buckets `sat_emitido`/`sat_recibido` de `porOrigen`. **No lo
introdujo T5** — es conducta de la era T3 que esta primera prueba en vivo de CORE destapó.

✅ **Corregido el mismo día (fix de PAYLOAD, §11.6):** los buckets `sat_*` colapsan a `historico`
en CORE y el eje de filtro se cerró con el contrato B2. La narración SAT desapareció (**0 de 6
corridas**) y el prompt del dueño sigue byte-idéntico. ⚠️ **Residuo abierto (~50%, 3 de 6 corridas):** la
sustitución/redirect a la sección Conciliación — familia B1, inventada en runtime, con el eval
`tier-core-conciliacion-no-inventa` como tripwire `soft`.

---

## 13. PR T4 — as-built (2026-07-27) · CONSTRUIDO, sin desplegar al escribir esto

> Lo que T4 resuelve: hasta ahora un doctor CORE **veía** las secciones excluidas y solo recibía un
> error al usarlas. El propio modal de T5 lo advertía. Con esto, el límite se explica.

### 13.1 Lo construido

| Pieza | Qué |
|---|---|
| `permissions-client.ts` | `usePermissions()` devuelve `tier`, y ahora **`can()` compone los DOS techos** (antes solo miraba los toggles del member). Nuevo `lockedByTier(key)` = el motivo, no un booleano |
| `TierUpgradeNotice.tsx` (nuevo) | La pantalla de upsell: nombra la función (derivada de `PERMISSION_LABELS`, nunca escrita a mano), dice que **los datos siguen intactos** (§9 "gating, nunca borrado") y ofrece contacto |
| `PermissionGate.tsx` | El chequeo de tier va **ANTES del bypass de owner** (ver §13.2) |
| `Sidebar.tsx` | Item tier-excluido = **link atenuado con candado**; item sin toggle de member = oculto, como siempre |
| `.env.local.example` | `NEXT_PUBLIC_SALES_EMAIL` (**valor: `hola@tusalud.pro`**, decidido 2026-07-27) — sin él la pantalla explica igual pero **no renderiza botón** (un CTA muerto es peor que ninguno) |

### 13.2 Las dos decisiones que importan

**El techo del tier se evalúa ANTES que `isOwner`.** `PermissionGate` hacía
`if (loading || isOwner) return children` — correcto para toggles (son solo de members), fatal para
el tier, que **acota también al dueño** (§2). Puesto después, el owner de una cuenta CORE —la
persona que compraría el upgrade— se habría quedado mirando la sección y recibiendo un 403 pelón.

**`lockedByTier` es FALSE cuando el member además no tiene el toggle.** Si ambos techos aplican,
gana el de member (ocultar): el member no puede comprar un plan, no tendría acceso ni tras el
upgrade, y decirle "mejora tu plan" además de mentirle **expone qué le apagó su dueño**. Así, un
member nunca ve un upsell sobre el que no puede actuar.

### 13.3 Desviación deliberada del §6.2

El diseño pedía el item de sidebar **deshabilitado**. Se dejó como **link** (atenuado + candado):
un item muerto deja la pantalla de upgrade alcanzable **solo escribiendo la URL**, que es justo lo
que T4 venía a arreglar. El destino renderiza `TierUpgradeNotice`; el servidor sigue devolviendo
403 `TIER_EXCLUDED` para los datos, así que no se filtra nada.

### 13.4 Alcance: qué NO se tocó

El candado vive en el **sidebar** y en la **pantalla de página**. Botones y widgets sueltos dentro
de otras páginas siguen usando `can()`, que ahora también respeta el tier ⇒ **se ocultan** en CORE
en vez de mostrar candado. Es consistente con §6 (que solo especifica sidebar + `PermissionGate`) y
evita sembrar CTAs de upgrade por toda la app.

### 13.4.1 Review del propio T4 — 1 bug REAL y 1 asimetría anotada

Método de `../NUEVOS USUARIOS/02-METODO` §3.2 (dos greps, no uno). El primer barrido fue por
`can(` (call sites de la semántica que cambió); el segundo, el que valió, por **`pagePermissionKey`**
— los consumidores del MISMO mapa de páginas.

- 🐛 **BUG REAL, corregido: `MobileDrawer.tsx` no tenía el candado.** Tiene su PROPIO `NavItem`, copia
  del de `Sidebar`, con el mismo `if (!can(key)) return null`. Como `can()` ahora respeta el tier, un
  doctor CORE **en el celular** habría visto las 6 secciones DESAPARECER en vez de aparecer con
  candado — y la pantalla de upgrade queda inalcanzable desde un teléfono. Es exactamente la familia
  del §16 hallazgo 2 de NUEVOS USUARIOS (*gateas el concepto en un lado y se te escapa el hermano*).
  Corregido con la misma rama, espejo del desktop.
- ⚠️ **Asimetría DELIBERADA, anotada en el código: `BottomNav.tsx` NO lleva candado.** Sus 4 tabs
  (dashboard/expedientes/citas/pendientes) están **todos incluidos en CORE**, así que la rama sería
  código muerto y un candado en una barra de 4 iconos es mala UX. **Pero es un hueco latente:** si
  un tier futuro excluye `citas`, `expedientes` o `tareas`, el tab desaparecería en el celular sin
  ruta al upgrade. El comentario en el archivo nombra la condición exacta que lo activa.
- ✅ Verificado limpio: los 6 features excluidos SÍ tienen entrada en `PAGE_PERMISSION_MAP` (si
  faltara una, esa sección no mostraría candado y el doctor volvería al 403 pelón) · el mapa de
  PÁGINAS no tiene entradas `OWNER_ONLY`/`NEUTRAL`, así que el hueco **G1** (§4.3) —que obligó a
  `nearestFeatureKey` en el mapa de RUTAS— no tiene gemelo aquí · `PermissionGate` envuelve a TODAS
  las páginas del dashboard (`DashboardLayout:50`), así que ninguna se salta el upsell.
- 📎 Efecto secundario bueno del cambio de `can()`: `dashboard/page.tsx:53` decide con `can("ventas")`
  si **hace el fetch**. Un dueño CORE ahora se lo salta en vez de comerse un 403 garantizado.

### 13.5 Verificación

- `tsc` limpio en `apps/doctor` · **5 gates verdes** · sha256 del dueño `4a66a438…` sin cambio
  (T4 no toca el agente).
- **NO-OP mientras los 11 doctores sean FULL**: `tierAllows(FULL,*)=true` ⇒ `lockedByTier` siempre
  false ⇒ el sidebar y el gate se comportan exactamente como antes.
- ⏳ **PENDIENTE — prueba en vivo** (mismo formato que el Runbook B de T5): desplegar → dr-prueba a
  CORE → confirmar sidebar con candado en las 6 secciones, la pantalla de upsell y el CTA →
  revertir. **Nadie ha visto esta UI todavía.**
- ⏳ **PENDIENTE — poner `NEXT_PUBLIC_SALES_EMAIL=hola@tusalud.pro` en Railway** (servicio
  `@healthcare/doctor`). Es acción de USUARIO en el dashboard de Railway y **no deja rastro en git**,
  así que no la des por hecha: sin esa variable el botón no aparece (el resto de la pantalla sí).
  ⚠️ Es `NEXT_PUBLIC_*`, o sea se **inyecta en el build**: hay que redeployar el servicio DESPUÉS de
  ponerla, no basta con guardarla.
