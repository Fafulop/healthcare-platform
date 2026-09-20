# 💬 AYUDA WIDGET — el asistente que explica la app

> **Qué es.** Un botón de ayuda, en cualquier pantalla, que abre un chat donde el doctor
> pregunta **cómo funciona la app** y recibe el paso a paso, con un enlace a la pantalla que
> necesita. Lee **sólo documentación**: ni un dato del doctor, ni una escritura, ni una tool.
>
> **Por qué existe.** Los planes son baratos y algunos son gratis: **no hay forma de contratar
> gente que acompañe a cada doctor**. La ayuda tiene que escalar sin humanos, o los doctores se
> van.
>
> 🔄 **Sesión nueva:** lee [`00-POR-QUE`](00-POR-QUE-y-decisiones.md) completo. Las dos
> decisiones que más sorprenden —**no usar RAG** y **no meterlo en el Agente**— están ahí con
> los números que las sostienen.

---

## Estado: **NADA CONSTRUIDO.** 2026-09-20, sesión de diseño.

Lo que hay hoy es la línea de pensamiento y el plan. Ni una línea de código.

| Doc | Tipo | Para qué |
|---|---|---|
| [`00-POR-QUE-y-decisiones`](00-POR-QUE-y-decisiones.md) | DECISIÓN | El problema, lo que ya existe, y **por qué cada decisión** |
| [`01-ARQUITECTURA`](01-ARQUITECTURA.md) | DECISIÓN | Las 5 capas, el modelo intercambiable, la canalización de evals |
| [`02-PLAN-construccion`](02-PLAN-construccion.md) | PLAN | Las fases, en orden, y qué falta decidir |
| [`SESSION-REFRESCO`](SESSION-REFRESCO.md) | ESTADO | **Se lee primero y se escribe al final** |

*(Convenciones de tipos de doc: `../AGENTES/GENERAL AGENTES/08-EMPIEZA-AQUI.md` §3.)*

---

## Las tres cosas que hay que saber antes de opinar

**1. No es el Agente, y no debe serlo.** El Agente lee datos, propone escrituras y emite
veredictos de negocio — de ahí la regla 0, las cards y los permisos por módulo. Éste **sólo lee
un documento**. Cero tools, cero BD, cero escrituras. Meterlo en el Agente sería heredarle una
complejidad que no necesita.

**2. No lleva RAG, y se midió antes de decidirlo.** Las guías actuales tienen ~1,630 palabras;
documentar las 20 secciones del menú son ~15,000 tokens. **El manual completo cabe en un
prompt.** Trocear y embeber costaría 65 centavos menos al mes y traería de regalo el modo de
fallo que hace inventar a los modelos baratos: que la búsqueda no encuentre.

**3. El manual es el trabajo, no el código.** El widget se construye en días. El manual —el
conocimiento que hoy tendría una persona de soporte— son semanas, y es lo único que no se puede
automatizar.

---

## Lo que ya existe y sirve de base

- **`/dashboard/ayuda` ya es una guía real**: ~3,589 líneas (`CitasGuide`, `ExpedientesGuide`,
  `PagosGuide`), con Citas y Expedientes primero. `Perfil & Contenido` y `Gestión de Práctica`
  están puestas pero apagadas.
- **`scripts/demo-seed/seed-cardio.cjs`**: 8 expedientes de cardiología sembrados en dr-prueba
  **para grabar clips**.
- El molde de chat de `AgendaAgentPanel` (417 líneas), ya copiado por otros cuatro paneles.

---

## Relación con las otras carpetas

| Carpeta | Relación |
|---|---|
| [`../AGENTES/`](../AGENTES/README.md) | **El OTRO asistente.** Ese actúa sobre datos; éste sólo explica. Si algún día este widget lee datos del doctor, deja de ser este proyecto y pasa a ser un módulo de aquél |
| `../AGENTES/GENERAL AGENTES/06-MAPA-superficie-IA` | Documenta **todos** los endpoints LLM del app: cuando `/api/ayuda/chat` exista, se anota ahí |
| [`../NUEVOS USUARIOS/`](../NUEVOS%20USUARIOS/README.md) | El toggle `ayuda` ya existe y hoy sólo gatea la página en la UI |
| [`../TIERS/`](../TIERS/README.md) | El porqué de todo esto: planes baratos ⇒ sin soporte humano |

---

## ⏭️ Qué sigue

**Fase 0: auditar las guías que ya existen** contra la UI de hoy — se escribieron antes de las
cuatro mudanzas de menú del 2026-09-20.

Y antes de escribir código, cuatro decisiones ([`02-PLAN`](02-PLAN-construccion.md)):
qué modelo se prueba primero · si el widget vive en todas las pantallas · si una cuenta
congelada puede usarlo · **y quién escribe el manual**.
