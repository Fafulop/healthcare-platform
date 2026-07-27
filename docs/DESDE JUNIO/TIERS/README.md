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

## 🔴 HANDOFF — lee esto primero (cierre de sesión 2026-07-27)

**TIERS está COMPLETO salvo T6.** T1–T5 shipped, desplegados y **probados en vivo**. Lo que
bloqueaba poner a un cliente REAL en CORE (que el doctor viera POR QUÉ algo está bloqueado) quedó
cubierto hoy con T4. El gating sigue siendo **NO-OP**: los 11 doctores son FULL.

### Qué pasó hoy (2026-07-27)

| | |
|---|---|
| **Runbooks A y B** (prueba en vivo de T5) | ✅ Ejecutados. UI, write path y rutas OK; agente **3/4**. As-run en [`01-DISENO`](01-DISENO-tecnico.md) §12.6 |
| **Bitácora #28** — el agente FABRICABA conciliación | ✅ Fix de payload shipped (`762070bb`). Narración SAT **0 de 6 corridas**. ⚠️ Residuo ~50%, ver abajo |
| **T4** — candados + pantalla de plan | ✅ Shipped, desplegado y **probado en vivo** (`b5b54b65`), desktop **y móvil**. §13 |

### ⚠️ Acciones de USUARIO pendientes — NO dejan rastro en git, pregúntale antes de darlas por hechas

| # | Qué | Consecuencia si no se hace |
|---|---|---|
| 1 | **`NEXT_PUBLIC_SALES_EMAIL=hola@tusalud.pro`** en Railway (`@healthcare/doctor`) + **REDEPLOY** (es `NEXT_PUBLIC_*` ⇒ se inyecta en el BUILD; guardarla no basta) | La pantalla de plan explica el límite pero **no ofrece botón de contacto**. Confirmado NO hecho al cierre |
| 2 | **Rotar credenciales de MercadoPago de dr-prueba** (estuvieron públicas; el fix ya está desplegado, rotar ahora es seguro) | Tokens viejos siguen válidos |
| 3 | **Re-subir las firmas de 3 doctores reales** — o decidir aceptar el riesgo | Las URLs viejas siguen resolviendo |

### ⏭️ Lo que sigue en código: **T6**, y ya no es abstracto

Dos partes, ambas con evidencia real detrás:

1. **El residuo de conducta de #28 (~50%, 3 de 6 corridas).** Tras el fix de payload el agente ya NO
   inventa cifras de conciliación, pero la mitad de las veces **sustituye** (contesta con un volcado
   de flujo bajo el título de lo preguntado) o cierra con un **redirect a la sección Conciliación**,
   que en CORE es una puerta cerrada. Ficha canónica: `../AGENTES/AGENTE AGENDA/SESSION-REFRESCO.md`
   bitácora **#28**. ⚠️ **No hay fix limpio por prompt** — no se puede probar que un LLM nunca diga
   una frase; el eval `tier-core-conciliacion-no-inventa` queda como tripwire `soft`. La opción
   determinista (filtro post-generación que borre referencias a secciones excluidas) existe pero es
   un patrón NUEVO para este repo: decidirlo, no improvisarlo.
2. **La auditoría de fuga read-only** (reportes/analytics con cifras de CFDI/SAT) — lo que T6 siempre
   fue. La política de `porOrigen` **ya se decidió y se implementó** hoy; T6 hereda el resto.

### 🧭 Si eres una sesión nueva

1. Lee `01-DISENO-tecnico.md` §1–§2 (la decisión de arquitectura) y luego §13 (T4, lo último).
2. Para cualquier cosa del AGENTE, la ficha viva es la bitácora **#28** en
   `../AGENTES/AGENTE AGENDA/SESSION-REFRESCO.md` — y su lección generaliza: recortar tools necesita
   recortar **prosa Y payload Y filtros**; `gate:prosa` cubre los dos primeros, el payload **no tiene
   garantía de máquina**.
3. **Ojo con la suite de evals:** la última corrida completa dio **74/81 al 1er intento**; tras
   reintentos quedaron 5 flaky, 1 WARN estable (el caso nuevo de #28, esperado) y **1 FAIL estable
   AJENO**: `f2b-receptor-incompleto`, que es **drift de fixture** (el paciente Prueba1 ya no tiene
   citas), no un bug del agente. No lo persigas creyendo que es regresión.
4. **Al probar cualquier cosa de tiers: verifica en la BD que la cuenta esté REALMENTE en CORE.** Con
   los 11 doctores en FULL todo el feature es invisible por construcción, y "se ve bien" en una
   cuenta FULL no prueba absolutamente nada.

### ▶️ Runbook A — la UI de T5 (5 min, sin tocar datos)

1. Entrar al admin → **`/doctors`**. Debe aparecer una columna **"Plan"** entre Ciudad y Paleta.
2. **Esperado:** los 11 doctores con un chip azul **`FULL`**. Interpretación de los otros estados:
   - chip gris **`—`** ⇒ el admin NO recibió los tiers: el API no desplegó, o `GET
     /api/admin/doctor-tier` está fallando. NO es dato corrupto.
   - chip rojo **`⚠ <valor>`** ⇒ hay un valor NO canónico guardado (p.ej. `core` en minúsculas).
     Es la alarma real: `tierAllows` es fail-open, así que esa cuenta se comporta como FULL aunque
     la UI diga otra cosa. Se corrige guardando desde el mismo modal.
3. Clic en el chip → modal con FULL/CORE, la lista de lo que CORE excluye (derivada del registry),
   y dos avisos (downgrade = gating no borrado; y que sin T4 el doctor verá las secciones igual).
   **Cancelar** cierra sin escribir. "Guardar" queda deshabilitado si eliges el plan actual.

### ▶️ Runbook B — downgrade en vivo (dr-prueba, revertir al final)

> Formato idéntico al test en vivo de T2. **Solo dr-prueba**; ningún doctor real.

1. En `/doctors`, poner **dr-prueba en CORE** desde el modal. El chip debe volverse ámbar `🔒 CORE`.
2. **Rutas** (token real desde el doctor-app: `GET /api/auth/get-token` estando logueado como
   dr-prueba; ver `01-DISENO` de NUEVOS USUARIOS §9 para el método):
   - `GET /api/facturacion/profile` → **403 `TIER_EXCLUDED`**
   - `GET /api/sat-descarga/metadata` → **403 `TIER_EXCLUDED`**
   - `GET /api/practice-management/ledger` → **200** (CORE conserva flujo)
3. **Agente** (panel del doctor, cuenta dr-prueba):
   - "¿cuánto llevo este mes?" → responde con flujo (`get_balance`/`get_movimientos`).
   - "hazme una factura" → **declina por PLAN** (no por permisos del dueño, y sin mandarlo a otra
     sección). El módulo `facturas`/`fiscal` no existe en CORE.
   - "¿cómo va mi conciliación bancaria?" → declina; `get_conciliacion_bancaria` se cae en CORE
     aunque el módulo `flujo` siga vivo.
   - "¿tengo links de pago pendientes?" → **SÍ funciona** (CORE paga `pagos`; T3 rescata esas dos
     tools del módulo caído).
4. **REVERTIR a FULL** desde el mismo modal y confirmar que 2 y 3 vuelven a la conducta normal.
5. Anotar el resultado en `01-DISENO` §12.6. *(Ejecutado el 2026-07-27 — el as-run ya está ahí.)*

### ▶️ Runbook C — re-verificar el fix de seguridad (30 s, sin token)

```bash
U=https://healthcareapi-production-fb70.up.railway.app
for k in mpAccessToken mpRefreshToken stripeAccountId googleCalendarId telegramChatId \
         prescriptionSignatureUrl tier; do
  echo "$k: $(curl -s $U/api/doctors | grep -o "\"$k\":" | wc -l)"   # TODOS deben dar 0
done
curl -s $U/api/doctors | grep -o '"slug":' | wc -l                    # debe dar 11
curl -s -o /dev/null -w "%{http_code}\n" https://tusalud.pro/doctores/dra-adriana-michelle  # 200
```

Ya se corrió al desplegar y dio 0/0/0…, 11 y 200. `pnpm gate:payload` lo protege de aquí en
adelante. Regla general: `docs/NEW.MD-GUIDES/PUBLIC-API-PAYLOADS.md`.

## Estado (2026-07-25 · actualizado 2026-07-26)

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

**T4 SHIPPED y probado en vivo el 2026-07-27** (§13). Con eso, lo que bloqueaba poner a un cliente REAL en CORE queda cubierto; falta solo la variable del CTA. **La prueba en vivo de T5 se ejecutó el 2026-07-27** (`01-DISENO` §12.6): A y B completos, con la
UI, el write path y las rutas OK, y **un fallo reproducible del agente** en conciliación que NO
bloquea T4 (bitácora #28 → decisión en T6). **El siguiente paso concreto es ahora T4.**

✅ **El TRIPWIRE del agente quedó CUMPLIDO el 2026-07-25** (los 3 ítems: `gate:prosa`, el eval
`tier-core-completar-cita`, y `prosaDependsOn` extendido al eje de member). Detalle en
[`01-DISENO`](01-DISENO-tecnico.md) §11.5.1–§11.5.2. **Ya nada del agente bloquea un downgrade.**

**En orden:**

1. ✅ **T5 — selector de tier en el admin — SHIPPED** (`b5414a19`). El requisito duro del write se
   cumplió: valida contra `DOCTOR_TIERS` con case canónico y **rechaza** lo demás en vez de
   normalizarlo (§12.2).
2. ✅ **Prueba controlada en dr-prueba — EJECUTADA 2026-07-27** (`01-DISENO` §12.6). Downgrade
   desde el modal → 403 `TIER_EXCLUDED` en facturación y SAT, 200 en ledger → revertido a FULL
   (las 3 rutas vuelven a 200 **con el mismo token**: el JWT no lleva claim de `tier`, así que la
   lectura fresca de §5.4/G4 queda probada por estructura, no por observación). Agente **3/4**;
   el 4º —conciliación— falla reproducible (4 corridas): bitácora **#28**. **Fix de payload aplicado
   el mismo día** (narración SAT: 0 de 6 corridas); queda VIVO el residuo de sustitución/redirect (~50%, 3 de 6).
3. ✅ **T4 — show-locked UI — SHIPPED Y PROBADO EN VIVO 2026-07-27** (`01-DISENO` §13). Sidebar con candado (link,
   no item muerto: si no, el CTA solo se alcanza escribiendo la URL), pantalla de upsell derivada de
   `PERMISSION_LABELS`, y el chequeo de tier ANTES del bypass de owner (el techo acota al dueño).
   **Único pendiente: `NEXT_PUBLIC_SALES_EMAIL=hola@tusalud.pro` en Railway (redeploy después, es build-time).**
4. **T6 — degradación de cruces de flujo + auditoría de fuga read-only.** Que decida de una sola
   vez la política de `porOrigen` (sat_emitido/sat_recibido) Y la de reportes/analytics, en vez de
   caso por caso. Ver §11.6.
   > 🟡 **La parte de `porOrigen` YA se decidió y se implementó el 2026-07-27** (bitácora #28); lo que
   > T6 hereda es reportes/analytics + el residuo de conducta. La
   > prueba en vivo del 2026-07-27 midió 4/4 corridas en las que el modelo usa esos buckets para
   > inventar conciliación o narrar historia de la cuenta (bitácora **#28**). Y ojo con el alcance
   > al retomarlo: **`gate:prosa` no cubre esta clase** — mira prosa y descripciones, no payloads,
   > así que aquí no hay red de seguridad automática. Es el ítem de T6 con evidencia, no el de
   > política abstracta.

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
