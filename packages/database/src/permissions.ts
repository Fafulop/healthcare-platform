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
 * ESTE (case canónico); el nombre que ve la gente es TIER_LABELS.
 *
 * 🔴 EL ORDEN CARGA DINERO. Dos guardas lo usan como ranking por posición:
 * "nunca vender un plan por DEBAJO del actual" (`cobro-planes.ts`) y "un pago
 * sólo SUBE el plan" (`cobro-webhook.ts`). Alfabetizar esta lista o insertar un
 * tier a media lista invierte las dos EN SILENCIO — el segundo es justo el bug
 * que encontró el review de C3. `gate:cobro` lo verifica; si agregas un tier,
 * ponlo en su lugar por capacidad, no al final por comodidad. */
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

/**
 * El tope de almacenamiento de un tier, en bytes. Nunca `null`: todos los
 * planes tienen tope (a diferencia del cupo de pacientes). Tier desconocido ⇒
 * `FALLBACK_TIER`, igual que `tierAllows`.
 */
export function storageBytesFor(tier: string | null | undefined): number {
  const known = typeof tier === 'string' && Object.hasOwn(TIER_LIMITS, tier);
  return TIER_LIMITS[known ? (tier as DoctorTier) : FALLBACK_TIER].storageBytes;
}

/**
 * 🔴 Tope POR ARCHIVO (TIERS Q4, decisión del usuario 2026-09-13).
 *
 * 25 MB para documentos e imágenes… pero el VIDEO conserva 200 MB. Un tope
 * global de 25 MB habría roto `medicalVideos` (128 MB hoy) y `doctorVideos`
 * (1 GB hoy), y habría RECHAZADO el archivo más grande que ya existe: un video
 * de 156.8 MB. Los 200 MB dejan pasar todo lo actual y a la vez impiden que
 * **una sola subida supere el cupo FREE entero** (1 GB = 2× los 500 MB).
 *
 * Medido en prod el 2026-09-13: 6 videos pesan 380 MB — el 72% de TODO el
 * bucket (489.5 MB). El video es lo que llena la cuenta, no lo clínico.
 */
export const MAX_BYTES_POR_ARCHIVO = 25 * MB;
export const MAX_BYTES_POR_VIDEO = 200 * MB;

/** El tope que aplica a un archivo, según su MIME. */
export function maxBytesForMime(mime: string | null | undefined): number {
  return typeof mime === 'string' && mime.startsWith('video/')
    ? MAX_BYTES_POR_VIDEO
    : MAX_BYTES_POR_ARCHIVO;
}

/** Un archivo que va a subir, tal como lo entrega el middleware de subida. */
export interface ArchivoEntrante {
  name: string;
  size: number;
  type: string;
}

/** Se pasó el tope POR ARCHIVO. Distinto de quedarse sin cupo de cuenta. */
export class FileTooLargeError extends Error {
  readonly limit: number;
  readonly size: number;
  readonly fileName: string;
  constructor(limit: number, size: number, fileName: string) {
    super('FILE_TOO_LARGE');
    this.name = 'FileTooLargeError';
    this.limit = limit;
    this.size = size;
    this.fileName = fileName;
  }
}

/** Se pasó el cupo de ALMACENAMIENTO de la cuenta. */
export class StorageQuotaExceededError extends Error {
  readonly limit: number;
  readonly current: number;
  readonly incoming: number;
  constructor(limit: number, current: number, incoming: number) {
    super('STORAGE_QUOTA_EXCEEDED');
    this.name = 'StorageQuotaExceededError';
    this.limit = limit;
    this.current = current;
    this.incoming = incoming;
  }
}

/** Bytes en algo que un humano pueda leer: "25 MB", "1.5 GB". */
export function formatearBytes(bytes: number): string {
  if (bytes >= GB) return `${Math.round((bytes / GB) * 10) / 10} GB`;
  if (bytes >= MB) return `${Math.round(bytes / MB)} MB`;
  if (bytes >= 1024) return `${Math.round(bytes / 1024)} KB`;
  // Sin `Math.max(1, …)`: a quien está EXACTAMENTE en su tope le decía "te
  // queda 1 KB", y el siguiente archivo de 1 KB se le rechazaba igual. Un
  // número que la UI afirma tiene que ser cierto.
  return `${bytes} B`;
}

/**
 * Traduce un rechazo de subida a algo que el doctor pueda leer.
 *
 * 🔴 Existe porque uploadthing SEPULTA el error del middleware: sólo deja pasar
 * lo que ya es `UploadThingError`, y a cualquier otra cosa la envuelve en un
 * genérico "Failed to run middleware" (upload-builder, `runRouteMiddleware`).
 * Sin esto, al doctor que se queda sin espacio le aparece esa frase.
 *
 * Devuelve un tipo NEUTRO (`archivo` | `cuenta`), no el código de uploadthing:
 * el mensaje tiene que sobrevivir a la migración a R2, y este paquete no debe
 * aprenderse el vocabulario del proveedor de subidas. Cada router traduce el
 * tipo a SU código.
 *
 * `null` = no es un rechazo nuestro; quien llama debe re-lanzar el original.
 */
export function explicarRechazoDeSubida(
  e: unknown,
): { tipo: 'archivo' | 'cuenta'; mensaje: string; hayPlanMayor?: boolean } | null {
  if (e instanceof FileTooLargeError) {
    return {
      tipo: 'archivo',
      mensaje: `"${e.fileName}" pesa ${formatearBytes(e.size)} y el máximo por archivo es ${formatearBytes(e.limit)}.`,
    };
  }
  if (e instanceof StorageQuotaExceededError) {
    const libre = Math.max(0, e.limit - e.current);
    // TIERS 04 §12.3 P6: a PRO (y LAB) no hay plan mayor que VENDERLE — LAB es
    // por invitación y tiene el mismo tope. Decirle "amplía tu plan" le manda a
    // una pantalla sin nada que comprar. Se deduce del TOPE y no del tier para
    // no cambiar la firma: el error ya trae el límite con el que chocó.
    const hayPlanMayor = (Object.keys(TIER_LIMITS) as DoctorTier[]).some(
      (t) => t !== 'LAB' && TIER_LIMITS[t].storageBytes > e.limit,
    );
    return {
      tipo: 'cuenta',
      // 04 §12.6 #5: borrar un archivo DEL EXPEDIENTE ya libera espacio (sale
      // del libro mayor). Sólo del expediente: las demás superficies (perfil,
      // blog, flujo…) todavía no descuentan al borrar (#5b), por eso la frase
      // dice «del expediente» y no «borra archivos» a secas.
      mensaje:
        `${PREFIJO_SIN_ESPACIO}: ocupas ${formatearBytes(e.current)} de ${formatearBytes(e.limit)} ` +
        `y estás subiendo ${formatearBytes(e.incoming)} (te quedan ${formatearBytes(libre)}). ` +
        (hayPlanMayor
          ? `Borra archivos del expediente para liberar espacio, o ${SUFIJO_CAMBIA_DE_PLAN}`
          : `Llegaste al límite de almacenamiento más alto que ofrecemos. Borra archivos del expediente para liberar espacio.`),
      // `hayPlanMayor` viaja para que la pantalla decida si pinta «Ver planes».
      hayPlanMayor,
    };
  }
  return null;
}

/**
 * Cómo EMPIEZA el mensaje de «sin espacio». uploadthing sólo le entrega al
 * navegador el TEXTO del error (ni el tipo ni campos extra), así que ésta es la
 * única forma que tiene `MediaUploader` de reconocerlo para pintar el botón de
 * «Ver planes». Una sola constante para que el que escribe y el que lee no
 * puedan divergir.
 */
export const PREFIJO_SIN_ESPACIO = 'No hay espacio en tu plan';

/**
 * Lo que agrega el mensaje de «sin espacio» cuando SÍ hay un plan mayor que
 * vender. `MediaUploader` lo busca para decidir si pinta «Ver planes»: a PRO no
 * hay nada que venderle (P6) y el botón lo mandaría a una pantalla vacía.
 */
export const SUFIJO_CAMBIA_DE_PLAN = 'cambia de plan en Mi Cuenta.';

/** Cliente mínimo para el chequeo de almacenamiento. */
interface StorageCounter {
  storedFile: {
    aggregate(args: {
      where: Record<string, unknown>;
      _sum: { sizeBytes: true };
    }): Promise<{ _sum: { sizeBytes: number | null } }>;
  };
  doctor: {
    findUnique(args: { where: { id: string }; select: { tier: true } }): Promise<{ tier: string } | null>;
  };
}

/**
 * Valida ANTES de subir un byte: primero el tope por archivo, después el cupo
 * de la cuenta. Lanza `FileTooLargeError` o `StorageQuotaExceededError`.
 *
 * 🔴 Se llama desde el `middleware` de la subida, que es donde se conoce el
 * tamaño y el archivo TODAVÍA no se transfirió. Verificado en los tipos de
 * `uploadthing@7.7.4`: `MiddlewareFn` recibe `{ files }` y cada `FileUploadData`
 * trae `size`. El mismo contrato vale para R2 (su plan §3.4: el servidor valida
 * MIME y tamaño ANTES de firmar el PUT), así que esta función no sabe nada del
 * proveedor — recibe tamaños, no un SDK.
 *
 * ⚠️ `doctorId` es el doctor DUEÑO del archivo, NO quien aprieta el botón: un
 * admin sube al perfil de OTRO doctor, y cobrarle al admin dejaría al doctor
 * sin medir, pareciendo que funciona.
 */
export async function assertStorageQuota(
  db: StorageCounter,
  doctorId: string,
  // `readonly`: uploadthing entrega `readonly FileUploadData[]`. Pedir un array
  // mutable rechazaba el de la librería (TS2345 × 21).
  archivos: readonly ArchivoEntrante[],
  tierYaConocido?: string | null,
): Promise<void> {
  for (const a of archivos) {
    const tope = maxBytesForMime(a.type);
    if (a.size > tope) throw new FileTooLargeError(tope, a.size, a.name);
  }

  const entrantes = archivos.reduce((n, a) => n + a.size, 0);
  if (entrantes === 0) return;

  // 🔴 FAIL-OPEN ante fallas de INFRAESTRUCTURA, igual que `FALLBACK_TIER`.
  //
  // Antes, cualquier error de la base (tabla que todavía no existe porque el
  // SQL no se ha corrido, caída transitoria) salía por aquí, no era ninguno de
  // nuestros errores de dominio, y el middleware lo re-lanzaba: uploadthing lo
  // envolvía en "Failed to run middleware" y se moría TODA subida de `doctor` y
  // `api` — 29 de las 33 definiciones. `admin` seguía vivo (no llama aquí), o
  // sea que la caída parecía parcial y se diagnosticaba mal.
  //
  // Cobrar de más nunca vale una caída: si no se puede LEER el uso, se deja
  // pasar y se registra. El cupo es un límite comercial, no una guarda de
  // seguridad.
  let limit: number;
  let current: number;
  try {
    const tier =
      tierYaConocido !== undefined
        ? tierYaConocido
        : (await db.doctor.findUnique({ where: { id: doctorId }, select: { tier: true } }))?.tier ?? null;

    limit = storageBytesFor(tier);
    const agg = await db.storedFile.aggregate({ where: { doctorId }, _sum: { sizeBytes: true } });
    current = agg._sum.sizeBytes ?? 0;
  } catch (e) {
    console.error('[storage] no se pudo leer el uso; se deja pasar la subida', {
      doctorId,
      error: e instanceof Error ? e.message : e,
    });
    return;
  }

  if (current + entrantes > limit) throw new StorageQuotaExceededError(limit, current, entrantes);
}

/** Un archivo YA subido, tal como lo entrega `onUploadComplete`. */
export interface ArchivoSubido {
  /**
   * 🔴 La llave ESTABLE del archivo (`file.key`), no la URL.
   *
   * En uploadthing v7 el mismo archivo tiene DOS URLs distintas (`url` legacy y
   * `ufsUrl` nueva) y el repo guarda una u otra según el sitio: ~10 de las 17
   * superficies guardan `url` (MediaUploader, certificados, blog, ledger) y el
   * resto `ufsUrl`. Si el ledger se llavea por URL, el día que se escriba el
   * borrado —o la reconciliación de la migración a R2— NO EMPATA con lo que
   * guardan las tablas de dominio, y falla en silencio devolviendo 0 filas.
   * `key` va DENTRO de las dos formas de URL, así que desde cualquiera se puede
   * llegar a esta fila.
   */
  key: string;
  url: string;
  size: number;
  /** La llave de la ruta que lo subió (`medicalImages`, `doctorVideos`, …). */
  kind: string;
}

/** Cliente mínimo para ESCRIBIR en el libro mayor de archivos. */
interface StorageLedger {
  storedFile: {
    createMany(args: {
      data: { doctorId: string; fileKey: string; url: string; sizeBytes: number; kind: string }[];
      skipDuplicates?: boolean;
    }): Promise<{ count: number }>;
  };
}

/**
 * Apunta archivos en el libro mayor (`stored_files`). El uso de un doctor es
 * SUM(size_bytes) sobre esta tabla, así que lo que NO se apunte aquí es espacio
 * que el doctor ocupa y nadie le cobra.
 *
 * 🔴 Se llama desde `onUploadComplete`, NO desde el cliente. Verificado en los
 * tipos de `uploadthing@7.7.4`: `UploadCompleteFn` recibe `{ metadata, file }`,
 * o sea el `doctorId` que resolvió el middleware JUNTO AL tamaño y la URL
 * definitivos. Ponerlo en el cliente lo volvería opcional: hay 19 archivos que
 * suben y tres idiomas distintos para hacerlo (componente, hook y `uploadFiles`);
 * el que se olvidara de llamar dejaría de medir sin que se note.
 *
 * `skipDuplicates` + el UNIQUE de `url` es lo que evita contar doble: las
 * subidas se reintentan y `onUploadComplete` puede dispararse dos veces para el
 * MISMO archivo. Contar doble le negaría espacio a quien no lo está usando.
 *
 * Nunca lanza: el archivo YA está subido y el doctor ya lo está viendo. Fallar
 * aquí sería pintarle un error por algo que sí funcionó. Se registra en consola
 * para que el hueco quede visible en los logs.
 */
export async function registrarArchivo(
  db: StorageLedger,
  doctorId: string,
  archivo: ArchivoSubido,
): Promise<void> {
  try {
    await db.storedFile.createMany({
      data: [
        {
          doctorId,
          fileKey: archivo.key,
          url: archivo.url,
          sizeBytes: archivo.size,
          kind: archivo.kind,
        },
      ],
      skipDuplicates: true,
    });
  } catch (e) {
    console.error('[storage] no se pudo registrar el archivo', {
      doctorId,
      kind: archivo.kind,
      fileKey: archivo.key,
      error: e instanceof Error ? e.message : e,
    });
  }
}

/**
 * La llave del archivo (`file.key` de uploadthing) a partir de su URL, o `null`
 * si no es una URL de uploadthing. Las dos formas de v7 —`utfs.io/f/<key>` y
 * `<app>.ufs.sh/f/<key>`— llevan la llave después de `/f/` (ver el comentario
 * de `fileKey` en el schema). Medido 2026-09-18: las 160 filas de
 * `patient_media` son `https://utfs.io/f/<key>`.
 */
export function claveDeArchivo(url: string | null | undefined): string | null {
  if (!url) return null;
  const m = /\/f\/([^/?#]+)/.exec(url);
  return m ? decodeURIComponent(m[1]) : null;
}

/**
 * Saca un archivo del libro mayor (`stored_files`) ⇒ deja de contar contra el
 * cupo. TIERS 04 §12.6 #5 (regla R3: borrar libera espacio). Filtra también por
 * `doctorId`: un doctor sólo puede liberar SU espacio. Devuelve cuántas filas
 * salieron (0 si el archivo es de antes del 2026-09-13, cuando el ledger empezó:
 * nunca contó, así que no hay nada que descontar).
 */
export async function olvidarArchivo(
  db: { storedFile: { deleteMany(args: { where: { doctorId: string; fileKey: string } }): Promise<{ count: number }> } },
  doctorId: string,
  fileKey: string,
): Promise<number> {
  const r = await db.storedFile.deleteMany({ where: { doctorId, fileKey } });
  return r.count;
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

/**
 * ¿Lo que la cuenta YA usa cabe en `tier`? — la regla R4 de TIERS 04 §12: sólo
 * se puede pasar a un plan MENOR si lo que usas cabe en él.
 *
 * Mide con los MISMOS contadores que imponen los topes (`stored_files` y los
 * pacientes `active`), para que el número que ve el doctor al elegir un plan
 * sea el mismo con el que después choca al subir un archivo o dar de alta.
 *
 * `motivo` es texto para el doctor, con números. Borrar archivos DEL EXPEDIENTE
 * libera espacio desde 04 §12.6 #5 (las demás superficies todavía no, #5b), y
 * archivar libera lugar de pacientes.
 */
export async function cabeEnPlan(
  db: {
    storedFile: StorageCounter['storedFile'];
    patient: { count(args: { where: { doctorId: string; status: string } }): Promise<number> };
  },
  doctorId: string,
  tier: DoctorTier,
): Promise<{ cabe: true } | { cabe: false; motivo: string }> {
  const nombre = TIER_LABELS[tier];

  const topePacientes = maxPatientsFor(tier);
  if (topePacientes !== null) {
    const activos = await db.patient.count({
      where: { doctorId, status: PATIENT_STATUS_COUNTED_AGAINST_QUOTA },
    });
    if (activos > topePacientes) {
      return {
        cabe: false,
        motivo:
          `Tienes ${activos} pacientes activos y ${nombre} permite ${topePacientes}. ` +
          `Archiva ${activos - topePacientes} expediente(s) para elegirlo (archivar no borra nada).`,
      };
    }
  }

  const topeBytes = storageBytesFor(tier);
  const agg = await db.storedFile.aggregate({ where: { doctorId }, _sum: { sizeBytes: true } });
  const usados = agg._sum.sizeBytes ?? 0;
  if (usados > topeBytes) {
    return {
      cabe: false,
      motivo:
        `Usas ${formatearBytes(usados)} de archivos y ${nombre} permite ${formatearBytes(topeBytes)}. ` +
        `Borra archivos del expediente para liberar espacio.`,
    };
  }

  return { cabe: true };
}
