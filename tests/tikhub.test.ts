import { afterEach, describe, expect, it, vi } from "vitest";
import { extractTikHubVideoUrl, isTikHubPlatformUrl, resolveSubmittedVideo } from "../app/analysis/server/tikhub";

describe("TikHub 分享链接解析", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    delete process.env.TIKHUB_API_KEY;
  });

  it("识别抖音和 TikTok 分享链接，保留普通视频直链", async () => {
    expect(isTikHubPlatformUrl("https://v.douyin.com/abc/")).toBe(true);
    expect(isTikHubPlatformUrl("https://www.tiktok.com/@cook/video/1")).toBe(true);
    await expect(resolveSubmittedVideo("看看这个 https://cdn.example.com/meal.mp4 好吃")).resolves.toMatchObject({ url: "https://cdn.example.com/meal.mp4" });
  });

  it("从常见 TikHub 数据结构中优先选择播放地址", () => {
    const data = {
      aweme_detail: {
        video: {
          cover: { url_list: ["https://cdn.example.com/cover.jpg"] },
          play_addr: { url_list: ["https://cdn.example.com/video.mp4"] },
        },
      },
    };
    expect(extractTikHubVideoUrl(data)).toBe("https://cdn.example.com/video.mp4");
  });

  it("服务端调用抖音 App V3 并返回临时视频地址", async () => {
    process.env.TIKHUB_API_KEY = "test-key";
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({
      code: 200,
      data: { video: { play_addr: { url_list: ["https://cdn.example.com/resolved.mp4"] } } },
    }), { status: 200, headers: { "Content-Type": "application/json" } })));
    await expect(resolveSubmittedVideo("7.12 复制打开抖音 https://v.douyin.com/abc/ 看视频"))
      .resolves.toMatchObject({ url: "https://cdn.example.com/resolved.mp4", originalUrl: "https://v.douyin.com/abc/" });
    expect(fetch).toHaveBeenCalledWith(expect.objectContaining({ pathname: "/api/v1/douyin/app/v3/fetch_one_video_by_share_url" }), expect.objectContaining({
      headers: expect.objectContaining({ Authorization: "Bearer test-key" }),
    }));
  });

  it("缺少密钥时给出可操作错误", async () => {
    await expect(resolveSubmittedVideo("https://v.douyin.com/abc/"))
      .rejects.toThrow("未配置 TIKHUB_API_KEY");
  });
});
