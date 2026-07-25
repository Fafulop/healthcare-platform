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

## Estado

📋 **DISEÑO — sin implementar.** Este doc es el plan; nada shippeado. Secuencia de PRs en §8.

## Relación con otras carpetas

- **`../NUEVOS USUARIOS/`** — el sistema de permisos por-member que este feature reutiliza. El
  `01-DISENO-tecnico.md` de allá describe la "cintura estrecha" (`membership.ts`, los dos choke
  points) sobre la que se apila el tier.
- **`../AGENTES/`** — el agente compone su prompt/tools por módulos; el tier recorta módulos y
  tools (§5.2), lo que además BAJA el costo del agente en CORE (menos prefijo).
