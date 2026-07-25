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

## Estado (2026-07-24)

🟢 **T1 + T2 SHIPPED a prod y probados en vivo** (`c639a0ca`, `8e7097e1`). El gating YA enforcea
en los 3 sitios (2 choke points owner+member + public/cron), pero es **NO-OP: los 11 doctores son
FULL** y `tierAllows(FULL,*)=true`, así que nadie está gateado todavía. Test en vivo pasó
(dr-prueba→CORE: facturación+SAT dieron 403 `TIER_EXCLUDED`, flujo 200; revertido→FULL). Detalle
y secuencia de PRs en [`01-DISENO`](01-DISENO-tecnico.md) §8.

### ⏭️ Qué sigue (para la próxima sesión)

- **PR T3 — agente tier-aware (EL SIGUIENTE, es prerrequisito).** El agente NO lee tier todavía,
  así que un doctor CORE tendría su asistente intentando tools de facturas/flujo y chocando con
  los 403 nuevos. **NO pongas a NINGÚN doctor real en CORE hasta T3.** T3 = gating a nivel de tool
  (CORE conserva el módulo flujo sin `get_conciliacion_bancaria`, dropea facturas/fiscal) — y de
  paso ABARATA el agente CORE. Diseño en `01-DISENO` §5.2.
- **T4** show-locked UI (usa el marcador `TIER_EXCLUDED` del 403, ya verificado) · **T5** selector
  de tier en admin (⚠️ el write DEBE validar contra `DOCTOR_TIERS` con case canónico — `tierAllows`
  es case-sensitive + fail-open) · **T6** degradación de cruces de flujo + audit de fuga read-only.
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
