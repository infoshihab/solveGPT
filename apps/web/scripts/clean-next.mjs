import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const nextDir = path.join(root, ".next");
try {
  fs.rmSync(nextDir, { recursive: true, force: true });
  console.log("[web] removed .next for a clean dev build");
} catch {
  /* ignore */
}
