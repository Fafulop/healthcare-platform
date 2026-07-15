# 📚 Plan — Capa de conocimiento: el asistente como EXPERTO del sistema

> Plan (nada construido) para la tercera capa del asistente: además de LEER datos (F1) y
> PROPONER acciones (F2), que el asistente **sepa cómo funciona el sistema** — sus partes,
> sus flujos paso a paso, sus reglas — para guiar al doctor. Diseñado 2026-07-12.
>
> **Decisión de arquitectura: NO RAG.** Ver §2 — el conocimiento se sirve con el patrón
> get_guia ya validado, sobre una fuente única compartida con la UI.
>
> **⚠️ REFINADO 2026-07-14 → `../AGENTE KNOWLEDGE LAYER/`.** Este plan sigue válido para la
> secuencia K1-K4 y la decisión NO-RAG, pero la carpeta hermana `AGENTE KNOWLEDGE LAYER/` lo
> actualiza con: el inventario REAL de código (K1 hecho — 4 superficies disjuntas, no 1),
> la reformulación desde primeros principios (2 dimensiones: conocimiento en todas las
> secciones, tools solo en algunas), la investigación de industria (Agentforce/grounding
> 2026) y — lo más importante — la FRONTERA conocimiento↔tools (cómo sabe el agente cuándo
> usar cuál). Leer esa carpeta primero.

---

## 1. Las tres capas del asistente (el modelo mental)

| Capa | Qué responde | Estado |
|---|---|---|
| **Datos** (tools de lectura) | "¿qué ES verdad ahora?" — mi agenda, mis números, mi conciliación | ✅ F1 everywhere completo (35 tools) |
| **Acciones** (propose_*) | "hazlo por mí" — con confirmación del doctor | ✅ agenda; F2 facturas siguiente |
| **Conocimiento** (este plan) | "¿CÓMO FUNCIONA X?" — partes, flujos paso a paso, reglas del sistema | 🟡 parcial: get_guia cubre 3 áreas con resúmenes curados a mano |

**La frontera que TODO depende de mantener:** conocimiento = cómo FUNCIONA el sistema
(estable); tools = qué ES verdad ahora (estado). "¿Cómo concilio?" → conocimiento;
"¿cómo va MI conciliación?" → get_flujo_status. Los evals deben castigar responder
preguntas de estado con conocimiento (primo de la regla 10 de agenda: re-consultar SIEMPRE).

## 2. Por qué NO RAG (decisión, con las razones)

El sistema viejo (ChatWidget v1) tiene un pipeline RAG completo (embeddings, retrieveChunks,
detección de módulos). Se evaluó absorberlo y se DESCARTA:

1. **El corpus es chico y nuestro.** ~10-15 temas × ~700 tokens. RAG paga su complejidad
   con corpus grandes/heterogéneos/inapropiables; a este tamaño es puro overhead
   (embeddings, chunking, umbrales) para peor resultado.
2. **El modo de fallo de RAG es nuestro peor modo de fallo.** Un chunk mal recuperado
   produce una explicación segura, plausible y FALSA. La lección más repetida del codebase
   es "los docs alucinan — verificar contra código": la curación permite verificar AL
   ESCRIBIR (el review de F1.5 cazó 2 errores factuales en guías así); RAG obligaría a
   verificar al recuperar, que es impracticable.
3. **Acopla el asistente a un sistema moribundo y desactualizado.** El pipeline existe solo
   para ChatWidget v1 (retiro = PR 4) y su corpus está muy viejo (confirmado 2026-07-12).

**Corolario:** el retiro de ChatWidget v1 se lleva el pipeline RAG completo. Se rescata
solo el CONTENIDO de `CAPABILITY_MAP` (estados/acciones/reglas por entidad — buena materia
prima para los temas curados), no la maquinaria.

## 3. La arquitectura limpia: fuente única, dos consumidores

**El problema real del get_guia actual** no es el patrón (validado en vivo) sino la
duplicación: los resúmenes son copia manual de las pestañas Guía, protegidos por
comentarios anti-drift (un hack de disciplina).

**El fix estructural:** UN archivo de contenido canónico por tema, consumido por AMBOS:

```
content/guias/<tema>.(md|ts)   ← fuente única, versionada junto al código
        │
        ├──→ UI: pestañas Guía / página /dashboard/ayuda (renderiza el contenido)
        └──→ Agente: get_guia(tema) (sirve el mismo contenido o su resumen)
```

Actualizar la guía actualiza al agente automáticamente — **el drift se vuelve imposible por
construcción** en vez de prevenido por vigilancia (la misma jugada que la regla 0, aplicada
al conocimiento). Los comentarios anti-drift se borran.

**Estructura de cada tema** (pensada para ambos públicos, incluye el "paso a paso" pedido):
1. Qué es / para qué sirve
2. Cómo funciona (el modelo mental, las partes)
3. **Pasos en la UI** (dónde click, en qué orden, qué esperar)
4. Errores/estados comunes y qué significan
5. Dónde está en la app (ruta) + qué puede consultar el asistente al respecto (link a la
   capa de datos: "para TU estado, pregúntame X")

**Temario candidato (~12, cubre los 5 dominios):** agenda-y-rangos · citas-ciclo-de-vida ·
expedientes-y-formularios · facturación-CFDI (emisión) · PPD-y-complementos · SAT-descarga ·
declaraciones-e-impuestos (con frontera E7 explícita) · links-de-pago-y-pasarelas ·
flujo-de-dinero-y-evidencias · conciliación-bancaria · ventas-compras · deducciones.

## 4. Cómo lo consume el agente (sin cambios de arquitectura)

- `get_guia(tema)` tal cual existe, con el enum ampliado a los ~12 temas. Cero infra nueva,
  cero crecimiento del prefijo (el contenido viaja solo en los turnos que preguntan),
  cache-safe por construcción.
- Presupuesto por tema: ~500-900 tokens la versión-agente (si el canónico es más largo, el
  archivo lleva sección "resumen para el asistente" — UNA fuente, dos cortes).
- El tool sigue DIRIGIENDO a la pestaña/página para el detalle visual (patrón validado).

## 5. Verificación y reglas de trabajo

- **Cada tema es contenido que AFIRMA HECHOS → review completo contra código al escribirlo
  o cambiarlo** (la regla consolidada: esa categoría produjo 8/8 y 6/6 hallazgos).
  Los temas heredan la disciplina, no la re-inventan.
- Evals nuevos por clase: (a) routing "¿cómo funciona X?" → get_guia del tema correcto;
  (b) frontera conocimiento/estado ("¿cómo voy con mi conciliación?" JAMÁS se responde con
  la guía); (c) fidelidad (la respuesta no contradice el contenido canónico); (d) los
  negativos existentes se conservan (E7, sin consejo fiscal).
- Riesgo de inyección: el contenido es interno y versionado (no input de terceros) —
  superficie menor; el review al escribir es el control.

## 6. Secuencia sugerida (después de la auditoría 03)

1. **K1 — Inventario y verificación de fuentes** (1 sesión): pestañas Guía actuales,
   /dashboard/ayuda, GUIAS de get_guia, CAPABILITY_MAP — qué existe, qué está vivo, qué
   dice cosas falsas (verificar contra código ANTES de canonizar nada).
2. **K2 — El mecanismo de fuente única** (~1 PR chico): formato del archivo canónico +
   carga en la UI de ayuda + get_guia leyendo de ahí. Migrar los 3 temas existentes
   (facturación/pagos/SAT) como prueba — borrar los comentarios anti-drift.
3. **K3 — Los ~9 temas restantes** (incremental, 1-3 por PR con su review factual y evals).
4. **K4 — Retiro de ChatWidget v1 + pipeline RAG** (coordina con PR 4 voz): el asistente ya
   cubre datos+conocimiento; rescatar contenido útil de CAPABILITY_MAP hacia los temas.

## 7. Qué NO es esta capa (fronteras)

- NO es consejo (fiscal, médico, legal) — explica el SISTEMA, no aconseja decisiones.
- NO sustituye tools de estado (frontera del §1) ni ejecuta nada.
- NO es documentación de desarrollo (los docs de `docs/` siguen siendo otra cosa).
- NO se alimenta de texto de terceros (CFDIs, bancos) — solo contenido propio versionado.

---

*Relacionado: [`03-PLAN-auditoria-integral.md`](03-PLAN-auditoria-integral.md) (hacer
primero), [`02-CAPACIDADES-matriz`](02-CAPACIDADES-matriz-que-puede-y-que-no.md) (la capa de
datos/acciones que esto complementa), estrategia de guías original en
[`00-BLUEPRINT`](00-BLUEPRINT-asistente-modular.md) §3, `AGENTE FACTURAS/SESSION-REFRESCO`
(get_guia F1.5, la semilla de este plan).*
