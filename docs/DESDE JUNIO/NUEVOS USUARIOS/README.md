# 📁 NUEVOS USUARIOS — índice

> **Qué es esta feature.** Hasta ahora cada cuenta de doctor permitía UN solo usuario. Esta
> feature deja que el **dueño** invite **usuarios secundarios** (asistentes/staff) a su portal
> y les prenda/apague el acceso por bloque con **19 toggles** de permiso — incluyendo qué
> módulos del asistente de IA ven.
>
> 🔄 **Cada sesión, lee primero [`SESSION-REFRESCO.md`](SESSION-REFRESCO.md).**
> Es carpeta hermana de [`../AGENTES/`](../AGENTES/README.md) y sigue **sus mismas
> convenciones de documentación**:
> [`../AGENTES/GENERAL AGENTES/08-EMPIEZA-AQUI.md`](../AGENTES/GENERAL%20AGENTES/08-EMPIEZA-AQUI.md).

## Estado (2026-07-22) — COMPLETA Y EN PROD

v1 (PR A→D) + las dos extensiones están **shipped, desplegadas y validadas en vivo** con un
member real. Nada bloqueante abierto.

| Entrega | Estado |
|---|---|
| **v1** — membresías, 19 toggles, invitaciones, enforcement | ✅ PR A→D (`d6c48256`..`345b2a09`) + 3 rondas de bug hunt (9 bugs de la misma familia) |
| **Validación en vivo §9** | ✅ CERRADA — pasos 1-7 con `andreabarbagal@gmail.com` sobre dr-prueba |
| **Extensión A** — máximo 1 helper por doctor | ✅ `4666a9d1` — 2 índices parciales + checks, verificado en 3 capas |
| **Extensión B** — vista admin `/helpers` | ✅ `4403c6d3` + `64677f6f` |
| **Cobertura de los 19 toggles** | ✅ auditada — 16/19 con ruta server-side, 3 sin ella por diseño |
| **Evals del agente para members** | ✅ 3/3 · suite completa de owner 62/65 · 0 FAIL |
| **UI de grupos del Asistente IA en Equipo** | ✅ SHIPPED 2026-07-23 (`f791fc5f` + `1d54384c`) — colores/chips por módulo que muestran EN VIVO qué toggles faltan para que el agente funcione en cada dominio (§19) |

**Estado de los diferidos:** el guardarraíl del *over-claim* del agente member se **corrigió
2026-07-23** (fix + evals en `../AGENTES/AGENTE AGENDA/SESSION-REFRESCO.md` bitácora #24). Sigue
diferida la sub-prueba B2 del checkbox de factura (opcional, no bloquea). Detalle en el REFRESCO.

## Los docs

### Vivos (se actualizan)

| Doc | Qué es |
|---|---|
| [`SESSION-REFRESCO.md`](SESSION-REFRESCO.md) | **LÉEME PRIMERO** — estado, dónde quedó la validación en vivo, qué sigue, gotchas y el contexto de código para orientarse |
| [`01-DISENO-tecnico.md`](01-DISENO-tecnico.md) | **La referencia técnica profunda**: modelo de datos, los 3 puntos de resolución, el mapa ruta→toggle, el as-built y el review de cada PR, los 9 bugs del bug hunt (§16), el fix del ingreso server-side (§17), el cierre de la validación (§18) y la UI de grupos del Asistente IA en Equipo (§19) |
| [`02-METODO-review.md`](02-METODO-review.md) | **Cómo se revisa código de AUTORIZACIÓN.** Extiende el playbook general con 3 ángulos propios (bypass del matcher de rutas · escalación de privilegios · dirección de fallo) y con el método de bug hunt de "dos greps, no uno" |

### Snapshots (congelados — no se actualizan)

| Doc | Qué capturó, y para qué sirve hoy |
|---|---|
| [`00-REQUISITOS-usuarios-secundarios.md`](00-REQUISITOS-usuarios-secundarios.md) | 2026-07-20 · **El CONTRATO de la feature.** Las decisiones de producto que siguen gobernando el código y no se re-litigan: zonas owner-only permanentes, recetas = acto legal del doctor, la regla de dependencias cross-block, registry único fail-closed, y lo explícitamente fuera de v1 |
| [`03-PLAN-limite-1-helper.md`](03-PLAN-limite-1-helper.md) | 2026-07-22 · Extensión A. Lección reusable: **Prisma `P2002 meta.target` devuelve nombres de COLUMNA, no del índice** |
| [`04-PLAN-vista-admin-helpers.md`](04-PLAN-vista-admin-helpers.md) | 2026-07-22 · Extensión B. Gotcha: `/dashboard` no renderiza el Navbar, así que el link del Navbar no bastó |
| [`05-COBERTURA-19-toggles.md`](05-COBERTURA-19-toggles.md) | 2026-07-22 · Auditoría toggle-por-toggle. **Re-correr si se agregan toggles** o cuando `contenido` deje de ser placeholder |

## Lo que está garantizado por máquina (no por disciplina)

```bash
pnpm gate:routes   # las 235 rutas están clasificadas + fail-closed
pnpm gate:docs     # los 19 toggles del doc == PERMISSION_KEYS, y cada uno tiene fila en la auditoría
pnpm gates         # los tres gates del repo
```

**Fail-closed es la propiedad central:** una ruta que no esté en el mapa queda BLOQUEADA para
members. Una feature futura sin mapear no abre un hueco por olvido — lo cierra.

## Dónde escribir cuando termines

| Hiciste… | Va en… |
|---|---|
| Trabajo en la feature | `SESSION-REFRESCO.md` — **primero la cabecera de estado, luego el cuerpo** |
| Detalle técnico / as-built / review de un PR | la sección correspondiente de `01-DISENO-tecnico.md` |
| Agregar un toggle | el registry en código · re-correr `05-COBERTURA` · actualizar su marcador `gate:toggles` |
| **Hallazgos del AGENTE o de sus evals** | ⚠️ **la carpeta `../AGENTES/AGENTE */` correspondiente**, NO aquí. Este folder solo resume y cross-linkea (ver REFRESCO §3) |

## Dónde vive lo demás

- **El asistente de IA y sus módulos:** [`../AGENTES/`](../AGENTES/README.md) — en particular el
  filtrado de módulos por permisos, en
  [`../AGENTES/GENERAL AGENTES/02-CAPACIDADES`](../AGENTES/GENERAL%20AGENTES/02-CAPACIDADES-matriz-que-puede-y-que-no.md) §1.5.
- **El código:** `packages/database/src/permissions.ts` (los 19 toggles, sus etiquetas, y
  **`AGENT_MODULE_REQUIREMENTS`** = mapeo módulo del agente→toggles, fuente única compartida) ·
  `route-permissions.ts` (mapa ruta→toggle) · `membership.ts` (resolución) ·
  `apps/api/src/lib/auth.ts` + `apps/doctor/src/lib/medical-auth.ts` (los dos choke points) ·
  `apps/doctor/src/lib/permissions-client.ts` (`usePermissions()`, cortesía de UI) ·
  `components/profile/TeamSection.tsx` (pestaña Equipo + la UI de grupos del agente §19).
- **Convenciones de estos docs:** [`../AGENTES/GENERAL AGENTES/07-CONVENCIONES-docs.md`](../AGENTES/GENERAL%20AGENTES/07-CONVENCIONES-docs.md).
