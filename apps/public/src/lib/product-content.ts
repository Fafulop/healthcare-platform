/**
 * Contenido de la home — capacidades del producto y los dos planes.
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
  /**
   * Lo que viene. Se renderiza en un bloque APARTE, nunca mezclado con
   * `bullets`: el doctor no debe tener que adivinar qué ya puede usar hoy.
   * Omitir el campo cuando no haya nada pendiente.
   */
  soon?: string[];
  features: Feature[];
  fullOnly?: boolean;
  /**
   * Color de la capacidad. Desde el 2026-08-01 tiñe ÚNICAMENTE la pastilla de
   * su icono: el fondo lo pone el campo continuo de la página
   * (`.velvet-field`), no la sección. Es la última isla de identidad por
   * capacidad, y es lo que deja distinguir agenda de dinero de un vistazo.
   *
   * Sigue sin tocar texto: el ámbar y el cian no dan contraste AA sobre claro.
   *
   * (Aquí vivían `wash1`/`wash2`, el mismo color con alfa para el degradado
   * radial de cada banda. Murieron con los fondos por sección.)
   */
  accent: string;
}

export const CAPABILITY_GROUPS: CapabilityGroup[] = [
  {
    id: 'agenda',
    accent: '#3B82F6',
    eyebrow: 'Agenda',
    title: 'Tus citas, sin teléfono de por medio',
    lead: 'El paciente agenda solo desde tu perfil público, tú te enteras por donde ya lees tus mensajes, y llega a la consulta con sus datos contestados de antemano.',
    bullets: [
      'Agenda en línea desde tu perfil público, con los horarios y servicios que tú defines. Reprogramar, cancelar o confirmar no pierde el historial de la cita.',
      'Google Calendar en los dos sentidos: lo que agendas aquí aparece allá, y lo que bloqueas allá se respeta aquí.',
      'Tu itinerario del día por Telegram, a la hora que tú elijas — más los avisos de las citas y las tareas que vienen.',
      'Confirmaciones y recordatorios por correo para tus pacientes, con la anticipación que elijas.',
      'Formularios previos a la consulta con TUS preguntas: armas la plantilla una vez y se la mandas por correo o WhatsApp para que el paciente llegue con todo contestado.',
      'Los archivos que el paciente manda antes de la consulta quedan guardados junto a su cita.',
    ],
    soon: [
      'Recordatorios automáticos a tus pacientes por WhatsApp, y que confirmen si van a venir respondiendo ahí mismo.',
      'Tu itinerario del día y tus avisos, también por WhatsApp.',
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
    eyebrow: 'Clínico',
    title: 'El expediente del paciente, completo',
    lead: 'Historia clínica, notas y recetas en el mismo lugar donde vive la cita — en regla con lo que piden las instituciones, y en tus propios formatos.',
    bullets: [
      'Expediente conforme a la NOM-004 y la NOM-024, con su aviso de privacidad: lo que exigen las instituciones de gobierno.',
      'Recetarios personalizados con tus formatos, los datos de tu consultorio y tu firma, exportables a PDF.',
      'Plantillas propias para lo que documentas en cada consulta, con los formatos que tú definas y exportables a PDF.',
      'Adjunta al expediente lo que haga falta: PDFs, estudios y fotografías.',
      'Notas escritas o dictadas por voz, adjuntas al expediente. Y notas privadas tuyas, separadas de lo que ve el paciente.',
      'Resumen instantáneo del paciente: todas sus citas, sus recetas y sus notas, sumadas en el momento.',
      'Todo el expediente en una línea de tiempo ordenada y exportable a PDF — el historial completo del paciente de un vistazo.',
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
    eyebrow: 'Asistente de IA',
    title: 'No tienes que aprenderte el sistema',
    lead: 'Lo caro de cualquier software es el tiempo que tardas en dominarlo. Aquí le escribes lo que quieres —«agéndame a Laura el martes a las 5», «¿cómo va mi semana?»— y se hace. Sin buscar en qué pantalla estaba.',
    bullets: [
      'Le hablas como le hablarías a tu asistente: «¿qué tengo mañana?», «reagenda a Laura al jueves», «¿cuánto llevo este mes?».',
      'No es solo para preguntar: crea citas, las actualiza y registra lo que haga falta, sin que tengas que encontrar el botón correcto.',
      'Antes de escribir cualquier cosa te enseña exactamente qué va a hacer y espera tu confirmación. Nada se ejecuta a tus espaldas.',
      'Conoce tu agenda, tu expediente y tu dinero — y trabaja sobre tus datos de este momento, no sobre un resumen viejo.',
      'Incluido en los dos planes, no como un extra que se paga aparte.',
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
    id: 'presencia',
    accent: '#06B6D4',
    eyebrow: 'Presencia',
    title: 'Que te encuentren',
    lead: 'Tu propia página, no un renglón en un directorio: tus fotos, tus videos, tus servicios y tus consultorios — con un botón de agendar que lleva a tu agenda de verdad.',
    bullets: [
      'Una página personalizada tuya: fotos, videos, los servicios que ofreces con su descripción y las direcciones de tus consultorios.',
      'Optimizada para buscadores desde el primer día. Con el tiempo empiezas a salir más arriba en Google sin pagar por estar ahí.',
      'Te sirve de destino para tus campañas de Google Ads: mandas el tráfico que pagas a tu página, no a un perfil genérico donde compites con otros.',
      'Es el link que pones en tu bio de Instagram — una sola dirección que lleva a todo lo tuyo y que deja agendar ahí mismo.',
      'Blog propio para lo que quieras publicar, dentro de tu mismo perfil.',
      'Opiniones de tus pacientes, recolectadas con un link después de la consulta.',
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
    id: 'dinero',
    accent: '#F59E0B',
    eyebrow: 'Dinero',
    title: 'Saber cuánto entró y cuánto salió',
    lead: 'Todo el dinero de tu consultorio cae en un mismo tablero. Lo que cobras en la consulta, lo que te pagan en línea y lo que bajas del SAT llegan solos; lo demás lo agregas tú.',
    bullets: [
      'Un solo tablero de ingresos y egresos: aquí aterriza todo lo que se mueve en tu consultorio, venga de donde venga.',
      'Terminas una cita y lo que cobraste por ella se registra solo, con el precio del servicio que ya venía de tu agenda — sin capturarlo dos veces.',
      'Conectas tu cuenta de Mercado Pago o de Stripe y generas links de cobro: tu paciente paga con tarjeta de crédito o débito, transferencia o SPEI —según la cuenta que conectes— y el cobro entra solo en cuanto se paga.',
      'El dinero nunca pasa por nosotros: va directo de tu paciente a tu cuenta de Mercado Pago o de Stripe. Nosotros no lo tocamos ni lo retenemos.',
      `Con el plan ${PLAN_NAMES.FULL}, los CFDI que bajas del SAT también entran solos: lo que facturaste como ingreso y lo que te facturaron como gasto.`,
      'Y lo que nunca pasó por el sistema lo agregas a mano: un ingreso o un gasto suelto, cuando haga falta.',
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
    ],
  },
  {
    id: 'fiscal',
    accent: '#F59E0B',
    eyebrow: 'Administración fiscal',
    title: 'La parte que nadie quiere hacer',
    lead: 'Son dos cosas distintas y las dos viven aquí: facturar tú, y bajar del SAT todo lo que se facturó a tu nombre. De ahí sale, solo, el resumen que tu contador necesita.',
    fullOnly: true,
    bullets: [
      'Facturación CFDI con tu propio sello (CSD), desde la cita que la origina. Incluye 30 facturas al mes, y puedes agregar más si las necesitas.',
      'Descarga automática de tus CFDI emitidos y recibidos, directo del SAT: tus ingresos y tus gastos con respaldo, sin capturar nada a mano.',
      'Cada mes se arma solo un resumen de todo lo que facturaste y todo lo que te facturaron — se lo mandas a tu contador y hace la declaración sin perseguirte.',
      'Sabes cómo vas con el SAT durante el mes, no cuando ya toca declarar.',
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
  /**
   * Reportes va AL FINAL a propósito: mide la agenda, el expediente y el
   * dinero, así que solo tiene sentido después de haberlos contado. Vivía
   * dentro del grupo `dinero`, pero dos de sus tres familias de reporte
   * (citas y actividad clínica) no son de dinero.
   */
  {
    id: 'reportes',
    accent: '#6366F1',
    eyebrow: 'Reportes',
    title: 'Cómo va tu consultorio, en números',
    lead: 'No solo el dinero: cuántas citas diste, cuánto documentaste y en qué se te fue el mes — con la gráfica enfrente, no en tu cabeza.',
    bullets: [
      'Tus citas mes a mes en una gráfica: cuántas agendaste, cuántas completaste, cuántas se reprogramaron y cuántas se cancelaron.',
      'Tu actividad clínica: cuántos expedientes abriste, cuántas plantillas armaste y cuántas recetas hiciste.',
      'Estado de resultados: tus ingresos y tus egresos por concepto, para ver de dónde viene y a dónde se va el dinero.',
    ],
    features: [
      {
        permissionKey: 'reportes',
        label: 'Reportes',
        blurb: 'La foto de tu consultorio en números.',
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

/**
 * Hechos de plataforma: ciertos para TODO el producto, así que no caben en
 * ninguna banda de capacidad. Van en una tira compacta justo antes de los
 * planes, que es donde el doctor se pregunta «¿y esto cómo lo uso a diario?».
 */
export const PLATFORM_FACTS: { id: string; title: string; text: string }[] = [
  {
    id: 'nube',
    title: 'En cualquier dispositivo',
    text: 'Vive en la nube: entras desde la computadora del consultorio, tu laptop o tu celular y encuentras exactamente lo mismo. No se instala ni se respalda nada.',
  },
  {
    id: 'movil',
    title: 'Se instala en tu celular',
    text: 'Es una aplicación web progresiva (PWA): la instalas desde el navegador y queda como una app más en tu teléfono, pensada para usarse desde ahí.',
  },
  {
    id: 'sesiones',
    title: 'Las sesiones que necesites',
    text: 'Puedes dejar abiertas todas las sesiones que quieras al mismo tiempo — el consultorio, la casa, el celular — sin que una cierre a la otra.',
  },
  {
    id: 'equipo',
    title: 'Dos cuentas, no una contraseña prestada',
    text: 'Además de la tuya, una segunda cuenta con su propio acceso para quien te apoya. Desde tu cuenta decides, función por función, qué puede ver y qué puede hacer.',
  },
];

/**
 * El orden NO es casual: primero las dos preguntas que frenan una venta —el
 * dinero y la norma—, y hasta el final las de detalle. Cada respuesta se
 * sostiene en algo que la página ya afirma más arriba; no se contesta aquí
 * nada que el producto no haga.
 */
export const FAQ: { q: string; a: string }[] = [
  {
    q: '¿El dinero de mis pacientes pasa por ustedes?',
    a: 'No, nunca. Tú conectas tu propia cuenta de Mercado Pago o de Stripe y el pago va directo de tu paciente a esa cuenta. Nosotros no lo tocamos, no lo retenemos y no dependes de que te lo depositemos.',
  },
  {
    q: '¿El expediente cumple con lo que piden las instituciones?',
    a: 'Sí. El expediente está hecho conforme a la NOM-004 y la NOM-024, y con su aviso de privacidad — que es lo que exigen las instituciones de gobierno.',
  },
  {
    q: '¿Tengo que instalar algo?',
    a: 'No. Vive en la nube y se usa desde el navegador, así que entras igual desde la computadora del consultorio, tu laptop o tu celular. En el teléfono puedes instalarla desde el mismo navegador y queda como una app más.',
  },
  {
    q: '¿El asistente de IA está en los dos planes?',
    a: `Sí. Es parte del plan ${PLAN_NAMES.CORE}, no un extra que se paga aparte. En el plan ${PLAN_NAMES.FULL} además sabe de tus facturas y de lo que bajas del SAT.`,
  },
  {
    q: '¿Puede entrar alguien más de mi consultorio?',
    a: 'Sí. Además de la tuya hay una segunda cuenta, con su propio acceso, para quien te apoya — no le prestas tu contraseña. Desde tu cuenta decides función por función qué puede ver y qué puede hacer: tu agenda sí, tu expediente no, por ejemplo.',
  },
  {
    q: '¿Necesito facturar para usar la plataforma?',
    a: `No. El plan ${PLAN_NAMES.CORE} incluye la agenda, el expediente, los cobros, el flujo de dinero y los reportes. La facturación, la descarga del SAT y la conciliación bancaria son del plan ${PLAN_NAMES.FULL}.`,
  },
  {
    q: '¿Qué pasa si necesito más de 30 facturas al mes?',
    a: `El plan ${PLAN_NAMES.FULL} incluye 30 facturas al mes. Si tu consultorio necesita más, se agregan — escríbenos y lo ajustamos a tu volumen.`,
  },
  {
    q: '¿Puedo cambiar de plan después?',
    a: 'Sí. Escríbenos y movemos tu cuenta; tu información no se toca al cambiar de plan — las funciones se activan o se guardan, no se borran.',
  },
  {
    q: '¿Mis pacientes tienen que descargar algo?',
    a: 'No. Agendan desde tu perfil público en el navegador, reciben sus recordatorios por correo y contestan desde ahí los formularios que les mandes antes de la consulta.',
  },
];
