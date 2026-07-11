# 🧭 Blueprint — EL ASISTENTE (agentes por módulo de dominio)

> **Qué es este doc.** La visión general de los agentes: qué estamos construyendo, el playbook
> con el que se construyeron agenda y facturas, dónde estamos (con números reales de prod), qué
> sigue, y el análisis de escalamiento — incluidas las opciones si "F1 everywhere" empieza a dar
> problemas. Creado 2026-07-11. Los docs por agente viven en sus carpetas hermanas
> (`AGENTE AGENDA/`, `AGENTE FACTURAS/`); este doc es el mapa de arriba.

---

## 1. Qué estamos construyendo

**UN asistente conversacional para el doctor** — no varios agentes que se hablan entre sí
(decisión de arquitectura en `AGENTE FACTURAS/00-FACTIBILIDAD` §1, no re-litigar). El asistente
vive en el panel del doctor-app y crece por **módulos de dominio**: cada módulo aporta tools de
lectura, tools de propuesta y sus secciones de prompt, todo enchufado en UN registry
(`apps/doctor/src/lib/agenda-agent/modules/registry.ts`). El loop (`run-turn.ts`) nunca cambia
al agregar un módulo.

**El flujo de confianza (invariante en todos los módulos):**
- **Lecturas = autónomas.** El modelo consulta lo que necesite; un error de lectura es texto
  equivocado, no daño.
- **Escrituras = propuesta → card → el doctor confirma → el CLIENTE ejecuta el endpoint real
  con su propio token.** El servidor del agente jamás muta datos; el modelo jamás aporta ids
  sin validar (doctorId inyectado server-side en cada tool).
- **Regla 0:** los veredictos de negocio se resuelven SERVER-SIDE ("¿facturada?", "¿vencida?",
  "completitud fiscal") — el modelo nunca reconstruye semántica contando campos ni infiriendo.

**Dominios previstos** (el plan "agentes por bloque, merged" original):
| Módulo | Estado | Alcance |
|---|---|---|
| agenda | ✅ vivo (PR 1-3 + hardening) | horarios, citas, disponibilidad, propuestas de citas/rangos/bloqueos |
| facturas/pagos | ✅ lectura viva (PR F1) | billing status, CFDIs (dual plataforma/SAT), fiscal, links de pago |
| flujo de dinero | ⬜ candidato F1 | movimientos del ledger, totales, conciliación (estado, no acciones) |
| expediente | ⬜ candidato F1 | SOLO metadatos + demográficos/fiscales — contenido clínico es otro tier de privacidad |
| SAT profundo | ⬜ candidato F1 | declaración helper, cobranza PPD, deducibilidad |
| voz | ⬜ PR 4 (independiente) | entrada por voz al mismo asistente |

## 2. El playbook (cómo se construyeron agenda y facturas — replicar tal cual)

Cada módulo nuevo sigue esta secuencia, **en este orden**:

1. **Auditoría de sustrato.** Leer los endpoints/tablas reales del dominio ANTES de diseñar
   tools. Los docs alucinan (lección fila 19 de agenda); el código es la verdad. Tenancy de
   cada endpoint verificada.
2. **Doc de flujo del sistema** (`02-FLUJO` de facturas como modelo): el grafo de datos real
   — quién apunta a quién, quién escribe qué, y la matriz de preguntas que el asistente debe
   poder responder (esa matriz ES el spec del tool compuesto del dominio).
3. **Catálogo de permutaciones** (`03-PERMUTACIONES`): las combinaciones del ciclo de vida del
   dominio, cada una con qué filas nacen dónde y qué hueco activa. Cada permutación = un eval
   candidato.
4. **Arreglar el sustrato ANTES de construir el módulo.** Los huecos que el catálogo destape
   (H1-H10 de facturas) se cierran primero — el agente AMPLIFICA los huecos, no los tolera.
5. **PR F1 del dominio — tools de LECTURA:** 5-8 tools máximo, ancladas en UN tool compuesto
   de diagnóstico (patrón `get_billing_status`). Cada agregado declara su alcance ("solo citas
   vinculadas", "fuente: plataforma"). Method: smoke-test de cada query shape contra prod
   (read-only, no hay staging) ANTES de push; evals nuevos (incluidos NEGATIVOS: qué debe
   rechazar) ANTES de encender; validación en vivo con dr-prueba después del deploy.
6. **PR F2+ — propuestas**, solo cuando la lectura esté validada en vivo. Tiers de riesgo por
   acción (notificar al paciente 🔴, documento legal ante el SAT = tier máximo; cancelar CFDI
   quedó FUERA de v1).

**Reglas de trabajo no negociables** (heredadas, ver `AGENTE AGENDA/SESSION-REFRESCO`):
prompt/tools tocados → suite de evals completa antes de push; nunca commit/push sin explicar y
recibir OK; verificación en vivo = usuario actúa en prod, LLM verifica read-only (TOOLING);
el prompt se edita en `prompt.ts` o `modules/<dominio>.ts`, NUNCA en `run-turn.ts`.

## 3. Dónde estamos (2026-07-11, números reales de prod)

**Construido y validado:**
- Agenda: PR 1+2+3 vivos, prompt caching, 4 hardening items, evals 19→24 casos.
- Facturas: sustrato cerrado (H1/H2/H7/H8/H10), PR F1 desplegado y **validado en vivo 10/10**
  (los 6 tools correctos contra la BD, incluyendo negativos y expedientes duplicados).
- Refactor de módulos byte-idéntico: agregar un módulo = 1 archivo + 1 entrada en
  `AGENT_MODULES`.

**Telemetría real (`llm_token_usage`, endpoint `agenda-agent`, 102 turnos):**
- Volumen de input por turno: p50 **13.8k**, promedio 18.4k, p95 46k, máx 66.7k tokens.
- Prefijo estático actual (system + 24 tools): **~13-14k tokens** — domina el p50.
- Costo real por turno (budget tokens = ponderado por caché): promedio **~12.7k budget tokens
  ≈ $0.04 USD**. Cap diario: 500k budget ≈ $1.50/doctor.
- Un día de USO INTENSO (la sesión de validación de PR F1: 16 turnos) quemó **41% del cap**.

**Modelo:** claude-sonnet-5 (`AGENDA_AGENT_MODEL`). Caché: 1 breakpoint estable
(system+tools) + 2 breakpoints móviles al final de la conversación; TTL 5 min.

## 4. Qué sigue

1. **"F1 everywhere":** módulos de lectura para flujo de dinero → expediente (metadatos) →
   SAT profundo, con el playbook de §2. Lectura primero en todos los dominios porque es el
   orden óptimo de riesgo: los errores de lectura son texto; los de propuesta ejecutan.
2. **Después: PR F2 de facturas** (propose_create_cfdi + formulario fiscal + builder de
   impuestos server-side — leer primero qué taxes arma `useBookings.emitCfdi`), y las
   propuestas que cada dominio pida (propose_payment_link, propose_create_patient).
3. **PR 4 voz** — independiente, no bloquea ni es bloqueado.

## 5. Escalamiento: el análisis honesto

### 5.1 Los tres costos que crecen (y cuánto)

**a) Tokens — el prefijo estático crece ~2-3k tokens por módulo.** Con 5-6 módulos: ~25-30k
tokens estáticos. La trampa NO es el volumen sino el **patrón de uso frente al TTL de caché
(5 min)**:
- Uso continuo (turnos seguidos): el prefijo se paga una vez (write ×1.25) y luego lee a ×0.1
  — crecimiento casi gratis. Así corren los evals (92-99% cached).
- **Uso esporádico (el doctor real): cada pregunta con >5 min de silencio RE-PAGA el write del
  prefijo completo a ×1.25.** Piso de costo por pregunta fría ≈ prefijo × 1.25 + output × 5.
  Hoy: ~17k budget/pregunta fría. Con 30k de prefijo: **~38k budget/pregunta fría → 13
  preguntas esporádicas al día agotan el cap de 500k.** Este es el número que muerde primero.

**b) Errores — la clase que crece es "elección de tool" y "confusión de dominio".** Evidencia
a favor: en la validación en vivo el modelo distinguió bien get_cfdis vs get_sat_cfdis (par
genuinamente confundible) porque las DESCRIPCIONES declaran la distinción. Los modelos manejan
bien 40-60 tools bien descritas; estamos en 24 → hay espacio para 3-4 módulos F1 más antes de
degradación esperable. La clase nueva que los evals actuales NO cubren: preguntas
cross-dominio ("¿cuánto me deben?" — ¿agenda, ledger o links?).

**c) Superficie de regresión — cada módulo agrega reglas que pueden interactuar.** Mitigado
por: secciones de prompt por módulo (no un monolito), suite de evals que corre completa antes
de cada push, y las secciones compartidas (INTRO/RESILIENCE) como único punto de contacto.

### 5.2 Gaps de gobernanza detectados en esta pasada (arreglar al agregar el 3er módulo)

1. **El registry no detecta colisión de nombres de tools**: `readOwner.set()` sobreescribe en
   silencio — un módulo nuevo con un tool homónimo haría shadowing sin error. Fix trivial:
   throw en el registry si el nombre ya existe (falla en build/eval, no en prod).
2. **INTRO y RESILIENCE se editan A MANO por módulo** (capacidades enumeradas, "fuera de tu
   alcance"): es el punto de drift — checklist del playbook: todo módulo nuevo toca esas dos
   secciones y corre la suite completa.
3. **Los evals no tienen casos cross-dominio** — agregar 2-3 por módulo nuevo ("¿cuánto me
   deben?" debe elegir bien entre dominios, o preguntar).
4. **Métrica de vigilancia sin alerta**: `llm_token_usage.budget_tokens` existe; falta mirar
   p50/turno y tools/turno tras cada módulo nuevo (a mano basta por ahora — si el p50 sube
   >20% tras un módulo, sus descripciones necesitan poda).

### 5.3 La escalera de opciones si "F1 everywhere" empieza a dar problemas

En orden — cada nivel se agota antes de pasar al siguiente. Los niveles 0-2 preservan la
arquitectura y el caché; el nivel 3 la cambia.

**Nivel 0 — disciplinas (ya en vigor, son LA razón de que esto escale):**
regla 0 server-side · un tool compuesto por dominio en vez de muchos delgados · presupuesto de
5-8 tools por módulo · alcances declarados en cada respuesta de tool · evals con negativos.

**Nivel 1 — afinación barata (síntoma: elección de tool errática o costo/turno creciendo):**
- Podar/tensar descripciones de tools (la palanca más efectiva y más barata).
- Fusionar tools delgados en el compuesto del dominio.
- Podar secciones de prompt por módulo (~2-3k tokens es el presupuesto; si un módulo pide más,
  sus veredictos no están suficientemente server-side).
- **TTL de caché de 1 hora** (write ×2 en vez de ×1.25): conviene si el doctor promedia ≥2
  preguntas frías por hora — convierte el patrón esporádico en warm. Es UN parámetro en la
  llamada; probarlo ANTES que cualquier cambio estructural.
- Subir el cap diario (es un número; $3-5/doctor/día puede ser perfectamente aceptable vs el
  valor).

**Nivel 2 — reestructura compatible con caché (síntoma: prefijo >35-40k o confusión de
dominio persistente):**
- Mover reglas raras del prompt a los pre-checks server-side (el modelo no necesita la regla
  si el tool ya la aplica y la narra).
- Comprimir schemas de tools (enums y descripciones cortas; los ejemplos largos van al prompt
  del módulo, no al schema).
- Model routing por tier: lecturas puras con un modelo más barato (Haiku) y propuestas con
  Sonnet — OJO: son dos prefijos de caché y dos comportamientos que validar; solo si el costo
  domina y el nivel 1 no alcanzó.

**Nivel 3 — cambios de arquitectura (último recurso, cada uno rompe algo que hoy funciona):**
- **Subsets de módulos por superficie** (el panel en /facturacion monta facturas+agenda; el de
  /appointments monta todo): reduce prefijo por página pero crea N cachés y N comportamientos
  — el doctor pierde "un solo asistente que sabe todo".
- **Carga dinámica de tools** (meta-tool que activa un dominio bajo demanda): cambiar el array
  de tools INVALIDA el caché completo por diseño del API — con nuestro patrón de caché es
  contraproducente salvo prefijos enormes (>60-80k).
- **Sub-agentes por dominio** (el A2A rechazado): solo si un dominio necesita AISLAMIENTO real
  (p.ej. contenido clínico con tier de privacidad propio y modelo/logging distintos) — ese fue
  siempre el único caso legítimo del plan original.

**La señal para subir de nivel** no es intuición: es (a) evals cross-dominio fallando, (b)
p50 de budget/turno subiendo >20% tras un módulo, o (c) el cap diario quedando corto para uso
real no-de-prueba. Sin una de esas tres, quedarse en el nivel actual.

---

*Relacionado: [`../AGENTE AGENDA/SESSION-REFRESCO.md`](../AGENTE%20AGENDA/SESSION-REFRESCO.md)
(playbook + bitácora), [`../AGENTE FACTURAS/SESSION-REFRESCO.md`](../AGENTE%20FACTURAS/SESSION-REFRESCO.md)
(estado facturas), `modules/registry.ts` (el enchufe), memoria `project_agentes_por_bloque`.
Mantener §3 (números) actualizado cuando cambie el prefijo o el patrón de uso.*
