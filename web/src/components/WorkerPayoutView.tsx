import React, { useMemo, useState } from 'react';
import {
  ChevronLeft,
  Download,
  Printer,
  CheckCircle2,
  AlertCircle,
  FileText,
  Info,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import {
  aggregateOutputByUnit,
  calculateRowAmount,
  downloadUtf8BomCsv,
  formatCurrency,
  formatOutputByUnit,
  formatWorkerLabel,
  getPeriodTitle,
} from '../utils/formatters';
import { PaySlipModal } from './PaySlipModal';

export const WorkerPayoutView: React.FC = () => {
  const {
    activeWorker,
    workers,
    pages,
    period,
    currency,
    rateTable,
    workerDetailOrigin,
    toggleWorkerPaid,
    setActiveView,
    setSelectedPageId,
  } = useApp();

  const [showSlipModal, setShowSlipModal] = useState<boolean>(false);

  const worker = activeWorker || workers[0];
  const periodTitle = getPeriodTitle(period);
  const workerLabel = formatWorkerLabel(worker.name, worker.code);

  // Back destination follows the user's navigation path
  const backTarget = workerDetailOrigin === 'home' ? 'home' : 'workers';
  const backLabel = workerDetailOrigin === 'home' ? 'Back to This period' : 'Back to Workers';

  // Find all pages belonging to this worker (single source of truth)
  const workerPages = useMemo(() => {
    return pages.filter(p => p.workerId === worker.id);
  }, [pages, worker.id]);

  const flaggedCount = workerPages.filter(p => p.status === 'flagged').length;
  const approvedCount = workerPages.filter(p => p.status === 'approved').length;

  // Group line items by "Item · Unit"
  const groupedBreakdown = useMemo(() => {
    const groups: {
      [groupKey: string]: {
        item: string;
        unit: string;
        rate: number;
        totalQty: number;
        totalAmount: number;
        entries: {
          date: string;
          colour?: string;
          qty: number;
          amount: number;
          pageLabel: string;
          pageId: string;
        }[];
      };
    } = {};

    workerPages.forEach(page => {
      page.rows.forEach(row => {
        const itemVal = String(row.fields['item']?.value || 'Unknown Item');
        const unitVal = String(row.fields['unit']?.value || 'pc');
        const dateVal = String(row.fields['date']?.value || '');
        const colourVal = String(row.fields['colour']?.value || '');
        const qtyVal = Number(row.fields['qty']?.value) || 0;
        const { rate, amount } = calculateRowAmount(row, rateTable);

        const groupKey = `${itemVal.toLowerCase()}::${unitVal.toLowerCase()}`;

        if (!groups[groupKey]) {
          groups[groupKey] = {
            item: itemVal,
            unit: unitVal,
            rate,
            totalQty: 0,
            totalAmount: 0,
            entries: [],
          };
        }

        groups[groupKey].totalQty += qtyVal;
        groups[groupKey].totalAmount += amount;
        groups[groupKey].entries.push({
          date: dateVal,
          colour: colourVal,
          qty: qtyVal,
          amount,
          pageLabel: page.notebookLabel || page.pageId,
          pageId: page.pageId,
        });
      });
    });

    return Object.values(groups);
  }, [workerPages, rateTable]);

  // Unit-grouped output summary
  const outputSummary = useMemo(() => {
    const byUnit = aggregateOutputByUnit(
      groupedBreakdown.map(g => ({ unit: g.unit, qty: g.totalQty }))
    );
    return formatOutputByUnit(byUnit);
  }, [groupedBreakdown]);

  const grandTotal = Number(
    groupedBreakdown.reduce((s, g) => s + g.totalAmount, 0).toFixed(4)
  );

  // Guard: Mark paid & Pay slip require positive payable amount and approved records
  const hasSettleableOutput = grandTotal > 0 && approvedCount > 0;
  const canTogglePaid = worker.status === 'paid' || hasSettleableOutput;

  // CSV export handler
  const handleExportCSV = () => {
    const rows: string[][] = [
      [`PieceTrack Worker Payout - ${workerLabel}`],
      [`Period: ${periodTitle}`],
      [`Exported: ${new Date().toISOString().slice(0, 10)}`],
      [],
      ['Item', 'Unit', `Rate (${currency.code})`, 'Total Quantity', `Subtotal (${currency.code})`],
      ...groupedBreakdown.map(g => [
        g.item,
        g.unit,
        g.rate.toFixed(currency.decimals),
        String(g.totalQty),
        g.totalAmount.toFixed(currency.decimals),
      ]),
      ['Total', '', '', '', grandTotal.toFixed(currency.decimals)],
    ];

    const slugWorker = workerLabel.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    const slugPeriod = periodTitle.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    downloadUtf8BomCsv(rows, `piecetrack-${slugWorker}-${slugPeriod}.csv`);
  };

  return (
    <div className="flex-1 flex flex-col h-full overflow-y-auto overflow-x-hidden bg-[var(--surface-page)]">
      {/* Top Header */}
      <header className="px-4 md:px-8 pt-4 md:pt-6 pb-5 border-b border-neutral-200/80 bg-white">
        <div className="max-w-5xl mx-auto">
          {/* Dynamic Back Button */}
          <button
            onClick={() => setActiveView(backTarget)}
            className="text-xs text-neutral-500 hover:text-neutral-900 flex items-center gap-1 font-medium mb-2 min-h-[44px] md:min-h-0 cursor-pointer"
          >
            <ChevronLeft className="w-4 h-4" />
            <span>{backLabel}</span>
          </button>

          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h1 className="text-lg md:text-xl font-bold tracking-tight text-neutral-900">
                {workerLabel} · {periodTitle}
              </h1>

              {/* Subtitle: Zero-pages vs Submitted + Single Status */}
              <div className="flex flex-wrap items-center gap-2 text-xs text-neutral-500 mt-1.5">
                {workerPages.length === 0 ? (
                  <span className="text-neutral-400">No pages submitted yet</span>
                ) : (
                  <>
                    <span>
                      {workerPages.length} {workerPages.length === 1 ? 'page' : 'pages'} scanned
                    </span>
                    <span aria-hidden="true">·</span>
                    {worker.status === 'to_check' && (
                      <span className="text-[var(--status-check)] bg-[var(--status-check-bg)] px-2 py-0.5 rounded font-medium flex items-center gap-1">
                        <AlertCircle className="w-3.5 h-3.5" />
                        {flaggedCount} {flaggedCount === 1 ? 'page' : 'pages'} to check
                      </span>
                    )}
                    {worker.status === 'ready' && (
                      <span className="text-[var(--brand-700)] bg-[var(--brand-50)] px-2 py-0.5 rounded font-medium flex items-center gap-1">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        All pages approved · Ready
                      </span>
                    )}
                    {worker.status === 'paid' && (
                      <span className="text-[var(--status-paid)] bg-[var(--status-paid-bg)] border border-[var(--status-paid-border)] px-2 py-0.5 rounded font-semibold text-[11px] flex items-center gap-1">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        Paid{worker.paidAt ? ` on ${worker.paidAt}` : ''}
                      </span>
                    )}
                  </>
                )}
              </div>
            </div>

            {/* Actions: Export / Pay slip / Mark paid */}
            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={handleExportCSV}
                className="px-3 py-2 min-h-[44px] md:min-h-0 text-xs font-medium text-neutral-700 bg-white border border-neutral-300 rounded-lg hover:bg-neutral-50 flex items-center gap-1.5 transition-colors shadow-2xs cursor-pointer"
              >
                <Download className="w-3.5 h-3.5 text-neutral-500" />
                <span>Export CSV</span>
              </button>

              <button
                type="button"
                disabled={!hasSettleableOutput}
                onClick={() => hasSettleableOutput && setShowSlipModal(true)}
                title={
                  hasSettleableOutput
                    ? 'Preview & print pay slip'
                    : 'Nothing to settle for this period.'
                }
                className="px-3 py-2 min-h-[44px] md:min-h-0 text-xs font-medium text-neutral-700 bg-white border border-neutral-300 rounded-lg hover:bg-neutral-50 disabled:opacity-45 disabled:bg-neutral-100 disabled:text-neutral-400 disabled:cursor-not-allowed flex items-center gap-1.5 transition-colors shadow-2xs cursor-pointer"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>Pay slip</span>
              </button>

              <button
                type="button"
                disabled={!canTogglePaid}
                onClick={() => canTogglePaid && toggleWorkerPaid(worker.id)}
                title={
                  canTogglePaid
                    ? worker.status === 'paid'
                      ? 'Revert payment status to ready'
                      : 'Mark worker payout as settled'
                    : 'Nothing to settle for this period.'
                }
                className={`px-4 py-2 min-h-[44px] md:min-h-0 text-xs font-semibold rounded-lg flex items-center gap-1.5 transition-colors shadow-xs ${
                  !canTogglePaid
                    ? 'bg-neutral-200 text-neutral-400 cursor-not-allowed'
                    : worker.status === 'paid'
                    ? 'bg-neutral-100 text-neutral-700 border border-neutral-300 hover:bg-neutral-200 cursor-pointer'
                    : 'bg-[var(--brand-600)] text-white hover:bg-[var(--brand-700)] cursor-pointer'
                }`}
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>{worker.status === 'paid' ? 'Mark unpaid' : 'Mark paid'}</span>
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Body */}
      <main className="max-w-5xl mx-auto w-full px-4 md:px-8 py-5 md:py-6 space-y-5 md:space-y-6">
        <div className="p-3.5 rounded-lg bg-neutral-100/70 border border-neutral-200/70 text-xs text-neutral-600 flex items-start gap-2.5">
          <Info className="w-4 h-4 text-neutral-500 shrink-0 mt-0.5" />
          <div>
            <span className="font-semibold text-neutral-800">
              Piece-rate group pricing note:
            </span>{' '}
            Entries are consolidated by <strong>Item · Unit</strong>. The same item category may legitimately appear on multiple lines when produced in different units (for example,{' '}
            <code className="text-neutral-800 font-medium">Moisture mat · sets</code> vs.{' '}
            <code className="text-neutral-800 font-medium">Moisture mat · pcs</code>), each compensated at their distinct rate table value.
          </div>
        </div>

        {/* Grouped Breakdown Card */}
        <div className="bg-white border border-neutral-200/80 rounded-xl overflow-hidden shadow-2xs">
          <div className="px-4 md:px-5 py-3.5 border-b border-neutral-100 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-neutral-900">
              Piece-Rate Earnings Breakdown
            </h2>
            <span className="text-xs text-neutral-500">
              {groupedBreakdown.length} lines
            </span>
          </div>

          {/* Desktop Table */}
          <div className="hidden md:block">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-neutral-50 text-neutral-500 border-b border-neutral-200/70">
                <tr>
                  <th className="py-2.5 pl-6 pr-3 font-semibold text-neutral-700">Category · Unit</th>
                  <th className="py-2.5 px-3 font-semibold text-neutral-700 text-right w-28">Piece Rate</th>
                  <th className="py-2.5 px-3 font-semibold text-neutral-700 text-right w-36">Quantity</th>
                  <th className="py-2.5 pr-6 pl-3 font-semibold text-neutral-700 text-right w-36">Subtotal</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {groupedBreakdown.map((group, idx) => (
                  <tr key={`${group.item}-${group.unit}-${idx}`} className="hover:bg-neutral-50/60">
                    <td className="py-3.5 pl-6 pr-3">
                      <div className="font-semibold text-neutral-900 text-sm">
                        {group.item} <span className="text-neutral-400 font-normal">·</span>{' '}
                        <span className="font-mono text-xs text-neutral-600 font-medium">{group.unit}</span>
                      </div>
                      <div className="text-[11px] text-neutral-400 mt-0.5">
                        {group.entries.length} log {group.entries.length === 1 ? 'entry' : 'entries'} in notebook
                      </div>
                    </td>

                    <td className="py-3.5 px-3 text-right font-mono tabular-nums text-neutral-600">
                      {formatCurrency(group.rate, currency)} / {group.unit}
                    </td>

                    <td className="py-3.5 px-3 text-right font-mono tabular-nums font-semibold text-neutral-800">
                      {group.totalQty} {group.unit}
                    </td>

                    <td className="py-3.5 pr-6 pl-3 text-right font-mono tabular-nums font-bold text-neutral-900 text-sm">
                      {formatCurrency(group.totalAmount, currency)}
                    </td>
                  </tr>
                ))}

                {groupedBreakdown.length === 0 && (
                  <tr>
                    <td colSpan={4} className="py-8 text-center text-neutral-400 italic">
                      No production logs recorded for {workerLabel} in {periodTitle}.
                    </td>
                  </tr>
                )}
              </tbody>

              <tfoot className="bg-neutral-50/90 border-t-2 border-neutral-200">
                <tr>
                  <td className="py-4 pl-6 pr-3 font-bold text-neutral-900 text-sm">
                    Total Payable
                  </td>
                  <td className="py-4 px-3 text-right text-xs text-neutral-500">
                    Output by unit:
                  </td>
                  <td className="py-4 px-3 text-right font-mono tabular-nums font-semibold text-neutral-800 text-xs">
                    {outputSummary}
                  </td>
                  <td className="py-4 pr-6 pl-3 text-right font-mono tabular-nums font-bold text-base text-neutral-900">
                    {formatCurrency(grandTotal, currency)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>

          {/* Mobile Card List */}
          <div className="md:hidden divide-y divide-neutral-100">
            {groupedBreakdown.map((group, idx) => (
              <div key={`${group.item}-${group.unit}-${idx}`} className="p-4 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="font-semibold text-neutral-900 text-sm">
                    {group.item} · <span className="font-mono text-xs text-neutral-600">{group.unit}</span>
                  </div>
                  <div className="text-xs text-neutral-500 mt-0.5 font-mono">
                    {group.totalQty} {group.unit} × {formatCurrency(group.rate, currency)}
                  </div>
                </div>
                <div className="text-sm font-mono tabular-nums font-bold text-neutral-900 shrink-0">
                  {formatCurrency(group.totalAmount, currency)}
                </div>
              </div>
            ))}

            {groupedBreakdown.length === 0 && (
              <div className="p-6 text-center text-xs text-neutral-400 italic">
                No production logs recorded in {periodTitle}.
              </div>
            )}

            <div className="p-4 bg-neutral-50 border-t border-neutral-200 flex items-center justify-between gap-2">
              <div>
                <div className="text-xs font-bold text-neutral-900">Total Payable</div>
                <div className="text-[11px] font-mono text-neutral-500 mt-0.5">{outputSummary}</div>
              </div>
              <div className="text-base font-mono tabular-nums font-bold text-neutral-900">
                {formatCurrency(grandTotal, currency)}
              </div>
            </div>
          </div>
        </div>

        {/* Scanned Pages Reference List */}
        <div className="bg-white border border-neutral-200/80 rounded-xl overflow-hidden shadow-2xs">
          <div className="px-4 md:px-5 py-3.5 border-b border-neutral-100 flex items-center justify-between gap-2">
            <h3 className="text-sm font-semibold text-neutral-900">
              Submitted Notebook Pages ({workerPages.length})
            </h3>
            <span className="text-xs text-neutral-400 hidden sm:inline">
              Original paper records for {workerLabel}
            </span>
          </div>

          <div className="divide-y divide-neutral-100">
            {workerPages.map(page => (
              <div
                key={page.pageId}
                className="px-4 md:px-5 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2 hover:bg-neutral-50/80 transition-colors"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-8 h-8 rounded bg-neutral-100 flex items-center justify-center text-neutral-500 shrink-0">
                    <FileText className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <div className="text-xs font-semibold text-neutral-900 truncate">
                      {page.notebookLabel || page.pageId}
                    </div>
                    <div className="text-[11px] text-neutral-400">
                      Scanned {page.scannedAt} · {page.rows.length} rows
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between sm:justify-end gap-3 pl-11 sm:pl-0">
                  {page.status === 'flagged' ? (
                    <span className="text-[11px] text-[var(--status-check)] bg-[var(--status-check-bg)] px-2 py-0.5 rounded font-medium">
                      Requires verification
                    </span>
                  ) : (
                    <span className="text-[11px] text-[var(--brand-700)] font-medium flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      Approved
                    </span>
                  )}

                  <button
                    onClick={() => {
                      setSelectedPageId(page.pageId);
                      setActiveView('review');
                    }}
                    className="text-xs font-semibold text-[var(--brand-700)] hover:underline px-2 py-1 min-h-[44px] sm:min-h-0 flex items-center cursor-pointer"
                  >
                    Inspect in Review →
                  </button>
                </div>
              </div>
            ))}

            {workerPages.length === 0 && (
              <div className="px-5 py-8 text-center text-xs text-neutral-400">
                No notebook pages submitted by {workerLabel} in {periodTitle}.
              </div>
            )}
          </div>
        </div>
      </main>

      {/* Pay Slip Modal */}
      {showSlipModal && (
        <PaySlipModal
          worker={worker}
          periodTitle={periodTitle}
          breakdown={groupedBreakdown}
          grandTotal={grandTotal}
          outputSummary={outputSummary}
          currency={currency}
          onClose={() => setShowSlipModal(false)}
        />
      )}
    </div>
  );
};
