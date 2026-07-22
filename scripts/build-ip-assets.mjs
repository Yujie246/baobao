import fs from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const root = process.cwd();
const sourcePath = path.join(root, "assets-source/ip/character-sheet.png");
const outputDir = path.join(root, "public/illustrations/ip/v1");
const previewPath = path.join(root, "work/ip-assets-preview.png");

const poses = [
  { id: "neutral", box: [24, 210, 230, 310] },
  { id: "welcome", box: [267, 210, 258, 310] },
  { id: "link", box: [535, 210, 250, 310] },
  { id: "inspect", box: [785, 210, 250, 310] },
  { id: "plan", box: [22, 585, 238, 325] },
  { id: "explore", box: [270, 585, 258, 325] },
  { id: "confirm", box: [530, 570, 260, 340] },
  { id: "question", box: [790, 575, 255, 335] },
  { id: "paused", box: [20, 975, 245, 320] },
  { id: "prepare", box: [265, 975, 265, 320], protectHat: true },
  { id: "mix", box: [525, 975, 255, 320], protectHat: true },
  { id: "serve", box: [795, 975, 250, 320], protectHat: true },
];

function colorDistance(r, g, b, background) {
  const dr = r - background[0];
  const dg = g - background[1];
  const db = b - background[2];
  return Math.sqrt(dr * dr * 0.8 + dg * dg + db * db * 0.7);
}

function sampleBackground(data, width, height) {
  const samples = [];
  const size = Math.min(14, Math.floor(Math.min(width, height) / 8));
  for (const [originX, originY] of [[0, 0], [width - size, 0], [0, height - size], [width - size, height - size]]) {
    for (let y = originY; y < originY + size; y += 1) {
      for (let x = originX; x < originX + size; x += 1) {
        const offset = (y * width + x) * 4;
        samples.push([data[offset], data[offset + 1], data[offset + 2]]);
      }
    }
  }
  return [0, 1, 2].map((channel) => {
    const values = samples.map((sample) => sample[channel]).sort((a, b) => a - b);
    return values[Math.floor(values.length / 2)];
  });
}

function removeConnectedBackground(data, width, height, threshold = 58) {
  const background = sampleBackground(data, width, height);
  const count = width * height;
  const visited = new Uint8Array(count);
  const queue = new Int32Array(count);
  let head = 0;
  let tail = 0;

  const canVisit = (index) => {
    if (visited[index]) return false;
    const offset = index * 4;
    return colorDistance(data[offset], data[offset + 1], data[offset + 2], background) <= threshold;
  };
  const enqueue = (index) => {
    if (!canVisit(index)) return;
    visited[index] = 1;
    queue[tail++] = index;
  };

  for (let x = 0; x < width; x += 1) {
    enqueue(x);
    enqueue((height - 1) * width + x);
  }
  for (let y = 1; y < height - 1; y += 1) {
    enqueue(y * width);
    enqueue(y * width + width - 1);
  }

  while (head < tail) {
    const index = queue[head++];
    const x = index % width;
    const y = Math.floor(index / width);
    if (x > 0) enqueue(index - 1);
    if (x + 1 < width) enqueue(index + 1);
    if (y > 0) enqueue(index - width);
    if (y + 1 < height) enqueue(index + width);
  }

  for (let index = 0; index < count; index += 1) {
    if (!visited[index]) continue;
    const offset = index * 4;
    const distance = colorDistance(data[offset], data[offset + 1], data[offset + 2], background);
    const matte = Math.max(0, Math.min(1, (distance - 7) / (threshold - 7)));
    data[offset + 3] = Math.round(255 * matte * matte);
  }
  return background;
}

function alphaBounds(data, width, height) {
  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      if (data[(y * width + x) * 4 + 3] < 10) continue;
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
    }
  }
  if (maxX < minX || maxY < minY) throw new Error("No foreground pixels found");
  const padding = 5;
  return {
    left: Math.max(0, minX - padding),
    top: Math.max(0, minY - padding),
    width: Math.min(width - Math.max(0, minX - padding), maxX - minX + 1 + padding * 2),
    height: Math.min(height - Math.max(0, minY - padding), maxY - minY + 1 + padding * 2),
  };
}

async function buildPose(pose) {
  const [left, top, width, height] = pose.box;
  const { data, info } = await sharp(sourcePath)
    .extract({ left, top, width, height })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const mutable = Buffer.from(data);
  const background = removeConnectedBackground(
    mutable,
    info.width,
    info.height,
    pose.protectHat ? 24 : 58,
  );
  const bounds = alphaBounds(mutable, info.width, info.height);
  const transparent = await sharp(mutable, { raw: { width: info.width, height: info.height, channels: 4 } })
    .extract(bounds)
    .resize(320, 320, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 }, kernel: sharp.kernel.lanczos3 })
    .png()
    .toBuffer();

  const masterPath = path.join(outputDir, `${pose.id}-320.png`);
  const webp320Path = path.join(outputDir, `${pose.id}-320.webp`);
  const webp160Path = path.join(outputDir, `${pose.id}-160.webp`);
  await sharp(transparent).png({ compressionLevel: 9, adaptiveFiltering: true }).toFile(masterPath);
  await sharp(transparent).webp({ quality: 91, alphaQuality: 100, smartSubsample: true }).toFile(webp320Path);
  await sharp(transparent).resize(160, 160, { kernel: sharp.kernel.lanczos3 }).webp({ quality: 90, alphaQuality: 100, smartSubsample: true }).toFile(webp160Path);
  return { id: pose.id, background, preview: webp320Path };
}

await fs.mkdir(outputDir, { recursive: true });
await fs.mkdir(path.dirname(previewPath), { recursive: true });
const built = [];
for (const pose of poses) built.push(await buildPose(pose));

const tile = 220;
await sharp({
  create: { width: tile * 4, height: tile * 3, channels: 4, background: "#f8f4ec" },
}).composite(await Promise.all(built.map(async (item, index) => ({
  input: await sharp(item.preview).resize(190, 190, { fit: "contain" }).toBuffer(),
  left: (index % 4) * tile + 15,
  top: Math.floor(index / 4) * tile + 15,
})))).png().toFile(previewPath);

console.log(`Built ${built.length} poses in ${path.relative(root, outputDir)}`);
console.log(`Preview: ${path.relative(root, previewPath)}`);
