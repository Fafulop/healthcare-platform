# 05 — DISEÑO fase 3: «Progreso» (ver cómo cambia el paciente en el tiempo)

> **Estado (2026-10-01): ESTACIONADA.** El usuario decidió no construirla por ahora («no estoy seguro de que la
> vayamos a hacer, pero dejemos el plan»). Las 7 decisiones de §5 quedan como recomendación, sin aprobar.
> No hay código.
> Fase 3 del plan de Visitas (`01-DISENO` §8): «comparación entre sesiones: fotos lado a lado, números de
> una plantilla graficados en el tiempo». Esto la aterriza contra lo que hay de verdad en prod.

## 1. Qué es, en una línea

Una pantalla **«Progreso»** del paciente donde el doctor **ve sus números en el tiempo** (peso, presión,
los campos numéricos de sus plantillas) y **compara dos fotos lado a lado**, en vez de abrir visita por
visita.

## 2. Qué NO es

- **No escribe nada.** Sólo lee lo que ya existe (consultas, plantillas, fotos). Sin cambios de base de
  datos, sin dinero, sin IA.
- **No interpreta.** No dice «mejoró», «está fuera de rango» ni dibuja rangos «normales» (eso es un
  veredicto clínico — §5 D7). Enseña los valores y sus fechas; el juicio es del doctor.
- **No reemplaza la visita.** Cada punto de la gráfica y cada foto llevan a su visita/consulta.

## 3. Lo que hay HOY en prod (medido 2026-10-01, sólo lectura)

| Fuente | Dónde vive | Cuánto hay | Para graficar |
|---|---|---|---|
| **Signos vitales** | columnas fijas de `ClinicalEncounter`: `vitalsBloodPressure` (texto «120/80»), `vitalsHeartRate`, `vitalsWeight`, `vitalsTemperature`, `vitalsOxygenSat`, `vitalsHeight` | ~40 de 310 consultas los traen (las demás vienen VACÍOS — ojo: `not null` no basta, hay `''`). **11–13 pacientes con ≥ 2 lecturas; 3 con ≥ 3.** La presión, 39 de 39 en formato `N/N`. | La misma forma para TODOS los doctores ⇒ la fuente más confiable. |
| **Campos numéricos de plantillas** | `ClinicalEncounter.customData[field.name]`, definidos en `EncounterTemplate.customFields` (`type: 'number'`) | 17 de 33 plantillas (8 doctores) tienen 47 campos numéricos; 220 valores en 105 consultas, **todos guardados como número**. Pero **sólo 6 series paciente×campo con ≥ 2 puntos y ninguna con ≥ 3.** | Útil cuando se use más; hoy casi no hay series. |
| **Plantillas EDITADAS** | — | **40 valores** guardados bajo nombres que la plantilla actual ya no tiene (`peso`, `talla`, `archivosParaclinicos`…). | Un campo renombrado parte la serie en dos (§5 D3). |
| **Fotos** | `PatientMedia` (`mediaType: 'image'`) con `captureDate`, `bodyArea`, `category`, `visitaId` | 56 fotos; **14 pacientes con ≥ 2**. Zona del cuerpo sólo en 9, categoría en 25, visita en 3. | Emparejar fotos «comparables» solo no se puede: el doctor elige. |

**Lectura honesta:** hoy hay pocos datos para graficar; el valor crece con el uso (y con la importación de
historial, que trae fechas viejas). Ver §8 «cuándo conviene».

## 4. La propuesta

**Entrada:** botón **«Progreso»** en la barra de arriba del perfil del paciente (junto a «Línea de
Tiempo»), y desde la pantalla de un **tratamiento** un enlace «Ver progreso» que abre la misma pantalla
ya filtrada por ese tratamiento.

**La pantalla `patients/[id]/progreso`**, dos secciones:

### 4.1 Gráficas

- Una gráfica por **serie**: cada signo vital (la **presión** en UNA gráfica con dos líneas, sistólica y
  diastólica) y cada **campo numérico** de cada plantilla (título = la etiqueta del campo y su plantilla:
  «Total UF — Hemodiálisis»).
- Eje X = la **fecha** (la de la VISITA si la consulta tiene visita; si no, la de la consulta); cada punto
  con su valor, y al picarlo, enlace a su visita/consulta.
- Sólo se grafican series con **≥ 2 valores**; las de un solo valor se listan abajo («Glucosa: 95 · 14 may
  2023 — un solo registro»). Sin datos: «Todavía no hay valores que comparar en el tiempo».
- **Filtro por tratamiento** (opcional): sólo los puntos de las visitas de las sesiones de ese tratamiento.
- **Las series las arma el SERVIDOR** (regla 0): `GET /api/medical-records/patients/[id]/progreso` devuelve
  `[{ clave, etiqueta, origen: 'vital' | 'plantilla', unidad?, puntos: [{ fecha, valor, visitaId?, encounterId }] }]`.
  La pantalla no recalcula ni re-interpreta: pinta.

### 4.2 Fotos lado a lado

- Las fotos del paciente, de la más reciente a la más vieja, con su fecha (y zona/categoría si las tienen;
  filtro por esas dos cuando haya).
- El doctor **elige dos** («A» y «B») y se ven lado a lado, grandes, cada una con su fecha y su visita.
- Con filtro por tratamiento: sólo las fotos de las visitas de sus sesiones.

## 5. Decisiones para el usuario (recomendación primero)

| # | Pregunta | Recomendación | Por qué |
|---|---|---|---|
| **D1** | ¿Por paciente o por tratamiento? | **Por paciente**, con el tratamiento como **filtro**. | Los tratamientos casi no tienen sesiones reales todavía; por paciente sirve desde el día uno. |
| **D2** | ¿Qué números? | **Todos los signos vitales + todos los campos numéricos de sus plantillas**, solos (sin configurar). | El doctor ya decidió qué medir al hacer su plantilla; pedirle que «elija qué graficar» es un paso de más. |
| **D3** | ¿Campo renombrado en la plantilla? | **v1: series separadas**, cada una con su etiqueta (la vieja y la nueva). Unirlas a mano, después si se pide. | Unirlas solas por la etiqueta sería ADIVINAR que «peso» y «Peso (kg)» son lo mismo. |
| **D4** | ¿Presión arterial? | **Una gráfica, dos líneas** (sistólica / diastólica), leídas del texto «120/80». Lo que no tenga forma `N/N` no se grafica (se lista). | Hoy 39 de 39 tienen esa forma. |
| **D5** | ¿Cómo se eligen las fotos? | **Las elige el doctor** (A y B); filtro por zona/categoría cuando existan. | Zona y categoría vienen vacías en la mayoría: emparejarlas solo sería inventar. |
| **D6** | ¿Dónde vive? | **Botón «Progreso»** en el perfil + **«Ver progreso»** en el tratamiento (filtrado). | Es del paciente; el tratamiento es una forma de verlo. |
| **D7** | ¿Rangos «normales» o alertas? | **No** en v1. | Un rango dibujado es un veredicto clínico (¿normal para quién?). Si se quiere, que sea el doctor quien lo ponga por campo, después. |

## 6. Permisos, fechas y otros cuidados

- **Permiso:** el de **expedientes** (lo mismo que ver consultas y fotos). Sin restricción de plan.
- **Fechas** (lección `feedback_dbdate_vs_timestamp_utc`): la de la visita es `@db.Date` (se lee en UTC);
  la de la consulta es TIMESTAMP (se lee en hora de México). El servidor manda 'YYYY-MM-DD' ya resuelto y
  la pantalla no lo vuelve a convertir. Probar con una consulta registrada a las ≥ 18:00.
- **Valores raros:** vacíos (`''`), presión sin forma `N/N`, decimales como texto → no se grafican; se
  cuentan y se dicen («3 valores no se pudieron graficar»), nunca se inventa un 0.
- **Consultas «enmendadas» o borradas:** sólo cuenta lo que hoy se ve en el expediente (misma regla que la
  lista de consultas).
- **Carga:** todo es de UN paciente (decenas de consultas): una sola consulta a la base, sin paginar.

## 7. Cómo se construye (propuesta)

| Paso | Qué | Riesgo |
|---|---|---|
| **P1** | La ruta `GET …/progreso` (series de vitales y de plantillas, filtro por tratamiento, fechas resueltas) + probe contra prod en tx de sólo lectura con los pacientes que SÍ tienen series (dr-prueba / cardiología sembrada) | Bajo: sólo lee |
| **P2** | La pantalla: gráficas con `recharts` (ya está en el app), lista de un solo valor, filtro por tratamiento, botón «Progreso» y «Ver progreso» | Bajo |
| **P3** | Fotos lado a lado (elegir A y B, filtros) | Bajo |
| **P4** | Manual + guía + capabilities en el MISMO commit que la pantalla; prueba a mano en Chrome (quebradita) | — |

Tamaño: parecido a T3. Sin migración.

## 8. ¿Cuándo conviene?

Hoy la pantalla mostraría gráficas en **~13 pacientes** (vitales) y casi ninguna de plantillas. Dos
lecturas:

- **Hacerla ya** es barato y de bajo riesgo, y le da al doctor una razón para LLENAR vitales y campos
  numéricos (lo que hoy deja vacío en 270 de 310 consultas). La importación de historial también trae
  fechas viejas que la alimentan.
- **Esperar** a que haya más datos no cambia el diseño; sólo el momento.

Recomendación: si se hace, empezar por **P1 + P2 sólo con signos vitales** (la fuente más pareja), y
sumar plantillas y fotos en cuanto se vea usada.
