# NUEVOS USUARIOS — Auditoría de cobertura: bloqueo por los 19 toggles

> 🔒 **SNAPSHOT — 2026-07-22, con condición de re-corrida.** Es una auditoría MANUAL: la
> cobertura "cada RUTA está mapeada" sí es garantía de máquina (`pnpm gate:routes`, 235 rutas
> + fail-closed), pero **"cada TOGGLE bloquea algo" NO lo es** — es esta tabla, a mano.
> 👉 **Re-córrela si se agregan toggles, o cuando `contenido` deje de ser un placeholder**
> (ver §"Los 3 sin ruta"). Mientras tanto, lo no-mapeado bloquea a members por default.
>
> **Estado original:** AUDITORÍA 2026-07-22 (verificada contra código). Confirma que el bloqueo de members
> está cubierto para los 19 toggles. Fuentes: `packages/database/src/route-permissions.ts`
> (`ROUTE_PERMISSION_MAP` = servidor, la frontera real; `PAGE_PERMISSION_MAP` = sidebar/PermissionGate),
> `Sidebar.tsx`, `01-DISENO §4`.

## Principio

La **frontera real es server-side** (`ROUTE_PERMISSION_MAP`, chequeada en los dos choke points de
auth). La UI (sidebar + PermissionGate) es cortesía encima. Garantía estructural: el gate
`scripts/check-route-permission-coverage.ts` asserta que las **235 rutas** están clasificadas, y
lo no-mapeado = **fail-closed** (member → 403). Así, una feature futura sin mapear bloquea a members
por default — no se puede dejar un hueco abierto por olvido.

## Matriz (19/19 cubiertos)

<!-- Marcador verificado por scripts/check-docs-numbers.ts contra PERMISSION_KEYS.
     El gate también asserta que cada key tenga su fila en la tabla de abajo. -->
<!-- gate:toggles=19 -->

| # | Toggle (key) | Enforcement server-side | UI |
|---|---|---|---|
| 1 | Editar Perfil (`perfil`) | ✅ `doctors`(write)/`reviews`/`settings`/`doctor`(write) | ✅ página |
| 2 | Perfil Público (`perfil_publico`) | — por diseño (la página pública ES pública) | ✅ esconde el link externo |
| 3 | Contenido Audiovisual (`contenido`) | — sin feature aún (página "Próximamente") | ✅ página |
| 4 | Mi Blog (`blog`) | ✅ `articles`, `doctors/*/articles` | ✅ |
| 5 | Mis Citas (`citas`) | ✅ `appointments`/`calendar`/`doctors/*/availability` | ✅ |
| 6 | Expedientes (`expedientes`) | ✅ `medical-records`/`custom-templates`/`doctor/pdf-settings` | ✅ |
| 7 | Tareas (`tareas`) | ✅ `medical-records/tasks` (más específico gana) | ✅ |
| 8 | Notas (`notas`) | ✅ `notes` | ✅ |
| 9 | Reportes (`reportes`) | ✅ `analytics`/`llm-usage` | ✅ |
| 10 | Flujo de Dinero (`flujo`) | ✅ `practice-management/ledger` | ✅ |
| 11 | Pagos (`pagos`) | ✅ `stripe`/`mercadopago` (+ `/connect/status` split) | ✅ |
| 12 | Facturación (`facturacion`) | ✅ `facturacion` (+ `csd/status`; `csd` upload OWNER_ONLY) | ✅ |
| 13 | Descarga SAT (`sat`) | ✅ `sat-descarga` (+ `fiel` GET; POST/DELETE OWNER_ONLY) | ✅ |
| 14 | Conciliación (`conciliacion`) | ✅ `conciliacion-bancaria`/`bank-statement-import`/`-parse` | ✅ |
| 15 | Ventas (`ventas`) | ✅ `ventas`/`cotizaciones`/`clients` | ✅ |
| 16 | Compras (`compras`) | ✅ `compras`/`proveedores` | ✅ |
| 17 | Productos (`productos`) | ✅ `products`/`product-attributes`/`areas` | ✅ |
| 18 | Ayuda (`ayuda`) | — contenido estático, sin API | ✅ página/PermissionGate |
| 19 | Asistente IA (`asistente_ia`) | ✅ `agenda-agent` (+ filtrado de módulos, PR C) | ✅ gate del panel |

## Los 3 sin ruta server-side — correcto por diseño

- **`perfil_publico`**: no hay nada que bloquear (la página pública es pública); el toggle solo
  esconde el link de conveniencia en el sidebar (`Sidebar.tsx:148` — `{can('perfil_publico') && <a…>}`).
- **`ayuda`**: ayuda estática, sin endpoint de datos. Gateada en UI (sidebar + PermissionGate).
- **`contenido`**: la página `contenido-audiovisual` es un placeholder "Próximamente" (sin llamadas
  API). Gateada en UI. Cuando se construya la feature real, sus rutas deben mapearse a `contenido`
  (mientras tanto, no-mapeado = fail-closed protege a members).

## Notas (no son huecos)

1. **Hoy la media/carrusel del doctor se administra bajo `perfil`** (en `mi-perfil` →
   `MediaSection`, escribe vía `doctors`), NO bajo el toggle `contenido`. El toggle "Contenido
   Audiovisual" controla solo el placeholder vacío; al construir la feature dedicada, mapear sus
   rutas a `contenido`.
2. Los OWNER_ONLY quirúrgicos dentro de bloques permitidos (subida de CSD/FIEL, connect de
   pagos, emisión de receta, superficies IA legacy, Equipo/Integraciones) están cubiertos aparte
   (`01-DISENO §4.3`), no son parte de los 19 toggles de member.
3. La cobertura "cada RUTA está mapeada" es garantía de máquina (gate de 235 rutas). La cobertura
   "cada TOGGLE bloquea algo" NO es de máquina — es esta auditoría manual (3 toggles legítimamente
   sin ruta). Re-correr esta auditoría si se agregan toggles o features.

---

*Creado 2026-07-22. Verificado contra `route-permissions.ts` (ROUTE_PERMISSION_MAP + PAGE_PERMISSION_MAP),
`Sidebar.tsx`, y la ausencia de rutas API para contenido/ayuda/perfil-publico (find sobre app/api).*
