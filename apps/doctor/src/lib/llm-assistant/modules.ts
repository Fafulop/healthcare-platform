/**
 * Module Definitions for LLM Assistant
 * Maps application modules to their documentation files and keywords
 */

import type { ModuleDefinition } from './types';

export const MODULE_DEFINITIONS: ModuleDefinition[] = [
  {
    id: 'medical-records',
    name: 'Expedientes Médicos',
    description: 'Gestión de pacientes, consultas clínicas, recetas, multimedia y línea de tiempo',
    keywords: [
      'paciente', 'pacientes', 'expediente', 'expedientes', 'consulta', 'consultas',
      'encuentro', 'receta', 'recetas', 'prescripción', 'medicamento', 'medicamentos',
      'SOAP', 'subjetivo', 'objetivo', 'evaluación', 'plan', 'diagnóstico',
      'signos vitales', 'historial', 'multimedia', 'foto', 'fotos', 'imagen',
      'línea de tiempo', 'timeline', 'médico', 'clínico', 'clínica',
      'alergias', 'condiciones crónicas', 'tipo de sangre',
    ],
    submodules: [
      { id: 'patients', name: 'Pacientes', keywords: ['paciente', 'registro', 'crear paciente', 'buscar paciente'] },
      { id: 'encounters', name: 'Consultas', keywords: ['consulta', 'encuentro', 'SOAP', 'nota clínica'] },
      { id: 'prescriptions', name: 'Recetas', keywords: ['receta', 'prescripción', 'medicamento', 'PDF receta'] },
      { id: 'media', name: 'Multimedia', keywords: ['foto', 'imagen', 'video', 'multimedia'] },
      { id: 'timeline', name: 'Línea de Tiempo', keywords: ['timeline', 'historial', 'cronología'] },
    ],
    filePaths: [
      'docs/llm-assistant/modules/medical-records/patients.md',
      'docs/llm-assistant/modules/medical-records/encounters.md',
      'docs/llm-assistant/modules/medical-records/prescriptions.md',
      'docs/llm-assistant/modules/medical-records/media.md',
      'docs/llm-assistant/modules/medical-records/timeline.md',
    ],
  },
  {
    id: 'appointments',
    name: 'Citas',
    description: 'Gestión de espacios de cita, disponibilidad del doctor y reservaciones de pacientes',
    keywords: [
      'cita', 'citas', 'horario', 'horarios', 'agenda', 'disponibilidad',
      'espacio', 'espacios', 'slot', 'slots', 'reservación', 'reservaciones',
      'booking', 'agendar', 'programar', 'cancelar cita', 'confirmar',
      'precio', 'descuento', 'duración', 'crear horarios', 'bloquear',
      'asistente de voz citas', 'calendario citas', 'vista lista',
    ],
    submodules: [
      { id: 'slots', name: 'Espacios de Cita', keywords: ['espacio', 'slot', 'horario', 'disponibilidad', 'crear horario'] },
      { id: 'bookings', name: 'Reservaciones', keywords: ['reservación', 'booking', 'confirmar', 'paciente agendó', 'completada', 'no asistió'] },
      { id: 'create-slots', name: 'Crear Horarios', keywords: ['crear horarios', 'modal crear', 'recurrente', 'día único', 'descanso'] },
    ],
    filePaths: [
      'docs/llm-assistant/modules/appointments/slots.md',
      'docs/llm-assistant/modules/appointments/bookings.md',
      'docs/llm-assistant/modules/appointments/create-slots.md',
    ],
  },
  {
    id: 'practice-management',
    name: 'Gestión de Consultorio',
    description: 'Ventas, compras, flujo de dinero, productos, clientes y proveedores',
    keywords: [
      'venta', 'ventas', 'compra', 'compras', 'flujo', 'dinero', 'ingreso',
      'egreso', 'producto', 'productos', 'cliente', 'clientes', 'proveedor',
      'proveedores', 'factura', 'cotización', 'inventario', 'precio',
      'IVA', 'impuesto', 'pago', 'cobro', 'cuenta bancaria',
      'consultorio', 'gestión', 'finanzas', 'contabilidad',
    ],
    submodules: [
      { id: 'sales', name: 'Ventas', keywords: ['venta', 'ventas', 'vender', 'cobrar'] },
      { id: 'purchases', name: 'Compras', keywords: ['compra', 'compras', 'comprar', 'proveedor'] },
      { id: 'cash-flow', name: 'Flujo de Dinero', keywords: ['flujo', 'dinero', 'ingreso', 'egreso', 'cash flow', 'estado de resultados'] },
      { id: 'products', name: 'Productos', keywords: ['producto', 'productos', 'inventario', 'catálogo'] },
      { id: 'clients', name: 'Clientes', keywords: ['cliente', 'clientes', 'CRM'] },
      { id: 'suppliers', name: 'Proveedores', keywords: ['proveedor', 'proveedores', 'supplier'] },
      { id: 'quotations', name: 'Cotizaciones', keywords: ['cotización', 'cotizaciones', 'cotizar', 'propuesta'] },
      { id: 'areas', name: 'Áreas y Subáreas', keywords: ['área', 'áreas', 'subárea', 'categoría', 'clasificar movimiento'] },
    ],
    filePaths: [
      'docs/llm-assistant/modules/practice-management/overview.md',
      'docs/llm-assistant/modules/practice-management/sales.md',
      'docs/llm-assistant/modules/practice-management/purchases.md',
      'docs/llm-assistant/modules/practice-management/cash-flow.md',
      'docs/llm-assistant/modules/practice-management/products.md',
      'docs/llm-assistant/modules/practice-management/clients.md',
      'docs/llm-assistant/modules/practice-management/suppliers.md',
      'docs/llm-assistant/modules/practice-management/quotations.md',
      'docs/llm-assistant/modules/practice-management/areas.md',
    ],
  },
  {
    id: 'pendientes',
    name: 'Pendientes',
    description: 'Gestión de tareas, recordatorios y seguimientos clínicos o administrativos',
    keywords: [
      'pendiente', 'pendientes', 'tarea', 'tareas', 'recordatorio', 'seguimiento',
      'to-do', 'todo', 'agenda personal', 'vencida', 'prioridad', 'urgente',
      'laboratorio', 'referencia', 'administrativo',
    ],
    submodules: [],
    filePaths: [
      'docs/llm-assistant/modules/pendientes.md',
    ],
  },
  {
    id: 'profile',
    name: 'Mi Perfil',
    description: 'Configuración del perfil público del médico: servicios, clínica, formación, redes sociales',
    keywords: [
      'perfil', 'mi perfil', 'perfil público', 'slug', 'foto de perfil',
      'especialidad', 'biografía', 'servicios del médico', 'clínica',
      'horario de atención', 'redes sociales', 'linkedin', 'twitter',
      'FAQs', 'reseñas', 'opiniones', 'formación', 'educación', 'cédula',
    ],
    submodules: [],
    filePaths: [
      'docs/llm-assistant/modules/profile.md',
    ],
  },
  {
    id: 'blog',
    name: 'Blog',
    description: 'Publicación de artículos médicos en el blog personal del doctor',
    keywords: [
      'blog', 'artículo', 'artículos', 'publicar', 'publicación',
      'borrador', 'draft', 'SEO', 'contenido', 'post',
    ],
    submodules: [],
    filePaths: [
      'docs/llm-assistant/modules/blog.md',
    ],
  },
  {
    id: 'voice-assistant',
    name: 'Asistente de Voz',
    description: 'Dictado por voz con IA para crear registros mediante conversación natural',
    keywords: [
      'voz', 'dictado', 'dictar', 'grabar', 'grabación', 'micrófono',
      'transcripción', 'asistente de voz', 'voice', 'audio',
      'chat', 'conversación',
    ],
    submodules: [],
    filePaths: [
      'docs/llm-assistant/features/voice-assistant.md',
    ],
  },
  {
    id: 'navigation',
    name: 'Navegación',
    description: 'Cómo navegar por la aplicación, estructura del menú y accesos rápidos',
    keywords: [
      'navegar', 'navegación', 'menú', 'sidebar', 'barra lateral',
      'dónde', 'encontrar', 'ir a', 'acceder', 'página',
    ],
    submodules: [],
    filePaths: [
      'docs/llm-assistant/features/navigation.md',
    ],
  },
  {
    id: 'general',
    name: 'General',
    description: 'Información general sobre el Portal Médico y preguntas frecuentes',
    keywords: [
      'portal', 'médico', 'app', 'aplicación', 'plataforma',
      'qué es', 'qué puede', 'funcionalidad', 'características',
      'ayuda', 'soporte', 'FAQ', 'pregunta frecuente',
    ],
    submodules: [],
    filePaths: [
      'docs/llm-assistant/index.md',
      'docs/llm-assistant/faq.md',
    ],
  },
];

export function getModuleById(moduleId: string): ModuleDefinition | undefined {
  return MODULE_DEFINITIONS.find(m => m.id === moduleId);
}

export function getAllModuleIds(): string[] {
  return MODULE_DEFINITIONS.map(m => m.id);
}

export function getModuleForFilePath(filePath: string): ModuleDefinition | undefined {
  return MODULE_DEFINITIONS.find(m =>
    m.filePaths.some(fp => filePath.includes(fp) || fp.includes(filePath))
  );
}
