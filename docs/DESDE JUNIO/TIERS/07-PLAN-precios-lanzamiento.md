# 07 — PLAN: precios del lanzamiento (2026-10) — GRATIS + un plan de pago barato

> **Estado (2026-10-01): DECISIONES DEL USUARIO tomadas (§1 y §6). No hay código.** Cambia lo que se VENDE, no la maquinaria: los 4 tiers (`FREE/BASICO/PRO/LAB`), el cobro con
> Stripe (C1–C3) y el gating por llaves (`TIER_EXCLUDED_KEYS`) siguen; aquí se ajustan sus números y se
> agregan tres cosas nuevas: topes de IA en DINERO, topes de FACTURAS por mes y paquetes de ALMACENAMIENTO.

## 1. Lo que decidió el usuario (2026-10-01)

| | **Gratis** (`FREE`) | **Plan de pago** (`BASICO`, re-precio) |
|---|---|---|
| Precio | $0 | **$250 MXN + IVA al mes** |
| Pacientes activos | **30** (antes 50) | sin tope |
| Almacenamiento | **1 GB** (antes 500 MB) | **25 GB** (antes 15 GB) + **paquetes de 50 GB a $50 MXN + IVA al mes**, los que quiera |
| Facturas (CFDI) | **5 al mes**; no puede más (para más, se pasa al de pago) | **25 al mes incluidas**; cada una de más se cobra en la siguiente factura a **$1 MXN + IVA** |
| IA — armar plantillas con IA (`form-builder-chat`) | **tope $1 USD al mes** | **tope $2 USD al mes** |
| IA — widget de ayuda «?» (`ayuda/chat`) | **tope $1 USD al mes** | **tope $2 USD al mes** |
| Resto de la IA (asistente, chats de captura, voz, informe…) | apagada | apagada (por ahora) |
| Al llegar a un tope de IA | «Llegaste al límite de este mes» | «Llegaste al límite de este mes» |

- **Periodo de los topes:** el **mes calendario**, se reinicia el día 1 (hora de México).
- **PRO y LAB:** los doctores que ya están ahí **se quedan como están** (ni se mueven ni cambian sus
  topes). Simplemente no se venden.
- Se venden sólo **Gratis** y el **plan de pago**.

## 2. Lo que ya existe y se reusa

| Pieza | Dónde | Para qué |
|---|---|---|
| Topes por tier (pacientes, almacenamiento) | `packages/database/src/permissions.ts` (`TIER_LIMITS`, `storageBytesFor`, `maxPatientsFor`, `assertStorageQuota`) | Cambiar números (§3 P1) y sumar paquetes (§3 P5) |
| Qué llaves excluye cada tier | `TIER_EXCLUDED_KEYS` (hoy FREE: `facturacion, sat, conciliacion, ia`; BASICO: `ia`) | Abrir facturación a FREE (§3 P2) |
| Uso de IA por doctor | tabla `llm_token_usage` (doctor, `endpoint`, modelo, tokens, fecha) — `form-builder-chat` y `ayuda/chat` YA escriben ahí | Calcular el gasto del mes en dólares (§3 P3) |
| Tope diario del widget | `ayuda/chat` ya cuenta preguntas por día | Se suma el tope en dinero |
| Precio de cada plan en Stripe | tabla `TierPrice` (`stripePriceId → tier`), webhook `apps/api/src/lib/cobro-webhook.ts` | Nuevo precio de $250 + IVA para BASICO (§3 P6) |
| Facturas emitidas | `CfdiEmitted` (por perfil fiscal del doctor) | Contar las del mes (§3 P4) |

## 3. Cómo se construye (propuesta, cada paso con su plan y su OK)

| Paso | Qué | Riesgo |
|---|---|---|
| **P1** | **Topes de FREE:** 1 GB y 30 pacientes; BASICO 25 GB. Un FREE que HOY tenga más de 30 activos **no pierde nada**: sólo no puede dar de alta más hasta bajar de 30 (es como funciona el cupo hoy). Medir antes cuántos FREE pasan de 30. | Bajo |
| **P2** | **Facturación en FREE** (quitar `facturacion` de sus exclusiones) con el tope de 5/mes de P4. | Medio: abre una sección entera a FREE — revisar que todo lo de facturar respete el tope |
| **P3** | **Topes de IA en dólares:** precio por modelo (tabla en código, re-verificable) × tokens del mes por `endpoint`; antes de cada llamada de `form-builder-chat` y `ayuda/chat`, si el gasto del mes ≥ tope → «Llegaste al límite de este mes». Abrir esas DOS herramientas a FREE/BASICO; el resto de la IA sigue apagada. | Medio: el costo por modelo debe medirse bien (lección: un número de tokens sin su modelo es una trampa) |
| **P4** | **Facturas por mes:** contar los CFDI timbrados del mes; FREE se detiene en 5 («Llegaste a tus 5 facturas del mes; con el plan de pago tienes 25»); BASICO sigue después de 25 y cada extra se **anota** para cobrarse. | Medio |
| **P4b** | **Cobrar las facturas extra** en la siguiente factura de Stripe ($1 + IVA c/u): al cerrar el mes, un *invoice item* en la suscripción del doctor. | Medio: toca el cobro — con el banco de pruebas de `06-OPERACION` |
| **P5** | **Paquetes de 50 GB** ($50 + IVA/mes, los que quiera): un segundo concepto en la suscripción con **cantidad**; el tope de almacenamiento = 25 GB + 50 GB × cantidad. Comprarlos y quitarlos desde Mi Cuenta. | Medio: toca el cobro |
| **P6** | **Precio nuevo de BASICO** ($250 + IVA) en Stripe + `TierPrice`; Mi Cuenta, la pantalla de cobro y el sitio público (`/producto`, que duplica a propósito el reparto por plan) dicen lo nuevo. | Bajo, pero muchos textos |
| **P7** | **Ayuda** (otro capítulo): pestañas por menú generadas del manual + página «Flujos» con videos — después de P1–P6, para que digan lo que de verdad incluye cada plan. | — |

Orden sugerido: **P1 → P3 → P2+P4 → P6 → P4b → P5** (lo que no toca el cobro primero; lo que cobra al
final y con el banco de pruebas).

## 4. Cuidados

- **Cobro:** P4b y P5 crean cargos en Stripe — modo prueba primero, el ciclo completo con
  `scripts/tiers-lifecycle/` (`06-OPERACION`), y el doble paso de siempre (Stripe Y la base).
- **IVA:** $250 + IVA = $290 al mes; los precios en pantalla dicen «+ IVA» o el total — decidir uno (§6).
- **El tope de IA es en dólares** (lo que cobra el proveedor); el doctor no ve dólares: ve «te queda X% de
  tu IA del mes» o sólo el aviso al llegar.
- **El sitio público y el manual** cambian en el mismo commit que la pantalla de planes.

## 5. Lo que NO cambia

PRO y LAB (quien esté ahí sigue igual); la maquinaria de tiers, permisos y cobro; el resto de la IA
apagada en FREE/BASICO como hoy.

## 6. Decisiones finales del usuario (2026-10-01)

1. **Descarga SAT:** sólo el plan de pago (Gratis sigue sin ella).
2. **Conciliación bancaria:** está OCULTA y no se usará — no entra en ningún plan del lanzamiento.
3. **Las facturas CANCELADAS cuentan** para el tope del mes (el timbre ya se gastó). Pendiente: verificar
   cuánto cuesta un timbre en Facturama — si cuesta más de $1, el extra a $1 + IVA pierde dinero.
4. **Precio en pantalla:** «$250 + IVA» y el total **$290** (250 × 1.16).
5. **Nombres en pantalla: «Gratis» y «Pro».** Internamente el plan de pago sigue siendo **BASICO**
   (re-precio): el tier `PRO` de hoy es el de los doctores que se quedan como están, con TODA la IA, y no
   puede ser el mismo. Recomendación pendiente de OK: en el admin, los `PRO` de antes se rotulan
   «Pro (anterior)» para no confundirlos con el nuevo «Pro» (= BASICO); los doctores no ven ese rótulo.
