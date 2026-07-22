import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function render(path = "/") {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}-${path}`);
  const { default: worker } = await import(workerUrl.href);
  return worker.fetch(
    new Request(`http://localhost${path}`, { headers: { accept: "text/html" } }),
    { ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) } },
    { waitUntil() {}, passThroughOnException() {} },
  );
}

test("首页能由生产 Worker 正常渲染", async () => {
  const response = await render("/");
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);
  const html = await response.text();
  assert.match(html, /<title>宝宝饱饱｜把辅食视频变成宝宝专属步骤<\/title>/);
  assert.match(html, /宝宝饱饱/);
  assert.match(html, /宝宝饱饱正在加载/);
  assert.match(html, /skeleton-screen/);
  assert.doesNotMatch(html, /codex-preview|Your site is taking shape|react-loading-skeleton/i);
});

test("浏览器直接刷新深层路由不会返回 404", async () => {
  for (const path of ["/home", "/plan", "/plan/week", "/food-map", "/food-map/shrimp", "/result/adapted", "/cook/shrimp-noodle-demo/session", "/cook/shrimp-noodle-demo/step/3", "/baby/foods"]) {
    const response = await render(path);
    assert.equal(response.status, 200, path);
  }
});

test("实现包含完整页面闭环和统一 Mock 边界", async () => {
  const [app, gateway, fixtures, tts, ttsRoute, importValidation, homeCharacter, homeCharacterJson] = await Promise.all([
    readFile(new URL("../app/BabyBaoApp.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/ai-gateway.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/mock-data.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/tts-gateway.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/tts/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/import-validation.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/home-character-animation.tsx", import.meta.url), "utf8"),
    readFile(new URL("../public/illustrations/ip/v2/home-chick.json", import.meta.url), "utf8"),
  ]);
  const homeCharacterAnimation = JSON.parse(homeCharacterJson);
  for (const route of [
    "/onboarding/age", "/onboarding/avoid", "/onboarding/stage", "/analysis/:id",
    "/plan", "/plan/week", "/food-map", "/food-map/:food",
    "/result/:conclusion", "/cook/:id/session", "/cook/:id/prep", "/cook/:id/step/:step",
    "/feedback/:id/now", "/feedback/:id/now/:part", "/feedback/:id/later", "/history", "/baby", "/settings",
  ]) assert.match(app, new RegExp(route.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  for (const conclusion of ["direct", "adapted", "needs-info", "not-recommended", "uncertain"]) {
    assert.match(fixtures, new RegExp(`\\b${conclusion.replace("-", "\\-")}\\b`));
  }
  assert.match(gateway, /class MockAiGateway implements AiGateway/);
  assert.match(gateway, /RemoteAiGateway/);
  assert.match(fixtures, /MOCK DATA ONLY/);
  assert.match(app, /不构成真实喂养或医疗建议/);
  assert.doesNotMatch(app, /MockBadge|ScenarioPanel|试试宝宝虾滑面演示|恢复完整演示数据/);
  assert.match(app, /conversation-timeline/);
  assert.match(app, /吃得怎么样？/);
  assert.match(app, /吃了多少/);
  assert.match(app, /接受程度/);
  assert.match(app, /吞咽和即时情况/);
  assert.match(app, /开启柔和语音/);
  assert.match(app, /安排辅食/);
  assert.match(app, /食物地图/);
  assert.match(app, /导入辅食视频/);
  assert.match(app, /今日辅食灵感/);
  assert.match(app, /aria-label=\{`开始制作\$\{idea\.title\}`\}/);
  assert.match(app, /navigate\(`\/cook\/\$\{idea\.id\}\/session`\)/);
  assert.match(app, /function InspirationCookSession/);
  assert.match(app, /navigate\(`\/feedback\/\$\{idea\.id\}\/now`\)/);
  assert.doesNotMatch(app, /加入计划/);
  assert.match(app, /className=\{cx\("home-next-task"/);
  assert.match(app, /className="home-primary-flow"/);
  assert.match(app, /variant=\{hasNextTask \? "secondary" : "primary"\}/);
  assert.match(app, /尚未保存为真实计划/);
  assert.doesNotMatch(app, /已安排 \{weeklyMeals\.length\} 天/);
  assert.match(app, /className="home-dashboard-grid"/);
  assert.doesNotMatch(app, /最近的小进步|home-progress-section/);
  assert.match(app, /已记录 \{profile\.triedFoods\.length\} 种/);
  assert.match(app, /直链或本地 MP4 \/ MOV/);
  assert.match(app, /粘贴链接/);
  assert.match(app, /选择文件/);
  assert.match(app, /className=\{cx\("home-import-body"/);
  assert.ok(app.indexOf("没有链接？试试宝宝虾滑面示例") < app.indexOf('<Button full type="submit"'));
  assert.match(app, /function LocalVideoPreview/);
  assert.match(app, /URL\.createObjectURL\(file\)/);
  assert.match(app, /URL\.revokeObjectURL\(previewUrl\)/);
  assert.match(app, /controls playsInline preload="metadata"/);
  assert.match(app, /请先完成宝宝档案，再生成个性化宝宝版本/);
  assert.match(importValidation, /单个文件不能超过 200 MB/);
  assert.match(app, /accept="\.mp4,\.mov,video\/mp4,video\/quicktime/);
  assert.match(app, /分析这个视频/);
  assert.doesNotMatch(app, /home-upload-video|home-upload-gallery/);
  assert.match(app, /foodJourneyStages/);
  assert.match(app, /food-character-slot/);
  assert.equal((app.match(/<CharacterIllustration intent="link"/g) ?? []).length, 0);
  assert.match(app, /aria-label="查看宝宝档案"><Suspense fallback=/);
  assert.match(app, /<HomeCharacterAnimation \/><\/Suspense><\/button>/);
  assert.match(app, /lazy\(\(\) => import\("\.\/home-character-animation"\)/);
  assert.match(homeCharacter, /DotLottieReact/);
  assert.match(homeCharacter, /\/illustrations\/ip\/v2\/home-chick\.json/);
  assert.match(homeCharacter, /\/illustrations\/ip\/v2\/home-chick-poster\.png/);
  assert.match(homeCharacter, /useReducedMotion/);
  assert.match(homeCharacter, /loadError/);
  assert.equal(homeCharacterAnimation.layers.length, 8);
  assert.ok(homeCharacterAnimation.layers.every((layer) => layer.ip === 0 && layer.op === 72));
  assert.deepEqual(homeCharacterAnimation.markers.map((marker) => marker.cm), ["idle", "wave", "blink"]);
  assert.match(app, /className="large-avatar"><CharacterIllustration intent="neutral"/);
  assert.match(app, /className="profile-pill" onClick=\{\(\) => navigate\("\/baby"\)\}/);
  assert.doesNotMatch(app, /home-link-character|className="large-avatar">满/);
  assert.match(app, /19—24 月龄/);
  assert.match(app, /路线按月龄整理记录和计划/);
  assert.match(app, /还需确认.*项/);
  assert.match(app, /宝宝版本/);
  assert.match(app, /原视频解析/);
  assert.match(app, /开始前必须确认/);
  assert.match(app, /进入对话陪做/);
  assert.match(app, /完成并记录反馈/);
  assert.match(app, /feedback\/\$\{tomatoRiceAnalysis\.id\}\/now/);
  assert.match(app, /柔和语音中/);
  assert.match(app, /保存并返回首页/);
  assert.match(app, /稍后观察会留在首页待办/);
  assert.match(fixtures, /番茄肉酱青菜软饭/);
  assert.match(fixtures, /视频事实、未知项、宝宝版调整、执行计划/);
  assert.match(tts, /\/api\/tts/);
  assert.doesNotMatch(tts, /speechSynthesis|SpeechSynthesisUtterance|speakWithSystemFallback/);
  assert.doesNotMatch(tts, /TENCENTCLOUD_SECRET_ID/);
  assert.match(ttsRoute, /TENCENT_VOICE_TYPE = 603002/);
  assert.match(ttsRoute, /TENCENTCLOUD_SECRET_ID/);
  assert.match(ttsRoute, /tts\.tencentcloudapi\.com/);
  assert.doesNotMatch(app, /foodMapCategories/);
  assert.match(app, /FRONTEND PLACEHOLDER DATA/);
  assert.doesNotMatch(app, /这一步完成，继续/);
});

test("移动端动效体系覆盖路由、列表、按钮、加载和滚动层级", async () => {
  const [app, styles] = await Promise.all([
    readFile(new URL("../app/BabyBaoApp.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
  ]);
  assert.match(app, /AnimatePresence initial=\{false\} mode="sync"/);
  assert.match(app, /className="route-stage"/);
  assert.match(app, /state=\{\{ transition: "tab", direction:/);
  assert.match(app, /mode: transitionState\?\.transition === "tab" \? "tab" : "stack"/);
  assert.equal((app.match(/<BottomNav \/>/g) ?? []).length, 1);
  assert.match(app, /showBottomNav && <BottomNav \/>/);
  assert.match(app, /data-no-ripple="true"/);
  assert.match(app, /mode === "none" \|\| mode === "tab" \? 0/);
  assert.match(app, /className="dynamic-island"/);
  assert.match(app, /className="back-button"/);
  assert.match(app, /useReducedMotion/);
  assert.match(app, /className="skeleton-screen"/);
  assert.match(app, /className = "tap-ripple"/);
  assert.match(app, /--scroll-progress/);
  assert.match(styles, /@keyframes tap-ripple/);
  assert.match(styles, /@keyframes list-stagger-in/);
  assert.match(styles, /@keyframes skeleton-shine/);
  assert.match(styles, /collapsible-title-screen/);
  assert.match(styles, /\.dynamic-island/);
  assert.match(styles, /\.home-hero\{padding:56px 18px 20px/);
  assert.match(styles, /\.home-character-motion\.is-ready \.home-character-canvas\{opacity:1\}/);
  assert.match(styles, /\.baby-avatar\{position:absolute;[^}]*width:112px;height:112px/);
  assert.match(styles, /\.home-primary-flow\{padding:12px 18px 0\}/);
  assert.match(app, /aria-label="换一组辅食灵感"/);
  assert.match(styles, /\.home-section-heading>button\{[^}]*height:36px/);
  assert.match(styles, /\.home-import-tabs\{height:42px/);
  assert.match(styles, /\.home-import-body\{min-height:119px/);
  assert.match(styles, /\.home-file-preview-media\{position:relative;overflow:hidden;aspect-ratio:16\/9/);
  assert.doesNotMatch(styles, /\.phone-viewport\{[^}]*padding-top:38px/);
  assert.match(styles, /\.topbar\{top:0;height:92px/);
  assert.doesNotMatch(styles, /\.screen\{padding-top:38px/);
  assert.match(styles, /\.back-button/);
  assert.match(styles, /\.bottom-nav-item\.active::before/);
  assert.match(styles, /\.bottom-nav-item\.active svg \{ fill: none; transform: none;/);
  assert.doesNotMatch(styles, /\.bottom-nav-item\.active svg\s*\{[^}]*fill:\s*var\(/);
  assert.match(styles, /\.bottom-nav \{ position: fixed;[^}]*left: 14px; right: 14px;[^}]*border-radius: 26px/);
  assert.match(styles, /backdrop-filter: blur\(22px\) saturate\(175%\)/);
  assert.match(styles, /@supports not \(\(-webkit-backdrop-filter:/);
  assert.match(styles, /prefers-reduced-motion: reduce/);
});
