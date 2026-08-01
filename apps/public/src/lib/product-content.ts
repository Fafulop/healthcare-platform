/**
 * Contenido de la página /producto — capacidades del producto y los dos planes.
 *
 * ⚠️ FUENTE DE VERDAD del reparto por plan: `TIER_EXCLUDED_KEYS` en
 * `packages/database/src/permissions.ts` (tiers CORE/FULL) y el diseño en
 * `docs/DESDE JUNIO/TIERS/`. Este archivo NO importa ese paquete a propósito:
 * `@healthcare/public` no depende de `@healthcare/database` y agregarlo
 * arrastraría Prisma al sitio público. Cada `permissionKey` de abajo es la key
 * real, para que la correspondencia sea verificable a ojo:
 *
 *   CORE excluye: facturacion · sat · conciliacion · ventas · compras · productos
 *
 * Si cambian los tiers, este archivo se actualiza a mano. Nombres públicos
 * (Esencial/Completo) ≠ nombres internos (CORE/FULL): el mapa vive aquí.
 */

export const PLAN_NAMES = {
  CORE: 'Esencial',
  FULL: 'Completo',
} as const;

export const SALES_EMAIL =
  process.env.NEXT_PUBLIC_SALES_EMAIL || 'hola@tusalud.pro';

/** Una función del producto, tal como la ve el doctor en su panel. */
export interface Feature {
  /** PermissionKey real — ver permissions.ts. */
  permissionKey: string;
  /** Etiqueta idéntica a la del sidebar del panel (PERMISSION_LABELS). */
  label: string;
  /** Qué hace, en una frase de doctor (no de ingeniero). */
  blurb: string;
  /** true ⇒ excluida del plan Esencial (CORE). */
  fullOnly?: boolean;
}

export interface CapabilityGroup {
  id: string;
  eyebrow: string;
  title: string;
  /** El argumento de venta del grupo, una frase. */
  lead: string;
  /** Detalles concretos, todos verificables en el producto de hoy. */
  bullets: string[];
  features: Feature[];
  fullOnly?: boolean;
  /**
   * Color de la sección. Da identidad a cada bloque sin repintar la marca:
   * tiñe el lavado del fondo y la pastilla del icono, NUNCA el texto (el ámbar
   * y el cian no dan contraste suficiente sobre blanco).
   *
   * `wash1`/`wash2` son el MISMO color con alfa: el degradado radial necesita
   * rgba, y precalcularlo aquí evita convertir hex→rgba en el render.
   */
  accent: string;
  wash1: string;
  wash2: string;
}

export const CAPABILITY_GROUPS: CapabilityGroup[] = [
  {
    id: 'agenda',
    accent: '#3B82F6',
    wash1: 'rgba(59,130,246,0.16)',
    wash2: 'rgba(59,130,246,0.05)',
    eyebrow: 'Agenda',
    title: 'Tus citas, sin teléfono de por medio',
    lead: 'El paciente agenda solo desde tu perfil público, y tu agenda queda igual de ordenada aunque no estés frente a la computadora.',
    bullets: [
      'Agenda en línea desde tu perfil público, con los horarios y servicios que tú defines.',
      'Recordatorios por correo antes de la cita, con la anticipación que elijas.',
      'Sincronización con Google Calendar en los dos sentidos: lo que agendas aquí aparece allá, y tus bloqueos de allá se respetan aquí.',
      'Reprogramar, cancelar y dar seguimiento sin perder el historial de la cita.',
    ],
    features: [
      {
        permissionKey: 'citas',
        label: 'Mis Citas',
        blurb: 'Tu agenda del día y de la semana, con el estado de cada cita.',
      },
      {
        permissionKey: 'tareas',
        label: 'Tareas',
        blurb: 'Los pendientes que deja una consulta, en un solo lugar.',
      },
    ],
  },
  {
    id: 'expediente',
    accent: '#10B981',
    wash1: 'rgba(16,185,129,0.15)',
    wash2: 'rgba(16,185,129,0.05)',
    eyebrow: 'Clínico',
    title: 'El expediente del paciente, completo',
    lead: 'Historia clínica, notas y recetas en el mismo lugar donde vive la cita — no en tres cuadernos distintos.',
    bullets: [
      'Expediente por paciente con el historial de sus consultas.',
      'Recetas en PDF con tu firma y los datos de tu consultorio.',
      'Notas privadas del doctor, separadas del expediente del paciente.',
      'Formatos propios para lo que documentas en cada consulta.',
    ],
    features: [
      {
        permissionKey: 'expedientes',
        label: 'Expedientes Médicos',
        blurb: 'Historia clínica y recetas por paciente.',
      },
      {
        permissionKey: 'notas',
        label: 'Notas',
        blurb: 'Tus apuntes, visibles solo para ti.',
      },
    ],
  },
  {
    id: 'asistente',
    accent: '#8B5CF6',
    wash1: 'rgba(139,92,246,0.16)',
    wash2: 'rgba(139,92,246,0.05)',
    eyebrow: 'Asistente de IA',
    title: 'Pregúntale a tu consultorio',
    lead: '«¿Cómo va mi semana?», «¿cuánto llevo este mes?», «agéndame a Laura el martes». El asistente lee tus datos reales y prepara el trabajo; tú confirmas antes de que se ejecute nada.',
    bullets: [
      'Consulta tu agenda, tu expediente y tu dinero con una pregunta en español.',
      'Para escribir —agendar, cobrar, registrar— siempre te propone primero y espera tu confirmación.',
      'Trabaja sobre tus datos reales del momento, no sobre un resumen viejo.',
      'Incluido en los dos planes.',
    ],
    features: [
      {
        permissionKey: 'asistente_ia',
        label: 'Asistente IA',
        blurb: 'Conversación sobre agenda, expediente y dinero.',
      },
    ],
  },
  {
    id: 'dinero',
    accent: '#F59E0B',
    wash1: 'rgba(245,158,11,0.16)',
    wash2: 'rgba(245,158,11,0.05)',
    eyebrow: 'Dinero',
    title: 'Saber cuánto entró y cuánto salió',
    lead: 'Ingresos y egresos de tu consultorio en un solo tablero, con el precio que ya viene de la agenda — sin capturar dos veces.',
    bullets: [
      'Flujo de dinero con ingresos y egresos, y el precio del servicio tomado de la cita.',
      'Cobros en línea con Mercado Pago y Stripe: mandas el link, el pago se registra.',
      'Reportes de tu actividad y de cómo se comporta tu consultorio mes a mes.',
    ],
    features: [
      {
        permissionKey: 'flujo',
        label: 'Flujo de Dinero',
        blurb: 'Ingresos y egresos del consultorio.',
      },
      {
        permissionKey: 'pagos',
        label: 'Pagos',
        blurb: 'Links de cobro con Mercado Pago y Stripe.',
      },
      {
        permissionKey: 'reportes',
        label: 'Reportes',
        blurb: 'La foto de tu consultorio en números.',
      },
    ],
  },
  {
    id: 'presencia',
    accent: '#06B6D4',
    wash1: 'rgba(6,182,212,0.16)',
    wash2: 'rgba(6,182,212,0.05)',
    eyebrow: 'Presencia',
    title: 'Que te encuentren',
    lead: 'Un perfil público pensado para buscadores, con tu contenido y las opiniones de tus pacientes — y un botón de agendar que sí lleva a tu agenda.',
    bullets: [
      'Perfil público con tus servicios, tu consultorio y tu botón de agendar.',
      'Blog propio para lo que quieras publicar, dentro de tu mismo perfil.',
      'Contenido audiovisual: videos y material que te presentan mejor que un párrafo.',
      'Opiniones de pacientes, recolectadas con un link después de la consulta.',
    ],
    features: [
      {
        permissionKey: 'perfil_publico',
        label: 'Perfil Público',
        blurb: 'Tu página en tusalud.pro, lista para buscadores.',
      },
      {
        permissionKey: 'blog',
        label: 'Mi Blog',
        blurb: 'Publica sin depender de nadie.',
      },
      {
        permissionKey: 'contenido',
        label: 'Contenido Audiovisual',
        blurb: 'Videos y material de tu consultorio.',
      },
      {
        permissionKey: 'perfil',
        label: 'Editar Perfil',
        blurb: 'Tus datos, servicios y horarios.',
      },
    ],
  },
  {
    id: 'fiscal',
    accent: '#F59E0B',
    wash1: 'rgba(245,158,11,0.18)',
    wash2: 'rgba(245,158,11,0.06)',
    eyebrow: 'Administración fiscal',
    title: 'La parte que nadie quiere hacer',
    lead: 'Facturar, bajar lo del SAT y cuadrar el banco desde el mismo sistema donde ya viven tus citas y tus cobros.',
    fullOnly: true,
    bullets: [
      'Facturación CFDI con tu propio sello (CSD), desde la cita que la origina.',
      'Descarga de tus CFDI emitidos y recibidos directamente del SAT.',
      'Conciliación bancaria: subes el estado de cuenta y lo cruzas contra lo registrado.',
      'Ventas, compras, cotizaciones y catálogo de productos y servicios.',
    ],
    features: [
      {
        permissionKey: 'facturacion',
        label: 'Facturación',
        blurb: 'CFDI con tu sello, desde la cita.',
        fullOnly: true,
      },
      {
        permissionKey: 'sat',
        label: 'Descarga SAT',
        blurb: 'Tus comprobantes emitidos y recibidos.',
        fullOnly: true,
      },
      {
        permissionKey: 'conciliacion',
        label: 'Conciliación Bancaria',
        blurb: 'El estado de cuenta contra tus registros.',
        fullOnly: true,
      },
      {
        permissionKey: 'ventas',
        label: 'Ventas',
        blurb: 'Ventas, cotizaciones y clientes.',
        fullOnly: true,
      },
      {
        permissionKey: 'compras',
        label: 'Compras',
        blurb: 'Compras y proveedores.',
        fullOnly: true,
      },
      {
        permissionKey: 'productos',
        label: 'Productos y Servicios',
        blurb: 'Tu catálogo, con precios.',
        fullOnly: true,
      },
    ],
  },
];

/** Todas las funciones, aplanadas — el orden es el del panel del doctor. */
export const ALL_FEATURES: Feature[] = CAPABILITY_GROUPS.flatMap((g) => g.features);

/** Plan Esencial (interno: CORE). */
export const CORE_FEATURES = ALL_FEATURES.filter((f) => !f.fullOnly);

/** Lo que el plan Completo (interno: FULL) agrega sobre Esencial. */
export const FULL_ONLY_FEATURES = ALL_FEATURES.filter((f) => f.fullOnly);

export const FAQ: { q: string; a: string }[] = [
  {
    q: '¿Puedo cambiar de plan después?',
    a: 'Sí. Escríbenos y movemos tu cuenta; tu información no se toca al cambiar de plan — las funciones se activan o se guardan, no se borran.',
  },
  {
    q: '¿El asistente de IA está en los dos planes?',
    a: 'Sí. Es parte del plan Esencial, no un extra. En el plan Completo además sabe de tus facturas y de lo que bajas del SAT.',
  },
  {
    q: '¿Puede entrar alguien más de mi consultorio?',
    a: 'Sí. Puedes invitar a una persona de apoyo y decidir función por función qué ve y qué no —tu agenda sí, tu expediente no, por ejemplo—.',
  },
  {
    q: '¿Necesito facturar para usar la plataforma?',
    a: 'No. El plan Esencial incluye la agenda, el expediente, los cobros y el flujo de dinero. La facturación, la descarga del SAT y la conciliación bancaria son del plan Completo.',
  },
  {
    q: '¿Mis pacientes tienen que descargar algo?',
    a: 'No. Agendan desde tu perfil público en el navegador y reciben sus recordatorios por correo.',
  },
];
