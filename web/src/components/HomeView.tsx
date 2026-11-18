import React from 'react';
import { Camera, AlertCircle, ChevronRight, CheckCircle2, Users } from 'lucide-react';
import { useApp } from '../context/AppContext';
import {
  formatCurrency,
  formatOutputByUnit,
  formatWorkerLabel,
  getPeriodTitle,
  getWorkerInitials,
} from '../utils/formatters';

export const HomeView: React.FC = () => {
  const {
    period,
    currency,
    activeWorkers,
    runningTotal,
    stillToPay,
    totalPagesCount,
    flaggedPagesCount,
    submittedWorkersCount,
    readyWorkersCount,
    paidWorkersCount,
    openReviewPage,
    openWorkerDetail,
    setActiveView,
  } = useApp();

  const totalWorkers = activeWorkers.length;
  const periodTitle = getPeriodTitle(period);

  return (
    <div className="flex-1 flex flex-col h-full overflow-y-auto overflow-x-hidden bg-[var(--surface-page)]">
      {/* Top Header */}
      <header className="px-4 md:px-8 pt-5 md:pt-8 pb-5 md:pb-6 border-b border-neutral-200/70 bg-white">
        <div className="max-w-5xl mx-auto">
          <div>
            <span className="text-xs font-semibold uppercase tracking-wider text-[var(--brand-800)]">
              Active Period
            </span>
            <h1 className="text-xl md:text-2xl font-bold tracking-tight text-neutral-900 mt-1">
              {periodTitle}
            </h1>
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs md:text-sm text-neutral-500 mt-1.5">
              <span className="font-medium text-neutral-700">
                {submittedWorkersCount} of {totalWorkers} workers submitted
              </span>
              <span aria-hidden="true" className="text-neutral-300">·</span>
              <span>Due {period.dueDate}</span>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="max-w-5xl mx-auto w-full px-4 md:px-8 py-5 md:py-6 flex-1 flex flex-col gap-5 md:gap-6">
        {/* Four Metric Cards: 2x2 grid on mobile, 4 columns on tablet/desktop */}
        <section className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
          {/* 1. Running total */}
          <div className="bg-white border border-neutral-200/80 rounded-xl p-4 md:p-5 flex flex-col justify-between shadow-2xs">
            <div className="text-xs text-neutral-500 font-medium">Running total</div>
            <div className="mt-2.5 md:mt-3">
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-lg md:text-2xl font-bold tracking-tight text-neutral-900 font-mono tabular-nums truncate">
                  {formatCurrency(runningTotal, currency)}
                </span>
                {flaggedPagesCount > 0 && (
                  <span className="text-[10px] font-medium text-neutral-600 bg-neutral-100 border border-neutral-200 px-1.5 py-0.5 rounded shrink-0">
                    provisional
                  </span>
                )}
              </div>
              <div className="text-[11px] text-neutral-400 mt-1 space-y-0.5">
                {flaggedPagesCount > 0 && (
                  <div>
                    Includes {flaggedPagesCount} {flaggedPagesCount === 1 ? 'page' : 'pages'} awaiting review
                  </div>
                )}
                <div>
                  {stillToPay > 0
                    ? `${formatCurrency(stillToPay, currency)} still to pay`
                    : runningTotal > 0
                    ? 'All settled'
                    : 'No entries yet'}
                </div>
              </div>
            </div>
          </div>

          {/* 2. Pages scanned */}
          <div className="bg-white border border-neutral-200/80 rounded-xl p-4 md:p-5 flex flex-col justify-between shadow-2xs">
            <div className="text-xs text-neutral-500 font-medium">Pages scanned</div>
            <div className="mt-2.5 md:mt-3">
              <div className="text-lg md:text-2xl font-bold tracking-tight text-neutral-900 font-mono tabular-nums">
                {totalPagesCount}
              </div>
              <div className="text-[11px] text-neutral-400 mt-1">
                {submittedWorkersCount} workbooks in
              </div>
            </div>
          </div>

          {/* 3. Need checking */}
          <button
            type="button"
            onClick={() => flaggedPagesCount > 0 && openReviewPage()}
            className={`text-left border rounded-xl p-4 md:p-5 flex flex-col justify-between transition-all min-h-[44px] ${
              flaggedPagesCount > 0
                ? 'bg-[var(--status-check-bg)] border-[var(--status-check-border)] text-[var(--status-check-ink)] cursor-pointer hover:shadow-xs'
                : 'bg-white border-neutral-200/80 text-neutral-900 shadow-2xs cursor-default'
            }`}
          >
            <div className="flex items-center justify-between w-full">
              <span
                className={`text-xs font-semibold ${
                  flaggedPagesCount > 0 ? 'text-[var(--status-check)]' : 'text-neutral-500'
                }`}
              >
                Need checking
              </span>
              {flaggedPagesCount > 0 ? (
                <AlertCircle className="w-4 h-4 text-[var(--status-check)] shrink-0" />
              ) : (
                <CheckCircle2 className="w-4 h-4 text-[var(--brand-600)] shrink-0" />
              )}
            </div>
            <div className="mt-2.5 md:mt-3">
              <div className="text-lg md:text-2xl font-bold tracking-tight font-mono tabular-nums">
                {flaggedPagesCount} {flaggedPagesCount === 1 ? 'page' : 'pages'}
              </div>
              <div
                className={`text-[11px] mt-1 ${
                  flaggedPagesCount > 0 ? 'text-[var(--status-check)]' : 'text-neutral-400'
                }`}
              >
                {flaggedPagesCount > 0 ? 'Tap to review queue' : 'All pages approved'}
              </div>
            </div>
          </button>

          {/* 4. Ready to pay (excludes paid, shows N paid below) */}
          <div className="bg-white border border-neutral-200/80 rounded-xl p-4 md:p-5 flex flex-col justify-between shadow-2xs">
            <div className="flex items-center justify-between">
              <span className="text-xs text-neutral-500 font-medium">Ready to pay</span>
              <Users className="w-4 h-4 text-[var(--brand-600)] shrink-0" />
            </div>
            <div className="mt-2.5 md:mt-3">
              <div className="text-lg md:text-2xl font-bold tracking-tight text-neutral-900 font-mono tabular-nums">
                {readyWorkersCount} of {totalWorkers}
              </div>
              <div className="text-[11px] text-neutral-400 mt-1">
                {paidWorkersCount} paid
              </div>
            </div>
          </div>
        </section>

        {/* Workers List Section */}
        <section className="bg-white border border-neutral-200/80 rounded-xl overflow-hidden shadow-2xs flex-1 flex flex-col">
          <div className="px-4 md:px-5 py-3.5 md:py-4 border-b border-neutral-100 flex items-center justify-between gap-3">
            <div className="min-w-0">
              <h2 className="text-sm font-semibold text-neutral-900">
                Workshop Roster
              </h2>
              <p className="text-xs text-neutral-500 mt-0.5 truncate">
                Submission status and calculated wages for {periodTitle}
              </p>
            </div>
            <button
              onClick={() => setActiveView('workers')}
              className="text-xs font-medium text-[var(--brand-700)] hover:underline min-h-[44px] px-2 flex items-center shrink-0 cursor-pointer"
            >
              View ledger →
            </button>
          </div>

          <div className="divide-y divide-neutral-100 flex-1 overflow-y-auto">
            {activeWorkers.map(worker => {
              const isNotIn = worker.status === 'not_in';
              const isToCheck = worker.status === 'to_check';
              const isReady = worker.status === 'ready';
              const isPaid = worker.status === 'paid';
              const workerLabel = formatWorkerLabel(worker.name, worker.code);
              const outputStr = formatOutputByUnit(worker.outputByUnit);

              return (
                <div
                  key={worker.id}
                  onClick={() => openWorkerDetail(worker.id, 'home')}
                  className={`px-4 md:px-5 py-3.5 transition-colors hover:bg-neutral-50/90 cursor-pointer ${
                    isNotIn ? 'bg-neutral-50/40' : ''
                  }`}
                >
                  {/* Mobile Card Layout (< 768px) */}
                  <div className="md:hidden flex flex-col gap-2">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div
                          className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
                            isNotIn ? 'bg-neutral-200 text-neutral-500' : worker.avatarColor
                          }`}
                        >
                          {getWorkerInitials(worker.name, worker.code)}
                        </div>
                        <div className="min-w-0">
                          <div className="text-sm font-semibold text-neutral-900 truncate">
                            {workerLabel}
                          </div>
                        </div>
                      </div>

                      {/* Single unified status */}
                      <div className="shrink-0">
                        {isPaid && (
                          <span className="text-xs font-medium text-[var(--status-paid)] bg-[var(--status-paid-bg)] px-2 py-0.5 rounded border border-[var(--status-paid-border)]">
                            paid
                          </span>
                        )}
                        {isReady && (
                          <span className="text-xs font-medium text-[var(--brand-700)] bg-[var(--brand-50)] px-2 py-0.5 rounded">
                            ready
                          </span>
                        )}
                        {isToCheck && (
                          <span className="text-xs font-medium text-[var(--status-check)] bg-[var(--status-check-bg)] px-2 py-0.5 rounded">
                            {worker.flaggedPagesCount} to check
                          </span>
                        )}
                        {isNotIn && (
                          <span className="text-xs font-normal text-[var(--status-idle)] bg-[var(--status-idle-bg)] px-2 py-0.5 rounded">
                            notebook not in
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-baseline justify-between gap-2 pl-10">
                      <div className="text-xs text-neutral-500 truncate">
                        {isNotIn
                          ? 'No pages received this period'
                          : `${worker.totalPages} ${worker.totalPages === 1 ? 'page' : 'pages'} · ${outputStr}`}
                      </div>
                      <div
                        className={`text-base font-mono tabular-nums shrink-0 ${
                          isNotIn ? 'text-neutral-400' : 'font-bold text-neutral-900'
                        }`}
                      >
                        {isNotIn ? '—' : formatCurrency(worker.totalAmount, currency)}
                      </div>
                    </div>
                  </div>

                  {/* Desktop & Tablet Row Layout (>= 768px) */}
                  <div className="hidden md:flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3.5 min-w-0">
                      <div
                        className={`w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
                          isNotIn ? 'bg-neutral-200 text-neutral-500' : worker.avatarColor
                        }`}
                      >
                        {getWorkerInitials(worker.name, worker.code)}
                      </div>

                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-semibold text-neutral-900">
                            {workerLabel}
                          </span>
                          {worker.role && (
                            <span className="text-xs text-neutral-400 font-normal truncate">
                              · {worker.role}
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-neutral-400 mt-0.5">
                          {isNotIn
                            ? 'No pages received this period'
                            : `${worker.totalPages} ${worker.totalPages === 1 ? 'page' : 'pages'} scanned · ${outputStr}`}
                        </div>
                      </div>
                    </div>

                    {/* Right: Single Status + Amount */}
                    <div className="flex items-center gap-6 shrink-0">
                      <div className="w-32 text-right">
                        {isPaid && (
                          <span className="text-xs font-medium text-[var(--status-paid)] bg-[var(--status-paid-bg)] px-2 py-0.5 rounded border border-[var(--status-paid-border)]">
                            paid
                          </span>
                        )}
                        {isReady && (
                          <span className="text-xs font-medium text-[var(--brand-700)] bg-[var(--brand-50)] px-2 py-0.5 rounded">
                            ready
                          </span>
                        )}
                        {isToCheck && (
                          <span className="text-xs font-medium text-[var(--status-check)] bg-[var(--status-check-bg)] px-2 py-0.5 rounded">
                            {worker.flaggedPagesCount} to check
                          </span>
                        )}
                        {isNotIn && (
                          <span className="text-xs font-normal text-[var(--status-idle)] bg-[var(--status-idle-bg)] px-2 py-0.5 rounded">
                            notebook not in
                          </span>
                        )}
                      </div>

                      <div className="w-24 text-right">
                        <span
                          className={`text-sm font-mono tabular-nums ${
                            isNotIn ? 'text-neutral-400' : 'font-semibold text-neutral-900'
                          }`}
                        >
                          {isNotIn ? '—' : formatCurrency(worker.totalAmount, currency)}
                        </span>
                      </div>

                      <ChevronRight className="w-4 h-4 text-neutral-300" />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* Bottom Action Bar */}
        <div className="pt-1 pb-4 flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="text-xs text-neutral-400">
            {flaggedPagesCount > 0 ? (
              <span>
                <strong className="text-neutral-700 font-semibold">
                  {flaggedPagesCount} flagged {flaggedPagesCount === 1 ? 'page' : 'pages'}
                </strong>{' '}
                require owner verification before issuing payroll.
              </span>
            ) : (
              <span>All submitted notebook pages have been approved for this period.</span>
            )}
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 sm:gap-3">
            <button
              onClick={() => setActiveView('scan')}
              className="px-4 py-2.5 min-h-[44px] text-xs font-semibold text-neutral-700 bg-white border border-neutral-300 rounded-lg hover:bg-neutral-50 transition-colors flex items-center justify-center gap-2 shadow-2xs cursor-pointer"
            >
              <Camera className="w-4 h-4 text-neutral-500" />
              <span>Scan a notebook</span>
            </button>

            <button
              onClick={() => openReviewPage()}
              className="px-5 py-2.5 min-h-[44px] text-xs font-semibold text-white bg-[var(--brand-600)] hover:bg-[var(--brand-700)] rounded-lg transition-colors flex items-center justify-center gap-2 shadow-xs cursor-pointer"
            >
              <AlertCircle className="w-4 h-4" />
              <span>
                {flaggedPagesCount > 0
                  ? `Check ${flaggedPagesCount} flagged ${flaggedPagesCount === 1 ? 'page' : 'pages'}`
                  : 'Review all pages'}
              </span>
            </button>
          </div>
        </div>
      </main>
    </div>
  );
};
