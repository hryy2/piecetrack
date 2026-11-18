import React, { createContext, useContext, useState, useMemo } from 'react';
import {
  AppView,
  CurrencyConfig,
  DateFormat,
  FieldDefinition,
  HistoryPeriod,
  PeriodConfig,
  RateEntry,
  RecognitionRow,
  ScannedPage,
  Worker,
  WorkerProfile,
  WorkerStatus,
} from '../types';
import {
  initialCurrency,
  initialDateFormat,
  initialFieldDefinitions,
  initialHistoryPeriods,
  initialPeriod,
  initialRateTable,
  initialScannedPages,
  initialWorkers,
} from '../mock/initialData';
import {
  aggregateOutputByUnit,
  calculateRowAmount,
  DEFAULT_CONFIDENCE_THRESHOLD,
  formatWorkerLabel,
  isLowConfidence,
} from '../utils/formatters';

interface NewWorkerInput {
  name: string;
  code: string;
  role?: string;
  joinedDate: string;
  active: boolean;
}

interface UpdateWorkerInput {
  name: string;
  code: string;
  role?: string;
  joinedDate: string;
  active: boolean;
}

type WorkerDetailOrigin = 'home' | 'workers';

interface AppContextType {
  // Navigation
  activeView: AppView;
  setActiveView: (view: AppView) => void;
  selectedWorkerId: string | null;
  setSelectedWorkerId: (id: string | null) => void;
  workerDetailOrigin: WorkerDetailOrigin;
  selectedPageId: string | null;
  setSelectedPageId: (id: string | null) => void;
  activeRowId: string | null;
  setActiveRowId: (id: string | null) => void;
  openWorkerDetail: (workerId: string, origin?: WorkerDetailOrigin) => void;
  openReviewPage: (pageId?: string) => void;

  // Configurations
  currency: CurrencyConfig;
  updateCurrency: (config: Partial<CurrencyConfig>) => void;
  dateFormat: DateFormat;
  updateDateFormat: (format: DateFormat) => void;
  period: PeriodConfig;
  updatePeriod: (config: Partial<PeriodConfig>) => void;
  fieldDefinitions: FieldDefinition[];
  updateFieldDefinitions: (fields: FieldDefinition[]) => void;
  addFieldDefinition: (field: Omit<FieldDefinition, 'id'>) => void;
  deleteFieldDefinition: (id: string) => void;
  rateTable: RateEntry[];
  updateRateTable: (rates: RateEntry[]) => void;
  addRateEntry: (entry: Omit<RateEntry, 'id'>) => void;
  deleteRateEntry: (id: string) => void;
  ocrLanguage: 'en' | 'zh';
  setOcrLanguage: (lang: 'en' | 'zh') => void;
  confidenceThreshold: number;
  updateConfidenceThreshold: (threshold: number) => void;

  // Derived & Single-Source Data
  workers: Worker[];
  activeWorkers: Worker[];
  pages: ScannedPage[];
  historyPeriods: HistoryPeriod[];

  // Worker CRUD & History Checks
  addWorker: (input: NewWorkerInput) => WorkerProfile;
  updateWorker: (workerId: string, input: UpdateWorkerInput) => void;
  deleteWorker: (workerId: string) => boolean;
  hasSettlementHistory: (workerId: string) => boolean;

  // Operations
  approvePage: (pageId: string) => void;
  updateRowField: (pageId: string, rowId: string, fieldKey: string, newValue: string | number) => void;
  updateRowNote: (pageId: string, rowId: string, noteKey: string, val: string) => void;
  addRow: (pageId: string) => void;
  deleteRow: (pageId: string, rowId: string) => void;
  toggleWorkerPaid: (workerId: string) => void;
  addNewScannedUpload: (workerId: string, notebookLabel: string, rows?: RecognitionRow[]) => string;

  // Computations (all derived from single source of truth)
  runningTotal: number;
  stillToPay: number;
  totalPagesCount: number;
  flaggedPagesCount: number;
  submittedWorkersCount: number;
  readyWorkersCount: number;
  paidWorkersCount: number;
  flaggedPages: ScannedPage[];
  activePage: ScannedPage | undefined;
  activeWorker: Worker | undefined;
}

const AVATAR_PALETTE = [
  'bg-[var(--brand-600)] text-white',
];

const AppContext = createContext<AppContextType | undefined>(undefined);

function deriveWorkerFromPages(
  profile: WorkerProfile,
  pages: ScannedPage[],
  rateTable: RateEntry[]
): Worker {
  const workerPages = pages.filter(p => p.workerId === profile.id);
  const totalPages = workerPages.length;
  const flaggedPagesCount = workerPages.filter(p => p.status === 'flagged').length;
  const approvedPagesCount = workerPages.filter(p => p.status === 'approved').length;

  let totalAmount = 0;
  const rawEntries: Array<{ unit: string; qty: number }> = [];

  workerPages.forEach(page => {
    page.rows.forEach(row => {
      const qty = Number(row.fields['qty']?.value) || 0;
      const unit = String(row.fields['unit']?.value || 'pc');
      rawEntries.push({ unit, qty });
      const { amount } = calculateRowAmount(row, rateTable);
      totalAmount += amount;
    });
  });

  const roundedAmount = Number(totalAmount.toFixed(4));

  let status: WorkerStatus;
  if (totalPages === 0) {
    status = 'not_in';
  } else if (flaggedPagesCount > 0) {
    status = 'to_check';
  } else if (profile.paid && roundedAmount > 0 && approvedPagesCount > 0) {
    status = 'paid';
  } else {
    status = 'ready';
  }

  return {
    ...profile,
    status,
    totalPages,
    flaggedPagesCount,
    approvedPagesCount,
    outputByUnit: aggregateOutputByUnit(rawEntries),
    totalAmount: roundedAmount,
  };
}

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Navigation
  const [activeView, setActiveView] = useState<AppView>('home');
  const [selectedWorkerId, setSelectedWorkerId] = useState<string | null>(null);
  const [workerDetailOrigin, setWorkerDetailOrigin] = useState<WorkerDetailOrigin>('workers');
  const [selectedPageId, setSelectedPageId] = useState<string | null>('p_0031');
  const [activeRowId, setActiveRowId] = useState<string | null>('r_2');

  // Configs
  const [currency, setCurrency] = useState<CurrencyConfig>(initialCurrency);
  const [dateFormat, setDateFormat] = useState<DateFormat>(initialDateFormat);
  const [period, setPeriod] = useState<PeriodConfig>(initialPeriod);
  const [fieldDefinitions, setFieldDefinitions] = useState<FieldDefinition[]>(initialFieldDefinitions);
  const [rateTable, setRateTable] = useState<RateEntry[]>(initialRateTable);
  const [ocrLanguage, setOcrLanguage] = useState<'en' | 'zh'>('zh');
  const [confidenceThreshold, setConfidenceThreshold] = useState<number>(DEFAULT_CONFIDENCE_THRESHOLD);

  // Single Source of Truth State: workerProfiles + scanned pages + historyPeriods
  const [workerProfiles, setWorkerProfiles] = useState<WorkerProfile[]>(initialWorkers);
  const [pages, setPages] = useState<ScannedPage[]>(initialScannedPages);
  const [historyPeriods] = useState<HistoryPeriod[]>(initialHistoryPeriods);

  // Derived Workers
  const workers = useMemo(() => {
    return workerProfiles.map(profile => deriveWorkerFromPages(profile, pages, rateTable));
  }, [workerProfiles, pages, rateTable]);

  const activeWorkers = useMemo(() => {
    return workers.filter(w => w.active);
  }, [workers]);

  const activeWorkerIds = useMemo(() => {
    return new Set(activeWorkers.map(w => w.id));
  }, [activeWorkers]);

  const flaggedPages = useMemo(() => {
    return pages.filter(p => p.status === 'flagged' && activeWorkerIds.has(p.workerId));
  }, [pages, activeWorkerIds]);

  const flaggedPagesCount = flaggedPages.length;

  const totalPagesCount = useMemo(() => {
    return activeWorkers.reduce((sum, w) => sum + w.totalPages, 0);
  }, [activeWorkers]);

  const runningTotal = useMemo(() => {
    const sum = activeWorkers.reduce((total, w) => total + w.totalAmount, 0);
    return Number(sum.toFixed(4));
  }, [activeWorkers]);

  // Remaining unpaid total across active workers
  const stillToPay = useMemo(() => {
    const sum = activeWorkers
      .filter(w => w.status !== 'paid')
      .reduce((total, w) => total + w.totalAmount, 0);
    return Number(sum.toFixed(4));
  }, [activeWorkers]);

  const submittedWorkersCount = useMemo(() => {
    return activeWorkers.filter(w => w.status !== 'not_in').length;
  }, [activeWorkers]);

  const readyWorkersCount = useMemo(() => {
    return activeWorkers.filter(w => w.status === 'ready').length;
  }, [activeWorkers]);

  const paidWorkersCount = useMemo(() => {
    return activeWorkers.filter(w => w.status === 'paid').length;
  }, [activeWorkers]);

  const activePage = useMemo(() => {
    return pages.find(p => p.pageId === selectedPageId) || pages[0];
  }, [pages, selectedPageId]);

  const activeWorker = useMemo(() => {
    if (selectedWorkerId) {
      return workers.find(w => w.id === selectedWorkerId);
    }
    if (activePage) {
      return workers.find(w => w.id === activePage.workerId);
    }
    return workers[0];
  }, [workers, selectedWorkerId, activePage]);

  // Update confidence threshold & re-evaluate page statuses against new threshold
  const updateConfidenceThreshold = (newThreshold: number) => {
    const clamped = Math.min(0.95, Math.max(0.50, Number(newThreshold.toFixed(2))));
    setConfidenceThreshold(clamped);
    setPages(prev =>
      prev.map(p => {
        const hasLow = p.rows.some(row =>
          Object.values(row.fields).some(f => isLowConfidence(f.confidence, clamped))
        );
        return {
          ...p,
          status: hasLow ? ('flagged' as const) : ('approved' as const),
        };
      })
    );
  };

  // Worker CRUD & History Check
  const hasSettlementHistory = (workerId: string): boolean => {
    const inHistory = historyPeriods.some(hp =>
      hp.workerSummaries.some(ws => ws.workerId === workerId)
    );
    const inCurrentPages = pages.some(p => p.workerId === workerId);
    return inHistory || inCurrentPages;
  };

  const addWorker = (input: NewWorkerInput): WorkerProfile => {
    const newId = `w_${Date.now().toString(36)}`;
    const colorClass = AVATAR_PALETTE[workerProfiles.length % AVATAR_PALETTE.length];
    const newProfile: WorkerProfile = {
      id: newId,
      name: input.name.trim(),
      code: input.code.trim(),
      role: input.role?.trim() || undefined,
      joinedDate: input.joinedDate,
      active: input.active,
      avatarColor: colorClass,
      paid: false,
    };
    setWorkerProfiles(prev => [...prev, newProfile]);
    return newProfile;
  };

  const updateWorker = (workerId: string, input: UpdateWorkerInput) => {
    const cleanName = input.name.trim();
    const cleanCode = input.code.trim();
    const label = formatWorkerLabel(cleanName, cleanCode);

    setWorkerProfiles(prev =>
      prev.map(w => {
        if (w.id !== workerId) return w;
        return {
          ...w,
          name: cleanName,
          code: cleanCode,
          role: input.role?.trim() || undefined,
          joinedDate: input.joinedDate,
          active: input.active,
        };
      })
    );

    setPages(prev =>
      prev.map(p => (p.workerId === workerId ? { ...p, workerName: label } : p))
    );
  };

  const deleteWorker = (workerId: string): boolean => {
    if (hasSettlementHistory(workerId)) {
      return false;
    }
    setWorkerProfiles(prev => prev.filter(w => w.id !== workerId));
    if (selectedWorkerId === workerId) {
      setSelectedWorkerId(null);
    }
    return true;
  };

  // Helpers
  const openWorkerDetail = (workerId: string, origin: WorkerDetailOrigin = 'workers') => {
    setSelectedWorkerId(workerId);
    setWorkerDetailOrigin(origin);
    setActiveView('worker-detail');
  };

  const openReviewPage = (pageId?: string) => {
    if (pageId) {
      setSelectedPageId(pageId);
    } else if (flaggedPages.length > 0) {
      setSelectedPageId(flaggedPages[0].pageId);
    } else if (pages.length > 0) {
      setSelectedPageId(pages[0].pageId);
    }
    setActiveView('review');
  };

  const approvePage = (pageId: string) => {
    const updatedPages: ScannedPage[] = pages.map(p => {
      if (p.pageId === pageId) {
        const verifiedRows = p.rows.map(r => ({
          ...r,
          fields: Object.fromEntries(
            Object.entries(r.fields).map(([k, v]) => [k, { ...v, confidence: 1.0 }])
          ),
        }));
        return {
          ...p,
          status: 'approved' as const,
          rows: verifiedRows,
        };
      }
      return p;
    });

    setPages(updatedPages);

    const remainingFlagged = updatedPages.filter(
      p => p.status === 'flagged' && activeWorkerIds.has(p.workerId)
    );
    if (remainingFlagged.length > 0) {
      setSelectedPageId(remainingFlagged[0].pageId);
      if (remainingFlagged[0].rows.length > 0) {
        setActiveRowId(remainingFlagged[0].rows[0].rowId);
      }
    } else {
      setActiveView('home');
    }
  };

  const updateRowField = (
    pageId: string,
    rowId: string,
    fieldKey: string,
    newValue: string | number
  ) => {
    setPages(prev =>
      prev.map(p => {
        if (p.pageId !== pageId) return p;

        const updatedRows = p.rows.map(r => {
          if (r.rowId !== rowId) return r;
          return {
            ...r,
            fields: {
              ...r.fields,
              [fieldKey]: {
                value: newValue,
                confidence: 1.0,
                isEdited: true,
              },
            },
          };
        });

        const hasLow = updatedRows.some(row =>
          Object.values(row.fields).some(f => isLowConfidence(f.confidence, confidenceThreshold))
        );

        return {
          ...p,
          status: hasLow ? ('flagged' as const) : ('approved' as const),
          rows: updatedRows,
        };
      })
    );
  };

  const updateRowNote = (
    pageId: string,
    rowId: string,
    noteKey: string,
    val: string
  ) => {
    setPages(prev =>
      prev.map(p => {
        if (p.pageId !== pageId) return p;
        return {
          ...p,
          rows: p.rows.map(r => {
            if (r.rowId !== rowId) return r;
            return {
              ...r,
              notes: {
                ...r.notes,
                [noteKey]: val,
              },
            };
          }),
        };
      })
    );
  };

  const addRow = (pageId: string) => {
    const newRowId = `r_${Date.now()}`;
    const newRow: RecognitionRow = {
      rowId: newRowId,
      boundingBox: { x: 0.08, y: 0.62, w: 0.84, h: 0.08 },
      fields: {
        date: { value: '2026-08-04', confidence: 1.0 },
        item: { value: 'Moisture mat', confidence: 1.0 },
        colour: { value: 'Black', confidence: 1.0 },
        qty: { value: 10, confidence: 1.0 },
        unit: { value: 'pc', confidence: 1.0 },
      },
      notes: {
        batch: 'B-2608',
        qc: '',
      },
    };

    setPages(prev =>
      prev.map(p => (p.pageId === pageId ? { ...p, rows: [...p.rows, newRow] } : p))
    );
    setActiveRowId(newRowId);
  };

  const deleteRow = (pageId: string, rowId: string) => {
    setPages(prev =>
      prev.map(p => {
        if (p.pageId !== pageId) return p;
        const filtered = p.rows.filter(r => r.rowId !== rowId);
        const hasLow = filtered.some(row =>
          Object.values(row.fields).some(f => isLowConfidence(f.confidence, confidenceThreshold))
        );
        return {
          ...p,
          status: hasLow ? ('flagged' as const) : ('approved' as const),
          rows: filtered,
        };
      })
    );
  };

  const toggleWorkerPaid = (workerId: string) => {
    const derived = workers.find(w => w.id === workerId);
    if (!derived) return;

    if (!derived.paid && (derived.totalAmount <= 0 || derived.approvedPagesCount === 0)) {
      return;
    }

    setWorkerProfiles(prev =>
      prev.map(w => {
        if (w.id !== workerId) return w;
        const willBePaid = !w.paid;
        return {
          ...w,
          paid: willBePaid,
          paidAt: willBePaid ? new Date().toISOString().replace('T', ' ').slice(0, 16) : undefined,
        };
      })
    );
  };

  const updateCurrency = (config: Partial<CurrencyConfig>) => {
    setCurrency(prev => ({ ...prev, ...config }));
  };

  const updateDateFormat = (format: DateFormat) => {
    setDateFormat(format);
  };

  const updatePeriod = (config: Partial<PeriodConfig>) => {
    setPeriod(prev => ({ ...prev, ...config }));
  };

  const updateFieldDefinitions = (fields: FieldDefinition[]) => {
    setFieldDefinitions(fields);
  };

  const addFieldDefinition = (field: Omit<FieldDefinition, 'id'>) => {
    const newDef: FieldDefinition = {
      ...field,
      id: `f_${Date.now()}`,
    };
    setFieldDefinitions(prev => [...prev, newDef]);
  };

  const deleteFieldDefinition = (id: string) => {
    setFieldDefinitions(prev => prev.filter(f => f.id !== id));
  };

  const updateRateTable = (rates: RateEntry[]) => {
    setRateTable(rates);
  };

  const addRateEntry = (entry: Omit<RateEntry, 'id'>) => {
    const newEntry: RateEntry = {
      ...entry,
      id: `rate_${Date.now()}`,
    };
    setRateTable(prev => [...prev, newEntry]);
  };

  const deleteRateEntry = (id: string) => {
    setRateTable(prev => prev.filter(r => r.id !== id));
  };

  const addNewScannedUpload = (
    workerId: string,
    notebookLabel: string,
    customRows?: RecognitionRow[]
  ): string => {
    const newPageId = `p_${Date.now().toString().slice(-4)}`;
    const profile = workerProfiles.find(w => w.id === workerId);
    const workerName = profile ? formatWorkerLabel(profile.name, profile.code) : 'Worker';

    const defaultRows: RecognitionRow[] = customRows || [
      {
        rowId: `r_${Date.now()}_1`,
        boundingBox: { x: 0.08, y: 0.22, w: 0.84, h: 0.08 },
        fields: {
          date: { value: '2026-08-05', confidence: 0.96 },
          item: { value: 'Moisture mat', confidence: 0.95 },
          colour: { value: 'Black', confidence: 0.93 },
          qty: { value: 75, confidence: 0.72 },
          unit: { value: 'pc', confidence: 0.95 },
        },
        notes: { batch: 'B-2608', qc: '' },
      },
      {
        rowId: `r_${Date.now()}_2`,
        boundingBox: { x: 0.08, y: 0.32, w: 0.84, h: 0.08 },
        fields: {
          date: { value: '2026-08-05', confidence: 0.98 },
          item: { value: 'Quilted pouch', confidence: 0.97 },
          colour: { value: 'Natural', confidence: 0.91 },
          qty: { value: 40, confidence: 0.94 },
          unit: { value: 'pc', confidence: 0.96 },
        },
        notes: { batch: 'B-2608', qc: '' },
      },
    ];

    const hasLow = defaultRows.some(r =>
      Object.values(r.fields).some(f => isLowConfidence(f.confidence, confidenceThreshold))
    );

    const newPage: ScannedPage = {
      pageId: newPageId,
      workerId,
      workerName,
      notebookLabel: notebookLabel || `${workerName} - new scan`,
      imageUrl: '/src/assets/images/notebook_page_workshop_1791250444593.jpg',
      status: hasLow ? 'flagged' : 'approved',
      scannedAt: new Date().toISOString().replace('T', ' ').slice(0, 16),
      rows: defaultRows,
    };

    setPages(prev => [newPage, ...prev]);
    if (hasLow) {
      setWorkerProfiles(prev =>
        prev.map(w => (w.id === workerId ? { ...w, paid: false, paidAt: undefined } : w))
      );
    }
    setSelectedPageId(newPageId);
    if (defaultRows.length > 0) {
      setActiveRowId(defaultRows[0].rowId);
    }
    setActiveView('review');

    return newPageId;
  };

  return (
    <AppContext.Provider
      value={{
        activeView,
        setActiveView,
        selectedWorkerId,
        setSelectedWorkerId,
        workerDetailOrigin,
        selectedPageId,
        setSelectedPageId,
        activeRowId,
        setActiveRowId,
        openWorkerDetail,
        openReviewPage,

        currency,
        updateCurrency,
        dateFormat,
        updateDateFormat,
        period,
        updatePeriod,
        fieldDefinitions,
        updateFieldDefinitions,
        addFieldDefinition,
        deleteFieldDefinition,
        rateTable,
        updateRateTable,
        addRateEntry,
        deleteRateEntry,
        ocrLanguage,
        setOcrLanguage,
        confidenceThreshold,
        updateConfidenceThreshold,

        workers,
        activeWorkers,
        pages,
        historyPeriods,

        addWorker,
        updateWorker,
        deleteWorker,
        hasSettlementHistory,

        approvePage,
        updateRowField,
        updateRowNote,
        addRow,
        deleteRow,
        toggleWorkerPaid,
        addNewScannedUpload,

        runningTotal,
        stillToPay,
        totalPagesCount,
        flaggedPagesCount,
        submittedWorkersCount,
        readyWorkersCount,
        paidWorkersCount,
        flaggedPages,
        activePage,
        activeWorker,
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
};
