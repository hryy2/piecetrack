import React, { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { Worker } from '../types';
import { useApp } from '../context/AppContext';
import { getNextReferenceLabel } from '../utils/formatters';

interface WorkerFormModalProps {
  worker?: Worker | null; // Undefined or null = Add mode; Worker = Edit mode
  onClose: () => void;
}

export const WorkerFormModal: React.FC<WorkerFormModalProps> = ({ worker, onClose }) => {
  const { workers, addWorker, updateWorker, deleteWorker, hasSettlementHistory } = useApp();

  const isEditMode = Boolean(worker);
  const todayISO = new Date().toISOString().slice(0, 10);

  const [displayName, setDisplayName] = useState<string>('');
  const [referenceLabel, setReferenceLabel] = useState<string>('');
  const [role, setRole] = useState<string>('');
  const [joinedDate, setJoinedDate] = useState<string>(todayISO);
  const [statusActive, setStatusActive] = useState<'Active' | 'Inactive'>('Active');
  const [errorMsg, setErrorMsg] = useState<string>('');
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState<boolean>(false);

  useEffect(() => {
    if (worker) {
      setDisplayName(worker.name);
      setReferenceLabel(worker.code);
      setRole(worker.role || '');
      setJoinedDate(worker.joinedDate || todayISO);
      setStatusActive(worker.active ? 'Active' : 'Inactive');
    } else {
      const nextLabel = getNextReferenceLabel(workers);
      setDisplayName(nextLabel);
      setReferenceLabel(nextLabel);
      setRole('');
      setJoinedDate(todayISO);
      setStatusActive('Active');
    }
    setErrorMsg('');
    setConfirmDeleteOpen(false);
  }, [worker, workers, todayISO]);

  const hasHistory = worker ? hasSettlementHistory(worker.id) : false;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!displayName.trim() || !referenceLabel.trim() || !joinedDate) {
      setErrorMsg('Display name, Reference label, and Joined date are required.');
      return;
    }

    const payload = {
      name: displayName.trim(),
      code: referenceLabel.trim(),
      role: role.trim() || undefined,
      joinedDate,
      active: statusActive === 'Active',
    };

    if (isEditMode && worker) {
      updateWorker(worker.id, payload);
    } else {
      addWorker(payload);
    }

    onClose();
  };

  const handleConfirmDelete = () => {
    if (!worker) return;
    const deleted = deleteWorker(worker.id);
    if (deleted) {
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
      <div className="bg-white rounded-xl max-w-md w-full border border-neutral-200 shadow-xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-neutral-100 flex items-center justify-between bg-neutral-50 select-none">
          <div>
            <h2 className="text-base font-bold text-neutral-900">
              {isEditMode ? 'Edit Worker' : 'Add Worker'}
            </h2>
            <p className="text-xs text-neutral-500 mt-0.5">
              {isEditMode
                ? 'Update roster details or set status to Inactive'
                : 'Register a new workshop artisan for piece-rate tracking'}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="min-w-[44px] min-h-[44px] flex items-center justify-center text-neutral-400 hover:text-neutral-700 rounded-lg"
            aria-label="Close modal"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Delete Confirmation Prompt */}
        {confirmDeleteOpen && worker ? (
          <div className="p-6 space-y-5">
            <div className="space-y-1.5">
              <h3 className="text-sm font-bold text-neutral-900">
                Delete {worker.name}? This cannot be undone.
              </h3>
              <p className="text-xs text-neutral-500">
                This worker will be permanently removed from the workshop roster.
              </p>
            </div>
            <div className="flex items-center justify-end gap-2 pt-2 border-t border-neutral-100">
              <button
                type="button"
                onClick={() => setConfirmDeleteOpen(false)}
                className="px-4 py-2.5 min-h-[44px] text-xs font-medium text-neutral-600 hover:text-neutral-900 rounded-lg border border-neutral-200 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                className="px-4 py-2.5 min-h-[44px] text-xs font-semibold text-[var(--status-error)] bg-[var(--status-error)]/10 hover:bg-[var(--status-error)]/15 border border-[var(--status-error)]/30 rounded-lg cursor-pointer transition-colors"
              >
                Delete
              </button>
            </div>
          </div>
        ) : (
          /* Form Body */
          <form onSubmit={handleSubmit} className="p-6 space-y-4 overflow-y-auto">
            {errorMsg && (
              <div className="p-3 rounded-lg bg-[var(--status-check-bg)] border border-[var(--status-check-border)] text-xs text-[var(--status-check-ink)]">
                {errorMsg}
              </div>
            )}

            {/* Display name */}
            <div>
              <label className="block text-xs font-semibold text-neutral-700 mb-1">
                Display name *
              </label>
              <input
                type="text"
                required
                value={displayName}
                onChange={e => setDisplayName(e.target.value)}
                placeholder="e.g. Worker M"
                className="w-full text-xs border border-neutral-300 rounded-lg px-3 py-2.5 min-h-[44px] focus:outline-none focus:border-[var(--brand-600)]"
              />
              <p className="text-[11px] text-neutral-400 mt-1">
                Name shown in the interface and CSV exports
              </p>
            </div>

            {/* Reference label */}
            <div>
              <label className="block text-xs font-semibold text-neutral-700 mb-1">
                Reference label *
              </label>
              <input
                type="text"
                required
                value={referenceLabel}
                onChange={e => setReferenceLabel(e.target.value)}
                placeholder="e.g. Worker A"
                className="w-full text-xs border border-neutral-300 rounded-lg px-3 py-2.5 min-h-[44px] font-mono focus:outline-none focus:border-[var(--brand-600)]"
              />
              <p className="text-[11px] text-neutral-400 mt-1">
                Workshop code assigned automatically (editable)
              </p>
            </div>

            {/* Role */}
            <div>
              <label className="block text-xs font-semibold text-neutral-700 mb-1">
                Role
              </label>
              <input
                type="text"
                value={role}
                onChange={e => setRole(e.target.value)}
                placeholder="e.g. Senior cutting and edging artisan"
                className="w-full text-xs border border-neutral-300 rounded-lg px-3 py-2.5 min-h-[44px] focus:outline-none focus:border-[var(--brand-600)]"
              />
            </div>

            {/* Joined & Status */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-neutral-700 mb-1">
                  Joined *
                </label>
                <input
                  type="date"
                  required
                  value={joinedDate}
                  onChange={e => setJoinedDate(e.target.value)}
                  className="w-full text-xs border border-neutral-300 rounded-lg px-3 py-2.5 min-h-[44px] focus:outline-none focus:border-[var(--brand-600)]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-neutral-700 mb-1">
                  Status
                </label>
                <select
                  value={statusActive}
                  onChange={e => setStatusActive(e.target.value as 'Active' | 'Inactive')}
                  className="w-full text-xs border border-neutral-300 rounded-lg px-3 py-2.5 min-h-[44px] bg-white focus:outline-none focus:border-[var(--brand-600)]"
                >
                  <option value="Active">Active</option>
                  <option value="Inactive">Inactive</option>
                </select>
              </div>
            </div>

            {/* Footer: Left side = Delete text button (if no history) OR muted note (if has history); Right side = Cancel / Save */}
            <div className="pt-4 border-t border-neutral-100 flex flex-col-reverse sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center">
                {isEditMode && worker && (
                  hasHistory ? (
                    <span className="text-[11px] text-neutral-400 leading-snug">
                      Has settlement history — set to Inactive instead.
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setConfirmDeleteOpen(true)}
                      className="px-2.5 py-2 min-h-[44px] text-xs font-medium text-[var(--status-error)] hover:bg-[var(--status-error)]/10 rounded-lg transition-colors cursor-pointer"
                    >
                      Delete
                    </button>
                  )
                )}
              </div>

              <div className="flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2.5 min-h-[44px] text-xs font-medium text-neutral-600 hover:text-neutral-900 rounded-lg border border-neutral-200 sm:border-transparent cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 min-h-[44px] text-xs font-semibold text-white bg-[var(--brand-600)] hover:bg-[var(--brand-700)] rounded-lg transition-colors cursor-pointer"
                >
                  {isEditMode ? 'Save changes' : 'Add worker'}
                </button>
              </div>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
