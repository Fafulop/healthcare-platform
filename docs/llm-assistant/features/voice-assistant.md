# Asistente de Voz

## Descripción

El **Asistente de Voz** es una funcionalidad que permite al médico dictar información en lugar de escribirla manualmente. La aplicación transcribe el audio y usa inteligencia artificial para extraer datos estructurados del dictado.

---

## Módulos que Soportan Asistente de Voz

| Módulo | Función | Descripción |
|--------|---------|-------------|
| Pacientes | Crear paciente | Dictar datos del nuevo paciente |
| Consultas | Nueva consulta | Dictar notas clínicas |
| Recetas | Nueva receta | Dictar medicamentos y dosis |
| Citas | Crear espacios | Dictar horarios disponibles |
| Flujo de Dinero | Nuevo movimiento | Dictar ingresos/egresos (múltiples) |
| Ventas | Nueva venta | Dictar transacción de venta |
| Compras | Nueva compra | Dictar transacción de compra |

---

## Cómo Funciona

### Flujo General

```
1. Click en botón "Asistente de Voz" (ícono de micrófono)
          ↓
2. Se abre el modal de grabación
          ↓
3. Dictar la información de forma natural
          ↓
4. Click en "Detener" para finalizar grabación
          ↓
5. El sistema transcribe el audio
          ↓
6. La IA extrae datos estructurados
          ↓
7. Se abre panel lateral para revisar
          ↓
8. Ajustar mediante chat si es necesario
          ↓
9. Click en "Confirmar" para llenar formulario
          ↓
10. Verificar datos y guardar
```

---

## Paso a Paso Detallado

### 1. Iniciar Grabación

1. En la página correspondiente (ej: Nuevo Paciente), busca el botón **"Asistente de Voz"** con ícono de micrófono
2. Click en el botón
3. Se abre el modal de grabación
4. El navegador puede pedir permiso para usar el micrófono - **Permite el acceso**

### 2. Dictar Información

1. Cuando veas que está grabando (indicador visual), comienza a hablar
2. Habla de forma clara y natural
3. No es necesario usar comandos especiales
4. Puedes dictar la información en cualquier orden

### 3. Finalizar Grabación

1. Cuando termines de dictar, click en **"Detener"**
2. Espera mientras el sistema procesa:
   - Transcripción del audio
   - Extracción de datos por IA

### 4. Revisar Datos Extraídos

1. Se abre el **panel lateral** de chat
2. Verás:
   - Tu transcripción original
   - Los datos extraídos por la IA
   - Indicador de campos completados vs vacíos

### 5. Ajustar si es Necesario

Si la IA no extrajo algo correctamente:
1. Escribe en el chat para corregir
   - Ejemplo: "El apellido es García, no Garcías"
   - Ejemplo: "La dosis es 500mg, no 50mg"
2. La IA actualizará los datos
3. Repite hasta que estén correctos

### 6. Confirmar y Llenar Formulario

1. Cuando los datos estén correctos, click en **"Confirmar"**
2. El panel lateral se cierra
3. El formulario se llena automáticamente con los datos extraídos
4. Aparece un banner indicando que fue llenado por IA

### 7. Verificar y Guardar

1. Revisa todos los campos del formulario
2. Completa cualquier campo faltante
3. Corrige si es necesario
4. Click en el botón de guardar

---

## Consejos para Mejor Precisión

### Habla Clara y Pausada
- Pronuncia claramente, especialmente nombres y números
- Haz pausas breves entre datos diferentes

### Sé Específico
- Incluye unidades: "quinientos miligramos" en vez de solo "quinientos"
- Especifica fechas completas: "veinte de enero de dos mil veintiséis"

### Usa Contexto Natural
- "El paciente se llama Juan Pérez García, tiene 45 años, nació el 15 de marzo de 1980"
- "Receta: Paracetamol 500mg cada 8 horas por 5 días, Omeprazol 20mg una vez al día en ayunas"

### Verifica Números
- Los números son propensos a errores de transcripción
- Siempre verifica cantidades, dosis, fechas y precios

---

## Ejemplos de Dictado

### Nuevo Paciente
> "Nuevo paciente, se llama María López Hernández, tiene 35 años, fecha de nacimiento 10 de junio de 1990, sexo femenino, tipo de sangre O positivo. Su teléfono es 55 1234 5678, correo maria.lopez@email.com. Dirección Calle Reforma 123, Colonia Centro, Ciudad de México, código postal 06000. Contacto de emergencia su esposo Pedro Ramírez, teléfono 55 8765 4321. Es alérgica a la penicilina, tiene hipertensión controlada, toma Losartán 50mg diario."

### Nueva Consulta
> "Consulta de seguimiento, el paciente refiere que el dolor de rodilla ha disminuido un 70%, todavía presenta molestia al subir escaleras. Signos vitales: presión arterial 120 sobre 80, frecuencia cardíaca 72, temperatura 36.5, peso 75 kilos. Al examen físico, rodilla derecha con rango de movimiento mejorado, sin edema, ligera crepitación. Diagnóstico: osteoartritis de rodilla en mejoría. Plan: continuar fisioterapia 2 veces por semana, mantener analgésico solo si hay dolor, control en 4 semanas."

### Nueva Receta
> "Receta para el señor García. Metformina 850 miligramos, una tableta después del desayuno y una después de la cena, por tiempo indefinido. Losartán 50 miligramos, una tableta en la mañana, uso continuo. Atorvastatina 20 miligramos, una tableta por la noche antes de dormir."

### Espacios de Cita
> "Abrir citas para la próxima semana. Lunes 20 de enero, 9 de la mañana, 10, 11 y 12. Martes 21, mismo horario. Todas de 30 minutos a 500 pesos."

### Movimientos de Flujo de Dinero
> "Registrar los movimientos de hoy. Ingreso de 2500 pesos por consulta particular, área consultas médicas. Ingreso de 3000 pesos por procedimiento, área procedimientos. Egreso de 500 pesos por material de curación, área insumos médicos. Egreso de 1200 pesos por renta, área gastos fijos."

---

## Creación en Lote (Batch)

Algunos módulos permiten crear **múltiples registros** de una sola dictada:

| Módulo | Batch Disponible |
|--------|------------------|
| Citas (Espacios) | Sí - múltiples horarios |
| Flujo de Dinero | Sí - múltiples movimientos |
| Recetas (Medicamentos) | Sí - múltiples medicamentos |

### Ejemplo de Batch
Al dictar:
> "Crear citas para el lunes: 9am, 10am, 11am, 12pm"

El sistema creará **4 espacios de cita** independientes.

---

## Indicador de Confianza

Después de la extracción, verás:
- **Alta confianza:** Muchos campos extraídos correctamente
- **Media confianza:** Algunos campos extraídos
- **Baja confianza:** Pocos campos extraídos

Esto te indica cuánta revisión manual puede necesitar.

---

## Banner de IA

Cuando el formulario se llena por voz, aparece un **banner azul** indicando:
- Que los datos fueron generados por IA
- Cuántos campos se llenaron
- Cuántos campos quedaron vacíos

**Importante:** Siempre verifica los datos antes de guardar.

---

## Limitaciones

- **Requiere internet:** El procesamiento se hace en la nube
- **Solo español:** Optimizado para español mexicano
- **Puede tener errores:** Especialmente con nombres propios, números y tecnicismos
- **No entiende contexto complejo:** Mantén las instrucciones simples
- **Un dictado a la vez:** No puedes grabar mientras se procesa otro

---

## Solución de Problemas

### "No se escucha mi voz"
- Verifica que el micrófono esté conectado
- Asegúrate de haber dado permiso al navegador
- Habla más cerca del micrófono

### "Los datos extraídos están incorrectos"
- Usa el chat para corregir
- Intenta ser más específico en el dictado
- Verifica manualmente antes de guardar

### "El botón de voz no aparece"
- No todos los formularios tienen asistente de voz
- Verifica que estés en una página que lo soporte

### "Error al procesar"
- Puede ser problema de conexión
- Intenta de nuevo
- Si persiste, ingresa los datos manualmente
