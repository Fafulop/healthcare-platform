# ✅ PENDIENTES — lo que queda de la pasada de pruebas, con recomendación

> **Tipo: ESTADO (se actualiza).** Creado 2026-10-05 al cerrar la pasada (H3 en prod). Una línea por
> pendiente con **la recomendación**. Criterio (pedido del usuario): **arreglos simples y efectivos** —
> si el arreglo es chico se hace; si no, se avisa, se documenta o se deja. El detalle de cada H-xxx vive
> en `03-HALLAZGOS.md`. Al cerrar uno: `[x]` + commit, y su fila en 03.
>
> Supuesto: las 27 guías están bien (el usuario las dio por buenas provisionalmente; falta su lectura).

## Orden sugerido

1. **Lote A** — H-068 + H-070.
2. **Lote B** — las decisiones simples de §1 + los arreglos de una línea de §2.
3. **H-009** con su propio plan (es el único de dinero mal contado).
4. **H4 videos** (§4).

---

## 1. Decisiones — la opción simple

| | ID | Qué | **Recomendación simple** |
|---|---|---|---|
| [ ] | **H-009** | Una venta NO pagada cuenta como ingreso (verificado 2026-10-05: `ledger/balance` suma el `amount` completo de todo ingreso con `porRealizar: false`, y las ventas nacen así) | **Que las tarjetas de saldo sumen lo PAGADO (`amountPaid`) y el resto vaya a «Por cobrar»**, en un solo lugar (la ruta de saldo). Antes: una consulta de sólo lectura en prod que confirme que todos los ingresos traen `amountPaid` lleno. Es el único pendiente que sí vale un plan propio |
| [ ] | **H-062** | Cita ya pagada que se reagenda: el pago se queda en la vieja | **Mover el pago a la cita nueva** en el mismo punto donde Reagendar ya pasa «¿Necesita factura?» (`7323a896`). Mientras, sigue el atajo documentado (completar la nueva en $0) |
| [ ] | **H-059** | Devolución/contracargo no toca Flujo | **Documentarlo**: «si devuelves dinero, registra un egreso "Devolución" en Flujo». Las devoluciones las inicia el doctor en MP/Stripe y son raras; automatizar = más webhooks |
| [ ] | **H-057** | Ligar una cita a una sesión cambia su precio en silencio | **No cambiar el precio de la cita** (quitar la sobrescritura) |
| [ ] | **H-042** | Archivar con citas futuras no avisa | **Avisar en la confirmación**: «Tiene N citas futuras; no se cancelan» — las cancela el doctor si quiere |
| [x] | **H-011** | Eliminar una cita deja su cobro en Flujo | **Decirlo en el diálogo** («El cobro de $X se queda en Flujo de Dinero») |
| [x] | **H-013** | Telemedicina pide «Consultorio *» | **No pedirlo ni guardarlo en Telemedicina** |
| [ ] | **H-049** | Editar una plantilla ya usada cambia las consultas viejas | **Avisar al editar** una plantilla que ya tiene consultas |
| [ ] | **H-035** | La nota de venta imprime la dirección del perfil, no la del consultorio | **Usar la del consultorio** de la cita *si el consultorio guarda dirección*; si no, dejarlo |
| [ ] | **H-045** | No se puede agendar desde el expediente | **Dejarlo** — el manual no lo promete y Agenda funciona |
| [ ] | **H-016** | El ingreso de una cita futura se fecha el día de la cita | **Dejarlo** — la guía A6 ya lo dice. Cerrar |
| [ ] | **H-005** | Quitar el precio a una sesión cuya cita ya lo tomó | **No arreglar** (caso raro). Cerrar |
| — | H-063 | El asistente no completa en $0 | **Estacionado** (decisión del usuario) |

## 2. Arreglos sin decisión — sólo los chicos

**Lote A — ya**
- [x] **H-068** (`750310d4`, ✅ prod: 9.4 MB → 380 KB) — reducir el logo antes de meterlo al PDF (una función: dibujarlo a ~300 px en un canvas). Hoy la receta pesa 9.4 MB y «Receta PDF» se congela
- [x] **H-070** (`750310d4`, ✅ prod) — esconder «Completar» / «No asistió» en una cita Pendiente y quitar el aviso de la guía A4

**Lote B — una línea o casi**
- [x] (B1, sin commit) H-031 «No asistió» con confirmación, como «Cancelar»
- [x] (B1, sin commit) H-032 eliminar una cita deja rastro en la bitácora
- [x] (B1, sin commit) H-039 la tarjeta «Pendientes» filtra las pendientes al tocarla
- [ ] H-044 tipo de sangre y condiciones crónicas visibles en el perfil
- [x] (B1, sin commit) H-012 Reagendar trae el servicio de la cita (el valor ya se calcula, no se pasa)
- [x] (B1, sin commit) H-014 la pista del consultorio no dice «no hay de dónde deducir» cuando ya eligió uno
- [ ] H-017 quitar «o haz clic para agregar» de la paleta (en escritorio no funciona)
- [ ] H-020 los errores del editor de plantillas salen al guardar, no al abrir
- [ ] H-028 sin asteriscos de formulario en la vista de la receta
- [x] (B1, sin commit) H-053 Escape cierra «Gestionar Bloqueos»
- [ ] H-055 «Nuevo tratamiento» no propone una hora que ya pasó
- [x] (B1, sin commit) H-047 una línea en el manual (cita dentro de la ventana del recordatorio = sin recordatorio)
- [ ] H-008 borrar el script muerto

**Dejar (no vale la complejidad hoy)**
- H-052 ventas en «Citas e Ingresos» · H-056 «vacía» y fecha de la venta · H-061 más toasts de «link desactivado» · H-043 bitácora sólo con lo que cambió · H-019 jerga del editor · H-034 modalidad desde el servicio · H-040 partir el nombre de la reserva · H-060 doble pago simultáneo · H-003 tope de 200 · H-002 · H-004 · H-006
- H-015 — sólo mirar la bandeja del paciente una vez; no es código

## 3. Construido pero nunca probado a mano

- [x] Aviso de H-030 al cancelar — ✅ 2026-10-05: al cancelar la cita de prueba de H-070 salió «Cita cancelada» (en español)
- [ ] Tratamientos V2 y V5 («Resumen PDF») — los pruebo en Chrome con QA E1
- [ ] Pago real de Mercado Pago a un link desactivado — reintentar una vez con otra tarjeta; si MP sigue rechazando, queda documentado
- «Reactivar» con el plan lleno — dejarlo (mismo chequeo del servidor que «Nuevo paciente»)

## 4. Ayuda y guías

- [ ] **H4 videos** — YouTube no listado · los grabas tú con captura simple · sin voz, con subtítulos. Primero: agendar · completar · link de pago · nueva visita · receta
- [ ] Después: el widget «?» enlaza guías (G3) · guías de Flujo de Dinero / Facturación / Pagos / Ventas

## 5. Más adelante

- Contexto de pantalla (`../AGENTES/GENERAL AGENTES/12-PLAN-contexto-de-pantalla.md`) → «modo guiado» del copiloto (`13-IDEA-copiloto-que-guia-y-actua.md`)
