# 💵 Cuánto cuesta cada doctor, y qué funciones de IA usa

> **Qué es este doc.** Cómo se mide el **dinero** que gasta cada doctor en LLM y **qué
> funciones** de IA usa realmente, dónde se ve, y las cuatro trampas que hacen que un número
> de costo se vea confiable y esté mal. **En prod desde el 2026-08-27** (`5a7f24c0`, los tres
> servicios verificados por commitHash).
>
> El inventario de QUÉ superficies existen está en
> [`01-INVENTARIO-donde-vive-cada-chat.md`](01-INVENTARIO-donde-vive-cada-chat.md).

---

## 1. Dónde se ve

| Pantalla del admin | Qué contesta |
|---|---|
| **`/llm-usage`** | Costo USD por doctor + KPI de costo total; se abre por endpoint |
| **`/feature-usage`** | Columna **Costo USD (est.)** en el grupo IA · y la matriz **"Uso de IA por función"**: doctor × función, sólo las funciones con uso real |

Los dos salen de `llm_token_usage`, que **ya registraba todo desde siempre**: el trabajo no fue
capturar datos, fue ponerles precio y nombre.

## 2. El dato base

`public.llm_token_usage` — una fila por llamada: `doctorId · endpoint · model · provider ·
promptTokens · completionTokens · totalTokens · budgetTokens · durationSeconds · surface ·
createdAt`. Las 19 superficies llaman `logTokenUsage`, así que la cobertura es total y
retroactiva.

## 3. Las CUATRO trampas del costo (medidas, no supuestas)

### 3.1 No se puede poner precio a un total de tokens

`gpt-4o-mini` y `claude-sonnet-5` difieren **~25×** en precio. Sumar sus tokens da **volumen,
no dinero**, y no hay ningún precio por el que multiplicarlo. Por eso las agregaciones van
`groupBy(['doctorId','model','provider'])` y se cobra cada cubeta aparte.

### 3.2 El asistente NO se cobra por `promptTokens` — se cobra por `budgetTokens`

`promptTokens` guarda el volumen de input **completo, incluidas las lecturas de caché**, que
se cobran al **10%**. Como el prefijo cacheado es la mayor parte del input del asistente,
cobrarlo completo lo infla:

> **Medido contra prod (90d): $4.46 con `budgetTokens` vs $17.57 cobrando `promptTokens` —
> 3.94× de sobreestimación.**

`budgetTokens` **YA es el costo**, expresado en tokens de input base: sus pesos (uncached×1 ·
cache read×0.1 · cache write×1.25 · output×5) **son** los múltiplos de precio de Anthropic, y
el output vale 5× el input tanto en Haiku 4.5 ($1/$5) como en Sonnet 5 ($2/$10). Costo =
`budgetTokens × precio_de_input`.

### 3.3 Whisper no se cobra por token

Sus filas traen `{promptTokens: 0, completionTokens: 0, totalTokens: 0}` y un
`durationSeconds`: OpenAI cobra **por minuto** ($0.006). Cobrarlas por token daría **$0.00
mientras se gasta dinero de verdad** — dr-prueba tenía **$0.1756** en 1,755 segundos.

⚠️ Corolario que confunde al leer el admin: la columna **"Tokens IA" no cuenta la voz**
(son 0 tokens), pero **"Costo USD" sí**. La función más usada por el doctor más activo es
invisible en la columna de tokens.

### 3.4 Un modelo sin precio devuelve `null`, jamás `0`

Un costo faltante y un costo real de $0 **se ven idénticos si los dos son 0**. `costOfUsd`
devuelve `null` para un modelo que no está en la tabla, un modelo sin precio **envenena** el
total de su doctor (mejor "n/d" que un número que calla lo que no supo contar), y la UI pinta
`n/d`.

> 🔴 Y el reverso, que costó un hallazgo de code review: **un doctor SIN una sola fila de IA
> vale `$0.00`, no `n/d`.** `/feature-usage` lista a TODOS los doctores; sin un 0 explícito
> caía en `undefined → null` y decía "no sé qué gastó" de **3 de los 12** doctores de prod,
> cuando la verdad es que no gastaron nada.

## 4. Qué usa cada doctor — y el endpoint que era un embudo

El mapa `endpoint → nombre humano` vive en **`apps/api/src/lib/llm-features.ts`** y las
etiquetas **viajan en la respuesta**: `apps/admin` es otro Next app que habla por HTTP, así que
un mapa duplicado allá serían dos verdades que se separan en silencio. Un endpoint sin
etiqueta sale con su nombre crudo y se **reporta** en la UI; no se cae de la tabla.

### 4.1 `surface` — de qué PANTALLA salió la voz

`voice-transcribe` lo llamaban **once** lugares distintos escribiendo el **mismo** `endpoint`,
así que *"¿este doctor usa la voz en NOTAS o en PLANTILLAS?"* no se podía contestar: 46 filas
de `gerardo` decían `voice-transcribe` y nada más. Ahora el cliente manda `surface` y se
guarda en `llm_token_usage.surface` (migración `add-llm-usage-surface.sql`, aditiva y
nullable, aplicada con `prisma db execute` — **nunca** `db push`).

🔴 **Sólo hacia adelante.** Las **114** filas históricas tienen `surface` NULL y se muestran
como *"Transcripción de voz (origen desconocido)"*. **No se puede deducir la pantalla hacia
atrás** — y por eso no se colapsan con las que sí se saben.

### 4.2 La trampa que casi se repite un nivel más abajo

El primer intento etiquetó cada **hook**, pero tres hooks son **compartidos**:
`useBasePracticeChat` cubre 4 funciones, y `useVoiceSession` / `useChatSession` **7 pantallas
cada uno**. Una constante por hook habría reintroducido exactamente el bug que `surface` viene
a arreglar, pero disfrazado de atribución precisa.

**Cómo quedó:** los dos hooks de voz ya recibían `sessionType` —que ES la pantalla— así que se
deriva de ahí (`lib/voice/surfaces.ts`); `useBasePracticeChat` exige `surface`
**sin default**, porque un default es justo lo que dejaría a un quinto consumidor volver a
colapsarlas.

> ⚠️ **Las llaves viven en DOS apps y no hay paquete compartido**: las emite
> `apps/doctor/src/lib/voice/surfaces.ts` y las etiqueta `VOICE_SURFACES` en
> `apps/api/src/lib/llm-features.ts`. Renombrar de un lado y no del otro deja etiquetas
> muertas y llaves sin nombre — **pasó en esta misma sesión**, al aplicar el arreglo de
> arriba. Reconciliación a mano mientras no sea un gate:
>
> ```bash
> grep -rn "append('surface'" apps/doctor/src --include=*.ts   # las que se emiten
> grep -E "^  '[a-z-]+':" apps/api/src/lib/llm-features.ts     # las que se conocen
> ```

## 5. El sesgo que queda, dicho a propósito

**El número de OpenAI es un TECHO, no una estimación centrada.** OpenAI cobra el input
cacheado a la mitad (gpt-4o $1.25 vs $2.50), pero `lib/ai/providers/openai.ts` no guarda
`prompt_tokens_details.cached_tokens`, así que aquí todo su input se cobra completo. Se
arregla capturando ese campo — pendiente.

**Y todo el costo es ESTIMADO a precios de HOY:** se calcula al leer, así que si un proveedor
cambia tarifas y actualizamos la tabla, **el costo del pasado cambia con ella**. Sirve para
decidir, no para cuadrar una factura. (Se evaluó guardar el precio por fila; se descartó
porque el pasado quedaría estimado igual — sólo el futuro sería exacto.)

## 6. Si tocas esto

- **Modelo nuevo** ⇒ agrégalo a `TOKEN_PRICES` (o `PER_MINUTE_PRICES`) en
  `apps/api/src/lib/llm-pricing.ts`, o su doctor entero se va a `n/d`.
- **Superficie nueva** ⇒ agrégala a `FEATURES` en `llm-features.ts`, o sale con su nombre
  crudo (visible, pero feo).
- **Pantalla nueva que transcribe voz** ⇒ manda `surface` en el FormData **y** agrega la llave
  en los dos archivos del §4.2.
- **Verificar contra prod** (read-only, método en
  [`../../flujo de dinero permutaciones/TOOLING-acceso-railway-db.md`](../../flujo%20de%20dinero%20permutaciones/TOOLING-acceso-railway-db.md)):
  un `groupBy` nuevo se smoke-testea **antes** del push, y el costo se contrasta con una cuenta
  hecha a mano — así se cazaron 3.2 y 3.3.

---

*Índice de esta carpeta: [`README.md`](README.md) · Las superficies:
[`01-INVENTARIO-donde-vive-cada-chat.md`](01-INVENTARIO-donde-vive-cada-chat.md).*
