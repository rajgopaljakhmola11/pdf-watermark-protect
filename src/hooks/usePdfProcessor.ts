import { useCallback, useRef } from "react";
import { copyToArrayBuffer } from "../lib/buffers";
import { GENERIC_FAIL, humaniseError } from "../lib/errors";
import type {
  EncryptSettings,
  PlacementSettings,
  QpdfAssetUrls,
  WatermarkSettings,
} from "../types";
import type {
  ProtectOutgoing,
  ProtectRequest,
} from "../workers/pdfProcessor.worker";

export interface ProtectInput {
  pdfBytes: Uint8Array;
  watermark: WatermarkSettings;
  placement: PlacementSettings;
  pageIndices: number[];
  encrypt: EncryptSettings;
  qpdfUrls: QpdfAssetUrls;
  onProgress: (stage: "watermark" | "encrypt") => void;
}

export function usePdfProcessor() {
  const workerRef = useRef<Worker | null>(null);

  const getWorker = useCallback((): Worker => {
    if (!workerRef.current) {
      workerRef.current = new Worker(
        new URL("../workers/pdfProcessor.worker.ts", import.meta.url),
        { type: "module" },
      );
    }
    return workerRef.current;
  }, []);

  const protect = useCallback(
    (input: ProtectInput): Promise<Uint8Array> => {
      const worker = getWorker();
      const pdfBuffer = copyToArrayBuffer(input.pdfBytes);

      return new Promise((resolve, reject) => {
        const handle = (event: MessageEvent<ProtectOutgoing>) => {
          const msg = event.data;
          if (msg.type === "progress") {
            input.onProgress(msg.stage);
            return;
          }
          worker.removeEventListener("message", handle);
          if (msg.type === "ok") {
            resolve(new Uint8Array(msg.pdfBuffer));
            return;
          }
          reject(new Error(msg.message || GENERIC_FAIL));
        };
        worker.addEventListener("message", handle);
        worker.addEventListener(
          "error",
          () => {
            worker.removeEventListener("message", handle);
            reject(new Error(humaniseError(new Error("worker failed"))));
          },
          { once: true },
        );

        const imageTransfer: Transferable[] = [pdfBuffer];
        if (input.watermark.kind === "image") {
          const imgBuf = copyToArrayBuffer(input.watermark.imageBytes);
          input.watermark = {
            ...input.watermark,
            imageBytes: new Uint8Array(imgBuf),
          };
          imageTransfer.push(imgBuf);
        }

        const request: ProtectRequest = {
          type: "protect",
          pdfBuffer,
          watermark: input.watermark,
          placement: input.placement,
          pageIndices: input.pageIndices,
          encrypt: input.encrypt,
          qpdfUrls: input.qpdfUrls,
        };
        worker.postMessage(request, imageTransfer);
      });
    },
    [getWorker],
  );

  const terminate = useCallback(() => {
    workerRef.current?.terminate();
    workerRef.current = null;
  }, []);

  return { protect, terminate };
}
