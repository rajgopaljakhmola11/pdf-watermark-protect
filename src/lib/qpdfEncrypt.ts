import { createQpdfRunner, type QpdfRunner } from "qpdf-run";
import { WASM_LOAD_FAIL } from "./errors";
import { generateOwnerPassword } from "./password";
import type { EncryptSettings, QpdfAssetUrls } from "../types";

let runnerPromise: Promise<QpdfRunner> | null = null;

export function encryptWithQpdfArgs(
  userPassword: string,
  ownerPassword: string,
  aesBits: 128 | 256,
  allowPrinting: boolean,
  allowCopying: boolean,
  allowEditing: boolean,
): string[] {
  const args = [
    "--encrypt",
    userPassword,
    ownerPassword,
    String(aesBits),
  ];
  if (aesBits === 128) {
    args.push("--use-aes=y");
  }
  args.push(
    allowPrinting ? "--print=full" : "--print=n",
    allowEditing ? "--modify=all" : "--modify=none",
    allowCopying ? "--extract=y" : "--extract=n",
    "--accessibility=y",
    "--",
    "input.pdf",
    "output.pdf",
  );
  return args;
}

export async function getQpdfRunner(urls: QpdfAssetUrls): Promise<QpdfRunner> {
  if (!runnerPromise) {
    runnerPromise = createQpdfRunner({
      workerUrl: urls.workerUrl,
      qpdfJsUrl: urls.qpdfJsUrl,
      wasmUrl: urls.wasmUrl,
      timeoutMs: 180000,
      env: "browser",
    }).catch((error: unknown) => {
      runnerPromise = null;
      const wrapped = new Error(WASM_LOAD_FAIL);
      wrapped.cause = error;
      throw wrapped;
    });
  }
  return runnerPromise;
}

export async function encryptPdf(
  watermarked: Uint8Array,
  settings: EncryptSettings,
  urls: QpdfAssetUrls,
): Promise<Uint8Array> {
  const owner =
    settings.ownerPassword.trim() === ""
      ? generateOwnerPassword()
      : settings.ownerPassword;
  const qpdf = await getQpdfRunner(urls);
  const output = await qpdf.runOne({
    input: watermarked,
    inputName: "input.pdf",
    outputName: "output.pdf",
    args: encryptWithQpdfArgs(
      settings.userPassword,
      owner,
      settings.aesBits,
      settings.allowPrinting,
      settings.allowCopying,
      settings.allowEditing,
    ),
  });
  return output;
}
