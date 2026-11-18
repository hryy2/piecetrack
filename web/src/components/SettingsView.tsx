import React, { useState, useMemo } from 'react';
import {
  Layers,
  Tag,
  Coins,
  Calendar,
  Plus,
  Trash2,
  Info,
  Check,
  Globe,
  Camera,
  FileSpreadsheet,
  SlidersHorizontal,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import {
  CurrencyCode,
  DateFormat,
  FieldCategory,
  FieldType,
  PeriodCadence,
  RateEntry,
} from '../types';
import { formatCurrency, getPeriodTitle } from '../utils/formatters';
import { findUntrainedChineseChars } from '../utils/ocrTrainedSet';
import { TrainingSampleModal } from './TrainingSampleModal';

type SettingsTab = 'fields' | 'rates' | 'currency' | 'period' | 'threshold';

// Measured on 504 characters from three held-out writers.
const MEASURED_COVERAGE = [
  { threshold: 50, coverage: 82.1, accuracy: 97.6 },
  { threshold: 70, coverage: 68.3, accuracy: 99.4 },
  { threshold: 80, coverage: 56.2, accuracy: 99.7 },
  { threshold: 90, coverage: 36.9, accuracy: 100.0 },
  { threshold: 95, coverage: 20.2, accuracy: 100.0 },
] as const;

function interpolateMeasuredCoverage(thresholdPct: number): {
  coverage: number;
  accuracy: string;
} {
  const formatAcc = (val: number) => Math.min(99.9, val).toFixed(1);

  if (thresholdPct <= MEASURED_COVERAGE[0].threshold) {
    return {
      coverage: Math.round(MEASURED_COVERAGE[0].coverage),
      accuracy: formatAcc(MEASURED_COVERAGE[0].accuracy),
    };
  }
  const last = MEASURED_COVERAGE[MEASURED_COVERAGE.length - 1];
  if (thresholdPct >= last.threshold) {
    return {
      coverage: Math.round(last.coverage),
      accuracy: formatAcc(last.accuracy),
    };
  }
  for (let i = 0; i < MEASURED_COVERAGE.length - 1; i++) {
    const lower = MEASURED_COVERAGE[i];
    const upper = MEASURED_COVERAGE[i + 1];
    if (thresholdPct >= lower.threshold && thresholdPct <= upper.threshold) {
      const ratio = (thresholdPct - lower.threshold) / (upper.threshold - lower.threshold);
      return {
        coverage: Math.round(lower.coverage + ratio * (upper.coverage - lower.coverage)),
        accuracy: formatAcc(lower.accuracy + ratio * (upper.accuracy - lower.accuracy)),
      };
    }
  }
  return { coverage: 56, accuracy: '99.7' };
}

export const SettingsView: React.FC = () => {
  const {
    fieldDefinitions,
    addFieldDefinition,
    deleteFieldDefinition,
    rateTable,
    addRateEntry,
    deleteRateEntry,
    currency,
    updateCurrency,
    dateFormat,
    updateDateFormat,
    period,
    updatePeriod,
    ocrLanguage,
    setOcrLanguage,
    confidenceThreshold,
    updateConfidenceThreshold,
  } = useApp();

  const [activeTab, setActiveTab] = useState<SettingsTab>('fields');

  // Add field modal / form state
  const [showAddField, setShowAddField] = useState<boolean>(false);
  const [newFieldName, setNewFieldName] = useState<string>('');
  const [newFieldKey, setNewFieldKey] = useState<string>('');
  const [newFieldType, setNewFieldType] = useState<FieldType>('text');
  const [newFieldCategory, setNewFieldCategory] = useState<FieldCategory>('recognition');
  const [newFieldIsRateKey, setNewFieldIsRateKey] = useState<boolean>(false);
  const [newFieldOptions, setNewFieldOptions] = useState<string>('');

  // Add rate entry modal / form state
  const [showAddRate, setShowAddRate] = useState<boolean>(false);
  const [newRateItem, setNewRateItem] = useState<string>('');
  const [newRateUnit, setNewRateUnit] = useState<string>('pc');
  const [newRateValue, setNewRateValue] = useState<number>(1.0);
  const [newRateDesc, setNewRateDesc] = useState<string>('');

  // Dynamically registered characters in current session
  const [dynamicallyLearnedChars, setDynamicallyLearnedChars] = useState<Set<string>>(new Set());
  // Training sample modal active characters
  const [trainingModalChars, setTrainingModalChars] = useState<string[] | null>(null);

  const checkUntrained = (text: string): string[] => {
    if (ocrLanguage !== 'zh' || !text) return [];
    const baseUntrained = findUntrainedChineseChars(text, ocrLanguage);
    return baseUntrained.filter(c => !dynamicallyLearnedChars.has(c));
  };

  const untrainedInRate = checkUntrained(`${newRateItem} ${newRateUnit}`);
  const untrainedInField = checkUntrained(`${newFieldName} ${newFieldOptions}`);

  const handleCreateField = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFieldName.trim()) return;

    const key = newFieldKey.trim() || newFieldName.toLowerCase().replace(/\s+/g, '_');
    const options =
      newFieldType === 'select'
        ? newFieldOptions.split(',').map(s => s.trim()).filter(Boolean)
        : undefined;

    addFieldDefinition({
      name: newFieldName.trim(),
      key,
      type: newFieldType,
      category: newFieldCategory,
      isRateKey: newFieldCategory === 'recognition' ? newFieldIsRateKey : false,
      required: false,
      options,
      helpText:
        newFieldCategory === 'recognition'
          ? 'Extracted from notebook photograph'
          : 'Manually logged workshop attribute (not on photo)',
    });

    setNewFieldName('');
    setNewFieldKey('');
    setNewFieldOptions('');
    setShowAddField(false);
  };

  const handleCreateRate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRateItem.trim() || !newRateUnit.trim()) return;

    addRateEntry({
      item: newRateItem.trim(),
      unit: newRateUnit.trim(),
      rate: Number(newRateValue) || 0,
      description: newRateDesc.trim() || undefined,
    });

    setNewRateItem('');
    setNewRateUnit('pc');
    setNewRateValue(1.0);
    setNewRateDesc('');
    setShowAddRate(false);
  };

  // Group rate table entries by item name for visual grouping
  const groupedRateEntries = useMemo(() => {
    const groups: { [itemKey: string]: { item: string; entries: RateEntry[] } } = {};
    rateTable.forEach(entry => {
      const key = entry.item.trim().toLowerCase();
      if (!groups[key]) {
        groups[key] = {
          item: entry.item.trim(),
          entries: [],
        };
      }
      groups[key].entries.push(entry);
    });
    return Object.values(groups);
  }, [rateTable]);

  return (
    <div className="flex-1 flex flex-col h-full overflow-y-auto overflow-x-hidden bg-[var(--surface-page)]">
      {/* Header */}
      <header className="px-4 md:px-8 pt-5 md:pt-8 pb-5 border-b border-neutral-200/80 bg-white">
        <div className="max-w-5xl mx-auto">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div>
              <span className="text-xs font-semibold uppercase tracking-wider text-[var(--brand-800)]">
                Configuration
              </span>
              <h1 className="text-xl font-bold tracking-tight text-neutral-900 mt-0.5">
                Workshop Settings &amp; Pricing Engine
              </h1>
              <p className="text-xs text-neutral-500 mt-1">
                Customize recognition schemas, piece-rate matrices, currencies, and settlement cadences.
              </p>
            </div>

            {/* OCR Language Selector with explicit explanation */}
            <div className="flex flex-col items-start lg:items-end">
              <div className="flex flex-wrap items-center gap-2 bg-neutral-50 border border-neutral-200 p-1.5 rounded-lg w-full lg:w-auto">
                <div className="flex items-center gap-1.5 pl-1">
                  <Globe className="w-3.5 h-3.5 text-neutral-500" />
                  <span className="text-[11px] text-neutral-500 font-medium">OCR Language:</span>
                </div>
                <div className="flex items-center gap-1 flex-1 lg:flex-initial">
                  <button
                    type="button"
                    onClick={() => setOcrLanguage('zh')}
                    className={`flex-1 lg:flex-initial px-2.5 py-1.5 min-h-[38px] md:min-h-0 md:py-1 text-xs font-medium rounded transition-colors cursor-pointer ${
                      ocrLanguage === 'zh'
                        ? 'bg-[var(--brand-600)] text-white shadow-2xs'
                        : 'text-neutral-600 hover:text-neutral-900'
                    }`}
                  >
                    Chinese (中文手写)
                  </button>
                  <button
                    type="button"
                    onClick={() => setOcrLanguage('en')}
                    className={`flex-1 lg:flex-initial px-2.5 py-1.5 min-h-[38px] md:min-h-0 md:py-1 text-xs font-medium rounded transition-colors cursor-pointer ${
                      ocrLanguage === 'en'
                        ? 'bg-[var(--brand-600)] text-white shadow-2xs'
                        : 'text-neutral-600 hover:text-neutral-900'
                    }`}
                  >
                    English (Latin)
                  </button>
                </div>
              </div>
              <span className="text-[10px] text-neutral-400 mt-1">
                Controls notebook handwriting reader · UI remains in English
              </span>
            </div>
          </div>

          {/* Sub-Tabs (Horizontally scrollable strip on mobile) */}
          <div className="flex items-center gap-1 md:gap-2 mt-5 border-b border-neutral-200 -mb-5 overflow-x-auto no-scrollbar">
            <button
              onClick={() => setActiveTab('fields')}
              className={`pb-3 px-3 min-h-[44px] text-xs font-semibold border-b-2 flex items-center gap-1.5 whitespace-nowrap transition-colors shrink-0 cursor-pointer ${
                activeTab === 'fields'
                  ? 'border-[var(--brand-600)] text-[var(--brand-700)]'
                  : 'border-transparent text-neutral-500 hover:text-neutral-900'
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              <span>1. Field Template &amp; OCR</span>
            </button>

            <button
              onClick={() => setActiveTab('rates')}
              className={`pb-3 px-3 min-h-[44px] text-xs font-semibold border-b-2 flex items-center gap-1.5 whitespace-nowrap transition-colors shrink-0 cursor-pointer ${
                activeTab === 'rates'
                  ? 'border-[var(--brand-600)] text-[var(--brand-700)]'
                  : 'border-transparent text-neutral-500 hover:text-neutral-900'
              }`}
            >
              <Tag className="w-3.5 h-3.5" />
              <span>2. Piece Rate Table</span>
            </button>

            <button
              onClick={() => setActiveTab('currency')}
              className={`pb-3 px-3 min-h-[44px] text-xs font-semibold border-b-2 flex items-center gap-1.5 whitespace-nowrap transition-colors shrink-0 cursor-pointer ${
                activeTab === 'currency'
                  ? 'border-[var(--brand-600)] text-[var(--brand-700)]'
                  : 'border-transparent text-neutral-500 hover:text-neutral-900'
              }`}
            >
              <Coins className="w-3.5 h-3.5" />
              <span>3. Currency &amp; Date</span>
            </button>

            <button
              onClick={() => setActiveTab('period')}
              className={`pb-3 px-3 min-h-[44px] text-xs font-semibold border-b-2 flex items-center gap-1.5 whitespace-nowrap transition-colors shrink-0 cursor-pointer ${
                activeTab === 'period'
                  ? 'border-[var(--brand-600)] text-[var(--brand-700)]'
                  : 'border-transparent text-neutral-500 hover:text-neutral-900'
              }`}
            >
              <Calendar className="w-3.5 h-3.5" />
              <span>4. Settlement Period</span>
            </button>

            <button
              onClick={() => setActiveTab('threshold')}
              className={`pb-3 px-3 min-h-[44px] text-xs font-semibold border-b-2 flex items-center gap-1.5 whitespace-nowrap transition-colors shrink-0 cursor-pointer ${
                activeTab === 'threshold'
                  ? 'border-[var(--brand-600)] text-[var(--brand-700)]'
                  : 'border-transparent text-neutral-500 hover:text-neutral-900'
              }`}
            >
              <SlidersHorizontal className="w-3.5 h-3.5" />
              <span>5. Review Threshold</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-5xl mx-auto w-full px-4 md:px-8 py-5 md:py-8 space-y-6">
        {/* ================= TAB 1: FIELD TEMPLATE & OCR MODEL ================= */}
        {activeTab === 'fields' && (
          <div className="space-y-6">
            {/* Dedicated OCR Handwriting Model Settings Card */}
            <div className="bg-white border border-neutral-200/80 rounded-xl p-4 md:p-5 shadow-2xs space-y-4">
              <div className="flex flex-col md:flex-row md:items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <Globe className="w-4 h-4 text-[var(--brand-600)]" />
                    <h2 className="text-sm font-semibold text-neutral-900">
                      Handwriting OCR Model Language
                    </h2>
                  </div>
                  <p className="text-xs text-neutral-500 mt-1">
                    Select the handwriting recognition model applied when scanning notebook tally sheets. Note: This sets the <strong>paper handwriting reading model</strong>; the PieceTrack interface remains in English.
                  </p>
                </div>

                <div className="flex items-center gap-1 bg-neutral-100 p-1 rounded-lg w-full md:w-auto shrink-0">
                  <button
                    type="button"
                    onClick={() => setOcrLanguage('zh')}
                    className={`flex-1 md:flex-initial px-3 py-1.5 min-h-[40px] md:min-h-0 text-xs font-medium rounded-md transition-colors cursor-pointer ${
                      ocrLanguage === 'zh'
                        ? 'bg-white text-neutral-900 font-semibold shadow-2xs'
                        : 'text-neutral-600 hover:text-neutral-900'
                    }`}
                  >
                    Chinese (中文手写)
                  </button>
                  <button
                    type="button"
                    onClick={() => setOcrLanguage('en')}
                    className={`flex-1 md:flex-initial px-3 py-1.5 min-h-[40px] md:min-h-0 text-xs font-medium rounded-md transition-colors cursor-pointer ${
                      ocrLanguage === 'en'
                        ? 'bg-white text-neutral-900 font-semibold shadow-2xs'
                        : 'text-neutral-600 hover:text-neutral-900'
                    }`}
                  >
                    English (Latin script)
                  </button>
                </div>
              </div>

              {ocrLanguage === 'zh' ? (
                <div className="p-3.5 rounded-lg bg-[var(--brand-50)]/70 border border-[var(--brand-600)]/20 text-xs text-neutral-900 space-y-2">
                  <div className="font-semibold text-[var(--brand-700)] flex items-center gap-1.5">
                    <Check className="w-3.5 h-3.5" />
                    <span>Chinese Handwriting Model Active</span>
                  </div>
                  <p className="text-neutral-600 leading-relaxed text-[11px]">
                    Optimized for Chinese craft workshop logs. If you register new product categories, variants, or units containing unlearned characters, PieceTrack prompts you to upload a short handwriting sample sheet so the reader model can recognise them.
                  </p>
                  <div className="pt-1 text-[11px] text-neutral-500 font-mono flex items-center gap-1 flex-wrap">
                    <span className="font-semibold text-neutral-700">Trained Base Characters:</span>
                    <span className="bg-white/80 px-1.5 py-0.5 rounded border border-neutral-200 text-neutral-800 break-all">
                      0-9 黑 咖 黄 蓝 混 红 灰 绿 紫 白 粉 色 套 方 条 个 张 防 潮 垫 尘 罩 狗 × + 号
                    </span>
                    {dynamicallyLearnedChars.size > 0 && (
                      <span className="bg-[var(--brand-50)] text-[var(--brand-700)] px-1.5 py-0.5 rounded font-semibold">
                        + {Array.from(dynamicallyLearnedChars).join(' ')} (Added)
                      </span>
                    )}
                  </div>
                </div>
              ) : (
                <div className="p-3.5 rounded-lg bg-neutral-50 border border-neutral-200 text-xs text-neutral-700 space-y-1">
                  <div className="font-semibold text-neutral-800">
                    English (Latin Script) Model Active
                  </div>
                  <p className="text-neutral-500 text-[11px]">
                    Uses closed A–Z alphabet. All item names, variants, and units are formed from standard Latin letters and Arabic numerals. No handwriting training prompts will be triggered for new items.
                  </p>
                </div>
              )}
            </div>

            {/* Explanatory callout distinguishing Recognition vs Note fields */}
            <div className="p-4 rounded-xl bg-[var(--status-check-bg)]/70 border border-[var(--status-check-border)] text-xs text-neutral-700 space-y-2">
              <div className="flex items-center gap-2 font-semibold text-[var(--status-check)]">
                <Info className="w-4 h-4 text-[var(--status-check)] shrink-0" />
                <span>Field Classification Notice: Recognition vs. Note Fields</span>
              </div>
              <p className="text-neutral-600 leading-relaxed">
                <strong>Recognition fields</strong> are read from the notebook photograph by the recognition model (e.g. Item, Colour, Qty, Unit, Date).
                <br />
                <strong>Note fields</strong> are manually maintained attributes (e.g. Material batch, QC remarks). Adding a note field will <em>never</em> prompt the recognition model to search for it in photographs.
              </p>
            </div>

            {/* Field Table Card */}
            <div className="bg-white border border-neutral-200/80 rounded-xl overflow-hidden shadow-2xs">
              <div className="px-4 md:px-6 py-4 border-b border-neutral-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h2 className="text-sm font-semibold text-neutral-900">
                    Configured Workshop Fields
                  </h2>
                  <p className="text-xs text-neutral-400 mt-0.5">
                    Defines columns parsed from notebooks and attributes used in calculation
                  </p>
                </div>

                <button
                  onClick={() => setShowAddField(true)}
                  className="w-full sm:w-auto px-3.5 py-2 min-h-[44px] md:min-h-0 md:py-1.5 text-xs font-semibold text-white bg-[var(--brand-600)] hover:bg-[var(--brand-700)] rounded-lg flex items-center justify-center gap-1.5 transition-colors shadow-xs cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add Field</span>
                </button>
              </div>

              {/* Desktop Table */}
              <div className="hidden md:block">
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="bg-neutral-50 text-neutral-500 border-b border-neutral-200/70">
                    <tr>
                      <th className="py-2.5 pl-6 pr-3 font-semibold text-neutral-700">Field Name</th>
                      <th className="py-2.5 px-3 font-semibold text-neutral-700">Classification</th>
                      <th className="py-2.5 px-3 font-semibold text-neutral-700">Type</th>
                      <th className="py-2.5 px-3 font-semibold text-neutral-700 text-center">Rate Key?</th>
                      <th className="py-2.5 pr-6 pl-3 text-right font-semibold text-neutral-700">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-100">
                    {fieldDefinitions.map(f => (
                      <tr key={f.id} className="hover:bg-neutral-50/60">
                        <td className="py-3.5 pl-6 pr-3">
                          <div className="font-semibold text-neutral-900">{f.name}</div>
                          <div className="text-[11px] font-mono text-neutral-400">{f.key}</div>
                        </td>
                        <td className="py-3.5 px-3">
                          {f.category === 'recognition' ? (
                            <span className="text-[11px] text-[var(--brand-700)] bg-[var(--brand-50)] px-2 py-0.5 rounded font-medium border border-[var(--brand-600)]/20">
                              Photo Recognition (OCR)
                            </span>
                          ) : (
                            <span className="text-[11px] text-neutral-600 bg-neutral-100 px-2 py-0.5 rounded font-medium border border-neutral-200">
                              Manual Note Field
                            </span>
                          )}
                        </td>
                        <td className="py-3.5 px-3 font-mono text-neutral-600">
                          {f.type} {f.options ? `(${f.options.join(', ')})` : ''}
                        </td>
                        <td className="py-3.5 px-3 text-center">
                          {f.isRateKey ? (
                            <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-[var(--brand-700)]">
                              <Check className="w-3.5 h-3.5" />
                              Yes
                            </span>
                          ) : (
                            <span className="text-neutral-400">—</span>
                          )}
                        </td>
                        <td className="py-3.5 pr-6 pl-3 text-right">
                          {['f_date', 'f_item', 'f_qty', 'f_unit'].includes(f.id) ? (
                            <span className="text-[11px] text-neutral-400 italic">Default</span>
                          ) : (
                            <button
                              onClick={() => deleteFieldDefinition(f.id)}
                              className="text-neutral-400 hover:text-neutral-700 p-1.5 cursor-pointer"
                              title="Delete custom field"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Mobile Cards */}
              <div className="md:hidden divide-y divide-neutral-100">
                {fieldDefinitions.map(f => (
                  <div key={f.id} className="p-4 space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="font-semibold text-sm text-neutral-900">{f.name}</div>
                        <div className="text-[11px] font-mono text-neutral-400">{f.key} · {f.type}</div>
                      </div>
                      {['f_date', 'f_item', 'f_qty', 'f_unit'].includes(f.id) ? (
                        <span className="text-[11px] text-neutral-400 italic">Default</span>
                      ) : (
                        <button
                          onClick={() => deleteFieldDefinition(f.id)}
                          className="min-w-[44px] min-h-[44px] flex items-center justify-center text-neutral-400 hover:text-neutral-700"
                          aria-label={`Delete ${f.name}`}
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      {f.category === 'recognition' ? (
                        <span className="text-[11px] text-[var(--brand-700)] bg-[var(--brand-50)] px-2 py-0.5 rounded font-medium border border-[var(--brand-600)]/20">
                          Photo Recognition
                        </span>
                      ) : (
                        <span className="text-[11px] text-neutral-600 bg-neutral-100 px-2 py-0.5 rounded font-medium border border-neutral-200">
                          Note Field
                        </span>
                      )}
                      {f.isRateKey && (
                        <span className="text-[11px] font-semibold text-[var(--brand-700)]">
                          · Participates in rate lookup
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Modal: Add Field */}
            {showAddField && (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
                <div className="bg-white rounded-xl max-w-md w-full border border-neutral-200 shadow-xl p-5 md:p-6 max-h-[90vh] overflow-y-auto">
                  <h3 className="text-base font-bold text-neutral-900 mb-1">
                    Add New Field
                  </h3>
                  <p className="text-xs text-neutral-500 mb-4">
                    Configure a new workshop field and specify whether it is parsed from photos or entered manually.
                  </p>

                  <form onSubmit={handleCreateField} className="space-y-4">
                    <div>
                      <label className="block text-xs font-semibold text-neutral-700 mb-1">
                        Field Display Name *
                      </label>
                      <input
                        type="text"
                        required
                        placeholder="e.g. Size, Stitching style, 窗帘款"
                        value={newFieldName}
                        onChange={e => setNewFieldName(e.target.value)}
                        className="w-full text-xs border border-neutral-300 rounded-lg px-3 py-2.5 min-h-[44px] focus:outline-none focus:border-[var(--brand-600)]"
                      />

                      {untrainedInField.length > 0 && (
                        <div className="mt-2.5 p-3 rounded-lg bg-[var(--status-check-bg)] border border-[var(--status-check-border)] text-xs text-[var(--status-check-ink)] flex items-start gap-2.5">
                          <Camera className="w-4 h-4 text-[var(--status-check)] shrink-0 mt-0.5" />
                          <div className="flex-1">
                            <p className="text-neutral-800 leading-snug">
                              The {untrainedInField.length === 1 ? 'character' : 'characters'}{' '}
                              <strong className="text-[var(--status-check)]">{untrainedInField.join(' and ')}</strong>{' '}
                              haven&apos;t been learned yet. Write each of them a few times and upload a photo so the reader can recognise them.
                            </p>
                            <button
                              type="button"
                              onClick={() => setTrainingModalChars(untrainedInField)}
                              className="mt-2 px-3 py-2 min-h-[40px] text-xs font-semibold text-[var(--status-check)] bg-white border border-[var(--status-check)] hover:bg-[var(--status-check-bg)] rounded-md transition-colors flex items-center gap-1.5 shadow-2xs cursor-pointer"
                            >
                              <Camera className="w-3.5 h-3.5 text-[var(--status-check)]" />
                              <span>Add training samples</span>
                            </button>
                          </div>
                        </div>
                      )}
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-neutral-700 mb-1">
                        Classification *
                      </label>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                        <label
                          className={`p-3 rounded-lg border cursor-pointer flex flex-col justify-between ${
                            newFieldCategory === 'recognition'
                              ? 'border-[var(--brand-600)] bg-[var(--brand-50)]/60 text-neutral-900 font-medium'
                              : 'border-neutral-200 text-neutral-600 hover:bg-neutral-50'
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-semibold text-xs">Photo Recognition</span>
                            <input
                              type="radio"
                              name="category"
                              checked={newFieldCategory === 'recognition'}
                              onChange={() => setNewFieldCategory('recognition')}
                              className="accent-[var(--brand-600)]"
                            />
                          </div>
                          <span className="text-[10px] text-neutral-500 mt-1">
                            Extracted from handwritten pages
                          </span>
                        </label>

                        <label
                          className={`p-3 rounded-lg border cursor-pointer flex flex-col justify-between ${
                            newFieldCategory === 'note'
                              ? 'border-[var(--brand-600)] bg-[var(--brand-50)]/60 text-neutral-900 font-medium'
                              : 'border-neutral-200 text-neutral-600 hover:bg-neutral-50'
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-semibold text-xs">Manual Note Field</span>
                            <input
                              type="radio"
                              name="category"
                              checked={newFieldCategory === 'note'}
                              onChange={() => setNewFieldCategory('note')}
                              className="accent-[var(--brand-600)]"
                            />
                          </div>
                          <span className="text-[10px] text-neutral-500 mt-1">
                            Entered manually by workshop
                          </span>
                        </label>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-semibold text-neutral-700 mb-1">
                          Data Type
                        </label>
                        <select
                          value={newFieldType}
                          onChange={e => setNewFieldType(e.target.value as FieldType)}
                          className="w-full text-xs border border-neutral-300 rounded-lg px-2.5 py-2.5 min-h-[44px] focus:outline-none focus:border-[var(--brand-600)]"
                        >
                          <option value="text">Text</option>
                          <option value="number">Number</option>
                          <option value="select">Select Options</option>
                          <option value="date">Date</option>
                        </select>
                      </div>

                      {newFieldCategory === 'recognition' && (
                        <div className="flex items-center sm:pt-5">
                          <label className="flex items-center gap-2 cursor-pointer text-xs font-medium text-neutral-700 min-h-[44px]">
                            <input
                              type="checkbox"
                              checked={newFieldIsRateKey}
                              onChange={e => setNewFieldIsRateKey(e.target.checked)}
                              className="accent-[var(--brand-600)] rounded w-4 h-4"
                            />
                            <span>Participates in rate lookup</span>
                          </label>
                        </div>
                      )}
                    </div>

                    {newFieldType === 'select' && (
                      <div>
                        <label className="block text-xs font-semibold text-neutral-700 mb-1">
                          Options (comma separated)
                        </label>
                        <input
                          type="text"
                          placeholder="e.g. Small, Medium, Large"
                          value={newFieldOptions}
                          onChange={e => setNewFieldOptions(e.target.value)}
                          className="w-full text-xs border border-neutral-300 rounded-lg px-3 py-2.5 min-h-[44px] focus:outline-none"
                        />
                      </div>
                    )}

                    <div className="flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-end gap-2 pt-3 border-t border-neutral-100">
                      <button
                        type="button"
                        onClick={() => setShowAddField(false)}
                        className="px-3 py-2.5 min-h-[44px] text-xs font-medium text-neutral-600 hover:text-neutral-900 rounded-lg border border-neutral-200 sm:border-transparent"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        className="px-4 py-2.5 min-h-[44px] text-xs font-semibold text-white bg-[var(--brand-600)] hover:bg-[var(--brand-700)] rounded-lg"
                      >
                        Save Field
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ================= TAB 2: PIECE RATE TABLE ================= */}
        {activeTab === 'rates' && (
          <div className="space-y-6">
            {/* Explanatory callout for multi-field primary key */}
            <div className="p-4 rounded-xl bg-neutral-100/80 border border-neutral-200/80 text-xs text-neutral-700 flex items-start gap-2.5">
              <FileSpreadsheet className="w-4 h-4 text-neutral-500 shrink-0 mt-0.5" />
              <div>
                <span className="font-semibold text-neutral-900">
                  Rate Table Structure Notice:
                </span>{' '}
                Piece rates are bound to the <strong>combination of pricing fields</strong> (e.g. <code>Item + Unit</code>). For example,{' '}
                <code className="bg-white px-1 py-0.5 rounded border border-neutral-200 text-neutral-900 font-semibold">
                  Moisture mat · set {currency.symbol}1.10
                </code>{' '}
                and{' '}
                <code className="bg-white px-1 py-0.5 rounded border border-neutral-200 text-neutral-900 font-semibold">
                  Moisture mat · pc {currency.symbol}0.60
                </code>{' '}
                are distinct rate entries. The visual groupings below consolidate unit tiers under their parent article name.
              </div>
            </div>

            {/* Rates Table Card with Visual Grouping for Multiple Units */}
            <div className="bg-white border border-neutral-200/80 rounded-xl overflow-hidden shadow-2xs">
              <div className="px-4 md:px-6 py-4 border-b border-neutral-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h2 className="text-sm font-semibold text-neutral-900">
                    Piece Rate Matrix ({rateTable.length} rules across {groupedRateEntries.length} items)
                  </h2>
                  <p className="text-xs text-neutral-400 mt-0.5">
                    Wages calculated per completed piece or assembly
                  </p>
                </div>

                <button
                  onClick={() => setShowAddRate(true)}
                  className="w-full sm:w-auto px-3.5 py-2 min-h-[44px] md:min-h-0 md:py-1.5 text-xs font-semibold text-white bg-[var(--brand-600)] hover:bg-[var(--brand-700)] rounded-lg flex items-center justify-center gap-1.5 transition-colors shadow-xs cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add Rate Rule</span>
                </button>
              </div>

              {/* Desktop Table */}
              <div className="hidden md:block">
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="bg-neutral-50 text-neutral-500 border-b border-neutral-200/70">
                    <tr>
                      <th className="py-2.5 pl-6 pr-3 font-semibold text-neutral-700 w-56">Item Name</th>
                      <th className="py-2.5 px-3 font-semibold text-neutral-700 w-28">Unit of Measure</th>
                      <th className="py-2.5 px-3 font-semibold text-neutral-700 text-right w-32">Piece Rate</th>
                      <th className="py-2.5 px-3 font-semibold text-neutral-700">Specification</th>
                      <th className="py-2.5 pr-6 pl-3 text-right font-semibold text-neutral-700 w-16">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-200/60">
                    {groupedRateEntries.map(group => {
                      const hasMultipleUnits = group.entries.length > 1;

                      return group.entries.map((r, subIdx) => {
                        const isFirstInGroup = subIdx === 0;

                        return (
                          <tr
                            key={r.id}
                            className={`transition-colors ${
                              hasMultipleUnits
                                ? isFirstInGroup
                                  ? 'bg-neutral-50/40 hover:bg-neutral-100/60 border-t-2 border-neutral-200/80'
                                  : 'bg-neutral-50/20 hover:bg-neutral-100/40'
                                : 'hover:bg-neutral-50/60'
                            }`}
                          >
                            <td className="py-3.5 pl-6 pr-3">
                              {isFirstInGroup ? (
                                <div className="flex items-center gap-2">
                                  <span className="font-bold text-neutral-900 text-sm">
                                    {group.item}
                                  </span>
                                  {hasMultipleUnits && (
                                    <span className="text-[10px] font-semibold text-[var(--brand-700)] bg-[var(--brand-50)] px-2 py-0.5 rounded border border-[var(--brand-600)]/20">
                                      {group.entries.length} unit rates
                                    </span>
                                  )}
                                </div>
                              ) : (
                                <div className="pl-4 flex items-center gap-1.5 text-xs text-neutral-400">
                                  <span className="text-neutral-300 font-mono text-sm">↳</span>
                                  <span className="text-neutral-400 italic font-normal">
                                    (Same item · alternate unit rate)
                                  </span>
                                </div>
                              )}
                            </td>

                            <td className="py-3.5 px-3">
                              <span className="font-mono text-neutral-800 bg-white border border-neutral-200 px-2.5 py-1 rounded font-semibold text-xs shadow-2xs">
                                {r.unit}
                              </span>
                            </td>

                            <td className="py-3.5 px-3 text-right font-mono tabular-nums font-bold text-neutral-900 text-sm">
                              {formatCurrency(r.rate, currency)}
                            </td>

                            <td className="py-3.5 px-3 text-neutral-500 text-[11px]">
                              {r.description || '—'}
                            </td>

                            <td className="py-3.5 pr-6 pl-3 text-right">
                              <button
                                onClick={() => deleteRateEntry(r.id)}
                                className="text-neutral-400 hover:text-neutral-700 p-1.5 cursor-pointer"
                                title="Delete rate rule"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </td>
                          </tr>
                        );
                      });
                    })}
                  </tbody>
                </table>
              </div>

              {/* Mobile Grouped Rate Cards */}
              <div className="md:hidden divide-y divide-neutral-200/70">
                {groupedRateEntries.map(group => (
                  <div key={group.item} className="p-4 space-y-2.5">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-bold text-sm text-neutral-900">{group.item}</span>
                      {group.entries.length > 1 && (
                        <span className="text-[10px] font-semibold text-[var(--brand-700)] bg-[var(--brand-50)] px-2 py-0.5 rounded border border-[var(--brand-600)]/20">
                          {group.entries.length} unit rates
                        </span>
                      )}
                    </div>

                    <div className="space-y-2">
                      {group.entries.map(r => (
                        <div
                          key={r.id}
                          className="flex items-center justify-between gap-2 bg-neutral-50 border border-neutral-200/70 rounded-lg px-3 py-2"
                        >
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="font-mono text-xs font-semibold bg-white border border-neutral-200 px-2 py-0.5 rounded">
                                {r.unit}
                              </span>
                              <span className="font-mono font-bold text-sm text-neutral-900">
                                {formatCurrency(r.rate, currency)}
                              </span>
                            </div>
                            {r.description && (
                              <div className="text-[11px] text-neutral-500 mt-1 truncate">
                                {r.description}
                              </div>
                            )}
                          </div>
                          <button
                            onClick={() => deleteRateEntry(r.id)}
                            className="min-w-[40px] min-h-[40px] flex items-center justify-center text-neutral-400 hover:text-neutral-700 shrink-0"
                            aria-label={`Delete ${group.item} ${r.unit} rate`}
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Modal: Add Rate Rule */}
            {showAddRate && (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
                <div className="bg-white rounded-xl max-w-md w-full border border-neutral-200 shadow-xl p-5 md:p-6 max-h-[90vh] overflow-y-auto">
                  <h3 className="text-base font-bold text-neutral-900 mb-1">
                    Add Piece Rate Rule
                  </h3>
                  <p className="text-xs text-neutral-500 mb-4">
                    Bind a compensation rate to an item and unit of measure.
                  </p>

                  <form onSubmit={handleCreateRate} className="space-y-4">
                    <div>
                      <label className="block text-xs font-semibold text-neutral-700 mb-1">
                        Item / Article Name *
                      </label>
                      <input
                        type="text"
                        required
                        placeholder="e.g. Moisture mat, Cushion cover, 窗帘"
                        value={newRateItem}
                        onChange={e => setNewRateItem(e.target.value)}
                        className="w-full text-xs border border-neutral-300 rounded-lg px-3 py-2.5 min-h-[44px] focus:outline-none focus:border-[var(--brand-600)]"
                      />

                      {untrainedInRate.length > 0 && (
                        <div className="mt-2.5 p-3 rounded-lg bg-[var(--status-check-bg)] border border-[var(--status-check-border)] text-xs text-[var(--status-check-ink)] flex items-start gap-2.5">
                          <Camera className="w-4 h-4 text-[var(--status-check)] shrink-0 mt-0.5" />
                          <div className="flex-1">
                            <p className="text-neutral-800 leading-snug">
                              The {untrainedInRate.length === 1 ? 'character' : 'characters'}{' '}
                              <strong className="text-[var(--status-check)]">{untrainedInRate.join(' and ')}</strong>{' '}
                              haven&apos;t been learned yet. Write each of them a few times and upload a photo so the reader can recognise them.
                            </p>
                            <button
                              type="button"
                              onClick={() => setTrainingModalChars(untrainedInRate)}
                              className="mt-2 px-3 py-2 min-h-[40px] text-xs font-semibold text-[var(--status-check)] bg-white border border-[var(--status-check)] hover:bg-[var(--status-check-bg)] rounded-md transition-colors flex items-center gap-1.5 shadow-2xs cursor-pointer"
                            >
                              <Camera className="w-3.5 h-3.5 text-[var(--status-check)]" />
                              <span>Add training samples</span>
                            </button>
                          </div>
                        </div>
                      )}
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-semibold text-neutral-700 mb-1">
                          Unit of Measure *
                        </label>
                        <select
                          value={newRateUnit}
                          onChange={e => setNewRateUnit(e.target.value)}
                          className="w-full text-xs border border-neutral-300 rounded-lg px-2.5 py-2.5 min-h-[44px] focus:outline-none focus:border-[var(--brand-600)]"
                        >
                          <option value="pc">pc (single piece)</option>
                          <option value="set">set (complete set)</option>
                          <option value="pair">pair</option>
                          <option value="roll">roll</option>
                          <option value="box">box</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-neutral-700 mb-1">
                          Rate per Unit ({currency.symbol}) *
                        </label>
                        <input
                          type="number"
                          step="0.01"
                          min="0.01"
                          required
                          value={newRateValue}
                          onChange={e => setNewRateValue(parseFloat(e.target.value) || 0)}
                          className="w-full text-xs border border-neutral-300 rounded-lg px-3 py-2.5 min-h-[44px] font-mono tabular-nums focus:outline-none focus:border-[var(--brand-600)]"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-neutral-700 mb-1">
                        Specification Notes
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. Edge piped, 50m roll, heavy stitch"
                        value={newRateDesc}
                        onChange={e => setNewRateDesc(e.target.value)}
                        className="w-full text-xs border border-neutral-300 rounded-lg px-3 py-2.5 min-h-[44px] focus:outline-none"
                      />
                    </div>

                    <div className="flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-end gap-2 pt-3 border-t border-neutral-100">
                      <button
                        type="button"
                        onClick={() => setShowAddRate(false)}
                        className="px-3 py-2.5 min-h-[44px] text-xs font-medium text-neutral-600 hover:text-neutral-900 rounded-lg border border-neutral-200 sm:border-transparent"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        className="px-4 py-2.5 min-h-[44px] text-xs font-semibold text-white bg-[var(--brand-600)] hover:bg-[var(--brand-700)] rounded-lg"
                      >
                        Save Rate Rule
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ================= TAB 3: CURRENCY & DATE ================= */}
        {activeTab === 'currency' && (
          <div className="space-y-6">
            <div className="bg-white border border-neutral-200/80 rounded-xl p-4 md:p-6 shadow-2xs space-y-5">
              <div>
                <h2 className="text-sm font-semibold text-neutral-900">
                  Currency Configuration
                </h2>
                <p className="text-xs text-neutral-500 mt-0.5">
                  Controls the symbol, code, and decimal precision used in all monetary displays and exports.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-neutral-700 mb-1">
                    Currency Code
                  </label>
                  <select
                    value={currency.code}
                    onChange={e => {
                      const code = e.target.value as CurrencyCode;
                      const symbolMap: Record<CurrencyCode, string> = {
                        CNY: '¥',
                        NZD: '$',
                        USD: '$',
                        EUR: '€',
                        GBP: '£',
                        AUD: '$',
                        CAD: '$',
                      };
                      updateCurrency({
                        code,
                        symbol: symbolMap[code] || '$',
                      });
                    }}
                    className="w-full text-xs border border-neutral-300 rounded-lg px-3 py-2.5 min-h-[44px] focus:outline-none focus:border-[var(--brand-600)]"
                  >
                    <option value="CNY">CNY — Chinese Yuan (¥)</option>
                    <option value="NZD">NZD — New Zealand Dollar ($)</option>
                    <option value="USD">USD — US Dollar ($)</option>
                    <option value="EUR">EUR — Euro (€)</option>
                    <option value="GBP">GBP — British Pound (£)</option>
                    <option value="AUD">AUD — Australian Dollar ($)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-neutral-700 mb-1">
                    Currency Symbol
                  </label>
                  <input
                    type="text"
                    value={currency.symbol}
                    onChange={e => updateCurrency({ symbol: e.target.value })}
                    className="w-full text-xs border border-neutral-300 rounded-lg px-3 py-2.5 min-h-[44px] font-mono focus:outline-none focus:border-[var(--brand-600)]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-neutral-700 mb-1">
                    Decimal Precision
                  </label>
                  <select
                    value={currency.decimals}
                    onChange={e => updateCurrency({ decimals: parseInt(e.target.value, 10) })}
                    className="w-full text-xs border border-neutral-300 rounded-lg px-3 py-2.5 min-h-[44px] focus:outline-none focus:border-[var(--brand-600)]"
                  >
                    <option value={2}>2 decimals (e.g. 1,240.50)</option>
                    <option value={0}>0 decimals (e.g. 1,241)</option>
                    <option value={1}>1 decimal (e.g. 1,240.5)</option>
                  </select>
                </div>
              </div>

              <div className="p-3 rounded-lg bg-neutral-50 border border-neutral-200/60 flex items-center justify-between text-xs">
                <span className="text-neutral-500 font-medium">Live Amount Display Preview:</span>
                <span className="font-mono tabular-nums font-bold text-sm text-neutral-900">
                  {formatCurrency(18420.5, currency)}
                </span>
              </div>
            </div>

            {/* Date Format Card */}
            <div className="bg-white border border-neutral-200/80 rounded-xl p-4 md:p-6 shadow-2xs space-y-4">
              <div>
                <h2 className="text-sm font-semibold text-neutral-900">
                  Notebook Date Format
                </h2>
                <p className="text-xs text-neutral-500 mt-0.5">
                  Select the date formatting used by workshop artisans when logging production days.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {(['DD/MM', 'MM/DD', 'YYYY-MM-DD'] as DateFormat[]).map(format => (
                  <button
                    key={format}
                    type="button"
                    onClick={() => updateDateFormat(format)}
                    className={`p-3.5 min-h-[44px] rounded-xl border text-left flex flex-col justify-between transition-colors cursor-pointer ${
                      dateFormat === format
                        ? 'border-[var(--brand-600)] bg-[var(--brand-50)]/60 text-neutral-900 font-semibold ring-1 ring-[var(--brand-600)]'
                        : 'border-neutral-200 text-neutral-600 hover:bg-neutral-50'
                    }`}
                  >
                    <div className="font-mono text-xs">{format}</div>
                    <div className="text-[11px] text-neutral-400 mt-1">
                      Example: {format === 'DD/MM' ? '29/07' : format === 'MM/DD' ? '07/29' : '2026-07-29'}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ================= TAB 4: SETTLEMENT PERIOD ================= */}
        {activeTab === 'period' && (
          <div className="space-y-6">
            <div className="bg-white border border-neutral-200/80 rounded-xl p-4 md:p-6 shadow-2xs space-y-5">
              <div>
                <h2 className="text-sm font-semibold text-neutral-900">
                  Payroll Cadence &amp; Active Period
                </h2>
                <p className="text-xs text-neutral-500 mt-0.5">
                  The active settlement cycle determines page headings, cut-off dates, and ledger rollups.
                </p>
              </div>

              {/* Cadence Selector */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {[
                  { id: 'monthly', label: 'Monthly', example: 'e.g. August payout' },
                  { id: 'fortnightly', label: 'Fortnightly', example: 'e.g. 12 Aug – 25 Aug' },
                  { id: 'weekly', label: 'Weekly', example: 'e.g. Week of 4 Aug' },
                  { id: 'custom', label: 'Custom Range', example: 'Custom dates or name' },
                ].map(item => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => updatePeriod({ cadence: item.id as PeriodCadence })}
                    className={`p-3 min-h-[44px] rounded-xl border text-left flex flex-col justify-between transition-colors cursor-pointer ${
                      period.cadence === item.id
                        ? 'border-[var(--brand-600)] bg-[var(--brand-50)]/60 text-neutral-900 font-semibold ring-1 ring-[var(--brand-600)]'
                        : 'border-neutral-200 text-neutral-600 hover:bg-neutral-50'
                    }`}
                  >
                    <span className="text-xs font-semibold">{item.label}</span>
                    <span className="text-[10px] text-neutral-400 mt-1">{item.example}</span>
                  </button>
                ))}
              </div>

              {/* Period Parameters */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
                {period.cadence === 'monthly' ? (
                  <div>
                    <label className="block text-xs font-semibold text-neutral-700 mb-1">
                      Target Month
                    </label>
                    <select
                      value={period.monthName}
                      onChange={e => updatePeriod({ monthName: e.target.value })}
                      className="w-full text-xs border border-neutral-300 rounded-lg px-3 py-2.5 min-h-[44px] focus:outline-none focus:border-[var(--brand-600)]"
                    >
                      {[
                        'January', 'February', 'March', 'April', 'May', 'June',
                        'July', 'August', 'September', 'October', 'November', 'December',
                      ].map(m => (
                        <option key={m} value={m}>{m}</option>
                      ))}
                    </select>
                  </div>
                ) : (
                  <div>
                    <label className="block text-xs font-semibold text-neutral-700 mb-1">
                      Start Date
                    </label>
                    <input
                      type="date"
                      value={period.startDate}
                      onChange={e => updatePeriod({ startDate: e.target.value })}
                      className="w-full text-xs border border-neutral-300 rounded-lg px-3 py-2.5 min-h-[44px] focus:outline-none focus:border-[var(--brand-600)]"
                    />
                  </div>
                )}

                <div>
                  <label className="block text-xs font-semibold text-neutral-700 mb-1">
                    End / Cutoff Date
                  </label>
                  <input
                    type="date"
                    value={period.endDate}
                    onChange={e => updatePeriod({ endDate: e.target.value })}
                    className="w-full text-xs border border-neutral-300 rounded-lg px-3 py-2.5 min-h-[44px] focus:outline-none focus:border-[var(--brand-600)]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-neutral-700 mb-1">
                    Submission Due Date Label
                  </label>
                  <input
                    type="text"
                    value={period.dueDate}
                    onChange={e => updatePeriod({ dueDate: e.target.value })}
                    placeholder="e.g. 10 Aug 2026"
                    className="w-full text-xs border border-neutral-300 rounded-lg px-3 py-2.5 min-h-[44px] focus:outline-none focus:border-[var(--brand-600)]"
                  />
                </div>
              </div>

              {/* Dynamic Title Result */}
              <div className="p-4 rounded-xl bg-neutral-50 border border-neutral-200/80 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <div className="text-xs text-neutral-400 font-medium">Generated Dynamic Title:</div>
                  <div className="text-lg font-bold text-neutral-900 mt-0.5">
                    {getPeriodTitle(period)}
                  </div>
                </div>
                <div className="text-xs text-[var(--brand-700)] font-semibold bg-[var(--brand-50)] px-2.5 py-1 rounded self-start sm:self-center">
                  Active in Home Header
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ================= TAB 5: REVIEW THRESHOLD ================= */}
        {activeTab === 'threshold' && (
          <div className="space-y-6">
            <div className="bg-white border border-neutral-200/80 rounded-xl p-4 md:p-6 shadow-2xs space-y-5">
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                <div>
                  <h2 className="text-sm font-semibold text-neutral-900">
                    Review Confidence Threshold
                  </h2>
                  <p className="text-xs text-neutral-500 mt-0.5">
                    Set the minimum recognition model confidence required before a handwritten field is flagged for manual review.
                  </p>
                </div>

                {Math.round(confidenceThreshold * 100) !== 80 && (
                  <button
                    type="button"
                    onClick={() => updateConfidenceThreshold(0.8)}
                    className="self-start px-3 py-1.5 min-h-[38px] md:min-h-0 text-xs font-medium text-neutral-700 bg-neutral-100 hover:bg-neutral-200 rounded-lg transition-colors cursor-pointer shrink-0"
                  >
                    Reset to 80%
                  </button>
                )}
              </div>

              <div className="p-4 md:p-5 rounded-xl bg-neutral-50/80 border border-neutral-200/70 space-y-3">
                <div className="flex items-center justify-between">
                  <label
                    htmlFor="confidence-threshold-slider"
                    className="text-xs font-semibold text-neutral-800"
                  >
                    Minimum confidence to pass without review
                  </label>
                  <span className="font-mono text-base font-bold text-[var(--brand-700)] tabular-nums bg-[var(--brand-50)] border border-[var(--brand-600)]/20 px-2.5 py-0.5 rounded">
                    {Math.round(confidenceThreshold * 100)}%
                  </span>
                </div>

                <input
                  id="confidence-threshold-slider"
                  type="range"
                  min={50}
                  max={95}
                  step={1}
                  value={Math.round(confidenceThreshold * 100)}
                  onChange={e => updateConfidenceThreshold(Number(e.target.value) / 100)}
                  className="w-full h-2 bg-neutral-200 rounded-lg appearance-none cursor-pointer accent-[var(--brand-600)]"
                />

                <div className="flex items-center justify-between text-[11px] font-mono text-neutral-400">
                  <span>50% (fewer flags)</span>
                  <span>80% (default)</span>
                  <span>95% (stricter review)</span>
                </div>
              </div>

              {(() => {
                const thresholdPct = Math.round(confidenceThreshold * 100);
                const { coverage, accuracy } = interpolateMeasuredCoverage(thresholdPct);
                return (
                  <div className="space-y-1.5">
                    <p className="text-xs text-neutral-600 leading-relaxed">
                      At {thresholdPct}%, about {coverage}% of characters pass without review, and {accuracy}% of those are correct.
                    </p>
                    <p className="text-[11px] text-neutral-400">
                      Measured on 504 characters from three writers the model had never seen.
                    </p>
                    <p className="text-xs text-neutral-600 leading-relaxed">
                      Raising the threshold sends more fields to review and lets fewer errors through.
                    </p>
                  </div>
                );
              })()}
            </div>
          </div>
        )}
      </main>

      {/* Handwriting Character Training Samples Modal */}
      {trainingModalChars && (
        <TrainingSampleModal
          unlearnedCharacters={trainingModalChars}
          onClose={() => setTrainingModalChars(null)}
          onRegistered={chars => {
            setDynamicallyLearnedChars(prev => new Set([...prev, ...chars]));
          }}
        />
      )}
    </div>
  );
};
