import { copyFileSync, existsSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const src = join(root, "node_modules/kokoro-js/dist/kokoro.web.js");
const destDir = join(root, "public/tts");
const dest = join(destDir, "kokoro.web.js");

mkdirSync(destDir, { recursive: true });
if (!existsSync(src)) {
  console.warn("kokoro-js is not installed; skipping neural TTS bundle copy.");
  process.exit(0);
}
copyFileSync(src, dest);
console.log("Copied Kokoro web bundle to public/tts/kokoro.web.js");
