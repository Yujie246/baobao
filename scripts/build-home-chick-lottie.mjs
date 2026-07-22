import { copyFile, mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const frameDirectory = join(root, "assets-source/ip/home-chick-frames");
const outputPath = join(root, "public/illustrations/ip/v2/home-chick.json");
const posterPath = join(root, "public/illustrations/ip/v2/home-chick-poster.png");
const frameRanges = [[0, 8], [8, 11], [11, 14], [14, 16], [16, 19], [19, 22], [22, 30], [30, 72]];

const frames = await Promise.all(frameRanges.map(async (_, index) => {
  const name = `frame-${String(index + 1).padStart(2, "0")}.png`;
  const data = await readFile(join(frameDirectory, name));
  const { data: pixels, info } = await sharp(data).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  let weightedX = 0;
  let weight = 0;
  let bottom = 0;
  for (let y = Math.round(info.height * .5); y < info.height; y += 1) {
    for (let x = Math.round(info.width * .1); x < Math.round(info.width * .9); x += 1) {
      const alpha = pixels[(y * info.width + x) * 4 + 3];
      if (alpha <= 8) continue;
      weightedX += x * alpha;
      weight += alpha;
      bottom = Math.max(bottom, y);
    }
  }
  return { data, anchorX: weight ? weightedX / weight : info.width / 2, bottom };
}));

const referenceAnchor = frames[0];
const assets = frames.map((frame, index) => ({ id: `image_${index}`, w: 256, h: 256, u: "", p: `data:image/png;base64,${frame.data.toString("base64")}`, e: 1 }));

const layers = frameRanges.map(([ip, op], index) => {
  const opacityFrames = [];
  if (ip > 0) opacityFrames.push({ t: 0, s: [0], h: 1 });
  opacityFrames.push({ t: ip, s: [100], h: 1 });
  opacityFrames.push({ t: op, s: [0], h: 1 });

  return {
    ddd: 0,
    ind: index + 1,
    ty: 2,
    nm: `home-chick-frame-${index + 1}`,
    refId: `image_${index}`,
    sr: 1,
    ks: {
      o: { a: 1, k: opacityFrames },
      r: { a: 0, k: 0 },
      p: { a: 0, k: [128 + referenceAnchor.anchorX - frames[index].anchorX, 128 + referenceAnchor.bottom - frames[index].bottom, 0] },
      a: { a: 0, k: [128, 128, 0] },
      s: { a: 0, k: [100, 100, 100] },
    },
    ao: 0,
    ip: 0,
    op: 72,
    st: 0,
    bm: 0,
  };
});

const animation = {
  v: "5.12.2",
  fr: 12,
  ip: 0,
  op: 72,
  w: 256,
  h: 256,
  nm: "宝宝饱饱首页招手小鸡",
  ddd: 0,
  assets,
  layers,
  markers: [
    { tm: 0, cm: "idle", dr: 72 },
    { tm: 8, cm: "wave", dr: 14 },
    { tm: 14, cm: "blink", dr: 2 },
  ],
};

await mkdir(dirname(outputPath), { recursive: true });
await writeFile(outputPath, `${JSON.stringify(animation)}\n`);
await copyFile(join(frameDirectory, "frame-01.png"), posterPath);
console.log(`Wrote ${outputPath} and ${posterPath}`);
