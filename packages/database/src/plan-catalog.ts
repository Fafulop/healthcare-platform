/**
 * CATÁLOGO DEL PLAN — lo que se le ANUNCIA al doctor en /dashboard/cuenta.
 *
 * Diseño: docs/DESDE JUNIO/TIERS/03-PLAN-cuenta-y-cobro.md §2/H1 y §3.5.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * 🔴 POR QUÉ ESTA LISTA SE ESCRIBE A MANO Y NO SE DERIVA DE TIER_EXCLUDED_KEYS
 *
 * Derivarla era lo primero que se propuso, y es incorrecto. `TIER_EXCLUDED_KEYS`
 * contesta "qué recorta el techo del plan"; una pantalla que ve el doctor
 * contesta "qué compro con mi dinero", y NO son la misma pregunta, porque en
 * este app conviven TRES sistemas de visibilidad independientes:
 *
 *   1. TIER_EXCLUDED_KEYS  (permissions.ts)   — lo que el PLAN no incluye
 *   2. ui-visibility.ts    (apps/doctor)      — lo que PRODUCTO decidió esconder
 *   3. ASISTENTE_IA_VISIBLE(agenda-agent)     — el panel 🟢, tapado para todos
 *
 * Con el contenido REAL de hoy, una lista derivada afirmaría cuatro cosas falsas
 * o absurdas: le vendería a un FREE el upgrade a "Conciliación Bancaria" (que
 * NADIE puede ver desde el 2026-08-27); le diría a un BÁSICO que sí la tiene
 * (su exclusión está diferida hasta que BASICO tenga evals propios); le diría a
 * un PRO que su plan "lo incluye todo" (el asistente está tapado por flag y
 * `asistente_ia` no se excluye en ningún tier hasta Q5, así que PRO y LAB salen
 * idénticos); y nunca mencionaría `whatsapp`, que al no estar en ninguna lista
 * se LEE como incluido — una función que no existe y depende de Meta.
 *
 * Es la misma clase de error que este repo ya pagó con el catálogo de campos del
 * informe médico: derivar QUÉ EXISTE no contesta QUÉ SE OFRECE.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * ENTONCES, ¿QUÉ IMPIDE QUE ESTA LISTA MIENTA?
 *
 * `pnpm gate:catalogo` (scripts/check-plan-catalog.ts). Escrita a mano,
 * verificada por máquina: el gate falla si una key que ALGÚN tier excluye no
 * tiene entrada aquí (se le cobra al doctor algo que no se le nombra), si una
 * entrada anunciable nombra una key que NINGÚN tier distingue (se anuncia como
 * diferencial algo que todos tienen), o si una entrada anunciable apunta a algo
 * que un flag de visibilidad tapa.
 *
 * AL AGREGAR UN TIER O UNA KEY: se agrega aquí su entrada. El gate te lo va a
 * exigir; no es opcional.
 */

import {
  TIER_EXCLUDED_KEYS,
  tierAllows,
  type DoctorTier,
  type TierKey,
} from './permissions';

/**
 * Por qué una función NO se le anuncia al doctor hoy. El motivo se guarda como
 * DATO (no como comentario) porque el gate lo lee: una entrada no anunciable
 * tiene que decir por qué, o la ausencia se vuelve indistinguible de un olvido.
 */
export interface MotivoNoAnunciable {
  /** Texto corto para quien lea el archivo o la salida del gate. */
  razon: string;
  /** El flag/condición que hay que quitar para que vuelva a anunciarse. */
  desbloqueaCuando: string;
}

export interface EntradaCatalogo {
  /** Id estable de la LÍNEA de producto (no de la key: una línea puede cubrir varias). */
  id: string;
  /**
   * Las keys de tier que componen esta línea. Varias cuando el doctor las vive
   * como UNA sola función (ventas/compras/productos = "el módulo de negocio").
   * La línea se considera incluida sólo si el plan permite TODAS.
   */
  keys: readonly TierKey[];
  /** Grupo con el que se agrupa en la pantalla. */
  grupo: GrupoCatalogo;
  /** Título que lee el doctor. NO es PERMISSION_LABELS: ése es vocabulario de toggles. */
  titulo: string;
  /** Una línea de qué hace, en palabras del doctor. */
  descripcion: string;
  /** `null` ⇒ se anuncia. Un motivo ⇒ existe en el vocabulario pero NO se pinta. */
  noAnunciable: MotivoNoAnunciable | null;
}

export const GRUPOS_CATALOGO = ['consultorio', 'clinico', 'dinero', 'ia', 'soporte'] as const;
export type GrupoCatalogo = (typeof GRUPOS_CATALOGO)[number];

export const GRUPO_LABELS: Record<GrupoCatalogo, string> = {
  consultorio: 'Tu consultorio en línea',
  clinico: 'Día a día con pacientes',
  dinero: 'Dinero y administración',
  ia: 'Inteligencia artificial',
  soporte: 'Soporte',
};

/**
 * El catálogo. El ORDEN es el orden en que se pinta dentro de cada grupo.
 *
 * Las cuatro líneas que HOY distinguen un plan de otro son `facturacion`,
 * `sat` e `ia` (y nada más): son las únicas keys que algún tier excluye. El
 * resto se anuncia para que el doctor vea lo que sí tiene —que es la mayor
 * parte del producto— y no sólo lo que le falta.
 */
export const PLAN_CATALOG: readonly EntradaCatalogo[] = [
  // ── Tu consultorio en línea ────────────────────────────────────────────────
  {
    id: 'perfil',
    keys: ['perfil', 'perfil_publico'],
    grupo: 'consultorio',
    titulo: 'Perfil y página pública',
    descripcion:
      'Tu página de doctor en internet, con tus datos, tus servicios y el botón para agendar.',
    noAnunciable: null,
  },
  {
    id: 'contenido',
    keys: ['contenido'],
    grupo: 'consultorio',
    titulo: 'Contenido audiovisual',
    descripcion: 'Fotos y videos de tu consultorio en tu página pública.',
    noAnunciable: null,
  },
  {
    id: 'blog',
    keys: ['blog'],
    grupo: 'consultorio',
    titulo: 'Mi blog',
    descripcion: 'Publica artículos para que tus pacientes te encuentren en Google.',
    noAnunciable: null,
  },

  // ── Día a día con pacientes ───────────────────────────────────────────────
  {
    id: 'citas',
    keys: ['citas'],
    grupo: 'clinico',
    titulo: 'Agenda y citas',
    descripcion:
      'Calendario, horarios, confirmaciones y el formulario con el que tus pacientes agendan solos.',
    noAnunciable: null,
  },
  {
    id: 'expedientes',
    keys: ['expedientes'],
    grupo: 'clinico',
    titulo: 'Expedientes médicos',
    descripcion: 'Historia clínica, consultas, recetas, estudios e informes para aseguradoras.',
    noAnunciable: null,
  },
  {
    id: 'notas',
    keys: ['notas'],
    grupo: 'clinico',
    titulo: 'Notas',
    descripcion: 'Tus apuntes personales y los de cada paciente, organizados por tema.',
    noAnunciable: null,
  },
  {
    id: 'tareas',
    keys: ['tareas'],
    grupo: 'clinico',
    titulo: 'Tareas',
    descripcion: 'Pendientes tuyos y de tu equipo, con fecha y responsable.',
    noAnunciable: null,
  },
  {
    id: 'reportes',
    keys: ['reportes'],
    grupo: 'clinico',
    titulo: 'Reportes',
    descripcion: 'Cómo va tu consultorio: citas, pacientes nuevos e ingresos, mes con mes.',
    noAnunciable: null,
  },

  // ── Dinero y administración ───────────────────────────────────────────────
  {
    id: 'flujo',
    keys: ['flujo'],
    grupo: 'dinero',
    titulo: 'Flujo de dinero',
    descripcion: 'Ingresos y egresos de tu consultorio, con el precio de cada cita ya cargado.',
    noAnunciable: null,
  },
  {
    id: 'pagos',
    keys: ['pagos'],
    grupo: 'dinero',
    titulo: 'Cobro a pacientes',
    descripcion: 'Links de pago con tarjeta por Stripe o Mercado Pago, cobrados a tu cuenta.',
    noAnunciable: null,
  },
  {
    id: 'negocio',
    keys: ['ventas', 'compras', 'productos'],
    grupo: 'dinero',
    titulo: 'Ventas, compras e inventario',
    descripcion:
      'Cotizaciones, ventas, compras a proveedores y el catálogo de productos y servicios.',
    noAnunciable: null,
  },
  {
    id: 'facturacion',
    keys: ['facturacion'],
    grupo: 'dinero',
    titulo: 'Facturación (CFDI)',
    descripcion: 'Emite facturas timbradas ante el SAT con tu propio sello digital.',
    noAnunciable: null,
  },
  {
    id: 'sat',
    keys: ['sat'],
    grupo: 'dinero',
    titulo: 'Descarga SAT',
    descripcion:
      'Baja automáticamente tus facturas emitidas y recibidas directo del portal del SAT.',
    noAnunciable: null,
  },
  {
    id: 'conciliacion',
    keys: ['conciliacion'],
    grupo: 'dinero',
    titulo: 'Conciliación bancaria',
    descripcion: 'Cruza tu estado de cuenta contra tus movimientos registrados.',
    // Anunciarla sería vender una puerta tapiada: la sección está oculta para
    // TODAS las cuentas, no sólo para las que no la tienen en su plan.
    noAnunciable: {
      razon: 'La sección está oculta para todas las cuentas desde el 2026-08-27.',
      desbloqueaCuando:
        'CONCILIACION_BANCARIA_VISIBLE = true en apps/doctor/src/lib/ui-visibility.ts',
    },
  },

  // ── Inteligencia artificial ───────────────────────────────────────────────
  {
    id: 'ia',
    keys: ['ia'],
    grupo: 'ia',
    titulo: 'Funciones de inteligencia artificial',
    descripcion:
      'Dictado por voz de consultas y notas, y los chats de ayuda dentro de cada pantalla.',
    noAnunciable: null,
  },
  {
    id: 'asistente_ia',
    keys: ['asistente_ia'],
    grupo: 'ia',
    titulo: 'Asistente unificado',
    descripcion: 'El panel que agenda, factura y consulta tu información hablando con él.',
    noAnunciable: {
      razon: 'El panel está tapado por feature flag para todas las cuentas.',
      desbloqueaCuando:
        'Q5: retirar ASISTENTE_IA_VISIBLE y excluir `asistente_ia` en FREE/BASICO/PRO',
    },
  },
  {
    id: 'whatsapp',
    keys: ['whatsapp'],
    grupo: 'ia',
    titulo: 'WhatsApp a pacientes',
    descripcion: 'Confirmaciones, recordatorios y mensajes automáticos por WhatsApp.',
    noAnunciable: {
      razon: 'No existe: no hay ninguna ruta de WhatsApp todavía.',
      desbloqueaCuando: 'Meta apruebe la cuenta de Tech Provider y existan las rutas',
    },
  },

  // ── Soporte ───────────────────────────────────────────────────────────────
  {
    id: 'ayuda',
    keys: ['ayuda'],
    grupo: 'soporte',
    titulo: 'Guías de uso',
    descripcion: 'Las guías paso a paso de cada sección, dentro de la app.',
    noAnunciable: null,
  },
];

/** Lo que se PINTA: las entradas anunciables, en orden de grupo. */
export function catalogoAnunciable(): EntradaCatalogo[] {
  return GRUPOS_CATALOGO.flatMap((g) =>
    PLAN_CATALOG.filter((e) => e.noAnunciable === null && e.grupo === g),
  );
}

/**
 * ¿El plan incluye esta línea? TODAS sus keys tienen que estar permitidas.
 *
 * El `every` no es cosmético: una línea como "Ventas, compras e inventario"
 * cubre tres keys, y un tier futuro podría recortar sólo una. Decir "incluido"
 * entonces sería mentir en la dirección cara (el doctor descubre el candado
 * después de pagar), así que la línea se marca como NO incluida y el detalle se
 * resuelve cuando ese tier exista.
 */
export function planIncluye(tier: string | null | undefined, entrada: EntradaCatalogo): boolean {
  return entrada.keys.every((k) => tierAllows(tier, k));
}

/** Las keys que ALGÚN tier excluye — lo que de verdad distingue un plan de otro. */
export function keysQueDistinguenPlanes(): TierKey[] {
  const set = new Set<TierKey>();
  for (const tier of Object.keys(TIER_EXCLUDED_KEYS) as DoctorTier[]) {
    for (const k of TIER_EXCLUDED_KEYS[tier]) set.add(k);
  }
  return [...set];
}
