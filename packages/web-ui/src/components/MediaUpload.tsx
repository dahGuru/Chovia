"use client";

import { useRef, useState, type ChangeEvent } from "react";
import { cn } from "../tokens.js";
import { Button } from "./Button.js";
import { AlertIcon, CheckIcon, TrashIcon, UploadIcon } from "./Icons.js";

export interface ImagePreviewProps {
  src: string | null | undefined;
  alt: string;
  className?: string | undefined;
  emptyLabel?: string | undefined;
}

export function ImagePreview({
  src,
  alt,
  className,
  emptyLabel = "No image uploaded",
}: ImagePreviewProps) {
  if (!src) {
    return (
      <div
        className={cn(
          "flex items-center justify-center rounded-xl border border-dashed border-[#E2EBE6] bg-[#F5F7F6] text-xs font-medium text-[#64786E]",
          className
        )}
      >
        {emptyLabel}
      </div>
    );
  }

  return (
    <div className={cn("overflow-hidden rounded-xl border border-[#E2EBE6] bg-[#F5F7F6]", className)}>
      <img src={src} alt={alt} className="h-full w-full object-cover" />
    </div>
  );
}

export interface FileUploadDropzoneProps {
  label: string;
  currentUrl?: string | null | undefined;
  accept?: string | undefined;
  allowedMimeTypes?: string[] | undefined;
  maxSizeBytes?: number | undefined;
  uploading?: boolean | undefined;
  progressText?: string | undefined;
  error?: string | undefined;
  onFileSelected: (file: File) => void | Promise<void>;
  onRemove?: (() => void) | undefined;
  className?: string | undefined;
}

const DEFAULT_MIME_TYPES = ["image/jpeg", "image/png", "image/webp"];
const DEFAULT_MAX_BYTES = 5 * 1024 * 1024;

export function FileUploadDropzone({
  label,
  currentUrl,
  accept = "image/jpeg,image/png,image/webp",
  allowedMimeTypes = DEFAULT_MIME_TYPES,
  maxSizeBytes = DEFAULT_MAX_BYTES,
  uploading = false,
  progressText,
  error,
  onFileSelected,
  onRemove,
  className,
}: FileUploadDropzoneProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [localError, setLocalError] = useState<string | null>(null);
  const [uploadedOk, setUploadedOk] = useState(false);

  const handleChange = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    if (!allowedMimeTypes.includes(file.type)) {
      setLocalError(`Unsupported file type "${file.type || "unknown"}". Allowed: ${allowedMimeTypes.join(", ")}`);
      setUploadedOk(false);
      return;
    }

    if (file.size > maxSizeBytes) {
      const maxMb = (maxSizeBytes / (1024 * 1024)).toFixed(1);
      setLocalError(`File exceeds maximum size of ${maxMb} MB.`);
      setUploadedOk(false);
      return;
    }

    setLocalError(null);
    setUploadedOk(false);
    await onFileSelected(file);
    setUploadedOk(true);
  };

  const displayError = localError || error;

  return (
    <div className={cn("space-y-2", className)}>
      <span className="block text-xs font-semibold text-[#0D2621]">{label}</span>
      <div className="flex flex-wrap items-center gap-4 rounded-xl border border-[#E2EBE6] bg-white p-3.5">
        <ImagePreview src={currentUrl} alt={label} className="h-20 w-24 shrink-0" emptyLabel="No image" />
        <div className="min-w-0 flex-1 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <input
              ref={inputRef}
              type="file"
              accept={accept}
              className="hidden"
              onChange={(e) => void handleChange(e)}
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              loading={uploading}
              leftIcon={<UploadIcon size={14} />}
              onClick={() => inputRef.current?.click()}
            >
              {currentUrl ? "Replace Image" : "Upload Image"}
            </Button>
            {currentUrl && onRemove && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={uploading}
                leftIcon={<TrashIcon size={14} />}
                onClick={onRemove}
              >
                Remove
              </Button>
            )}
          </div>
          <p className="text-xs text-[#64786E]">
            JPG, PNG or WebP up to {(maxSizeBytes / (1024 * 1024)).toFixed(0)}MB.
          </p>
          {uploading && (
            <p className="text-xs font-medium text-[#235347]">
              {progressText || "Uploading securely..."}
            </p>
          )}
          {!uploading && uploadedOk && !displayError && (
            <p className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700">
              <CheckIcon size={13} /> Upload verified
            </p>
          )}
          {displayError && (
            <p className="inline-flex items-center gap-1 text-xs font-medium text-[#EF4444]">
              <AlertIcon size={13} /> {displayError}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
