import { useEffect, useRef, useState } from "react";
import { getDocument, GlobalWorkerOptions, type PDFDocumentProxy } from "pdfjs-dist";
import pdfjsWorker from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import { CORRUPT_PDF } from "../lib/errors";

GlobalWorkerOptions.workerSrc = pdfjsWorker;

export function usePdfPreview(pdfBytes: Uint8Array | null) {
  const [doc, setDoc] = useState<PDFDocumentProxy | null>(null);
  const [pageCount, setPageCount] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const gen = useRef(0);

  useEffect(() => {
    if (!pdfBytes) {
      setDoc(null);
      setPageCount(0);
      setError(null);
      return;
    }
    const id = ++gen.current;
    const copy = new Uint8Array(pdfBytes.byteLength);
    copy.set(pdfBytes);
    let loading: ReturnType<typeof getDocument> | null = null;
    let opened: PDFDocumentProxy | null = null;

    void (async () => {
      try {
        loading = getDocument({
          data: copy,
          useSystemFonts: true,
        });
        opened = await loading.promise;
        if (gen.current !== id) {
          await loading.destroy();
          return;
        }
        setDoc(opened);
        setPageCount(opened.numPages);
        setError(null);
      } catch {
        if (gen.current === id) {
          setDoc(null);
          setPageCount(0);
          setError(CORRUPT_PDF);
        }
      }
    })();

    return () => {
      void loading?.destroy();
    };
  }, [pdfBytes]);

  return { doc, pageCount, error };
}
