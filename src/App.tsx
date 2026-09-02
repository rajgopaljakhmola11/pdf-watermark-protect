import { useMemo, useState } from "react";
import qpdfWorkerUrl from "qpdf-run/worker?url";
import qpdfJsUrl from "qpdf-run/qpdf.js?url";
import qpdfWasmUrl from "qpdf-run/qpdf.wasm?url";
import { ControlPanel } from "./components/ControlPanel";
import { DropZone } from "./components/DropZone";
import { PreviewPane } from "./components/PreviewPane";
import { useDebouncedValue } from "./hooks/useDebouncedValue";
import { usePdfPreview } from "./hooks/usePdfPreview";
import { usePdfProcessor } from "./hooks/usePdfProcessor";
import { copyToArrayBuffer } from "./lib/buffers";
import { humaniseError } from "./lib/errors";
import { parsePageRange } from "./lib/pageRange";
import type {
  AesBits,
  PageTarget,
  PlacementSettings,
  WatermarkSettings,
} from "./types";

const defaultText = (): WatermarkSettings => ({
  kind: "text",
  text: "CONFIDENTIAL",
  fontFamily: "helvetica",
  fontStyle: "normal",
  fontSize: 48,
  hexColour: "#888888",
  opacity: 35,
  rotation: -32,
});

const defaultPlacement = (): PlacementSettings => ({
  preset: "centre",
  tiled: false,
  rows: 3,
  columns: 3,
  layer: "on-top",
});

function App() {
  const [pdfBytes, setPdfBytes] = useState<Uint8Array | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [fileSize, setFileSize] = useState<number | null>(null);
  const [watermark, setWatermark] = useState<WatermarkSettings>(defaultText);
  const [placement, setPlacement] = useState<PlacementSettings>(defaultPlacement);
  const [pageTarget, setPageTarget] = useState<PageTarget>("all");
  const [customRange, setCustomRange] = useState("1-3, 5");
  const [userPassword, setUserPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [ownerPassword, setOwnerPassword] = useState("");
  const [showUser, setShowUser] = useState(false);
  const [showOwner, setShowOwner] = useState(false);
  const [aesBits, setAesBits] = useState<AesBits>(256);
  const [allowPrinting, setAllowPrinting] = useState(true);
  const [allowCopying, setAllowCopying] = useState(true);
  const [allowEditing, setAllowEditing] = useState(true);
  const [pageNumber, setPageNumber] = useState(1);
  const [previewCollapsed, setPreviewCollapsed] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const { doc, pageCount, error: previewError } = usePdfPreview(pdfBytes);
  const { protect } = usePdfProcessor();

  const debouncedWm = useDebouncedValue(watermark, 150);
  const debouncedPlacement = useDebouncedValue(placement, 150);

  const imageUrl = useMemo(() => {
    if (debouncedWm.kind !== "image" || debouncedWm.imageBytes.byteLength === 0) {
      return null;
    }
    const blob = new Blob([copyToArrayBuffer(debouncedWm.imageBytes)], { type: debouncedWm.imageType });
    return URL.createObjectURL(blob);
  }, [debouncedWm]);

  const rangeCheck =
    pageTarget === "custom" ? parsePageRange(customRange, pageCount) : { ok: true as const };

  const passwordsOk =
    userPassword.length > 0 &&
    confirmPassword === userPassword;

  const canProtect =
    !!pdfBytes &&
    !busy &&
    passwordsOk &&
    (pageTarget !== "custom" || rangeCheck.ok) &&
    (watermark.kind === "text" || watermark.imageBytes.byteLength > 0);

  function resetAll() {
    setPdfBytes(null);
    setFileName(null);
    setFileSize(null);
    setWatermark(defaultText());
    setPlacement(defaultPlacement());
    setPageTarget("all");
    setCustomRange("1-3, 5");
    setUserPassword("");
    setConfirmPassword("");
    setOwnerPassword("");
    setShowUser(false);
    setShowOwner(false);
    setAesBits(256);
    setAllowPrinting(true);
    setAllowCopying(true);
    setAllowEditing(true);
    setPageNumber(1);
    setStatus(null);
    setError(null);
    setBusy(false);
  }

  async function onProtect() {
    if (!pdfBytes || !fileName || !canProtect) return;
    setError(null);
    setBusy(true);
    setStatus("Applying watermark…");
    try {
      let indices: number[] = [];
      if (pageTarget === "all") {
        indices = Array.from({ length: pageCount }, (_, i) => i);
      } else if (pageTarget === "first") {
        indices = [0];
      } else {
        const parsed = parsePageRange(customRange, pageCount);
        if (!parsed.ok) {
          setError(parsed.error);
          setBusy(false);
          setStatus(null);
          return;
        }
        indices = parsed.pages.map((n) => n - 1);
      }

      const bytes = await protect({
        pdfBytes,
        watermark,
        placement,
        pageIndices: indices,
        encrypt: {
          userPassword,
          ownerPassword,
          aesBits,
          allowPrinting,
          allowCopying,
          allowEditing,
        },
        qpdfUrls: {
          workerUrl: qpdfWorkerUrl,
          qpdfJsUrl: qpdfJsUrl,
          wasmUrl: qpdfWasmUrl,
        },
        onProgress: (stage) => {
          setStatus(stage === "watermark" ? "Applying watermark…" : "Encrypting…");
        },
      });

      const base = fileName.replace(/\.pdf$/i, "");
      const blob = new Blob([copyToArrayBuffer(bytes)], { type: "application/pdf" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = base + "_protected.pdf";
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      setStatus("Done. The file was saved on this device.");
    } catch (err) {
      setError(humaniseError(err));
      setStatus(null);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-svh bg-zinc-50 text-zinc-900 dark:bg-zinc-950 dark:text-zinc-100">
      <header className="border-b border-zinc-200 px-4 py-4 dark:border-zinc-800">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-lg font-semibold">PDF watermark and protect</h1>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              Everything runs in your browser. The PDF and password are never uploaded.
            </p>
          </div>
          <button
            type="button"
            onClick={resetAll}
            className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500 dark:border-zinc-600"
          >
            Start over
          </button>
        </div>
      </header>

      <main className="mx-auto grid max-w-6xl gap-6 px-4 py-6 lg:grid-cols-[minmax(280px,380px)_1fr]">
        <section className="space-y-4">
          <DropZone
            disabled={busy}
            fileName={fileName}
            fileSize={fileSize}
            pageCount={pdfBytes ? pageCount : null}
            onLoaded={(bytes, name) => {
              setError(null);
              setPdfBytes(bytes);
              setFileName(name);
              setFileSize(bytes.byteLength);
              setPageNumber(1);
            }}
            onError={(message) => {
              setError(message);
              setPdfBytes(null);
              setFileName(null);
              setFileSize(null);
            }}
          />
          <ControlPanel
            enabled={!!pdfBytes && !busy}
            watermark={watermark}
            onWatermark={setWatermark}
            placement={placement}
            onPlacement={setPlacement}
            pageTarget={pageTarget}
            onPageTarget={setPageTarget}
            customRange={customRange}
            onCustomRange={setCustomRange}
            pageCount={pageCount}
            userPassword={userPassword}
            onUserPassword={setUserPassword}
            confirmPassword={confirmPassword}
            onConfirmPassword={setConfirmPassword}
            ownerPassword={ownerPassword}
            onOwnerPassword={setOwnerPassword}
            showUser={showUser}
            showOwner={showOwner}
            onToggleUser={() => setShowUser((v) => !v)}
            onToggleOwner={() => setShowOwner((v) => !v)}
            aesBits={aesBits}
            onAesBits={setAesBits}
            allowPrinting={allowPrinting}
            onAllowPrinting={setAllowPrinting}
            allowCopying={allowCopying}
            onAllowCopying={setAllowCopying}
            allowEditing={allowEditing}
            onAllowEditing={setAllowEditing}
            rangeError={rangeCheck.ok ? null : rangeCheck.error}
          />
          <button
            type="button"
            disabled={!canProtect}
            onClick={() => void onProtect()}
            className="w-full rounded-lg bg-sky-600 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-40 focus:outline-none focus:ring-2 focus:ring-sky-500"
          >
            Protect and download
          </button>
          <div aria-live="polite" className="min-h-6 text-sm">
            {error || previewError ? (
              <p className="text-red-600 dark:text-red-400">{error || previewError}</p>
            ) : status ? (
              <p className="text-zinc-600 dark:text-zinc-300">{status}</p>
            ) : null}
          </div>
        </section>

        <PreviewPane
          doc={doc}
          pageNumber={pageNumber}
          onPageNumber={setPageNumber}
          pageCount={pageCount}
          watermark={debouncedWm}
          placement={debouncedPlacement}
          imageUrl={imageUrl}
          collapsed={previewCollapsed}
          onToggle={() => setPreviewCollapsed((v) => !v)}
        />
      </main>
    </div>
  );
}

export default App;
