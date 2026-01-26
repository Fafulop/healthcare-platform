# Portal Médico - Guía de Usuario para Asistente LLM

## Descripción General

El **Portal Médico** es una plataforma integral diseñada para médicos que permite gestionar:
- Expedientes médicos de pacientes
- Citas y agenda
- Operaciones financieras del consultorio (ventas, compras, flujo de dinero)
- Blog personal del médico

Esta documentación sirve como base de conocimiento para que un asistente LLM pueda guiar a los usuarios sobre las funcionalidades disponibles en la aplicación.

---

## Estructura de Navegación

### Menú Principal (Barra Lateral)

```
Portal Médico
├── Perfil y Público
│   ├── Mi Blog
│   ├── Citas
│   └── Perfil Público (enlace externo)
│
├── Expedientes Médicos
│   ├── Expedientes de Pacientes
│   ├── Nueva Consulta
│   └── Reportes
│
└── Gestión de Consultorio
    ├── Productos
    ├── Flujo de Dinero
    ├── Ventas
    └── Compras
```

---

## Módulos Disponibles

### 1. Expedientes Médicos
Gestión completa de pacientes y su historial clínico.
- **[Pacientes](./modules/medical-records/patients.md)** - Crear, editar y buscar pacientes
- **[Consultas](./modules/medical-records/encounters.md)** - Documentación clínica de consultas
- **[Recetas](./modules/medical-records/prescriptions.md)** - Prescripción de medicamentos
- **[Multimedia](./modules/medical-records/media.md)** - Fotos y documentos del paciente
- **[Línea de Tiempo](./modules/medical-records/timeline.md)** - Historial cronológico

### 2. Citas
Gestión de disponibilidad y reservaciones.
- **[Espacios de Cita](./modules/appointments/slots.md)** - Configurar horarios disponibles
- **[Reservaciones](./modules/appointments/bookings.md)** - Ver citas agendadas por pacientes

### 3. Gestión de Consultorio
Operaciones financieras y administrativas.
- **[Ventas](./modules/practice-management/sales.md)** - Registro de ventas
- **[Compras](./modules/practice-management/purchases.md)** - Registro de compras
- **[Flujo de Dinero](./modules/practice-management/cash-flow.md)** - Ingresos y egresos
- **[Productos](./modules/practice-management/products.md)** - Inventario de productos
- **[Clientes](./modules/practice-management/clients.md)** - Base de datos de clientes
- **[Proveedores](./modules/practice-management/suppliers.md)** - Base de datos de proveedores

### 4. Blog
- **[Mi Blog](./modules/blog.md)** - Publicación de artículos

### 5. Funcionalidades Especiales
- **[Asistente de Voz](./features/voice-assistant.md)** - Dictado por voz con IA
- **[Navegación](./features/navigation.md)** - Cómo navegar en la app

---

## Preguntas Frecuentes

Ver **[FAQ](./faq.md)** para respuestas a preguntas comunes.

---

## Idioma de la Aplicación

La aplicación está completamente en **español (México)**. Todos los formularios, etiquetas y mensajes están localizados.

---

## Soporte de Dispositivos

La aplicación es **responsive** y funciona en:
- Computadoras de escritorio (vista completa con tabla)
- Tablets (vista adaptada)
- Teléfonos móviles (vista de tarjetas)
