# VENTAS AL PACIENTE — diseño (2026-10-02)

> **Tipo: DISEÑO.** Lo que se pidió, lo que ya existe, las 4 decisiones del usuario y el orden de
> entrega. El estado vivo (qué paso va, qué está en prod) se anota en la tabla de §5.

## 1. Lo que pidió el usuario

1. **Catálogo:** en Ventas, el desplegable de conceptos ofrece TAMBIÉN los servicios que salen en
   Citas (nombre, descripción, precio), además de lo de «Productos y Servicios». Al agregarlos se
   editan como hoy (precio, cantidad, descuento, IVA).
2. **Documento:** un PDF de la venta con el estilo de la receta — logo, firma, nombre, cédulas,
   datos del consultorio — y **vista previa en vivo**. Es un **comprobante para el paciente, NO un
   CFDI**: «factura» en esta app ya es la del SAT (Facturación). Nombre de trabajo: «Nota de venta».
3. **Automático desde la cita:** al completarse una cita con servicio se genera su nota, y se ve /
   descarga desde la **tarjeta de la cita** y desde el **expediente**.
4. **Ventas en la visita:** en la tarjeta de Visita (Expedientes), junto a Consulta · Nota · Imagen…,
   una opción **«Venta»**: para ESE paciente, ligada a ESA visita, con más conceptos (producto,
   servicio extra) además del de la cita. Son las MISMAS ventas de la página Ventas, no una copia.

## 2. Lo que ya existe (y que cambia el diseño)

| Pieza | Hoy | Consecuencia |
|---|---|---|
| Catálogo de Ventas | `practice_management.products` (tipo `product`/`service`) vía `GET /api/practice-management/products` | Los servicios de Citas viven en OTRA tabla (`public.services`, los del Perfil Público) y Ventas no la lee |
| Comprador de una venta | `Sale.clientId` → `Client` (lista de clientes de negocio) | Una venta no sabe de pacientes, citas ni visitas |
| `SaleItem.productId` | `Int?` con FK a `Product` | Un servicio de Citas (id `cuid` String) no cabe ahí: en el paso 1 entra como concepto con `productId = null` |
| Dinero de la cita | La cita cobrada ya tiene su `LedgerEntry` (`bookingId` único) en Flujo de Dinero | 🔴 Una venta también crea su `LedgerEntry`: si el servicio de la cita se volviera venta, **la consulta contaría DOS veces como ingreso** |
| PDF con firma | `lib/receta-pdf.ts`: UNA función de dibujo jsPDF para descarga y vista previa (logo, firma, cédulas, color, tamaño) | Se reutiliza el patrón, no se copia |
| Visita | agrupa consultas, notas, imágenes, recetas, informes | No tiene ventas |

## 3. Decisiones del usuario (2026-10-02) — no se re-litigan

1. **Venta a un paciente:** se agrega un vínculo de `Sale` al **paciente** (y a la visita / cita). NO
   se crea un «cliente» por paciente (duplicaría el padrón y se desincronizaría).
2. **El dinero de la cita no se cuenta dos veces:** la nota de la cita es **sólo el documento**,
   hecho con el cobro que la cita YA tiene. Sólo los conceptos EXTRA de la visita son ventas reales
   (con su `LedgerEntry`). El modelo de dinero de la cita no se toca.
3. **«Automático» = al COMPLETARSE la cita** (ahí ya se sabe que pasó y a qué precio).
4. **Dos catálogos por ahora:** se leen los servicios de Citas tal cual, junto a «Productos y
   Servicios». Fusionarlos queda para después.

## 4. Orden de entrega

| Paso | Qué | BD | Depende de |
|---|---|---|---|
| **1. Catálogo** | Servicios de Citas en el desplegable de Ventas | no | — |
| **2. PDF** | «Nota de venta» de cualquier venta, con vista previa, patrón de la receta | no | — |
| **3. Paciente + visita** | `Sale` → paciente/visita/cita (SQL a mano + `prisma db execute`), opción «Venta» en la visita, se ven en Ventas | **sí** | decisión 1 |
| **4. Automático desde la cita** | Nota generada al completar; se abre desde la tarjeta de la cita y el expediente | quizá | decisiones 2 y 3, paso 3 |

Los pasos 3 y 4 llevan plan propio por escrito y smoke test read-only contra prod antes del push
(reglas del repo: no hay staging, `prisma db push` revierte cosas en prod).

## 5. Estado

| Paso | Estado | Commit |
|---|---|---|
| 1 | construido 2026-10-02 (IVA 0 % para los de Citas; arreglo de `itemType` en Ventas y Cotizaciones); code review hecho, 6 de 9 hallazgos arreglados | — |
| 2 | — | — |
| 3 | — | — |
| 4 | — | — |

## 6. Decidido / abierto

- ✅ **IVA de un servicio de Citas = 0 %** por default, editable (usuario 2026-10-02). ⚠️ No es
  asesoría fiscal.
- ✅ **Bug `itemType`** arreglado en `addProductToSale` (Ventas) y `addProductToQuote` (Cotizaciones,
  porque «venta desde cotización» lo copia tal cual). Compras tiene el mismo patrón pero su tipo
  `Product` ni trae `type`: no se tocó.
- 🟡 **Las ventas YA guardadas con el bug** siguen con `itemType: 'product'` en sus servicios del
  catálogo (editar no lo corrige). Sólo es una etiqueta hoy; si el PDF del paso 2 distingue
  producto/servicio, hace falta un backfill SQL (con su smoke test).
- 🟡 **Etiqueta «Servicio de tus citas» = empate por NOMBRE** contra los servicios ACTUALES: si se
  renombra el servicio, el renglón viejo dice «Servicio personalizado»; un concepto libre con el
  mismo nombre se etiqueta como de Citas. Interino hasta que el paso 3 guarde `serviceId` en el
  renglón.
- ❓ **IVA de un `service` de «Productos y Servicios»** sigue en 16 % (sólo los de Citas entran en
  0 %): el mismo «Consulta» puede salir con IVA distinto según de qué catálogo se eligió. Pendiente
  de decisión del usuario.
