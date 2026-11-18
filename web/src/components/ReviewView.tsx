import React, { useState, useRef, useMemo } from 'react';
import {
  ZoomIn,
  ZoomOut,
  RotateCcw,
  CheckCircle2,
  Plus,
  Trash2,
  ChevronLeft,
  ChevronRight,
  Info,
  SlidersHorizontal,
  Camera,
  PenLine,
  Monitor,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import {
  calculateRowAmount,
  formatCurrency,
  formatDate,
  isLowConfidence,
} from '../utils/formatters';

export const ReviewView: React.FC = () => {
  const {
    activePage,
    pages,
    selectedPageId,
    setSelectedPageId,
    activeRowId,
    setActiveRowId,
    approvePage,
    updateRowField,
    updateRowNote,
    addRow,
    deleteRow,
    currency,
    dateFormat,
    rateTable,
    confidenceThreshold,
    flaggedPages,
    setActiveView,
  } = useApp();

  // Zoom & Pan state for the scanned notebook image
  const [zoomLevel, setZoomLevel] = useState<number>(1);
  const [showNotesColumn, setShowNotesColumn] = useState<boolean>(false);
  const [activeEditingCell, setActiveEditingCell] = useState<{
    rowId: string;
    fieldKey: string;
  } | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);

  const handleZoomIn = () => setZoomLevel(prev => Math.min(prev + 0.25, 2.5));
  const handleZoomOut = () => setZoomLevel(prev => Math.max(prev - 0.25, 0.75));
  const handleResetZoom = () => setZoomLevel(1);

  if (!activePage) {
    return (
      <div className="flex-1 flex items-center justify-center bg-[var(--surface-page)] p-4">
        <div className="text-center p-8 bg-white border border-neutral-200 rounded-xl max-w-sm w-full">
          <CheckCircle2 className="w-10 h-10 text-[var(--brand-600)] mx-auto mb-3" />
          <h2 className="text-base font-semibold text-neutral-900">
            No pages awaiting review
          </h2>
          <p className="text-xs text-neutral-500 mt-1">
            All submitted notebook pages have been approved.
          </p>
          <button
            onClick={() => setActiveView('home')}
            className="mt-4 px-4 py-2.5 min-h-[44px] text-xs font-medium text-white bg-[var(--brand-600)] hover:bg-[var(--brand-700)] rounded-lg"
          >
            Return to This period
          </button>
        </div>
      </div>
    );
  }

  // Calculate page total
  const pageTotal = useMemo(() => {
    return activePage.rows.reduce((sum, row) => {
      const { amount } = calculateRowAmount(row, rateTable);
      return sum + amount;
    }, 0);
  }, [activePage.rows, rateTable]);

  // Count low-confidence rows on this page
  const flaggedRowsCount = activePage.rows.filter(row =>
    Object.values(row.fields).some(f => isLowConfidence(f.confidence, confidenceThreshold))
  ).length;

  // Navigation between pages
  const currentIndex = pages.findIndex(p => p.pageId === selectedPageId);
  const prevPage = currentIndex > 0 ? pages[currentIndex - 1] : null;
  const nextPage = currentIndex < pages.length - 1 ? pages[currentIndex + 1] : null;

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden bg-[var(--surface-page)]">
      {/* Top Header & Page Selector Bar */}
      <header className="px-4 md:px-6 py-2.5 md:h-14 border-b border-neutral-200/80 bg-white flex flex-wrap items-center justify-between gap-2 shrink-0 select-none">
        <div className="flex items-center gap-2 md:gap-4 min-w-0">
          <button
            onClick={() => setActiveView('home')}
            className="text-xs text-neutral-500 hover:text-neutral-900 flex items-center gap-1 font-medium min-h-[44px] md:min-h-0 px-1 cursor-pointer shrink-0"
          >
            <ChevronLeft className="w-4 h-4" />
            <span className="hidden sm:inline">This period</span>
          </button>

          <span className="text-neutral-300 hidden sm:inline">|</span>

          {/* Current Page Identity */}
          <div className="flex items-center gap-2 min-w-0 flex-wrap">
            <span className="font-semibold text-xs md:text-sm text-neutral-900 truncate">
              {activePage.notebookLabel || activePage.pageId}
            </span>
            <span className="text-xs text-neutral-500 font-medium shrink-0">
              ({activePage.workerName})
            </span>

            {activePage.status === 'flagged' ? (
              <span className="text-[11px] font-semibold text-[var(--status-check)] bg-[var(--status-check-bg)] px-2 py-0.5 rounded border border-[var(--status-check-border)] shrink-0">
                {flaggedRowsCount} flagged {flaggedRowsCount === 1 ? 'row' : 'rows'}
              </span>
            ) : (
              <span className="text-[11px] font-medium text-[var(--brand-700)] bg-[var(--brand-50)] px-2 py-0.5 rounded border border-[var(--brand-600)]/20 flex items-center gap-1 shrink-0">
                <CheckCircle2 className="w-3 h-3 text-[var(--brand-600)]" />
                Approved
              </span>
            )}
          </div>
        </div>

        {/* Page Switcher controls */}
        <div className="flex items-center gap-2 ml-auto">
          <div className="flex items-center gap-1 text-xs text-neutral-500">
            <span className="hidden sm:inline">Page</span>
            <select
              value={selectedPageId || ''}
              onChange={e => setSelectedPageId(e.target.value)}
              className="bg-neutral-50 border border-neutral-200 rounded px-2 py-1.5 min-h-[40px] md:min-h-0 text-xs font-medium text-neutral-800 focus:outline-none max-w-[170px] sm:max-w-none"
            >
              {pages.map((p, idx) => (
                <option key={p.pageId} value={p.pageId}>
                  {p.notebookLabel || `Page ${idx + 1}`} ({p.status === 'flagged' ? 'Flagged' : 'OK'})
                </option>
              ))}
            </select>
            <span className="hidden md:inline">of {pages.length}</span>
          </div>

          <div className="flex items-center gap-0.5">
            <button
              disabled={!prevPage}
              onClick={() => prevPage && setSelectedPageId(prevPage.pageId)}
              className="min-w-[40px] min-h-[40px] md:min-w-0 md:min-h-0 md:p-1.5 flex items-center justify-center rounded text-neutral-500 hover:text-neutral-900 disabled:opacity-30 cursor-pointer"
              title="Previous page"
              aria-label="Previous page"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              disabled={!nextPage}
              onClick={() => nextPage && setSelectedPageId(nextPage.pageId)}
              className="min-w-[40px] min-h-[40px] md:min-w-0 md:min-h-0 md:p-1.5 flex items-center justify-center rounded text-neutral-500 hover:text-neutral-900 disabled:opacity-30 cursor-pointer"
              title="Next page"
              aria-label="Next page"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      {/* Mobile-only banner above photo */}
      <div className="md:hidden px-4 py-2 bg-neutral-100 border-b border-neutral-200 text-[11px] text-neutral-600 flex items-center gap-2 shrink-0">
        <Monitor className="w-3.5 h-3.5 text-neutral-500 shrink-0" />
        <span>For side-by-side checking, open on a tablet or desktop.</span>
      </div>

      {/* Main Split-Screen Workspace (Mobile: vertical scroll with photo top, cards below; Tablet/Desktop: 44%/56% side-by-side) */}
      <div className="flex-1 flex flex-col md:flex-row overflow-y-auto md:overflow-hidden">
        {/* ================= LEFT / TOP: SCANNED NOTEBOOK PHOTO ================= */}
        <section className="w-full md:w-[44%] h-[40vh] md:h-auto shrink-0 md:shrink border-b md:border-b-0 md:border-r border-neutral-200/80 bg-neutral-900 flex flex-col overflow-hidden relative">
          {/* Photo Toolbar */}
          <div className="h-11 md:h-10 px-3 md:px-4 bg-neutral-900/90 border-b border-neutral-800 flex items-center justify-between text-neutral-300 text-xs shrink-0 select-none z-10">
            <div className="flex items-center gap-2 min-w-0">
              <span className="text-[11px] text-neutral-400 shrink-0">Scanned ledger sheet</span>
              <span className="text-neutral-600 hidden sm:inline">·</span>
              <span className="text-[11px] text-[var(--status-check-border)] hidden sm:inline truncate">
                Amber boxes mark fields the recognition model was less than {Math.round(confidenceThreshold * 100)}% confident about.
              </span>
            </div>

            {/* Zoom Controls */}
            <div className="flex items-center gap-1 bg-neutral-800/80 rounded px-1 py-0.5 border border-neutral-700 shrink-0">
              <button
                onClick={handleZoomOut}
                className="min-w-[36px] min-h-[36px] md:min-w-0 md:min-h-0 md:p-1 flex items-center justify-center hover:text-white rounded cursor-pointer"
                title="Zoom out"
                aria-label="Zoom out"
              >
                <ZoomOut className="w-3.5 h-3.5" />
              </button>
              <span className="text-[10px] font-mono tabular-nums px-1 text-neutral-300">
                {Math.round(zoomLevel * 100)}%
              </span>
              <button
                onClick={handleZoomIn}
                className="min-w-[36px] min-h-[36px] md:min-w-0 md:min-h-0 md:p-1 flex items-center justify-center hover:text-white rounded cursor-pointer"
                title="Zoom in"
                aria-label="Zoom in"
              >
                <ZoomIn className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={handleResetZoom}
                className="min-w-[36px] min-h-[36px] md:min-w-0 md:min-h-0 md:p-1 flex items-center justify-center hover:text-white rounded cursor-pointer"
                title="Reset zoom"
                aria-label="Reset zoom"
              >
                <RotateCcw className="w-3 h-3" />
              </button>
            </div>
          </div>

          {/* Photo Viewport Container */}
          <div
            ref={containerRef}
            className="flex-1 overflow-auto flex items-start md:items-center justify-center p-3 md:p-4 bg-neutral-950 select-none cursor-crosshair touch-pinch-zoom"
          >
            <div
              className="relative inline-block transition-transform duration-150 origin-top-left"
              style={{
                transform: `scale(${zoomLevel})`,
              }}
            >
              <img
                src={activePage.imageUrl}
                alt="Scanned notebook handwritten log"
                referrerPolicy="no-referrer"
                className="max-w-[540px] w-full object-contain rounded shadow-2xl block border border-neutral-800"
              />

              {/* Bounding Box Overlays */}
              {activePage.rows.map((row, index) => {
                const isSelected = activeRowId === row.rowId;
                const hasLowConf = Object.values(row.fields).some(f =>
                  isLowConfidence(f.confidence, confidenceThreshold)
                );

                const box = row.boundingBox || {
                  x: 0.08,
                  y: 0.22 + index * 0.09,
                  w: 0.84,
                  h: 0.08,
                };

                return (
                  <div
                    key={row.rowId}
                    onClick={() => setActiveRowId(row.rowId)}
                    style={{
                      left: `${box.x * 100}%`,
                      top: `${box.y * 100}%`,
                      width: `${box.w * 100}%`,
                      height: `${box.h * 100}%`,
                    }}
                    className={`absolute transition-all cursor-pointer rounded-xs ${
                      isSelected
                        ? 'border-2 border-[var(--brand-600)] bg-[var(--brand-600)]/25 ring-2 ring-[var(--brand-600)]/50 z-20'
                        : hasLowConf
                        ? 'border-2 border-[var(--status-check)] bg-[var(--status-check-bg)]/35 hover:bg-[var(--status-check-bg)]/50 z-10'
                        : 'border border-[var(--brand-50)]/40 hover:border-[var(--brand-50)] hover:bg-[var(--brand-50)]/15'
                    }`}
                  >
                    <div
                      className={`absolute -top-4 left-0 text-[9px] px-1 rounded-xs font-mono font-bold leading-none py-0.5 whitespace-nowrap shadow-xs ${
                        isSelected
                          ? 'bg-[var(--brand-600)] text-white'
                          : hasLowConf
                          ? 'bg-[var(--status-check)] text-white'
                          : 'bg-neutral-800 text-neutral-300 opacity-60 hover:opacity-100'
                      }`}
                    >
                      Line #{row.lineLabel || index + 1} {hasLowConf ? '⚠️ Check' : ''}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* ================= RIGHT / BOTTOM: PARSED RECORD TABLE (DESKTOP) OR CARDS (MOBILE) ================= */}
        <section className="w-full md:w-[56%] bg-white flex flex-col md:overflow-hidden">
          {/* Table Header Bar */}
          <div className="px-4 md:px-6 py-2 border-b border-neutral-200/80 bg-neutral-50/70 shrink-0 space-y-1">
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-neutral-500">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-neutral-800">
                  Parsed records ({activePage.rows.length} rows)
                </span>
                <span className="text-neutral-400 hidden sm:inline">·</span>
                <span className="text-[11px] text-neutral-500 hidden sm:inline">
                  Click any cell to edit inline
                </span>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setShowNotesColumn(!showNotesColumn)}
                  className={`text-[11px] font-medium flex items-center gap-1 px-2.5 py-1.5 min-h-[38px] md:min-h-0 md:py-1 rounded transition-colors cursor-pointer ${
                    showNotesColumn
                      ? 'bg-neutral-200 text-neutral-900 font-semibold'
                      : 'text-neutral-600 hover:bg-neutral-100'
                  }`}
                  title="Toggle manual workshop note fields"
                >
                  <SlidersHorizontal className="w-3 h-3" />
                  <span>{showNotesColumn ? 'Hide notes' : 'Show notes'}</span>
                </button>

                <button
                  onClick={() => addRow(activePage.pageId)}
                  className="text-[11px] font-medium text-[var(--brand-700)] hover:bg-[var(--brand-50)] px-2.5 py-1.5 min-h-[38px] md:min-h-0 md:py-1 rounded flex items-center gap-1 transition-colors cursor-pointer"
                  title="Add manual row"
                >
                  <Plus className="w-3 h-3" />
                  <span>Add row</span>
                </button>
              </div>
            </div>
            <p className="text-[11px] text-neutral-500">
              Rows may be split or combined where one handwritten line holds several entries.
            </p>
          </div>

          {/* Desktop & Tablet Table View (>= 768px) — preserved side-by-side layout */}
          <div className="hidden md:block flex-1 overflow-y-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-neutral-50/90 text-neutral-600 sticky top-0 z-10 border-b border-neutral-200 select-none shadow-2xs">
                <tr className="border-b border-neutral-200/80 text-[11px]">
                  <th rowSpan={2} className="py-2 pl-6 pr-2 w-10 text-neutral-400 font-normal border-r border-neutral-200/60 text-center">
                    #
                  </th>
                  <th colSpan={5} className="py-1.5 px-3 bg-neutral-100/60 border-r-2 border-neutral-300">
                    <div className="flex items-center gap-1.5 font-semibold text-neutral-800">
                      <Camera className="w-3.5 h-3.5 text-[var(--brand-600)]" />
                      <span>Recognised from photo</span>
                      <span className="text-[10px] text-neutral-400 font-normal">
                        (Recognition model · confidence verified)
                      </span>
                    </div>
                  </th>
                  <th colSpan={showNotesColumn ? 2 : 1} className="py-1.5 px-3 bg-stone-100/80 border-r border-neutral-200/60">
                    <div className="flex items-center gap-1.5 font-semibold text-stone-800">
                      <PenLine className="w-3.5 h-3.5 text-stone-600" />
                      <span>Manually entered</span>
                      <span className="text-[10px] text-stone-500 font-normal">
                        (Workshop ledger notes)
                      </span>
                    </div>
                  </th>
                  <th rowSpan={2} className="py-2 pr-6 pl-2 w-8 text-neutral-400"></th>
                </tr>

                <tr className="bg-neutral-50/90 text-[11px] text-neutral-500 font-medium">
                  <th className="py-2 px-3 font-semibold text-neutral-700 w-24">Date</th>
                  <th className="py-2 px-3 font-semibold text-neutral-700">Item · colour</th>
                  <th className="py-2 px-3 font-semibold text-neutral-700 text-right w-16">Qty</th>
                  <th className="py-2 px-3 font-semibold text-neutral-700 text-right w-20">Rate</th>
                  <th className="py-2 px-3 font-semibold text-neutral-700 text-right w-24 border-r-2 border-neutral-300">Amount</th>
                  <th className="py-2 px-3 font-semibold text-stone-700 bg-stone-50/40 w-28">
                    Batch / Lot #
                  </th>
                  {showNotesColumn && (
                    <th className="py-2 px-3 font-semibold text-stone-700 bg-stone-50/40 w-32 border-r border-neutral-200/60">
                      QC Remarks
                    </th>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-200/60">
                {activePage.rows.map((row, index) => {
                  const isSelected = activeRowId === row.rowId;
                  const rowHasLowConfidence = Object.values(row.fields).some(f =>
                    isLowConfidence(f.confidence, confidenceThreshold)
                  );
                  const { rate, amount } = calculateRowAmount(row, rateTable);
                  const displayLineNum = row.lineLabel || String(index + 1);

                  return (
                    <tr
                      key={row.rowId}
                      onClick={() => setActiveRowId(row.rowId)}
                      className={`transition-colors cursor-pointer ${
                        isSelected ? 'ring-1 ring-inset ring-[var(--brand-600)]' : ''
                      } ${
                        rowHasLowConfidence
                          ? 'bg-[var(--status-check-bg)] text-[var(--status-check-ink)] hover:bg-[var(--status-check-hover)]'
                          : isSelected
                          ? 'bg-[var(--brand-50)] text-neutral-900'
                          : 'hover:bg-neutral-50/80 text-neutral-900'
                      }`}
                    >
                      <td
                        className={`py-3 pl-5 pr-2 font-mono text-[11px] text-neutral-500 text-center border-r border-neutral-200/50 ${
                          row.splitGroupId ? 'border-l-[3px] border-l-[var(--brand-600)]/50' : ''
                        }`}
                      >
                        {displayLineNum}
                      </td>

                      <td className="py-3 px-3">
                        <EditableCell
                          value={row.fields['date']?.value}
                          confidence={row.fields['date']?.confidence}
                          threshold={confidenceThreshold}
                          type="date"
                          format="date"
                          dateFormat={dateFormat}
                          isEditing={
                            activeEditingCell?.rowId === row.rowId &&
                            activeEditingCell?.fieldKey === 'date'
                          }
                          onStartEdit={() =>
                            setActiveEditingCell({ rowId: row.rowId, fieldKey: 'date' })
                          }
                          onCommit={newVal => {
                            updateRowField(activePage.pageId, row.rowId, 'date', newVal);
                            setActiveEditingCell(null);
                          }}
                          onCancel={() => setActiveEditingCell(null)}
                        />
                      </td>

                      <td className="py-3 px-3">
                        {row.isFirstInSplitGroup && (
                          <div className="mb-1">
                            <span className="inline-block text-[10px] font-medium text-neutral-500 bg-neutral-100 border border-neutral-200 px-1.5 py-0.5 rounded">
                              split from one line
                            </span>
                          </div>
                        )}
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <EditableCell
                            value={row.fields['item']?.value}
                            confidence={row.fields['item']?.confidence}
                            threshold={confidenceThreshold}
                            type="text"
                            isEditing={
                              activeEditingCell?.rowId === row.rowId &&
                              activeEditingCell?.fieldKey === 'item'
                            }
                            onStartEdit={() =>
                              setActiveEditingCell({ rowId: row.rowId, fieldKey: 'item' })
                            }
                            onCommit={newVal => {
                              updateRowField(activePage.pageId, row.rowId, 'item', newVal);
                              setActiveEditingCell(null);
                            }}
                            onCancel={() => setActiveEditingCell(null)}
                            className="font-medium"
                          />

                          <span className="text-neutral-400 font-normal">·</span>

                          <EditableCell
                            value={row.fields['colour']?.value}
                            confidence={row.fields['colour']?.confidence}
                            threshold={confidenceThreshold}
                            type="text"
                            placeholder="Variant"
                            isEditing={
                              activeEditingCell?.rowId === row.rowId &&
                              activeEditingCell?.fieldKey === 'colour'
                            }
                            onStartEdit={() =>
                              setActiveEditingCell({ rowId: row.rowId, fieldKey: 'colour' })
                            }
                            onCommit={newVal => {
                              updateRowField(activePage.pageId, row.rowId, 'colour', newVal);
                              setActiveEditingCell(null);
                            }}
                            onCancel={() => setActiveEditingCell(null)}
                            className="text-neutral-600"
                          />
                        </div>
                        {row.dimensions && (
                          <div
                            className="flex items-center gap-1.5 mt-0.5 pl-1.5"
                            title="Size, not a quantity — excluded from pricing."
                          >
                            <span className="text-[11px] text-neutral-500 font-mono">
                              {row.dimensions}
                            </span>
                            <span className="inline-block text-[10px] font-medium text-neutral-500 bg-neutral-100 border border-neutral-200 px-1.5 py-0.5 rounded leading-none">
                              size
                            </span>
                          </div>
                        )}
                      </td>

                      <td className="py-3 px-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <EditableCell
                            value={row.fields['qty']?.value}
                            confidence={row.fields['qty']?.confidence}
                            threshold={confidenceThreshold}
                            extraTooltip={row.qtyBreakdown}
                            type="number"
                            isEditing={
                              activeEditingCell?.rowId === row.rowId &&
                              activeEditingCell?.fieldKey === 'qty'
                            }
                            onStartEdit={() =>
                              setActiveEditingCell({ rowId: row.rowId, fieldKey: 'qty' })
                            }
                            onCommit={newVal => {
                              updateRowField(activePage.pageId, row.rowId, 'qty', Number(newVal) || 0);
                              setActiveEditingCell(null);
                            }}
                            onCancel={() => setActiveEditingCell(null)}
                            className={`font-mono tabular-nums font-semibold ${
                              row.qtyBreakdown && !isLowConfidence(row.fields['qty']?.confidence, confidenceThreshold)
                                ? 'border-b-2 border-dashed border-neutral-400'
                                : ''
                            }`}
                          />

                          <EditableCell
                            value={row.fields['unit']?.value}
                            confidence={row.fields['unit']?.confidence}
                            threshold={confidenceThreshold}
                            type="text"
                            isEditing={
                              activeEditingCell?.rowId === row.rowId &&
                              activeEditingCell?.fieldKey === 'unit'
                            }
                            onStartEdit={() =>
                              setActiveEditingCell({ rowId: row.rowId, fieldKey: 'unit' })
                            }
                            onCommit={newVal => {
                              updateRowField(activePage.pageId, row.rowId, 'unit', newVal);
                              setActiveEditingCell(null);
                            }}
                            onCancel={() => setActiveEditingCell(null)}
                            className="text-neutral-500 font-mono text-[11px]"
                          />
                        </div>
                        {row.qtyBreakdown && (
                          <div className="mt-0.5 flex justify-end">
                            <span
                              className="inline-block text-[10px] font-medium text-neutral-500 bg-neutral-100 border border-neutral-200 px-1.5 py-0.5 rounded leading-none"
                              title={row.qtyBreakdown}
                            >
                              summed
                            </span>
                          </div>
                        )}
                      </td>

                      <td className="py-3 px-3 text-right font-mono tabular-nums text-neutral-600">
                        {rate > 0 ? (
                          formatCurrency(rate, currency)
                        ) : (
                          <span className="text-[10px] text-[var(--status-check)] bg-[var(--status-check-bg)] px-1 py-0.5 rounded" title="Unmatched rate">
                            No rate
                          </span>
                        )}
                      </td>

                      <td className="py-3 px-3 text-right font-mono tabular-nums font-semibold border-r-2 border-neutral-300">
                        {formatCurrency(amount, currency)}
                      </td>

                      <td className="py-3 px-3 bg-stone-50/70 border-r border-neutral-200/50">
                        <input
                          type="text"
                          value={row.notes?.batch || ''}
                          placeholder="Manual lot #..."
                          title="Manually entered workshop property — not extracted from photo"
                          onClick={e => e.stopPropagation()}
                          onChange={e =>
                            updateRowNote(activePage.pageId, row.rowId, 'batch', e.target.value)
                          }
                          className="w-full text-[11px] bg-white border border-neutral-300 rounded px-2 py-1 text-neutral-800 placeholder:text-neutral-400 focus:outline-none focus:border-[var(--brand-600)] shadow-2xs"
                        />
                      </td>

                      {showNotesColumn && (
                        <td className="py-3 px-3 bg-stone-50/70 border-r border-neutral-200/50">
                          <input
                            type="text"
                            value={row.notes?.qc || ''}
                            placeholder="QC remark..."
                            title="Manually entered workshop note — not extracted from photo"
                            onClick={e => e.stopPropagation()}
                            onChange={e =>
                              updateRowNote(activePage.pageId, row.rowId, 'qc', e.target.value)
                            }
                            className="w-full text-[11px] bg-white border border-neutral-300 rounded px-2 py-1 text-neutral-800 placeholder:text-neutral-400 focus:outline-none focus:border-[var(--brand-600)] shadow-2xs"
                          />
                        </td>
                      )}

                      <td className="py-3 pr-6 pl-2 text-right">
                        <button
                          onClick={e => {
                            e.stopPropagation();
                            deleteRow(activePage.pageId, row.rowId);
                          }}
                          className="text-neutral-400 hover:text-neutral-700 p-1 rounded opacity-50 hover:opacity-100 transition-opacity cursor-pointer"
                          title="Delete row"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Mobile Card List View (< 768px) — zero horizontal scrolling */}
          <div className="md:hidden p-3 space-y-3 bg-[var(--surface-page)]">
            {activePage.rows.map((row, index) => {
              const isSelected = activeRowId === row.rowId;
              const rowHasLowConfidence = Object.values(row.fields).some(f =>
                isLowConfidence(f.confidence, confidenceThreshold)
              );
              const { rate, amount } = calculateRowAmount(row, rateTable);
              const displayLineNum = row.lineLabel || String(index + 1);

              return (
                <div
                  key={row.rowId}
                  onClick={() => setActiveRowId(row.rowId)}
                  className={`rounded-xl border p-3.5 space-y-2.5 transition-colors ${
                    row.splitGroupId ? 'border-l-[3px] border-l-[var(--brand-600)]/50' : ''
                  } ${
                    rowHasLowConfidence
                      ? 'bg-[var(--status-check-bg)] border-[var(--status-check-border)] text-[var(--status-check-ink)]'
                      : isSelected
                      ? 'bg-[var(--brand-50)] border-[var(--brand-600)] text-neutral-900'
                      : 'bg-white border-neutral-200/80 text-neutral-900'
                  }`}
                >
                  {/* Card Header: Line #, Date, Delete */}
                  <div className="flex items-center justify-between gap-2 text-xs">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono text-[11px] px-1.5 py-0.5 rounded bg-black/5 font-semibold">
                        #{displayLineNum}
                      </span>
                      {row.isFirstInSplitGroup && (
                        <span className="text-[10px] font-medium text-neutral-500 bg-neutral-100 border border-neutral-200 px-1.5 py-0.5 rounded">
                          split from one line
                        </span>
                      )}
                      <EditableCell
                        value={row.fields['date']?.value}
                        confidence={row.fields['date']?.confidence}
                        threshold={confidenceThreshold}
                        type="date"
                        format="date"
                        dateFormat={dateFormat}
                        isEditing={
                          activeEditingCell?.rowId === row.rowId &&
                          activeEditingCell?.fieldKey === 'date'
                        }
                        onStartEdit={() =>
                          setActiveEditingCell({ rowId: row.rowId, fieldKey: 'date' })
                        }
                        onCommit={newVal => {
                          updateRowField(activePage.pageId, row.rowId, 'date', newVal);
                          setActiveEditingCell(null);
                        }}
                        onCancel={() => setActiveEditingCell(null)}
                      />
                    </div>

                    <button
                      type="button"
                      onClick={e => {
                        e.stopPropagation();
                        deleteRow(activePage.pageId, row.rowId);
                      }}
                      className="min-w-[36px] min-h-[36px] flex items-center justify-center text-neutral-500 hover:text-neutral-800 rounded"
                      aria-label={`Delete row ${displayLineNum}`}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Recognised fields: Item · Colour & Qty Unit / Rate / Amount */}
                  <div>
                    <div className="flex flex-wrap items-center gap-1.5 text-sm">
                      <EditableCell
                        value={row.fields['item']?.value}
                        confidence={row.fields['item']?.confidence}
                        threshold={confidenceThreshold}
                        type="text"
                        isEditing={
                          activeEditingCell?.rowId === row.rowId &&
                          activeEditingCell?.fieldKey === 'item'
                        }
                        onStartEdit={() =>
                          setActiveEditingCell({ rowId: row.rowId, fieldKey: 'item' })
                        }
                        onCommit={newVal => {
                          updateRowField(activePage.pageId, row.rowId, 'item', newVal);
                          setActiveEditingCell(null);
                        }}
                        onCancel={() => setActiveEditingCell(null)}
                        className="font-semibold"
                      />
                      <span className="text-neutral-400">·</span>
                      <EditableCell
                        value={row.fields['colour']?.value}
                        confidence={row.fields['colour']?.confidence}
                        threshold={confidenceThreshold}
                        type="text"
                        placeholder="Variant"
                        isEditing={
                          activeEditingCell?.rowId === row.rowId &&
                          activeEditingCell?.fieldKey === 'colour'
                        }
                        onStartEdit={() =>
                          setActiveEditingCell({ rowId: row.rowId, fieldKey: 'colour' })
                        }
                        onCommit={newVal => {
                          updateRowField(activePage.pageId, row.rowId, 'colour', newVal);
                          setActiveEditingCell(null);
                        }}
                        onCancel={() => setActiveEditingCell(null)}
                      />
                    </div>
                    {row.dimensions && (
                      <div
                        className="flex items-center gap-1.5 mt-0.5 pl-1.5"
                        title="Size, not a quantity — excluded from pricing."
                      >
                        <span className="text-[11px] text-neutral-500 font-mono">
                          {row.dimensions}
                        </span>
                        <span className="inline-block text-[10px] font-medium text-neutral-500 bg-neutral-100 border border-neutral-200 px-1.5 py-0.5 rounded leading-none">
                          size
                        </span>
                      </div>
                    )}
                  </div>

                  <div className="flex items-center justify-between gap-2 text-xs">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-neutral-500">Qty:</span>
                      <EditableCell
                        value={row.fields['qty']?.value}
                        confidence={row.fields['qty']?.confidence}
                        threshold={confidenceThreshold}
                        extraTooltip={row.qtyBreakdown}
                        type="number"
                        isEditing={
                          activeEditingCell?.rowId === row.rowId &&
                          activeEditingCell?.fieldKey === 'qty'
                        }
                        onStartEdit={() =>
                          setActiveEditingCell({ rowId: row.rowId, fieldKey: 'qty' })
                        }
                        onCommit={newVal => {
                          updateRowField(activePage.pageId, row.rowId, 'qty', Number(newVal) || 0);
                          setActiveEditingCell(null);
                        }}
                        onCancel={() => setActiveEditingCell(null)}
                        className={`font-mono font-bold ${
                          row.qtyBreakdown && !isLowConfidence(row.fields['qty']?.confidence, confidenceThreshold)
                            ? 'border-b-2 border-dashed border-neutral-400'
                            : ''
                        }`}
                      />
                      <EditableCell
                        value={row.fields['unit']?.value}
                        confidence={row.fields['unit']?.confidence}
                        threshold={confidenceThreshold}
                        type="text"
                        isEditing={
                          activeEditingCell?.rowId === row.rowId &&
                          activeEditingCell?.fieldKey === 'unit'
                        }
                        onStartEdit={() =>
                          setActiveEditingCell({ rowId: row.rowId, fieldKey: 'unit' })
                        }
                        onCommit={newVal => {
                          updateRowField(activePage.pageId, row.rowId, 'unit', newVal);
                          setActiveEditingCell(null);
                        }}
                        onCancel={() => setActiveEditingCell(null)}
                        className="font-mono text-neutral-600"
                      />
                      {row.qtyBreakdown && (
                        <span
                          className="inline-block text-[10px] font-medium text-neutral-500 bg-neutral-100 border border-neutral-200 px-1.5 py-0.5 rounded leading-none"
                          title={row.qtyBreakdown}
                        >
                          summed
                        </span>
                      )}
                      <span className="text-neutral-400 font-mono">
                        @ {rate > 0 ? formatCurrency(rate, currency) : 'No rate'}
                      </span>
                    </div>

                    <div className="font-mono font-bold text-sm tabular-nums">
                      {formatCurrency(amount, currency)}
                    </div>
                  </div>

                  {/* Separated Manually Entered Section */}
                  <div className="pt-2 border-t border-black/10 space-y-1.5">
                    <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-stone-600">
                      <PenLine className="w-3 h-3" />
                      <span>Manually entered (not from photo)</span>
                    </div>
                    <div className="grid grid-cols-1 gap-2">
                      <input
                        type="text"
                        value={row.notes?.batch || ''}
                        placeholder="Batch / Lot #..."
                        onClick={e => e.stopPropagation()}
                        onChange={e =>
                          updateRowNote(activePage.pageId, row.rowId, 'batch', e.target.value)
                        }
                        className="w-full text-xs bg-white border border-neutral-300 rounded-lg px-2.5 py-2 min-h-[40px] text-neutral-800 placeholder:text-neutral-400 focus:outline-none focus:border-[var(--brand-600)]"
                      />
                      {showNotesColumn && (
                        <input
                          type="text"
                          value={row.notes?.qc || ''}
                          placeholder="QC remark..."
                          onClick={e => e.stopPropagation()}
                          onChange={e =>
                            updateRowNote(activePage.pageId, row.rowId, 'qc', e.target.value)
                          }
                          className="w-full text-xs bg-white border border-neutral-300 rounded-lg px-2.5 py-2 min-h-[40px] text-neutral-800 placeholder:text-neutral-400 focus:outline-none focus:border-[var(--brand-600)]"
                        />
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Table Bottom: Page Total */}
          <div className="px-4 md:px-6 py-3 border-t border-neutral-200 bg-neutral-50/80 flex items-center justify-between shrink-0">
            <div className="flex items-center gap-2 text-xs text-neutral-500">
              <Info className="w-3.5 h-3.5 text-neutral-400 shrink-0" />
              <span className="truncate">
                {activePage.rows.length} entries · Active rate table
              </span>
            </div>

            <div className="flex items-baseline gap-2 shrink-0">
              <span className="text-xs font-semibold text-neutral-600">
                Page total:
              </span>
              <span className="text-base font-bold text-neutral-900 font-mono tabular-nums">
                {formatCurrency(pageTotal, currency)}
              </span>
            </div>
          </div>
        </section>
      </div>

      {/* ================= BOTTOM FOOTER BAR ================= */}
      <footer className="px-4 md:px-8 py-3 md:h-16 border-t border-neutral-200/90 bg-white flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 shrink-0 select-none shadow-xs">
        <div className="flex items-center gap-2 text-xs text-neutral-500 min-w-0">
          <span className="w-2 h-2 rounded-full bg-[var(--brand-600)] shrink-0"></span>
          <span className="truncate sm:whitespace-normal">
            {activePage.status === 'flagged' ? (
              <>
                <strong className="text-[var(--status-check)]">Action needed:</strong> Review flagged fields, then approve to lock into {activePage.workerName}&apos;s ledger.
              </>
            ) : (
              <>
                <strong className="text-[var(--brand-700)]">Page Approved:</strong> Confirmed in {activePage.workerName}&apos;s balance.
              </>
            )}
          </span>
        </div>

        <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0">
          {flaggedPages.length > 1 && (
            <div className="text-xs text-neutral-500">
              Flagged queue: {flaggedPages.findIndex(p => p.pageId === activePage.pageId) + 1} of {flaggedPages.length}
            </div>
          )}

          <button
            onClick={() => approvePage(activePage.pageId)}
            className="w-full sm:w-auto px-6 py-2.5 min-h-[44px] text-xs font-semibold text-white bg-[var(--brand-600)] hover:bg-[var(--brand-700)] rounded-lg shadow-xs flex items-center justify-center gap-2 transition-all cursor-pointer"
          >
            <CheckCircle2 className="w-4 h-4" />
            <span>Approve page</span>
          </button>
        </div>
      </footer>
    </div>
  );
};

interface EditableCellProps {
  value: string | number | undefined;
  confidence?: number;
  threshold?: number;
  extraTooltip?: string;
  type?: 'text' | 'number' | 'date';
  format?: 'date';
  dateFormat?: string;
  placeholder?: string;
  isEditing: boolean;
  className?: string;
  onStartEdit: () => void;
  onCommit: (val: string | number) => void;
  onCancel: () => void;
}

const EditableCell: React.FC<EditableCellProps> = ({
  value,
  confidence,
  threshold,
  extraTooltip,
  type = 'text',
  format,
  dateFormat = 'DD/MM',
  placeholder = '—',
  isEditing,
  className = '',
  onStartEdit,
  onCommit,
  onCancel,
}) => {
  const [tempVal, setTempVal] = useState<string>(String(value ?? ''));
  const isLow = isLowConfidence(confidence, threshold);

  if (isEditing) {
    return (
      <input
        autoFocus
        type={type === 'number' ? 'number' : 'text'}
        value={tempVal}
        onClick={e => e.stopPropagation()}
        onChange={e => setTempVal(e.target.value)}
        onBlur={() => onCommit(type === 'number' ? Number(tempVal) || 0 : tempVal)}
        onKeyDown={e => {
          if (e.key === 'Enter') {
            onCommit(type === 'number' ? Number(tempVal) || 0 : tempVal);
          } else if (e.key === 'Escape') {
            onCancel();
          }
        }}
        className="px-2 py-1 text-xs bg-white border border-[var(--brand-600)] rounded shadow-xs focus:outline-none min-w-[60px]"
      />
    );
  }

  let displayStr = String(value ?? '');
  if (format === 'date' && displayStr) {
    displayStr = formatDate(displayStr, dateFormat as any);
  }

  const flaggedText = isLow ? `${displayStr}?` : displayStr;
  const confPct = Math.round((confidence || 0) * 100);
  const tooltipText = isLow
    ? `Model confidence: ${confPct}%${extraTooltip ? ` · ${extraTooltip}` : ''}`
    : extraTooltip
    ? extraTooltip
    : 'Click to edit';

  return (
    <span
      onClick={e => {
        e.stopPropagation();
        setTempVal(String(value ?? ''));
        onStartEdit();
      }}
      title={tooltipText}
      className={`inline-block py-1 px-1.5 rounded transition-colors hover:bg-neutral-200/50 cursor-pointer ${
        isLow
          ? 'border-b-2 border-dashed border-[var(--status-check)] font-semibold text-[var(--status-check)]'
          : ''
      } ${className}`}
    >
      {flaggedText || <span className="text-neutral-400 italic">{placeholder}</span>}
    </span>
  );
};
