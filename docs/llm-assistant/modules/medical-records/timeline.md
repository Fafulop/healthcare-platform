# Línea de Tiempo del Paciente

## Propósito

Muestra una vista cronológica de todas las interacciones y eventos del paciente, facilitando el seguimiento de su historial.

## Acceso

**Ruta:** Perfil del Paciente > Línea de Tiempo

**URL:** `/dashboard/medical-records/patients/[id]/timeline`

---

## Funcionalidades

### 1. Ver Línea de Tiempo

**Vista cronológica que muestra:**
- Consultas médicas
- Recetas emitidas
- Archivos subidos
- Otros eventos relevantes

**Información por evento:**
- Fecha y hora
- Tipo de evento (ícono distintivo)
- Resumen del evento
- Link al detalle

---

### 2. Navegar la Línea de Tiempo

**Ordenamiento:** Los eventos más recientes aparecen primero

**Interacción:**
- Scroll para ver eventos anteriores
- Click en cualquier evento para ver detalle completo

---

## Tipos de Eventos en la Línea de Tiempo

| Tipo | Descripción | Ícono |
|------|-------------|-------|
| Consulta | Visita médica documentada | Portapapeles |
| Receta | Prescripción emitida | Documento |
| Archivo | Imagen o documento subido | Imagen/Archivo |
| Registro | Creación del expediente | Usuario |

---

## Ejemplo de Línea de Tiempo

```
15 Ene 2026 - Consulta de Seguimiento
"Control de diabetes. Niveles de glucosa estables."

10 Ene 2026 - Receta Emitida
"3 medicamentos: Metformina, Losartán, Aspirina"

05 Ene 2026 - Archivo Subido
"resultado-laboratorio.pdf"

01 Ene 2026 - Consulta
"Primera consulta. Diagnóstico: Diabetes tipo 2"

28 Dic 2025 - Paciente Registrado
"Expediente creado"
```

---

## Lo que el Usuario PUEDE Hacer

- Ver historial completo del paciente en orden cronológico
- Navegar a cualquier evento desde la línea de tiempo
- Identificar rápidamente el tipo de cada evento

## Lo que el Usuario NO PUEDE Hacer

- **Filtrar por tipo de evento** - Se muestran todos los eventos
- **Filtrar por rango de fechas** - Se muestra el historial completo
- **Exportar línea de tiempo** - No hay función de exportación
- **Agregar notas a la línea de tiempo** - Los eventos se generan automáticamente
- **Eliminar eventos** - Los eventos son permanentes

---

## Preguntas Frecuentes

### ¿Los eventos se agregan automáticamente?
Sí, cada vez que creas una consulta, receta o subes un archivo, se agrega automáticamente a la línea de tiempo.

### ¿Puedo agregar eventos manualmente?
No, la línea de tiempo solo muestra eventos del sistema (consultas, recetas, archivos).

### ¿La línea de tiempo muestra quién hizo cada acción?
Actualmente muestra el evento pero no detalla el usuario que lo creó (asumiendo que es el médico dueño del expediente).

### ¿Puedo ver la línea de tiempo de varios pacientes a la vez?
No, la línea de tiempo es individual por paciente.
