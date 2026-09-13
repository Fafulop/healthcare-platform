/**
 * Permission registry for secondary users (NUEVOS USUARIOS).
 *
 * SINGLE SOURCE OF TRUTH — the four consumers (doctor-app sidebar, Equipo
 * dialog, API route→toggle map, agent module mapping) must all derive from
 * this file. Never duplicate the key list.
 *
 * Design: docs/DESDE JUNIO/NUEVOS USUARIOS/01-DISENO-tecnico.md §2
 */

export const PERMISSION_KEYS = [
  'perfil',          // Editar Perfil (Equipo/Integraciones/Receta PDF stay owner-only regardless)
  'perfil_publico',  // external link to the public site
  'contenido',       // Contenido Audiovisual
  'blog',            // Mi Blog
  'citas',           // Mis Citas
  'expedientes',     // Expedientes Médicos (receta ISSUING stays owner-only regardless)
  'tareas',          // Tareas (routes live under /api/medical-records/tasks — specific prefix wins)
  'notas',           // Notas
  'reportes',        // Reportes (analytics + llm-usage)
  'flujo',           // Flujo de Dinero (ledger)
  'pagos',           // Pagos (stripe + mercadopago)
  'facturacion',     // Facturación (CFDI emission with the doctor's CSD IS allowed)
  'sat',             // Descarga SAT
  'conciliacion',    // Conciliación Bancaria (incl. bank-statement import/parse)
  'ventas',          // Ventas (+ cotizaciones, clients)
  'compras',         // Compras (+ proveedores)
  'productos',       // Productos y Servicios (+ product-attributes, areas)
  'ayuda',           // Ayuda
  'asistente_ia',    // master switch for the agent panel (modules filter on top, see agent mapping)
] as const;

export type PermissionKey = (typeof PERMISSION_KEYS)[number];

/** Shape stored in doctor_members.permissions / member_invites.permissions. */
export type PermissionSet = Partial<Record<PermissionKey, boolean>>;

/** Human labels for the Equipo tab toggle list — the ONE place UI copy for a
 * toggle lives, so it never drifts from the sidebar label it corresponds to. */
export const PERMISSION_LABELS: Record<PermissionKey, string> = {
  perfil: 'Editar Perfil',
  perfil_publico: 'Perfil Público',
  contenido: 'Contenido Audiovisual',
  blog: 'Mi Blog',
  citas: 'Mis Citas',
  expedientes: 'Expedientes Médicos',
  tareas: 'Tareas',
  notas: 'Notas',
  reportes: 'Reportes',
  flujo: 'Flujo de Dinero',
  pagos: 'Pagos',
  facturacion: 'Facturación',
  sat: 'Descarga SAT',
  conciliacion: 'Conciliación Bancaria',
  ventas: 'Ventas',
  compras: 'Compras',
  productos: 'Productos y Servicios',
  ayuda: 'Ayuda',
  asistente_ia: 'Asistente IA',
};

/** Safe defaults prefilling the invite dialog: agenda/organización/ayuda ON,
 * clinical + money + profile + AI OFF. */
export const INVITE_DEFAULTS: Record<PermissionKey, boolean> = {
  perfil: false,
  perfil_publico: false,
  contenido: false,
  blog: false,
  citas: true,
  expedientes: false,
  tareas: true,
  notas: true,
  reportes: false,
  flujo: false,
  pagos: false,
  facturacion: false,
  sat: false,
  conciliacion: false,
  ventas: false,
  compras: false,
  productos: false,
  ayuda: true,
  asistente_ia: false,
};

/**
 * Which permission toggles an AI-assistant module needs — ALL must be ON for a
 * member to get that module (conservative rule, 00-REQUISITOS §5.2). A module
 * absent from this map is BLOCKED for members (fail-closed, G9).
 *
 * SINGLE SOURCE (G9): lives here so every consumer shares it without drift —
 * the agent registry (member module filtering) AND the Equipo tab UI (which
 * groups/colors the toggles by module) both read this exact object. Do not copy.
 * `asistente_ia` is NOT here: it's the MASTER switch (panel on/off), enforced
 * separately, not a per-module requirement.
 */
export const AGENT_MODULE_REQUIREMENTS: Record<string, PermissionKey[]> = {
  agenda: ['citas'],
  expediente: ['expedientes'],
  flujo: ['flujo', 'pagos', 'conciliacion'],
  facturas: ['facturacion', 'sat'],
  fiscal: ['facturacion', 'sat'],
};

/**
 * FAIL-CLOSED permission check: only an explicit `true` grants access.
 * Absent keys, unknown keys, malformed values and null/undefined sets all deny
 * (G9 — future features are blocked for members until the owner enables them).
 */
export function hasPermission(perms: unknown, key: PermissionKey): boolean {
  return (
    perms !== null &&
    typeof perms === 'object' &&
    (perms as Record<string, unknown>)[key] === true
  );
}

// ---------------------------------------------------------------------------
// TIERS (planes del producto) — feature-gating por CUENTA, apilado sobre los
// permisos por-member de arriba. Un tier = TECHO a nivel de cuenta sobre el
// MISMO vocabulario de PermissionKey (más dos keys que solo existen a nivel de
// tier, ver TierKey). Diseño: docs/DESDE JUNIO/TIERS/01-DISENO-tecnico.md;
// los cuatro tiers: docs/DESDE JUNIO/TIERS/02-PLAN-cuatro-tiers.md.
//
// Acceso efectivo(key) = tierAllows(tier, key) AND (isOwner ? true : hasPermission(perms, key)).
// El techo aplica a owner Y member; el check de toggles sigue siendo de members.
// ---------------------------------------------------------------------------

/** Tiers del producto, de menor a mayor. String (no enum de Postgres) para
 * agregar tiers sin migración de BD — ver 01-DISENO §3.1. El valor guardado es
 * ESTE (case canónico); el nombre que ve la gente es TIER_LABELS. */
export const DOCTOR_TIERS = ['FREE', 'BASICO', 'PRO', 'LAB'] as const;
export type DoctorTier = (typeof DOCTOR_TIERS)[number];

/** Nombre comercial de cada tier — lo que se pinta en el admin y en la
 * pantalla de plan. El valor de BD no cambia; este texto sí puede. */
export const TIER_LABELS: Record<DoctorTier, string> = {
  FREE: 'Gratis',
  BASICO: 'Básico',
  PRO: 'Pro',
  LAB: 'Lab',
};

/**
 * DOS defaults, no uno (02-PLAN §3.3 / G7):
 *
 * - `DEFAULT_TIER` es lo que recibe una cuenta NUEVA. Lo escribe EXPLÍCITO el
 *   `prisma.doctor.create` de `POST /api/doctors` (apps/api) — la única alta.
 *   Ojo: el DEFAULT de la columna en Postgres NO es lo que decide para Prisma:
 *   el cliente generado lleva el `@default` del schema dentro y lo mete él en
 *   el INSERT (medido en el cliente generado: `"default":"FULL"` hasta que se
 *   regenera). Por eso el valor viaja explícito, y el `@default` del schema y
 *   el DEFAULT de la columna se mantienen iguales solo por coherencia (inserts
 *   crudos, lectura humana).
 * - `FALLBACK_TIER` es el fail-open: cómo se comporta una cuenta cuyo tier es
 *   null/ausente/DESCONOCIDO. Va a PRO, no a LAB: no deja fuera a nadie que
 *   paga y no regala el laboratorio. Antes ambas cosas eran `FULL`.
 */
export const DEFAULT_TIER: DoctorTier = 'FREE';
export const FALLBACK_TIER: DoctorTier = 'PRO';

/**
 * Lo que un tier puede excluir: cualquier PermissionKey MÁS dos keys que solo
 * viven a nivel de tier — `ia` (los flujos de IA sueltos: dictado, chats por
 * pantalla) y `whatsapp` (mensajes automáticos a pacientes). NO entran a
 * PERMISSION_KEYS a propósito (G9): no son toggles de member (los flujos de IA
 * siguen OWNER_ONLY para members), así que los 19 toggles no se mueven y el
 * gate de rutas↔permisos no cambia de número.
 */
export type TierKey = PermissionKey | 'ia' | 'whatsapp';

/** Etiquetas para TODA TierKey — las de PermissionKey más las dos de tier. Lo
 * que el admin y la pantalla de plan pintan al listar exclusiones. */
export const TIER_KEY_LABELS: Record<TierKey, string> = {
  ...PERMISSION_LABELS,
  ia: 'Funciones de IA',
  whatsapp: 'WhatsApp a pacientes',
};

/**
 * Keys que un tier EXCLUYE de toda la cuenta (owner incluido). Fuente única.
 *
 * FREE = todo el software MENOS facturación, descarga SAT y conciliación (que
 * hoy está oculta para todos por flag; se excluye igual para no dejar la
 * puerta abierta si el flag se prende). BÁSICO, PRO y LAB hoy no excluyen
 * nada, y cada ausencia tiene su porqué:
 *
 *   ⚠️ BÁSICO SÍ excluye `conciliacion` por decisión de producto (02-PLAN §9.3),
 *      pero la entrada se DIFIERE: excluir solo `conciliacion` saca al dueño
 *      del fast path del agente y le da la prosa `FLUJO_RULES_PARTIAL`, escrita
 *      para una cuenta SIN fiscal — y BÁSICO sí tiene facturación/SAT. Ningún
 *      eval ni assert de gate:prompt corre con BASICO (todos corren con FREE),
 *      así que entra cuando tenga los suyos (02-PLAN §8, hallazgo del review).
 *   ✅ `ia` YA ENTRÓ (Q2b): sus 12 prefijos y las 3 rutas de IA del expediente
 *      llevan `feature: 'ia'` en el route map, así que `gate:routes` sí puede
 *      verificar su cobertura. `whatsapp` sigue FUERA: no existe todavía
 *      ninguna ruta suya y el gate fallaría.
 *   ⚠️ `asistente_ia` (el panel 🟢, que solo LAB conserva) entra en Q5, junto
 *      con las puertas del cliente y el retiro del flag ASISTENTE_IA_VISIBLE.
 *      Excluirlo antes dejaría `/api/agenda-agent` en 403 para TODAS las
 *      cuentas (todas son PRO) sin que el cliente sepa por qué.
 *
 * Mientras tanto Q1 es NO-OP en prod: las 12 cuentas pasan a PRO y PRO no
 * excluye nada. FREE es la única forma con recorte, y es la única probada
 * (para el agente es byte a byte la forma que tenía CORE).
 */
export const TIER_EXCLUDED_KEYS: Record<DoctorTier, readonly TierKey[]> = {
  FREE: ['facturacion', 'sat', 'conciliacion', 'ia'],
  BASICO: ['ia'],
  PRO: [],
  LAB: [],
};

/**
 * ¿La cuenta con este tier tiene acceso a esta key?
 * FAIL-OPEN a FALLBACK_TIER si el tier es null/ausente/desconocido — nunca
 * bloquear por un dato faltante (mismo espíritu que el fallback owner de
 * membership.ts). Contrasta con hasPermission, que es fail-closed: un member
 * sin toggle se DENIEGA, pero una cuenta sin tier se trata como PRO.
 *
 * Ojo: un valor DESCONOCIDO no se trata como "todo permitido" sino como PRO —
 * hoy es lo mismo (PRO no excluye nada), y dejará de serlo en Q5. El admin
 * pinta esos valores en rojo (tierState 'unknown') para que se corrijan.
 */
export function tierAllows(tier: string | null | undefined, key: TierKey): boolean {
  // `hasOwn`, no indexación directa: el tier viene CRUDO de la BD, y una clave
  // heredada de Object.prototype ('constructor', 'toString'…) pasaría un `??`
  // y reventaría en `.includes` — un 500 en cada request en vez del fail-open.
  const known = typeof tier === 'string' && Object.hasOwn(TIER_EXCLUDED_KEYS, tier);
  const excluded = TIER_EXCLUDED_KEYS[known ? (tier as DoctorTier) : FALLBACK_TIER];
  return !excluded.includes(key);
}

/**
 * Los tiers CONOCIDOS que EXCLUYEN esta key — para filtrar en la BD (Prisma
 * `tier: { notIn: tiersExcluding(key) }`) los flujos de FONDO que no pueden
 * llamar tierAllows por fila (worker SAT, G3). Vacío ⇒ ningún tier la excluye
 * (no filtres; `notIn: []` es problemático en SQL). Se mantiene correcto al
 * agregar tiers porque deriva de TIER_EXCLUDED_KEYS.
 *
 * Nota: un valor desconocido en BD NO está en esta lista, así que un `notIn`
 * lo deja pasar — coherente con el fail-open a PRO de tierAllows mientras PRO
 * no excluya la key; revisar cuando PRO excluya algo (Q5).
 */
export function tiersExcluding(key: TierKey): DoctorTier[] {
  return DOCTOR_TIERS.filter((t) => TIER_EXCLUDED_KEYS[t].includes(key));
}

// ---------------------------------------------------------------------------
// Cupos por tier (02-PLAN §3.2). DECLARADOS en Q1, no impuestos: el cupo de
// pacientes se impone en Q3 (los 2 caminos que crean pacientes) y el de
// archivos en Q4 (las 14 rutas de subida). `null` = sin tope.
// ---------------------------------------------------------------------------

const MB = 1024 * 1024;
const GB = 1024 * MB;

export interface TierLimits {
  /** Tope de almacenamiento de archivos del doctor, en bytes. */
  storageBytes: number;
  /** Tope de pacientes activos; null = sin tope. */
  maxPatients: number | null;
}

export const TIER_LIMITS: Record<DoctorTier, TierLimits> = {
  FREE: { storageBytes: 500 * MB, maxPatients: 50 },
  BASICO: { storageBytes: 15 * GB, maxPatients: null },
  PRO: { storageBytes: 50 * GB, maxPatients: null },
  LAB: { storageBytes: 50 * GB, maxPatients: null },
};

/**
 * El cupo de pacientes de un tier. `null` = sin tope.
 *
 * Un tier DESCONOCIDO cae a `FALLBACK_TIER` (PRO), igual que `tierAllows`: un
 * dato corrupto no debe inventar un tope que nadie compró.
 */
export function maxPatientsFor(tier: string | null | undefined): number | null {
  const known = typeof tier === 'string' && Object.hasOwn(TIER_LIMITS, tier);
  return TIER_LIMITS[known ? (tier as DoctorTier) : FALLBACK_TIER].maxPatients;
}

/** Lo que se cuenta contra el cupo (decisión del usuario, 2026-09-13). */
export const PATIENT_STATUS_COUNTED_AGAINST_QUOTA = 'active';

/**
 * 🔴 QUÉ se cuenta: SOLO los pacientes con `status = 'active'`.
 *
 * Archivar libera un lugar — y archivar es lo que ya hace el DELETE de
 * `patients/[id]` (borrado suave, `status: 'archived'`), así que la válvula de
 * escape existe sin construir nada. Medido en prod el 2026-09-13: dr-prueba
 * tiene 43 pacientes pero **9 activos** y 34 archivados; contarlos todos lo
 * pondría casi en el tope por expedientes que ya cerró. En la base solo hay
 * `active` (263) y `archived` (40): `inactive` está en el comentario del
 * esquema pero no lo usa nadie.
 *
 * ⚠️ El número que se CUENTA y el que se MUESTRA tienen que ser el mismo. El
 * contador del admin (`/feature-usage`) usaba un `_count.patients` pelado, que
 * para dr-prueba decía 43 mientras esto ve 9. Dos números distintos para
 * "pacientes" en el mismo producto es una contradicción que descubre un doctor
 * confundido, no un test.
 */
export class QuotaExceededError extends Error {
  readonly limit: number;
  readonly current: number;
  readonly incoming: number;
  constructor(limit: number, current: number, incoming: number) {
    super('QUOTA_EXCEEDED');
    this.name = 'QuotaExceededError';
    this.limit = limit;
    this.current = current;
    this.incoming = incoming;
  }
}

/** Cliente mínimo que necesita el chequeo — sirve igual `prisma` que un `tx`. */
interface PatientCounter {
  patient: { count(args: { where: Record<string, unknown> }): Promise<number> };
  doctor: { findUnique(args: { where: { id: string }; select: { tier: true } }): Promise<{ tier: string } | null> };
}

/**
 * Lanza `QuotaExceededError` si crear `incoming` pacientes pasaría el cupo del
 * plan. No hace nada si el tier no tiene tope (PRO/BÁSICO/LAB ⇒ ni consulta).
 *
 * Se le pasa el MISMO cliente con el que se va a escribir: dentro de una
 * transacción hay que contar dentro de ella, o se cuenta un estado que la
 * escritura ya movió.
 */
export async function assertPatientQuota(
  db: PatientCounter,
  doctorId: string,
  incoming: number,
  tierYaConocido?: string | null,
): Promise<void> {
  const tier =
    tierYaConocido !== undefined
      ? tierYaConocido
      : (await db.doctor.findUnique({ where: { id: doctorId }, select: { tier: true } }))?.tier ?? null;

  const limit = maxPatientsFor(tier);
  if (limit === null) return; // sin tope ⇒ ni siquiera se cuenta

  const current = await db.patient.count({
    where: { doctorId, status: PATIENT_STATUS_COUNTED_AGAINST_QUOTA },
  });
  if (current + incoming > limit) throw new QuotaExceededError(limit, current, incoming);
}
