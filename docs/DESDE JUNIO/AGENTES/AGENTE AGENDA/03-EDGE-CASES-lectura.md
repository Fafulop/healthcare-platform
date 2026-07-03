# Edge cases del agente (fase lectura) — catálogo y estado

> **Qué es esto.** Análisis sistemático (2026-07-03) de dónde el agente puede **confundirse o no
> traer todos los datos** de la agenda: cada tool contra el modelo de datos, con hechos de prod
> donde importaba. Los arreglados aplican la **regla 0** de [`02`](02-DISENO-tools-y-arquitectura.md)
> (las definiciones de negocio viven en el tool, no en el modelo). Los no-arreglables están
> documentados para que el agente los admita en vez de adivinar.

**Hechos de prod que calibraron severidad** (dr-prueba, read-only): 48 citas / 18 pacientes
(pequeño — doctores reales excederán los caps), **0 slots legacy futuros en TODA la BD** (la
disponibilidad v1 es un no-problema), 0 nombres con acento en datos de prueba (pero pacientes
reales mexicanos los garantizan), 4 servicios activos.

## ✅ Arreglados (commit de esta ronda)

| # | Pregunta que fallaría | Problema | Fix (server-side) |
|---|---|---|---|
| E1 | "¿Tengo espacio mañana?" (sin mencionar servicio) | Sin `serviceId`, el endpoint upstream devuelve solo "fechas con rangos" — **no resta citas ni bloqueos** → un día lleno se reporta "disponible" | `get_availability` sin servicio ahora calcula con el **servicio activo más corto** (si el más corto no cabe, nada cabe) y lo dice en `nota` |
| E2 | "¿Cuántas citas completé en junio?" | Lista capada a 50 sin total real → conteos mal para doctores con volumen | `totalEncontradas` viene de un `count()` real; prompt regla 7: contar SIEMPRE con ese campo |
| E3 | "¿Cuál es mi próxima cita?" | Orden por **fecha de creación**, no de la cita; SQL no puede ordenar por fecha resuelta (las legacy la traen en el slot) | Sort cronológico en JS post-resolución; ascendente para consultas a futuro |
| E4 | "Busca a Jose" (paciente guardado "José") | `contains` de Postgres es case- pero **no accent-insensitive** → 0 resultados | `find_patient` trae los pacientes del doctor + 300 citas recientes y matchea con **fold de acentos** en JS (José↔Jose, Muñoz↔Munoz ✓ testeado) |
| E5 | "¿Cuánto facturé esta semana en citas?" | `precio` no venía en la lista de citas | `precio` (finalPrice) incluido en toda cita mapeada |
| E6 | "¿Qué tengo el martes?" | El prompt daba la fecha pero no el **día de la semana** → los LLM se equivocan calculando weekdays | El prompt ahora dice "Hoy es jueves 3 de julio…" (día calculado server-side, TZ MX) |

## 📋 Límites reales documentados (el agente debe ADMITIRLOS, no adivinar)

| # | Caso | Por qué no se puede | Mitigación |
|---|---|---|---|
| L1 | "¿Qué citas tengo en el consultorio X?" | Las citas freeform **no guardan `locationId`** (solo los rangos lo tienen) — el dato no existe | Prompt regla 8: explicar honestamente que ese filtro no existe |
| L2 | "¿Qué pasó con la cita que cancelé de X?" vía vista de día | `get_day_schedule` excluye CANCELLED a propósito (es la vista operativa) | `get_bookings status=CANCELLED` sí las encuentra — el modelo tiene el camino |
| L3 | Presupuesto diario y TZ fronteriza | El corte de medianoche usa UTC-6 fijo (CDMX); Tijuana observa DST | Aceptado — solo afecta el reset del presupuesto, no datos |
| L4 | Historial >12 turnos | El endpoint recorta `conversationHistory` a 12 | Aceptado en v1 (sin persistencia, gap G10) |
| L5 | Doctor con >300 pacientes o >200 citas en un filtro | Caps de fetch (300/200) | `totalEncontradas` delata el truncado; subir caps si un doctor real los toca |

## Verificación

- Shapes nuevos smoke-tested contra prod (count ✓, shortest-service ✓, patients-300 ✓).
- Fold de acentos testeado (José/jose, MUÑOZ/munoz, Peña/pena).
- Type-check limpio.

*Estado:* catálogo 2026-07-03. Los fallos que aparezcan en uso real van a la **bitácora** de
[`SESSION-REFRESCO.md`](SESSION-REFRESCO.md) y de ahí al set de evals (gap G11).
