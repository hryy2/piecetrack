import React, { useState } from 'react';
import { Search, Plus, Pencil } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { Worker } from '../types';
import {
  formatCurrency,
  formatOutputByUnit,
  formatWorkerLabel,
  getPeriodTitle,
  getWorkerInitials,
} from '../utils/formatters';
import { WorkerFormModal } from './WorkerFormModal';

type RosterFilter = 'all' | 'to_check' | 'ready' | 'paid' | 'not_in' | 'inactive';

export const WorkersListView: React.FC = () => {
  const { workers, activeWorkers, currency, period, openWorkerDetail } = useApp();
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<RosterFilter>('all');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingWorker, setEditingWorker] = useState<Worker | null>(null);

  const periodTitle = getPeriodTitle(period);
  const inactiveCount = workers.filter(w => !w.active).length;

  const filteredWorkers = workers.filter(w => {
    const matchesSearch =
      w.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      w.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (w.role || '').toLowerCase().includes(searchQuery.toLowerCase());

    if (!matchesSearch) return false;

    if (filterStatus === 'inactive') return !w.active;
    if (!w.active) return false;
    if (filterStatus === 'all') return true;
    return w.status === filterStatus;
  });

  const handleOpenAdd = () => {
    setEditingWorker(null);
    setModalOpen(true);
  };

  const handleOpenEdit = (worker: Worker) => {
    setEditingWorker(worker);
    setModalOpen(true);
  };

  const tabs: { id: RosterFilter; label: string }[] = [
    { id: 'all', label: 'All' },
    { id: 'to_check', label: 'To Check' },
    { id: 'ready', label: 'Ready' },
    { id: 'paid', label: 'Paid' },
    { id: 'not_in', label: 'Not In' },
    { id: 'inactive', label: inactiveCount > 0 ? `Inactive (${inactiveCount})` : 'Inactive' },
  ];

  const renderStatusBadge = (w: Worker) => {
    if (!w.active) {
      return (
        <span className="text-xs font-medium text-[var(--status-idle)] bg-[var(--status-idle-bg)] px-2 py-0.5 rounded border border-neutral-200">
          Inactive
        </span>
      );
    }
    switch (w.status) {
      case 'paid':
        return (
          <span className="text-xs font-medium text-[var(--status-paid)] bg-[var(--status-paid-bg)] px-2 py-0.5 rounded border border-[var(--status-paid-border)]">
            paid
          </span>
        );
      case 'ready':
        return (
          <span className="text-xs font-medium text-[var(--brand-700)] bg-[var(--brand-50)] px-2 py-0.5 rounded">
            ready
          </span>
        );
      case 'to_check':
        return (
          <span className="text-xs font-medium text-[var(--status-check)] bg-[var(--status-check-bg)] px-2 py-0.5 rounded">
            {w.flaggedPagesCount} to check
          </span>
        );
      case 'not_in':
        return (
          <span className="text-xs font-normal text-[var(--status-idle)] bg-[var(--status-idle-bg)] px-2 py-0.5 rounded">
            notebook not in
          </span>
        );
    }
  };

  return (
    <div className="flex-1 flex flex-col h-full overflow-y-auto overflow-x-hidden bg-[var(--surface-page)]">
      {/* Header */}
      <header className="px-4 md:px-8 pt-5 md:pt-8 pb-5 md:pb-6 border-b border-neutral-200/80 bg-white">
        <div className="max-w-5xl mx-auto space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <span className="text-xs font-semibold uppercase tracking-wider text-[var(--brand-800)]">
                Artisans &amp; Workers
              </span>
              <h1 className="text-xl font-bold tracking-tight text-neutral-900 mt-0.5">
                Workshop Roster ({activeWorkers.length} active)
              </h1>
              <p className="text-xs text-neutral-500 mt-1">
                Manage artisan roster, review piece-rate output, and issue individual settlements for {periodTitle}.
              </p>
            </div>

            <button
              type="button"
              onClick={handleOpenAdd}
              className="px-4 py-2.5 min-h-[44px] text-xs font-semibold text-white bg-[var(--brand-600)] hover:bg-[var(--brand-700)] rounded-lg flex items-center justify-center gap-1.5 transition-colors shadow-xs cursor-pointer shrink-0 w-full sm:w-auto"
            >
              <Plus className="w-4 h-4" />
              <span>Add Worker</span>
            </button>
          </div>

          {/* Search & Filter Row */}
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
            <div className="relative w-full lg:w-60">
              <Search className="w-4 h-4 text-neutral-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search worker or role..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-2 min-h-[44px] md:min-h-0 text-xs border border-neutral-300 rounded-lg bg-neutral-50/50 focus:outline-none focus:border-[var(--brand-600)]"
              />
            </div>

            {/* Status filter tabs */}
            <div className="flex items-center gap-1 bg-neutral-100 p-1 rounded-lg text-xs overflow-x-auto no-scrollbar">
              {tabs.map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setFilterStatus(tab.id)}
                  className={`px-3 py-2 md:py-1 min-h-[40px] md:min-h-0 rounded text-xs font-medium whitespace-nowrap transition-colors cursor-pointer ${
                    filterStatus === tab.id
                      ? 'bg-white text-neutral-900 shadow-2xs font-semibold'
                      : 'text-neutral-500 hover:text-neutral-800'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </header>

      {/* Main Roster Area */}
      <main className="max-w-5xl mx-auto w-full px-4 md:px-8 py-5 md:py-8">
        {/* Desktop & Tablet Table View (>= 768px) */}
        <div className="hidden md:block bg-white border border-neutral-200/80 rounded-xl overflow-hidden shadow-2xs">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="bg-neutral-50 text-neutral-500 border-b border-neutral-200/70">
              <tr>
                <th className="py-2.5 pl-6 pr-3 font-semibold text-neutral-700">Worker</th>
                <th className="py-2.5 px-3 font-semibold text-neutral-700">Pages</th>
                <th className="py-2.5 px-3 font-semibold text-neutral-700">Output</th>
                <th className="py-2.5 px-3 font-semibold text-neutral-700">Status</th>
                <th className="py-2.5 px-3 font-semibold text-neutral-700 text-right">Calculated Pay</th>
                <th className="py-2.5 pr-6 pl-3 text-right font-semibold text-neutral-700 w-20">Edit</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {filteredWorkers.map(w => {
                const isInactive = !w.active;
                const isNotIn = w.status === 'not_in';
                const workerLabel = formatWorkerLabel(w.name, w.code);
                const outputStr = formatOutputByUnit(w.outputByUnit);

                return (
                  <tr
                    key={w.id}
                    onClick={() => openWorkerDetail(w.id, 'workers')}
                    className={`transition-colors hover:bg-neutral-50/90 cursor-pointer ${
                      isInactive || isNotIn ? 'bg-neutral-50/35' : ''
                    }`}
                  >
                    {/* Worker Info */}
                    <td className="py-3.5 pl-6 pr-3">
                      <div className="flex items-center gap-3">
                        <div
                          className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
                            isNotIn || isInactive ? 'bg-neutral-200 text-neutral-500' : w.avatarColor
                          }`}
                        >
                          {getWorkerInitials(w.name, w.code)}
                        </div>
                        <div>
                          <div className="font-semibold text-neutral-900 text-sm">
                            {workerLabel}
                          </div>
                          <div className="text-[11px] text-neutral-400">
                            {w.role || `Joined ${w.joinedDate || 'workshop'}`}
                          </div>
                        </div>
                      </div>
                    </td>

                    {/* Pages */}
                    <td className="py-3.5 px-3 font-mono text-neutral-600">
                      {isNotIn ? '0 pages' : `${w.totalPages} ${w.totalPages === 1 ? 'page' : 'pages'}`}
                    </td>

                    {/* Output (grouped by unit) */}
                    <td className="py-3.5 px-3 font-mono text-neutral-600">
                      {isNotIn ? '—' : outputStr}
                    </td>

                    {/* Single Unified Status */}
                    <td className="py-3.5 px-3">
                      {renderStatusBadge(w)}
                    </td>

                    {/* Pay */}
                    <td className="py-3.5 px-3 text-right font-mono tabular-nums font-bold text-neutral-900 text-sm">
                      {isNotIn ? '—' : formatCurrency(w.totalAmount, currency)}
                    </td>

                    {/* Edit Action Only */}
                    <td className="py-3.5 pr-6 pl-3 text-right">
                      <button
                        type="button"
                        onClick={e => {
                          e.stopPropagation();
                          handleOpenEdit(w);
                        }}
                        title={`Edit ${workerLabel}`}
                        aria-label={`Edit ${workerLabel}`}
                        className="p-2 text-neutral-500 hover:text-neutral-900 hover:bg-neutral-100 rounded-lg transition-colors cursor-pointer"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                );
              })}

              {filteredWorkers.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-10 text-center text-neutral-400 text-xs">
                    No workers match the current filter.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Mobile Card List View (< 768px) */}
        <div className="md:hidden space-y-3">
          {filteredWorkers.map(w => {
            const isInactive = !w.active;
            const isNotIn = w.status === 'not_in';
            const workerLabel = formatWorkerLabel(w.name, w.code);
            const outputStr = formatOutputByUnit(w.outputByUnit);

            return (
              <div
                key={w.id}
                onClick={() => openWorkerDetail(w.id, 'workers')}
                className={`bg-white border border-neutral-200/80 rounded-xl p-4 shadow-2xs space-y-3 hover:bg-neutral-50/80 cursor-pointer transition-colors ${
                  isInactive || isNotIn ? 'bg-neutral-50/40' : ''
                }`}
              >
                {/* Top Row: Name + Reference Label on left, Single Status badge on right */}
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div
                      className={`w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
                        isNotIn || isInactive ? 'bg-neutral-200 text-neutral-500' : w.avatarColor
                      }`}
                    >
                      {getWorkerInitials(w.name, w.code)}
                    </div>
                    <div className="min-w-0">
                      <div className="text-sm font-semibold text-neutral-900 truncate">
                        {workerLabel}
                      </div>
                      <div className="text-[11px] text-neutral-400 truncate">
                        {w.role || `Joined ${w.joinedDate}`}
                      </div>
                    </div>
                  </div>

                  <div className="shrink-0">
                    {renderStatusBadge(w)}
                  </div>
                </div>

                {/* Middle Row: Large Pay + small Pages & unit-grouped Output */}
                <div className="flex items-baseline justify-between gap-3 pt-1">
                  <div className="text-xs text-neutral-500 min-w-0 truncate">
                    {isNotIn
                      ? '0 pages · No entries this period'
                      : `${w.totalPages} ${w.totalPages === 1 ? 'page' : 'pages'} · ${outputStr}`}
                  </div>
                  <div className="text-lg font-mono tabular-nums font-bold text-neutral-900 shrink-0">
                    {isNotIn ? '—' : formatCurrency(w.totalAmount, currency)}
                  </div>
                </div>

                {/* Card Footer: Only Edit button (tap card itself to open detail) */}
                <div className="pt-2.5 border-t border-neutral-100 flex items-center justify-end">
                  <button
                    type="button"
                    onClick={e => {
                      e.stopPropagation();
                      handleOpenEdit(w);
                    }}
                    className="px-3 py-2 min-h-[44px] text-xs font-medium text-neutral-700 bg-neutral-50 hover:bg-neutral-100 border border-neutral-200 rounded-lg flex items-center gap-1.5"
                  >
                    <Pencil className="w-3.5 h-3.5 text-neutral-500" />
                    <span>Edit</span>
                  </button>
                </div>
              </div>
            );
          })}

          {filteredWorkers.length === 0 && (
            <div className="bg-white border border-neutral-200/80 rounded-xl p-8 text-center text-xs text-neutral-400">
              No workers match the current filter.
            </div>
          )}
        </div>
      </main>

      {/* Add / Edit Worker Modal */}
      {modalOpen && (
        <WorkerFormModal
          worker={editingWorker}
          onClose={() => setModalOpen(false)}
        />
      )}
    </div>
  );
};
