/**
 * Deduction category classification for Mexican doctors (Régimen 612).
 *
 * Classifies received CFDIs into deduction categories using:
 *   1. SAT claveProdServ (product/service code)
 *   2. Keyword matching on concepto descriptions
 *
 * Reference: Art. 25-35 LISR, applicable to Personas Físicas con
 * Actividades Empresariales y Profesionales.
 */

export interface DeductionCategory {
  id: string;
  name: string;
  icon: string; // emoji for UI
  depreciationRate: number | null; // annual % if depreciable, null if 100% deductible
  description: string;
}

export const DEDUCTION_CATEGORIES: DeductionCategory[] = [
  {
    id: 'renta',
    name: 'Renta de Consultorio',
    icon: '🏢',
    depreciationRate: null,
    description: 'Arrendamiento de local, consultorio u oficina',
  },
  {
    id: 'insumos',
    name: 'Insumos y Material Médico',
    icon: '💊',
    depreciationRate: null,
    description: 'Material de curación, reactivos, guantes, jeringas, gasas',
  },
  {
    id: 'equipo_medico',
    name: 'Equipo Médico',
    icon: '🩺',
    depreciationRate: 0.25, // 25% annual per Art. 35 LISR
    description: 'Instrumentos y equipos médicos (depreciación 25% anual)',
  },
  {
    id: 'computo',
    name: 'Equipo de Cómputo y Software',
    icon: '💻',
    depreciationRate: 0.30, // 30% annual per Art. 35 LISR
    description: 'Computadoras, impresoras, licencias de software (depreciación 30% anual)',
  },
  {
    id: 'mobiliario',
    name: 'Mobiliario y Equipo de Oficina',
    icon: '🪑',
    depreciationRate: 0.10, // 10% annual per Art. 35 LISR
    description: 'Escritorios, sillas, archiveros, muebles de recepción (depreciación 10% anual)',
  },
  {
    id: 'servicios_profesionales',
    name: 'Servicios Profesionales',
    icon: '👔',
    depreciationRate: null,
    description: 'Honorarios de contadores, abogados, laboratorios, asesores',
  },
  {
    id: 'seguros',
    name: 'Seguros y Fianzas',
    icon: '🛡️',
    depreciationRate: null,
    description: 'Seguros de responsabilidad civil, consultorio, equipo',
  },
  {
    id: 'servicios_basicos',
    name: 'Servicios Básicos',
    icon: '💡',
    depreciationRate: null,
    description: 'Luz, agua, teléfono, internet, gas (proporción de uso profesional)',
  },
  {
    id: 'capacitacion',
    name: 'Capacitación y Desarrollo',
    icon: '🎓',
    depreciationRate: null,
    description: 'Cursos, congresos, diplomados, certificaciones médicas',
  },
  {
    id: 'vehiculo',
    name: 'Vehículo y Transporte',
    icon: '🚗',
    depreciationRate: 0.25, // 25% annual, capped at $175k MXN
    description: 'Gasolina, mantenimiento, estacionamiento, casetas (compra tope $175k)',
  },
  {
    id: 'nomina',
    name: 'Sueldos y Nómina',
    icon: '👥',
    depreciationRate: null,
    description: 'Salarios de empleados, aportaciones IMSS/INFONAVIT',
  },
  {
    id: 'otros',
    name: 'Otros Gastos Deducibles',
    icon: '📋',
    depreciationRate: null,
    description: 'Papelería, limpieza, mantenimiento, publicidad, uniformes',
  },
];

// ---------------------------------------------------------------------------
// Classification rules: SAT claveProdServ ranges
// ---------------------------------------------------------------------------

const CLAVE_RANGES: Array<{ start: string; end: string; categoryId: string }> = [
  // Renta
  { start: '80131500', end: '80131599', categoryId: 'renta' },
  { start: '80141600', end: '80141699', categoryId: 'renta' },
  // Insumos médicos
  { start: '42000000', end: '42129999', categoryId: 'insumos' },
  // Equipo médico (instruments, diagnostic, imaging)
  { start: '42130000', end: '42299999', categoryId: 'equipo_medico' },
  // Cómputo
  { start: '43210000', end: '43239999', categoryId: 'computo' },
  // Mobiliario
  { start: '56100000', end: '56129999', categoryId: 'mobiliario' },
  // Servicios profesionales / healthcare services
  { start: '80100000', end: '80199999', categoryId: 'servicios_profesionales' },
  { start: '85100000', end: '85149999', categoryId: 'servicios_profesionales' },
  // Seguros
  { start: '84130000', end: '84139999', categoryId: 'seguros' },
  // Servicios básicos (utilities)
  { start: '83100000', end: '83119999', categoryId: 'servicios_basicos' },
  // Capacitación / educación
  { start: '86130000', end: '86139999', categoryId: 'capacitacion' },
  // Transporte / vehículos
  { start: '78100000', end: '78189999', categoryId: 'vehiculo' },
  { start: '25170000', end: '25179999', categoryId: 'vehiculo' },
];

// ---------------------------------------------------------------------------
// Keyword matching (fallback when claveProdServ doesn't match ranges)
// ---------------------------------------------------------------------------

const KEYWORD_MAP: Array<{ keywords: string[]; categoryId: string }> = [
  { keywords: ['renta', 'arrendamiento', 'local', 'consultorio', 'oficina alquiler'], categoryId: 'renta' },
  { keywords: ['material médico', 'insumos', 'guantes', 'jeringas', 'gasas', 'material de curación', 'reactivo', 'sutura'], categoryId: 'insumos' },
  { keywords: ['equipo médico', 'ultrasonido', 'electrocardiógrafo', 'baumanómetro', 'estetoscopio', 'autoclave', 'oxímetro'], categoryId: 'equipo_medico' },
  { keywords: ['computadora', 'laptop', 'software', 'licencia', 'sistema', 'impresora', 'servidor', 'dominio', 'hosting'], categoryId: 'computo' },
  { keywords: ['escritorio', 'silla', 'archivero', 'mueble', 'recepción', 'vitrina', 'estante'], categoryId: 'mobiliario' },
  { keywords: ['honorarios', 'consultoría', 'asesoría', 'contabilidad', 'legal', 'laboratorio', 'notario'], categoryId: 'servicios_profesionales' },
  { keywords: ['seguro', 'póliza', 'responsabilidad civil', 'fianza'], categoryId: 'seguros' },
  { keywords: ['luz', 'electricidad', 'agua', 'teléfono', 'internet', 'gas natural', 'cfe', 'telmex'], categoryId: 'servicios_basicos' },
  { keywords: ['curso', 'congreso', 'diplomado', 'capacitación', 'certificación', 'colegiatura', 'seminario'], categoryId: 'capacitacion' },
  { keywords: ['gasolina', 'combustible', 'mantenimiento vehicular', 'estacionamiento', 'caseta', 'peaje', 'autopista'], categoryId: 'vehiculo' },
  { keywords: ['nómina', 'salario', 'sueldo', 'imss', 'infonavit', 'aguinaldo', 'prima vacacional'], categoryId: 'nomina' },
  { keywords: ['papelería', 'limpieza', 'mantenimiento', 'publicidad', 'marketing', 'uniforme', 'mensajería'], categoryId: 'otros' },
];

/**
 * Classify a CFDI line item into a deduction category.
 * Uses claveProdServ first, then falls back to keyword matching on description.
 */
export function classifyConcepto(
  claveProdServ: string | null,
  descripcion: string | null,
): string {
  // 1. Try claveProdServ range matching
  if (claveProdServ) {
    const code = claveProdServ.padEnd(8, '0');
    for (const range of CLAVE_RANGES) {
      if (code >= range.start && code <= range.end) {
        return range.categoryId;
      }
    }
  }

  // 2. Fallback to keyword matching on description (word-boundary aware)
  if (descripcion) {
    const lower = descripcion.toLowerCase();
    for (const entry of KEYWORD_MAP) {
      for (const kw of entry.keywords) {
        const kwLower = kw.toLowerCase();
        // Use word boundary regex to avoid substring collisions (e.g. "gas" matching "gasas")
        const regex = new RegExp(`\\b${kwLower.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`);
        if (regex.test(lower)) {
          return entry.categoryId;
        }
      }
    }
  }

  return 'otros';
}

// ---------------------------------------------------------------------------
// Non-deductible flags
// ---------------------------------------------------------------------------

export interface DeductibilityFlag {
  type: 'cash_over_2k' | 'no_xml' | 'proportional' | 'cancelled' | 'generic_description' | 'high_amount' | 'foreign_currency';
  severity: 'error' | 'warning' | 'info';
  message: string;
}

/**
 * Check if a CFDI expense has deductibility issues.
 * Returns an array of flags (empty = fully deductible).
 */
export function checkDeductibility(cfdi: {
  formaPago: string | null;
  subtotal: number;
  satStatus: string;
  hasDetails: boolean;
  categoryId: string;
}): DeductibilityFlag[] {
  const flags: DeductibilityFlag[] = [];

  // Cancelled = not deductible at all
  if (cfdi.satStatus === 'Cancelado') {
    flags.push({
      type: 'cancelled',
      severity: 'error',
      message: 'CFDI cancelado — no deducible',
    });
  }

  // Cash > $2,000 MXN is not deductible (must be bancarized)
  if (cfdi.formaPago === '01' && cfdi.subtotal > 2000) {
    flags.push({
      type: 'cash_over_2k',
      severity: 'error',
      message: 'Pago en efectivo > $2,000 — no deducible (Art. 27 frac. III LISR)',
    });
  }

  // No XML details (can't fully classify)
  if (!cfdi.hasDetails) {
    flags.push({
      type: 'no_xml',
      severity: 'info',
      message: 'Sin detalles XML — clasificación aproximada',
    });
  }

  // Proportional expenses (utilities, vehicle)
  if (cfdi.categoryId === 'servicios_basicos' || cfdi.categoryId === 'vehiculo') {
    flags.push({
      type: 'proportional',
      severity: 'warning',
      message: 'Gasto proporcional — solo deducible la parte de uso profesional',
    });
  }

  return flags;
}

/**
 * Extended deductibility check for individual CFDIs with XML details.
 * Used by the check-deducibility endpoint for comprehensive scanning.
 */
export function checkDeductibilityExtended(cfdi: {
  formaPago: string | null;
  subtotal: number;
  total: number;
  satStatus: string;
  hasDetails: boolean;
  categoryId: string;
  conceptoDescriptions: string[];
  moneda: string | null;
}): DeductibilityFlag[] {
  // Start with basic checks
  const flags = checkDeductibility(cfdi);

  // Generic/vague description detection
  if (cfdi.conceptoDescriptions.length > 0) {
    const genericTerms = ['servicio', 'servicios', 'producto', 'productos', 'concepto', 'varios', 'diverso', 'pago', 'cobro', 'honorarios'];
    const allGeneric = cfdi.conceptoDescriptions.every(desc => {
      const words = desc.toLowerCase().trim().split(/\s+/);
      // Flag if description is 1-2 words and all words are generic
      return words.length <= 2 && words.every(w => genericTerms.includes(w));
    });
    if (allGeneric) {
      flags.push({
        type: 'generic_description',
        severity: 'warning',
        message: 'Descripción genérica — el SAT podría rechazar la deducción por falta de detalle',
      });
    }
  }

  // High single expense (> $50k) — flag for review
  if (cfdi.subtotal > 50000) {
    flags.push({
      type: 'high_amount',
      severity: 'info',
      message: `Gasto mayor a $50,000 — verifica documentación de soporte`,
    });
  }

  // Foreign currency — exchange rate must be documented
  if (cfdi.moneda && cfdi.moneda !== 'MXN') {
    flags.push({
      type: 'foreign_currency',
      severity: 'info',
      message: `Moneda ${cfdi.moneda} — verifica tipo de cambio aplicado para deducción`,
    });
  }

  return flags;
}
