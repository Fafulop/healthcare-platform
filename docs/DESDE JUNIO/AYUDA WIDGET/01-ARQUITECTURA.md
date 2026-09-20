# 🏗️ Arquitectura del widget de Ayuda

> **Tipo: DECISIÓN / REFERENCIA.** Cómo está armado y por qué cada costura está donde está.
>
> Creado el **2026-09-20**. El *por qué* de las decisiones grandes vive en
> [`00-POR-QUE`](00-POR-QUE-y-decisiones.md).

---

## 1. Las cinco capas, y por qué están separadas

El requisito que manda es **poder cambiar el modelo sin tocar nada más, y poder medir si una
respuesta empeoró**. Eso obliga a que cada capa tenga una sola razón para cambiar:

```
┌──────────────────────────────────────────────────────────────────┐
│ 5. PANEL        botón flotante + chat, en cualquier pantalla     │
│                 (el molde de AgendaAgentPanel, sin cards)        │
├──────────────────────────────────────────────────────────────────┤
│ 4. ENDPOINT     POST /api/ayuda/chat — sin tools, sin BD          │
├──────────────────────────────────────────────────────────────────┤
│ 3. PROVEEDOR    una interfaz. OpenAI/Anthropic detrás, por ENV    │
├──────────────────────────────────────────────────────────────────┤
│ 2. PROMPT       arma el system prompt: manual + reglas + rutas    │
├──────────────────────────────────────────────────────────────────┤
│ 1. MANUAL       manual-del-doctor.md — LA FUENTE ÚNICA           │
└──────────────────────────────────────────────────────────────────┘
```

**La prueba de que la separación es real:** cambiar de modelo debe tocar **una variable de
entorno**; cambiar una explicación debe tocar **un archivo .md**; y ninguna de las dos cosas
debe obligar a tocar la otra.

---

## 2. Capa 1 — El manual es la fuente única

Un solo archivo Markdown, versionado en git, escrito para el DOCTOR (no para nosotros).

**Por qué Markdown y no las guías JSX que ya existen:** el JSX de `/dashboard/ayuda` dibuja
botones y flechas — es bueno para LEER, pésimo para meter en un prompt. El manual es el texto
plano del que salen las dos cosas.

> ⚠️ **La relación entre el manual y las guías JSX hay que decidirla, no dejarla pasar.** Si
> las dos existen y se escriben aparte, en tres meses se contradicen — que es exactamente el
> problema que `08-EMPIEZA-AQUI` documenta para los docs de AGENTES. Opciones en
> [`02-PLAN`](02-PLAN-construccion.md) §5.

**Estructura obligatoria:** encabezados estables y citables (`## Agenda` → `### Agendar sin
rango`), porque **la cita de la respuesta apunta a un encabezado**. Renombrar un encabezado
rompe citas viejas; es el único cambio del manual que tiene consecuencia.

---

## 3. Capa 3 — El proveedor, intercambiable de verdad

Una interfaz mínima, **una sola implementación por proveedor**, y quien la llama no sabe cuál
está detrás:

```ts
export interface ProveedorLLM {
  readonly id: string;                  // 'gpt-4o-mini' · 'claude-haiku-4-5'
  responder(input: {
    system: string;
    mensajes: Mensaje[];
  }): Promise<{ texto: string; tokensEntrada: number; tokensSalida: number }>;
}
```

Tres cosas que esto compra, y hay que exigirlas las tres:

1. **Cambiar de modelo = una variable de entorno** (`AYUDA_MODELO`), sin deploy de código.
2. **Correr los evals contra DOS modelos** y comparar, que es la única forma de saber si el
   barato alcanza.
3. **El costo se registra igual para todos**: la fila de `llm_token_usage` se escribe en la
   capa del endpoint, no dentro de cada proveedor.

> 🔴 **La trampa, ya aprendida en este proyecto:** un número de tokens o un precio **sin su
> modelo al lado es una trampa**. El mismo prompt da 28,045 tokens en Sonnet y 22,821 en Haiku.
> Toda medición de este widget se anota como `<número> con <modelo>`, siempre.

Precios de referencia (de `apps/api/src/lib/llm-pricing.ts`, verificados 2026-08-27, USD/1M):
`gpt-4o-mini` $0.15/$0.60 · `claude-haiku-4-5` $1/$5 · `gpt-4o` $2.50/$10 · `claude-sonnet-5`
$2/$10.

---

## 4. Capa 2 — El prompt, y las tres reglas que lo gobiernan

Se arma de tres piezas: **el manual entero**, **las reglas de conducta**, y **el mapa de rutas**.

1. **Sólo desde el manual.** Si la respuesta no está en el texto, no se deduce: se dice.
2. **Citar la sección** de la que salió cada respuesta.
3. **«No sé» es una respuesta VÁLIDA y premiada**, con la salida: a qué sección ir, o
   escríbenos.

> 🔴 Un prompt que diga *«deduce»*, *«infiere»* o *«calcula»* es deuda: funciona con un modelo
> caro y se rompe callado en cuanto se baja al barato — que aquí es el plan desde el día uno.

**El mapa de rutas es CURADO, nunca compuesto.** Una tabla `ruta → para qué sirve` que se le
entrega al modelo, y del que sólo puede citar. Nunca se le deja armar URLs: una URL inventada
manda al doctor a un 404 con toda la confianza del mundo.

---

## 5. Capa 4 — El endpoint

`POST /api/ayuda/chat`. Lo que NO tiene es la mitad del diseño:

| | |
|---|---|
| ❌ tools | no hay nada que ejecutar |
| ❌ acceso a la BD del doctor | no lee ni un paciente |
| ❌ escrituras | ninguna, nunca |
| ❌ permisos por módulo | la respuesta no depende de los datos de quien pregunta |
| ✅ auth | sí: es para doctores, no para internet |
| ✅ registro de tokens | en `llm_token_usage`, con su modelo |
| ✅ tope de mensajes | una conversación de ayuda no necesita memoria infinita |

**Una cuenta CONGELADA debería poder usarlo.** Es justo quien más preguntas tiene («¿cómo
recupero mi información?»). Eso implica meter el prefijo en `RUTAS_DE_CUENTA_CONGELADA` — hay
que decidirlo explícitamente, porque el default es que quede bloqueada.

---

## 6. Capa 5 — El panel

**Reusar el molde de `AgendaAgentPanel`** (417 líneas), que es la plantilla que ya copiaron los
otros cuatro chats (`EncounterChatPanel`, `PatientChatPanel`, `PrescriptionChatPanel`,
`LedgerChatPanel`).

> ⚠️ **Hoy ese molde es un patrón COPIADO, no un componente compartido.** Este widget sería el
> sexto. Es el momento razonable para extraer la cáscara común — pero eso toca cuatro chats que
> funcionan, así que es una decisión aparte, no un efecto colateral de esta feature.

Diferencias con el panel del Agente:
- **Sin cards de confirmación** (no propone acciones).
- **Botón flotante global**, no atado a una pantalla: el doctor se atora en cualquier lado.
- **Sabe desde dónde se abrió** — la ruta actual se manda como contexto para poder contestar
  «en esta pantalla, el botón que buscas es…». Es la ÚNICA señal de contexto que recibe.

---

## 7. La canalización de evaluación

Sin esto, «funciona bien» es una opinión. Con el patrón que ya se usa en el agente:

```
scripts/ayuda-evals.ts
  caso = { pregunta, debeCitar: 'Agenda > Agendar sin rango', noDebeDecir: [...] }
```

Qué se mide, y por qué cada cosa:

| Métrica | Por qué |
|---|---|
| **¿Citó la sección correcta?** | Es el proxy verificable de «no inventó» |
| **¿Dijo «no sé» cuando debía?** | Casos a propósito FUERA del manual. El más importante |
| **Costo y tokens, con su modelo** | Para comparar barato vs caro con números |
| **¿Mandó a una ruta viva?** | Contra el mapa curado |

> 🔴 **Dos lecciones de este proyecto que aplican tal cual:** una corrida no distingue una
> regresión del ruido — hay que comparar DOS corridas. Y **un eval en verde puede estar
> afirmando algo falso**: el check mira la forma de la respuesta, no su verdad. Al cambiar un
> hecho del manual hay que leer las respuestas de los casos que afirmaban lo viejo.

---

## 8. Dónde va cada cosa en el repo (propuesta)

```
docs/DESDE JUNIO/AYUDA WIDGET/        ← esta carpeta
apps/doctor/src/lib/ayuda/
  ├── manual-del-doctor.md            ← LA FUENTE ÚNICA
  ├── mapa-de-rutas.ts                ← ruta → para qué sirve (curado)
  ├── prompt.ts                       ← arma el system prompt
  └── proveedores/                    ← openai.ts · anthropic.ts
apps/doctor/src/app/api/ayuda/chat/route.ts
apps/doctor/src/components/ayuda/AyudaWidget.tsx
scripts/ayuda-evals.ts
```

**Por qué en `apps/doctor` y no en `apps/api`:** el manual es del doctor-app y no lo consume
nadie más. Si algún día lo necesita el sitio público, se mueve a un paquete — no antes.
