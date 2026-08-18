/**
 * Contenido de la home — el recorrido del paciente, las capacidades del
 * producto y el precio.
 *
 * ⚠️ AQUÍ YA NO HAY PLANES. Desde el 2026-08-17 se vende UN SOLO plan con todo
 * incluido a $550 + IVA al mes. Antes este archivo espejaba a mano el reparto
 * CORE/FULL de `TIER_EXCLUDED_KEYS` (`packages/database/src/permissions.ts`) y
 * marcaba con `fullOnly` lo que el plan Esencial no traía. Eso se borró.
 *
 * Lo que NO cambió es el código: los tiers CORE/FULL siguen vivos en
 * `permissions.ts` y el selector de tier sigue en el admin. Hoy es inofensivo
 * porque todas las cuentas están en FULL, así que "todo incluido" es cierto.
 * **Si alguien pone una cuenta en CORE, esta página miente** —le vendería
 * facturación, SAT y conciliación a alguien que verá pantallas bloqueadas—.
 * Esa es la razón de que la divergencia esté escrita aquí y no deducida: el
 * siguiente que pase no debe "arreglarla" devolviendo los dos planes.
 *
 * `@healthcare/public` sigue sin depender de `@healthcare/database` a
 * propósito (arrastraría Prisma al sitio público). Cada `permissionKey` de
 * abajo es la key real, para que la correspondencia sea verificable a ojo.
 */

export const SALES_EMAIL =
  process.env.NEXT_PUBLIC_SALES_EMAIL || 'hola@tusalud.pro';

/* ────────────────────────────── Precio ──────────────────────────────
   Los números viven aquí como DATOS, no incrustados en el JSX: la página
   los menciona en el hero, en el bloque de precio y en el FAQ, y así no
   pueden quedar tres precios distintos en la misma pantalla. */
export const PRICING = {
  amount: 550,
  currency: 'MXN',
  /** El precio se publica SIN IVA, así que la página está obligada a decirlo. */
  ivaNote: '+ IVA al mes',
  includedInvoices: 30,
  extraInvoicePrice: 1,
  trialWeeks: 2,
} as const;

/* ─────────────────────── El hilo del hero ───────────────────────
   Las cuatro paradas que dibuja `HeroThread` bajo el título.

   NO es un resumen de `JOURNEY_STEPS`. El recorrido tiene siete pasos porque
   explica; el hilo tiene cuatro porque sólo señala, y cuatro es lo que se lee
   de un vistazo en una línea. Si se emparejan, el hero deja de ser un gesto y
   se vuelve un índice duplicado del recorrido — que es exactamente el defecto
   que se acaba de quitar del hero.

   Cinco paradas ya no caben en un teléfono sin romper la fila. */
export const HERO_THREAD: { id: string; label: string }[] = [
  { id: 'cita', label: 'Cita' },
  { id: 'expediente', label: 'Expediente' },
  { id: 'factura', label: 'Factura' },
  { id: 'dinero', label: 'Dinero' },
];

/** Una función del producto, tal como la ve el doctor en su panel. */
export interface Feature {
  /** PermissionKey real — ver permissions.ts. */
  permissionKey: string;
  /** Etiqueta idéntica a la del sidebar del panel (PERMISSION_LABELS). */
  label: string;
  /** Qué hace, en una frase de doctor (no de ingeniero). */
  blurb: string;
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
  /**
   * Las secciones REALES del panel del doctor que cubre esta capacidad.
   * Puede ir VACÍO: `informe` no tiene permiso propio —vive dentro del
   * expediente—, y duplicar aquí la key `expedientes` la contaría dos veces.
   * Una capacidad sin features se pinta a ancho completo, sin la tarjeta del
   * panel.
   */
  features: Feature[];
  /**
   * Color de la capacidad. Tiñe ÚNICAMENTE la pastilla de su icono: el fondo
   * lo pone el campo continuo de la página (`.velvet-field`), no la sección.
   * Es la última isla de identidad por capacidad, y es lo que deja distinguir
   * agenda de dinero de un vistazo.
   *
   * Sigue sin tocar texto: el ámbar y el cian no dan contraste AA sobre claro.
   */
  accent: string;
}

/* ──────────────────────── El recorrido ────────────────────────
   La sección de más peso de la página, y la única que cuenta el producto
   como un HILO y no como un catálogo. Antes esto no existía: la promesa
   («captúralo una vez») estaba repartida en tres bandas que nunca se
   tocaban —agenda decía que el paciente agenda solo, dinero decía que el
   cobro se registra solo, fiscal decía que la factura sale de la cita— y
   armar el circuito quedaba de tarea del doctor.

   Cada paso es algo que el producto hace HOY. Lo que aún no existe
   (WhatsApp) se queda en el bloque «Muy pronto» de su capacidad: un
   recorrido que mezcla lo real con lo prometido deja de ser creíble. */
export const JOURNEY_STEPS: { n: number; title: string; text: string }[] = [
  {
    n: 1,
    title: 'Se crea la cita',
    text: 'El paciente agenda solo desde tu perfil público, o la creas tú en segundos. Ahí mismo marcas si va a necesitar factura.',
  },
  {
    n: 2,
    title: 'Nace su expediente',
    text: 'Si es paciente nuevo, su expediente se crea ligado a esa cita. No lo abres aparte ni lo buscas después.',
  },
  {
    n: 3,
    title: 'Documentas la consulta',
    text: 'Nota escrita o dictada por voz, receta con tu formato y tu firma, estudios y archivos adjuntos. Todo cuelga del mismo paciente, en su línea de tiempo.',
  },
  {
    n: 4,
    title: 'Sus datos fiscales, una sola vez',
    text: 'Le mandas un link, el paciente llena sus datos fiscales él mismo y quedan guardados en su expediente. Tú no capturas un solo RFC.',
  },
  {
    n: 5,
    title: 'Facturas en un clic',
    text: 'Desde el expediente, la cita ya trae su liga de facturación. Clic, revisas la factura ya armada, clic, timbrada.',
  },
  {
    n: 6,
    title: 'Le cobras por donde quieras',
    text: 'Le generas un link de pago con tu propia cuenta de Mercado Pago o de Stripe y lo cobras con tarjeta, transferencia o SPEI. En cuanto el paciente paga, el cobro entra solo. O lo registras en efectivo si te pagó en el consultorio.',
  },
  {
    n: 7,
    title: 'Todo aterriza en tu flujo de dinero',
    text: 'El cobro y la factura quedan agregados a ese paciente. Siempre sabes cuánto entró, de dónde y de quién.',
  },
];

/** El cierre del recorrido: la vuelta es lo que hace que valga la pena. */
export const JOURNEY_LOOP = {
  title: 'La siguiente consulta',
  text: 'Los pasos 2 y 4 ya no existen: el expediente está ahí y sus datos fiscales también. Terminas la consulta, cobras y facturas en un clic.',
};

/* ──────────────────── La promesa del dinero ────────────────────
   Vivía como el quinto bullet de la banda `dinero`, donde nadie lo leía.
   Es de las dos o tres cosas que de verdad frenan a un doctor que va a
   meter su consultorio a un software, así que sube a franja propia justo
   después del recorrido. NO lleva `id` de navegación: no es una capacidad
   y meterla al carrusel diluiría los destinos reales. */
export const MONEY_PROMISE = {
  title: 'Tu dinero va de tu paciente a tu cuenta. Punto.',
  body: 'Conectas tu propia cuenta de Mercado Pago o de Stripe. El pago viaja directo de tu paciente a esa cuenta: nosotros no lo tocamos, no lo retenemos y no dependes de que te lo depositemos después. No hay comisión nuestra sobre lo que cobras, ni saldo que esperar, ni corte que perseguir.',
  footer: `Nuestro cobro es uno solo y es el de la plataforma: $${PRICING.amount} + IVA al mes.`,
};

/* ────────────────────────── Capacidades ──────────────────────────
   El ORDEN es el argumento. Sigue al recorrido —agenda, expediente,
   informe, facturación, dinero— y sólo después vienen las capacidades
   que cruzan todo (asistente), las que traen pacientes (presencia) y las
   que miden (reportes). La administración fiscal avanzada va al final: es
   real y es fuerte, pero es de quien la necesita, y en medio del hilo
   rompía la narrativa. */
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
      'Que el paciente te diga por WhatsApp si va a necesitar factura, sin que se lo preguntes.',
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
  /**
   * El informe médico NO tiene permiso propio: vive dentro del expediente
   * (`/dashboard/medical-records/patients/[id]/informe`), así que `features`
   * va vacío a propósito y la banda se pinta a ancho completo. Repetir aquí
   * la key `expedientes` la contaría dos veces en `ALL_FEATURES`.
   */
  {
    id: 'informe',
    accent: '#0EA5E9',
    eyebrow: 'Informe médico',
    title: 'El informe de la aseguradora, sin volver a escribir el caso',
    lead: 'Tus pacientes asegurados necesitan un informe en el formato exacto de su aseguradora. Ese informe ya está en tu expediente — sólo hay que vaciarlo. Aquí se llena solo, con lo que ya documentaste.',
    bullets: [
      'El formato oficial de cada aseguradora — AXA, Allianz y GNP — tal cual lo piden, no una aproximación.',
      'Se llena con IA a partir del expediente del paciente: sus consultas, sus notas, sus diagnósticos. No vuelves a escribir lo que ya escribiste.',
      'También puedes dictarlo por voz y dejar que se acomode solo en los campos del formato.',
      'Todo es editable antes de firmar: tú revisas y corriges lo que quieras, campo por campo.',
      'Sale en PDF con el formato de la aseguradora, listo para entregar o enviar.',
    ],
    features: [],
  },
  {
    id: 'facturacion',
    accent: '#F59E0B',
    eyebrow: 'Facturación',
    title: 'Facturar deja de ser un trámite aparte',
    lead: 'La factura sale de la cita que la originó, con los datos fiscales que el paciente llenó una sola vez. Tú revisas y timbras.',
    bullets: [
      'Facturación CFDI con tu propio sello (CSD), armada desde la cita que la origina — con los datos fiscales que el paciente ya llenó una sola vez.',
      'Le mandas al paciente un link para que capture él mismo su RFC, su razón social y su uso de CFDI. Quedan guardados en su expediente para siempre.',
      'Desde el expediente ves qué citas están facturadas y cuáles no, sin cruzar listas a mano.',
      'El PDF y el XML quedan guardados y se los envías al paciente desde ahí mismo.',
      'Cada factura timbrada entra sola a tu flujo de dinero, agregada a ese paciente.',
    ],
    features: [
      {
        permissionKey: 'facturacion',
        label: 'Facturación',
        blurb: 'CFDI con tu sello, desde la cita.',
      },
    ],
  },
  {
    id: 'dinero',
    accent: '#EAB308',
    eyebrow: 'Dinero',
    title: 'Saber cuánto entró y cuánto salió',
    lead: 'Todo el dinero de tu consultorio cae en un mismo tablero. Lo que cobras en la consulta, lo que te pagan en línea y lo que bajas del SAT llegan solos; lo demás lo agregas tú.',
    bullets: [
      'Un solo tablero de ingresos y egresos: aquí aterriza todo lo que se mueve en tu consultorio, venga de donde venga.',
      'Terminas una cita y lo que cobraste por ella se registra solo, con el precio del servicio que ya venía de tu agenda — sin capturarlo dos veces.',
      'Conectas tu cuenta de Mercado Pago o de Stripe y generas links de cobro: tu paciente paga con tarjeta de crédito o débito, transferencia o SPEI —según la cuenta que conectes— y el cobro entra solo en cuanto se paga.',
      'Los CFDI que bajas del SAT también entran solos: lo que facturaste como ingreso y lo que te facturaron como gasto.',
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
      'Incluido, no como un extra que se paga aparte.',
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
  /**
   * Reportes mide la agenda, el expediente y el dinero, así que sólo tiene
   * sentido después de haberlos contado.
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
  /**
   * Va AL FINAL: está incluido como todo lo demás, pero es de quien lo
   * necesita. En medio del recorrido rompía el hilo cita → factura → dinero.
   */
  {
    id: 'fiscal',
    accent: '#78716C',
    eyebrow: 'Administración fiscal',
    title: 'La parte que nadie quiere hacer',
    lead: 'Bajar del SAT todo lo que se facturó a tu nombre, cuadrarlo contra tu banco y tener listo cada mes el resumen que tu contador necesita.',
    bullets: [
      'Descarga automática de tus CFDI emitidos y recibidos, directo del SAT: tus ingresos y tus gastos con respaldo, sin capturar nada a mano.',
      'Cada mes se arma solo un resumen de todo lo que facturaste y todo lo que te facturaron — se lo mandas a tu contador y hace la declaración sin perseguirte.',
      'Sabes cómo vas con el SAT durante el mes, no cuando ya toca declarar.',
      'Conciliación bancaria: subes el estado de cuenta y lo cruzas contra lo registrado.',
      'Ventas, compras, cotizaciones y catálogo de productos y servicios.',
    ],
    features: [
      {
        permissionKey: 'sat',
        label: 'Descarga SAT',
        blurb: 'Tus comprobantes emitidos y recibidos.',
      },
      {
        permissionKey: 'conciliacion',
        label: 'Conciliación Bancaria',
        blurb: 'El estado de cuenta contra tus registros.',
      },
      {
        permissionKey: 'ventas',
        label: 'Ventas',
        blurb: 'Ventas, cotizaciones y clientes.',
      },
      {
        permissionKey: 'compras',
        label: 'Compras',
        blurb: 'Compras y proveedores.',
      },
      {
        permissionKey: 'productos',
        label: 'Productos y Servicios',
        blurb: 'Tu catálogo, con precios.',
      },
    ],
  },
];

/** Todas las funciones, aplanadas — el orden es el de las bandas. */
export const ALL_FEATURES: Feature[] = CAPABILITY_GROUPS.flatMap((g) => g.features);

/**
 * Hechos de plataforma: ciertos para TODO el producto, así que no caben en
 * ninguna banda de capacidad. Van en una tira compacta justo antes del
 * precio, que es donde el doctor se pregunta «¿y esto cómo lo uso a diario?».
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
 *
 * Las tres preguntas de planes («¿el asistente está en los dos planes?»,
 * «¿necesito facturar para usarla?», «¿puedo cambiar de plan?») se borraron
 * el 2026-08-17: se quedaron sin sujeto al pasar a un solo plan.
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
    q: '¿Cómo funciona la prueba gratis?',
    a: `Son ${PRICING.trialWeeks} semanas con todo incluido, sin tarjeta. Al terminar decides si sigues; tu información no se borra si te tomas unos días para pensarlo.`,
  },
  {
    q: `¿Qué pasa si necesito más de ${PRICING.includedInvoices} facturas al mes?`,
    a: `Nada se detiene. Las facturas de más se timbran normal y se cobran a $${PRICING.extraInvoicePrice} + IVA cada una en tu recibo del mes siguiente. Sólo pagas por las que realmente usaste.`,
  },
  {
    q: '¿Hay costos de instalación o de contrato?',
    a: `No. Es una sola cuota mensual de $${PRICING.amount} + IVA. No hay implementación que pagar, ni permanencia mínima, ni módulos que se cobren aparte.`,
  },
  {
    q: '¿Tengo que instalar algo?',
    a: 'No. Vive en la nube y se usa desde el navegador, así que entras igual desde la computadora del consultorio, tu laptop o tu celular. En el teléfono puedes instalarla desde el mismo navegador y queda como una app más.',
  },
  {
    q: '¿Puede entrar alguien más de mi consultorio?',
    a: 'Sí. Además de la tuya hay una segunda cuenta, con su propio acceso, para quien te apoya — no le prestas tu contraseña. Desde tu cuenta decides función por función qué puede ver y qué puede hacer: tu agenda sí, tu expediente no, por ejemplo.',
  },
  {
    q: '¿Mis pacientes tienen que descargar algo?',
    a: 'No. Agendan desde tu perfil público en el navegador, reciben sus recordatorios por correo y contestan desde ahí los formularios que les mandes antes de la consulta.',
  },
];
