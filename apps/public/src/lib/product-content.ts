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

   El hilo y `JOURNEY_STEPS` tienen HOY las dos cuatro entradas, y eso es
   deliberado, no un descuido: son las cuatro cosas que genera un paciente
   —cita, expediente, factura, ingreso— y el argumento entero de la página es
   que son las mismas cuatro. El hero las NOMBRA en una línea; el recorrido
   las EXPLICA en tarjetas. Lo que no puede pasar es que el hilo empiece a
   explicar: en cuanto una pastilla lleve una frase, deja de ser un gesto y
   se vuelve un índice duplicado del recorrido.

   (Estuvieron desparejos: el recorrido tenía siete pasos hasta el
   2026-08-17. Que ahora coincidan es la corrección, no la coincidencia.)

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

/**
 * El clip de una capacidad: unos segundos del panel REAL, en silencio y en
 * bucle, bajo la prosa que acaba de describirlos.
 *
 * ⚠️ ESTO AFIRMA UN HECHO. Un clip dice «así se ve el producto», y a diferencia
 * de un bullet, envejece SOLO: el día que la pantalla cambie, la página seguirá
 * enseñando la vieja sin que nada se ponga rojo. Por eso `recordedAt` es
 * obligatorio y va aquí, en los datos: es lo único que deja ver de un vistazo
 * cuál toca regrabar.
 *
 * ⚠️ NADA DE DATOS REALES. Se graba en una cuenta de demostración, con
 * pacientes inventados. Un paciente real en un video público no es un bug de
 * maquetación, es una fuga de datos personales (LFPDPPP) que además queda
 * cacheada fuera de nuestro alcance.
 *
 * ⚠️ NI ASISTENTE NI FISCAL EN CUADRO. El 2026-08-18 se dejaron de vender esas
 * dos capacidades en esta página; un clip que enseñe el sidebar completo las
 * vuelve a anunciar por la puerta de atrás.
 *
 * Los tres archivos comparten nombre a propósito (`base`): así no pueden
 * quedar el mp4 de una toma y el póster de otra.
 */
export interface CapabilityClip {
  /** Nombre base en `/public/clips`: se sirven `<base>.mp4`, `.webm` y `.webp`. */
  base: string;
  /** Tamaño REAL del archivo. Va al markup para que la caja no salte al cargar. */
  width: number;
  height: number;
  /** Qué se ve, para quien no puede verlo. No es un pie de foto decorativo. */
  alt: string;
  /** Cuándo se grabó (YYYY-MM-DD). Ver la advertencia de arriba. */
  recordedAt: string;
}

export interface CapabilityGroup {
  id: string;
  eyebrow: string;
  title: string;
  /**
   * La descripcion, en PROSA CORRIDA: un parrafo por entrada. No es una lista
   * disfrazada: cuenta como se usa la capacidad, encadenando una cosa con la
   * siguiente. Las funciones sueltas van en `bullets`, que es lo que se pinta
   * en la tarjeta de al lado.
   *
   * Era `string` (una sola frase) hasta el 2026-08-17. Se volvio lista de
   * parrafos cuando la banda paso a texto-de-un-lado / tarjeta-del-otro: con
   * una frase, la columna de texto quedaba vacia junto a una tarjeta de once
   * bullets.
   */
  lead: string[];
  /**
   * Las funciones concretas, todas verificables en el producto de HOY. Es lo
   * que se pinta en la tarjeta blanca. Lo que aun no existe va en `soon`,
   * nunca aqui.
   */
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
   * El clip de la capacidad, si lo tiene. OPCIONAL a propósito: vale más
   * enseñar tres bandas con una toma buena que siete con relleno, y una banda
   * sin clip se pinta hoy exactamente como se pintaba ayer.
   *
   * Va al PIE de la columna de texto, nunca dentro de la tarjeta: la tarjeta
   * es el inventario, y el 2026-08-17 se le quitó el mockup justamente para
   * que dejara de disfrazarse de pantalla.
   */
  clip?: CapabilityClip;
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

   ⚠️ EL EJE NO ES «DE LA CITA A LA FACTURA». Así se escribió primero y está
   mal: pone la factura de destino del producto cuando es UNA de las cuatro
   cosas que genera un paciente —cita, expediente, factura e ingreso—, no la
   meta. El argumento es que las cuatro viven en el mismo lugar y cada una
   sale de la anterior. Si alguien vuelve a titular esto «de la cita a la
   factura», está reintroduciendo el error, no acortando la frase.

   PASARON DE SIETE PASOS A CUATRO el 2026-08-17. Los tres que se fueron no
   se perdieron, se movieron a la capacidad que ya los contaba mejor: los
   datos fiscales y el envío del CFDI viven en `facturacion` (dos bullets),
   y el cobro con links de Mercado Pago/Stripe, el efectivo y el registro
   automático del ingreso viven en `dinero` (tres bullets). Un recorrido de
   siete pasos ya no era un hilo: era el catálogo otra vez, sólo que
   numerado. Antes de agregar un paso aquí, comprueba que la capacidad
   correspondiente no lo diga ya.

   Cada paso es algo que el producto hace HOY. Lo que aún no existe
   (WhatsApp) se queda en el bloque «Muy pronto» de su capacidad: un
   recorrido que mezcla lo real con lo prometido deja de ser creíble. */
export const JOURNEY_INTRO = {
  title: 'Citas, expedientes, facturas e ingresos, en el mismo lugar',
  lead: 'Cada paciente genera una cita, un expediente, una factura y un ingreso. Aquí cada uno sale del anterior: no los capturas por separado.',
};

export const JOURNEY_STEPS: { n: number; title: string; text: string }[] = [
  {
    n: 1,
    title: 'Se genera la cita',
    text: 'El paciente la reserva desde tu página web personalizada, o la registras tú desde el sistema. En los dos casos entra a la misma agenda.',
  },
  {
    n: 2,
    title: 'Se abre su expediente',
    text: 'Si es paciente nuevo, el expediente se crea desde la cita. Si ya lo tenías, la cita se adjunta al expediente que ya existe.',
  },
  {
    n: 3,
    title: 'Desde el expediente trabajas la consulta',
    text: 'Consultas con tus propios formatos, recetas personalizadas con tu firma, notas dictadas por voz y los documentos que necesites adjuntar: estudios, PDFs, imágenes. Todo queda guardado en ese paciente.',
  },
  {
    n: 4,
    title: 'Y desde ahí, la factura',
    text: 'Un clic. Sale con los datos fiscales que el paciente llenó él mismo desde un link, y se le envía por correo.',
  },
];

/* El remate del recorrido, en oscuro y aparte de los cuatro pasos.

   ANTES ERA UNA VUELTA (`JOURNEY_LOOP`): decía que en la segunda consulta
   los pasos 2 y 4 ya no existen. Buen argumento, pero se apoyaba en un paso
   4 que era «sus datos fiscales» y hoy ya no existe — se habría quedado
   señalando un número equivocado. Ahora cierra en vez de dar la vuelta: los
   cuatro pasos terminan en un solo estado. */
export const JOURNEY_CLOSE = {
  title: 'Y con eso queda cerrado',
  text: 'La cita cerrada, tu paciente actualizado y el ingreso registrado en tu flujo. Sin capturar lo mismo cuatro veces.',
};

/* `MONEY_PROMISE` («Tu dinero va de tu paciente a tu cuenta. Punto.») se
   BORRÓ el 2026-08-17. Era la tercera copia del mismo hecho: lo dice la
   primera pregunta del FAQ y lo dice la nota bajo el precio. No se perdió
   nada al quitarla; lo que se quitó fue una franja que repetía. */

/* ────────────────────────── Capacidades ──────────────────────────
   El ORDEN es el argumento. Sigue al recorrido —agenda, expediente,
   informe, facturación, dinero— y sólo después vienen las que traen
   pacientes (presencia) y las que miden (reportes).

   Dos bandas se BORRARON el 2026-08-18 por petición del usuario:
   `asistente` (el agente de IA, junto con su mención en la prosa del
   precio) y `fiscal` (la administración fiscal avanzada: descarga SAT,
   conciliación bancaria, ventas, compras y catálogo de productos). Sus
   permisos —`asistente_ia`, `sat`, `conciliacion`, `ventas`, `compras`,
   `productos`— siguen vivos en el producto; lo que se quitó es
   venderlo en esta página. */
export const CAPABILITY_GROUPS: CapabilityGroup[] = [
  {
    id: 'agenda',
    accent: '#3B82F6',
    eyebrow: 'Agenda',
    title: 'Todo empieza en la cita',
    lead: [
      'Creas la cita desde el sistema, o la reserva el paciente desde tu página web con los horarios y los servicios que tú definiste.',
      'Puedes administrar la agenda confirmando, reagendando o cancelando la cita, todo en un mismo lugar, y enviar confirmaciones al correo o al WhatsApp del paciente.',
      'Puedes crear expedientes nuevos para pacientes nuevos, o adjuntar expedientes ya creados de pacientes recurrentes.',
    ],
    bullets: [
      'Citas creadas por ti desde el sistema, o reservadas por el paciente desde tu página web con los horarios y servicios que tú defines.',
      'Confirmación por correo en automático al crearse la cita, y recordatorios con la anticipación que elijas.',
      'Confirmación por WhatsApp con un toque: se abre el chat del paciente con el mensaje ya escrito y tú lo mandas.',
      'Reprogramar, cancelar o confirmar sin perder el historial de la cita.',
      'Desde la cita creas un expediente nuevo, o adjuntas un expediente ya creado al paciente recurrente.',
      'Crea formatos personalizados a tu necesidad para enviar a los pacientes y recabar la información necesaria relativa a tu consulta. Puedes crear formatos ilimitados.',
      'Envía los formatos por WhatsApp, por correo o como una liga que le pasas al paciente.',
      'Pídele a tus pacientes sus datos fiscales con un formato especial: se cargan solos en su expediente una única vez. De ahí en adelante, facturar es tan fácil como un clic.',
      'Desde la cita generas un link de cobro con tu cuenta de Mercado Pago o de Stripe: tu paciente paga con tarjeta de crédito o débito, transferencia o SPEI —según la cuenta que conectes— y el cobro entra solo en cuanto se paga.',
      'Conecta y actualiza tu agenda con Google Calendar.',
      'También puedes conectar la aplicación con Telegram para recibir notificaciones en tu celular todos los días, de tu agenda y de tus citas próximas.',
    ],
    /* ⚠️ WHATSAPP: hoy es un enlace `wa.me`, NO una API. El doctor toca el
       botón, se abre WhatsApp con el mensaje ya escrito y él le da enviar;
       nada de nuestro lado se entera de que se mandó (ver el comentario de
       `BookingActions.tsx`, donde está medido). Por eso los bullets de arriba
       dicen «con un toque» y NUNCA «automático».

       El bloque `soon` de esta capacidad (recordatorios y confirmación por
       WhatsApp saliendo solos) se borró el 2026-08-18 por petición del
       usuario. El campo `soon?` sigue existiendo en el tipo y la página lo
       sigue pintando; hoy no lo usa nadie. */
    clip: {
      base: 'agenda',
      /* Medidas REALES del archivo entregado (1866×832 de origen, escalado a
         1100 de ancho). Si se regraba con otro encuadre, esto cambia: lo
         imprime `make-clip.mjs` al terminar y se copia tal cual. */
      width: 1100,
      height: 490,
      recordedAt: '2026-08-18',
      alt:
        'La pantalla de citas: la cita de Guillermo Iturbe Sáenz, consulta de ' +
        'cardiología en Consultorio Polanco, se abre y muestra su precio, su ' +
        'horario y las acciones para completarla, reagendarla o cancelarla; ' +
        'debajo, el mes completo con las citas repartidas por día.',
    },
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
    lead: [
      'Historia clínica, notas y recetas en un mismo lugar — en regla con lo que piden las instituciones, y en tus propios formatos.'
    ],
    bullets: [
      'Expediente conforme a la NOM-004 y la NOM-024, con su aviso de privacidad: lo que exigen las instituciones de gobierno.',
      'Plantillas ilimitadas para todo tipo de situaciones en tu consulta: primera vez, recurrente, operatorio, postoperatorio… defines y creas todo lo que tu consulta necesita.',
      'Crea formatos para recetas personalizadas a tu medida y a tus necesidades, con tu firma digital adjunta.',
      'Adjunta al expediente cualquier tipo de documento relativo a tu paciente —como los resultados de sus estudios— en distintos formatos: imagen o PDF.',
      'Ves en orden cronológico todas las acciones tomadas con el paciente: cuándo creaste la cita, cuándo vino a consulta, cuándo se adjuntó cierto estudio.',
      'Notas no estructuradas para el paciente, escritas o con dictado de voz.',
      'Un resumen del expediente completo del paciente, para que no tengas que leerlo todo — y que va sumando cada plantilla, receta o nota nueva que se crea.',
      'Las plantillas personalizadas de recetas y notas puedes llenarlas por voz, para un dictado más rápido y práctico.',
      'Una vez que tengas los datos fiscales de tu paciente viven para siempre en su expediente. Las citas, con su concepto, van generando las prefacturas: las revisas ahí mismo y las facturas con un solo clic.',
      'Todo esto lo exportas a PDF para enviárselo al paciente.',
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
   * va VACÍO a propósito. Repetir aquí la key `expedientes` sería afirmar que
   * el informe es una sección aparte del panel, y no lo es.
   *
   * Vacío ya no cambia el layout: hasta el 2026-08-17 esta banda se pintaba a
   * ancho completo porque la columna derecha era el mockup del panel y sin
   * `features` no había nada que poner. Ahora la tarjeta lleva los `bullets`
   * —que esta banda sí tiene—, y lo único que se cae es el renglón «En tu
   * panel» del pie.
   */
  {
    id: 'informe',
    accent: '#0EA5E9',
    eyebrow: 'Informe médico',
    title: 'El informe de la aseguradora, sin volver a escribir el caso',
    lead: [
      'Tus pacientes asegurados necesitan un informe en el formato exacto de su aseguradora. Ese informe ya está en tu expediente — sólo hay que vaciarlo. Aquí se llena solo, con lo que ya documentaste.'
    ],
    bullets: [
      'El formato oficial de cada aseguradora — AXA, Allianz y GNP.',
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
    lead: [
      'La factura sale de la cita que la originó, con los datos fiscales que el paciente llenó una sola vez. Tú revisas y timbras.'
    ],
    bullets: [
      'Facturación CFDI con tu propio sello (CSD), armada desde la cita que la origina — con los datos fiscales que el paciente ya llenó.',
      'Le mandas al paciente un link para que capture él mismo su RFC, su razón social y su uso de CFDI. Quedan guardados en su expediente para siempre.',
      'Desde el expediente ves qué citas están facturadas y cuáles no.',
      'El PDF y el XML quedan guardados y se los envías al paciente desde ahí mismo.',
      'Cada factura timbrada entra sola a tu flujo de dinero, agregada a ese paciente.',
      'Conéctate directo al SAT: todos los días descarga solo tus facturas emitidas y recibidas, para que tengas visión total de tus obligaciones.',
      `Cada mes van incluidas ${PRICING.includedInvoices} facturas timbradas. Las de más se timbran igual y se cobran a $${PRICING.extraInvoicePrice} + IVA cada una en tu recibo del mes siguiente — nunca se te detiene una factura.`,
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
    lead: [
      'Todo el dinero de tu consultorio en un mismo lugar.'
    ],
    bullets: [
      'Un solo tablero de ingresos y egresos: aquí aterriza todo lo que se mueve en tu consultorio, venga de donde venga.',
      'Terminas una cita y lo que cobraste por ella se registra solo, con el precio del servicio que ya venía de tu agenda — sin capturarlo dos veces.',
      'Un estado de resultados al día, para ver cómo va tu consulta y poder medirla como negocio.',
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
    id: 'presencia',
    accent: '#06B6D4',
    eyebrow: 'Presencia',
    title: 'Que te encuentren',
    /* Sin `lead` por petición del usuario (2026-08-18): esta banda es título
       + tarjeta. `lead` vacío está contemplado en el render de `page.tsx`. */
    lead: [],
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
    /* Sin `lead` por petición del usuario (2026-08-18): título + tarjeta. */
    lead: [],
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

/** Todas las funciones, aplanadas — el orden es el de las bandas. */

/**
 * Hechos de plataforma: ciertos para TODO el producto, así que no caben en
 * ninguna banda de capacidad. Desde el 2026-08-18 van DENTRO del hero, bajo
 * el hilo y sobre fondo navy — antes eran una tira clara entre las bandas y
 * el precio. Su estilo vive en `page.tsx` y está pintado para el oscuro.
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
