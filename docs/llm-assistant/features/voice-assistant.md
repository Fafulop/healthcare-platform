# Asistente IA / Asistente de Voz (Hub de Creación)

**También conocido como:** Asistente de Voz, Chat IA, dictado por voz, asistente de dictado.

## Descripción

El **Asistente IA** (antes llamado Asistente de Voz) es un hub flotante disponible en todas las páginas de la aplicación (dashboard y citas). Se accede con el botón flotante con ícono ✨ (Sparkles) en la esquina inferior derecha.

Al abrirlo, muestra el modal **"Asistente IA"** con acciones rápidas de creación usando **Chat IA** o **dictado por voz**. Cada acción usa uno de dos modos: **Chat IA** o **Voz Clásica**.

---

## Modos de Creación

### Chat IA (modo principal — 6 de 7 acciones)

Navega al formulario correspondiente con un panel lateral de chat abierto. El médico puede:
- **Escribir** en el chat para describir el registro
- **Usar el botón de micrófono** dentro del chat para dictar (transcripción directa al campo de texto, sin modal separado)

La IA extrae los datos del mensaje y llena los campos del formulario en tiempo real.

**Algunos módulos soportan creación en lote (batch):** al describir múltiples registros en el mismo mensaje, el chat acumula los items en una lista visible y muestra un botón **"Crear N [items]"** para crearlos todos de una vez.

### Voz Clásica (solo Crear Citas)

Flujo de grabación de audio completo con modal de grabación separado:
1. Se abre un modal de grabación dedicado
2. El médico dicta los horarios
3. El sistema transcribe y extrae datos estructurados
4. Se abre panel lateral para revisar y corregir mediante chat
5. Al confirmar, navega a `/appointments?voice=true` y llena el formulario automáticamente

---

## Acciones del Hub

| Acción | Modo | Batch | Destino |
|--------|------|-------|---------|
| Crear Paciente | Chat IA | No | `/dashboard/medical-records/patients/new?chat=true` |
| Crear Citas | Voz Clásica | Sí — múltiples slots | Modal de grabación → `/appointments?voice=true` |
| Nuevo Pendiente | Chat IA | **Sí — múltiples pendientes** | `/dashboard/pendientes/new?chat=true` |
| Movimiento de Efectivo | Chat IA | **Sí — múltiples movimientos** | `/dashboard/practice/flujo-de-dinero/new?chat=true` |
| Nueva Venta | Chat IA | No | `/dashboard/practice/ventas/new?chat=true` |
| Nueva Cotización | Chat IA | No | `/dashboard/practice/cotizaciones/new?chat=true` |
| Nueva Compra | Chat IA | No | `/dashboard/practice/compras/new?chat=true` |

Las acciones con **Chat IA** muestran el ícono ✨ junto al título dentro del modal.

---

## Flujo Chat IA — Paso a Paso

1. Click en el botón flotante ✨ (esquina inferior derecha)
2. Seleccionar la acción deseada
3. El modal se cierra y la app navega al formulario con `?chat=true`
4. Se abre automáticamente el **panel Chat IA** (lateral en desktop, bottom sheet en móvil)
5. Escribir o dictar la información
6. La IA llena los campos del formulario en tiempo real
7. Revisar campos llenados — el panel puede minimizarse con el botón **"—"**
8. Click en **"Confirmar"** (o **"Crear N [items]"** en batch) en el panel
9. Verificar datos y guardar el formulario

### Creación en Lote (Batch) — Pendientes y Movimientos

Al describir múltiples items en un mensaje:
- El chat muestra una lista de los items acumulados debajo de los mensajes
- Cada item puede eliminarse individualmente con el botón de borrar
- Aparece el botón **"Crear N Pendientes"** / **"Crear N Movimientos"**
- Al hacer click, todos los registros se crean de una vez

**Ejemplo — Movimientos en lote:**
> "Registra 3 movimientos: consulta 3000 pesos efectivo, laboratorio 1500 transferencia, limpieza 800 efectivo"

**Ejemplo — Pendientes en lote:**
> "Crea 3 tareas: seguimiento López mañana a las 10, revisar radiografía el viernes, llamar farmacia el lunes"

---

## Flujo Voz Clásica (Crear Citas) — Paso a Paso

1. Click en el botón flotante ✨
2. Seleccionar **"Crear Citas"**
3. Se abre el **modal de grabación** (único caso con modal separado)
4. El navegador puede pedir permiso de micrófono — **Permitir el acceso**
5. Dictar los horarios de forma natural
6. Click en **"Detener"** para finalizar
7. El sistema transcribe y extrae los slots (soporta múltiples slots en un dictado)
8. Se abre el **panel lateral** con los datos extraídos
9. Ajustar mediante chat si algo no quedó bien
10. Click en **"Confirmar"** → el formulario de citas se llena automáticamente

**Ejemplo:**
> "Abrir citas para el lunes 20 de enero: 9 de la mañana, 10, 11 y 12. Todas de 30 minutos a 500 pesos."

---

## Consultas y Recetas

Las consultas y recetas **no están en el hub**. Tienen sus propios paneles Chat IA embebidos directamente en sus formularios de creación (`EncounterChatPanel`, `PrescriptionChatPanel`), accesibles con el botón **"Chat IA"** dentro de cada página.

---

## Banner de IA

Cuando el formulario se llena por Chat IA o Voz, aparece un **banner azul** indicando que los datos fueron generados por IA y cuántos campos se llenaron.

**Importante:** Siempre verifica los datos antes de guardar.

---

## Consejos para Mejor Precisión

- Incluye toda la información relevante en un solo mensaje
- Especifica unidades: "500mg", "$500 pesos", "30 minutos"
- Para batch, separa los items claramente en el mensaje
- Si un campo quedó mal, escríbelo en el chat para corregirlo: "El monto es 1500, no 500"
- Los números y fechas son los más propensos a errores — siempre verifica

---

## Solución de Problemas

### "El panel de chat no se abre"
- Verifica que la URL tenga `?chat=true`
- Recarga la página

### "Los datos extraídos están incorrectos"
- Escribe en el chat para corregir campos específicos
- Usa el botón **"Limpiar"** del panel para empezar de nuevo

### "No se escucha mi voz" (solo Voz Clásica — Citas)
- Verifica que el micrófono tenga permiso en el navegador
- Habla más cerca del micrófono

### "Error al procesar"
- Puede ser problema de conexión — intenta de nuevo
- Si persiste, ingresa los datos manualmente
