# 🎟️ TIERS — planes del producto (feature-gating por cuenta)

> **Qué es.** Ofrecer el producto en **niveles (tiers)**. Cada doctor (=cuenta) tiene un tier; el
> tier define qué FUNCIONES incluye su plan. Es una capa NUEVA que se apila sobre el sistema de
> permisos de usuarios secundarios (`NUEVOS USUARIOS`), no lo reemplaza.
>
> 🔄 **Sesión nueva:** lee `01-DISENO-tecnico.md` completo. La decisión central (por qué esto NO
> es un sistema de gating nuevo sino un techo sobre el vocabulario de permisos existente) está en
> §1–§2; los cuatro huecos que cambian la implementación están en §5.

## Los dos tiers (v1)

| Tier | Incluye |
|---|---|
| **FULL** (tope) | TODO. |
| **CORE** (base) | TODO **excepto**: Facturación · Descarga SAT · Conciliación Bancaria · Ventas · Compras · Productos y Servicios. Conserva **Flujo de Dinero** (ingresos/egresos manuales, precio automático desde agenda) — solo se pierden los cruces con las funciones excluidas. |

Más tiers en el futuro (por eso el tier se guarda como `String`, no como enum de Postgres — §3.1).

## La idea en una frase

Las 6 funciones que CORE excluye **ya son `PermissionKey`** en `packages/database/src/permissions.ts`
(`facturacion`, `sat`, `conciliacion`, `ventas`, `compras`, `productos`). Así que un tier se modela
como un **techo a nivel de CUENTA sobre el MISMO vocabulario de permisos**, y
`acceso efectivo = techo del tier ∩ (owner ? todo : toggles del member)`. Eso reutiliza el route
map, el page map, el sidebar y los módulos del agente que ya existen — no se construye un sistema
paralelo.

## Decisiones tomadas (usuario, 2026-07-24)

- **UX:** las funciones bloqueadas por tier se **muestran con candado + CTA de upgrade** (no se
  ocultan). El "Upgrade" lleva a una página de contacto/ventas (no hay billing self-serve todavía).
  (Contrasta con el gating de MEMBER, que sí oculta — §6.)
- **G2 (agente):** gating a **nivel de TOOL** — CORE conserva el módulo `flujo` del agente sin la
  tool `get_conciliacion_bancaria`, en vez de perder el módulo entero (§5.2).
- **Administración:** el tier se fija desde el **admin app** (no self-serve). §7.
- **CORE SÍ incluye el asistente de IA** (usuario, 2026-07-25). Se preguntó explícitamente si
  convenía excluirlo —sería el corte MÁS BARATO: elimina de un plumazo toda la coherencia de
  prosa que T3 tuvo que construir (§11.5)— y la respuesta fue **no: el asistente va en el plan
  base**. Consecuencia asumida: **el límite del tier atraviesa POR DENTRO del asistente**, que es
  el único subsistema que *habla de sí mismo*; cada módulo, toggle o tier nuevo tiene que revisar
  su prosa contra los scopes alcanzables. Ese costo recurrente es justo lo que `gate:prosa`
  automatiza. Regla general que deja la experiencia: *el corte de tier barato excluye subsistemas
  completos; el caro carva dentro de uno que se describe a sí mismo.*

## Estado (2026-07-25)

🟢 **T1 + T2 SHIPPED a prod y probados en vivo** (`c639a0ca`, `8e7097e1`). El gating YA enforcea
en los 3 sitios (2 choke points owner+member + public/cron), pero es **NO-OP: los 11 doctores son
FULL** y `tierAllows(FULL,*)=true`, así que nadie está gateado todavía. Test en vivo pasó
(dr-prueba→CORE: facturación+SAT dieron 403 `TIER_EXCLUDED`, flujo 200; revertido→FULL).

🟢 **T3 — agente tier-aware — SHIPPED Y DESPLEGADO 2026-07-25** (`b26898f5`; gate en `cddecc19`
+`a47bc4c9`; docs en `dd8964d8`). El agente compone módulos **y tools** por plan: CORE conserva
`flujo` sin `get_conciliacion_bancaria`, dropea `fiscal`, y **rescata las tools de `pagos`** del
módulo `facturas` que se cae (corrección al diseño — CORE paga `pagos`). Prefijo CORE **−21%**
(26 tools vs 39). Prompt del owner FULL **byte-idéntico** (sha256 `4a66a438…`) ⇒ **cero
invalidación de cache**, y **NO-OP** mientras los 11 doctores sean FULL. Suite **80 casos**;
`pnpm gates` ahora corre **CUATRO** (nuevo `gate:prosa`). As-built completo, las 4 correcciones al
diseño, el bug hunt y el gate: [`01-DISENO`](01-DISENO-tecnico.md) §11.

🟢 **T5 — selector de tier en el admin — SHIPPED 2026-07-26** (`b5414a19`). Columna "Plan" + modal
en `/doctors` y una ruta **admin-only** para escribirlo (NO el wizard de edición: su PUT lo puede
llamar el propio doctor, ver [`01-DISENO`](01-DISENO-tecnico.md) §12.1). Ya **no hace falta SQL a
mano** para mover a alguien a CORE. Revisando por qué `tier` salía en el payload público se destapó
un hallazgo de seguridad ajeno a tiers — credenciales en `GET /api/doctors` — corregido en
`faa7e829` con el gate `pnpm gate:payload`; ficha en §12.3.

### ⏭️ Qué sigue

> 🧭 **Si eres una sesión nueva: empieza aquí.** T1→T3 y T5 están EN PROD y el gating sigue siendo
> **NO-OP** (los 11 doctores son FULL). Ya se puede fijar el tier desde el admin; lo que falta para
> poner a un cliente REAL en CORE es que el doctor **vea por qué** algo está bloqueado (T4).

**El siguiente paso concreto es la prueba en vivo de T5** (abajo), y luego **T4**.

✅ **El TRIPWIRE del agente quedó CUMPLIDO el 2026-07-25** (los 3 ítems: `gate:prosa`, el eval
`tier-core-completar-cita`, y `prosaDependsOn` extendido al eje de member). Detalle en
[`01-DISENO`](01-DISENO-tecnico.md) §11.5.1–§11.5.2. **Ya nada del agente bloquea un downgrade.**

**En orden:**

1. ✅ **T5 — selector de tier en el admin — SHIPPED** (`b5414a19`). El requisito duro del write se
   cumplió: valida contra `DOCTOR_TIERS` con case canónico y **rechaza** lo demás en vez de
   normalizarlo (§12.2).
2. **Prueba controlada en dr-prueba — PENDIENTE, es el siguiente paso**: downgrade desde el modal
   nuevo → verificar (rutas 403 `TIER_EXCLUDED` + el asistente sin facturas/fiscal y con `flujo`
   sin conciliación) → revertir. Mismo formato que el test en vivo de T2.
   > ⚠️ Es además el **primer clic real** sobre la UI de T5: se entregó con gates, tsc y smokes
   > contra prod, pero nadie había abierto el modal todavía.
3. **T4 — show-locked UI** (usa el marcador `TIER_EXCLUDED` del 403, ya verificado). **Antes de
   cualquier cliente REAL en CORE**: sin esto el doctor ve funciones bloqueadas sin saber por qué
   — el propio modal de T5 lo advierte al hacer un downgrade.
4. **T6 — degradación de cruces de flujo + auditoría de fuga read-only.** Que decida de una sola
   vez la política de `porOrigen` (sat_emitido/sat_recibido) Y la de reportes/analytics, en vez de
   caso por caso. Ver §11.6.

**Deuda anotada a propósito (no bloquea, decisión de 2026-07-25 de documentar y no arreglar):**
la fuga de `pagos` por el camino del agente —VIVA en prod con el member real— en
[`../NUEVOS USUARIOS/SESSION-REFRESCO.md`](../NUEVOS%20USUARIOS/SESSION-REFRESCO.md)
§"HUECO ABIERTO"; y las cards duplicadas (límite **L6**) en
`../AGENTES/AGENTE AGENDA/05-REFERENCIA-TECNICA-AGENTE.md` §11.

**Idea de fondo para cuando esto crezca** (no ahora): las cross-references de la prosa siguen
siendo texto escrito a mano; **generarlas desde el registry** —que solo puedan nombrar tools
presentes en el scope— mataría la clase entera por construcción en AMBOS ejes, sin duplicar nada.
Se evaluó separar suites de agente por tier y se DESCARTÓ: arregla el eje de tier (2 valores) y
deja intacto el de member (33 formas), que es justo donde vivió el peor bug de la sesión.

**Lo que YA existe y hay que reusar (no reinventar):** `tierAllows`, `tierRouteDecision`
(nearest-feature-key), `tiersExcluding`, `doctorTierAllows` en `@healthcare/database` ·
`Doctor.tier` (String, default FULL) · `resolveAgentScope` + `TOOL_FEATURE_KEY` +
`prompt.partial`/`prosaDependsOn` en el registry del agente · los gates
`check-route-permission-coverage.ts` y `check-agent-prose-references.ts`.

## Relación con otras carpetas

- **`../NUEVOS USUARIOS/`** — el sistema de permisos por-member que este feature reutiliza. El
  `01-DISENO-tecnico.md` de allá describe la "cintura estrecha" (`membership.ts`, los dos choke
  points) sobre la que se apila el tier.
- **`../AGENTES/`** — el agente compone su prompt/tools por módulos; el tier recorta módulos y
  tools (§5.2), lo que además BAJA el costo del agente en CORE (menos prefijo).
