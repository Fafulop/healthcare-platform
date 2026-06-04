/**
 * Deduction category classification for Mexican doctors.
 *
 * Supports two regimes:
 *   - 612: Personas Físicas con Actividades Empresariales y Profesionales
 *          Full ISR deductions + IVA acreditable
 *   - 626: RESICO (Régimen Simplificado de Confianza)
 *          NO ISR deductions, but IVA acreditable applies (regla 3.13.20 RMF)
 *
 * Classification pipeline:
 *   1. usoCfdi — primary deductibility signal (S01 = not deducible)
 *   2. claveProdServ — UNSPSC product/service code ranges
 *   3. Keyword matching on concepto descriptions
 *
 * Reference: Art. 25-35 LISR, Art. 113-E LISR (RESICO), LIVA Art. 4-5.
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
    id: 'alimentos',
    name: 'Alimentos y Viajes',
    icon: '🍽️',
    depreciationRate: null,
    description: 'Restaurantes, hoteles, viáticos, boletos de avión (deducible parcial)',
  },
  {
    id: 'papeleria',
    name: 'Papelería y Limpieza',
    icon: '🧹',
    depreciationRate: null,
    description: 'Papelería, artículos de limpieza, tóner, material de oficina',
  },
  {
    id: 'sin_clasificar',
    name: 'Sin Clasificar',
    icon: '❓',
    depreciationRate: null,
    description: 'Gastos que no pudieron clasificarse automáticamente — requiere revisión',
  },
];

// ---------------------------------------------------------------------------
// UsoCFDI deductibility mapping
// ---------------------------------------------------------------------------

/** Determines the deductibility type from the usoCfdi field */
export type UsoCfdiType = 'gasto_operativo' | 'inversion' | 'deduccion_personal' | 'sin_efectos' | 'pago' | 'unknown';

export function classifyUsoCfdi(usoCfdi: string | null): UsoCfdiType {
  if (!usoCfdi) return 'unknown';
  const code = usoCfdi.toUpperCase();

  // G01-G03: Operating expenses (deducible for 612, IVA acreditable for both)
  if (code === 'G01' || code === 'G02' || code === 'G03') return 'gasto_operativo';

  // I01-I08: Investments (depreciable)
  if (code.startsWith('I0')) return 'inversion';

  // D01-D10: Personal deductions (annual return only, NOT for RESICO)
  if (code.startsWith('D0') || code === 'D10') return 'deduccion_personal';

  // S01: Sin efectos fiscales — NOT deducible
  if (code === 'S01') return 'sin_efectos';

  // CP01: Pagos
  if (code === 'CP01') return 'pago';

  return 'unknown';
}

// ---------------------------------------------------------------------------
// Classification rules: SAT claveProdServ ranges (UNSPSC)
// ---------------------------------------------------------------------------

const CLAVE_RANGES: Array<{ start: string; end: string; categoryId: string }> = [
  // -- Renta (arrendamiento) --
  { start: '80131500', end: '80131599', categoryId: 'renta' },
  { start: '80141600', end: '80141699', categoryId: 'renta' },

  // -- Insumos médicos (Div 42: Medical devices & supplies, up to 42.12) --
  { start: '42000000', end: '42129999', categoryId: 'insumos' },

  // -- Equipo médico (42.13-42.29: instruments, diagnostic, imaging) --
  { start: '42130000', end: '42299999', categoryId: 'equipo_medico' },

  // -- Equipo de cómputo y software (Div 43: IT equipment + software) --
  { start: '43200000', end: '43239999', categoryId: 'computo' },
  // IT services (Div 81: Engineering & IT)
  { start: '81110000', end: '81119999', categoryId: 'computo' },
  { start: '81160000', end: '81169999', categoryId: 'computo' },

  // -- Mobiliario y equipo de oficina (Div 56: Furniture) --
  { start: '56100000', end: '56129999', categoryId: 'mobiliario' },

  // -- Papelería y artículos de oficina (Div 44: Office supplies) --
  { start: '44100000', end: '44129999', categoryId: 'papeleria' },
  { start: '14110000', end: '14119999', categoryId: 'papeleria' }, // Paper products

  // -- Servicios profesionales / healthcare services --
  { start: '80100000', end: '80129999', categoryId: 'servicios_profesionales' },
  { start: '80140000', end: '80149999', categoryId: 'servicios_profesionales' },
  { start: '80150000', end: '80169999', categoryId: 'servicios_profesionales' },
  { start: '85100000', end: '85149999', categoryId: 'servicios_profesionales' },
  // Accounting/financial services (Div 84, excl insurance)
  { start: '84100000', end: '84129999', categoryId: 'servicios_profesionales' },

  // -- Seguros y fianzas --
  { start: '84130000', end: '84139999', categoryId: 'seguros' },

  // -- Servicios básicos (utilities: Div 83) --
  { start: '83100000', end: '83119999', categoryId: 'servicios_basicos' },
  // Telecom services
  { start: '83120000', end: '83129999', categoryId: 'servicios_basicos' },

  // -- Capacitación / educación (Div 86) --
  { start: '86100000', end: '86139999', categoryId: 'capacitacion' },

  // -- Vehículo y transporte --
  { start: '78100000', end: '78189999', categoryId: 'vehiculo' },
  { start: '25170000', end: '25179999', categoryId: 'vehiculo' },
  // Fuels and lubricants (Div 15)
  { start: '15100000', end: '15129999', categoryId: 'vehiculo' },

  // -- Alimentos y viajes (Div 90: Travel/food/lodging) --
  { start: '90100000', end: '90159999', categoryId: 'alimentos' },
  // Food products (Div 50) — supermarkets, catering
  { start: '50000000', end: '50399999', categoryId: 'alimentos' },

  // -- Nómina (payroll services) --
  { start: '80111500', end: '80111599', categoryId: 'nomina' },

  // -- Servicios de limpieza y mantenimiento (Div 72, 76) --
  { start: '76100000', end: '76129999', categoryId: 'papeleria' },
  // Cleaning supplies
  { start: '47130000', end: '47139999', categoryId: 'papeleria' },

  // -- Lab/measurement equipment (Div 60) --
  { start: '60100000', end: '60149999', categoryId: 'equipo_medico' },
];

// ---------------------------------------------------------------------------
// Keyword matching (fallback when claveProdServ doesn't match ranges)
// ---------------------------------------------------------------------------

const KEYWORD_MAP: Array<{ keywords: string[]; categoryId: string }> = [
  { keywords: ['renta', 'arrendamiento', 'consultorio', 'oficina alquiler'], categoryId: 'renta' },
  { keywords: ['material médico', 'insumos', 'guantes', 'jeringas', 'gasas', 'material de curación', 'reactivo', 'sutura', 'cubrebocas', 'mascarilla'], categoryId: 'insumos' },
  { keywords: ['equipo médico', 'ultrasonido', 'electrocardiógrafo', 'baumanómetro', 'estetoscopio', 'autoclave', 'oxímetro', 'desfibrilador', 'monitor de signos', 'esterilizador'], categoryId: 'equipo_medico' },
  { keywords: ['computadora', 'laptop', 'software', 'licencia', 'impresora', 'servidor', 'dominio', 'hosting', 'antivirus', 'nube', 'cloud'], categoryId: 'computo' },
  { keywords: ['escritorio', 'silla', 'archivero', 'mueble', 'vitrina', 'estante', 'mesa de exploración', 'camilla'], categoryId: 'mobiliario' },
  { keywords: ['honorarios', 'consultoría', 'asesoría', 'contabilidad', 'legal', 'laboratorio', 'notario', 'dictamen', 'auditoría', 'peritaje'], categoryId: 'servicios_profesionales' },
  { keywords: ['seguro', 'póliza', 'responsabilidad civil', 'fianza', 'cobertura', 'prima'], categoryId: 'seguros' },
  { keywords: ['luz', 'electricidad', 'agua', 'teléfono', 'internet', 'gas natural', 'cfe', 'telmex', 'izzi', 'totalplay', 'megacable'], categoryId: 'servicios_basicos' },
  { keywords: ['curso', 'congreso', 'diplomado', 'capacitación', 'certificación', 'colegiatura', 'seminario', 'taller', 'conferencia', 'simposio'], categoryId: 'capacitacion' },
  { keywords: ['gasolina', 'combustible', 'mantenimiento vehicular', 'estacionamiento', 'caseta', 'peaje', 'autopista', 'diesel', 'verificación vehicular', 'tenencia'], categoryId: 'vehiculo' },
  { keywords: ['nómina', 'salario', 'sueldo', 'imss', 'infonavit', 'aguinaldo', 'prima vacacional', 'finiquito', 'liquidación'], categoryId: 'nomina' },
  { keywords: ['restaurante', 'alimentos', 'comida', 'hotel', 'hospedaje', 'vuelo', 'boleto de avión', 'viáticos', 'uber', 'didi', 'taxi'], categoryId: 'alimentos' },
  { keywords: ['papelería', 'limpieza', 'tóner', 'cartuchos', 'pluma', 'folder', 'uniforme', 'mensajería', 'paquetería', 'envío'], categoryId: 'papeleria' },
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
        const regex = new RegExp(`\\b${kwLower.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, 'i');
        if (regex.test(lower)) {
          return entry.categoryId;
        }
      }
    }
  }

  return 'sin_clasificar';
}

// ---------------------------------------------------------------------------
// Non-deductible flags
// ---------------------------------------------------------------------------

export type DeductibilityFlagType =
  | 'cash_over_2k'
  | 'no_xml'
  | 'proportional'
  | 'cancelled'
  | 'generic_description'
  | 'high_amount'
  | 'foreign_currency'
  | 'sin_efectos'
  | 'deduccion_personal_resico'
  | 'sin_clasificar';

export interface DeductibilityFlag {
  type: DeductibilityFlagType;
  severity: 'error' | 'warning' | 'info';
  message: string;
}

/**
 * Check if a CFDI expense has deductibility issues.
 * Returns an array of flags (empty = no issues detected).
 *
 * @param regimenFiscal — '612' or '626' (RESICO). Affects which flags apply.
 */
export function checkDeductibility(cfdi: {
  formaPago: string | null;
  subtotal: number;
  satStatus: string;
  hasDetails: boolean;
  categoryId: string;
  usoCfdi?: string | null;
  regimenFiscal?: string;
}): DeductibilityFlag[] {
  const flags: DeductibilityFlag[] = [];
  const isResico = cfdi.regimenFiscal === '626';

  // Cancelled = not deductible at all
  if (cfdi.satStatus === 'Cancelado') {
    flags.push({
      type: 'cancelled',
      severity: 'error',
      message: 'CFDI cancelado — no deducible',
    });
  }

  // S01 = Sin efectos fiscales — not deducible, no IVA acreditable
  const usoType = classifyUsoCfdi(cfdi.usoCfdi || null);
  if (usoType === 'sin_efectos') {
    flags.push({
      type: 'sin_efectos',
      severity: 'error',
      message: 'Uso CFDI "S01 — Sin efectos fiscales" — no deducible, sin IVA acreditable',
    });
  }

  // D01-D10 personal deductions: RESICO cannot apply them
  if (isResico && usoType === 'deduccion_personal') {
    flags.push({
      type: 'deduccion_personal_resico',
      severity: 'warning',
      message: 'Deducción personal — RESICO no puede aplicar deducciones personales en declaración anual',
    });
  }

  // Cash > $2,000 MXN is not deductible (must be bancarized) — only matters for 612
  if (!isResico && cfdi.formaPago === '01' && cfdi.subtotal > 2000) {
    flags.push({
      type: 'cash_over_2k',
      severity: 'error',
      message: 'Pago en efectivo > $2,000 — no deducible (Art. 27 frac. III LISR)',
    });
  }

  // Cash > $2,000 for RESICO: IVA acreditable still requires bancarización
  if (isResico && cfdi.formaPago === '01' && cfdi.subtotal > 2000) {
    flags.push({
      type: 'cash_over_2k',
      severity: 'warning',
      message: 'Pago en efectivo > $2,000 — IVA no acreditable sin comprobante de pago bancarizado',
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

  // Proportional expenses (utilities, vehicle) — for 612 ISR deduction
  if (!isResico && (cfdi.categoryId === 'servicios_basicos' || cfdi.categoryId === 'vehiculo')) {
    flags.push({
      type: 'proportional',
      severity: 'warning',
      message: 'Gasto proporcional — solo deducible la parte de uso profesional',
    });
  }

  // Unclassified expense
  if (cfdi.categoryId === 'sin_clasificar') {
    flags.push({
      type: 'sin_clasificar',
      severity: 'info',
      message: 'No se pudo clasificar automáticamente — revisa manualmente si es deducible',
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
  usoCfdi?: string | null;
  regimenFiscal?: string;
}): DeductibilityFlag[] {
  // Start with basic checks
  const flags = checkDeductibility(cfdi);

  // Generic/vague description detection
  if (cfdi.conceptoDescriptions.length > 0) {
    const genericTerms = ['servicio', 'servicios', 'producto', 'productos', 'concepto', 'varios', 'diverso', 'pago', 'cobro', 'honorarios'];
    const allGeneric = cfdi.conceptoDescriptions.every(desc => {
      const words = desc.toLowerCase().trim().split(/\s+/);
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
