/**
 * App Capability Map
 *
 * Deterministic, structured knowledge about what each module can and cannot do.
 * This is the PRIMARY SOURCE OF TRUTH for the LLM assistant — not RAG.
 *
 * Injected directly into the system prompt for the relevant modules.
 * RAG documents are used only for explanations and how-to walkthroughs.
 */

export interface ActionRule {
  /** When this action is explicitly allowed */
  allowedIf?: string;
  /** When this action is blocked */
  blockedIf?: string;
  /** How to resolve the blocked state */
  resolution?: string;
  /** Additional important notes */
  notes?: string;
}

export interface EntityDef {
  /** Human-readable list of states and their meaning */
  states?: string;
  /** Status transitions summary */
  transitions?: string;
  /** Map of action name → rule */
  actions: Record<string, ActionRule>;
}

export interface ModuleCapabilities {
  name: string;
  routes: string[];
  entities: Record<string, EntityDef>;
}

export const CAPABILITY_MAP: Record<string, ModuleCapabilities> = {

  // ─────────────────────────────────────────────────────────────
  // APPOINTMENTS
  // ─────────────────────────────────────────────────────────────
  appointments: {
    name: 'Citas',
    routes: ['/appointments'],
    entities: {

      'Horario (Slot)': {
        states:
          'Disponible (isOpen=true, sin reservas) | ' +
          'Lleno (isOpen=true, reservas al máximo) | ' +
          'Cerrado (isOpen=false, no acepta reservas)',
        actions: {

          crear: {
            allowedIf: 'Siempre. Botón "Crear Horarios" (manual) o "Asistente de Voz" (dictado).',
            notes:
              'Creación manual: fecha, hora inicio, duración, precio, descuento, máx reservas. ' +
              'Creación por voz: dictar rango de fechas, días de la semana, horario, precio y el asistente genera todos los horarios.',
          },

          eliminar: {
            allowedIf:
              'Siempre — incluso si tiene reservas activas.',
            notes:
              'Si el horario tiene reservas activas el sistema muestra: ' +
              '"Este horario tiene N cita(s) activa(s). ¿Cancelar las citas y eliminar el horario?" ' +
              '— al confirmar, cancela todas las reservas automáticamente y luego elimina el horario. ' +
              'Si no tiene reservas: solo pide confirmación simple.',
          },

          cerrar: {
            allowedIf: 'Solo si el horario NO tiene reservas activas (currentBookings = 0).',
            blockedIf: 'El horario tiene reservas activas (currentBookings > 0).',
            resolution:
              'Primero cancela las reservas activas del horario desde la tabla de "Citas Reservadas", ' +
              'luego cierra el horario.',
            notes:
              'Mensaje de error exacto: ' +
              '"No se puede cerrar este horario porque tiene N reserva(s) activa(s). ' +
              'Por favor cancela las reservas primero."',
          },

          abrir: {
            allowedIf: 'Siempre — incluso si tiene reservas existentes.',
          },

          'acción masiva — cerrar varios': {
            blockedIf:
              'Alguno de los horarios seleccionados tiene reservas activas.',
            resolution:
              'Deselecciona los horarios con reservas, o cancela sus reservas primero.',
            notes:
              'Mensaje: "No se pueden cerrar N horario(s) porque tienen reservas activas. ' +
              'Por favor cancela las reservas primero o deselecciona esos horarios."',
          },

          'acción masiva — eliminar varios': {
            allowedIf: 'Siempre — requiere confirmación del número de horarios.',
          },

          'acción masiva — abrir varios': {
            allowedIf: 'Siempre.',
          },
        },
      },

      'Reservación (Booking)': {
        states:
          'PENDING (Pendiente — paciente agendó, sin confirmar por el médico) | ' +
          'CONFIRMED (Confirmada — médico confirmó asistencia) | ' +
          'COMPLETED (Completada — paciente asistió) | ' +
          'CANCELLED (Cancelada) | ' +
          'NO_SHOW (No asistió)',
        transitions:
          'PENDING → Confirmar (CONFIRMED) o Cancelar (CANCELLED) | ' +
          'CONFIRMED → Completada (COMPLETED), No Asistió (NO_SHOW) o Cancelar (CANCELLED) | ' +
          'COMPLETED / CANCELLED / NO_SHOW → sin acciones disponibles',
        actions: {

          confirmar: {
            allowedIf: 'Solo desde estado PENDING.',
            blockedIf: 'Estado es CONFIRMED, COMPLETED, CANCELLED o NO_SHOW.',
          },

          cancelar: {
            allowedIf: 'Desde PENDING o CONFIRMED.',
            blockedIf: 'Estado es COMPLETED, CANCELLED o NO_SHOW.',
            notes:
              'Al cancelar la reservación el horario vuelve a estado Disponible. ' +
              'Confirmación requerida: "¿Estás seguro de que quieres cancelar esta cita?"',
          },

          'marcar como completada': {
            allowedIf: 'Solo desde estado CONFIRMED.',
            blockedIf: 'Cualquier otro estado.',
          },

          'marcar no asistió': {
            allowedIf: 'Solo desde estado CONFIRMED.',
            blockedIf: 'Cualquier otro estado.',
          },

          'crear reservación directamente': {
            blockedIf: 'Siempre — el médico no puede crear reservaciones.',
            notes:
              'Solo los pacientes pueden agendar desde el perfil público del médico. ' +
              'El médico solo puede ver, confirmar y cancelar reservaciones existentes.',
          },
        },
      },
    },
  },

  // ─────────────────────────────────────────────────────────────
  // MEDICAL RECORDS
  // ─────────────────────────────────────────────────────────────
  'medical-records': {
    name: 'Expedientes Médicos',
    routes: [
      '/dashboard/medical-records',
      '/dashboard/medical-records/patients',
    ],
    entities: {

      'Paciente': {
        states: 'active (Activo) | inactive (Inactivo)',
        actions: {

          crear: {
            allowedIf: 'Siempre. Botón "Nuevo Paciente" en la lista.',
            notes:
              'Campos requeridos: nombre, apellido, fecha de nacimiento, sexo. ' +
              'El ID interno (formato P{timestamp}) se genera automáticamente y no puede cambiarse después.',
          },

          editar: {
            allowedIf: 'Siempre.',
            notes: 'El campo ID Interno queda deshabilitado tras la creación y no puede modificarse.',
          },

          eliminar: {
            blockedIf: 'No existe opción de eliminar pacientes en la UI.',
            notes: 'Los pacientes solo pueden desactivarse (status: inactive).',
          },
        },
      },

      'Consulta (Encounter)': {
        states:
          'draft (Borrador) | completed (Completada) | amended (Enmendada)',
        actions: {

          crear: {
            allowedIf: 'Siempre desde el perfil del paciente. Botón "Nueva Consulta".',
            notes:
              'Tipos disponibles: Consulta, Seguimiento, Emergencia, Telemedicina. ' +
              'Plantilla estándar requiere: fecha, tipo, motivo de consulta. ' +
              'Plantilla personalizada solo requiere: fecha y tipo (no requiere motivo de consulta). ' +
              'Al crear una consulta se actualiza automáticamente la fecha de última visita del paciente.',
          },

          editar: {
            allowedIf: 'Siempre — en cualquier estado.',
            notes:
              'Cada edición guarda una versión anterior automáticamente. ' +
              'El historial de versiones es accesible desde el botón de versiones en la página de la consulta.',
          },

          'ver versiones': {
            allowedIf: 'Siempre. Página /versions desde el detalle de la consulta.',
            notes:
              'Muestra lista de versiones numeradas con fecha, autor y snapshot completo de los datos.',
          },
        },
      },

      'Prescripción': {
        states:
          'draft (Borrador) | issued (Emitida) | cancelled (Cancelada) | expired (Expirada)',
        actions: {

          crear: {
            allowedIf: 'Siempre desde el perfil del paciente.',
            notes:
              'Requeridos: fecha de prescripción, nombre del médico, cédula profesional, ' +
              'y al menos un medicamento válido. Un medicamento válido necesita: ' +
              'nombre del medicamento, dosis, frecuencia e instrucciones.',
          },

          editar: {
            allowedIf: 'Solo si estado es DRAFT (Borrador).',
            blockedIf: 'Estado es issued, cancelled o expired.',
            resolution:
              'No es posible editar una prescripción emitida. ' +
              'Cancela la prescripción actual y crea una nueva.',
          },

          emitir: {
            allowedIf: 'Solo si estado es DRAFT.',
            blockedIf: 'Estado es issued, cancelled o expired.',
            notes:
              'Acción irreversible. Requiere confirmación: ' +
              '"¿Está seguro de emitir esta prescripción? No podrá editarla después." ' +
              'Una vez emitida, habilita la descarga de PDF.',
          },

          'descargar PDF': {
            allowedIf: 'Solo si estado es ISSUED (Emitida).',
            blockedIf: 'Estado es draft, cancelled o expired.',
            resolution: 'Primero emite la prescripción, luego podrás descargar el PDF.',
          },

          cancelar: {
            allowedIf: 'Solo si estado es ISSUED.',
            blockedIf: 'Estado es draft, cancelled o expired.',
            notes: 'Requiere ingresar un motivo de cancelación (campo obligatorio).',
          },

          eliminar: {
            allowedIf: 'Solo si estado es DRAFT (Borrador).',
            blockedIf: 'Estado es issued, cancelled o expired.',
            resolution:
              'Para una prescripción emitida usa "Cancelar Prescripción" en su lugar.',
          },
        },
      },

      'Multimedia (Media)': {
        actions: {

          subir: {
            allowedIf: 'Siempre. Botón "Subir Archivo" en la galería del paciente.',
            notes:
              'Límites de tamaño: imágenes 10MB, videos 100MB, audio 20MB. ' +
              'Tipos aceptados: image/*, video/*, audio/*. ' +
              'Campos opcionales: categoría, área del cuerpo, descripción, notas clínicas, consulta vinculada.',
          },

          editar: {
            allowedIf:
              'Siempre — descripción, notas del médico, categoría y área del cuerpo son editables.',
          },

          eliminar: {
            allowedIf: 'Siempre — requiere confirmación.',
          },
        },
      },

      'Plantilla de Consulta': {
        actions: {

          crear: {
            notes:
              'Hay un límite máximo de plantillas por médico (definido en el sistema). ' +
              'El botón "Nueva Plantilla" se deshabilita al alcanzar el límite.',
          },

          'establecer como predeterminada': {
            notes:
              'Solo una plantilla puede ser la predeterminada. ' +
              'La predeterminada se preselecciona automáticamente al crear una nueva consulta.',
          },

          eliminar: {
            blockedIf: 'La plantilla es la predeterminada actualmente.',
            resolution:
              'Establece otra plantilla como predeterminada primero, luego elimina esta.',
          },
        },
      },
    },
  },

  // ─────────────────────────────────────────────────────────────
  // PRACTICE MANAGEMENT
  // ─────────────────────────────────────────────────────────────
  'practice-management': {
    name: 'Gestión de Consultorio',
    routes: [
      '/dashboard/practice/ventas',
      '/dashboard/practice/compras',
      '/dashboard/practice/cotizaciones',
      '/dashboard/practice/flujo-de-dinero',
      '/dashboard/practice/products',
      '/dashboard/practice/clients',
      '/dashboard/practice/proveedores',
      '/dashboard/practice/areas',
      '/dashboard/practice/master-data',
    ],
    entities: {

      'Venta': {
        states:
          'PENDING (Pendiente) | CONFIRMED (Confirmada) | PROCESSING (En Proceso) | ' +
          'SHIPPED (Enviada) | DELIVERED (Entregada) | CANCELLED (Cancelada)',
        transitions:
          'PENDING → CONFIRMED o CANCELLED | ' +
          'CONFIRMED → PROCESSING o CANCELLED | ' +
          'PROCESSING → SHIPPED o CANCELLED | ' +
          'SHIPPED → DELIVERED o CANCELLED | ' +
          'DELIVERED / CANCELLED → cualquier estado (reversibles)',
        actions: {

          'cambiar estado': {
            notes:
              'Solo transiciones válidas están disponibles en el selector. ' +
              'No se puede cambiar al mismo estado actual (error: "El estado es el mismo"). ' +
              'Cancelar desde cualquier estado activo requiere confirmación.',
          },

          'editar monto cobrado': {
            notes:
              'Editable inline en la columna "Cobrado" de la lista (clic en el lápiz). ' +
              'El estado de pago se calcula automáticamente: ' +
              '0 = PENDING | 0 < monto < total = PARTIAL | monto ≥ total = PAID. ' +
              'Restricciones: no puede ser negativo ni exceder el total de la venta.',
          },

          eliminar: {
            allowedIf: 'Siempre — requiere confirmación.',
          },

          'exportar PDF': {
            allowedIf: 'Solo cuando hay elementos seleccionados con los checkboxes.',
            blockedIf: 'Ningún elemento está seleccionado.',
            resolution: 'Marca los checkboxes de las ventas que quieres exportar.',
          },
        },
      },

      'Cotización': {
        states:
          'DRAFT (Borrador) | SENT (Enviada) | APPROVED (Aprobada) | ' +
          'REJECTED (Rechazada) | EXPIRED (Vencida) | CANCELLED (Cancelada)',
        transitions:
          'DRAFT → SENT o CANCELLED | ' +
          'SENT → APPROVED, REJECTED, EXPIRED o CANCELLED | ' +
          'APPROVED → solo CANCELLED | ' +
          'REJECTED → solo CANCELLED | ' +
          'EXPIRED / CANCELLED → cualquier estado (reversibles)',
        actions: {

          'cambiar estado desde APPROVED': {
            notes:
              'Requiere confirmación adicional: ' +
              '"¿Estás seguro de que quieres cambiar el estado de APROBADA a {nuevo}?"',
          },

          'crear desde cliente': {
            notes:
              'Desde la lista de Clientes, hay un botón para crear cotización con el cliente pre-seleccionado.',
          },

          'convertir a venta': {
            allowedIf: 'Siempre — botón de carrito (ShoppingCart) por cada cotización en la lista.',
            notes:
              'Crea una venta automáticamente copiando los ítems, precios y cliente de la cotización. ' +
              'Confirmación: "¿Convertir la cotización \'COT-XXX\' en una venta?" ' +
              'Al confirmar, redirige al detalle de la nueva venta. La cotización original no se elimina.',
          },

          'exportar PDF': {
            allowedIf: 'Solo cuando hay cotizaciones seleccionadas con los checkboxes.',
            blockedIf: 'Ninguna cotización está seleccionada.',
            resolution: 'Marca los checkboxes de las cotizaciones a exportar.',
          },
        },
      },

      'Compra': {
        states:
          'PENDING (Pendiente) | CONFIRMED (Confirmada) | PROCESSING (En Proceso) | ' +
          'SHIPPED (Enviada) | RECEIVED (Recibida) | CANCELLED (Cancelada)',
        transitions:
          'PENDING → CONFIRMED o CANCELLED | ' +
          'CONFIRMED → PROCESSING o CANCELLED | ' +
          'PROCESSING → SHIPPED o CANCELLED | ' +
          'SHIPPED → RECEIVED o CANCELLED | ' +
          'RECEIVED / CANCELLED → cualquier estado (reversibles)',
        actions: {

          'editar monto pagado': {
            notes:
              'Igual que en ventas: editable inline. No puede exceder el total ni ser negativo.',
          },

          'eliminar o modificar desde Flujo de Dinero': {
            blockedIf:
              'Siempre — los movimientos de compras en Flujo de Dinero son registros automáticos ' +
              'de solo lectura. No se pueden eliminar ni editar desde esa vista.',
            resolution:
              'Ve al módulo de Compras (Gestión de Consultorio > Compras) para gestionar ' +
              'la compra original: cambiar estado, editar monto pagado, o cancelarla.',
          },
        },
      },

      'Movimiento (Flujo de Dinero)': {
        actions: {

          crear: {
            allowedIf: 'Siempre.',
            notes:
              'Campos requeridos: tipo (ingreso/egreso), monto (positivo), concepto, fecha, ' +
              'área, forma de pago (efectivo/transferencia/tarjeta/cheque/depósito). ' +
              'El área debe ser del tipo correcto: área INGRESO para ingresos, área EGRESO para egresos.',
          },

          'crear lote por voz': {
            notes:
              'El asistente de voz puede detectar múltiples movimientos en un solo dictado ' +
              'y presentarlos para crear todos en un paso.',
          },
        },
      },

      'Área (Flujo de Dinero)': {
        actions: {

          'cambiar tipo (INGRESO/EGRESO)': {
            blockedIf: 'Siempre — el tipo de área es inmutable después de su creación.',
            resolution:
              'Elimina el área y crea una nueva con el tipo correcto. ' +
              'Advertencia: eliminar un área borra también todas sus subáreas.',
          },

          'eliminar área': {
            notes:
              'Requiere confirmación. ' +
              'Mensaje: "¿Estás seguro de eliminar {nombre}? Esto también eliminará todas las subáreas."',
          },
        },
      },

      'Producto / Servicio': {
        states: 'active (Activo) | inactive (Inactivo) | discontinued (Descontinuado)',
        actions: {

          crear: {
            notes:
              'Tipo: "product" o "service". ' +
              'Los productos pueden tener componentes (materiales maestros) que contribuyen al costo total. ' +
              'Precio de venta y costo son campos opcionales. ' +
              'El margen se calcula automáticamente: (precio - costo) / precio × 100.',
          },
        },
      },

      'Cliente / Proveedor': {
        states: 'active (Activo) | inactive (Inactivo)',
        actions: {

          'crear cotización desde cliente': {
            notes:
              'En la lista de clientes hay un botón directo para crear cotización con el cliente pre-cargado.',
          },
        },
      },
    },
  },

  // ─────────────────────────────────────────────────────────────
  // PENDIENTES (TASKS)
  // ─────────────────────────────────────────────────────────────
  pendientes: {
    name: 'Pendientes',
    routes: ['/dashboard/pendientes'],
    entities: {

      'Tarea (Pendiente)': {
        states:
          'PENDIENTE (por hacer) | EN_PROGRESO (en proceso) | ' +
          'COMPLETADA (terminada) | CANCELADA (cancelada)',
        actions: {

          crear: {
            allowedIf: 'Siempre.',
            notes:
              'Campos requeridos: título, prioridad (ALTA/MEDIA/BAJA), categoría. ' +
              'Categorías disponibles: SEGUIMIENTO, ADMINISTRATIVO, LABORATORIO, RECETA, REFERENCIA, PERSONAL, OTRO. ' +
              'Opcionales: descripción, fecha de vencimiento, hora inicio, hora fin, paciente vinculado.',
          },

          'cambiar estado': {
            notes:
              'Inline desde la lista: clic en el badge de estado para abrir el selector. ' +
              'Todas las transiciones entre estados son permitidas.',
          },

          eliminar: {
            allowedIf: 'Siempre — requiere confirmación: "¿Eliminar \'título\'?"',
          },

          'eliminar masivo': {
            notes:
              'Selecciona tareas con checkboxes → barra masiva → Eliminar. ' +
              'Confirmación: "¿Eliminar N tarea(s) seleccionada(s)?"',
          },

          'vencida (overdue)': {
            blockedIf: 'No es una acción bloqueada — es un estado visual.',
            notes:
              'Una tarea es "vencida" cuando tiene fecha de vencimiento pasada y no está COMPLETADA ni CANCELADA. ' +
              'Se muestra en rojo en la tabla. Para resolverla: completar o cancelar la tarea.',
          },
        },
      },
    },
  },

  // ─────────────────────────────────────────────────────────────
  // PROFILE (MI PERFIL)
  // ─────────────────────────────────────────────────────────────
  profile: {
    name: 'Mi Perfil',
    routes: ['/dashboard/mi-perfil'],
    entities: {

      'Perfil Público': {
        actions: {

          editar: {
            allowedIf: 'Siempre — cada pestaña tiene su propio botón de guardado.',
            notes:
              'Pestañas editables: Info General, Servicios, Clínica, Formación, Multimedia, FAQs y Social. ' +
              'La pestaña "Opiniones" es solo lectura (reseñas de pacientes).',
          },

          'eliminar reseña': {
            blockedIf: 'Siempre — las reseñas de pacientes no pueden ser eliminadas por el médico.',
          },

          'cambiar slug': {
            notes:
              'El slug puede editarse pero cambiar la URL del perfil público puede romper links existentes. ' +
              'Proceder con cuidado.',
          },
        },
      },
    },
  },
};

// ─────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────

/**
 * Format relevant capability map sections as a concise prompt block.
 * Only includes modules that match the given module IDs.
 */
export function formatCapabilityMapForPrompt(moduleIds: string[]): string {
  const sections: string[] = [];

  for (const moduleId of moduleIds) {
    const cap = CAPABILITY_MAP[moduleId];
    if (!cap) continue;

    const lines: string[] = [`\n━━━ ${cap.name.toUpperCase()} ━━━`];

    for (const [entityName, entity] of Object.entries(cap.entities)) {
      lines.push(`\n[${entityName}]`);

      if (entity.states) {
        lines.push(`Estados: ${entity.states}`);
      }

      if (entity.transitions) {
        lines.push(`Transiciones de estado: ${entity.transitions}`);
      }

      for (const [actionName, rule] of Object.entries(entity.actions)) {
        const parts: string[] = [`  · ${actionName}:`];
        if (rule.allowedIf) parts.push(`    ✅ ${rule.allowedIf}`);
        if (rule.blockedIf) parts.push(`    ❌ BLOQUEADO: ${rule.blockedIf}`);
        if (rule.resolution) parts.push(`    → SOLUCIÓN: ${rule.resolution}`);
        if (rule.notes) parts.push(`    ℹ ${rule.notes}`);
        lines.push(parts.join('\n'));
      }
    }

    sections.push(lines.join('\n'));
  }

  if (sections.length === 0) return '';

  return (
    'REGLAS DE LA APLICACIÓN (fuente de verdad — prioridad sobre documentación):\n' +
    sections.join('\n\n')
  );
}

/**
 * Infer module IDs from the current URL path.
 */
export function getModulesFromPath(path: string): string[] {
  if (path.startsWith('/appointments')) return ['appointments'];
  if (path.startsWith('/dashboard/medical-records')) return ['medical-records'];
  if (path.startsWith('/dashboard/practice')) return ['practice-management'];
  if (path.startsWith('/dashboard/blog')) return ['blog'];
  if (path.startsWith('/dashboard/pendientes')) return ['pendientes'];
  if (path.startsWith('/dashboard/mi-perfil')) return ['profile'];
  return [];
}
