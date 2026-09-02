export type WatermarkKind = "text" | "image";

export type FontFamily = "helvetica" | "times" | "courier";
export type FontStyle = "normal" | "bold" | "italic" | "boldItalic";

export type PositionPreset =
  | "top-left"
  | "top-centre"
  | "top-right"
  | "middle-left"
  | "centre"
  | "middle-right"
  | "bottom-left"
  | "bottom-centre"
  | "bottom-right";

export type PageTarget = "all" | "first" | "custom";
export type LayerOrder = "on-top" | "behind";
export type AesBits = 128 | 256;
export type ImageMime = "image/png" | "image/jpeg";

export interface TextWatermarkSettings {
  kind: "text";
  text: string;
  fontFamily: FontFamily;
  fontStyle: FontStyle;
  fontSize: number;
  hexColour: string;
  opacity: number;
  rotation: number;
}

export interface ImageWatermarkSettings {
  kind: "image";
  imageBytes: Uint8Array;
  imageType: ImageMime;
  naturalWidth: number;
  naturalHeight: number;
  scalePercent: number;
  opacity: number;
  rotation: number;
}

export type WatermarkSettings = TextWatermarkSettings | ImageWatermarkSettings;

export interface PlacementSettings {
  preset: PositionPreset;
  tiled: boolean;
  rows: number;
  columns: number;
  layer: LayerOrder;
}

export interface EncryptSettings {
  userPassword: string;
  ownerPassword: string;
  aesBits: AesBits;
  allowPrinting: boolean;
  allowCopying: boolean;
  allowEditing: boolean;
}

export interface QpdfAssetUrls {
  workerUrl: string;
  qpdfJsUrl: string;
  wasmUrl: string;
}

export interface PdfMeta {
  name: string;
  size: number;
  pageCount: number;
}
