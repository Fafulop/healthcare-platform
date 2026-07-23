# 🧾 Bitácora de experimentos de costo

> Una fila por experimento corrido. Baseline arriba. Se llena al ejecutar el plan de `01`.
> Método: suite de 65 evals + medición de costo read-only vs prod (A4 / thinking-share).

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

*(vacío — llenar al correr el plan de `01`. Plantilla de fila abajo.)*

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
