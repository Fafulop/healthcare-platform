# 📐 Convenciones de esta documentación — qué se actualiza, qué se congela

> **Qué es este doc.** Las reglas de mantenimiento de `docs/DESDE JUNIO/AGENTES/`. Existe porque
> la carpeta creció a 40+ docs y empezó a contradecirse: números copiados hacia adelante a docs
> que debían quedar congelados, y docs congelados leídos como si fueran el estado actual.
> Creado 2026-07-23 tras una pasada de alineación completa de las 7 carpetas.
>
> **La regla de una línea:** cada doc es de UN tipo (§1); solo dos tipos se actualizan.

---

## 1. Los tres tipos de documento

Todo doc de esta carpeta es exactamente uno de estos. Si un doc es de dos tipos, se parte.

| Tipo | Qué es | ¿Se actualiza? | Ejemplos |
|---|---|---|---|
| **DECISIÓN / REFERENCIA** | Lo que es verdad HOY: arquitectura, decisiones vigentes, matriz de capacidades, método | ✅ **SÍ** — es su trabajo estar al día | `00-BLUEPRINT`, `02-CAPACIDADES`, `05-METODO`, `06-MAPA`, `AGENDA/05-REFERENCIA-TECNICA`, `FACTURAS/06-KNOWLEDGE-BASE` |
| **ESTADO / BITÁCORA** | El estado vivo de un dominio + su log de sesiones | ✅ **SÍ** — al final de cada sesión | los `SESSION-REFRESCO.md`, los `README.md` |
| **SNAPSHOT** | Lo que se investigó/diseñó/decidió EN UNA FECHA. Su valor es histórico: dice qué se creía y por qué | ❌ **NO** — se congela con banner (§3) | research, auditorías, permutaciones, planes de PR ya cerrados, diagnósticos |

**Por qué importa:** un plan de PR es un SNAPSHOT desde el momento en que el PR shippea. Seguir
editándole los números lo convierte en un mal doc de estado; dejarlo sin banner hace que alguien
lo lea como si fuera el plan vigente.

## 2. Fuente única de cada número que drifta

Estos números aparecen en muchos docs y drifteaban. **Un solo doc los declara en presente; todos
los demás los citan CON FECHA.**

| Número | Fuente de verdad (el código) | Único doc que lo declara en presente |
|---|---|---|
| Cantidad de tools | `ALL_TOOLS.length` del registry (`modules/registry.ts`) | `02-CAPACIDADES` §4 |
| Cantidad de módulos | `AGENT_MODULES` | `02-CAPACIDADES` §4 |
| Tamaño de la suite de evals | cantidad de casos en `scripts/agenda-agent-evals.ts` | `02-CAPACIDADES` §4 |
| Módulo → permisos requeridos | `AGENT_MODULE_REQUIREMENTS` | `02-CAPACIDADES` §2 |
| Prefijo estático (tokens) | medición real (A4) | `02-CAPACIDADES` §4 — **y si no se re-midió, se dice** |
| Modelo, cap diario, TTL de caché | env + `run-turn.ts` | `02-CAPACIDADES` §4 |

**Reglas de uso:**
1. En un SNAPSHOT, todo número va con su fecha: *"35 tools (2026-07-12)"*. Nunca a secas.
2. Un número que no se re-midió se marca **STALE-UNMEASURED**, no se estima. Un número inventado
   es peor que un hueco declarado.
3. ⚠️ **No confundir el tamaño de la suite con el resultado de una corrida.** "62/65 PASS" es un
   RESULTADO; la suite es 65. Copiar el 62 como tamaño fue un error real que se propagó a los
   dos docs glue — es el modo de fallo más fácil de repetir.

## 3. El banner de SNAPSHOT

Todo doc congelado abre con esto, justo después del título:

```markdown
> 🔒 **SNAPSHOT — <fecha>.** Documento histórico: refleja lo que se sabía/decidió en esa fecha
> y NO se actualiza. Estado actual en [`<doc de estado>`](<link>). Los números que cita
> (tools, evals, prefijo) son de su fecha — la fuente viva es `02-CAPACIDADES` §4.
```

No se le borra ni se le "corrige" contenido a un snapshot. Si dijo algo que resultó falso, se
anota como corrección (§4) — el error documentado ES información.

## 4. Cuando un doc contradice al CÓDIGO

El código gana, siempre (lección repetida de esta carpeta: *los docs alucinan*). Al encontrar
una contradicción, se hacen **las dos cosas**:

1. **Anotar la corrección en el doc equivocado**, en el lugar exacto del claim, sin borrar el
   original:
   ```markdown
   > ⚠️ **CORREGIDO <fecha>:** esto es FALSO. <lo que es verdad> — ver <doc/§>.
   ```
2. **Registrarla en el drift-log del dominio** (el patrón que inventó
   [`../AGENTE FACTURAS/06-KNOWLEDGE-BASE-facturacion.md`](../AGENTE%20FACTURAS/06-KNOWLEDGE-BASE-facturacion.md) §8,
   generalizado aquí): una tabla "Drift encontrado docs↔código" con qué decía, qué es verdad, y
   cómo se descubrió.

Borrar el claim equivocado en silencio pierde la lección — y esta carpeta tiene varias lecciones
que nacieron exactamente así (el sync GCal de rangos que nunca existió; la fórmula de impuestos
que no vivía donde el doc decía).

## 5. Checklist: módulo o tool nuevo

Antes existía repartido en 4 docs con listas distintas. Es este:

- [ ] `02-CAPACIDADES`: fila del módulo (tools, qué responde, qué NO puede, desempates, gotchas)
- [ ] `02-CAPACIDADES` §4: re-contar tools/módulos/evals desde el CÓDIGO (no sumar a mano)
- [ ] `02-CAPACIDADES` §2: si el módulo es nuevo, su entrada en `AGENT_MODULE_REQUIREMENTS`
      (fail-closed: un módulo ausente del mapa queda BLOQUEADO para members)
- [ ] Prompt: secciones `INTRO` y `RESILIENCE` (se editan A MANO por módulo — es el punto de
      drift conocido, blueprint §5.2 punto 2)
- [ ] Evals: +2-3 cross-dominio (`xdom-*`) además de los del módulo
- [ ] `00-BLUEPRINT` §1: fila en la tabla de dominios
- [ ] El `SESSION-REFRESCO` del dominio: estado + decisiones + próximos pasos
- [ ] Si se midió costo: `02-CAPACIDADES` §4; si NO se midió, marcarlo STALE-UNMEASURED
- [ ] Gates antes del push: `check-route-permission-coverage.ts` ·
      `check-agent-prompt-identity.ts` · suite completa de evals

## 6. Checklist: cierre de sesión

- [ ] **Primero, la cabecera.** El "En una frase" / bloque de estado del `SESSION-REFRESCO` se
      actualiza ANTES que el cuerpo. Fue el fallo #1 de esta carpeta: 4 docs con la cabecera
      semanas atrás del cuerpo, y la cabecera es lo primero que lee una sesión fría.
- [ ] Bitácora: fallo → causa raíz → fix → commit (una fila)
- [ ] Un plan de PR que ya shippeó: ponerle banner de SNAPSHOT (§3) y mover su estado al REFRESCO
- [ ] Drift docs↔código encontrado: las dos anotaciones de §4

## 7. Dónde va cada cosa (para no duplicar)

- **Hallazgos de agentes/evals** → la carpeta `AGENTE */` correspondiente, no la carpeta de la
  feature que los disparó. Las features (p. ej. `NUEVOS USUARIOS/`) resumen y cross-linkean.
- **Lecciones cross-agente** (metodología, riesgos de drift) → `00-BLUEPRINT` §5 o `05-METODO`.
- **Conocimiento de dominio verificado contra código** → el `06-KNOWLEDGE-BASE` del dominio.
- **Cómo consultar prod read-only** → los `TOOLING-*.md`; nunca improvisar el método.

---

*Relacionado: [`00-BLUEPRINT-asistente-modular.md`](00-BLUEPRINT-asistente-modular.md) (la
estrategia), [`02-CAPACIDADES-matriz-que-puede-y-que-no.md`](02-CAPACIDADES-matriz-que-puede-y-que-no.md)
(la fuente viva de los números), [`05-METODO-code-review.md`](05-METODO-code-review.md) (cuándo
y cómo se revisa). Índice de toda la carpeta: [`../README.md`](../README.md).*
