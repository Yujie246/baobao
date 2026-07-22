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
  for (const path of ["/home", "/agent", "/plan", "/plan/week", "/plan/meal/pumpkin-soft-rice/videos", "/food-map", "/food-map/shrimp", "/result/adapted", "/cook/shrimp-noodle-demo/session", "/cook/shrimp-noodle-demo/step/3", "/baby/foods"]) {
    const response = await render(path);
    assert.equal(response.status, 200, path);
  }
});

test("实现包含完整页面闭环和统一 Mock 边界", async () => {
  const [app, gateway, fixtures, tts, ttsRoute, importValidation, homeCharacter, homeCharacterJson, agentRoute, agentClient] = await Promise.all([
    readFile(new URL("../app/BabyBaoApp.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/ai-gateway.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/mock-data.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/tts-gateway.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/tts/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/import-validation.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/home-character-animation.tsx", import.meta.url), "utf8"),
    readFile(new URL("../public/illustrations/ip/v2/home-chick.json", import.meta.url), "utf8"),
    readFile(new URL("../app/api/agent-chat/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/agent/client.ts", import.meta.url), "utf8"),
  ]);
  const homeCharacterAnimation = JSON.parse(homeCharacterJson);
  for (const route of [
    "/onboarding/age", "/onboarding/avoid", "/onboarding/stage", "/analysis/:id",
    "/plan", "/plan/week", "/plan/meal/:mealId/videos", "/food-map", "/food-map/:food",
    "/result/:conclusion", "/cook/:id/session", "/cook/:id/prep", "/cook/:id/step/:step",
    "/feedback/:id/now", "/feedback/:id/now/:part", "/feedback/:id/later", "/history", "/baby", "/agent", "/settings",
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
  assert.match(app, /保持语音/);
  assert.match(app, /安排辅食/);
  assert.match(app, /食物地图/);
  assert.match(app, /导入辅食视频/);
  assert.match(app, /今日辅食灵感/);
  assert.match(app, /aria-label="辅食灵感列表" tabIndex=\{0\}/);
  assert.match(app, /onPointerDown=\{startInspirationDrag\}/);
  assert.match(app, /onClickCapture=\{preventClickAfterInspirationDrag\}/);
  assert.doesNotMatch(app, /来自测试视频的真实成品画面|左右滑动/);
  assert.match(app, /className="home-idea-media"/);
  assert.match(app, /src=\{idea\.image\}/);
  assert.match(app, /aria-label=\{`开始制作\$\{idea\.title\}`\}/);
  assert.match(app, /beginInspirationAnalysis\(idea\)/);
  assert.match(app, /createCatalogAnalysisJob\(idea\.id, profile\)/);
  assert.match(app, /closest\("button, a, input"\)/);
  assert.doesNotMatch(app, /onClick=\{\(\) => navigate\(`\/cook\/\$\{idea\.id\}\/session`\)\}/);
  assert.match(app, /function InspirationCookSession/);
  assert.match(app, /navigate\(`\/feedback\/\$\{idea\.id\}\/now`\)/);
  assert.doesNotMatch(app, /加入计划/);
  assert.match(app, /className="home-dashboard-grid home-dashboard-grid-top"/);
  assert.match(app, /className="home-scroll-cue"/);
  assert.match(app, /aria-label="向下浏览首页内容"/);
  assert.match(app, /agentPullTriggerDistance = 240/);
  assert.match(app, /agentPullMaxDistance = 340/);
  assert.match(app, /agentPullProgress \* \.5/);
  assert.match(app, /className="home-primary-flow"/);
  assert.match(app, /variant="primary"/);
  assert.match(app, /计划参考/);
  assert.match(app, /每一顿都可先找视频，再判断是否适合/);
  assert.match(app, /function PlanVideoSearchPage/);
  assert.match(app, /createCatalogAnalysisJob/);
  assert.match(app, /检查是否适合宝宝/);
  assert.match(app, /候选匹配只说明/);
  assert.doesNotMatch(app, /已安排 \{weeklyMeals\.length\} 天/);
  assert.match(app, /className="home-dashboard-card food-map"/);
  assert.doesNotMatch(app, /最近的小进步|home-progress-section/);
  assert.match(app, /已记录 \{profile\.triedFoods\.length\} 种/);
  assert.match(app, /MP4 \/ MOV · 最大 200MB/);
  assert.match(app, /粘贴链接/);
  assert.match(app, /选择文件/);
  assert.match(app, /className=\{cx\("home-import-body"/);
  assert.doesNotMatch(app, /没有链接？试试宝宝虾滑面示例/);
  assert.match(app, /没有链接？试试测试视频 1 示例/);
  assert.match(app, /没有文件？试试测试视频 1 示例/);
  assert.match(app, /createCatalogAnalysisJob\("tomato-pork-greens-rice", profile\)/);
  assert.match(app, /正在读取测试视频 1/);
  assert.match(app, /3_000/);
  assert.match(app, /function LocalVideoPreview/);
  assert.match(app, /URL\.createObjectURL\(file\)/);
  assert.match(app, /URL\.revokeObjectURL\(previewUrl\)/);
  assert.match(app, /controls playsInline preload="metadata"/);
  assert.match(app, /请先完成宝宝档案，再生成个性化宝宝版本/);
  assert.match(importValidation, /单个文件不能超过 200 MB/);
  assert.match(app, /accept="\.mp4,\.mov,video\/mp4,video\/quicktime/);
  assert.match(app, /开始分析/);
  assert.match(app, /className="home-analysis-button"/);
  assert.match(app, /function useSmoothProgress/);
  assert.match(app, /className="analysis-status-card"/);
  assert.match(app, /只展示可核验的分析项目，不展示模型内部推理/);
  assert.doesNotMatch(app, /home-upload-video|home-upload-gallery/);
  assert.match(app, /foodJourneyStages/);
  assert.match(app, /food-character-slot/);
  assert.match(app, /function FoodBadgeCelebration/);
  assert.match(app, /disableForReducedMotion: true/);
  assert.match(app, /徽章不代表医学上已排除过敏/);
  assert.match(app, /完成首次尝试，继续/);
  assert.match(app, /完成继续观察，下一步/);
  assert.doesNotMatch(app, /起可继续/);
  assert.equal((app.match(/<CharacterIllustration intent="link"/g) ?? []).length, 0);
  assert.match(app, /aria-label=\{`和\$\{profile\.name\}的辅食小助手对话`\}><Suspense fallback=/);
  assert.match(app, /`下拉，和\$\{profile\.name\}聊聊`/);
  assert.match(app, /id="baby-name"/);
  assert.match(app, /平时怎么称呼宝宝/);
  assert.match(app, /function BabyAgentPage/);
  assert.doesNotMatch(app, /function babyAgentReply/);
  assert.match(agentRoute, /new OpenAI\(\{ apiKey, baseURL/);
  assert.match(agentRoute, /stream: true/);
  assert.match(agentRoute, /deepseek-v4-flash/);
  assert.match(agentRoute, /thinking: \{ type: "disabled" \}/);
  assert.match(agentRoute, /DEEPSEEK_API_KEY/);
  assert.match(agentClient, /fetch\("\/api\/agent-chat"/);
  assert.match(agentRoute, /buildCookingAgentSystemPrompt/);
  assert.match(agentRoute, /loadJob\(input\.cookingContext\.jobId\)/);
  assert.match(app, /completedStepIds: completed\.map/);
  assert.match(app, /小助手正在结合当前步骤回答/);
  assert.match(agentClient, /response\.body\.getReader\(\)/);
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
  assert.match(app, /所有食物从灰色开始/);
  assert.match(app, /徽章只代表完成了本次尝试和 3—5 天观察记录/);
  assert.match(app, /还需确认.*项/);
  assert.match(app, /宝宝版本/);
  assert.match(app, /原视频解析/);
  assert.match(app, /开始前必须确认/);
  assert.match(app, /进入对话陪做/);
  assert.match(app, /完成并记录反馈/);
  assert.match(app, /feedback\/\$\{tomatoRiceAnalysis\.id\}\/now/);
  assert.match(app, /设备语音中/);
  assert.match(app, /保存并返回首页/);
  assert.match(app, /稍后观察会留在首页待办/);
  assert.match(fixtures, /番茄肉酱青菜软饭/);
  assert.match(fixtures, /视频事实、未知项、宝宝版调整、执行计划/);
  assert.match(tts, /\/api\/tts/);
  assert.match(tts, /speechSynthesis/);
  assert.match(tts, /SpeechSynthesisUtterance/);
  assert.match(tts, /speakWithSystemFallback/);
  assert.doesNotMatch(tts, /TENCENTCLOUD_SECRET_ID/);
  assert.match(ttsRoute, /TENCENT_VOICE_TYPE = 603002/);
  assert.match(ttsRoute, /TENCENTCLOUD_SECRET_ID/);
  assert.match(ttsRoute, /tts\.tencentcloudapi\.com/);
  assert.match(app, /const \[prepared, setPrepared\] = useState\(false\)/);
  assert.match(app, /const \[completed, setCompleted\] = useState<number\[\]>\(\[\]\)/);
  assert.match(app, /messages\.filter\(\(message\) => message\.step === index\)/);
  assert.doesNotMatch(app, /setMessages\(\[\]\); setStepIndex/);
  assert.match(app, /这些食材都准备好了吗？/);
  assert.match(app, /停止陪做，记录异常/);
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
  assert.match(styles, /@keyframes home-scroll-nudge/);
  assert.match(styles, /\.home-screen\[data-scrolled="true"\] \.home-scroll-cue/);
  assert.match(styles, /\.home-character-motion\.is-ready \.home-character-canvas\{opacity:1\}/);
  assert.match(styles, /\.baby-avatar\{position:absolute;[^}]*width:112px;height:112px/);
  assert.match(styles, /\.home-primary-flow\{padding:24px 18px 0\}/);
  assert.doesNotMatch(app, /换一组辅食灵感|ideaOffset/);
  assert.match(styles, /\.home-section-heading>button\{[^}]*height:36px/);
  assert.match(styles, /\.home-inspiration-track\{[^}]*scroll-snap-type:x mandatory[^}]*touch-action:pan-x/);
  assert.match(styles, /\.home-idea-media\{[^}]*aspect-ratio:16\/10/);
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
