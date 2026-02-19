# Gestión de Consultorio - Visión General

## Propósito

El módulo de **Gestión de Consultorio** permite administrar las operaciones financieras y comerciales de la práctica médica: ventas, compras, flujo de dinero, productos, clientes, proveedores y cotizaciones.

**Ruta:** Menú lateral > Gestión de Consultorio

---

## Qué puedo hacer en Gestión de Consultorio

El módulo incluye los siguientes submódulos:

- **Flujo de Dinero** — registrar ingresos y egresos del consultorio, ver el estado de resultados agrupado por áreas. URL: `/dashboard/practice/flujo-de-dinero`
- **Ventas** — registrar ventas a clientes, dar seguimiento a pagos y cambiar estados. URL: `/dashboard/practice/ventas`
- **Compras** — registrar adquisiciones a proveedores, controlar pagos y estados. URL: `/dashboard/practice/compras`
- **Cotizaciones** — crear propuestas comerciales y convertirlas a venta con un clic. URL: `/dashboard/practice/cotizaciones`
- **Productos** — gestionar el catálogo de productos y servicios del consultorio. URL: `/dashboard/practice/products`
- **Clientes** — mantener la base de datos de clientes comerciales. URL: `/dashboard/practice/clients`
- **Proveedores** — mantener la base de datos de proveedores. URL: `/dashboard/practice/proveedores`
- **Áreas y Subáreas** — configurar las categorías para clasificar movimientos de dinero. URL: `/dashboard/practice/areas`

---

## Chat IA disponible

El Chat IA (botón ✨) puede crear registros en:
- **Flujo de Dinero** — movimientos de ingresos y egresos (soporta lote)
- **Ventas** — registros de venta
- **Compras** — registros de compra
- **Cotizaciones** — propuestas comerciales

Productos, Clientes, Proveedores y Áreas no tienen Chat IA — se crean manualmente.

---

## Conceptos clave

**Estados de Venta:** PENDIENTE → CONFIRMADA → EN PROCESO → ENVIADA → ENTREGADA (o CANCELADA en cualquier punto)

**Estados de Compra:** PENDIENTE → CONFIRMADA → EN PROCESO → ENVIADA → RECIBIDA (o CANCELADA en cualquier punto)

**Estado de Pago** (ventas y compras): PENDIENTE (sin pago) / PARCIAL (pago parcial) / PAGADA (monto completo)

**Áreas y Subáreas:** Las áreas son de tipo INGRESO o EGRESO — ese tipo es inmutable después de crearse. Eliminar un área elimina también todas sus subáreas.

**Movimientos automáticos:** Al crear una Venta o Compra, el sistema genera automáticamente un movimiento en Flujo de Dinero.

---

## Preguntas Frecuentes

**¿Qué puedo hacer en Gestión de Consultorio?**
Registrar ventas, compras, cotizaciones, movimientos de dinero, y gestionar productos, clientes y proveedores.

**¿Puedo crear ventas con el Chat IA?**
Sí. Selecciona "Nueva Venta" en el hub ✨ y dicta o escribe la información.

**¿Puedo crear compras con el Chat IA?**
Sí. Selecciona "Nueva Compra" en el hub ✨.

**¿Las ventas y compras aparecen en Flujo de Dinero?**
Sí, automáticamente. Al crear una venta se genera un ingreso; al crear una compra se genera un egreso.

**¿Puedo eliminar una venta?**
Sí, desde la lista de Ventas. Requiere confirmación.

**¿Puedo eliminar una compra?**
Desde la lista de Compras sí. No es posible eliminar compras desde la vista de Flujo de Dinero — los movimientos de compras ahí son automáticos y de solo lectura.

**¿Puedo convertir una cotización en venta?**
Sí. Desde la lista de Cotizaciones, usa el botón de carrito (ShoppingCart) para crear una venta automáticamente con los mismos datos.

**¿Puedo cambiar el tipo de un área de INGRESO a EGRESO?**
No. El tipo de área es inmutable después de su creación. Debes eliminar el área y crear una nueva con el tipo correcto.

**¿Puedo facturar desde la aplicación?**
No. La aplicación no genera facturas fiscales (CFDI). La facturación debe hacerse externamente.
