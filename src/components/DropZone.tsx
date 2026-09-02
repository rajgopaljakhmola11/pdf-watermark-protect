import { useCallback, useId, useState } from "react";
import { assertNotEncrypted, assertPdfUpload, formatBytes } from "../lib/magicBytes";
import { humaniseError } from "../lib/errors";

interface DropZoneProps {
  disabled: boolean;
  fileName: string | null;
  fileSize: number | null;
  pageCount: number | null;
  onLoaded: (bytes: Uint8Array, name: string) => void;
  onError: (message: string) => void;
}

export function DropZone({
  disabled,
  fileName,
  fileSize,
  pageCount,
  onLoaded,
  onError,
}: DropZoneProps) {
  const inputId = useId();
  const [dragOver, setDragOver] = useState(false);

  const readFile = useCallback(
    async (file: File) => {
      try {
        const buffer = await file.arrayBuffer();
        const bytes = new Uint8Array(buffer);
        assertPdfUpload(bytes);
        assertNotEncrypted(bytes);
        onLoaded(bytes, file.name);
      } catch (error) {
        onError(humaniseError(error));
      }
    },
    [onLoaded, onError],
  );

  return (
    <div className="space-y-2">
      <label
        htmlFor={inputId}
        onDragOver={(e) => {
          e.preventDefault();
          if (!disabled) setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          const file = e.dataTransfer.files[0];
          if (file) void readFile(file);
        }}
        className={
          "flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed px-4 py-8 text-center transition " +
          (dragOver
            ? "border-sky-500 bg-sky-50 dark:bg-sky-950"
            : "border-zinc-300 bg-zinc-50 dark:border-zinc-600 dark:bg-zinc-900") +
          " focus-within:ring-2 focus-within:ring-sky-500"
        }
      >
        <input
          id={inputId}
          type="file"
          accept="application/pdf,.pdf"
          className="sr-only"
          disabled={disabled}
          onChange={(e) => {
            const file = e.target.files?.[0];
            e.target.value = "";
            if (file) void readFile(file);
          }}
        />
        <span className="text-sm font-medium text-zinc-800 dark:text-zinc-100">
          Drop a PDF here or click to browse
        </span>
        <span className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
          PDF only, 50 MB maximum. Stays on this device.
        </span>
      </label>
      {fileName && fileSize !== null && pageCount !== null && (
        <p className="text-sm text-zinc-700 dark:text-zinc-200">
          <span className="font-medium">{fileName}</span>
          {" · "}
          {formatBytes(fileSize)}
          {" · "}
          {pageCount} {pageCount === 1 ? "page" : "pages"}
        </p>
      )}
    </div>
  );
}
