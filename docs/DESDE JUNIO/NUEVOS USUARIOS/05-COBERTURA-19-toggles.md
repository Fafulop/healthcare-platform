# NUEVOS USUARIOS — Auditoría de cobertura: bloqueo por los 19 toggles

> 🔒 **SNAPSHOT — 2026-07-22, con condición de re-corrida.** Es una auditoría MANUAL: la
> cobertura "cada RUTA está mapeada" sí es garantía de máquina (`pnpm gate:routes`, 236 rutas
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
`scripts/check-route-permission-coverage.ts` asserta que las **236 rutas** están clasificadas, y
lo no-mapeado = **fail-closed** (member → 403). Así, una feature futura sin mapear bloquea a members
por default — no se puede dejar un hueco abierto por olvido.

## Matriz (19/19 cubiertos)

<!-- Marcador verificado por scripts/check-docs-numbers.ts contra PERMISSION_KEYS.
     El gate también asserta que cada key tenga su fila en la tabla de abajo. -->
<!-- gate:toggles=19 -->

| # | Toggle (key) | Enforcement server-side | UI |
|---|---|---|---|
| 1 | Editar Perfil (`perfil`) | ✅ `doctors`(write)/`reviews`/`settings`/`doctor`(write) | ✅ página |
| 2 | Perfil Público (`perfil_publico`) | — por diseño (la página pública ES pública) | ⚠️ **ya no esconde nada** (2026-09-20, ver abajo) |
| 3 | Contenido Audiovisual (`contenido`) | — sin feature aún (página "Próximamente") | ✅ página **+ pestaña** (2026-09-20) |
| 4 | Mi Blog (`blog`) | ✅ `articles`, `doctors/*/articles` | ✅ página **+ pestaña** (2026-09-20) |
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

### ⚠️ 2026-09-20 — `blog` y `contenido` ahora se ven en DOS lugares

Las dos entradas salieron del menú y son **pestañas de «Perfil Público»**
(`/dashboard/mi-perfil`): un artículo del blog ES perfil público. Lo que hay que
saber para que esta auditoría siga siendo cierta:

- **Sus rutas siguen vivas** (`/dashboard/blog`, `/dashboard/contenido-audiovisual`).
  No se duplicó nada: el contenido vive en `components/profile/BlogSection.tsx` y
  `ContenidoSection.tsx`, y las rutas son cáscaras que los renderizan.
- **Las rutas se conservaron A PROPÓSITO.** La pestaña está dentro de una página
  que exige `perfil`, así que un member con `blog` pero **sin** `perfil` sólo
  puede llegar por URL. Sigue teniendo el permiso entero; lo que perdió es el
  renglón del menú. Se aceptó ese costo (decisión del usuario) porque ese reparto
  —blog sí, perfil no— hoy no lo usa nadie.
- **Cada pestaña se filtra por SU toggle** (`can('blog')`, `can('contenido')`), no
  por el de la página: entrar ya exige `perfil`, pero eso no es razón para
  enseñarle a un member una pestaña que su dueño no le dio.
- El bloqueo **server-side no cambió**: `articles` y `doctors/*/articles` siguen
  bajo `blog`. La frontera real está donde estaba.

## Los 3 sin ruta server-side — correcto por diseño

- **`perfil_publico`**: no hay nada que bloquear (la página pública es pública); el toggle solo
  escondía el link de conveniencia en el sidebar.

  > ⚠️ **2026-09-20 — este toggle ya NO controla nada, y es a propósito.** El link externo se
  > quitó de los dos menús y se mudó DENTRO de `/dashboard/mi-perfil` (es el resultado de lo que
  > se edita ahí). Esa página exige el toggle **`perfil`**, así que a un member con
  > `perfil_publico` pero sin `perfil` ya no le queda ningún camino: el `can('perfil_publico')`
  > que sigue dentro de la página no puede conceder nada que la puerta de afuera no conceda ya.
  >
  > **Se decidió dejarlo así** en vez de deshacer la mudanza o retirar el toggle. Lo que se
  > "pierde" es un atajo a una **URL pública** —el member siempre pudo teclearla—, no un permiso:
  > ningún dato queda más o menos expuesto. Retirar el toggle en cambio tocaría los 19, esta
  > auditoría y `apps/public/src/lib/product-content.ts`, que lo anuncia como función aparte.
  >
  > **Dos consecuencias que hay que conocer antes de "arreglarlo":**
  > 1. La entrada del menú que apunta al editor ahora se LLAMA «Perfil Público» (decisión del
  >    usuario) pero la controla el toggle `perfil`, cuya etiqueta en `PERMISSION_LABELS` es
  >    «Editar Perfil». La cabecera de ese archivo dice que es el ÚNICO lugar donde vive esa copia
  >    «para que nunca se separe de la etiqueta del sidebar»: **hoy están separadas, a sabiendas.**
  > 2. La pantalla de invitación sigue ofreciendo encender «Perfil Público», que no hará nada
  >    visible. Es confuso para quien da de alta a un auxiliar, y es lo único que valdría la pena
  >    limpiar algún día.
- **`ayuda`**: ayuda estática, sin endpoint de datos. Gateada en UI (sidebar + PermissionGate).
- **`contenido`**: la página `contenido-audiovisual` es un placeholder "Próximamente" (sin llamadas
  API). Gateada en UI. Cuando se construya la feature real, sus rutas deben mapearse a `contenido`
  (mientras tanto, no-mapeado = fail-closed protege a members).

## ⚠️ 2026-09-25 — Fugas por CAMPO: una ruta de un toggle sirve datos de OTRO

Esta auditoría (y el gate de rutas) responde "¿cada RUTA exige su toggle?". **No** responde "¿lo que
la ruta DEVUELVE es sólo de ese toggle?". Un review de VISITAS D2 encontró rutas que exigen un toggle
y devuelven datos de otros. Ningún gate lo detecta: se revisa a mano, campo por campo.

**Regla para arreglarlas:** ver DATOS depende sólo del toggle del member; **dueño y admin ven todo,
sin techo del plan** (el plan recorta funciones por ruta, no la lectura de lo que ya es del doctor:
con el techo, un dueño FREE dejaba de ver sus facturas). Helper: `puedeVer` en
`apps/doctor/src/lib/visitas.ts`. Sin permiso, la llave NO viaja, y la respuesta dice qué permisos
aplican (una lista vacía por falta de permiso no puede leerse como "no hay").

| Ruta (toggle que exige) | Qué filtraba / filtra | Estado |
|---|---|---|
| `GET medical-records/patients/[id]/bookings` (`expedientes`) | citas, precio y cobro, links de pago, **factura (RFC, total)** | ✅ **Arreglada 2026-09-25** — `lib/booking-permisos.ts` (`citas`/`flujo`/`pagos`/`facturacion`) + la sección «Citas e Ingresos» del expediente |
| `GET medical-records/tasks/calendar` (`tareas`) | citas con **teléfono, correo, notas y precio del paciente** | ✅ **Arreglada 2026-09-25** — sin `citas` sólo tareas (`citasOcultas`); falla de la llamada → `citasIncompletas`. ⏳ Falta que la UI de Pendientes pinte esos dos avisos |
| 🔴 `GET appointments/slots` en apps/api (**PÚBLICA, sin sesión**) | nombre, correo, teléfono, notas, precio y **`confirmationCode`** de cada cita activa de cualquier doctor — y con el código se **cancela** la cita sin sesión | ✅ **Cerrada 2026-09-25**: exige sesión (dueño / member con `citas` / admin). Las 3 llamadas server-side de apps/doctor mandan token (`lib/api-slots.ts`) |
| 🔴 `GET appointments/bookings/[id]` en apps/api (**PÚBLICA**) | la fila COMPLETA de la cita por id: datos del paciente, `confirmationCode`, `reviewToken` | ✅ **Cerrada 2026-09-25**: sin sesión sólo por CÓDIGO y sólo lo que pinta la página pública de cancelar; con sesión, sólo el doctor de la cita |
| 🔴 `doctors/[slug]/telegram` y `google-calendar/status` (sesión, **sin dueño**) | cualquier doctor logueado leía/cambiaba el chat de Telegram de OTRO doctor y recibía sus avisos (paciente, teléfono, código) | ✅ **Cerrada 2026-09-25**: `requireDoctorOwnsSlug` en `apps/api/src/lib/auth.ts` |
| Códigos ya expuestos | los `confirmationCode` leídos antes del cierre seguían sirviendo para cancelar | ✅ decisión del usuario: **regenerar** — `scripts/security/rotate-confirmation-codes.cjs`, corrido 2026-09-25 DESPUÉS del cierre: primero las 37 futuras, luego `--incluir-pasadas` (**201 = TODAS las activas**, 11 doctores; 164 eran citas pasadas nunca concluidas que con un código filtrado se podían cancelar). Lectura de vuelta: 0 con el código viejo. Los correos/SMS ya enviados muestran el código viejo: cancelar en línea con ése ya no funciona (hay que llamar). La bitácora no registra QUIÉN cancela: no se puede saber si hubo abuso; la línea base de cancelaciones (13–33/mes) no muestra picos |
| `GET appointments/bookings` en apps/api (`citas`) y tools del agente de agenda (`tools.ts:203, 488`) | monto e ingreso, forma de pago, "facturada", links de pago, precio | 🟠 pendiente (sin `flujo`/`facturacion`/`pagos`) |
| `GET/PATCH medical-records/patients/[id]` (`expedientes`) | datos fiscales del paciente (RFC, razón social, constancia) — **ver y EDITAR** | ❓ **decisión del usuario:** ¿son del expediente o de facturación? |
| `timeline` y `formularios` del paciente (`expedientes`) | día y hora de la cita ligada a un formulario | 🟡 menor |

## Notas (no son huecos)

1. **Hoy la media/carrusel del doctor se administra bajo `perfil`** (en `mi-perfil` →
   `MediaSection`, escribe vía `doctors`), NO bajo el toggle `contenido`. El toggle "Contenido
   Audiovisual" controla solo el placeholder vacío; al construir la feature dedicada, mapear sus
   rutas a `contenido`.
2. Los OWNER_ONLY quirúrgicos dentro de bloques permitidos (subida de CSD/FIEL, connect de
   pagos, emisión de receta, superficies IA legacy, Equipo/Integraciones) están cubiertos aparte
   (`01-DISENO §4.3`), no son parte de los 19 toggles de member.
3. La cobertura "cada RUTA está mapeada" es garantía de máquina (gate de 236 rutas). La cobertura
   "cada TOGGLE bloquea algo" NO es de máquina — es esta auditoría manual (3 toggles legítimamente
   sin ruta). Re-correr esta auditoría si se agregan toggles o features.

---

*Creado 2026-07-22. Verificado contra `route-permissions.ts` (ROUTE_PERMISSION_MAP + PAGE_PERMISSION_MAP),
`Sidebar.tsx`, y la ausencia de rutas API para contenido/ayuda/perfil-publico (find sobre app/api).*
