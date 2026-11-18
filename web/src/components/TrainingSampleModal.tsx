import React, { useState } from 'react';
import { X, Camera, UploadCloud, CheckCircle2, Sparkles, FileImage } from 'lucide-react';

interface TrainingSampleModalProps {
  unlearnedCharacters: string[];
  onClose: () => void;
  onRegistered?: (chars: string[]) => void;
}

export const TrainingSampleModal: React.FC<TrainingSampleModalProps> = ({
  unlearnedCharacters,
  onClose,
  onRegistered,
}) => {
  const [isUploading, setIsUploading] = useState<boolean>(false);
  const [isComplete, setIsComplete] = useState<boolean>(false);

  const handleSimulateUpload = () => {
    setIsUploading(true);
    setTimeout(() => {
      setIsUploading(false);
      setIsComplete(true);
      if (onRegistered) {
        onRegistered(unlearnedCharacters);
      }
    }, 1500);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
      <div className="bg-white rounded-xl max-w-lg w-full border border-neutral-200 shadow-xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-neutral-100 flex items-center justify-between bg-neutral-50 select-none">
          <div className="flex items-center gap-2">
            <Camera className="w-4 h-4 text-[var(--brand-600)]" />
            <span className="font-semibold text-sm text-neutral-900">
              Handwriting Model Character Registration
            </span>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-neutral-400 hover:text-neutral-700 rounded-lg"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-5">
          <div>
            <div className="text-xs text-neutral-500 font-medium">Unlearned Characters Detected:</div>
            <div className="flex items-center gap-3 mt-2">
              {unlearnedCharacters.map((char, idx) => (
                <div
                  key={idx}
                  className="w-14 h-14 rounded-xl bg-[var(--status-check-bg)] border-2 border-dashed border-[var(--status-check)] flex items-center justify-center text-2xl font-bold text-[var(--status-check)] shadow-2xs font-serif"
                >
                  {char}
                </div>
              ))}
            </div>
          </div>

          <div className="text-xs text-neutral-600 space-y-2 bg-neutral-50 p-3.5 rounded-lg border border-neutral-200/80">
            <div className="font-semibold text-neutral-800">Registration Instructions:</div>
            <ol className="list-decimal list-inside space-y-1 text-neutral-600 pl-0.5">
              <li>Write each unlearned character 3 to 5 times on scrap paper with standard workshop pen.</li>
              <li>Photograph the paper with good lighting and upload below.</li>
              <li>The recognition model will extract stroke vectors to recognize these characters on notebooks.</li>
            </ol>
          </div>

          {/* Upload Dropzone */}
          {!isComplete ? (
            <div
              onClick={handleSimulateUpload}
              className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-colors ${
                isUploading
                  ? 'bg-[var(--brand-50)] border-[var(--brand-600)]'
                  : 'border-neutral-300 hover:border-[var(--brand-600)] bg-neutral-50/30'
              }`}
            >
              {isUploading ? (
                <div className="space-y-2">
                  <div className="w-8 h-8 rounded-full border-2 border-[var(--brand-600)] border-t-transparent animate-spin mx-auto" />
                  <div className="text-xs font-semibold text-[var(--brand-700)]">
                    Analyzing strokes & training reader weights...
                  </div>
                </div>
              ) : (
                <div className="space-y-1.5">
                  <UploadCloud className="w-8 h-8 text-neutral-400 mx-auto" />
                  <div className="text-xs font-semibold text-neutral-800">
                    Click to photograph or upload sample sheet
                  </div>
                  <div className="text-[11px] text-neutral-400">
                    Upload handwritten samples for: {unlearnedCharacters.join(', ')}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="p-4 rounded-xl bg-[var(--brand-50)] border border-[var(--brand-600)]/25 text-xs text-neutral-900 flex items-start gap-2.5">
              <CheckCircle2 className="w-5 h-5 text-[var(--brand-600)] shrink-0 mt-0.5" />
              <div>
                <span className="font-bold text-[var(--brand-800)]">
                  Samples Registered Successfully!
                </span>
                <p className="mt-0.5 text-[var(--brand-700)]">
                  The characters <strong>{unlearnedCharacters.join(' and ')}</strong> have been added to your workshop&apos;s active handwriting vocabulary.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 border-t border-neutral-100 bg-neutral-50/50 flex items-center justify-end gap-2">
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-white bg-[var(--brand-600)] hover:bg-[var(--brand-700)] rounded-lg transition-colors"
          >
            {isComplete ? 'Done & Return' : 'Close'}
          </button>
        </div>
      </div>
    </div>
  );
};
