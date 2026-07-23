# 🛠️ F1 flujo de dinero — los 5 tools de lectura (referencia técnica)

> 🔒 **SNAPSHOT — 2026-07-12** (+ post-mortem A3 del 2026-07-14). No se actualiza; sus conteos
> de tools son de esa fecha. Los 5 tools siguen vivos tal cual — lo que cambia con el tiempo son
> los conteos globales, que viven en
> [`../GENERAL AGENTES/02-CAPACIDADES`](../GENERAL%20AGENTES/02-CAPACIDADES-matriz-que-puede-y-que-no.md) §4.
> Estado actual: [`SESSION-REFRESCO.md`](SESSION-REFRESCO.md).

> Qué hace cada tool del módulo `flujo`, QUÉ ENDPOINT REPLICA (regla 0: los veredictos son
> réplicas del código real, nunca inferencia del modelo), sus fronteras, y los hallazgos del
> code-review. Construido y revisado 2026-07-12 contra el código citado.
> Código: `apps/doctor/src/lib/agenda-agent/modules/flujo.ts`.

---

## 1. Qué es este módulo

Cuarto módulo del asistente (patrón de `modules/registry.ts`: 1 archivo + 1 entrada en
`AGENT_MODULES`). **F1 = SOLO LECTURA**: cero propose_* tools; conciliar/vincular/fusionar/
ignorar/subir estados de cuenta siguen siendo de la UI. Las acciones asistidas son F2+ y su
diseño ya existe (`../../flujo de dinero permutaciones/06-agente-motor4-diseno.md`: niveles de
autonomía server-side, tabla de propuestas, reversibilidad como habilitador).

Con este módulo el asistente quedó en **33 tools / 4 módulos *(medición del 2026-07-12)***
(corrección de entonces: los conteos históricos "29/34" venían inflados +1 desde F1.5; el real
es `ALL_TOOLS` del registry). ⚠️ Ese conteo es de su fecha — después entraron expediente y la
serie F2. **Conteo vigente:
[`../GENERAL AGENTES/02-CAPACIDADES`](../GENERAL%20AGENTES/02-CAPACIDADES-matriz-que-puede-y-que-no.md) §4.**
Prefijo estático de entonces: ~19.4k tokens
(+~3.3k, un poco arriba del presupuesto de 2-3k/módulo del blueprint — se podó lo redundante
en el review; siguiente palanca si muerde: blueprint §5.3 nivel 1).

## 2. Los 5 tools y qué replica cada uno

| Tool | Replica | Responde |
|---|---|---|
| `get_flujo_status` | `GET /api/practice-management/ledger/completeness` (query por query: 16 counts, pcts, matriz, alertas) | "¿cómo voy con mi conciliación?", "¿qué me falta documentar?" — el compuesto de diagnóstico del dominio |
| `get_movimientos` | Semántica de filtros de `GET /api/practice-management/ledger` + filtro ADITIVO `estatusPago` (`POR_COBRAR` = el SET EXACTO de la alerta de completeness: ingresos REALIZADOS con PENDING+PARTIAL — corregido en A3 2026-07-14: la réplica original omitía entryType/porRealizar y devolvía también egresos por pagar) | "muéstrame los gastos de junio", "¿qué ingresos me deben?", "busca el movimiento de la renta" |
| `get_balance` | `GET /api/practice-management/ledger/balance` (realizados vs por-realizar, proyectado) | "¿cuánto tengo de balance?", "¿cuánto entró y salió?" |
| `get_movimiento_detail` | Entry por `internalId` (case-insensitive, tenancy por doctorId) + la resolución de evidencia de `GET /ledger/[id]/evidence` **incluida la heurística de huérfanos** (monto + paidAt≈createdAt ±15min, solo si el match es único) | "¿por qué este movimiento está incompleto?", "¿de dónde salió?", "¿cómo me pagaron?" |
| `get_conciliacion_bancaria` | `GET /api/practice-management/conciliacion-bancaria` (estados de cuenta) + resumen de `bank_movements` sin conciliar (count real + top por monto) | "¿qué estados de cuenta subí?", "¿qué sigue sin conciliar?" |

**Disciplinas compartidas** (heredadas de facturas/fiscal): montos redondeados a centavos,
listas capadas (12 movimientos / 12 estados / 8 sin-conciliar) con `totalEncontradas`/counts
reales y nota de truncado, alcance declarado en cada respuesta, `doctorId` inyectado
server-side en todo, fechas `YYYY-MM-DD` con guard de formato Y de rango (una fecha imposible
se descarta y el `periodo` de la respuesta SIEMPRE dice qué filtro se aplicó — nunca sumas de
todo el historial disfrazadas de un mes).

## 3. Invariantes del dominio que el prompt enseña (`FLUJO_DOMAIN_MODEL`)

1. **Una tabla es la verdad** (`ledger_entries`); todo lo demás se adjunta. Dedup =
   match-before-create (Motor 2 CFDI↔entry, Motor 3 banco↔entry, guard del POST manual).
2. **Dos evidencias por movimiento**: 🧾 fiscal (CFDI vinculado o factura subida) y 🏦
   bancaria (movimiento 1:1 o liquidación "Varios"). "Completo" lo decide el sistema.
3. **Tres puertas** (`origin`): operación / factura SAT / banco; `comision` es interno.
4. **Efectivo y webhook_pago NO se concilian con banco** (sin huella / auto-probado) — el
   sistema los excluye del pendiente bancario.
5. **Por realizar = proyección**, no dinero real; balances y sumas lo separan SIEMPRE.
6. Vínculos automáticos de confianza media quedan **por revisar** — pendiente explícito, no error.

## 4. Reglas de desempate (la parte que evita el caos cross-módulo)

Con 4 módulos el par confundible nuevo es **fiscal (SAT, base de efectivo) vs flujo (ledger)**:

- **"¿cuánto tengo/gané/gasté?" del día a día** → `get_balance`/`get_movimientos` (ledger:
  todo el dinero, con o sin factura).
- **"¿cuánto ingresé/deduzco?" para DECLARAR** → `get_resumen_fiscal` (SAT, base de efectivo).
- **"¿cuánto gasté?" a secas es ambiguo** entre egresos del ledger y deducciones fiscales: la
  regla (en AMBOS módulos, espejeada — lección del doble-steer de F1.5) es dar UNA cifra
  nombrando la fuente y mencionar la otra lectura. Verificado en evals: `xdom-gaste-ambiguo`
  ahora llama get_balance + get_resumen_fiscal.
- **"¿quién me debe?"** → facturas PPD = `get_ppd_cobranza` (fiscal); ingresos del ledger
  pendientes de cobro = `get_movimientos {estatusPago: "POR_COBRAR"}` (flujo).

## 5. La discrepancia settlement conocida (documentada, no bug del módulo)

La pestaña de completeness (y por tanto `get_flujo_status`, su réplica fiel) cuenta como
"conciliado" SOLO el vínculo bancario directo 1:1 (`bank_movements.ledger_entry_id`); una
liquidación "Varios" (`bank_settlement_items`) NO suma ahí aunque el movimiento SÍ está
conciliado. `get_movimientos`/`get_movimiento_detail` usan la definición por-entry (directo O
settlement — la de los íconos de evidencia). Para que el modelo no se contradiga, la nota de
`get_flujo_status` explica la brecha. **El undercount del endpoint es pre-existente
(API-side) y quedó anotado como candidato a fix propio** — si se arregla allá, actualizar la
réplica y borrar la nota.

## 6. Hallazgos del code-review (3 finders, 14 candidatos → 11 corregidos)

Los gordos (todos corregidos en el mismo PR):

1. **Claim falso sobre el matcher** ("solo compara monto y fecha"): `matchMovements`
   (`apps/api/src/lib/bank-matching.ts`) también puntúa referencia bancaria (0.99) y similitud
   de concepto (≤0.65); solo contraparte no se usa. Corregido en las 2 menciones — verificado
   contra el código (los docs alucinan; el código es la verdad).
2. **Regla que prescribía un filtro inexistente** ("¿quién me debe?" → filtrar por estatus):
   se agregó el filtro `estatusPago` al tool (smoke: POR_COBRAR = 15 = el count de la alerta).
   ⚠️ **Post-mortem A3 (2026-07-14):** ese smoke pasó por COINCIDENCIA de datos — la réplica
   solo copiaba `paymentStatus IN (PENDING,PARTIAL)` sin `entryType='ingreso'` ni
   `porRealizar=false`; cuando el sync SAT creó cientos de egresos pendientes, POR_COBRAR
   devolvía 331 filas con $2.19M de "por pagar". Corregido con paridad exacta (16=16=16,
   $157,592). Lección: la paridad se verifica contra las CONDICIONES de la fuente, no contra
   su resultado del día.
3. **Doble-steer "¿cuánto gasté?"** flujo vs fiscal → reglas espejeadas (patrón F1.5).
4. **Drop silencioso de fecha malformada** → sumas de TODO el historial reportadas como el mes
   pedido. Fix: guard de rango + eco de `periodo` en la respuesta.
5. **Sumas mezclaban por-realizar con dinero real** → groupBy separa; `sumasPorRealizar` aparte.
6. Menores: `totalEstadosDeCuenta` era la lista capada (ahora count real); `metodo`/`moneda`
   del pago en línea faltaban en el detalle; selects muertos; eval `flujo-detalle-movimiento`
   marcado soft (dato de prueba mutable EGR-2026-352).

**Refutados/aceptados:** el resto de la paridad quedó verificada query-por-query (parity audit
completo); `matchedCount` de estados de cuenta NO se desactualiza (`updateStatementCounts` en
los 7 caminos de mutación).

## 7. Verificación (método del playbook)

- **Smoke read-only contra prod** (`scripts/flujo-smoke.ts`, `railway run --service pgvector`):
  13 shapes, dr-prueba (663 entries). Cazó 2 bugs reales antes del push: fuga de timezone en el
  filtro de fechas (parse local vs UTC del deploy — ahora Z explícito) y el drop silencioso.
- **Evals**: 7 casos nuevos (5 del módulo + `flujo-no-concilia-negativo` NEGATIVO + 2
  cross-dominio `xdom-balance-vs-fiscal`/`xdom-gaste-ambiguo`). Suite completa 39 casos:
  **37 PASS + 2 WARN soft (drift de datos de agenda, no regresiones) + 0 FAIL.**
- Pendiente al desplegar: **validación en vivo** en el panel de prod (preguntas sugeridas en
  SESSION-REFRESCO).

---

*Relacionado: [`SESSION-REFRESCO.md`](SESSION-REFRESCO.md) (estado),
[`../../flujo de dinero permutaciones/00-modelo-consolidado.md`](../../flujo%20de%20dinero%20permutaciones/00-modelo-consolidado.md)
(el modelo), [`06-agente-motor4-diseno.md`](../../flujo%20de%20dinero%20permutaciones/06-agente-motor4-diseno.md)
(F2+), blueprint §5 (escalamiento).*
