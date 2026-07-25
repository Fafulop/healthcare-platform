# 01 · Diseño técnico — TIERS (planes del producto)

> Feature-gating por CUENTA (doctor), apilado sobre el sistema de permisos de `NUEVOS USUARIOS`.
> Estado: **DISEÑO, sin implementar.** Este doc es la fuente de verdad del plan.

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
3. **Dónde:** `enabledModules(access)` en `modules/registry.ts` gana el `tier` y aplica (1); un
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
- **Gates nuevos** (espíritu del `check-route-permission-coverage.ts` existente):
  - Toda key en `TIER_EXCLUDED_KEYS[*]` debe resolver a ≥1 ruta vía `nearestFeatureKey` (si no, la
    exclusión no muerde nada = bug).
  - Test de la resolución nearest-feature-key para `facturacion/csd` y `sat-descarga/fiel` (G1).
  - (Opcional) un inventario de entradas public/cron tocando funciones tier-able (G3), para no
    olvidar el `doctorTierAllows` en una nueva.

## 8. Secuencia de implementación (PRs sugeridos)

Cada PR con su verificación; todo cambio de agente ⇒ suite de 65 evals (regla del repo).

1. **PR T1 — fundación (database).** Campo `Doctor.tier` (SQL manual), `DOCTOR_TIERS`,
   `TIER_EXCLUDED_KEYS`, `tierAllows`, `nearestFeatureKey`, `doctorTierAllows`; `EffectiveAccess`
   gana `tier` (lectura fresca). Sin cambio de conducta aún (nadie es CORE). Smoke read-only vs
   prod del nuevo query shape (regla dura).
2. **PR T2 — enforcement server.** Aplicar el techo en los 2 choke points (owner+member) con
   nearest-feature-key; helper para public/cron (fiscal-form + worker SAT). Gates de cobertura.
3. **PR T3 — agente tier-aware.** `enabledModules` + filtro de tools (G2a), `TOOL_FEATURE_KEY`.
   Suite 65 evals corrida como FULL (sin cambios) y como CORE (facturas/fiscal fuera, flujo sin
   conciliacion). Verifica que el prefijo CORE baja y que gate:prompt (FULL) sigue OK.
4. **PR T4 — cliente show-locked.** `usePermissions` con `lockedByTier`, sidebar con candado,
   pantalla/CTA de upgrade, ruta de contacto.
5. **PR T5 — admin.** Selector de tier + columna + ruta admin-guarded.
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
