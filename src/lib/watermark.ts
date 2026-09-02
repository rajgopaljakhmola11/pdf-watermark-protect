import {
  PDFArray,
  PDFDocument,
  PDFPage,
  StandardFonts,
  degrees,
  drawObject,
  popGraphicsState,
  pushGraphicsState,
  rgb,
  type PDFFont,
  type PDFImage,
} from "pdf-lib";
import { EncryptedPDFError } from "pdf-lib";
import { ALREADY_ENCRYPTED, CORRUPT_PDF } from "./errors";
import { hexToRgb } from "./colour";
import {
  collectBoxes,
  drawOriginFromVisualBox,
  rotatedAxisAlignedSize,
  visualPageSize,
  type Size,
  type UnrotatedPageSize,
} from "./coordinates";
import type {
  FontFamily,
  FontStyle,
  PlacementSettings,
  WatermarkSettings,
} from "../types";

export async function applyWatermark(
  pdfBytes: Uint8Array,
  watermark: WatermarkSettings,
  placement: PlacementSettings,
  pageIndices: number[],
): Promise<Uint8Array> {
  let doc: PDFDocument;
  try {
    doc = await PDFDocument.load(pdfBytes, { ignoreEncryption: false });
  } catch (error) {
    if (error instanceof EncryptedPDFError) {
      throw new Error(ALREADY_ENCRYPTED);
    }
    throw new Error(CORRUPT_PDF);
  }
  if (doc.isEncrypted) {
    throw new Error(ALREADY_ENCRYPTED);
  }

  const pages = doc.getPages();
  const unique = Array.from(new Set(pageIndices)).sort((a, b) => a - b);

  let font: PDFFont | undefined;
  let image: PDFImage | undefined;
  let unrotated: Size;

  if (watermark.kind === "text") {
    font = await doc.embedFont(standardFont(watermark.fontFamily, watermark.fontStyle));
    const text = watermark.text.length > 0 ? watermark.text : " ";
    unrotated = {
      width: font.widthOfTextAtSize(text, watermark.fontSize),
      height: font.heightAtSize(watermark.fontSize),
    };
  } else {
    image =
      watermark.imageType === "image/png"
        ? await doc.embedPng(watermark.imageBytes)
        : await doc.embedJpg(watermark.imageBytes);
    const scale = watermark.scalePercent / 100;
    unrotated = {
      width: image.width * scale,
      height: image.height * scale,
    };
  }

  const rotation =
    watermark.kind === "text" ? watermark.rotation : watermark.rotation;
  const aabb = rotatedAxisAlignedSize(unrotated.width, unrotated.height, rotation);

  for (const index of unique) {
    const page = pages[index];
    if (!page) continue;
    const pageSize: UnrotatedPageSize = {
      width: page.getWidth(),
      height: page.getHeight(),
      rotation: page.getRotation().angle,
    };
    const visual = visualPageSize(pageSize);
    const boxes = collectBoxes(
      placement.preset,
      placement.tiled,
      placement.rows,
      placement.columns,
      visual,
      aabb,
    );

    const draw = (): void => {
      for (const box of boxes) {
        const origin = drawOriginFromVisualBox(box, unrotated, pageSize);
        if (watermark.kind === "text" && font) {
          const colour = hexToRgb(watermark.hexColour);
          page.drawText(watermark.text.length > 0 ? watermark.text : " ", {
            x: origin.x,
            y: origin.y,
            size: watermark.fontSize,
            font,
            color: rgb(colour.r, colour.g, colour.b),
            opacity: clampOpacity(watermark.opacity),
            rotate: degrees(watermark.rotation),
          });
        } else if (watermark.kind === "image" && image) {
          page.drawImage(image, {
            x: origin.x,
            y: origin.y,
            width: unrotated.width,
            height: unrotated.height,
            opacity: clampOpacity(watermark.opacity),
            rotate: degrees(watermark.rotation),
          });
        }
      }
    };

    if (placement.layer === "behind") {
      drawWatermarkBehind(page, draw);
    } else {
      draw();
    }
  }

  return doc.save();
}

/**
 * Behind-content watermarks:
 *
 * pdf-lib always *appends* draw operators. PDF paints in stream order, so
 * later operators sit on top. To paint first (behind existing page content)
 * we:
 *   1. Normalise Contents to an array.
 *   2. Draw the watermark with the normal pdf-lib APIs (new trailing stream).
 *   3. Move that trailing stream into a Form XObject.
 *   4. Prepend `q /Wm Do Q` onto the Contents array so the form paints first.
 *
 * Fonts, images, and ExtGState stay on the page Resources (the form's Do
 * operator runs with the page's resource dictionary available for named
 * fonts/XObjects registered during drawText/drawImage).
 */
function drawWatermarkBehind(page: PDFPage, draw: () => void): void {
  page.node.normalize();
  const intern = page as unknown as {
    contentStream: unknown;
    getContentStream: (useExisting?: boolean) => unknown;
  };
  intern.contentStream = undefined;
  intern.getContentStream(false);

  const contentsBefore = page.node.Contents();
  const sizeBefore =
    contentsBefore instanceof PDFArray ? contentsBefore.size() : 0;

  draw();

  const contents = page.node.Contents();
  if (!(contents instanceof PDFArray) || contents.size() <= sizeBefore) {
    return;
  }

  const lastIndex = contents.size() - 1;
  const lastRef = contents.get(lastIndex);
  contents.remove(lastIndex);

  const lastStream = page.doc.context.lookup(lastRef);
  const media = page.getMediaBox();
  const unencoded = (
    lastStream as { getUnencodedContents?: () => Uint8Array }
  ).getUnencodedContents;
  if (typeof unencoded !== "function") {
    contents.insert(0, lastRef);
    return;
  }
  const bytes = unencoded.call(lastStream);
  const raw = page.doc.context.flateStream(bytes, {
    Type: "XObject",
    Subtype: "Form",
    BBox: [media.x, media.y, media.x + media.width, media.y + media.height],
    Matrix: [1, 0, 0, 1, 0, 0],
  });
  const formRef = page.doc.context.register(raw);
  const xName = page.node.newXObject("Wm", formRef);
  const drawStream = page.doc.context.contentStream(
    [pushGraphicsState(), drawObject(xName), popGraphicsState()],
    {},
  );
  const drawRef = page.doc.context.register(drawStream);
  contents.insert(0, drawRef);
}

function clampOpacity(percent: number): number {
  const n = Number.isFinite(percent) ? percent : 100;
  return Math.min(1, Math.max(0.1, n / 100));
}

function standardFont(family: FontFamily, style: FontStyle): StandardFonts {
  if (family === "times") {
    if (style === "bold") return StandardFonts.TimesRomanBold;
    if (style === "italic") return StandardFonts.TimesRomanItalic;
    if (style === "boldItalic") return StandardFonts.TimesRomanBoldItalic;
    return StandardFonts.TimesRoman;
  }
  if (family === "courier") {
    if (style === "bold") return StandardFonts.CourierBold;
    if (style === "italic") return StandardFonts.CourierOblique;
    if (style === "boldItalic") return StandardFonts.CourierBoldOblique;
    return StandardFonts.Courier;
  }
  if (style === "bold") return StandardFonts.HelveticaBold;
  if (style === "italic") return StandardFonts.HelveticaOblique;
  if (style === "boldItalic") return StandardFonts.HelveticaBoldOblique;
  return StandardFonts.Helvetica;
}

export function estimateTextSize(
  text: string,
  fontSize: number,
  family: FontFamily,
): Size {
  const avg = family === "courier" ? 0.6 : 0.5;
  return {
    width: Math.max(1, text.length) * fontSize * avg,
    height: fontSize,
  };
}
