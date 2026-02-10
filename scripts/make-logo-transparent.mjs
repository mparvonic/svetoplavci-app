/**
 * Nastaví černým pixelům v PNG loga průhlednost (alpha = 0).
 * Spustit: node scripts/make-logo-transparent.mjs
 */
import sharp from "sharp";
import { readFileSync, writeFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const inputPath = join(root, "public", "svetoplavci_logo.png");
const outputPath = join(root, "public", "svetoplavci_logo.png");

// Prah: pixely s R,G,B pod touto hodnotou budou průhledné (černé pozadí)
const BLACK_THRESHOLD = 45;

async function main() {
  const image = sharp(inputPath);
  const { data, info } = await image
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const { width, height, channels } = info;
  const newData = Buffer.from(data);

  for (let i = 0; i < newData.length; i += channels) {
    const r = newData[i];
    const g = newData[i + 1];
    const b = newData[i + 2];
    if (r <= BLACK_THRESHOLD && g <= BLACK_THRESHOLD && b <= BLACK_THRESHOLD) {
      newData[i + 3] = 0; // alpha = 0 (průhledné)
    }
  }

  await sharp(newData, {
    raw: { width, height, channels: 4 },
  })
    .png()
    .toFile(outputPath);

  console.log("Hotovo: černé pozadí nastaveno na průhledné v", outputPath);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
