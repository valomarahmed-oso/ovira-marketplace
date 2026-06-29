import sharp from "sharp";
import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "..");
const logo = join(root, "..", "ovira-clean.png");
const out = join(root, "public", "icons");
mkdirSync(out, { recursive: true });

const targets = [
  { name: "icon-192.png", size: 192 },
  { name: "icon-512.png", size: 512 },
  { name: "icon-maskable-512.png", size: 512 },
  { name: "apple-touch-icon.png", size: 180 },
];

for (const t of targets) {
  await sharp(logo).resize(t.size, t.size, { fit: "cover" }).png().toFile(join(out, t.name));
  console.log("generated", t.name);
}
