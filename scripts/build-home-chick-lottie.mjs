import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const frameDirectory = join(root, "assets-source/ip/home-chick-frames");
const outputPath = join(root, "public/illustrations/ip/v2/home-chick.json");
const frameRanges = [[0, 8], [8, 11], [11, 14], [14, 16], [16, 19], [19, 22], [22, 30], [30, 72]];

const assets = await Promise.all(frameRanges.map(async (_, index) => {
  const name = `frame-${String(index + 1).padStart(2, "0")}.png`;
  const data = await readFile(join(frameDirectory, name));
  return { id: `image_${index}`, w: 256, h: 256, u: "", p: `data:image/png;base64,${data.toString("base64")}`, e: 1 };
}));

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
      p: { a: 0, k: [128, 128, 0] },
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
console.log(`Wrote ${outputPath}`);
