import React from 'react';
import { X, Printer } from 'lucide-react';
import { CurrencyConfig, Worker } from '../types';
import { formatCurrency, formatWorkerLabel } from '../utils/formatters';

interface PaySlipModalProps {
  worker: Worker;
  periodTitle: string;
  breakdown: Array<{
    item: string;
    unit: string;
    rate: number;
    totalQty: number;
    totalAmount: number;
  }>;
  grandTotal: number;
  outputSummary: string;
  currency: CurrencyConfig;
  onClose: () => void;
}

export const PaySlipModal: React.FC<PaySlipModalProps> = ({
  worker,
  periodTitle,
  breakdown,
  grandTotal,
  outputSummary,
  currency,
  onClose,
}) => {
  const workerLabel = formatWorkerLabel(worker.name, worker.code);
  const hasDistinctCode =
    worker.name.trim().toLowerCase() !== worker.code.trim().toLowerCase();

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
      <div className="bg-white rounded-xl max-w-xl w-full border border-neutral-200 shadow-xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="px-5 md:px-6 py-3.5 border-b border-neutral-100 flex items-center justify-between bg-neutral-50 select-none">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-sm text-neutral-900">
              Piece-Rate Wage Slip
            </span>
            <span className="text-xs text-neutral-400 hidden sm:inline">· Preview &amp; Print</span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="px-3 py-1.5 min-h-[40px] text-xs font-semibold text-white bg-[var(--brand-600)] hover:bg-[var(--brand-700)] rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Print Slip</span>
            </button>
            <button
              onClick={onClose}
              className="min-w-[40px] min-h-[40px] flex items-center justify-center text-neutral-400 hover:text-neutral-700 rounded-lg"
              aria-label="Close modal"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Printable Paper Canvas */}
        <div className="p-5 md:p-8 overflow-y-auto font-sans text-neutral-900 bg-white" id="printable-slip">
          {/* Workshop Header */}
          <div className="border-b-2 border-neutral-800 pb-4 mb-6 flex justify-between items-start gap-2">
            <div>
              <div className="text-base md:text-lg font-black tracking-tight uppercase text-neutral-900">
                PieceTrack Workshop #1
              </div>
              <div className="text-xs text-neutral-500 mt-0.5">
                Piecework Production Wage Settlement
              </div>
            </div>
            <div className="text-right">
              <div className="text-xs font-bold text-[var(--brand-800)] uppercase tracking-wider">
                Settlement Slip
              </div>
              <div className="text-xs text-neutral-500 mt-0.5">
                Date: {new Date().toISOString().slice(0, 10)}
              </div>
            </div>
          </div>

          {/* Worker & Period Grid */}
          <div className="grid grid-cols-2 gap-4 pb-6 mb-6 border-b border-neutral-200 text-xs">
            <div>
              <div className="text-neutral-400 text-[11px] uppercase tracking-wider">Worker Details</div>
              <div className="font-bold text-sm text-neutral-900 mt-0.5">{workerLabel}</div>
              {hasDistinctCode && (
                <div className="text-neutral-500 font-mono">{worker.code}</div>
              )}
            </div>
            <div>
              <div className="text-neutral-400 text-[11px] uppercase tracking-wider">Payroll Period</div>
              <div className="font-bold text-sm text-neutral-900 mt-0.5">{periodTitle}</div>
              <div className="text-neutral-500">
                Status: {worker.status === 'paid' ? 'Disbursed (Paid)' : 'Approved for payout'}
              </div>
            </div>
          </div>

          {/* Itemized Piecework Table */}
          <table className="w-full text-left text-xs border-collapse mb-6">
            <thead>
              <tr className="border-b border-neutral-300 text-neutral-600">
                <th className="py-2 font-bold">Item Description</th>
                <th className="py-2 text-right font-bold">Unit</th>
                <th className="py-2 text-right font-bold">Rate</th>
                <th className="py-2 text-right font-bold">Qty</th>
                <th className="py-2 text-right font-bold">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-200">
              {breakdown.map((row, idx) => (
                <tr key={idx}>
                  <td className="py-2 font-medium text-neutral-900">{row.item}</td>
                  <td className="py-2 text-right font-mono text-neutral-600">{row.unit}</td>
                  <td className="py-2 text-right font-mono text-neutral-600">
                    {formatCurrency(row.rate, currency)}
                  </td>
                  <td className="py-2 text-right font-mono font-medium text-neutral-900">
                    {row.totalQty}
                  </td>
                  <td className="py-2 text-right font-mono font-bold text-neutral-900">
                    {formatCurrency(row.totalAmount, currency)}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot className="border-t-2 border-neutral-800">
              <tr>
                <td colSpan={2} className="py-3 font-bold text-neutral-900">
                  Total Payable
                </td>
                <td colSpan={2} className="py-3 text-right font-mono text-[11px] text-neutral-600">
                  {outputSummary}
                </td>
                <td className="py-3 text-right font-mono font-black text-sm text-neutral-900">
                  {formatCurrency(grandTotal, currency)}
                </td>
              </tr>
            </tfoot>
          </table>

          {/* Signature lines */}
          <div className="pt-8 mt-8 border-t border-neutral-200 grid grid-cols-2 gap-8 text-[11px] text-neutral-500">
            <div>
              <div className="h-10 border-b border-dashed border-neutral-300 mb-1"></div>
              <div>Workshop Supervisor Signature</div>
            </div>
            <div>
              <div className="h-10 border-b border-dashed border-neutral-300 mb-1"></div>
              <div>Worker Acknowledgment / Date</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
