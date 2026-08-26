'use client';

import { useCallback, useId, useRef, useState } from 'react';

type FileDropzoneProps = {
  file?: File | null;
  existingName?: string | null;
  onFile: (file: File | null) => void;
  accept?: string;
  hint?: string;
  disabled?: boolean;
  label?: string;
};

export function FileDropzone({
  file = null,
  existingName,
  onFile,
  accept = 'application/pdf,image/jpeg,image/png,image/webp,image/gif',
  hint = 'PDF, PNG, JPG · max 12 Mo',
  disabled = false,
  label = 'Glisser-déposer ou cliquer',
}: FileDropzoneProps) {
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  const pick = useCallback(
    (f: File | undefined | null) => {
      if (!f || disabled) return;
      onFile(f);
    },
    [disabled, onFile],
  );

  const displayName = file?.name ?? existingName ?? null;

  return (
    <div className="file-dropzone-wrap">
      <label
        htmlFor={inputId}
        className={`file-dropzone${dragging ? ' is-dragging' : ''}${disabled ? ' is-disabled' : ''}${displayName ? ' has-file' : ''}`}
        onDragEnter={(e) => {
          e.preventDefault();
          e.stopPropagation();
          if (!disabled) setDragging(true);
        }}
        onDragOver={(e) => {
          e.preventDefault();
          e.stopPropagation();
          if (!disabled) setDragging(true);
        }}
        onDragLeave={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setDragging(false);
        }}
        onDrop={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setDragging(false);
          pick(e.dataTransfer.files?.[0]);
        }}
      >
        <span className="file-dropzone-icon" aria-hidden>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
            <path
              d="M12 16V7m0 0 3.5 3.5M12 7 8.5 10.5"
              stroke="currentColor"
              strokeWidth="1.7"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <path
              d="M5 16.5V18a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-1.5"
              stroke="currentColor"
              strokeWidth="1.7"
              strokeLinecap="round"
            />
          </svg>
        </span>
        <span className="file-dropzone-title">{displayName ?? label}</span>
        <span className="file-dropzone-hint">
          {displayName ? 'Cliquer ou déposer pour remplacer' : hint}
        </span>
        <input
          ref={inputRef}
          id={inputId}
          type="file"
          className="file-dropzone-input"
          accept={accept}
          disabled={disabled}
          onChange={(e) => {
            pick(e.target.files?.[0]);
            e.target.value = '';
          }}
        />
      </label>
      {file && !disabled ? (
        <button
          type="button"
          className="file-dropzone-clear"
          onClick={() => onFile(null)}
        >
          Retirer
        </button>
      ) : null}
    </div>
  );
}
