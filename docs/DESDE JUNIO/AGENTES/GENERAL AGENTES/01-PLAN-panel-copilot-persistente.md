# 🖥️ Plan — panel copilot persistente (side-by-side, sobrevive navegación)

> **Qué es esto.** Diseño para convertir el panel del asistente de un popup atado a
> `/appointments` en un **panel lateral acoplado (docked) a nivel del app shell** — el patrón
> copilot (VS Code / Cursor / Notion AI): la pantalla del sistema se ENCOGE para hacerle lugar
> (no se tapa), y la conversación SOBREVIVE la navegación entre pantallas. Diseñado 2026-07-11
> contra el código real (archivos citados); implementación pendiente de OK.
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

*Relacionado: [`00-BLUEPRINT-asistente-modular.md`](00-BLUEPRINT-asistente-modular.md) (§4 qué
sigue), `AGENTE AGENDA/05-REFERENCIA-TECNICA` (el panel original). Estado: DISEÑO aprobado
pendiente de implementación.*
