export type CurrencyCode = 'CNY' | 'NZD' | 'USD' | 'EUR' | 'GBP' | 'AUD' | 'CAD';

export interface CurrencyConfig {
  code: CurrencyCode;
  symbol: string;
  decimals: number;
}

export type DateFormat = 'DD/MM' | 'MM/DD' | 'YYYY-MM-DD';

export type PeriodCadence = 'monthly' | 'fortnightly' | 'weekly' | 'custom';

export interface PeriodConfig {
  cadence: PeriodCadence;
  monthName: string;
  year: number;
  startDate: string;
  endDate: string;
  dueDate: string;
  customTitle?: string;
}

export type FieldType = 'date' | 'select' | 'number' | 'text';
export type FieldCategory = 'recognition' | 'note';

export interface FieldDefinition {
  id: string;
  name: string;
  key: string;
  type: FieldType;
  options?: string[];
  isRateKey: boolean;
  category: FieldCategory;
  required: boolean;
  helpText?: string;
}

export interface RateEntry {
  id: string;
  item: string;
  unit: string;
  rate: number;
  colour?: string;
  description?: string;
}

export interface BoundingBox {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface FieldConfidenceValue {
  value: string | number;
  confidence: number;
  isEdited?: boolean;
}

export interface RecognitionRow {
  rowId: string;
  lineLabel?: string; // e.g., '3a', '3b', '3c' for rows split from a single notebook line
  splitGroupId?: string; // shared ID linking rows split from the same source line
  isFirstInSplitGroup?: boolean; // shows 'split from one line' tag
  dimensions?: string; // e.g., '80 × 1.9 m' (informational only, never used in pricing)
  qtyBreakdown?: string; // e.g., '26 + 26 + 16' shown on Qty hover
  boundingBox: BoundingBox;
  fields: {
    [key: string]: FieldConfidenceValue;
  };
  notes?: {
    [key: string]: string;
  };
}

export interface ScannedPage {
  pageId: string;
  workerId: string;
  workerName: string;
  imageUrl: string;
  status: 'flagged' | 'approved';
  scannedAt: string;
  notebookLabel?: string;
  rows: RecognitionRow[];
}

export type WorkerStatus = 'not_in' | 'to_check' | 'ready' | 'paid';

export interface WorkerProfile {
  id: string;
  name: string; // Display name (e.g. Worker A)
  code: string; // Reference label (e.g. Worker A)
  avatarColor: string;
  active: boolean; // Active / Inactive
  paid: boolean;
  paidAt?: string;
  joinedDate: string; // YYYY-MM-DD
  role?: string;
}

export interface Worker extends WorkerProfile {
  // All derived dynamically from ScannedPage[] + RateEntry[]
  status: WorkerStatus;
  flaggedPagesCount: number;
  approvedPagesCount: number;
  totalPages: number;
  outputByUnit: Record<string, number>;
  totalAmount: number;
}

export interface HistoryWorkerEntry {
  date: string;
  item: string;
  colour: string;
  qty: number;
  unit: string;
  rate: number;
  amount: number;
}

export interface HistoryWorkerSummary {
  workerId: string;
  displayName: string;
  referenceLabel: string;
  pagesCount: number;
  entries: HistoryWorkerEntry[];
  totalAmount: number;
}

export interface HistoryPeriod {
  id: string;
  title: string;
  dateRange: string;
  startDate: string;
  endDate: string;
  workersSubmitted: number;
  totalWorkers: number;
  totalAmount: number;
  status: 'paid' | 'closed';
  payoutDate: string;
  workerSummaries: HistoryWorkerSummary[];
}

export type AppView =
  | 'home'
  | 'review'
  | 'workers'
  | 'worker-detail'
  | 'scan'
  | 'history'
  | 'settings';
