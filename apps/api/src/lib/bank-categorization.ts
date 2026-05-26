/**
 * Bank Movement Auto-Categorization Engine
 *
 * Applies built-in rules + doctor-learned rules to suggest
 * area/subarea/concept for unmatched bank movements.
 */

export interface CategorySuggestion {
  entryType: 'ingreso' | 'egreso';
  area: string;
  subarea: string | null;
  concept: string | null;
  ruleSource: 'builtin' | 'learned';
}

interface LearnedRule {
  pattern: string;
  patternType: string; // 'contains' | 'starts_with' | 'exact'
  movementType: string;
  entryType: string;
  area: string;
  subarea: string | null;
  concept: string | null;
}

// ─── Built-in Rules ─────────────────────────────────────────────────────────

interface BuiltinRule {
  patterns: string[];
  movementType: 'deposit' | 'withdrawal' | 'any';
  entryType: 'ingreso' | 'egreso';
  area: string;
  subarea: string | null;
  concept: string | null;
}

const BUILTIN_RULES: BuiltinRule[] = [
  // ── Withdrawals (egresos) ──
  // Utilities
  { patterns: ['cfe', 'comision federal de electricidad', 'luz'], movementType: 'withdrawal', entryType: 'egreso', area: 'Gastos Fijos', subarea: 'Servicios', concept: 'Pago de luz (CFE)' },
  { patterns: ['telmex', 'tel mex', 'infinitum'], movementType: 'withdrawal', entryType: 'egreso', area: 'Gastos Fijos', subarea: 'Servicios', concept: 'Telmex / Internet' },
  { patterns: ['izzi', 'totalplay', 'megacable', 'axtel'], movementType: 'withdrawal', entryType: 'egreso', area: 'Gastos Fijos', subarea: 'Servicios', concept: 'Internet / Cable' },
  { patterns: ['agua', 'siapa', 'japac', 'organismo de agua'], movementType: 'withdrawal', entryType: 'egreso', area: 'Gastos Fijos', subarea: 'Servicios', concept: 'Pago de agua' },
  { patterns: ['gas natural', 'naturgy'], movementType: 'withdrawal', entryType: 'egreso', area: 'Gastos Fijos', subarea: 'Servicios', concept: 'Gas natural' },

  // Rent
  { patterns: ['renta', 'alquiler', 'arrendamiento'], movementType: 'withdrawal', entryType: 'egreso', area: 'Gastos Fijos', subarea: 'Renta Consultorio', concept: 'Renta' },

  // Medical supplies
  { patterns: ['farmacia', 'farmacias', 'guadalajara', 'benavides', 'san pablo', 'del ahorro'], movementType: 'withdrawal', entryType: 'egreso', area: 'Gastos Operativos', subarea: 'Insumos Médicos', concept: 'Farmacia' },
  { patterns: ['material medico', 'insumos medicos', 'instrumental'], movementType: 'withdrawal', entryType: 'egreso', area: 'Gastos Operativos', subarea: 'Insumos Médicos', concept: 'Material médico' },
  { patterns: ['laboratorio', 'lab '], movementType: 'withdrawal', entryType: 'egreso', area: 'Gastos Operativos', subarea: 'Laboratorio', concept: 'Laboratorio' },

  // Online shopping
  { patterns: ['amazon', 'amzn'], movementType: 'withdrawal', entryType: 'egreso', area: 'Gastos Operativos', subarea: 'Compras Varias', concept: 'Amazon' },
  { patterns: ['mercadolibre', 'mercado libre', 'meli'], movementType: 'withdrawal', entryType: 'egreso', area: 'Gastos Operativos', subarea: 'Compras Varias', concept: 'Mercado Libre' },

  // Banking fees
  { patterns: ['comision', 'anualidad', 'cargo por manejo'], movementType: 'withdrawal', entryType: 'egreso', area: 'Gastos Financieros', subarea: 'Comisiones Bancarias', concept: 'Comisión bancaria' },
  { patterns: ['isr', 'impuesto sobre la renta'], movementType: 'withdrawal', entryType: 'egreso', area: 'Impuestos', subarea: 'ISR', concept: 'ISR' },
  { patterns: ['iva ret', 'retencion iva'], movementType: 'withdrawal', entryType: 'egreso', area: 'Impuestos', subarea: 'IVA', concept: 'Retención IVA' },

  // Insurance
  { patterns: ['seguro', 'gnp', 'axa', 'metlife', 'zurich', 'mapfre'], movementType: 'withdrawal', entryType: 'egreso', area: 'Gastos Fijos', subarea: 'Seguros', concept: 'Seguro' },

  // Vehicle
  { patterns: ['gasolina', 'pemex', 'oxxo gas', 'bp estacion'], movementType: 'withdrawal', entryType: 'egreso', area: 'Gastos Operativos', subarea: 'Transporte', concept: 'Gasolina' },
  { patterns: ['uber', 'didi', 'cabify'], movementType: 'withdrawal', entryType: 'egreso', area: 'Gastos Operativos', subarea: 'Transporte', concept: 'Transporte' },
  { patterns: ['estacionamiento', 'parking'], movementType: 'withdrawal', entryType: 'egreso', area: 'Gastos Operativos', subarea: 'Transporte', concept: 'Estacionamiento' },

  // Subscriptions / Software
  { patterns: ['spotify', 'netflix', 'disney', 'hbo', 'youtube'], movementType: 'withdrawal', entryType: 'egreso', area: 'Gastos Personales', subarea: 'Entretenimiento', concept: null },
  { patterns: ['google', 'microsoft', 'apple', 'icloud', 'zoom', 'adobe'], movementType: 'withdrawal', entryType: 'egreso', area: 'Gastos Operativos', subarea: 'Software', concept: 'Software / Suscripción' },

  // Food
  { patterns: ['restaurante', 'restaurant', 'oxxo', 'seven', '7-eleven', 'starbucks'], movementType: 'withdrawal', entryType: 'egreso', area: 'Gastos Operativos', subarea: 'Alimentos', concept: null },

  // ── Deposits (ingresos) ──
  { patterns: ['spei', 'transferencia', 'traspaso recibido', 'deposito'], movementType: 'deposit', entryType: 'ingreso', area: 'Consultas Médicas', subarea: 'Consulta General', concept: null },
  { patterns: ['nomina', 'nómina', 'sueldo'], movementType: 'deposit', entryType: 'ingreso', area: 'Ingresos', subarea: 'Nómina', concept: 'Nómina' },
  { patterns: ['rendimiento', 'interes', 'intereses'], movementType: 'deposit', entryType: 'ingreso', area: 'Ingresos Financieros', subarea: 'Rendimientos', concept: 'Rendimientos bancarios' },
];

// ─── Matching Logic ─────────────────────────────────────────────────────────

function matchesPattern(description: string, pattern: string, patternType: string): boolean {
  const desc = description.toLowerCase();
  const pat = pattern.toLowerCase();
  switch (patternType) {
    case 'exact': return desc === pat;
    case 'starts_with': return desc.startsWith(pat);
    case 'contains':
    default: return desc.includes(pat);
  }
}

function tryBuiltinRules(description: string, movementType: string): CategorySuggestion | null {
  for (const rule of BUILTIN_RULES) {
    if (rule.movementType !== 'any' && rule.movementType !== movementType) continue;
    for (const pattern of rule.patterns) {
      if (description.toLowerCase().includes(pattern)) {
        return {
          entryType: rule.entryType,
          area: rule.area,
          subarea: rule.subarea,
          concept: rule.concept,
          ruleSource: 'builtin',
        };
      }
    }
  }
  return null;
}

function tryLearnedRules(description: string, movementType: string, rules: LearnedRule[]): CategorySuggestion | null {
  for (const rule of rules) {
    if (rule.movementType !== movementType) continue;
    if (matchesPattern(description, rule.pattern, rule.patternType)) {
      return {
        entryType: rule.entryType as 'ingreso' | 'egreso',
        area: rule.area,
        subarea: rule.subarea,
        concept: rule.concept,
        ruleSource: 'learned',
      };
    }
  }
  return null;
}

// ─── Main Export ─────────────────────────────────────────────────────────────

/**
 * Categorize a single bank movement.
 * Tries learned rules first (doctor-specific), then built-in rules.
 * Returns null if no rule matches (movement stays uncategorized).
 */
export function categorizeMovement(
  description: string,
  movementType: 'deposit' | 'withdrawal',
  learnedRules: LearnedRule[],
): CategorySuggestion | null {
  // Learned rules take priority
  const learned = tryLearnedRules(description, movementType, learnedRules);
  if (learned) return learned;

  // Fall back to built-in rules
  return tryBuiltinRules(description, movementType);
}

/**
 * Categorize all movements in a batch.
 */
export function categorizeMovements(
  movements: { description: string; movementType: string }[],
  learnedRules: LearnedRule[],
): (CategorySuggestion | null)[] {
  return movements.map(m =>
    categorizeMovement(m.description, m.movementType as 'deposit' | 'withdrawal', learnedRules)
  );
}
