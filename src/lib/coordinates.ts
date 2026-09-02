import type { PositionPreset } from "../types";

export interface UnrotatedPageSize {
  /** Media box width in PDF points (unrotated user space). */
  width: number;
  /** Media box height in PDF points (unrotated user space). */
  height: number;
  /** page.getRotation() angle: 0, 90, 180, or 270 (clockwise). */
  rotation: number;
}

export interface Point {
  x: number;
  y: number;
}

export interface Size {
  width: number;
  height: number;
}

export interface VisualPage {
  width: number;
  height: number;
}

/**
 * PDF.js canvas uses a top-left origin in device pixels (y grows down).
 * pdf-lib drawing uses the page's unrotated user space: origin at the
 * bottom-left of the MediaBox, units in PDF points, y grows up.
 *
 * PDF.js page.getViewport({ scale }) already applies /Rotate so the
 * canvas matches the visual page. pdf-lib page.drawText / drawImage
 * ignore /Rotate and paint in unrotated user space; the viewer then
 * rotates the whole page. Both preview and export therefore:
 *
 *   1. Place the watermark in visual space (top-left, y-down, points).
 *   2. Preview: multiply by canvasScale to get canvas pixels.
 *   3. Export: convert visual points to unrotated PDF user space with
 *      visualTopLeftToPdfUserSpace().
 *
 * Visual size vs unrotated MediaBox:
 *   0 / 180 -> visual W x H = page W x H
 *   90 / 270 -> visual W x H = page H x W
 */

export function normalizeRotation(angle: number): 0 | 90 | 180 | 270 {
  const wrapped = ((Math.round(angle / 90) * 90) % 360 + 360) % 360;
  if (wrapped === 90 || wrapped === 180 || wrapped === 270) return wrapped;
  return 0;
}

export function visualPageSize(page: UnrotatedPageSize): VisualPage {
  const rotation = normalizeRotation(page.rotation);
  if (rotation === 90 || rotation === 270) {
    return { width: page.height, height: page.width };
  }
  return { width: page.width, height: page.height };
}

/**
 * Convert a point from visual space (origin top-left of the displayed
 * page, y-down, PDF points) into pdf-lib user space (origin bottom-left
 * of the unrotated MediaBox, y-up, PDF points).
 *
 * Displayed corners mapped onto unrotated user space:
 *   0:   TL (0,H)  TR (W,H)  BL (0,0)  BR (W,0)
 *   90:  TL (0,0)  TR (0,H)  BL (W,0)  BR (W,H)  clockwise
 *   180: TL (W,0)  TR (0,0)  BL (W,H)  BR (0,H)
 *   270: TL (W,H)  TR (W,0)  BL (0,H)  BR (0,0)
 */
export function visualTopLeftToPdfUserSpace(
  visual: Point,
  page: UnrotatedPageSize,
): Point {
  const rotation = normalizeRotation(page.rotation);
  const vx = visual.x;
  const vy = visual.y;
  const w = page.width;
  const h = page.height;

  switch (rotation) {
    case 90:
      return { x: vy, y: vx };
    case 180:
      return { x: w - vx, y: vy };
    case 270:
      return { x: w - vy, y: h - vx };
    default:
      return { x: vx, y: h - vy };
  }
}

export function visualPointsToCanvasPixels(
  visual: Point,
  canvasScale: number,
): Point {
  return { x: visual.x * canvasScale, y: visual.y * canvasScale };
}

export function rotatedAxisAlignedSize(
  width: number,
  height: number,
  rotationDeg: number,
): Size {
  const rad = (rotationDeg * Math.PI) / 180;
  const cos = Math.abs(Math.cos(rad));
  const sin = Math.abs(Math.sin(rad));
  return {
    width: width * cos + height * sin,
    height: width * sin + height * cos,
  };
}

const MARGIN = 36;

export interface PlacementBox {
  visualLeft: number;
  visualTop: number;
  boxWidth: number;
  boxHeight: number;
}

export function presetBox(
  preset: PositionPreset,
  visual: VisualPage,
  box: Size,
): PlacementBox {
  const innerW = Math.max(0, visual.width - 2 * MARGIN);
  const innerH = Math.max(0, visual.height - 2 * MARGIN);

  let xFrac = 0.5;
  let yFrac = 0.5;
  if (preset.endsWith("left")) xFrac = 0;
  else if (preset.endsWith("right")) xFrac = 1;
  if (preset.startsWith("top")) yFrac = 0;
  else if (preset.startsWith("bottom")) yFrac = 1;

  const left = MARGIN + (innerW - box.width) * xFrac;
  const top = MARGIN + (innerH - box.height) * yFrac;
  return {
    visualLeft: left,
    visualTop: top,
    boxWidth: box.width,
    boxHeight: box.height,
  };
}

export function tiledBoxes(
  visual: VisualPage,
  box: Size,
  rows: number,
  columns: number,
): PlacementBox[] {
  const safeRows = Math.max(1, Math.floor(rows));
  const safeCols = Math.max(1, Math.floor(columns));
  const cellW = visual.width / safeCols;
  const cellH = visual.height / safeRows;
  const boxes: PlacementBox[] = [];
  for (let r = 0; r < safeRows; r += 1) {
    for (let c = 0; c < safeCols; c += 1) {
      boxes.push({
        visualLeft: c * cellW + (cellW - box.width) / 2,
        visualTop: r * cellH + (cellH - box.height) / 2,
        boxWidth: box.width,
        boxHeight: box.height,
      });
    }
  }
  return boxes;
}

/**
 * pdf-lib draws text from baseline-left and images from bottom-left,
 * rotating around that origin. We rotate about the AABB centre, so
 * convert centre -> draw origin in visual space, then to PDF user space.
 */
export function drawOriginFromVisualBox(
  box: PlacementBox,
  unrotated: Size,
  page: UnrotatedPageSize,
): Point {
  const centreVisual = {
    x: box.visualLeft + box.boxWidth / 2,
    y: box.visualTop + box.boxHeight / 2,
  };
  const originVisual = {
    x: centreVisual.x - unrotated.width / 2,
    y: centreVisual.y + unrotated.height / 2,
  };
  return visualTopLeftToPdfUserSpace(originVisual, page);
}

export function collectBoxes(
  preset: PositionPreset,
  tiled: boolean,
  rows: number,
  columns: number,
  visual: VisualPage,
  aabb: Size,
): PlacementBox[] {
  if (tiled) return tiledBoxes(visual, aabb, rows, columns);
  return [presetBox(preset, visual, aabb)];
}
