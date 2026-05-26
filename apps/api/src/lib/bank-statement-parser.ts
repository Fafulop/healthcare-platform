/**
 * Bank Statement CSV Parser
 *
 * Parses CSV files from Mexican banks into a normalized BankMovement format.
 * Supports: BBVA, Banorte, HSBC, Santander, Scotiabank.
 * The doctor selects the bank when uploading — no auto-detection needed.
 */

export interface ParsedMovement {
  transactionDate: string; // YYYY-MM-DD
  description: string;
  reference: string | null;
  amount: number; // always positive
  movementType: 'deposit' | 'withdrawal';
  balance: number | null;
}

export interface ParseResult {
  movements: ParsedMovement[];
  totalDeposits: number;
  totalWithdrawals: number;
  endingBalance: number | null;
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function parseDecimal(raw: string): number {
  if (!raw || raw.trim() === '') return 0;
  // Remove currency symbols, spaces, thousand separators (comma or period)
  // Mexican format: 1,234.56 or 1.234,56
  let cleaned = raw.trim().replace(/[$\s]/g, '');

  // Detect European format (1.234,56) vs American (1,234.56)
  const lastComma = cleaned.lastIndexOf(',');
  const lastDot = cleaned.lastIndexOf('.');
  if (lastComma > lastDot) {
    // European: commas are decimal separator
    cleaned = cleaned.replace(/\./g, '').replace(',', '.');
  } else {
    // American: dots are decimal separator
    cleaned = cleaned.replace(/,/g, '');
  }

  const n = parseFloat(cleaned);
  return isNaN(n) ? 0 : n;
}

function parseDate(raw: string, format: 'dmy' | 'ymd' | 'mdy' = 'dmy'): string {
  if (!raw || raw.trim() === '') return '';
  const cleaned = raw.trim();

  // Try ISO format first (YYYY-MM-DD or YYYY/MM/DD)
  const isoMatch = cleaned.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
  if (isoMatch) {
    return `${isoMatch[1]}-${isoMatch[2].padStart(2, '0')}-${isoMatch[3].padStart(2, '0')}`;
  }

  // DD/MM/YYYY or DD-MM-YYYY (most common in Mexico)
  const dmyMatch = cleaned.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{2,4})/);
  if (dmyMatch) {
    let [, a, b, c] = dmyMatch;
    let year = c.length === 2 ? `20${c}` : c;
    if (format === 'dmy') return `${year}-${b.padStart(2, '0')}-${a.padStart(2, '0')}`;
    if (format === 'mdy') return `${year}-${a.padStart(2, '0')}-${b.padStart(2, '0')}`;
  }

  return '';
}

function splitCSVLine(line: string, delimiter: string = ','): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === delimiter && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += ch;
    }
  }
  result.push(current.trim());
  return result;
}

function detectDelimiter(firstLine: string): string {
  const commas = (firstLine.match(/,/g) || []).length;
  const semicolons = (firstLine.match(/;/g) || []).length;
  const tabs = (firstLine.match(/\t/g) || []).length;
  if (tabs > commas && tabs > semicolons) return '\t';
  if (semicolons > commas) return ';';
  return ',';
}

// ─── Bank Parsers ───────────────────────────────────────────────────────────

/**
 * BBVA México
 * Typical columns: Fecha, Concepto, Cargo, Abono, Saldo
 * Date format: DD/MM/YYYY
 */
function parseBBVA(lines: string[], delimiter: string): ParsedMovement[] {
  const movements: ParsedMovement[] = [];
  // Skip header row(s)
  const dataStart = lines.findIndex(l => {
    const lower = l.toLowerCase();
    return lower.includes('fecha') && (lower.includes('cargo') || lower.includes('abono'));
  });
  if (dataStart === -1) return movements;

  for (let i = dataStart + 1; i < lines.length; i++) {
    const cols = splitCSVLine(lines[i], delimiter);
    if (cols.length < 4 || !cols[0].trim()) continue;

    const date = parseDate(cols[0]);
    if (!date) continue;

    const concept = cols[1] || '';
    const cargo = parseDecimal(cols[2]);
    const abono = parseDecimal(cols[3]);
    const saldo = cols.length >= 5 ? parseDecimal(cols[4]) : null;

    if (cargo > 0) {
      movements.push({ transactionDate: date, description: concept, reference: null, amount: cargo, movementType: 'withdrawal', balance: saldo });
    }
    if (abono > 0) {
      movements.push({ transactionDate: date, description: concept, reference: null, amount: abono, movementType: 'deposit', balance: saldo });
    }
    // Some lines may have both cargo=0 and abono=0, skip those
  }
  return movements;
}

/**
 * Banorte
 * Typical columns: Fecha, Referencia, Concepto, Cargo, Abono, Saldo
 * Date format: DD/MM/YYYY
 */
function parseBanorte(lines: string[], delimiter: string): ParsedMovement[] {
  const movements: ParsedMovement[] = [];
  const dataStart = lines.findIndex(l => {
    const lower = l.toLowerCase();
    return lower.includes('fecha') && lower.includes('referencia');
  });
  if (dataStart === -1) return movements;

  for (let i = dataStart + 1; i < lines.length; i++) {
    const cols = splitCSVLine(lines[i], delimiter);
    if (cols.length < 5 || !cols[0].trim()) continue;

    const date = parseDate(cols[0]);
    if (!date) continue;

    const reference = cols[1] || null;
    const concept = cols[2] || '';
    const cargo = parseDecimal(cols[3]);
    const abono = parseDecimal(cols[4]);
    const saldo = cols.length >= 6 ? parseDecimal(cols[5]) : null;

    if (cargo > 0) {
      movements.push({ transactionDate: date, description: concept, reference, amount: cargo, movementType: 'withdrawal', balance: saldo });
    }
    if (abono > 0) {
      movements.push({ transactionDate: date, description: concept, reference, amount: abono, movementType: 'deposit', balance: saldo });
    }
  }
  return movements;
}

/**
 * HSBC
 * Typical columns: Fecha, Descripcion, Retiros, Depositos, Saldo
 * Date format: DD/MM/YYYY
 */
function parseHSBC(lines: string[], delimiter: string): ParsedMovement[] {
  const movements: ParsedMovement[] = [];
  const dataStart = lines.findIndex(l => {
    const lower = l.toLowerCase();
    return lower.includes('fecha') && (lower.includes('retiro') || lower.includes('deposito'));
  });
  if (dataStart === -1) return movements;

  for (let i = dataStart + 1; i < lines.length; i++) {
    const cols = splitCSVLine(lines[i], delimiter);
    if (cols.length < 4 || !cols[0].trim()) continue;

    const date = parseDate(cols[0]);
    if (!date) continue;

    const description = cols[1] || '';
    const retiro = parseDecimal(cols[2]);
    const deposito = parseDecimal(cols[3]);
    const saldo = cols.length >= 5 ? parseDecimal(cols[4]) : null;

    if (retiro > 0) {
      movements.push({ transactionDate: date, description, reference: null, amount: retiro, movementType: 'withdrawal', balance: saldo });
    }
    if (deposito > 0) {
      movements.push({ transactionDate: date, description, reference: null, amount: deposito, movementType: 'deposit', balance: saldo });
    }
  }
  return movements;
}

/**
 * Santander
 * Typical columns: Fecha, Concepto, Referencia, Cargo, Abono, Saldo
 * Date format: DD/MM/YYYY
 */
function parseSantander(lines: string[], delimiter: string): ParsedMovement[] {
  // Same structure as Banorte but column order may differ
  return parseBanorte(lines, delimiter);
}

/**
 * Scotiabank
 * Typical columns: Fecha, Descripcion, Referencia, Debito, Credito, Saldo
 * Date format: DD/MM/YYYY
 */
function parseScotiabank(lines: string[], delimiter: string): ParsedMovement[] {
  // Same structure as Banorte (fecha, ref/desc, cargo/debito, abono/credito, saldo)
  return parseBanorte(lines, delimiter);
}

/**
 * Generic fallback — tries to detect columns by header names
 */
function parseGeneric(lines: string[], delimiter: string): ParsedMovement[] {
  const movements: ParsedMovement[] = [];
  if (lines.length < 2) return movements;

  const headerLine = lines.findIndex(l => {
    const lower = l.toLowerCase();
    return lower.includes('fecha') || lower.includes('date');
  });
  if (headerLine === -1) return movements;

  const headers = splitCSVLine(lines[headerLine], delimiter).map(h => h.toLowerCase().trim());

  // Find column indexes
  const dateIdx = headers.findIndex(h => h.includes('fecha') || h === 'date');
  const descIdx = headers.findIndex(h => h.includes('concepto') || h.includes('descripcion') || h.includes('description'));
  const refIdx = headers.findIndex(h => h.includes('referencia') || h.includes('reference'));
  const cargoIdx = headers.findIndex(h => h.includes('cargo') || h.includes('retiro') || h.includes('debito') || h.includes('withdrawal'));
  const abonoIdx = headers.findIndex(h => h.includes('abono') || h.includes('deposito') || h.includes('credito') || h.includes('deposit'));
  const saldoIdx = headers.findIndex(h => h.includes('saldo') || h.includes('balance'));
  // Some banks have a single "monto"/"amount" column (positive=deposit, negative=withdrawal)
  const montoIdx = headers.findIndex(h => h.includes('monto') || h.includes('amount') || h.includes('importe'));

  if (dateIdx === -1) return movements;

  for (let i = headerLine + 1; i < lines.length; i++) {
    const cols = splitCSVLine(lines[i], delimiter);
    if (!cols[dateIdx]?.trim()) continue;

    const date = parseDate(cols[dateIdx]);
    if (!date) continue;

    const description = descIdx >= 0 ? (cols[descIdx] || '') : '';
    const reference = refIdx >= 0 ? (cols[refIdx] || null) : null;
    const saldo = saldoIdx >= 0 ? parseDecimal(cols[saldoIdx]) : null;

    if (montoIdx >= 0 && cargoIdx === -1 && abonoIdx === -1) {
      // Single amount column
      const monto = parseDecimal(cols[montoIdx]);
      if (monto === 0) continue;
      movements.push({
        transactionDate: date,
        description,
        reference,
        amount: Math.abs(monto),
        movementType: monto > 0 ? 'deposit' : 'withdrawal',
        balance: saldo,
      });
    } else {
      const cargo = cargoIdx >= 0 ? parseDecimal(cols[cargoIdx]) : 0;
      const abono = abonoIdx >= 0 ? parseDecimal(cols[abonoIdx]) : 0;

      if (cargo > 0) {
        movements.push({ transactionDate: date, description, reference, amount: cargo, movementType: 'withdrawal', balance: saldo });
      }
      if (abono > 0) {
        movements.push({ transactionDate: date, description, reference, amount: abono, movementType: 'deposit', balance: saldo });
      }
    }
  }
  return movements;
}

// ─── Main Export ─────────────────────────────────────────────────────────────

export type SupportedBank = 'bbva' | 'banorte' | 'hsbc' | 'santander' | 'scotiabank' | 'otro';

const BANK_PARSERS: Record<SupportedBank, (lines: string[], delimiter: string) => ParsedMovement[]> = {
  bbva: parseBBVA,
  banorte: parseBanorte,
  hsbc: parseHSBC,
  santander: parseSantander,
  scotiabank: parseScotiabank,
  otro: parseGeneric,
};

export function parseBankStatementCSV(csvContent: string, bank: SupportedBank): ParseResult {
  const lines = csvContent
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .split('\n')
    .filter(l => l.trim().length > 0);

  if (lines.length < 2) {
    throw new Error('El archivo CSV está vacío o no tiene datos suficientes');
  }

  const delimiter = detectDelimiter(lines[0]);
  const parser = BANK_PARSERS[bank] || parseGeneric;
  const movements = parser(lines, delimiter);

  if (movements.length === 0) {
    throw new Error('No se pudieron extraer movimientos del archivo. Verifica que el formato corresponda al banco seleccionado.');
  }

  const totalDeposits = movements
    .filter(m => m.movementType === 'deposit')
    .reduce((sum, m) => sum + m.amount, 0);

  const totalWithdrawals = movements
    .filter(m => m.movementType === 'withdrawal')
    .reduce((sum, m) => sum + m.amount, 0);

  // Ending balance = last movement's balance, if available
  const lastWithBalance = [...movements].reverse().find(m => m.balance !== null);
  const endingBalance = lastWithBalance?.balance ?? null;

  return { movements, totalDeposits, totalWithdrawals, endingBalance };
}
