# Áreas y Subáreas

## Qué es

Las Áreas y Subáreas son las categorías que organizan los movimientos financieros en el módulo de Flujo de Dinero. Cada movimiento se asigna a un Área (categoría principal) y opcionalmente a una Subárea (subcategoría). Esto permite el Estado de Resultados agrupado.

## Acceso

**Ruta:** Desde Flujo de Dinero > botón "Áreas"
**URL:** `/dashboard/practice/areas`

---

## Estructura

```
Área (INGRESO o EGRESO)
└── Subárea 1
└── Subárea 2
└── Subárea 3
```

Cada área pertenece a uno de dos tipos:
- **INGRESO:** Para categorizar entradas de dinero
- **EGRESO:** Para categorizar salidas de dinero

---

## Ver Áreas

La página muestra dos secciones separadas:

**Sección INGRESOS (cabecera azul):** Todas las áreas de tipo INGRESO con sus subáreas.

**Sección EGRESOS (cabecera roja):** Todas las áreas de tipo EGRESO con sus subáreas.

Cada área muestra:
- Nombre del área
- Descripción (si tiene)
- Número de subáreas
- Botón para expandir/colapsar subáreas

---

## Crear Nueva Área

**Botón:** "Nueva Área de Ingresos" (azul) o "Nueva Área de Egresos" (rojo)

### Campos del Formulario

| Campo | Requerido | Descripción |
|-------|-----------|-------------|
| Nombre del Área | Sí | Ej: "Consultas Médicas", "Gastos de Personal" |
| Descripción | No | Descripción de la categoría |
| Tipo | Fijo | Se define al abrir el modal — INGRESO o EGRESO |

> **IMPORTANTE:** El tipo (INGRESO/EGRESO) se define cuando creas el área y **no se puede cambiar** después. Si necesitas cambiar el tipo, debes eliminar el área y crear una nueva.

### Paso a Paso

1. Ir a **Áreas** (desde el botón en Flujo de Dinero)
2. Clic en **"Nueva Área de Ingresos"** o **"Nueva Área de Egresos"** según el tipo
3. Ingresar el nombre del área (obligatorio)
4. Agregar descripción (opcional)
5. Clic en **"Guardar"**

---

## Editar Área

1. En la lista, clic en el ícono de lápiz (editar) del área
2. Modificar nombre o descripción
3. Clic en **"Guardar"**

> El tipo (INGRESO/EGRESO) **no es editable** — se muestra como badge informativo.

---

## Eliminar Área

1. Clic en el ícono de papelera del área
2. Confirmación: *"¿Estás seguro de eliminar 'Nombre'? Esto también eliminará todas las subáreas."*
3. Al confirmar: el área y **todas sus subáreas** se eliminan permanentemente

**Precaución:** Si hay movimientos en el flujo de dinero asignados a esta área, pueden quedar sin categoría.

---

## Crear Subárea

Las subáreas se crean dentro de un área existente.

1. En el área deseada, clic en el ícono **+** (agregar subárea)
2. Ingresar el nombre de la subárea (obligatorio)
3. Agregar descripción (opcional)
4. Clic en **"Guardar"**

La subárea hereda automáticamente el tipo (INGRESO/EGRESO) del área padre.

---

## Editar Subárea

1. Expandir el área que contiene la subárea (clic en la flecha)
2. Clic en el ícono de lápiz de la subárea
3. Modificar nombre o descripción
4. Clic en **"Guardar"**

---

## Eliminar Subárea

1. Expandir el área padre
2. Clic en el ícono de papelera de la subárea
3. Confirmación: *"¿Estás seguro de eliminar 'Nombre'?"*
4. La subárea se elimina permanentemente

---

## Uso en Flujo de Dinero

Cuando creas o editas un movimiento en Flujo de Dinero:
- Seleccionas el **Área** del movimiento (dropdown de áreas del tipo correspondiente)
- Opcionalmente seleccionas la **Subárea**

En el Estado de Resultados, los movimientos aparecen agrupados por área y subárea.

---

## Restricciones del Sistema

| Acción | Estado |
|--------|--------|
| Cambiar tipo de área (INGRESO ↔ EGRESO) | ❌ No es posible — eliminar y recrear |
| Mover subárea a diferente área padre | ❌ No disponible |
| Crear subárea sin área padre | ❌ Las subáreas siempre pertenecen a un área |
| Orden personalizado de áreas | ❌ Sin reordenamiento manual |

---

## Preguntas Frecuentes

**¿Puedo tener el mismo nombre en dos áreas distintas?**
Sí, pero no se recomienda por confusión visual.

**¿Si elimino un área, qué pasa con los movimientos asignados a ella?**
Los movimientos pueden quedar sin área asignada. Deberás reasignarlos manualmente.

**¿El tipo de área afecta cómo se calcula el balance?**
Sí. Las áreas INGRESO suman al balance; las áreas EGRESO restan. El tipo determina en qué sección del Estado de Resultados aparece.

**¿Cuántas subáreas puedo crear por área?**
No hay límite.

**¿Puedo usar un área sin subáreas?**
Sí, las subáreas son opcionales. Un movimiento puede asignarse solo al área sin especificar subárea.
