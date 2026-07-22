import fs from "node:fs/promises";
import sharp from "sharp";
import { describe, expect, it } from "vitest";
import {
  profileAssetIds,
  resolveAgeProfileAsset,
  resolveAvoidProfileAsset,
  resolveTextureProfileAsset,
} from "../app/profile-illustrations";

describe("三步建档 IP 形象", () => {
  it("月龄只映射成长区间，不推断进食能力", () => {
    expect(resolveAgeProfileAsset()).toBe("age-default");
    expect(resolveAgeProfileAsset(3)).toBe("age-default");
    expect(resolveAgeProfileAsset(4)).toBe("age-04-06");
    expect(resolveAgeProfileAsset(6)).toBe("age-04-06");
    expect(resolveAgeProfileAsset(7)).toBe("age-07-08");
    expect(resolveAgeProfileAsset(10)).toBe("age-09-10");
    expect(resolveAgeProfileAsset(12)).toBe("age-11-12");
    expect(resolveAgeProfileAsset(18)).toBe("age-13-18");
    expect(resolveAgeProfileAsset(36)).toBe("age-19-36");
    expect(resolveAgeProfileAsset(37)).toBe("age-default");
  });

  it("忌口和质地状态使用受限映射", () => {
    expect(resolveAvoidProfileAsset("unanswered")).toBe("avoid-unanswered");
    expect(resolveAvoidProfileAsset("none")).toBe("avoid-none");
    expect(resolveAvoidProfileAsset("has")).toBe("avoid-has-items");
    expect(resolveTextureProfileAsset("puree")).toBe("texture-puree");
    expect(resolveTextureProfileAsset("finger-food")).toBe("texture-finger-food");
  });

  it("14 张素材都有多尺寸 WebP 和 PNG 降级，并保留透明安全边距", async () => {
    expect(profileAssetIds).toHaveLength(14);
    for (const assetId of profileAssetIds) {
      const texture = assetId.startsWith("texture-");
      const sizes = texture ? ["160.webp", "320.webp", "320.png"] : ["320.webp", "640.webp", "640.png"];
      for (const suffix of sizes) {
        await expect(fs.access(`public/illustrations/profile/v1/${assetId}-${suffix}`)).resolves.toBeUndefined();
      }

      const png = `public/illustrations/profile/v1/${assetId}-${texture ? 320 : 640}.png`;
      const { data, info } = await sharp(png).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
      const edgeAlpha = [];
      for (let x = 0; x < info.width; x += 1) edgeAlpha.push(data[x * 4 + 3], data[((info.height - 1) * info.width + x) * 4 + 3]);
      for (let y = 0; y < info.height; y += 1) edgeAlpha.push(data[(y * info.width) * 4 + 3], data[(y * info.width + info.width - 1) * 4 + 3]);
      expect(Math.max(...edgeAlpha), `${assetId} 存在贴边像素`).toBe(0);
    }
  });

  it("七个月龄形象按透明内容边界归一化为一致视觉体量", async () => {
    const ageAssets = profileAssetIds.filter((assetId) => assetId.startsWith("age-"));
    const visualSpans = [];
    for (const assetId of ageAssets) {
      const { data, info } = await sharp(`public/illustrations/profile/v1/${assetId}-640.png`).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
      let minX = info.width;
      let minY = info.height;
      let maxX = -1;
      let maxY = -1;
      for (let y = 0; y < info.height; y += 1) {
        for (let x = 0; x < info.width; x += 1) {
          if (data[(y * info.width + x) * 4 + 3] < 10) continue;
          minX = Math.min(minX, x);
          minY = Math.min(minY, y);
          maxX = Math.max(maxX, x);
          maxY = Math.max(maxY, y);
        }
      }
      visualSpans.push(Math.max(maxX - minX + 1, maxY - minY + 1));
    }
    expect(Math.max(...visualSpans) - Math.min(...visualSpans)).toBeLessThanOrEqual(2);
  });

  it("三步标题不再显示额外引导短句", async () => {
    const source = await fs.readFile("app/BabyBaoApp.tsx", "utf8");
    expect(source).not.toContain("先确认基础月龄");
    expect(source).not.toContain("会直接影响适配结论");
    expect(source).not.toContain("按真实表现来选");
  });
});
