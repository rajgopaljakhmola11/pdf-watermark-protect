export const ALREADY_ENCRYPTED =
  "This PDF is already encrypted and can't be modified";

export const FILE_TOO_LARGE = "This file is larger than the 50 MB limit.";
export const NOT_A_PDF = "That file is not a PDF. Please choose a PDF document.";
export const CORRUPT_PDF = "This PDF looks damaged and can't be opened.";
export const BAD_IMAGE = "That image isn't a valid PNG or JPG.";
export const WASM_LOAD_FAIL =
  "Couldn't load the encryption engine. Check your connection and try again.";
export const OUT_OF_MEMORY =
  "This file is too large to process in the browser. Try a smaller PDF.";
export const GENERIC_FAIL = "Something went wrong while processing the PDF.";

const KNOWN = new Set([
  ALREADY_ENCRYPTED,
  FILE_TOO_LARGE,
  NOT_A_PDF,
  CORRUPT_PDF,
  BAD_IMAGE,
  WASM_LOAD_FAIL,
  OUT_OF_MEMORY,
]);

export function humaniseError(error: unknown): string {
  if (error instanceof Error) {
    const message = error.message;
    if (message === ALREADY_ENCRYPTED) return ALREADY_ENCRYPTED;
    if (
      /already encrypted/i.test(message) ||
      /EncryptedPDFError/i.test(error.name)
    ) {
      return ALREADY_ENCRYPTED;
    }
    if (/wasm|QPDF_INIT|Failed to fetch|importScripts/i.test(message)) {
      return WASM_LOAD_FAIL;
    }
    if (
      error.name === "RangeError" ||
      /out of memory|OOM|allocation|heap|memory/i.test(message)
    ) {
      return OUT_OF_MEMORY;
    }
    if (/encrypt|qpdf|QPDF_/i.test(message)) {
      return "Couldn't encrypt the PDF. Try a different password or a simpler document.";
    }
    if (
      /invalid pdf|failed to parse|No PDF header|FormatError|corrupt/i.test(
        message,
      )
    ) {
      return CORRUPT_PDF;
    }
    if (KNOWN.has(message)) return message;
  }
  return GENERIC_FAIL;
}
