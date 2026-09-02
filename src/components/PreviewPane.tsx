import { useEffect, useRef } from "react";
import type { PDFDocumentProxy } from "pdfjs-dist";
import { hexToCss } from "../lib/colour";
import {
  collectBoxes,
  rotatedAxisAlignedSize,
  type Size,
} from "../lib/coordinates";
import type { PlacementSettings, WatermarkSettings } from "../types";

interface PreviewPaneProps {
  doc: PDFDocumentProxy | null;
  pageNumber: number;
  onPageNumber: (n: number) => void;
  pageCount: number;
  watermark: WatermarkSettings;
  placement: PlacementSettings;
  imageUrl: string | null;
  collapsed: boolean;
  onToggle: () => void;
}

export function PreviewPane({
  doc,
  pageNumber,
  onPageNumber,
  pageCount,
  watermark,
  placement,
  imageUrl,
  collapsed,
  onToggle,
}: PreviewPaneProps) {
  const pdfCanvas = useRef<HTMLCanvasElement>(null);
  const overlayCanvas = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!doc || collapsed) return;
    const canvas = pdfCanvas.current;
    const overlay = overlayCanvas.current;
    if (!canvas || !overlay) return;

    let cancelled = false;
    void (async () => {
      const page = await doc.getPage(pageNumber);
      if (cancelled) return;
      const base = page.getViewport({ scale: 1 });
      const maxW = Math.min(640, (overlay.parentElement?.clientWidth ?? 640) || 640);
      const scale = Math.min(1.5, maxW / base.width);
      const viewport = page.getViewport({ scale });
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      overlay.width = viewport.width;
      overlay.height = viewport.height;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      const task = page.render({ canvasContext: ctx, viewport, canvas });
      await task.promise;
      if (cancelled) return;
      drawOverlay(overlay, {
        visualWidth: viewport.width / scale,
        visualHeight: viewport.height / scale,
        canvasScale: scale,
        rotation: page.rotate,
        watermark,
        placement,
        imageUrl,
      });
    })();

    return () => {
      cancelled = true;
    };
  }, [doc, pageNumber, watermark, placement, imageUrl, collapsed]);

  return (
    <section className="flex min-h-0 flex-col gap-3">
      <div className="flex items-center justify-between gap-2 lg:hidden">
        <h2 className="text-sm font-semibold">Preview</h2>
        <button
          type="button"
          className="rounded-md border border-zinc-300 px-3 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500 dark:border-zinc-600"
          onClick={onToggle}
        >
          {collapsed ? "Show preview" : "Hide preview"}
        </button>
      </div>
      {!collapsed && (
        <>
          <div className="relative overflow-auto rounded-xl bg-zinc-200 dark:bg-zinc-800">
            <div className="relative mx-auto w-fit">
              <canvas ref={pdfCanvas} className="block max-w-full" />
              <canvas
                ref={overlayCanvas}
                className="pointer-events-none absolute inset-0 max-w-full"
              />
            </div>
          </div>
          <div className="flex items-center justify-center gap-2">
            <button
              type="button"
              className="rounded-md border border-zinc-300 px-3 py-1 text-sm disabled:opacity-40 focus:outline-none focus:ring-2 focus:ring-sky-500 dark:border-zinc-600"
              disabled={pageNumber <= 1}
              onClick={() => onPageNumber(pageNumber - 1)}
            >
              Previous
            </button>
            <label className="flex items-center gap-1 text-sm">
              Page
              <input
                type="number"
                min={1}
                max={Math.max(1, pageCount)}
                value={pageNumber}
                onChange={(e) => {
                  const n = Number(e.target.value);
                  if (!Number.isFinite(n)) return;
                  onPageNumber(Math.min(pageCount, Math.max(1, Math.floor(n))));
                }}
                className="w-16 rounded-md border border-zinc-300 bg-white px-2 py-1 dark:border-zinc-600 dark:bg-zinc-900"
              />
              of {pageCount || "—"}
            </label>
            <button
              type="button"
              className="rounded-md border border-zinc-300 px-3 py-1 text-sm disabled:opacity-40 focus:outline-none focus:ring-2 focus:ring-sky-500 dark:border-zinc-600"
              disabled={pageNumber >= pageCount}
              onClick={() => onPageNumber(pageNumber + 1)}
            >
              Next
            </button>
          </div>
        </>
      )}
    </section>
  );
}

interface OverlayArgs {
  visualWidth: number;
  visualHeight: number;
  canvasScale: number;
  rotation: number;
  watermark: WatermarkSettings;
  placement: PlacementSettings;
  imageUrl: string | null;
}

function drawOverlay(canvas: HTMLCanvasElement, args: OverlayArgs): void {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  const unrotated = watermarkUnrotatedSize(args.watermark, args.visualWidth);
  const aabb = rotatedAxisAlignedSize(
    unrotated.width,
    unrotated.height,
    args.watermark.rotation,
  );
  const boxes = collectBoxes(
    args.placement.preset,
    args.placement.tiled,
    args.placement.rows,
    args.placement.columns,
    { width: args.visualWidth, height: args.visualHeight },
    aabb,
  );

  const opacity = Math.min(1, Math.max(0.1, args.watermark.opacity / 100));
  ctx.save();
  ctx.globalAlpha = opacity;

  for (const box of boxes) {
    const cx = (box.visualLeft + box.boxWidth / 2) * args.canvasScale;
    const cy = (box.visualTop + box.boxHeight / 2) * args.canvasScale;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate((args.watermark.rotation * Math.PI) / 180);
    if (args.watermark.kind === "text") {
      const size = args.watermark.fontSize * args.canvasScale;
      ctx.font = fontCss(args.watermark.fontStyle, size, args.watermark.fontFamily);
      ctx.fillStyle = hexToCss(args.watermark.hexColour);
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(args.watermark.text || " ", 0, 0);
    } else if (args.imageUrl) {
      const img = imageCache(args.imageUrl);
      if (img && img.complete && img.naturalWidth > 0) {
        const w = unrotated.width * args.canvasScale;
        const h = unrotated.height * args.canvasScale;
        ctx.drawImage(img, -w / 2, -h / 2, w, h);
      }
    }
    ctx.restore();
  }
  ctx.restore();
}

function watermarkUnrotatedSize(watermark: WatermarkSettings, visualWidth: number): Size {
  if (watermark.kind === "text") {
    const avg = watermark.fontFamily === "courier" ? 0.6 : 0.5;
    return {
      width: Math.max(1, watermark.text.length) * watermark.fontSize * avg,
      height: watermark.fontSize,
    };
  }
  const img = watermarkImageSize(watermark);
  const scale = watermark.scalePercent / 100;
  return {
    width: (img?.width ?? visualWidth * 0.25) * scale,
    height: (img?.height ?? 100) * scale,
  };
}

const imgs = new Map<string, HTMLImageElement>();

function imageCache(url: string): HTMLImageElement {
  let img = imgs.get(url);
  if (!img) {
    img = new Image();
    img.src = url;
    imgs.set(url, img);
  }
  return img;
}

function watermarkImageSize(watermark: WatermarkSettings): Size | null {
  if (watermark.kind !== "image") return null;
  return { width: watermark.naturalWidth, height: watermark.naturalHeight };
}

function fontCss(
  style: string,
  size: number,
  family: string,
): string {
  const weight = style === "bold" || style === "boldItalic" ? "700" : "400";
  const italic = style === "italic" || style === "boldItalic" ? "italic " : "";
  const stack =
    family === "times"
      ? '"Times New Roman", Times, serif'
      : family === "courier"
        ? '"Courier New", Courier, monospace'
        : "Helvetica, Arial, sans-serif";
  return italic + weight + " " + String(size) + "px " + stack;
}
