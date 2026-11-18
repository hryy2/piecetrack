import { CurrencyConfig, DateFormat, PeriodConfig, RateEntry, RecognitionRow, WorkerProfile } from '../types';

/**
 * Format monetary values strictly according to active currency configuration.
 */
export function formatCurrency(amount: number | undefined | null, config: CurrencyConfig): string {
  const safeAmount = typeof amount === 'number' && !isNaN(amount) ? amount : 0;

  const fixed = safeAmount.toLocaleString('en-US', {
    minimumFractionDigits: config.decimals,
    maximumFractionDigits: config.decimals,
  });

  return `${config.symbol}${fixed}`;
}

/**
 * Format dates according to active workshop configuration: DD/MM, MM/DD, or YYYY-MM-DD.
 */
export function formatDate(dateString: string | undefined | null, format: DateFormat): string {
  if (!dateString) return '—';

  const parts = dateString.split(/[-/T]/);
  if (parts.length < 3) return dateString;

  const [year, month, day] = parts;
  const padDay = day.padStart(2, '0');
  const padMonth = month.padStart(2, '0');

  switch (format) {
    case 'DD/MM':
      return `${padDay}/${padMonth}`;
    case 'MM/DD':
      return `${padMonth}/${padDay}`;
    case 'YYYY-MM-DD':
      return `${year}-${padMonth}-${padDay}`;
    default:
      return `${padDay}/${padMonth}`;
  }
}

/**
 * Generate period title dynamically based on cadence
 */
export function getPeriodTitle(config: PeriodConfig): string {
  if (config.customTitle && config.cadence === 'custom') {
    return config.customTitle;
  }

  switch (config.cadence) {
    case 'monthly':
      return `${config.monthName} payout`;
    case 'weekly':
      return `Week of ${formatShortDate(config.startDate)}`;
    case 'fortnightly':
      return `${formatShortDate(config.startDate)} – ${formatShortDate(config.endDate)}`;
    case 'custom':
      return `${formatShortDate(config.startDate)} – ${formatShortDate(config.endDate)}`;
  }
}

function formatShortDate(isoDate: string): string {
  if (!isoDate) return '';
  const d = new Date(isoDate);
  if (isNaN(d.getTime())) return isoDate;
  const day = d.getDate();
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${day} ${months[d.getMonth()]}`;
}

/**
 * Default model confidence threshold: 0.80 (80%).
 */
export const DEFAULT_CONFIDENCE_THRESHOLD = 0.80;

export function isLowConfidence(
  confidence: number | undefined,
  threshold: number = DEFAULT_CONFIDENCE_THRESHOLD
): boolean {
  if (typeof confidence !== 'number') return false;
  return confidence < threshold;
}

/**
 * Match a row with the workshop's piece rate table.
 * Primary key is the combination of rate-participating fields (Item + Unit + optional Colour).
 */
export function matchRate(row: RecognitionRow, rateTable: RateEntry[]): RateEntry | undefined {
  const itemVal = String(row.fields['item']?.value || '').trim().toLowerCase();
  const unitVal = String(row.fields['unit']?.value || '').trim().toLowerCase();
  const colourVal = String(row.fields['colour']?.value || '').trim().toLowerCase();

  if (colourVal) {
    const exactColourMatch = rateTable.find(r =>
      r.item.toLowerCase() === itemVal &&
      r.unit.toLowerCase() === unitVal &&
      r.colour?.toLowerCase() === colourVal
    );
    if (exactColourMatch) return exactColourMatch;
  }

  const exactItemUnit = rateTable.find(r =>
    r.item.toLowerCase() === itemVal &&
    r.unit.toLowerCase() === unitVal
  );
  if (exactItemUnit) return exactItemUnit;

  const fallbackItem = rateTable.find(r =>
    r.item.toLowerCase() === itemVal
  );
  return fallbackItem;
}

/**
 * Calculate amount for a row based on matched rate (dimensions never enter calculation).
 */
export function calculateRowAmount(row: RecognitionRow, rateTable: RateEntry[]): {
  rate: number;
  amount: number;
  matchedRate?: RateEntry;
} {
  const matched = matchRate(row, rateTable);
  const qtyVal = Number(row.fields['qty']?.value) || 0;
  const rate = matched ? matched.rate : 0;
  const amount = Number((qtyVal * rate).toFixed(4));
  return { rate, amount, matchedRate: matched };
}

/**
 * Format unit-grouped output quantities without ever summing across different units.
 * Example: { set: 50, pc: 30 } -> "50 set · 30 pc"
 */
export function formatOutputByUnit(outputByUnit: Record<string, number> | undefined): string {
  if (!outputByUnit) return '—';
  const parts = Object.entries(outputByUnit)
    .filter(([, qty]) => qty > 0)
    .map(([unit, qty]) => `${qty} ${unit}`);
  return parts.length > 0 ? parts.join(' · ') : '—';
}

/**
 * Aggregate entries by unit without mixing incompatible units.
 */
export function aggregateOutputByUnit(entries: Array<{ unit: string; qty: number }>): Record<string, number> {
  const map: Record<string, number> = {};
  entries.forEach(entry => {
    const unit = (entry.unit || 'pc').trim();
    const qty = Number(entry.qty) || 0;
    if (qty > 0) {
      map[unit] = (map[unit] || 0) + qty;
    }
  });
  return map;
}

/**
 * Display worker label cleanly:
 * - If display name and reference label match (e.g., both "Worker A"), return "Worker A" (no parentheses).
 * - If distinct, return "Display Name (Reference Label)" e.g. "Chen Liu (Worker C)".
 */
export function formatWorkerLabel(displayName: string, referenceLabel?: string): string {
  const dn = (displayName || '').trim();
  const ref = (referenceLabel || '').trim();
  if (!ref || dn.toLowerCase() === ref.toLowerCase()) {
    return dn || ref;
  }
  return `${dn} (${ref})`;
}

/**
 * Get short initials for avatar circle
 */
export function getWorkerInitials(displayName: string, referenceLabel?: string): string {
  const target = (displayName || referenceLabel || 'W').trim();
  const workerMatch = target.match(/^Worker\s+([A-Z0-9]+)$/i);
  if (workerMatch) {
    return workerMatch[1].toUpperCase().slice(0, 2);
  }
  const initials = target
    .split(/\s+/)
    .map(part => part[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
  return initials || 'W';
}

/**
 * Find next available alphabetical Reference label ("Worker A" .. "Worker Z")
 */
export function getNextReferenceLabel(workers: WorkerProfile[]): string {
  const usedLetters = new Set<string>();
  workers.forEach(w => {
    const match = w.code.trim().match(/^Worker\s+([A-Z]+)$/i);
    if (match) {
      usedLetters.add(match[1].toUpperCase());
    }
  });

  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  for (let i = 0; i < alphabet.length; i++) {
    const letter = alphabet[i];
    if (!usedLetters.has(letter)) {
      return `Worker ${letter}`;
    }
  }
  return `Worker ${workers.length + 1}`;
}

/**
 * RFC 4180 CSV cell escaping
 */
export function escapeCsvCell(value: string | number | undefined | null): string {
  const str = value === undefined || value === null ? '' : String(value);
  if (/[",\r\n]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

/**
 * Build UTF-8 BOM CSV Blob and trigger browser download so Windows Chinese Excel opens cleanly without mojibake
 */
export function downloadUtf8BomCsv(rows: Array<Array<string | number>>, filename: string): void {
  const csvText = rows
    .map(row => row.map(cell => escapeCsvCell(cell)).join(','))
    .join('\r\n');

  const blob = new Blob(['\uFEFF' + csvText], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
