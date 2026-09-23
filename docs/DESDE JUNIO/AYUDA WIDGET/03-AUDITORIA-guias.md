# 🔍 Fase 0 — Auditoría de las guías contra la UI de hoy

> **Tipo: REFERENCIA (foto fechada).** Qué dicen `CitasGuide`, `ExpedientesGuide` y `PagosGuide`
> contra lo que hace el código el **2026-09-22**. No se corrige nada aquí: esto es la lista de
> desviaciones que pedía [`02-PLAN`](02-PLAN-construccion.md) §Fase 0. Cuando se arreglen, se
> anota en [`SESSION-REFRESCO`](SESSION-REFRESCO.md), no aquí.
>
> **Método:** leer cada afirmación de la guía y buscarla en el componente que la rinde. **No se
> abrió un navegador** — todo lo de abajo es lectura de código, con archivo y línea.

**Leyenda:** 🔴 el doctor sigue la guía y **falla** o se lleva un hecho falso · 🟡 nombre
cambiado o pieza que falta · ⚪ cosmético.

---

## 0. El hallazgo que cambia el plan

**La deriva NO viene de las mudanzas de menú del 2026-09-20.** El `grep` de `02-PLAN` buscó
«Editar Perfil» e «Integraciones» y no encontró nada — y era la prueba equivocada. Lo que rompió
`CitasGuide` es **julio y agosto**: el calendario Día/Semana/Mes/Año (`07ff7ed0`), agendar sin
rango (`ca627673` → `480f7f72`), los grupos Cobro/Factura por cita y el rediseño de los botones de
confirmación. La guía de Citas se escribió el **2026-04-08** (`ee8fcf57` → `20fefca5`) y desde
entonces **sólo un commit la tocó**: `81403e00`, que arregló la barra y nada más (`git log` sobre
el archivo). Cinco meses de cambios a la agenda, cero a su explicación.

Consecuencia para `00-POR-QUE` §5: *«los docs se arreglan ANTES de conectarlos»* no es una
precaución teórica. **Hoy, la mitad de la guía de Citas enseñaría flujos que ya no existen.**

| Guía | Estado | Tamaño del arreglo |
|---|---|---|
| `CitasGuide` — pestaña **Flujos** (`view="status"`) | 🔴 **Mayormente obsoleta** | Reescribir |
| `CitasGuide` — pestaña **Acciones** (`view="acciones"`) | 🔴 Botones de correo y filtros **falsos** | Reescribir 3 de 4 secciones |
| `ExpedientesGuide` | 🟡 **Casi al día** (el perfil ya se había actualizado) | Parches |
| `PagosGuide` | 🟡 Correcta en lo que dice, **le falta el camino más común** | Una sección nueva |

---

## 1. `CitasGuide` — pestaña «Citas: Flujos»

### 🔴 1.1 Las «vistas» y «Cómo se agenda una cita» describen el mundo de los slots

| La guía dice | El código hace |
|---|---|
| «**Vista Calendario**: navega por mes, selecciona un día y ve los horarios en el panel lateral» · «**Vista Lista**: filtra … "Filtrar por fecha" y "Todos los horarios"» | Un solo calendario **Día · Semana · Mes · Año** con botón **Hoy** (`calendar/CalendarShell.tsx:15-18,89`). Ya no hay panel lateral ni vista Lista |
| 3 rutas: app pública · «**Doctor agenda en horario existente**» · «**Nuevo horario**» | El modal (`BookPatientModal`, `rangeMode`) pide **servicio → fecha → se ESCRIBE la hora** (cualquier minuto); los rangos publicados aparecen como botones de atajo. **No existe** «Nuevo horario» ni «selecciona un horario abierto del listado» |
| *(nada)* | **Clic en un hueco del calendario** abre el modal con fecha y hora ya puestas (`page.tsx:221`, CITAS §10). Es la forma más rápida de agendar y la guía no la menciona |
| *(nada)* | **Clic en una cita del calendario** abre su modal con todas sus acciones (`BookingDetailModal`) |

### 🔴 1.2 «Configurar disponibilidad» — el modal de rangos cambió

| La guía dice | El código hace |
|---|---|
| «Día único / **Patrón recurrente**» | Botones **«Día Único» / «Recurrente»** (`CreateRangeModal.tsx:214`); el modal se titula **«Crear Disponibilidad»** |
| «duración (**30 o 60 min**). Opcionalmente activa **descanso entre citas**» | **«Intervalo entre citas»: 15 · 30 · 45 · 60** (`:336`). **No hay opción de descanso** |
| Clic en **Crear** | El botón dice **«Crear N Rangos»** (`:488`) |
| Encabezado «**Bloquear Periodo**» · confirmar con **Aplicar** | El modal se titula **«Gestionar Bloqueos»**, pestañas **Bloquear / Desbloquear**, y el botón dice **«Bloquear N día(s)»** (`BlockTimeModal.tsx:281,604`). No hay botón «Aplicar» |

⚠️ Y el encuadre entero sobra: la guía presenta crear rangos como el paso previo a agendar
(`defaultOpen`, segunda sección). Desde agendar sin rango **es opcional** — sólo sirve para lo
que el paciente ve en la página pública. La propia barra ya lo dice («Más» existe por eso).

### 🔴 1.3 Recordatorios — el control no es el que describe

| La guía dice | El código hace |
|---|---|
| «**ícono de campana, junto al título**» | Una **tarjeta aparte** debajo de la barra, «Recordatorio automático por correo», con un **interruptor** (`page.tsx:339-377`) |
| «**2 horas antes**» (fijo, dicho 4 veces) | **Configurable**: 15 min · 30 min · 1 h · 2 h · 4 h · **1 día** (`:357-362`) |

### 🟡 1.4 Datos que se piden al agendar

La lista omite **Notas**, **Consultorio** (sólo con 2+ sedes) y llama «¿Primera vez? (sí/no)» a
lo que la UI llama **«Tipo de visita: Primera vez / Recurrente»** (`PatientFormStep.tsx:200`).
Tampoco dice que **qué campos son obligatorios lo decide el doctor** en **«Campos de Cita»**.
Además habla de «Rutas B1 y B2», que no existen en ninguna parte de la guía (resto de una versión
anterior).

### 🟡 1.5 Botones de la barra que la guía no menciona

**Formulario libre** · **Campos de Cita** · **Asistente** (con permiso `asistente_ia`) ·
**Ayuda**. La referencia de botones sólo lista *Agendar Cita* y el menú *Más*.

---

## 2. `CitasGuide` — pestaña «Citas: Acciones»

### 🔴 2.1 Los botones de correo — **ninguno se llama como dice la guía**

La guía dedica tres bloques a **«Correo» / «Reenviar» / «Enviar Meet» / «Reenviar Meet»**, con
reglas sobre cuándo aparece cada uno. **Ninguno de esos cuatro rótulos existe.** Hoy
(`BookingActions.tsx:568-628`, grupo **«Confirmación cita»**):

| Botón real | Cuándo |
|---|---|
| **Enviar confirmación** | Aún no se ha enviado (en telemedicina, además crea el Meet) |
| **Reenviar confirmación** | Ya se envió; el tooltip da la fecha |
| **Confirmación por WhatsApp** | Abre `wa.me` con el mensaje listo — **no está en la guía** |
| **Entrar a Meet** | Telemedicina con Meet ya creado — **no está en la guía** |
| **Necesita correo / Necesita WhatsApp** | Falta el dato; lleva al expediente — **no está en la guía** |

Y el supuesto de fondo es falso: la guía afirma que el correo **siempre** se manda solo al
confirmar/agendar, y que «Enviar» sólo aparece si falló. El código documenta lo contrario —
el envío automático **exige correo Y Gmail conectado**; medido en prod, 17 de 104 citas
CONFIRMED tenían correo y **ningún envío** (`BookingActions.tsx:510-515`). O sea: «Enviar
confirmación» es un estado normal, no un error.

### 🔴 2.2 La tabla de «qué botones aparecen según el estado» — tres filas mal

| La guía dice | El código hace (`StatusActions`) |
|---|---|
| Sección Pendiente: «Completar y No asistió aparecen **bloqueados**» | **Habilitados** en Pendiente (`:477-488`). La propia tabla de abajo de la guía dice ✓ — **la guía se contradice sola** |
| Vencida: **sin** Cancelar | Una Vencida es una PENDING/CONFIRMED cuyo horario pasó, y rinde el **mismo** grupo Estado: **Cancelar sí aparece** (y Confirmar, si era Pendiente) |
| Terminal: «**Única acción disponible: Eliminar**» | En **Completada** siguen vivos **Cobro**, **Factura** y **Documentos** (`:410-452`, decisión «completar ≠ cerrar el papeleo»). Sólo Cancelada/No asistió se quedan casi solas |

Faltan además los grupos **Cobro** («Link de pago», Stripe o Mercado Pago) y **Factura**
(«¿Necesita factura?» → botón **Facturación** → formulario fiscal al paciente), que existen desde
el trabajo de flujo de dinero. **Son los que más le importan al doctor que cobra**, y la guía de
Citas no dice que existen.

### 🔴 2.3 «Completar» — no es un cambio de estado seco

La guía: «Registra que la consulta se realizó. Estado → Completada». El código abre un **modal
«Completar cita»** que pide **precio** y **forma de pago** (Efectivo · Transferencia · Tarjeta ·
Cheque · Depósito) y **registra el ingreso en Flujo de Dinero** (`CompleteBookingModal.tsx`). Es
el puente entre la agenda y el dinero, y la guía lo presenta como un clic.

### 🔴 2.4 Filtros de la tabla

| La guía dice | El código hace (`BookingsSection.tsx`) |
|---|---|
| Botón «**Todas**»: quita la fecha **y restablece el estado a Activas y limpia la búsqueda** | Botón **«Todas las fechas»**, un **interruptor** que toca **sólo la fecha**; apagarlo vuelve a hoy (`:155-174`) |
| Desplegable con «**Activas**» (Pendiente + Agendada + **Vencida**) y «**Vencida**» | «Activas» es ahora el **botón «Citas Agendadas»** (Pendiente + Agendada). El desplegable arranca en «**Más estados…**» y **no tiene** opción «Vencida» (`:216-230`) |
| *(nada)* | Botón **«Por Facturar»**: citas con la casilla de factura marcada y sin factura (`:200-211`) |

### 🟡 2.5 Las filas ya no muestran los botones

La guía lista «Botones de acciones disponibles» como información visible en cada fila. Hoy la
fila está **colapsada** (paciente · fecha · expediente · precio · estado) y las acciones salen
**al hacer clic** en ella o en el chevron (`BookingsSection.tsx:91-101`). Faltan también las
columnas que sí se ven: **Expediente** (vincular / «+ Crear expediente»), **Precio** editable en
línea, la casilla **«¿Necesita factura?»**, las **notas** de la cita y el **bloqueo extendido**
(«Bloqueo: 10:00–11:30 · Editar»).

### ⚪ 2.6 Detalles

- «Formulario → **Recibido**»: el rótulo real es **«Crear formulario» → «Formulario recibido»**
  (`FormularioStatusButton.tsx:48,73`).
- «Pendientes: citas solicitadas desde la **app pública**» — también llegan del agente y de otros
  caminos; no se verificó cuáles crean PENDING, así que **no** se afirma nada aquí.

---

## 3. `ExpedientesGuide`

El bloque **«Perfil del paciente»** está al día (alguien lo actualizó: Informe, Datos Fiscales,
Citas e Ingresos, «Editar» dentro de Información de Contacto). El resto tiene parches:

| | La guía dice | El código hace |
|---|---|---|
| 🔴 | Botón «**Formularios**» arriba de la lista (bandeja de pre-cita) | **No existe.** La barra es Plantillas · Receta PDF · Importar · Nuevo Paciente (`medical-records/page.tsx:110-150`). La bandeja `/medical-records/formularios` sólo se alcanza desde el perfil y la línea de tiempo del paciente. **Las dos menciones de la guía mandan a buscar un botón que no está** |
| 🔴 | «Chat IA» y «Voz» en consulta, paciente y receta, sin condiciones | Desde TIERS Q2b **están bloqueados en FREE y BASICO** (`AiUpgradeDialog.tsx:91`). Un doctor en esos planes sigue la guía y se topa con un candado |
| 🟡 | Filtro «Activos o Archivados» · búsqueda «por nombre o **email**» | Tres opciones: **Activos · Inactivos · Archivados**; el campo dice «Buscar por nombre o **ID**…» (`PatientSearchBar.tsx:25-38`) |
| 🟡 | *(nada)* | **Receta PDF** (sólo titular, movida aquí el 2026-09-20) · **Importar** (sólo titular) · vista **Filas / Tarjetas** · contador del plan «**N / M activos**» |
| ⚪ | Botón «**Chat IA**» en la barra del Form Builder | Rotulado «**IA**» (tooltip «Asistente IA»), `form-builder/Toolbar.tsx:95-98` |
| ⚪ | Botón «Create Template» | Correcto — pero porque **la página está en inglés** («Custom Encounter Templates», `custom-templates/page.tsx:49-59`). Es deuda de la UI, no de la guía |
| ⚪ | «Condiciones Médicas» | La etiqueta real es «**Condiciones Crónicas**» (`PatientForm.tsx`) |

✅ **Verificado y correcto:** los 9 tipos de campo · «Usar como formulario pre-cita» · «Vista
previa» · «Nueva Consulta» / «Crear Consulta» / selector de Plantilla · «Guardar como Borrador» /
«Guardar y Emitir» · Recetas · Informe · Línea de Tiempo · Docs y Galería · Notas · Archivar ·
campos obligatorios de Nuevo Paciente.

---

## 4. `PagosGuide`

**No vive en `/dashboard/ayuda`**: se rinde como pestaña **«Guía»** dentro de `/dashboard/pagos`
(`pagos/page.tsx:89`). Los «~3,589 líneas» de `00-POR-QUE` §2 la contaban como parte del
centro de ayuda — no lo es.

✅ **Lo que dice es cierto** en lo verificable desde el código: «Conectar con Stripe»,
«Completar registro en Stripe», «Mi Stripe», los indicadores «Cargos habilitados» / «Pagos
habilitados», «Conectar con Mercado Pago», «Crear link», mínimo $10 / máximo $100,000
(`CreatePaymentForm.tsx:46-47`). Lo que depende de Stripe/MP (tiempos de verificación,
depósitos, OXXO) **no se puede verificar leyendo nuestro código** y no se auditó.

| | Hallazgo |
|---|---|
| 🟡 | **Le falta el camino más común:** crear el link **desde la cita** (grupo Cobro → «Link de pago», que pre-llena monto y paciente). La guía sólo enseña «Crear link» desde la página de Pagos. La palabra «cita» aparece 3 veces en 1,492 líneas |
| ⚪ | **Sin acentos en todo el archivo** («Que es», «como», «deposito», «verificacion»). Las otras dos guías sí los tienen |

---

## 5. Lo que esto significa para el manual (Fase 1)

1. **El manual de Agenda NO se puede sacar de `CitasGuide`.** Hay que escribirlo desde el
   código, como anticipaba `02-PLAN` §Fase 1 — y esta auditoría es el porqué, con números.
2. **Agenda es más grande de lo que la guía cree.** El flujo real de un doctor cruza **cuatro**
   pantallas: agendar → confirmar/recordar → **completar (cobro)** → **facturar**. La guía cubre
   la primera y medio de la segunda.
3. **El plan del doctor cambia la respuesta correcta.** Chat IA, Voz, cupo de pacientes: el
   manual tiene que decir «en tu plan…» o el widget contestará con toda seguridad cómo usar algo
   que el doctor no tiene. Eso es una **decisión de diseño nueva** para `01-ARQUITECTURA` §6: hoy
   dice que la ruta actual es «la ÚNICA señal de contexto que recibe».
4. **La prueba de «¿ya se desvió?» no puede ser un `grep` de nombres sospechosos.** Aquí falló.
   Un gate útil comprobaría que **cada rótulo de botón que la guía cita existe como texto en
   algún `.tsx`** — con eso, «Enviar Meet», «Todas», «Aplicar», «Bloquear Periodo» y
   «Formularios» habrían salido solos.

---

## 6. Hallazgo colateral (no es de las guías)

El botón **Ayuda** de la página de Citas enlaza a `/dashboard/ayuda?tab=citas`
(`appointments/page.tsx:328`), pero **no existe ninguna pestaña `citas`** — las ids son
`citas-acciones` y `citas-status`. Funciona **por accidente**: la página cae a la pestaña por
defecto, que resulta ser `citas-acciones`.
