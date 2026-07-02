import { useRef, useState, type DragEvent } from 'react';

import { cn } from '@/lib/utils';
import { UploadIcon, XIcon } from '@/components/icons';

type ImageDropzoneProps = {
  // Image to show, or null for the empty drop target. The caller owns this (e.g.
  // an object URL for a freshly picked file, or a remote URL for an existing one).
  previewUrl: string | null;
  // Called with a file that passed the type/size checks below.
  onSelect: (file: File) => void;
  onRemove: () => void;
  // Called with a human-readable message when a dropped/picked file is rejected.
  onError: (message: string) => void;
  acceptedTypes: readonly string[];
  maxBytes: number;
  disabled?: boolean;
};

// Controlled image picker: click-to-browse or drag & drop, with an inline preview
// plus replace/remove. Validation (type + size) happens here; the parent only
// stores the chosen file.
export function ImageDropzone({
  previewUrl,
  onSelect,
  onRemove,
  onError,
  acceptedTypes,
  maxBytes,
  disabled = false,
}: ImageDropzoneProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);

  const maxMb = Math.round(maxBytes / (1024 * 1024));

  function takeFile(file: File | undefined) {
    if (!file) return;
    if (!acceptedTypes.includes(file.type)) {
      onError('Unsupported image type. Please use JPG, PNG or WebP.');
      return;
    }
    if (file.size > maxBytes) {
      onError(`Image is too large. The maximum size is ${maxMb} MB.`);
      return;
    }
    onSelect(file);
  }

  function openPicker() {
    if (!disabled) inputRef.current?.click();
  }

  function handleDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setDragOver(false);
    if (disabled) return;
    takeFile(event.dataTransfer.files?.[0]);
  }

  return (
    <div
      onDragOver={(event) => {
        event.preventDefault();
        if (!disabled) setDragOver(true);
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={handleDrop}
      className={cn('rounded-lg', dragOver && previewUrl && 'ring-2 ring-accent')}
    >
      <input
        ref={inputRef}
        type="file"
        accept={acceptedTypes.join(',')}
        className="sr-only"
        disabled={disabled}
        onChange={(event) => {
          takeFile(event.target.files?.[0]);
          // Reset so picking the same file again still fires onChange.
          event.target.value = '';
        }}
      />

      {previewUrl ? (
        <div className="relative h-28 overflow-hidden rounded-lg border border-border bg-surface-muted">
          <img
            src={previewUrl}
            alt="Product image preview"
            className="h-full w-full object-contain"
          />
          <button
            type="button"
            onClick={openPicker}
            disabled={disabled}
            className="absolute inset-0 flex items-center justify-center text-sm font-semibold text-white opacity-0 transition hover:bg-black/45 hover:opacity-100 focus-visible:bg-black/45 focus-visible:opacity-100 focus-visible:outline-none"
          >
            Replace image
          </button>
          <button
            type="button"
            onClick={onRemove}
            disabled={disabled}
            aria-label="Remove image"
            className="absolute right-2 top-2 inline-flex h-8 w-8 items-center justify-center rounded-full bg-surface/90 text-text-muted shadow-sm transition hover:bg-surface hover:text-danger focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          >
            <XIcon className="h-4 w-4" />
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={openPicker}
          disabled={disabled}
          className={cn(
            'flex h-28 w-full flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed px-4 text-center transition',
            dragOver
              ? 'border-accent bg-accent-soft'
              : 'border-border bg-surface hover:bg-surface-muted',
            disabled && 'cursor-not-allowed opacity-60',
          )}
        >
          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-surface-muted text-text-muted">
            <UploadIcon className="h-5 w-5" />
          </span>
          <span className="text-sm font-medium text-text">
            Drag &amp; drop an image, or <span className="text-accent">browse</span>
          </span>
          <span className="text-xs text-text-muted">JPG, PNG or WebP · up to {maxMb} MB</span>
        </button>
      )}
    </div>
  );
}
