# 🖥️ Plan — panel copilot persistente (side-by-side, sobrevive navegación)

> 🔒 **SNAPSHOT — 2026-07-11. SHIPPED a prod y verificado en vivo.** No se actualiza. Valor hoy:
> **§7** (cómo quedó vs el plan — incl. por qué hay DOS contexts y no uno), **§8** (los
> follow-ups F1–F4, que siguen abiertos) y **§9** (las lecciones de Tailwind, que mordieron dos
> veces el mismo día). Estado actual del asistente:
> [`../AGENTE AGENDA/SESSION-REFRESCO.md`](../AGENTE%20AGENDA/SESSION-REFRESCO.md).

> **Qué es esto.** Diseño para convertir el panel del asistente de un popup atado a
> `/appointments` en un **panel lateral acoplado (docked) a nivel del app shell** — el patrón
> copilot (VS Code / Cursor / Notion AI): la pantalla del sistema se ENCOGE para hacerle lugar
> (no se tapa), y la conversación SOBREVIVE la navegación entre pantallas. Diseñado 2026-07-11
> contra el código real (archivos citados).
>
> **ESTADO 2026-07-11: SHIPPED A PROD** (`03775778` panel + review fixes; `467f3923`,
> `85a652ca`, `8ee295df` ajustes post-deploy, ver §9). Verificado en vivo por el usuario:
> "working good in general". Ver §7 (desviaciones), §8 (follow-ups del review, siguen
> abiertos) y §9 (ajustes de espacio post-deploy).
>
> Resuelve de paso la pregunta abierta "¿el panel se monta también en /facturacion?" — se
> monta en TODAS las pantallas.

---

## 1. Estado actual (verificado)

- `AgendaAgentPanel` (`apps/doctor/src/app/appointments/_components/AgendaAgentPanel.tsx`) es
  `position:fixed` (overlay derecha en desktop / bottom-sheet en móvil, `z-[60]`), montado
  DENTRO de `appointments/page.tsx:259` — solo existe en esa página.
- El estado vive en `useAgendaAgent` (`hooks/useAgendaAgent.ts`): messages, budget, proposals
  con status de ejecución client-side. **Muere al navegar.**
- Acoplamiento único con la página: `onAgendaChanged` → `fetchRanges/fetchBlockedTimes/
  fetchBookings` (refresco tras ejecutar propuestas).
- **Hallazgos clave del design pass:**
  - Los dos árboles de rutas (`app/appointments/layout.tsx` y `app/dashboard/layout.tsx`)
    renderizan el MISMO `components/layout/DashboardLayout.tsx` (`flex h-screen`, sidebar +
    `<main>`) — y son sus ÚNICOS 2 consumidores. Un solo punto de montaje cubre todo.
  - PERO son layouts hermanos: navegar entre árboles DESMONTA todo lo que viva dentro de
    ellos (providers incluidos). La persistencia exige el estado en `app/layout.tsx` (root),
    que ya tiene un `SessionProvider` client donde anidar.
  - `authFetch` (`lib/auth-fetch.ts`) es independiente de la página (getSession +
    `/api/auth/get-token`) y `/api/agenda-agent` es ruta relativa del doctor-app → el
    executor y el chat funcionan desde cualquier pantalla sin cambios.
  - Los modales de la app (`fixed z-50`) cubren correctamente un panel acoplado (en flujo,
    sin z-index).

## 2. Arquitectura: estado en el root, UI en el shell

```
app/layout.tsx (root, NUNCA se desmonta)
 └─ SessionProvider (ya existe)
     └─ AgentProvider (NUEVO — estado: messages/budget/proposals/isOpen)
         └─ … layouts por árbol …
             └─ DashboardLayout (compartido por ambos árboles)
                 ├─ Sidebar │ <main> (se encoge) │ AgentDock (NUEVO wrapper del panel)
                 └─ móvil: bottom-sheet fixed (comportamiento actual intacto)
```

## 3. Pasos (6) y archivos

1. **`contexts/AgentContext.tsx` (nuevo):** lift de `useAgendaAgent` a un provider montado en
   el ROOT layout. `useAgendaAgent` queda como wrapper de `useContext` — el interior del panel
   casi no cambia. Agrega `isOpen` persistido en `localStorage` (mismo patrón que
   `widgetsCollapsed`). ⚠️ El root también envuelve `/login` y `/consent`: el provider debe
   ser INERTE al montar (cero fetches; `refreshBudget` se dispara al ABRIR el panel, no al
   montar) — la UI solo se renderiza dentro de `DashboardLayout`.
2. **Registro de refresco** (reemplaza el callback): el provider expone
   `subscribeAgendaChanged(cb)` → la página de appointments registra sus 3 fetches en un
   `useEffect` (des-registra al desmontar). Tras ejecutar propuestas, el provider notifica a
   los suscritos ACTUALES. Páginas sin suscripción = sin refresco automático (igual que hoy
   desde cualquier otra página). Futuro: facturación/ledger se suscriben cuando F2 escriba.
3. **Render acoplado en `DashboardLayout`:** desktop (`lg+`): el panel como hermano flex de
   `<main>` (`w-96 shrink-0 border-l`, sin `fixed`, sin z-index — side-by-side real). Móvil:
   bottom-sheet actual sin cambios. El chrome del panel (header, BudgetBar, mensajes, cards)
   se reusa tal cual.
4. **Affordance global de apertura:** tab delgado en el borde derecho (mismo patrón que el
   toggle de widgets existente, offset arriba de él) visible en toda pantalla + el botón
   "Asistente" de `/appointments` pasa a llamar `open()` del context. Estado abierto persiste
   entre navegación y reloads.
5. **Interacción con el stack de widgets flotantes** (`VoiceAssistantHubWidget`,
   `DayDetailsWidget`, `ChatWidget` v1 — `fixed right-*`, `z-[51]` en ambos layouts): con el
   panel acoplado abierto en desktop flotarían ENCIMA del panel. Fix barato: offsetear el
   stack a la izquierda por el ancho del panel vía CSS variable en el layout cuando
   `isOpen && lg+`. (El retiro del ChatWidget v1 sigue siendo alcance de PR 4 — no se
   bundlea.)
6. **Sin cambios:** servidor (run-turn/módulos/prompt: CERO), semántica del executor (las
   cards pendientes sobreviven navegación gratis al vivir en el provider; `executeOne` usa
   authFetch), UX móvil.

## 4. Gaps encontrados en el re-check (además del plan original)

| # | Gap | Mitigación |
|---|---|---|
| G1 | El root layout envuelve `/login` y `/consent` — un provider con fetch-on-mount dispararía llamadas sin sesión | Provider inerte al montar; `refreshBudget` solo al abrir el panel (hoy ya es así: el panel lo llama al abrir) |
| G2 | Crecimiento sin tope de `messages` en un provider que vive todo el día (el server ya recorta history a -12, pero el CLIENTE renderiza todo) | Cap de render (últimos ~50 mensajes con "ver anteriores") o aceptar y vigilar — decidir en implementación; el botón "Limpiar" ya existe |
| G3 | `useAgendaAgent()` hoy crea estado por-caller; con context, DOS montajes del panel duplicarían UI sobre el mismo estado | El panel se monta UNA vez (en `DashboardLayout`), nunca por página; el botón de appointments solo llama `open()` |
| G4 | BudgetBar puede quedar stale si el panel queda abierto cruzando medianoche MX o entre días | Ya existente (no lo introduce este cambio); `refreshBudget` en cada `sendMessage` ya lo corrige de facto — no bloquea |

## 5. Riesgos y decisiones

- **Desktop angosto (1024–1280px):** con el panel abierto el contenido queda a ~640-900px.
  **Decisión: estilo Copilot — el contenido se encoge igual** (las tablas de /appointments ya
  son responsivas tras la compactación de `5e123efb`); si duele en la práctica, un umbral de
  auto-overlay es un follow-up de una línea de CSS.
- **Verificación** (sin evals — cero cambios de prompt/tools; review tier: pasada inline,
  refactor mecánico de UI cuyo fallo se auto-anuncia visualmente):
  1. conversación sobrevive `/appointments` → `/dashboard/facturacion` → `/dashboard/practice/flujo-de-dinero` y de regreso;
  2. card pendiente propuesta en `/appointments`, confirmada desde `/dashboard/facturacion` — ejecuta y el turno de verificación llega;
  3. refresco de agenda tras ejecutar DESDE appointments (suscripción activa) y desde otra página (sin crash, sin refresco);
  4. móvil: bottom-sheet idéntico; 5. `/login` sin efectos del provider; 6. widgets no tapan el panel.
- **Fuera de alcance:** contexto de pantalla al modelo ("estás viendo /facturacion" en el
  bloque temporal — barato y cache-safe, pero es un cambio de COMPORTAMIENTO del agente →
  PR aparte con evals); retiro del ChatWidget v1 (PR 4); persistencia server-side de la
  conversación (gap G10 conocido, otro tema).

## 6. Estimación

~6 archivos: 1 nuevo (`AgentContext`), 4 editados (`app/layout.tsx`, `DashboardLayout.tsx`,
`AgendaAgentPanel.tsx`, `appointments/page.tsx`), `useAgendaAgent.ts` reescrito como wrapper.
Sin migraciones, sin cambios de API, sin evals. Riesgo concentrado en G1/G3 y el CSS del
paso 5.

---

## 7. Cómo quedó implementado (2026-07-11) — desviaciones del plan

- **`useAgendaAgent` se ELIMINÓ, no quedó como wrapper** (paso 1 del plan): su único consumidor
  era el panel, que ahora lee el context directo — un wrapper sin consumidores era código muerto.
- **DOS contexts en vez de uno** (hallazgo #1 del review): `useAgentActions()` (isOpen/open/
  close/subscribeAgendaChanged, memoizado, solo cambia al abrir/cerrar) y `useAgentChat()`
  (messages/loading/executing/budget — SOLO el panel lo consume). Con un context único, cada
  mensaje del chat re-renderizaba la página de appointments completa + Sidebar/BottomNav.
  Regla: layouts y páginas usan `useAgentActions`; jamás `useAgentChat` fuera del panel.
- **El panel vive en `components/agent/AgendaAgentPanel.tsx`** (salió de
  `appointments/_components/`); el executor y tipos en `contexts/AgentContext.tsx`.
- **Input bloqueado con `loading || executing`** (hallazgo #5): un mensaje enviado a media
  ejecución corría en paralelo con el turno de verificación y le metía historia stale
  (pre-existente, byte-idéntico en el hook viejo — se corrigió de paso).
- **La suscripción de appointments es un effect plano** con los fetchers en deps — los 3 son
  useCallback-estables (`[doctorId, selectedDate]`/`[doctorId]`); el plan de ref-indirection
  se descartó (su justificación era factualmente incorrecta).
- **Widgets flotantes:** además del offset `--agent-dock`, se removió un `lg:right-6` residual
  al final del className multilínea de los 3 botones que COMPETÍA con el nuevo
  `lg:right-[calc(…)]` (dos utilidades lg:right-* en el mismo elemento = gana el orden del CSS
  generado, no el del className — el offset podía no aplicar nunca). Cazado por el review.

## 8. Follow-ups del review (confirmados, difieren — no bloquean)

| # | Hallazgo | Severidad | Fix barato |
|---|---|---|---|
| F1 | Tablet 640–1023px: panel overlay z-[60] tapa los 3 botones flotantes (z-50) y el toggle (z-51) — PRE-EXISTENTE en /appointments; el refactor lo extiende a todas las páginas y lo hace persistente | media (UX tablet) | decidir: offsetear widgets también en sm:, u ocultarlos con panel abierto |
| F2 | Ancho del dock codificado a mano en ~7 sitios/5 archivos (`24rem` ×2 layouts, `sm:w-96` panel, 4 calc pegados); elementos fixed futuros flotarán SOBRE el panel por default | media (mantenimiento) | subir stack de widgets + toggle + var `--agent-dock` a DashboardLayout (verificado factible: los widgets no usan providers de los tree layouts) — natural hacerlo junto con la fusión /appointments→/dashboard/appointments |
| F3 | G2 del plan quedó resuelto implícitamente como "aceptar": messages crece sin tope toda la sesión (el reset por navegación del diseño viejo ya no existe) | baja (~300-400 msgs en un día extremo, "Limpiar" resetea) | `messages.slice(-50)` al render + `React.memo(MessageBubble)` |
| F4 | Con panel abierto, cada cruce appointments↔dashboard re-dispara GET /api/agenda-agent (remount del panel); tras reload con panel persistido-abierto, dispara sin acción del usuario | baja (1 aggregate de prisma, cero LLM; el invariante duro G1 en /login/consent SÍ se sostiene) | guard `budget != null` o mover el trigger a `open()` |

**Refutados por el verify (no son bugs):** falta de `min-w-0` en `<main>` (overflow-y-auto
computa overflow-x:auto → min-width resuelve a 0, main SÍ encoge); "el feedback de ejecución
se pierde por el guard de loading" (el closure stale lo brinca — siempre se envía; el bug real
en esa ruta era el de historia stale, ya corregido con `loading || executing`, ver §7).

## 9. Ajustes de espacio post-deploy (2026-07-11, hallados usando el panel en prod)

El "desktop angosto" de §5 resultó real en la práctica; en vez del umbral auto-overlay se
recuperó espacio en el contenido:

- **`467f3923`** — filas de botones/filtros de /appointments con `sm:flex-wrap`: un flex row
  NO envuelve por default; los 8 botones del header exigían su ancho completo y con el panel
  docked empujaban la página más allá del viewport (arrastrando la tabla).
- **`85a652ca`** — tabla Todas las Citas: columnas EXPEDIENTE y CONTACTO fusionadas (chip +
  tel/email apilados; emails con `break-all` para no dictar el min-width). Interactivos
  verificados: el dropdown de búsqueda ancla a su propio wrapper, no a la celda.
- **`8ee295df`** — **sidebar colapsable a solo-iconos** (toggle persistido en
  `sidebarCollapsed`): recupera 12rem. Implementación: `data-collapsed` en el `<aside>` +
  variantes `group-data-[collapsed]` — verificadas COMPILADAS en el CSS de prod, y su
  especificidad (0,2,0) garantiza el override sobre las utilidades base (0,1,0).
  ⚠️ Lección Tailwind (dos veces hoy): dos utilidades de la MISMA propiedad y mismo nivel
  (`lg:right-6` vs `lg:right-[calc(…)]`, `justify-end` vs variante `justify-center`) se
  resuelven por orden del CSS generado, no del className — usar condicional o variante con
  mayor especificidad.

---

*Relacionado: [`00-BLUEPRINT-asistente-modular.md`](00-BLUEPRINT-asistente-modular.md) (§4 qué
sigue), `AGENTE AGENDA/05-REFERENCIA-TECNICA` (el panel original). Estado: SHIPPED; quedan
los follow-ups de §8.*
