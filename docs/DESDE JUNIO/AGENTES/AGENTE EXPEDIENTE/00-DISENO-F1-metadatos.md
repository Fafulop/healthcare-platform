# 🗂️ F1 expediente — metadatos sí, contenido clínico no (referencia técnica)

> Qué hace cada tool del módulo `expediente`, la frontera de privacidad y cómo se hace
> cumplir, la semántica REAL de "última visita" (verificada contra el código), y los
> hallazgos del review de privacidad. Construido y revisado 2026-07-12.
> Código: `apps/doctor/src/lib/agenda-agent/modules/expediente.ts`.

---

## 1. Qué agrega que no existía (el delta real)

Los tools previos ya cubrían: identidad/búsqueda (`find_patient`), fiscal+contacto
(`get_patient_profile`, con veredictos server-side), y dinero por paciente
(`get_billing_status`). Este módulo NO los duplica — agrega las dos capas que nada leía:

1. **Metadatos clínico-administrativos por paciente** (conteos/fechas/tipos/estatus, nunca
   contenido): consultas (incl. borradores sin cerrar y seguimientos próximos Y vencidos),
   recetas por estatus, documentos/media, notas, formularios pre-consulta, flags de
   existencia del baseline.
2. **Vista de cartera** (nivel consultorio): totales por estatus, nuevos por período,
   reactivación ("¿quién no ha vuelto en N meses?"), filtro por tag.

## 2. Los 2 tools

| Tool | Responde |
|---|---|
| `get_expediente_resumen {patientId}` | "¿cuántas consultas le he hecho a X y cuándo fue la última?", "¿tiene borradores/seguimientos pendientes?", "¿tiene receta reciente?" — ficha administrativa + conteos. `patientId` de find_patient del MISMO turno |
| `get_pacientes_overview {status?, tag?, sinVisitaMeses?, nuevosMeses?}` | "¿cuántos pacientes activos tengo?", "¿quién no ha vuelto en 6 meses?", "¿nuevos este mes?", "¿quiénes tienen tag X?" — agregados + lista capada (12) ordenada por consulta más antigua primero |

Disciplinas compartidas: `doctorId` server-side, listas capadas con counts reales, filtros
fuera de rango se ECHAN en `filtrosAplicados` (nunca drop silencioso — lección de flujo),
`monthsAgo` con día clampeado (sin corrimiento de fin de mes).

## 3. La frontera de privacidad (cómo se hace cumplir)

- **Regla:** el modelo recibe SOLO metadatos y datos administrativos/demográficos. El
  contenido clínico (SOAP, chiefComplaint, clinicalNotes, diagnosis, vitales, medicamentos
  de recetas, descripciones/categorías/archivos de media, cuerpos de notas) **no aparece en
  ningún select del módulo** — la frontera es estructural y se audita leyendo los selects.
- **UNA excepción auditada:** los 4 textos del baseline (alergias/padecimientos/
  medicamentos/tipo de sangre) SÍ se seleccionan pero se reducen a **booleanos de
  existencia** antes de salir ("alergias registradas: sí") — el header del módulo lo marca y
  prohíbe esparcir (`...patient`) ese objeto.
- **Tripwire en el smoke** (`expediente-smoke.ts`): escanea el JSON de salida por nombres de
  campos clínicos; si aparece uno, exit 1. Corre contra prod en cada cambio del módulo.
- **DECISIÓN tags (2026-07-12, veto disponible):** los `tags` del expediente ("epoc",
  "hipertenso") SÍ se devuelven — son etiquetas administrativas del propio doctor, visibles
  abiertas en su lista de pacientes, mismo nivel de exposición que el nombre del servicio de
  una cita. Racional en el header del módulo; si se revoca, quitar `tags` de los 2 selects.

## 4. Semántica de "última visita" (verificada contra código — los docs alucinan)

- `Patient.lastVisitDate` la escribe SOLO crear un **encounter clínico**
  (`medical-records/patients/[id]/encounters/route.ts`) — **una cita de agenda NO la
  actualiza**. Por eso el módulo la expone como `ultimaConsultaRegistrada` y el prompt
  enseña: un expediente "sin consulta registrada" puede tener citas perfectamente; para
  citas se usan las tools de agenda.
- `Patient.firstVisitDate` se estampa al **CREAR el expediente** (no es la primera
  consulta) — el módulo **no la expone** como visita para no mentir; `creado` la cubre.
- El filtro `sinVisitaMeses` mide consultas del expediente, no citas — la descripción del
  tool y el eco de filtros lo dicen explícito.

## 5. Hallazgos del review de privacidad + correctness (6/6 corregidos)

1. `primeraConsultaRegistrada` mentía (era la fecha de captura del expediente) → eliminada.
2. Las reglas pedían señalar "seguimientos vencidos" pero la query solo traía futuros →
   segunda query `followUpDate < hoy` (misma clase de defecto que estatusPago en flujo:
   la regla prescribía datos que el tool no podía traer).
3. El header prometía "nunca en ningún select" pero el baseline SÍ se selecciona → header
   corregido a la verdad (frontera en el OUTPUT, excepción única marcada).
4. Decisión de tags registrada explícitamente (antes: inclusión silenciosa).
5. Filtros de meses fuera de rango se descartaban en silencio → eco "FUERA DE RANGO —
   IGNORADO" en `filtrosAplicados` (+ rango ampliado a 1-120).
6. `monthsAgo` con setMonth se corría hasta 3 días en fin de mes → día clampeado.

## 6. Verificación

- **Smoke vs prod** (read-only, dr-prueba, 19 expedientes): 9 shapes + tripwire limpio;
  probado en expediente rico (P-007: 3 consultas, 1 receta issued, baseline flags true) y
  vacío (0 en todo) — sin fugas en ninguno.
- **Evals**: 4 casos nuevos (`exped-resumen-metadatos`, `exped-overview-reactivacion`,
  `exped-negativo-contenido-receta` NEGATIVO, `xdom-expediente-cobro` cross-dominio).
  Suite completa 43 casos: **41 PASS + 2 WARN soft (flakiness/datos de agenda) + 0 FAIL**;
  el cross-dominio tomó exactamente el camino esperado (find_patient → get_patient_profile
  + get_expediente_resumen).
- Asistente tras este módulo: **35 tools / 5 módulos *(medición del 2026-07-12)***, prefijo
  ~21.2k tokens (+~1.9k, dentro del presupuesto del blueprint). ⚠️ Conteo de su fecha — la
  serie F2 de facturas agregó tools después. **Vigente:
  [`../GENERAL AGENTES/02-CAPACIDADES`](../GENERAL%20AGENTES/02-CAPACIDADES-matriz-que-puede-y-que-no.md) §4**
  (donde además el prefijo está marcado STALE-UNMEASURED).
- Pendiente al desplegar: validación en vivo (preguntas en SESSION-REFRESCO).

---

*Relacionado: [`SESSION-REFRESCO.md`](SESSION-REFRESCO.md), decisión de tier en
[`../AGENTE FACTURAS/02-FLUJO-SISTEMA`](../AGENTE%20FACTURAS/02-FLUJO-SISTEMA-cita-paciente-factura-pago.md) §7,
blueprint §4-§5 (con esto "F1 everywhere" queda COMPLETO).*
