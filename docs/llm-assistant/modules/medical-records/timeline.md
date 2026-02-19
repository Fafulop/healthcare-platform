# Línea de Tiempo del Paciente

## Qué es

La Línea de Tiempo es una vista cronológica de todas las interacciones registradas del paciente — consultas, recetas y archivos multimedia — ordenadas de la más reciente a la más antigua. Es una forma rápida de ver la historia clínica completa del paciente.

## Acceso

**Ruta:** Perfil del Paciente > pestaña "Línea de Tiempo"
**URL:** `/dashboard/medical-records/patients/[id]/timeline`

---

## Tipos de Eventos

| Tipo | Ícono | Qué muestra |
|------|-------|-------------|
| Consulta | Portapapeles | Tipo de consulta y resumen/diagnóstico |
| Receta | Documento | Número de medicamentos prescritos |
| Archivo subido | Imagen/Archivo | Nombre del archivo multimedia |
| Registro | Usuario | Creación del expediente del paciente |

---

## Información por Evento

Cada evento en la línea de tiempo muestra:
- **Fecha y hora** del evento
- **Tipo de evento** (ícono diferenciador)
- **Resumen** del evento
- **Enlace** para ver el detalle completo

---

## Cómo Navegar

- Los eventos más recientes aparecen **primero** (orden descendente)
- Scroll hacia abajo para ver eventos más antiguos
- Clic en cualquier evento para ver su detalle completo

---

## Ejemplo de Línea de Tiempo

```
15 Ene 2026 — Consulta de Seguimiento
"Control de diabetes. Niveles de glucosa estables."

10 Ene 2026 — Receta Emitida
"3 medicamentos: Metformina, Losartán, Aspirina"

05 Ene 2026 — Archivo Subido
"resultado-laboratorio.pdf"

01 Ene 2026 — Consulta
"Primera consulta. Diagnóstico: Diabetes tipo 2"

28 Dic 2025 — Paciente Registrado
"Expediente creado"
```

---

## Restricciones

| Acción | Estado |
|--------|--------|
| Filtrar por tipo de evento | ❌ Se muestran todos los eventos |
| Filtrar por rango de fechas | ❌ Se muestra el historial completo |
| Exportar línea de tiempo | ❌ Sin función de exportación |
| Agregar eventos manualmente | ❌ Los eventos se generan automáticamente |
| Eliminar eventos | ❌ Los eventos son permanentes |
| Ver línea de tiempo de múltiples pacientes | ❌ Solo una a la vez |

---

## Preguntas Frecuentes

**¿Los eventos se agregan automáticamente?**
Sí. Cada vez que creas una consulta, emites una receta o subes un archivo, se agrega automáticamente un evento a la línea de tiempo.

**¿Puedo agregar eventos manualmente a la línea de tiempo?**
No. La línea de tiempo solo muestra eventos generados por el sistema.

**¿La línea de tiempo muestra quién realizó cada acción?**
Actualmente muestra el evento pero no el usuario específico (asume que es el médico dueño del expediente).

**¿Puedo filtrar solo las consultas?**
No. La línea de tiempo muestra todos los tipos de eventos sin opción de filtrar por tipo.
