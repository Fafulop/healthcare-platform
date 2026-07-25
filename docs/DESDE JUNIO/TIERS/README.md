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

## Estado (2026-07-25)

🟢 **T1 + T2 SHIPPED a prod y probados en vivo** (`c639a0ca`, `8e7097e1`). El gating YA enforcea
en los 3 sitios (2 choke points owner+member + public/cron), pero es **NO-OP: los 11 doctores son
FULL** y `tierAllows(FULL,*)=true`, así que nadie está gateado todavía. Test en vivo pasó
(dr-prueba→CORE: facturación+SAT dieron 403 `TIER_EXCLUDED`, flujo 200; revertido→FULL).

🟡 **T3 — agente tier-aware — CONSTRUIDO 2026-07-25, PENDIENTE DE PUSH.** El agente ya compone
módulos **y tools** por plan: CORE conserva `flujo` sin `get_conciliacion_bancaria`, dropea
`fiscal`, y **rescata las tools de `pagos`** del módulo `facturas` que se cae (corrección al
diseño — CORE paga `pagos`). Prefijo CORE **−21%** y 26 tools vs 39. El prompt del owner FULL
quedó **byte-idéntico** (sha256 sin cambio) ⇒ cero invalidación de cache en prod. Gates verdes,
tsc limpio, **14/14 evals de frontera** al 1er intento (la suite pasa a **76** casos). As-built,
las 4 correcciones al diseño y lo que queda abierto: [`01-DISENO`](01-DISENO-tecnico.md) §11.

### ⏭️ Qué sigue

- **Pushear T3** (explicación + OK del usuario, regla del repo). **Hasta que T3 esté DESPLEGADO,
  no pongas a ningún doctor real en CORE**: sin él, el asistente de un CORE intentaría tools de
  facturas/fiscal y chocaría con los 403 de T2.

> 🚧 **TRIPWIRE — antes de mover al PRIMER doctor real a CORE** (no bloquea el push de T3, que es
> NO-OP mientras todos sean FULL; sí bloquea el primer downgrade real):
> 1. **Gate de referencias cruzadas en prosa**: escanear la prosa y las descripciones de cada
>    módulo buscando nombres `get_*`/`propose_*`, y assertar que cada uno viva en ESE módulo o
>    esté declarado en `prompt.prosaDependsOn`. Hoy la clase "el texto que sobrevive sigue
>    vendiendo lo que el plan quitó" se previene por DISCIPLINA (acordarse de declarar la
>    dependencia); esto la vuelve imposible por construcción — el espíritu de
>    `../AGENTES/GENERAL AGENTES/08-EMPIEZA-AQUI.md` §6.
> 2. **Eval `tier-core-completar-cita`**: el flujo MÁS común de una cuenta CORE sigue sin
>    ejercitarse de punta a punta (es justo donde vivían 3 de los 6 sitios del bug hunt §11.5).
> *(El 3er ítem —"`prosaDependsOn` solo mira el TIER"— se **CERRÓ** el 2026-07-25: ahora se evalúa
> contra lo que el toolset PROVEE, así que cubre también la ausencia por toggles de member.
> Ver §11.5.1.)*
- **Decisión pendiente del usuario (no bloquea):** cerrar o no la fuga PREEXISTENTE de member que
  destapó el review — un member con `facturacion`+`sat` pero `pagos` OFF igual recibe las tools de
  links de pago, porque el gating de member es por MÓDULO. Detalle en `01-DISENO` §11.6.
- **T4** show-locked UI (usa el marcador `TIER_EXCLUDED` del 403, ya verificado) · **T5** selector
  de tier en admin (⚠️ el write DEBE validar contra `DOCTOR_TIERS` con case canónico — `tierAllows`
  es case-sensitive + fail-open) · **T6** degradación de cruces de flujo + audit de fuga read-only
  (incluye la política de `porOrigen` sat_emitido/sat_recibido, ver §11.6).
- Lo que YA existe y hay que reusar (no reinventar): `tierAllows`, `tierRouteDecision`
  (nearest-feature-key), `tiersExcluding`, `doctorTierAllows` en `@healthcare/database`;
  `Doctor.tier` (String, default FULL); el gate de cobertura de tier en
  `scripts/check-route-permission-coverage.ts`.

## Relación con otras carpetas

- **`../NUEVOS USUARIOS/`** — el sistema de permisos por-member que este feature reutiliza. El
  `01-DISENO-tecnico.md` de allá describe la "cintura estrecha" (`membership.ts`, los dos choke
  points) sobre la que se apila el tier.
- **`../AGENTES/`** — el agente compone su prompt/tools por módulos; el tier recorta módulos y
  tools (§5.2), lo que además BAJA el costo del agente en CORE (menos prefijo).
