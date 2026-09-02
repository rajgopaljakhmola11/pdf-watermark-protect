# PDF watermark and protect

Client-only SPA: add a text or image watermark, then password-encrypt the PDF with AES-128 or AES-256. The file and passwords never leave the device. There is no backend, no analytics, and no third-party scripts.

## QPDF package

**Chosen package:** `qpdf-run` **0.2.1**

Verified on disk after install (`node_modules/qpdf-run`):

- Public API: `createQpdfRunner` (and `createBrowserQpdfRunner`) from `qpdf-run`
- Types: `QpdfRunner`, `QpdfRunOneOptions`, `QpdfRunResult`, `QpdfRunError`
- Methods used: `createQpdfRunner({ workerUrl, qpdfJsUrl, wasmUrl, timeoutMs, env: "browser" })`, then `runner.runOne({ input, inputName, outputName, args })`
- Bundler-safe exports used:
  - `qpdf-run/worker` to classic worker (`src/worker.js`)
  - `qpdf-run/qpdf.js` Emscripten runtime
  - `qpdf-run/qpdf.wasm` WASM binary
- Encryption uses real qpdf CLI args, for example AES-256 with `--print=n --modify=none --extract=n --accessibility=y`. AES-128 adds `--use-aes=y` and key length `128`.
- WASM is lazy-loaded on the first Protect (the qpdf-run worker is created then).

`pdfstudio` was not required. `@neslinesli93/qpdf-wasm` was not needed. `@jspawn/qpdf-wasm` was avoided.

## COOP / COEP

**Not set.** Vendored `qpdf.js` has no pthread / SharedArrayBuffer usage. The WASM runs in a dedicated worker with standard `WebAssembly.instantiateStreaming`. Cross-origin isolation headers are unnecessary and would only restrict embedding.

## Pipeline

1. `pdf-lib` loads the PDF, draws the watermark, `save()` to `Uint8Array`
2. That `Uint8Array` is passed to qpdf-run which applies AES encryption and permission flags

Never encrypt first and then watermark. pdf-lib has no encryption API.

All CPU work runs in Web Workers (pdf-lib in `src/workers/pdfProcessor.worker.ts`; qpdf in qpdf-run's own worker). ArrayBuffers are transferred, not copied, for the PDF payload.

## Local development

Install dependencies, then use the Vite `dev`, `preview`, and `build` scripts in package.json. Typecheck with `npx tsc --noEmit`.

## Deploy

(a) Create `dist/` with the package `build` script, then drag that folder onto Netlify Drop.
(b) Connect GitHub to Netlify. Build command is the package `build` script. Publish directory: `dist`. `netlify.toml` sets SPA fallback to `/index.html` (200) and WASM Content-Type.

Vite base is `/`.

## Privacy

No server, no file uploads, no localStorage/IndexedDB, passwords and PDF bytes are never logged. Accessibility is always enabled.

## Manual test checklist

- Text watermark on all pages
- Image watermark, tiled and rotated
- Behind-content layer
- Custom range 1-3, 5
- AES-256 with printing disabled
- Adobe Reader password prompt, then watermark visible

## Stack

Vite, React 18, TypeScript strict, Tailwind CSS v4, pdfjs-dist (code-split worker), pdf-lib, qpdf-run.
