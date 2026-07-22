import fs from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const root = process.cwd();
const sourceDir = path.join(root, "assets-source/profile/v1/master");
const outputDir = path.join(root, "public/illustrations/profile/v1");
const previewPath = path.join(root, "work/profile-assets-preview.png");

const assetIds = [
  "age-default", "age-04-06", "age-07-08", "age-09-10", "age-11-12", "age-13-18", "age-19-36",
  "avoid-unanswered", "avoid-none", "avoid-has-items",
  "texture-puree", "texture-thick-puree", "texture-soft-lumps", "texture-finger-food",
];

async function buildAsset(assetId) {
  const source = path.join(sourceDir, `${assetId}.png`);
  const isTexture = assetId.startsWith("texture-");
  const large = isTexture ? 320 : 640;
  const small = isTexture ? 160 : 320;
  const contentSize = Math.round(large * .9);
  const insetStart = Math.floor((large - contentSize) / 2);
  const insetEnd = large - contentSize - insetStart;
  const master = await sharp(source)
    .trim({ background: { r: 0, g: 0, b: 0, alpha: 0 }, threshold: 2 })
    .resize(contentSize, contentSize, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 }, kernel: sharp.kernel.lanczos3 })
    .extend({ top: insetStart, bottom: insetEnd, left: insetStart, right: insetEnd, background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png({ compressionLevel: 9, adaptiveFiltering: true })
    .toBuffer();

  await sharp(master).toFile(path.join(outputDir, `${assetId}-${large}.png`));
  await sharp(master).webp({ quality: 91, alphaQuality: 100, smartSubsample: true }).toFile(path.join(outputDir, `${assetId}-${large}.webp`));
  await sharp(master).resize(small, small, { kernel: sharp.kernel.lanczos3 }).webp({ quality: 90, alphaQuality: 100, smartSubsample: true }).toFile(path.join(outputDir, `${assetId}-${small}.webp`));
  return path.join(outputDir, `${assetId}-${large}.webp`);
}

await fs.mkdir(outputDir, { recursive: true });
await fs.mkdir(path.dirname(previewPath), { recursive: true });
const previews = [];
for (const assetId of assetIds) previews.push(await buildAsset(assetId));

const tile = 176;
const columns = 4;
const rows = Math.ceil(assetIds.length / columns);
await sharp({
  create: { width: tile * columns, height: tile * rows, channels: 4, background: "#f8f4ec" },
}).composite(await Promise.all(previews.map(async (input, index) => ({
  input: await sharp(input).resize(150, 150, { fit: "contain" }).toBuffer(),
  left: (index % columns) * tile + 13,
  top: Math.floor(index / columns) * tile + 13,
})))).png().toFile(previewPath);

console.log(`Built ${assetIds.length} profile illustrations in ${path.relative(root, outputDir)}`);
console.log(`Preview: ${path.relative(root, previewPath)}`);
