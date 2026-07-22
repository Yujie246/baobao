import fs from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const root = process.cwd();
const sourcePath = path.join(root, "assets-source/food-map/food-friends-sheet.png");
const outputDir = path.join(root, "public/illustrations/foods/v1");
const previewPath = path.join(root, "work/food-assets-preview.png");

const foods = [
  { id: "avocado", box: [10, 215, 230, 330], erase: [[170, 0, 60, 145]] },
  { id: "carrot", box: [220, 205, 210, 340], erase: [[188, 120, 22, 78]] },
  { id: "banana", box: [420, 215, 210, 330] },
  { id: "broccoli", box: [630, 215, 210, 330] },
  { id: "pumpkin", box: [825, 225, 220, 320] },
  { id: "sweet-potato", box: [10, 610, 205, 300] },
  { id: "apple", box: [210, 620, 210, 290] },
  { id: "pear", box: [420, 610, 210, 300] },
  { id: "corn", box: [630, 600, 210, 310], erase: [[184, 48, 26, 176]] },
  { id: "egg", box: [825, 615, 220, 295], threshold: 25 },
  { id: "salmon", box: [10, 975, 205, 300] },
  { id: "tofu", box: [210, 990, 210, 285], threshold: 25 },
  { id: "spinach", box: [420, 955, 210, 320], erase: [[0, 0, 210, 24]] },
  { id: "potato", box: [630, 985, 210, 290] },
  { id: "millet-porridge", box: [825, 1010, 220, 265], threshold: 30 },
];

function distance(r, g, b, background) {
  const dr = r - background[0];
  const dg = g - background[1];
  const db = b - background[2];
  return Math.sqrt(dr * dr * .8 + dg * dg + db * db * .7);
}

function sampleBackground(data, width, height) {
  const samples = [];
  const size = 12;
  for (const [ox, oy] of [[0, 0], [width - size, 0], [0, height - size], [width - size, height - size]]) {
    for (let y = oy; y < oy + size; y += 1) for (let x = ox; x < ox + size; x += 1) {
      const offset = (y * width + x) * 4;
      samples.push([data[offset], data[offset + 1], data[offset + 2]]);
    }
  }
  return [0, 1, 2].map((channel) => {
    const values = samples.map((sample) => sample[channel]).sort((a, b) => a - b);
    return values[Math.floor(values.length / 2)];
  });
}

function removeConnectedBackground(data, width, height, threshold) {
  const background = sampleBackground(data, width, height);
  const count = width * height;
  const visited = new Uint8Array(count);
  const queue = new Int32Array(count);
  let head = 0;
  let tail = 0;
  const enqueue = (index) => {
    if (visited[index]) return;
    const offset = index * 4;
    if (distance(data[offset], data[offset + 1], data[offset + 2], background) > threshold) return;
    visited[index] = 1;
    queue[tail++] = index;
  };
  for (let x = 0; x < width; x += 1) { enqueue(x); enqueue((height - 1) * width + x); }
  for (let y = 1; y < height - 1; y += 1) { enqueue(y * width); enqueue(y * width + width - 1); }
  while (head < tail) {
    const index = queue[head++];
    const x = index % width;
    const y = Math.floor(index / width);
    if (x) enqueue(index - 1);
    if (x + 1 < width) enqueue(index + 1);
    if (y) enqueue(index - width);
    if (y + 1 < height) enqueue(index + width);
  }
  for (let index = 0; index < count; index += 1) {
    if (!visited[index]) continue;
    const offset = index * 4;
    const d = distance(data[offset], data[offset + 1], data[offset + 2], background);
    const matte = Math.max(0, Math.min(1, (d - 6) / Math.max(1, threshold - 6)));
    data[offset + 3] = Math.round(255 * matte * matte);
  }
}

function removeSmallFragments(data, width, height, minimumPixels = 180) {
  const count = width * height;
  const visited = new Uint8Array(count);
  const queue = new Int32Array(count);
  for (let start = 0; start < count; start += 1) {
    if (visited[start] || data[start * 4 + 3] < 10) continue;
    let head = 0;
    let tail = 0;
    visited[start] = 1;
    queue[tail++] = start;
    while (head < tail) {
      const index = queue[head++];
      const x = index % width;
      const y = Math.floor(index / width);
      for (const next of [x ? index - 1 : -1, x + 1 < width ? index + 1 : -1, y ? index - width : -1, y + 1 < height ? index + width : -1]) {
        if (next < 0 || visited[next] || data[next * 4 + 3] < 10) continue;
        visited[next] = 1;
        queue[tail++] = next;
      }
    }
    if (tail >= minimumPixels) continue;
    for (let i = 0; i < tail; i += 1) data[queue[i] * 4 + 3] = 0;
  }
}

function eraseDecorations(data, width, rects = []) {
  for (const [left, top, rectWidth, rectHeight] of rects) {
    for (let y = top; y < top + rectHeight; y += 1) for (let x = left; x < left + rectWidth; x += 1) {
      if (x >= 0 && x < width && y >= 0) data[(y * width + x) * 4 + 3] = 0;
    }
  }
}

function alphaBounds(data, width, height) {
  let minX = width; let minY = height; let maxX = -1; let maxY = -1;
  for (let y = 0; y < height; y += 1) for (let x = 0; x < width; x += 1) {
    if (data[(y * width + x) * 4 + 3] < 10) continue;
    minX = Math.min(minX, x); minY = Math.min(minY, y); maxX = Math.max(maxX, x); maxY = Math.max(maxY, y);
  }
  if (maxX < minX) throw new Error("No foreground found");
  const p = 5;
  const left = Math.max(0, minX - p);
  const top = Math.max(0, minY - p);
  return { left, top, width: Math.min(width - left, maxX - minX + 1 + p * 2), height: Math.min(height - top, maxY - minY + 1 + p * 2) };
}

async function buildFood(food) {
  const [left, top, width, height] = food.box;
  const { data, info } = await sharp(sourcePath).extract({ left, top, width, height }).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const mutable = Buffer.from(data);
  removeConnectedBackground(mutable, info.width, info.height, food.threshold ?? 56);
  removeSmallFragments(mutable, info.width, info.height);
  eraseDecorations(mutable, info.width, food.erase);
  const bounds = alphaBounds(mutable, info.width, info.height);
  const master = await sharp(mutable, { raw: { width: info.width, height: info.height, channels: 4 } })
    .extract(bounds).resize(192, 192, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toBuffer();
  await sharp(master).png({ compressionLevel: 9, adaptiveFiltering: true }).toFile(path.join(outputDir, `${food.id}-192.png`));
  await sharp(master).webp({ quality: 91, alphaQuality: 100 }).toFile(path.join(outputDir, `${food.id}-192.webp`));
  await sharp(master).resize(96, 96).webp({ quality: 90, alphaQuality: 100 }).toFile(path.join(outputDir, `${food.id}-96.webp`));
  return path.join(outputDir, `${food.id}-192.webp`);
}

await fs.mkdir(outputDir, { recursive: true });
await fs.mkdir(path.dirname(previewPath), { recursive: true });
const built = [];
for (const food of foods) built.push(await buildFood(food));
const tile = 180;
await sharp({ create: { width: tile * 5, height: tile * 3, channels: 4, background: "#f8f4ec" } })
  .composite(await Promise.all(built.map(async (input, index) => ({ input: await sharp(input).resize(150, 150, { fit: "contain" }).toBuffer(), left: (index % 5) * tile + 15, top: Math.floor(index / 5) * tile + 15 }))))
  .png().toFile(previewPath);
console.log(`Built ${built.length} food assets in ${path.relative(root, outputDir)}`);
console.log(`Preview: ${path.relative(root, previewPath)}`);
