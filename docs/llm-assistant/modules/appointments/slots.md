# Espacios de Cita (Slots)

## Propósito

Permite al médico configurar los horarios disponibles para que los pacientes puedan agendar citas.

## Acceso

**Ruta:** Menú lateral > Citas

**URL:** `/appointments`

---

## Funcionalidades

### 1. Ver Espacios de Cita

**Vistas disponibles:**

#### Vista de Calendario
- Muestra espacios en formato de calendario mensual o semanal
- Colores diferentes para espacios disponibles, reservados y bloqueados
- Click en un espacio para ver detalles

#### Vista de Lista
- Lista todos los espacios ordenados por fecha
- Muestra información resumida
- Acciones rápidas disponibles

---

### 2. Crear Espacio de Cita

#### Campos del Formulario

| Campo | Requerido | Descripción |
|-------|-----------|-------------|
| Fecha | **Sí** | Fecha del espacio de cita |
| Hora de Inicio | **Sí** | Hora en que comienza |
| Duración | **Sí** | En minutos (30, 45, 60, etc.) |
| Precio | No | Costo de la consulta en MXN |
| Descuento | No | Porcentaje de descuento |
| Acepta Reservaciones | **Sí** | Si los pacientes pueden agendar |
| Notas | No | Información adicional |

#### Paso a Paso: Crear Espacio Manualmente

1. Ir a **Citas** en el menú lateral
2. Click en **"Nuevo Espacio"** o en un horario vacío del calendario
3. Seleccionar fecha y hora
4. Definir duración del espacio
5. Establecer precio (opcional)
6. Activar/desactivar reservaciones online
7. Click en **"Crear Espacio"**

#### Paso a Paso: Crear Espacios con Asistente de Voz

1. Ir a **Citas**
2. Click en el botón **"Asistente de Voz"**
3. Dictar los espacios que quieres crear
   - Ejemplo: "Crear espacios para el lunes 20 de enero a las 9, 10 y 11 de la mañana, duración 30 minutos, precio 500 pesos"
4. El sistema extrae la información y crea múltiples espacios
5. Revisar los espacios propuestos
6. Confirmar la creación

---

### 3. Crear Espacios Recurrentes

Permite crear el mismo espacio para varios días de la semana.

#### Paso a Paso

1. Al crear un espacio, activar opción **"Repetir semanalmente"**
2. Seleccionar los días de la semana
3. Definir hasta qué fecha se repite
4. El sistema crea todos los espacios automáticamente

---

### 4. Bloquear Horario

Marca un espacio como no disponible sin eliminarlo.

#### Paso a Paso

1. Localizar el espacio en el calendario o lista
2. Click en **"Bloquear"**
3. El espacio aparece como bloqueado
4. Los pacientes no pueden agendar en horarios bloqueados

---

### 5. Editar Espacio

**Solo se pueden editar espacios sin reservación**

#### Paso a Paso

1. Click en el espacio a editar
2. Modificar los campos necesarios
3. Click en **"Guardar Cambios"**

---

### 6. Eliminar Espacio

**Solo se pueden eliminar espacios sin reservación**

#### Paso a Paso

1. Click en el espacio a eliminar
2. Click en **"Eliminar"**
3. Confirmar la eliminación

---

## Estados de un Espacio

| Estado | Color | Descripción |
|--------|-------|-------------|
| Disponible | Verde | Abierto para reservaciones |
| Reservado | Azul | Un paciente ha agendado |
| Bloqueado | Gris | No disponible |
| Pasado | Gris claro | Fecha ya transcurrida |

---

## Ejemplos de Dictado por Voz

### Crear múltiples espacios:
> "Crear citas para el martes 21 de enero: 9 de la mañana, 10 de la mañana, 11 de la mañana y 4 de la tarde. Duración de 45 minutos cada una, precio 600 pesos"

### Crear espacios para varios días:
> "Agregar disponibilidad para esta semana, lunes a viernes de 9 a 12, citas de media hora a 500 pesos"

### Especificar detalles:
> "Quiero abrir un espacio el jueves 23 a las 3 de la tarde, una hora de duración, precio 800 pesos con descuento del 10 por ciento"

---

## Lo que el Usuario NO PUEDE Hacer

- **Editar espacios reservados** - Primero debe cancelar la reservación
- **Eliminar espacios reservados** - Primero debe cancelar la reservación
- **Crear espacios en fechas pasadas** - Solo fechas futuras
- **Duplicar espacios** - Debe crear cada uno individualmente o usar voz
- **Importar horarios** - No hay importación desde Excel/CSV

---

## Preguntas Frecuentes

### ¿Cuántos espacios puedo crear a la vez con voz?
No hay límite. Puedes dictar todos los espacios que necesites y el sistema los creará.

### ¿Qué pasa si creo un espacio que ya existe?
El sistema validará y te avisará si hay conflicto de horarios.

### ¿Los pacientes ven el precio?
Sí, los pacientes ven el precio (con descuento si aplica) al agendar.

### ¿Puedo tener diferentes precios por día?
Sí, cada espacio tiene su propio precio independiente.

### ¿Cómo sé si un paciente agendó?
Los espacios reservados cambian de color y muestran los datos del paciente.
