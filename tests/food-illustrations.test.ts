import fs from "node:fs/promises";
import sharp from "sharp";
import { describe, expect, it } from "vitest";
import { foodIds } from "../app/food-illustrations";

describe("食物地图透明资源", () => {
  it("15 种食物都有 WebP 多尺寸和 PNG 降级资源", async () => {
    expect(foodIds).toHaveLength(15);
    for (const foodId of foodIds) {
      for (const suffix of ["96.webp", "192.webp", "192.png"]) {
        await expect(fs.access(`public/illustrations/foods/v1/${foodId}-${suffix}`)).resolves.toBeUndefined();
      }
    }
  });

  it("透明食物四边都有安全留白，不会贴边截断", async () => {
    for (const foodId of foodIds) {
      const { data, info } = await sharp(`public/illustrations/foods/v1/${foodId}-192.png`).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
      const edgeAlpha = [];
      for (let x = 0; x < info.width; x += 1) {
        edgeAlpha.push(data[x * 4 + 3], data[((info.height - 1) * info.width + x) * 4 + 3]);
      }
      for (let y = 0; y < info.height; y += 1) {
        edgeAlpha.push(data[(y * info.width) * 4 + 3], data[(y * info.width + info.width - 1) * 4 + 3]);
      }
      expect(Math.max(...edgeAlpha), `${foodId} 存在贴边像素`).toBe(0);
    }
  });
});
