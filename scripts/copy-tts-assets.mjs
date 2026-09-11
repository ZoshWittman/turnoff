import { mkdir, copyFile, access } from "node:fs/promises";
import { createWriteStream } from "node:fs";
import path from "node:path";
import { pipeline } from "node:stream/promises";
import { Readable } from "node:stream";

const ROOT = process.cwd();
const ORT_SRC = path.join(ROOT, "node_modules", "onnxruntime-web", "dist");
const ORT_DEST = path.join(ROOT, "public", "ort");
const PIPER_DEST = path.join(ROOT, "public", "piper");
const PIPER_BASE = "https://cdn.jsdelivr.net/npm/@diffusionstudio/piper-wasm@1.0.0/build/piper_phonemize";

const ORT_FILES = [
  "ort-wasm.wasm",
  "ort-wasm-simd.wasm",
];

async function exists(file) {
  try {
    await access(file);
    return true;
  } catch {
    return false;
  }
}

async function download(url, dest) {
  if (await exists(dest)) return;
  const res = await fetch(url);
  if (!res.ok || !res.body) {
    throw new Error(`download failed ${res.status}`);
  }
  await pipeline(Readable.fromWeb(res.body), createWriteStream(dest));
}

async function main() {
  await mkdir(ORT_DEST, { recursive: true });
  await mkdir(PIPER_DEST, { recursive: true });
  for (const file of ORT_FILES) {
    const src = path.join(ORT_SRC, file);
    if (await exists(src)) {
      await copyFile(src, path.join(ORT_DEST, file));
    }
  }
  await download(`${PIPER_BASE}.wasm`, path.join(PIPER_DEST, "piper_phonemize.wasm"));
  await download(`${PIPER_BASE}.data`, path.join(PIPER_DEST, "piper_phonemize.data"));
}

main().catch((error) => {
  console.error("[WonderFact TTS] failed to copy local WASM assets", error instanceof Error ? error.name : "Error");
  process.exit(1);
});
