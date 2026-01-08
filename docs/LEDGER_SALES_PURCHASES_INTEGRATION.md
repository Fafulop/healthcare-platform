# Integración Bidireccional: Flujo de Dinero - Ventas - Compras

## Descripción General

Esta funcionalidad implementa una integración bidireccional completa entre tres módulos del sistema de gestión de práctica médica:

- **Flujo de Dinero (Ledger)**: Sistema de contabilidad que registra todos los ingresos y egresos
- **Ventas**: Gestión de ventas a clientes
- **Compras**: Gestión de compras a proveedores

La integración permite que los registros se creen automáticamente en ambas direcciones, manteniendo la coherencia de datos y facilitando la gestión financiera.

---

## ¿Cómo Funciona?

### Dirección 1: Flujo de Dinero → Ventas/Compras

Cuando creas un nuevo movimiento en **Flujo de Dinero**, puedes seleccionar el tipo de transacción:

1. **N/A (No aplica)**: Movimiento independiente sin vínculo
   - Ejemplo: Pago de servicios, nómina, gastos generales

2. **VENTA**: Crea automáticamente un registro de venta
   - Genera un número de venta (VTA-2026-001)
   - Requiere seleccionar un cliente
   - Requiere estado de pago (Pendiente, Parcial, Pagado)
   - Crea un registro completo en el módulo de Ventas

3. **COMPRA**: Crea automáticamente un registro de compra
   - Genera un número de compra (CMP-2026-001)
   - Requiere seleccionar un proveedor
   - Requiere estado de pago (Pendiente, Parcial, Pagado)
   - Crea un registro completo en el módulo de Compras

### Dirección 2: Ventas/Compras → Flujo de Dinero

Cuando creas una **Venta** o **Compra** desde sus respectivos módulos:

- **Al crear una Venta**: Se crea automáticamente un movimiento de ingreso en Flujo de Dinero
  - Tipo: Ingreso
  - Área: Ventas
  - Subárea: Ventas Generales
  - Concepto: "Venta VTA-2026-001 - Cliente: [Nombre del Cliente]"
  - Monto: Total de la venta
  - Estado de pago: El seleccionado en la venta

- **Al crear una Compra**: Se crea automáticamente un movimiento de egreso en Flujo de Dinero
  - Tipo: Egreso
  - Área: Compras
  - Subárea: Compras Generales
  - Concepto: "Compra CMP-2026-001 - Proveedor: [Nombre del Proveedor]"
  - Monto: Total de la compra
  - Estado de pago: El seleccionado en la compra

---

## Guía de Uso

### Crear Movimiento con Venta desde Flujo de Dinero

1. Ve a **Flujo de Dinero** → **Nuevo Movimiento**
2. Selecciona **Tipo de Movimiento**: Ingreso
3. Ingresa el **Monto** (ej: $5000.00)
4. Ingresa el **Concepto** (ej: "Consulta médica especializada")
5. Selecciona **Tipo de Transacción**: VENTA
6. 📌 **Campos adicionales aparecen**:
   - **Cliente** ⭐ (requerido): Selecciona de la lista
   - **Estado de Pago** ⭐ (requerido): Pendiente, Parcial, o Pagado
7. Completa los demás campos (Fecha, Área, Subárea, etc.)
8. Haz clic en **Guardar Movimiento**

**Resultado**:
- ✅ Se crea el movimiento en Flujo de Dinero con ID interno (ING-2026-001)
- ✅ Se crea automáticamente una venta con número VTA-2026-001
- ✅ Ambos registros quedan vinculados

### Crear Movimiento con Compra desde Flujo de Dinero

1. Ve a **Flujo de Dinero** → **Nuevo Movimiento**
2. Selecciona **Tipo de Movimiento**: Egreso
3. Ingresa el **Monto** (ej: $2500.00)
4. Ingresa el **Concepto** (ej: "Material médico para consultas")
5. Selecciona **Tipo de Transacción**: COMPRA
6. 📌 **Campos adicionales aparecen**:
   - **Proveedor** ⭐ (requerido): Selecciona de la lista
   - **Estado de Pago** ⭐ (requerido): Pendiente, Parcial, o Pagado
7. Completa los demás campos (Fecha, Área, Subárea, etc.)
8. Haz clic en **Guardar Movimiento**

**Resultado**:
- ✅ Se crea el movimiento en Flujo de Dinero con ID interno (EGR-2026-001)
- ✅ Se crea automáticamente una compra con número CMP-2026-001
- ✅ Ambos registros quedan vinculados

### Ver Información Vinculada

#### En la Lista de Flujo de Dinero

La tabla ahora muestra 3 columnas nuevas:

| Tipo Transacción | Cliente/Proveedor | Estado Pago |
|------------------|-------------------|-------------|
| 🔵 Venta | Clínica San José | 🟢 Pagado |
| 🟣 Compra | Farmacia del Norte | 🟠 Pendiente |
| N/A | - | - |

#### En el Detalle de un Movimiento

Cuando abres un movimiento vinculado, verás una sección **"Información de Transacción"** que muestra:

- Tipo de transacción (Venta o Compra) con enlace al registro
- Nombre del cliente/proveedor con enlace a su perfil
- Estado de pago con badge colorido
- Total de la venta/compra
- Nota informativa sobre la vinculación

#### En el Formulario de Edición

Los movimientos vinculados muestran un panel azul de **solo lectura** con:
- Tipo de transacción
- Cliente/Proveedor
- Estado de pago
- Mensaje: "Esta información no puede ser modificada porque está vinculada a un registro de venta/compra"

---

## Campos de la Base de Datos

### Campos Nuevos en `LedgerEntry`

```typescript
transactionType: String?  // "N/A", "COMPRA", "VENTA"
saleId: Int?              // ID de la venta vinculada
purchaseId: Int?          // ID de la compra vinculada
clientId: Int?            // ID del cliente (para ventas)
supplierId: Int?          // ID del proveedor (para compras)
paymentStatus: String?    // "PENDING", "PARTIAL", "PAID"
```

### Relaciones

```prisma
// LedgerEntry
sale       Sale?      @relation("SaleLedgerEntries")
purchase   Purchase?  @relation("PurchaseLedgerEntries")
client     Client?    @relation("ClientLedgerEntries")
supplier   Proveedor? @relation("ProveedorLedgerEntries")

// Sale
ledgerEntries LedgerEntry[] @relation("SaleLedgerEntries")

// Purchase
ledgerEntries LedgerEntry[] @relation("PurchaseLedgerEntries")
```

---

## Flujo de Datos

### Escenario A: Crear Venta desde Flujo de Dinero

```
Usuario ingresa datos en formulario
         ↓
POST /api/practice-management/ledger
         ↓
   transactionType === "VENTA"?
         ↓ Sí
   Generar número de venta (VTA-2026-001)
         ↓
   Crear registro en tabla Sale
         ↓
   Obtener sale.id
         ↓
   Crear registro en tabla LedgerEntry
   con saleId, clientId, paymentStatus
         ↓
   Retornar ledger entry creado
```

### Escenario B: Crear Venta desde módulo Ventas

```
Usuario crea venta en /dashboard/practice/ventas/new
         ↓
POST /api/practice-management/ventas
         ↓
   Crear registro en tabla Sale
         ↓
   Obtener sale.id
         ↓
   Generar ID interno de ledger (ING-2026-001)
         ↓
   Crear registro en tabla LedgerEntry
   con datos de la venta
         ↓
   Retornar venta creada
```

### Escenario C: Crear Compra desde Flujo de Dinero

```
Usuario ingresa datos en formulario
         ↓
POST /api/practice-management/ledger
         ↓
   transactionType === "COMPRA"?
         ↓ Sí
   Generar número de compra (CMP-2026-001)
         ↓
   Crear registro en tabla Purchase
         ↓
   Obtener purchase.id
         ↓
   Crear registro en tabla LedgerEntry
   con purchaseId, supplierId, paymentStatus
         ↓
   Retornar ledger entry creado
```

### Escenario D: Crear Compra desde módulo Compras

```
Usuario crea compra en /dashboard/practice/compras/new
         ↓
POST /api/practice-management/compras
         ↓
   Crear registro en tabla Purchase
         ↓
   Obtener purchase.id
         ↓
   Generar ID interno de ledger (EGR-2026-001)
         ↓
   Crear registro en tabla LedgerEntry
   con datos de la compra
         ↓
   Retornar compra creada
```

---

## Validaciones Implementadas

### Frontend (Flujo de Dinero - Nuevo Movimiento)

```typescript
// Si transactionType === 'VENTA'
if (!formData.clientId) {
  error: 'Debe seleccionar un cliente para ventas'
}
if (!formData.paymentStatus) {
  error: 'Debe seleccionar un estado de pago para ventas'
}

// Si transactionType === 'COMPRA'
if (!formData.supplierId) {
  error: 'Debe seleccionar un proveedor para compras'
}
if (!formData.paymentStatus) {
  error: 'Debe seleccionar un estado de pago para compras'
}
```

### Backend (API Ledger)

```typescript
// Validación para VENTA
if (txType === 'VENTA') {
  if (!clientId) {
    return 400: 'El cliente es requerido para ventas'
  }
  if (!paymentStatus || !['PENDING', 'PARTIAL', 'PAID'].includes(paymentStatus)) {
    return 400: 'Estado de pago requerido y debe ser PENDING, PARTIAL o PAID'
  }
}

// Validación para COMPRA
if (txType === 'COMPRA') {
  if (!supplierId) {
    return 400: 'El proveedor es requerido para compras'
  }
  if (!paymentStatus || !['PENDING', 'PARTIAL', 'PAID'].includes(paymentStatus)) {
    return 400: 'Estado de pago requerido y debe ser PENDING, PARTIAL, PAID'
  }
}
```

---

## Generación de IDs

### Números Internos de Ledger

Formato: `{TIPO}-{AÑO}-{NÚMERO}`

- Ingresos: `ING-2026-001`, `ING-2026-002`, ...
- Egresos: `EGR-2026-001`, `EGR-2026-002`, ...

```typescript
async function generateLedgerInternalId(doctorId: string, entryType: string) {
  const year = new Date().getFullYear();
  const prefix = entryType === 'ingreso' ? `ING-${year}-` : `EGR-${year}-`;

  const lastEntry = await prisma.ledgerEntry.findFirst({
    where: { doctorId, internalId: { startsWith: prefix } },
    orderBy: { internalId: 'desc' }
  });

  let nextNumber = lastEntry ? parseInt(lastEntry.internalId.split('-')[2]) + 1 : 1;
  return `${prefix}${nextNumber.toString().padStart(3, '0')}`;
}
```

### Números de Venta

Formato: `VTA-{AÑO}-{NÚMERO}`

- Ejemplo: `VTA-2026-001`, `VTA-2026-002`, ...

### Números de Compra

Formato: `CMP-{AÑO}-{NÚMERO}`

- Ejemplo: `CMP-2026-001`, `CMP-2026-002`, ...

---

## Archivos Modificados

### Backend

1. **`packages/database/prisma/schema.prisma`**
   - Añadidos campos a `LedgerEntry`: `transactionType`, `saleId`, `purchaseId`, `clientId`, `supplierId`, `paymentStatus`
   - Añadidas relaciones inversas en `Sale`, `Purchase`, `Client`, `Proveedor`

2. **`apps/api/src/app/api/practice-management/ledger/route.ts`**
   - GET: Incluye relaciones con `client`, `supplier`, `sale`, `purchase`
   - POST: Maneja 3 tipos de transacción (N/A, COMPRA, VENTA)
   - Funciones auxiliares: `generateSaleNumber()`, `generatePurchaseNumber()`

3. **`apps/api/src/app/api/practice-management/ventas/route.ts`**
   - POST: Auto-crea entrada de ledger después de crear venta
   - Función auxiliar: `generateLedgerInternalId()`

4. **`apps/api/src/app/api/practice-management/compras/route.ts`**
   - POST: Auto-crea entrada de ledger después de crear compra
   - Función auxiliar: `generateLedgerInternalId()`

### Frontend

5. **`apps/doctor/src/app/dashboard/practice/flujo-de-dinero/new/page.tsx`**
   - Añadidos dropdowns condicionales: Transaction Type, Cliente, Proveedor, Estado de Pago
   - Fetch de clientes y proveedores en useEffect
   - Validación de campos requeridos según tipo de transacción

6. **`apps/doctor/src/app/dashboard/practice/flujo-de-dinero/page.tsx`**
   - Añadidas 3 columnas nuevas en la tabla: Tipo Transacción, Cliente/Proveedor, Estado Pago
   - Badges coloridos para fácil identificación visual

7. **`apps/doctor/src/app/dashboard/practice/flujo-de-dinero/[id]/edit/page.tsx`**
   - Panel de solo lectura mostrando información de transacción vinculada
   - Mensaje informativo sobre restricción de edición

8. **`apps/doctor/src/app/dashboard/practice/flujo-de-dinero/[id]/page.tsx`**
   - Sección "Información de Transacción" con detalles completos
   - Enlaces a registros de venta/compra y perfiles de cliente/proveedor

---

## Estados de Pago

Los 3 estados disponibles son:

| Estado | Valor DB | Descripción | Color Badge |
|--------|----------|-------------|-------------|
| **Pendiente** | `PENDING` | Sin pagos realizados | 🟠 Naranja |
| **Parcial** | `PARTIAL` | Pago parcial realizado | 🟡 Amarillo |
| **Pagado** | `PAID` | Totalmente pagado | 🟢 Verde |

---

## Consideraciones Importantes

### 🔒 Integridad de Datos

- Los campos vinculados (`saleId`, `purchaseId`, `clientId`, `supplierId`, `paymentStatus`) **NO pueden ser editados** después de la creación
- Para modificar el estado de pago o detalles, debes hacerlo desde el módulo de Ventas o Compras correspondiente
- Si eliminas un movimiento de Flujo de Dinero vinculado, la venta/compra **permanece** (relación `onDelete: SetNull`)

### 💡 Casos de Uso Recomendados

**Usa transactionType "VENTA" cuando**:
- Necesitas registrar un ingreso que corresponde a una venta
- Quieres que se cree automáticamente el registro de venta
- El ingreso está directamente relacionado con un cliente

**Usa transactionType "COMPRA" cuando**:
- Necesitas registrar un egreso que corresponde a una compra
- Quieres que se cree automáticamente el registro de compra
- El egreso está directamente relacionado con un proveedor

**Usa transactionType "N/A" cuando**:
- El movimiento no corresponde a una venta o compra
- Ejemplos: pago de nómina, servicios, renta, gastos generales

### 📊 Impacto en Reportes

- El balance de Flujo de Dinero incluye **todos los movimientos** (independientes y vinculados)
- Los reportes de Ventas solo incluyen ventas creadas (manual o automáticamente)
- Los reportes de Compras solo incluyen compras creadas (manual o automáticamente)
- Esto garantiza coherencia entre módulos

### 🔄 Sincronización

La sincronización es **unidireccional en el momento de creación**:
- Crear movimiento con VENTA → crea venta
- Crear venta → crea movimiento
- ⚠️ Editar la venta después NO actualiza el movimiento (deben editarse por separado si es necesario)

---

## Cálculos Automáticos

### Cuando se crea Venta/Compra desde Ledger

Asumiendo IVA del 16%:

```typescript
// Entrada: amount = 1000 (monto total con IVA)

subtotal = amount / 1.16 = 862.07
tax = amount - subtotal = 137.93
total = amount = 1000

// Se crea un item de servicio genérico
item = {
  itemType: 'service',
  description: concept,
  quantity: 1,
  unit: 'servicio',
  unitPrice: subtotal,
  taxRate: 0.16,
  taxAmount: tax,
  subtotal: subtotal
}
```

---

## Navegación entre Módulos

### Desde Flujo de Dinero

- **Lista**: Click en Cliente/Proveedor → Perfil del cliente/proveedor
- **Detalle**: Click "Ver venta VTA-XXX" → Detalle de la venta
- **Detalle**: Click "Ver compra CMP-XXX" → Detalle de la compra
- **Detalle**: Click "Ver perfil del cliente" → Perfil del cliente
- **Detalle**: Click "Ver perfil del proveedor" → Perfil del proveedor

### Desde Ventas

- **Lista/Detalle**: Los movimientos vinculados se pueden ver en Flujo de Dinero
- Futura mejora: Añadir enlace directo desde venta al movimiento de ledger

### Desde Compras

- **Lista/Detalle**: Los movimientos vinculados se pueden ver en Flujo de Dinero
- Futura mejora: Añadir enlace directo desde compra al movimiento de ledger

---

## Migraciones de Base de Datos

### Estado Actual

La base de datos fue actualizada usando `pnpm prisma db push` durante el desarrollo.

### Antes de Producción

**IMPORTANTE**: Debes crear archivos de migración antes de desplegar a producción.

Ver guía completa en: [`DATABASE_MIGRATION_GUIDE.md`](./DATABASE_MIGRATION_GUIDE.md)

```bash
cd packages/database
pnpm prisma migrate dev --name add_ledger_sales_purchases_integration
git add prisma/migrations/
git commit -m "Add ledger-sales-purchases integration migration"
```

---

## Soporte y Mantenimiento

### Logs y Debugging

Los endpoints de API incluyen logging detallado:

```typescript
console.error('Error al crear venta:', error);
console.error('Error details:', JSON.stringify(error, null, 2));
```

### Mensajes de Error Comunes

| Error | Causa | Solución |
|-------|-------|----------|
| "El cliente es requerido para ventas" | No se seleccionó cliente en VENTA | Seleccionar un cliente antes de enviar |
| "El proveedor es requerido para compras" | No se seleccionó proveedor en COMPRA | Seleccionar un proveedor antes de enviar |
| "El ID interno ya existe" | Conflicto en generación de ID | Reintentar (se genera nuevo ID automáticamente) |
| "Cliente no encontrado" | Cliente pertenece a otro doctor | Verificar permisos y ownership |

---

## Historial de Cambios

### v1.0.0 (2026-01-07)

- ✅ Implementación inicial de integración bidireccional
- ✅ Soporte para 3 tipos de transacción (N/A, COMPRA, VENTA)
- ✅ Auto-creación de ventas desde ledger
- ✅ Auto-creación de compras desde ledger
- ✅ Auto-creación de ledger entries desde ventas
- ✅ Auto-creación de ledger entries desde compras
- ✅ UI actualizada con nuevas columnas y campos
- ✅ Validaciones frontend y backend
- ✅ Navegación entre módulos con enlaces
- ✅ Documentación completa

---

## Próximas Mejoras (Roadmap)

### Fase 1.1 - Enlaces Bidireccionales UI
- [ ] Añadir enlace en venta/compra hacia movimiento de ledger
- [ ] Mostrar badge "Vinculado con ING-2026-001" en detalle de venta/compra

### Fase 1.2 - Sincronización Dinámica
- [ ] Actualizar ledger entry cuando se modifica estado de pago en venta/compra
- [ ] Webhook/trigger para mantener sincronización

### Fase 1.3 - Reportes Avanzados
- [ ] Reporte de reconciliación entre ledger y ventas/compras
- [ ] Dashboard con métricas de ventas vs. ledger
- [ ] Alertas de discrepancias

### Fase 2 - Auditoría
- [ ] Log de cambios en registros vinculados
- [ ] Historial de modificaciones
- [ ] Rastreo de quién creó/modificó qué

---

## Contacto y Soporte

Para preguntas o reportar bugs relacionados con esta funcionalidad:

- **GitHub Issues**: [Reportar un problema](https://github.com/your-repo/issues)
- **Documentación Técnica**: Ver código en `/apps/api/src/app/api/practice-management/`
- **Guía de Migración**: [`DATABASE_MIGRATION_GUIDE.md`](./DATABASE_MIGRATION_GUIDE.md)
