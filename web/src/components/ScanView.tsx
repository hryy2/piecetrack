import React, { useState, useRef, useEffect } from 'react';
import {
  UploadCloud,
  Camera,
  CheckCircle2,
  FileImage,
  ArrowRight,
  User,
  FolderOpen,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { formatWorkerLabel } from '../utils/formatters';

export const ScanView: React.FC = () => {
  const { activeWorkers, addNewScannedUpload } = useApp();

  const defaultWorker = activeWorkers.find(w => w.status === 'not_in') || activeWorkers[0];
  const [selectedWorkerId, setSelectedWorkerId] = useState<string>(defaultWorker?.id || '');
  const [notebookLabel, setNotebookLabel] = useState<string>('August production sheet - p.18');
  const [selectedFileName, setSelectedFileName] = useState<string>('sample_workshop_notebook_page.jpg');
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [processingStage, setProcessingStage] = useState<number>(0);

  const cameraInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!activeWorkers.some(w => w.id === selectedWorkerId) && activeWorkers[0]) {
      setSelectedWorkerId(activeWorkers[0].id);
    }
  }, [activeWorkers, selectedWorkerId]);

  useEffect(() => {
    return () => {
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [previewUrl]);

  const selectedWorker = activeWorkers.find(w => w.id === selectedWorkerId);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setSelectedFileName(file.name);
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
    }
    setPreviewUrl(URL.createObjectURL(file));
  };

  const handleStartProcessing = () => {
    if (!selectedWorkerId) return;
    setIsProcessing(true);
    setProcessingStage(1);

    // Simulate the recognition model pipeline stages
    setTimeout(() => {
      setProcessingStage(2);
    }, 900);

    setTimeout(() => {
      setProcessingStage(3);
    }, 1800);

    setTimeout(() => {
      setIsProcessing(false);
      setProcessingStage(0);
      addNewScannedUpload(selectedWorkerId, notebookLabel);
    }, 2600);
  };

  return (
    <div className="flex-1 flex flex-col h-full overflow-y-auto overflow-x-hidden bg-[var(--surface-page)]">
      {/* Header */}
      <header className="px-4 md:px-8 pt-5 md:pt-8 pb-5 md:pb-6 border-b border-neutral-200/80 bg-white">
        <div className="max-w-4xl mx-auto">
          <span className="text-xs font-semibold uppercase tracking-wider text-[var(--brand-800)]">
            Paper Ingestion
          </span>
          <h1 className="text-xl font-bold tracking-tight text-neutral-900 mt-0.5">
            Scan Workshop Notebook
          </h1>
          <p className="text-xs text-neutral-500 mt-1">
            Photograph or upload handwritten production ledger pages. The recognition model corrects perspective and parses tally rows for review.
          </p>
        </div>
      </header>

      {/* Main Form */}
      <main className="max-w-4xl mx-auto w-full px-4 md:px-8 py-5 md:py-8 space-y-6">
        {isProcessing && (
          <div className="bg-white border border-neutral-200/80 rounded-xl p-6 md:p-8 shadow-md text-center space-y-5 animate-pulse">
            <div className="w-12 h-12 rounded-full bg-[var(--brand-50)] text-[var(--brand-600)] flex items-center justify-center mx-auto shadow-xs">
              <Camera className="w-6 h-6 animate-spin" />
            </div>

            <div>
              <h3 className="text-base font-bold text-neutral-900">
                Processing Notebook Page...
              </h3>
              <p className="text-xs text-neutral-500 mt-1">
                Running workshop recognition model for{' '}
                {selectedWorker ? formatWorkerLabel(selectedWorker.name, selectedWorker.code) : 'worker'}
              </p>
            </div>

            <div className="max-w-md mx-auto space-y-2 text-left text-xs">
              <div
                className={`p-2.5 rounded-lg flex items-center gap-2.5 transition-colors ${
                  processingStage >= 1 ? 'bg-[var(--brand-50)] text-[var(--brand-700)] font-medium' : 'text-neutral-400'
                }`}
              >
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>1. Correcting skew, keystone perspective, and shadows</span>
              </div>

              <div
                className={`p-2.5 rounded-lg flex items-center gap-2.5 transition-colors ${
                  processingStage >= 2 ? 'bg-[var(--brand-50)] text-[var(--brand-700)] font-medium' : 'text-neutral-400'
                }`}
              >
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>2. Segmenting table grid lines and item text boxes</span>
              </div>

              <div
                className={`p-2.5 rounded-lg flex items-center gap-2.5 transition-colors ${
                  processingStage >= 3 ? 'bg-[var(--brand-50)] text-[var(--brand-700)] font-medium' : 'text-neutral-400'
                }`}
              >
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>3. Reading handwriting &amp; scoring confidence matrix</span>
              </div>
            </div>
          </div>
        )}

        {!isProcessing && (
          <div className="bg-white border border-neutral-200/80 rounded-xl p-4 md:p-6 shadow-2xs space-y-5">
            {/* Hidden file inputs: camera (capture="environment") + standard file picker */}
            <input
              ref={cameraInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              onChange={handleFileChange}
              className="hidden"
            />
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleFileChange}
              className="hidden"
            />

            {/* Step 1: Photo / File Ingestion */}
            <div className="space-y-3">
              <label className="block text-xs font-semibold text-neutral-700">
                Notebook Photograph *
              </label>

              {/* Upload zone (interactive drop/click area on desktop; preview box on mobile) */}
              <div
                onClick={() => fileInputRef.current?.click()}
                role="button"
                tabIndex={0}
                onKeyDown={e => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    fileInputRef.current?.click();
                  }
                }}
                className="w-full border-2 border-dashed border-neutral-300 rounded-xl p-6 md:p-8 text-center hover:border-[var(--brand-600)] transition-colors cursor-pointer bg-neutral-50/50 flex flex-col items-center"
              >
                <div className="w-12 h-12 rounded-full bg-neutral-100 flex items-center justify-center mb-3 text-neutral-600">
                  <UploadCloud className="w-6 h-6" />
                </div>
                <div className="text-xs font-semibold text-neutral-800">
                  Drag a photo here, or click to choose a file
                </div>
                <div className="text-[11px] text-neutral-400 mt-1">
                  JPEG, PNG or HEIC
                </div>

                {previewUrl && (
                  <img
                    src={previewUrl}
                    alt="Selected notebook preview"
                    className="mt-4 max-h-40 rounded-lg border border-neutral-200 object-contain"
                  />
                )}

                <div className="mt-4 inline-flex items-center gap-2 px-3 py-2 bg-white rounded-lg border border-neutral-200 text-xs text-neutral-600 shadow-2xs max-w-full">
                  <FileImage className="w-4 h-4 text-[var(--brand-600)] shrink-0" />
                  <span className="font-medium text-neutral-800 truncate">
                    {selectedFileName}
                  </span>
                  <span className="text-[10px] text-[var(--brand-700)] bg-[var(--brand-50)] px-1.5 py-0.5 rounded font-medium shrink-0">
                    Ready
                  </span>
                </div>
              </div>

              {/* Mobile-only explicit side-by-side Take photo & Choose file buttons */}
              <div className="grid grid-cols-2 gap-2.5 md:hidden">
                <button
                  type="button"
                  onClick={() => cameraInputRef.current?.click()}
                  className="w-full min-h-[44px] px-3 py-2.5 text-xs font-semibold text-neutral-800 bg-white border border-neutral-300 hover:bg-neutral-50 rounded-lg flex items-center justify-center gap-2 shadow-2xs"
                >
                  <Camera className="w-4 h-4 text-[var(--brand-600)]" />
                  <span>Take photo</span>
                </button>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full min-h-[44px] px-3 py-2.5 text-xs font-semibold text-neutral-800 bg-white border border-neutral-300 hover:bg-neutral-50 rounded-lg flex items-center justify-center gap-2 shadow-2xs"
                >
                  <FolderOpen className="w-4 h-4 text-neutral-500" />
                  <span>Choose file</span>
                </button>
              </div>
            </div>

            {/* Step 2: Assign to Active Worker */}
            <div>
              <label className="block text-xs font-semibold text-neutral-700 mb-1.5 flex items-center gap-1.5">
                <User className="w-3.5 h-3.5 text-neutral-500" />
                <span>Select Submitting Worker *</span>
              </label>

              <select
                value={selectedWorkerId}
                onChange={e => setSelectedWorkerId(e.target.value)}
                className="w-full text-xs border border-neutral-300 rounded-lg px-3 py-2.5 min-h-[44px] focus:outline-none focus:border-[var(--brand-600)] bg-white font-medium"
              >
                {activeWorkers.map(w => (
                  <option key={w.id} value={w.id}>
                    {formatWorkerLabel(w.name, w.code)} —{' '}
                    {w.status === 'not_in'
                      ? 'Notebook not in yet'
                      : `${w.totalPages} ${w.totalPages === 1 ? 'page' : 'pages'} submitted`}
                  </option>
                ))}
              </select>
            </div>

            {/* Step 3: Notebook page label */}
            <div>
              <label className="block text-xs font-semibold text-neutral-700 mb-1.5">
                Page Reference / Notebook ID (Optional)
              </label>
              <input
                type="text"
                value={notebookLabel}
                onChange={e => setNotebookLabel(e.target.value)}
                placeholder="e.g. Book #3 - Page 18"
                className="w-full text-xs border border-neutral-300 rounded-lg px-3 py-2.5 min-h-[44px] focus:outline-none focus:border-[var(--brand-600)]"
              />
            </div>

            {/* Primary Action Button */}
            <div className="pt-3 flex flex-col md:flex-row md:items-center justify-between gap-3 border-t border-neutral-100">
              <div className="text-[11px] text-neutral-400">
                Processed pages automatically queue for inspection in the Review workspace.
              </div>

              <button
                type="button"
                onClick={handleStartProcessing}
                disabled={!selectedWorkerId}
                className="w-full md:w-auto px-6 py-3 min-h-[44px] text-xs font-semibold text-white bg-[var(--brand-600)] hover:bg-[var(--brand-700)] disabled:opacity-50 rounded-lg transition-colors flex items-center justify-center gap-2 shadow-xs cursor-pointer shrink-0"
              >
                <span>Upload &amp; Run Recognition</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};
