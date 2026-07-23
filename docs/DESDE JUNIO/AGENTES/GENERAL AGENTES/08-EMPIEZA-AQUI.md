# 🧭 EMPIEZA AQUÍ — cómo está organizada esta documentación

> **Si eres un LLM en sesión nueva y te mandaron a leer este archivo: lee esto COMPLETO antes de
> tocar nada.** En ~5 minutos vas a saber (1) qué documenta esta carpeta, (2) dónde está cada
> cosa, (3) **dónde escribir cuando termines**, y (4) qué se verifica solo.
>
> Creado 2026-07-23, después de una pasada de alineación que encontró que 40+ docs se
> contradecían entre sí. Este doc describe el sistema que se puso para que no vuelva a pasar.

---

## 1. Qué se documenta aquí

**EL ASISTENTE**: un solo agente conversacional en el panel del doctor-app, que crece por
**módulos de dominio** (agenda · facturas · fiscal · flujo · expediente). No son varios agentes
que se hablan entre sí — esa decisión está tomada y no se re-litiga.

Las tres reglas que gobiernan todo el sistema (si vas a tocar código del agente, estas son
las que no se negocian):

| | |
|---|---|
| **Lecturas = autónomas** | Un error de lectura es texto equivocado, no daño |
| **Escrituras = propuesta → card → el doctor confirma → el CLIENTE ejecuta** | El servidor del agente jamás muta datos |
| **Regla 0: los veredictos de negocio se resuelven SERVER-SIDE** | El modelo nunca reconstruye semántica contando campos |

## 1.5 Los números que vas a ver (y cómo no confundirlos)

Estos 5 números aparecen por todos lados y **cuentan cosas distintas**. Si los mezclas, vas a
sacar conclusiones equivocadas sobre el tamaño o la salud del sistema:

| Número | Qué cuenta | Fuente en el código |
|---|---|---|
| **39** | **Tools** — las cosas que el agente PUEDE HACER | `ALL_TOOLS` del registry |
| **5** | **Módulos** de dominio (agenda · facturas · fiscal · flujo · expediente) | `AGENT_MODULES` |
| **65** | **Casos de eval** — las PRUEBAS que verifican que se comporta bien | `scripts/agenda-agent-evals.ts` |
| **19** | **Toggles de permiso** que el dueño prende/apaga a un member | `PERMISSION_KEYS` |
| **235** | **Rutas de API** clasificadas en el mapa de permisos | gate de cobertura de rutas |

**La confusión más fácil — tools vs evals.** Son ejes distintos, no dos conteos de lo mismo:

- Un **tool es una capacidad**: `get_bookings` (leer la agenda), `propose_create_cfdi` (armar
  una factura para que el doctor confirme). Hay **39**, repartidas: agenda 18 (8 lectura + 10
  propuesta) · facturas 12 · flujo 5 · fiscal 2 · expediente 2.
- Un **eval es una prueba**: "pregúntale *¿tengo citas vencidas?* y verifica que llame
  `get_bookings` con el flag server-side en vez de contar a mano". Hay **65**.

O sea: **39 cosas que sabe hacer, 65 pruebas que verifican que las hace bien.**

> ⚠️ **Y el error que de verdad pasó: 62 NO es un tamaño, es un RESULTADO.**
> La última corrida completa dio `62/65 PASS · 3 WARN · 0 FAIL`. Alguien escribió "suite 62"
> en dos docs, y de ahí se copió hacia adelante como si la suite tuviera 62 casos. **El
> puntaje de una corrida y el tamaño de la suite son cosas distintas** — al anotar un
> resultado, escríbelo siempre como `X/Y`, nunca solo `X`.
>
> `pnpm gate:docs` ya impide que ese error se cuele otra vez (§5) — pero el gate atrapa el
> síntoma; esta sección existe para que no lo cometas de entrada.

**Los otros dos números son de la feature de permisos, no del agente** (carpeta hermana
`NUEVOS USUARIOS`): 19 toggles y 235 rutas. El único punto donde se tocan con el agente es que
los permisos recortan qué módulos ve un member (`02-CAPACIDADES` §1.5).

**Dónde se declaran en presente:** los 3 primeros en `02-CAPACIDADES` §4; los 2 últimos en
`../../NUEVOS USUARIOS/05-COBERTURA`. En cualquier OTRO doc van con fecha (§3, y
`07-CONVENCIONES` §2).

## 2. La estructura, en una imagen

```
docs/DESDE JUNIO/AGENTES/
├── README.md                    ← índice general (carpetas, módulos, qué sigue)
├── GENERAL AGENTES/             ← LA CAPA QUE PEGA TODO (empieza por aquí)
│   ├── 08-EMPIEZA-AQUI.md       ← este archivo
│   ├── 00-BLUEPRINT             ← qué construimos, el playbook, escalamiento
│   ├── 02-CAPACIDADES           ← qué puede/no puede + LOS CONTEOS VIGENTES
│   ├── 05-METODO-code-review    ← cuándo un diff merece review completo
│   ├── 06-MAPA-superficie-IA    ← TODOS los endpoints LLM del app (no solo el agente)
│   ├── 07-CONVENCIONES-docs     ← las reglas de mantenimiento (detalle del §4 de aquí)
│   └── 01/03/04                 ← planes ya ejecutados (congelados)
└── AGENTE <DOMINIO>/            ← una carpeta por módulo
    ├── README.md                ← índice: qué está vivo y qué congelado
    ├── SESSION-REFRESCO.md      ← ESTADO VIVO — se lee primero, se escribe al final
    └── 00..09                   ← research, diseños, planes de PR (casi todos congelados)
```

**Carpetas por dominio:** `AGENTE AGENDA` (el tronco: tiene el playbook y **la bitácora de
fallos en vivo de TODOS los módulos**) · `AGENTE FACTURAS` (la más grande) · `AGENTE FLUJOS` ·
`AGENTE EXPEDIENTE` · `AGENTE KNOWLEDGE LAYER` · `AGENTE WHATSAPP` (dormida).

**Carpeta HERMANA — [`../../NUEVOS USUARIOS/`](../../NUEVOS%20USUARIOS/README.md):** usuarios
secundarios y los 19 toggles de permiso. Vive fuera de AGENTES porque es una feature de
producto, pero **sigue estas mismas convenciones** y está acoplada al agente por un punto: los
permisos recortan qué módulos ve un member (`02-CAPACIDADES` §1.5). Regla de reparto: los
hallazgos del AGENTE se documentan en `AGENTE */`, aunque los haya disparado esa feature.

## 3. Los 3 tipos de documento — la idea central

Todo doc es de UN tipo. **Solo dos se actualizan.** Esta es la regla que evita que los números
se copien hacia adelante a docs que debían quedar quietos:

| Tipo | Cómo lo reconoces | ¿Escribes en él? |
|---|---|---|
| **DECISIÓN / REFERENCIA** | Describe cómo son las cosas HOY (`00-BLUEPRINT`, `02-CAPACIDADES`, `05-METODO`, `06-MAPA`, `05-REFERENCIA-TECNICA`, los `06-KNOWLEDGE-BASE`) | ✅ **Sí** — es su trabajo estar al día |
| **ESTADO / BITÁCORA** | `SESSION-REFRESCO.md` y los `README.md` | ✅ **Sí** — al cerrar la sesión |
| **SNAPSHOT** | Abre con un banner `🔒 SNAPSHOT — <fecha>` | ❌ **No** — se congela. Si dijo algo falso, se ANOTA la corrección, no se borra |

> **Por qué no se borra un error en un snapshot:** varias lecciones de este proyecto nacieron
> de un doc equivocado (el sync de Google Calendar que nunca existió; la fórmula de impuestos
> que no vivía donde el doc decía). El error documentado explica la decisión que se tomó
> creyéndolo.

## 4. Dónde escribir cuando termines (la tabla que más vas a usar)

| Hiciste… | Escribe en… |
|---|---|
| Cualquier trabajo en un dominio | El `SESSION-REFRESCO.md` de ese dominio — **primero la cabecera "En una frase", luego el cuerpo** |
| Un fallo del agente en vivo | La **bitácora** de `AGENTE AGENDA/SESSION-REFRESCO.md` (fallo → causa raíz → fix → commit), aunque el fallo sea de otro módulo |
| Un módulo o tool nuevo | `02-CAPACIDADES` (matriz + §4) · `00-BLUEPRINT` §1 · el `SESSION-REFRESCO` del dominio · checklist completo en `07-CONVENCIONES` §5 |
| Cambiar los conteos (tools/módulos/evals) | **SOLO** `02-CAPACIDADES` §4, marcador `<!-- gate:... -->` **y** texto. Los demás docs los citan CON FECHA |
| Descubrir que un doc miente vs el código | Anota la corrección ⚠️ en el doc equivocado **y** en el drift-log del dominio (`07-CONVENCIONES` §4) |
| Cerrar un PR que ya shippeó | Ponle banner `🔒 SNAPSHOT` a su plan y mueve el estado al `SESSION-REFRESCO` |
| Hallazgos de evals/agentes | La carpeta `AGENTE */` correspondiente — **no** solo la carpeta de la feature que los disparó |

## 5. Qué se verifica solo (no depende de que alguien se acuerde)

```bash
pnpm gates          # corre los tres
pnpm gate:docs      # los números de los docs vs el código
pnpm gate:routes    # cobertura del mapa ruta→permiso
pnpm gate:prompt    # identidad de bytes del prompt del dueño
```

**`gate:docs`** (`scripts/check-docs-numbers.ts`) compara los marcadores de los docs contra el
código real y truena si no coinciden. Cubre **las dos carpetas hermanas**:

| Marcador | Doc que lo declara | Se compara contra |
|---|---|---|
| `gate:tools` · `gate:modules` · `gate:module-list` | `02-CAPACIDADES` §4 | `ALL_TOOLS` / `AGENT_MODULES` del registry |
| `gate:evals` | `02-CAPACIDADES` §4 | los casos de `agenda-agent-evals.ts` |
| `gate:toggles` | `../../NUEVOS USUARIOS/05-COBERTURA` | `PERMISSION_KEYS` |

Además asserta invariantes que nadie revisaba: que todo módulo esté en
`AGENT_MODULE_REQUIREMENTS` (si falta, queda bloqueado para members — fail-closed), que no haya
ids de eval duplicados, y que cada toggle tenga su fila en la matriz de cobertura.

Existe porque el error que más se propagó fue registrar la suite de evals como **62** — que era
el RESULTADO de una corrida (62/65 PASS), no su tamaño (**65**) — en los dos docs que debían
ser autoritativos.

**Corre `pnpm gates` antes de cualquier push** que toque el agente, los permisos o estos docs.

## 6. La arquitectura de este sistema de docs (por qué está así)

Tres capas, cada una tapando el agujero de la anterior:

1. **Contenido** — los docs, separados por tipo (§3). Resuelve *qué* se escribe y dónde.
2. **Convención** — `07-CONVENCIONES-docs.md`. Resuelve *cuándo* se actualiza y cuándo se
   congela. Pero una convención que nadie lee no hace nada, de ahí la capa 3.
3. **Enforcement** — `gate:docs` + el `CLAUDE.md` de la raíz del repo (que se carga solo en
   cada sesión y manda a leer este archivo). Resuelve que la convención **se cumpla sin
   depender de la memoria de nadie**.

El principio es el mismo que la regla 0 del agente, aplicado a la documentación:
**donde se pueda, el drift se vuelve imposible por construcción en vez de prevenido por
vigilancia.** Los conteos ya son mecánicos; la prosa sigue siendo disciplina (§3 y §4 son las
reglas para esa parte).

## 7. Ruta de lectura según lo que vengas a hacer

| Vengo a… | Lee, en orden |
|---|---|
| **Entender el sistema** | este doc → `00-BLUEPRINT` → `02-CAPACIDADES` |
| **Tocar un módulo** | el `SESSION-REFRESCO` de su carpeta → su `README` → el doc técnico que ese README señale |
| **Tocar el código del agente** | `AGENTE AGENDA/05-REFERENCIA-TECNICA` (arquitectura, loop, presupuesto) → `02-CAPACIDADES` (fronteras) |
| **Revisar un diff** | `05-METODO-code-review` (clasifica el diff ANTES de decidir la profundidad) |
| **Escribir/ordenar docs** | `07-CONVENCIONES-docs` |
| **Saber qué falta** | `../README.md` §"Qué sigue" y los `SESSION-REFRESCO` |

## 8. Las trampas conocidas (te van a morder si no las sabes)

- **La verdad es el CÓDIGO, no otro doc.** Todo invariante del prompt se verifica leyendo el
  código. Los docs de este repo han alucinado varias veces, y está documentado.
- **La cabecera de un `SESSION-REFRESCO` se actualiza PRIMERO.** El fallo #1 encontrado en la
  auditoría fue tener 4 docs con el resumen de arriba semanas atrás del cuerpo — y el resumen
  es justo lo primero que lee una sesión fría.
- **No confundas los 5 números del sistema** — sobre todo tools (39, capacidades) vs evals
  (65, pruebas), ni un resultado de corrida con el tamaño de la suite. Explicado en **§1.5**.
- **`prisma db push` revierte** el composite FK y los índices parciales que viven en prod.
- **No hay staging:** `main` despliega a producción. Todo SQL crudo o query shape nuevo se
  smoke-testea read-only contra prod ANTES del push.
- **Nunca commit/push sin explicar y recibir OK.** Una aprobación = un commit.

---

*Índice general: [`../README.md`](../README.md) · Reglas de mantenimiento en detalle:
[`07-CONVENCIONES-docs.md`](07-CONVENCIONES-docs.md) · Índice de esta carpeta:
[`README.md`](README.md).*
