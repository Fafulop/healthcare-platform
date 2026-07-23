# 🧾 Bitácora de experimentos de costo

> Una fila por experimento corrido. Baseline arriba. Se llena al ejecutar el plan de `01`.
> Método: suite de 65 evals + medición de costo read-only vs prod (A4 / thinking-share).
>
> 📏 **El número comparable ya es automático.** El benchmark ([`benchmarks/`](benchmarks/README.md))
> corre las evals, precia cada corrida y escribe una fila en `benchmarks/ledger.csv` con
> calidad + USD + Δ vs la corrida anterior. **Esta bitácora es la PROSA** (qué se tocó,
> veredicto, notas); el ledger es la serie numérica. Cada experimento: corre el benchmark →
> pega el resumen aquí abajo.

## Baseline (2026-07-23, Sonnet 5)

| | |
|---|---|
| Modelo | `claude-sonnet-5` (sin `thinking`, sin `effort` → adaptive por default) |
| Prefijo estático | ~24.7k tokens (39 tools) |
| Suite evals | **63/65 PASS · 2 WARN · 0 FAIL** |
| Input/turno p50 | 39,706 tok · output p50 515 tok |
| Output como % del costo | 18.7% |
| Cap | 500k budget/día ≈ $1.50/día ≈ $45/mes peor caso |
| Caché | manual, TTL 5 min |
| Costo real medido | $18.16 (Jul 3–23, dr-prueba, precio estándar sin descuento caché) |

## Experimentos

### 2026-07-23 — Lever 1: cap DIARIO 500k → SEMANAL 2M (business dial, no toca el modelo)
- Cambio: `route.ts` pasa a `AGENDA_AGENT_WEEKLY_TOKEN_CAP` (default 2M) y agrega
  `budget_tokens` sobre la semana MX (lun–dom, corte lunes 00:00 MX) vía nuevo
  `mxWeekStartKey()` en `dates.ts`. Widget "Uso de hoy" → "Uso de la semana"
  (`AgentContext.tsx` + `AgendaAgentPanel.tsx`). El var viejo diario ya no se lee.
- Por qué primero (no TTL-1h): ataca la EXPOSICIÓN que motivó la carpeta (cap = suscripción
  completa), es la decisión ya tomada del usuario, y NO depende del timing de doctor real
  (que no tenemos). TTL-1h se descartó como primer paso: su beneficio es una apuesta a ≥2
  preguntas frías/hora que el rig (dr-prueba, 92–99% cached) no puede validar, y write ×2
  obligaría a re-ponderar `budgetTokens` (×1.25→×2) para no descontar mal el costo.
- Evals: N/A (no toca prompt/tools/modelo — el loop es byte-idéntico). type-check + gates OK.
- Smoke read-only vs prod (regla dura): shape semanal ejecuta, dr-prueba 312,567/sem = 15.6%
  del cap 2M; semana ≥ día confirmado; ningún doctor cerca del cap (solo dr-prueba usa el agente).
- Costo: peor caso baja de 500k/día ($45/mes) → 2M/sem (~$26/mes) a precio estándar. El número
  2M es punto de partida (plan `01`); se afina con datos de doctores reales.
- Veredicto: SHIPPED (pendiente push+OK). Reversible (env var + un query). Nivel 1 de la escalera
  `00-BLUEPRINT §5.3` ("subir/re-formar el cap — es un número").
- Notas: benchmark de costo (`benchmarks/`) NO mide este cambio — es exposición, no eficiencia
  por-pregunta. La baseline de calidad+USD sigue pendiente de correr (primer comando de la
  próxima sesión con `railway run`).

### Plantilla

```
### <fecha> — <experimento> (<modelo/config>)
- Cambio: <qué se tocó>
- Evals: <X/65 · WARN · FAIL> (vs baseline 63/65)
- Costo por pregunta: fría <$> / templada <$>
- Tools: <llamó bien / thrashing / inventó / respetó propuesta→card>
- Latencia: <s/turno>
- $/doctor/mes proyectado: <$> al cap <valor>
- Veredicto: <sigue / descarta / necesita más>
- Notas:
```

---

*Cuando un experimento cambie el modelo o el cap en prod, el estado vigente va en
`../GENERAL AGENTES/02-CAPACIDADES` §4 (modelo/cap) y este doc queda como el registro.*
