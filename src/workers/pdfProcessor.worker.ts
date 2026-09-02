/// <reference lib="webworker" />

import { humaniseError } from "../lib/errors";
import { encryptPdf } from "../lib/qpdfEncrypt";
import { applyWatermark } from "../lib/watermark";
import { copyToArrayBuffer } from "../lib/buffers";
import type {
  EncryptSettings,
  PlacementSettings,
  QpdfAssetUrls,
  WatermarkSettings,
} from "../types";

export interface ProtectRequest {
  type: "protect";
  pdfBuffer: ArrayBuffer;
  watermark: WatermarkSettings;
  placement: PlacementSettings;
  pageIndices: number[];
  encrypt: EncryptSettings;
  qpdfUrls: QpdfAssetUrls;
}

export interface ProtectOk {
  type: "ok";
  pdfBuffer: ArrayBuffer;
}

export interface ProtectError {
  type: "error";
  message: string;
}

export interface ProtectProgress {
  type: "progress";
  stage: "watermark" | "encrypt";
}

export type ProtectIncoming = ProtectRequest;
export type ProtectOutgoing = ProtectOk | ProtectError | ProtectProgress;

const ctx: DedicatedWorkerGlobalScope = self as DedicatedWorkerGlobalScope;

ctx.onmessage = (event: MessageEvent<ProtectIncoming>) => {
  const data = event.data;
  if (!data || data.type !== "protect") return;
  void runProtect(data);
};

async function runProtect(request: ProtectRequest): Promise<void> {
  try {
    const pdfBytes = new Uint8Array(request.pdfBuffer);
    ctx.postMessage({ type: "progress", stage: "watermark" } satisfies ProtectProgress);

    const watermarked = await applyWatermark(
      pdfBytes,
      request.watermark,
      request.placement,
      request.pageIndices,
    );

    ctx.postMessage({ type: "progress", stage: "encrypt" } satisfies ProtectProgress);

    const encrypted = await encryptPdf(
      watermarked,
      request.encrypt,
      request.qpdfUrls,
    );

    const buffer = copyToArrayBuffer(encrypted);
    const ok: ProtectOk = { type: "ok", pdfBuffer: buffer };
    ctx.postMessage(ok, { transfer: [buffer] });
  } catch (error) {
    const fail: ProtectError = { type: "error", message: humaniseError(error) };
    ctx.postMessage(fail);
  }
}
