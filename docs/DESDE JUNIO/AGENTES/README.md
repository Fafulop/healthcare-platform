# 🤖 AGENTES — el asistente del doctor

> **La puerta de entrada.** Esta carpeta documenta **EL ASISTENTE**: un solo agente
> conversacional que vive en el panel del doctor-app y crece por **módulos de dominio**.
> No son varios agentes que se hablan entre sí — esa decisión se tomó y no se re-litiga
> (`AGENTE FACTURAS/00-FACTIBILIDAD` §1, re-confirmada en `05-ANALISIS`).
>
> 7 carpetas, 45+ docs. Este índice dice qué es cada una y en qué orden leerlas.

---

## Si es tu primera vez (sesión fría, 10 minutos)

1. [`GENERAL AGENTES/00-BLUEPRINT-asistente-modular.md`](GENERAL%20AGENTES/00-BLUEPRINT-asistente-modular.md)
   — qué estamos construyendo, el playbook, y el análisis de escalamiento.
2. [`GENERAL AGENTES/02-CAPACIDADES-matriz-que-puede-y-que-no.md`](GENERAL%20AGENTES/02-CAPACIDADES-matriz-que-puede-y-que-no.md)
   — qué puede y qué NO puede hoy, módulo por módulo. **Los conteos vigentes viven solo aquí.**
3. El `SESSION-REFRESCO.md` de la carpeta del dominio que vayas a tocar.

**Si vas a escribir en estos docs**, lee además
[`GENERAL AGENTES/07-CONVENCIONES-docs.md`](GENERAL%20AGENTES/07-CONVENCIONES-docs.md)
(qué se actualiza, qué se congela, y de dónde sale cada número).

## Las tres reglas que gobiernan todo el sistema

| | |
|---|---|
| **Lecturas = autónomas** | El modelo consulta lo que necesite; un error de lectura es texto equivocado, no daño |
| **Escrituras = propuesta → card → el doctor confirma → el CLIENTE ejecuta** | El servidor del agente **jamás** muta datos; nada se ejecuta solo |
| **Regla 0: los veredictos de negocio se resuelven SERVER-SIDE** | "¿facturada?", "¿vencida?", "¿conciliado?" los decide el sistema — el modelo nunca reconstruye semántica contando campos |

## Las carpetas

| Carpeta | Qué es | Estado |
|---|---|---|
| [`GENERAL AGENTES/`](GENERAL%20AGENTES/README.md) | **La capa que pega todo**: blueprint, matriz de capacidades, método de code review, mapa de TODA la superficie IA del doctor-app, convenciones de estos docs | 🟢 vivo |
| [`AGENTE AGENDA/`](AGENTE%20AGENDA/README.md) | **El tronco.** Donde nació el asistente; tiene el playbook y **la bitácora de fallos en vivo de todos los módulos** (numerada hasta #24). Módulo: horarios, citas, disponibilidad + propuestas | 🟢 vivo · PR 1-3 validados |
| [`AGENTE FACTURAS/`](AGENTE%20FACTURAS/README.md) | El módulo más grande: CFDIs, catálogos SAT, conocimiento fiscal, y la **emisión** (la primera escritura fuera de agenda) | 🟢 vivo · F1→F2c validados |
| [`AGENTE FLUJOS/`](AGENTE%20FLUJOS/README.md) | Lectura del ledger, balance, evidencia y conciliación bancaria | 🟢 vivo · F1 validado |
| [`AGENTE EXPEDIENTE/`](AGENTE%20EXPEDIENTE/README.md) | Metadatos de expedientes — **contenido clínico estructuralmente fuera** | 🟢 vivo · F1 validado |
| [`AGENTE KNOWLEDGE LAYER/`](AGENTE%20KNOWLEDGE%20LAYER/README.md) | Qué conocimiento HABLA el agente vs qué RUTEA a la guía determinista | 🟡 su PR shippeó; K2-K4 sin retomar |
| [`AGENTE WHATSAPP/`](AGENTE%20WHATSAPP/README.md) | Agente paciente-facing por WhatsApp | 🌱 exploración, nada construido |

## Los 5 módulos vivos

| Módulo | Qué hace | Escribe |
|---|---|---|
| **agenda** | horarios, citas, disponibilidad real, búsqueda de pacientes | ✅ rangos, bloqueos y todas las acciones de cita |
| **facturas/pagos** | diagnóstico de cobro/factura, CFDIs (fuente dual plataforma/SAT), claves SAT grounded, barrido de pendientes | ✅ emite CFDI · prepara borradores |
| **fiscal** | resumen mensual base-efectivo, cobranza PPD | ❌ solo lectura — **nunca calcula ISR** |
| **flujo de dinero** | movimientos, balance, evidencia, conciliación | ❌ solo lectura |
| **expediente** | metadatos administrativos, cartera, reactivación | ❌ solo lectura, **sin contenido clínico** |

Conteos exactos (tools, evals, prefijo) y las fronteras completas:
[`GENERAL AGENTES/02-CAPACIDADES`](GENERAL%20AGENTES/02-CAPACIDADES-matriz-que-puede-y-que-no.md) §4.

## Qué sigue (2026-07-23)

- **PR 4** — voz + retiro del ChatWidget v1 + limpieza de `/v1` `/v2`. Sin carpeta propia aún.
- **F3 de facturas** — `propose_email_cfdi` / `propose_send_fiscal_form`.
- **2 bugs de conducta del agente**, cada uno con su propia pasada (no batchear — distinto
  blast radius sobre el caché del prompt): **card fantasma** (#23) y **over-claim del member**
  (#24). Bitácora en `AGENTE AGENDA/SESSION-REFRESCO`.
- **Re-medir el prefijo** (procedimiento A4) — está STALE-UNMEASURED desde F2a/b/c.
- **Deuda mapeada**: 8 endpoints `*-chat` en el patrón viejo que puede "mentir éxito"
  (`GENERAL AGENTES/06-MAPA` §2) · sin job de retención para `llm_token_usage` /
  `agent_tool_errors`.

## Reglas de trabajo (no negociables, heredadas)

- **Sustrato antes que agente** — el agente AMPLIFICA los huecos, no los tolera.
- **Todo SQL crudo / query shape nuevo se smoke-testea read-only contra prod ANTES del push.**
  No hay staging; `main` despliega a producción.
- **Prompt o tools tocados ⇒ suite completa de evals antes del push.**
- **Nunca commit/push sin explicar y recibir OK.** Una aprobación = un commit.
- **Verificación en vivo** = el usuario actúa en prod, el LLM verifica read-only con el método
  de los `TOOLING-*.md` (nunca improvisar el acceso a la BD).
- **El prompt se edita en `prompt.ts` o `modules/<dominio>.ts` — NUNCA en `run-turn.ts`.**
- **Los docs alucinan; el código es la verdad.** Todo invariante del prompt se verifica contra
  el código, no contra otro doc.

---

*Carpetas hermanas fuera de AGENTES: `../NUEVOS USUARIOS/` (usuarios secundarios y los permisos
que recortan los módulos del agente) · `../flujo de dinero permutaciones/` (el sustrato del
dominio dinero + el TOOLING canónico de acceso a prod).*
