import React, { useState, useMemo } from 'react';
import {
  ChevronRight,
  ChevronLeft,
  ChevronDown,
  Archive,
  Download,
  Lock,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import {
  aggregateOutputByUnit,
  downloadUtf8BomCsv,
  formatCurrency,
  formatDate,
  formatOutputByUnit,
  formatWorkerLabel,
} from '../utils/formatters';
import { HistoryPeriod } from '../types';

export const HistoryView: React.FC = () => {
  const { historyPeriods, currency, dateFormat } = useApp();
  const [selectedPeriodId, setSelectedPeriodId] = useState<string | null>(null);
  const [expandedWorkerIds, setExpandedWorkerIds] = useState<Set<string>>(new Set());

  const selectedPeriod: HistoryPeriod | undefined = useMemo(() => {
    if (!selectedPeriodId) return undefined;
    return historyPeriods.find(p => p.id === selectedPeriodId);
  }, [historyPeriods, selectedPeriodId]);

  const toggleWorkerExpand = (workerId: string) => {
    setExpandedWorkerIds(prev => {
      const next = new Set(prev);
      if (next.has(workerId)) {
        next.delete(workerId);
      } else {
        next.add(workerId);
      }
      return next;
    });
  };

  const handleOpenPeriod = (period: HistoryPeriod) => {
    setSelectedPeriodId(period.id);
    setExpandedWorkerIds(new Set());
  };

  const handleExportPeriodCSV = (period: HistoryPeriod) => {
    const totalPages = period.workerSummaries.reduce((sum, w) => sum + w.pagesCount, 0);

    const csvRows: string[][] = [
      [`PieceTrack Payroll Summary - ${period.title}`],
      [`Period: ${period.title} (${period.dateRange})`],
      [`Exported: ${new Date().toISOString().slice(0, 10)}`],
      [],
      ['Worker', 'Pages', 'Output', `Pay (${currency.code})`],
      ...period.workerSummaries.map(ws => {
        const unitMap = aggregateOutputByUnit(ws.entries);
        const outputStr = formatOutputByUnit(unitMap);
        return [
          formatWorkerLabel(ws.displayName, ws.referenceLabel),
          String(ws.pagesCount),
          outputStr,
          ws.totalAmount.toFixed(currency.decimals),
        ];
      }),
      ['Total', String(totalPages), '', period.totalAmount.toFixed(currency.decimals)],
    ];

    const periodSlug = period.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    const payoutSlug = period.payoutDate.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    const filename = `piecetrack-${periodSlug}-${payoutSlug}.csv`;

    downloadUtf8BomCsv(csvRows, filename);
  };

  // ================= DETAIL VIEW FOR A CLOSED SETTLEMENT PERIOD =================
  if (selectedPeriod) {
    const totalPages = selectedPeriod.workerSummaries.reduce((s, w) => s + w.pagesCount, 0);

    return (
      <div className="flex-1 flex flex-col h-full overflow-y-auto overflow-x-hidden bg-[var(--surface-page)]">
        {/* Page Header */}
        <header className="px-4 md:px-8 pt-4 md:pt-6 pb-5 border-b border-neutral-200/80 bg-white">
          <div className="max-w-5xl mx-auto">
            <button
              type="button"
              onClick={() => setSelectedPeriodId(null)}
              className="text-xs text-neutral-500 hover:text-neutral-900 flex items-center gap-1 font-medium mb-2 min-h-[44px] md:min-h-0 cursor-pointer"
            >
              <ChevronLeft className="w-4 h-4" />
              <span>Back to History</span>
            </button>

            <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
              <div className="space-y-1.5">
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="text-xl font-bold tracking-tight text-neutral-900">
                    {selectedPeriod.title}
                  </h1>
                  <span className="inline-flex items-center gap-1 text-[11px] font-medium text-neutral-600 bg-neutral-100 border border-neutral-200 px-2 py-0.5 rounded">
                    <Lock className="w-3 h-3 text-neutral-500" />
                    Closed · Read-only
                  </span>
                </div>

                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-neutral-500">
                  <span className="font-mono">{selectedPeriod.dateRange}</span>
                  <span aria-hidden="true" className="text-neutral-300">·</span>
                  <span>Settled on {selectedPeriod.payoutDate}</span>
                  <span aria-hidden="true" className="text-neutral-300">·</span>
                  <span className="font-medium text-neutral-700">
                    {selectedPeriod.workersSubmitted} of {selectedPeriod.totalWorkers} workers
                  </span>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row sm:items-center gap-3 md:gap-5">
                <div className="md:text-right">
                  <div className="text-[11px] uppercase tracking-wider text-neutral-400 font-medium">
                    Total Settled
                  </div>
                  <div className="text-xl font-bold text-neutral-900 font-mono tabular-nums">
                    {formatCurrency(selectedPeriod.totalAmount, currency)}
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => handleExportPeriodCSV(selectedPeriod)}
                  className="w-full md:w-auto px-4 py-2.5 min-h-[44px] text-xs font-semibold text-white bg-[var(--brand-600)] hover:bg-[var(--brand-700)] rounded-lg flex items-center justify-center gap-2 transition-colors shadow-xs cursor-pointer"
                >
                  <Download className="w-4 h-4" />
                  <span>Export CSV</span>
                </button>
              </div>
            </div>
          </div>
        </header>

        {/* Per-worker Summary Table & Expandable Line-by-line Entries */}
        <main className="max-w-5xl mx-auto w-full px-4 md:px-8 py-5 md:py-8 space-y-4">
          <div className="flex items-center justify-between text-xs text-neutral-500 px-1">
            <span>
              Click any worker row to inspect read-only piecework line items for {selectedPeriod.title}.
            </span>
          </div>

          {/* Desktop & Tablet Table (>= 768px) */}
          <div className="hidden md:block bg-white border border-neutral-200/80 rounded-xl overflow-hidden shadow-2xs">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-neutral-50 text-neutral-500 border-b border-neutral-200/70">
                <tr>
                  <th className="py-3 pl-6 pr-3 font-semibold text-neutral-700">Worker</th>
                  <th className="py-3 px-3 font-semibold text-neutral-700 text-right w-24">Pages</th>
                  <th className="py-3 px-3 font-semibold text-neutral-700">Output</th>
                  <th className="py-3 pr-6 pl-3 font-semibold text-neutral-700 text-right w-36">Pay</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {selectedPeriod.workerSummaries.map(ws => {
                  const isExpanded = expandedWorkerIds.has(ws.workerId);
                  const outputStr = formatOutputByUnit(aggregateOutputByUnit(ws.entries));
                  const workerLabel = formatWorkerLabel(ws.displayName, ws.referenceLabel);

                  return (
                    <React.Fragment key={ws.workerId}>
                      <tr
                        onClick={() => toggleWorkerExpand(ws.workerId)}
                        className="hover:bg-neutral-50/80 cursor-pointer transition-colors"
                      >
                        <td className="py-3.5 pl-6 pr-3">
                          <div className="flex items-center gap-2.5">
                            {isExpanded ? (
                              <ChevronDown className="w-4 h-4 text-[var(--brand-600)] shrink-0" />
                            ) : (
                              <ChevronRight className="w-4 h-4 text-neutral-400 shrink-0" />
                            )}
                            <span className="font-semibold text-neutral-900 text-sm">
                              {workerLabel}
                            </span>
                          </div>
                        </td>
                        <td className="py-3.5 px-3 text-right font-mono text-neutral-600 tabular-nums">
                          {ws.pagesCount}
                        </td>
                        <td className="py-3.5 px-3 font-mono text-neutral-700">
                          {outputStr}
                        </td>
                        <td className="py-3.5 pr-6 pl-3 text-right font-mono tabular-nums font-bold text-neutral-900 text-sm">
                          {formatCurrency(ws.totalAmount, currency)}
                        </td>
                      </tr>

                      {isExpanded && (
                        <tr className="bg-neutral-50/70">
                          <td colSpan={4} className="px-6 py-4 border-t border-neutral-100">
                            <div className="bg-white border border-neutral-200/80 rounded-lg overflow-hidden">
                              <table className="w-full text-left text-[11px] border-collapse">
                                <thead className="bg-neutral-50 text-neutral-500 border-b border-neutral-200/60">
                                  <tr>
                                    <th className="py-2 pl-4 pr-2 font-semibold">Date</th>
                                    <th className="py-2 px-2 font-semibold">Item</th>
                                    <th className="py-2 px-2 font-semibold">Colour</th>
                                    <th className="py-2 px-2 font-semibold text-right">Qty</th>
                                    <th className="py-2 px-2 font-semibold">Unit</th>
                                    <th className="py-2 px-2 font-semibold text-right">Rate</th>
                                    <th className="py-2 pr-4 pl-2 font-semibold text-right">Amount</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-neutral-100">
                                  {ws.entries.map((entry, idx) => (
                                    <tr key={idx} className="text-neutral-700">
                                      <td className="py-2 pl-4 pr-2 font-mono text-neutral-500">
                                        {formatDate(entry.date, dateFormat)}
                                      </td>
                                      <td className="py-2 px-2 font-medium text-neutral-900">
                                        {entry.item}
                                      </td>
                                      <td className="py-2 px-2 text-neutral-600">
                                        {entry.colour || '—'}
                                      </td>
                                      <td className="py-2 px-2 text-right font-mono tabular-nums font-semibold">
                                        {entry.qty}
                                      </td>
                                      <td className="py-2 px-2 font-mono text-neutral-500">
                                        {entry.unit}
                                      </td>
                                      <td className="py-2 px-2 text-right font-mono tabular-nums text-neutral-500">
                                        {formatCurrency(entry.rate, currency)}
                                      </td>
                                      <td className="py-2 pr-4 pl-2 text-right font-mono tabular-nums font-semibold text-neutral-900">
                                        {formatCurrency(entry.amount, currency)}
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>

              {/* Total Row */}
              <tfoot className="bg-neutral-50 border-t-2 border-neutral-200">
                <tr>
                  <td className="py-3.5 pl-6 pr-3 font-bold text-neutral-900 text-sm">
                    Total ({selectedPeriod.workerSummaries.length} workers)
                  </td>
                  <td className="py-3.5 px-3 text-right font-mono font-bold text-neutral-800 tabular-nums">
                    {totalPages}
                  </td>
                  <td className="py-3.5 px-3 font-mono text-neutral-400">
                    —
                  </td>
                  <td className="py-3.5 pr-6 pl-3 text-right font-mono tabular-nums font-bold text-base text-neutral-900">
                    {formatCurrency(selectedPeriod.totalAmount, currency)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>

          {/* Mobile Worker Cards (< 768px) */}
          <div className="md:hidden space-y-3">
            {selectedPeriod.workerSummaries.map(ws => {
              const isExpanded = expandedWorkerIds.has(ws.workerId);
              const outputStr = formatOutputByUnit(aggregateOutputByUnit(ws.entries));
              const workerLabel = formatWorkerLabel(ws.displayName, ws.referenceLabel);

              return (
                <div
                  key={ws.workerId}
                  className="bg-white border border-neutral-200/80 rounded-xl overflow-hidden shadow-2xs"
                >
                  <button
                    type="button"
                    onClick={() => toggleWorkerExpand(ws.workerId)}
                    className="w-full p-4 text-left flex flex-col gap-2 min-h-[44px]"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="text-sm font-semibold text-neutral-900">
                        {workerLabel}
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        <span className="text-base font-mono tabular-nums font-bold text-neutral-900">
                          {formatCurrency(ws.totalAmount, currency)}
                        </span>
                        {isExpanded ? (
                          <ChevronDown className="w-4 h-4 text-[var(--brand-600)]" />
                        ) : (
                          <ChevronRight className="w-4 h-4 text-neutral-400" />
                        )}
                      </div>
                    </div>

                    <div className="text-xs text-neutral-500 font-mono">
                      {ws.pagesCount} {ws.pagesCount === 1 ? 'page' : 'pages'} · {outputStr}
                    </div>
                  </button>

                  {isExpanded && (
                    <div className="border-t border-neutral-100 bg-neutral-50/70 p-3 space-y-2">
                      {ws.entries.map((entry, idx) => (
                        <div
                          key={idx}
                          className="bg-white border border-neutral-200/70 rounded-lg p-3 text-xs space-y-1"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-semibold text-neutral-900">
                              {entry.item}
                              {entry.colour ? ` · ${entry.colour}` : ''}
                            </span>
                            <span className="font-mono font-bold text-neutral-900 tabular-nums">
                              {formatCurrency(entry.amount, currency)}
                            </span>
                          </div>
                          <div className="flex items-center justify-between text-[11px] text-neutral-500 font-mono">
                            <span>{formatDate(entry.date, dateFormat)}</span>
                            <span>
                              {entry.qty} {entry.unit} × {formatCurrency(entry.rate, currency)}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}

            <div className="bg-white border border-neutral-200/80 rounded-xl p-4 flex items-center justify-between">
              <div>
                <div className="text-xs font-bold text-neutral-900">
                  Period Total ({selectedPeriod.workerSummaries.length} workers)
                </div>
                <div className="text-[11px] text-neutral-500 font-mono mt-0.5">
                  {totalPages} pages · Output —
                </div>
              </div>
              <div className="text-lg font-mono tabular-nums font-bold text-neutral-900">
                {formatCurrency(selectedPeriod.totalAmount, currency)}
              </div>
            </div>
          </div>
        </main>
      </div>
    );
  }

  // ================= LIST VIEW OF ARCHIVED SETTLEMENT PERIODS =================
  return (
    <div className="flex-1 flex flex-col h-full overflow-y-auto overflow-x-hidden bg-[var(--surface-page)]">
      <header className="px-4 md:px-8 pt-5 md:pt-8 pb-5 md:pb-6 border-b border-neutral-200/80 bg-white">
        <div className="max-w-5xl mx-auto">
          <span className="text-xs font-semibold uppercase tracking-wider text-[var(--brand-800)]">
            Archived Settlements
          </span>
          <h1 className="text-xl font-bold tracking-tight text-neutral-900 mt-0.5">
            Payroll History &amp; Past Periods
          </h1>
          <p className="text-xs text-neutral-500 mt-1">
            Review finalized and disbursed piece-rate settlements from previous months and cycles.
          </p>
        </div>
      </header>

      <main className="max-w-5xl mx-auto w-full px-4 md:px-8 py-5 md:py-8 space-y-4">
        <div className="hidden md:block bg-white border border-neutral-200/80 rounded-xl overflow-hidden shadow-2xs">
          <div className="px-6 py-4 border-b border-neutral-100 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-neutral-900">
              Completed Settlement Periods
            </h2>
            <span className="text-xs text-neutral-400">
              {historyPeriods.length} archived cycles
            </span>
          </div>

          <div className="divide-y divide-neutral-100">
            {historyPeriods.map(period => (
              <div
                key={period.id}
                onClick={() => handleOpenPeriod(period)}
                className="px-6 py-4 flex items-center justify-between hover:bg-neutral-50/80 transition-colors cursor-pointer"
              >
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-lg bg-neutral-100 flex items-center justify-center text-neutral-500 shrink-0">
                    <Archive className="w-5 h-5" />
                  </div>

                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-bold text-neutral-900">
                        {period.title}
                      </span>
                      <span className="text-xs text-neutral-400 font-mono">
                        ({period.dateRange})
                      </span>
                      <span className="text-[10px] font-semibold text-[var(--status-paid)] bg-[var(--status-paid-bg)] px-2 py-0.5 rounded border border-[var(--status-paid-border)]">
                        Disbursed on {period.payoutDate}
                      </span>
                    </div>
                    <div className="text-xs text-neutral-400 mt-1">
                      {period.workersSubmitted} of {period.totalWorkers} workers settled · Read-only archive
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-6 shrink-0">
                  <div className="text-right">
                    <div className="text-xs text-neutral-400">Total Settled</div>
                    <div className="text-sm font-bold text-neutral-900 font-mono tabular-nums">
                      {formatCurrency(period.totalAmount, currency)}
                    </div>
                  </div>

                  <ChevronRight className="w-4 h-4 text-neutral-300" />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Mobile Period Cards (< 768px) */}
        <div className="md:hidden space-y-3">
          {historyPeriods.map(period => (
            <button
              key={period.id}
              type="button"
              onClick={() => handleOpenPeriod(period)}
              className="w-full text-left bg-white border border-neutral-200/80 rounded-xl p-4 shadow-2xs space-y-2.5 min-h-[44px]"
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="text-sm font-bold text-neutral-900">{period.title}</div>
                  <div className="text-xs text-neutral-400 font-mono mt-0.5">
                    {period.dateRange}
                  </div>
                </div>
                <span className="text-[10px] font-semibold text-[var(--status-paid)] bg-[var(--status-paid-bg)] px-2 py-0.5 rounded border border-[var(--status-paid-border)] shrink-0">
                  {period.payoutDate}
                </span>
              </div>

              <div className="flex items-baseline justify-between pt-1 border-t border-neutral-100">
                <span className="text-xs text-neutral-500">
                  {period.workersSubmitted} of {period.totalWorkers} workers
                </span>
                <div className="flex items-center gap-1.5">
                  <span className="text-base font-bold text-neutral-900 font-mono tabular-nums">
                    {formatCurrency(period.totalAmount, currency)}
                  </span>
                  <ChevronRight className="w-4 h-4 text-neutral-400" />
                </div>
              </div>
            </button>
          ))}
        </div>
      </main>
    </div>
  );
};
