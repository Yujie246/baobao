"use client";

import {
  Bookmark,
  CheckCircle2,
  ChevronDown,
  Heart,
  Home,
  Info,
  LoaderCircle,
  MessageCircle,
  Play,
  RotateCcw,
  Share2,
  Snowflake,
  Sparkles,
  UserRound,
  Volume2,
  VolumeX,
  X,
} from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { createCatalogAnalysisJob, getAnalysisJob, getAnalysisResult } from "./analysis/client";
import type { AnalysisResult } from "./analysis/schemas";
import { getUnifiedAnalysisPlan } from "./analysis/unified";
import { planVideoCandidates } from "./plan-video-catalog";
import { useAppStore } from "./store";

const videoSources = [
  "/feed-videos/01-tomato-pork-greens-rice.mp4",
  "/feed-videos/02-pumpkin-beef-rice.mp4",
  "/feed-videos/03-tomato-potato-beef-rice.mp4",
  "/feed-videos/04-black-sesame-egg-custard.mp4",
  "/feed-videos/05-spinach-vegetable-egg-custard.mp4",
  "/feed-videos/06-potato-apple-cake.mp4",
];

const creatorNames = ["宝宝辅食日记", "暖暖家的辅食", "一口好好吃", "小月龄食谱", "今天吃什么", "软糯加餐屋"];
const defaultLikes = [2836, 1654, 2198, 978, 1327, 1886];

const feedVideos = planVideoCandidates.map((candidate, index) => ({
  ...candidate,
  videoSrc: videoSources[index],
  creator: creatorNames[index],
  likes: defaultLikes[index],
  caption: `${candidate.note} #${candidate.formats.join(" #")} #宝宝辅食`,
  comments: [
    `${candidate.title}看起来好香，步骤可以再细一点吗？`,
    `这个月龄做的时候，质地需要怎么调整？`,
    `已经收藏，准备周末给宝宝试试。`,
  ],
}));

type FeedVideo = (typeof feedVideos)[number];
type AnalysisState = {
  status: "idle" | "running" | "completed" | "failed";
  progress: number;
  stageText: string;
  jobId?: string;
  result?: AnalysisResult;
  error?: string;
};
type SheetState = { videoId: string; tab: "comments" | "ai" } | null;

const idleAnalysis: AnalysisState = { status: "idle", progress: 0, stageText: "等待分析" };

function compactNumber(value: number) {
  if (value >= 10_000) return `${(value / 10_000).toFixed(1)}万`;
  return String(value);
}

function ActionButton({ label, active, children, onClick }: { label: string; active?: boolean; children: React.ReactNode; onClick: () => void }) {
  return <button type="button" className={`douyin-action${active ? " active" : ""}`} onClick={onClick} aria-label={label}>{children}<span>{label}</span></button>;
}

function AnalysisPreview({ state, onOpenFull, onRetry }: { state: AnalysisState; onOpenFull: () => void; onRetry: () => void }) {
  const [view, setView] = useState<"baby" | "steps">("baby");
  const plan = useMemo(() => state.result ? getUnifiedAnalysisPlan(state.result) : null, [state.result]);

  if (state.status === "idle") return <div className="douyin-ai-empty"><Snowflake size={42} /><h3>用 AI 看懂这道辅食</h3><p>会结合宝宝档案，生成完整的宝宝版本和逐步教程。</p><button type="button" className="douyin-primary" onClick={onRetry}><Sparkles size={18} />开始分析当前视频</button></div>;
  if (state.status === "running") return <div className="douyin-ai-loading"><LoaderCircle className="spin" size={38} /><h3>{state.stageText}</h3><p>正在识别食材、做法与关键状态</p><div className="douyin-progress"><i style={{ width: `${state.progress}%` }} /></div><strong>{state.progress}%</strong></div>;
  if (state.status === "failed") return <div className="douyin-ai-empty error"><Info size={38} /><h3>这次分析没有完成</h3><p>{state.error || "请稍后重试"}</p><button type="button" className="douyin-primary" onClick={onRetry}><RotateCcw size={18} />重新分析</button></div>;
  if (!plan || !state.result) return null;

  return <div className="douyin-ai-result">
    <div className="douyin-ai-summary"><span><Snowflake size={18} />AI 已完成分析</span><h3>{plan.verdict.headline}</h3><p>{plan.verdict.summary}</p></div>
    <div className="douyin-result-tabs" role="tablist"><button type="button" role="tab" aria-selected={view === "baby"} className={view === "baby" ? "active" : ""} onClick={() => setView("baby")}>宝宝版本</button><button type="button" role="tab" aria-selected={view === "steps"} className={view === "steps" ? "active" : ""} onClick={() => setView("steps")}>步骤教程</button></div>
    {view === "baby" ? <div className="douyin-preview-list">
      <section><small>适配结论</small><strong>{plan.verdict.title}</strong><p>{plan.verdict.profile_summary}</p></section>
      <section><small>关键调整</small>{plan.checks.filter((item) => item.impact !== "none").map((item) => <div className="douyin-check-row" key={item.check_id}><CheckCircle2 size={17} /><span><strong>{item.dimension}</strong><p>{item.action}</p></span></div>)}</section>
      <section><small>宝宝版食材</small>{plan.ingredients.map((item) => <div className="douyin-ingredient-row" key={item.name}><strong>{item.name}</strong><span>{item.baby.amount || "按实际食量"} · {item.baby.preparation}</span></div>)}</section>
      <section><small>喂前确认</small>{plan.serving_checks.map((item) => <p key={item}>· {item}</p>)}</section>
    </div> : <div className="douyin-preview-list steps">{plan.steps.map((step, index) => <section key={step.step_id}>{step.image_url && <img /* eslint-disable-line @next/next/no-img-element */ src={step.image_url} alt={step.keyframe_description || step.title} />}<small>步骤 {index + 1}{step.timing ? ` · ${step.timing}` : ""}</small><strong>{step.title}</strong><p>{step.instruction}</p><div className="douyin-step-check"><b>做到什么算完成</b>{step.completion_check}</div><div className="douyin-step-tip"><Info size={15} />{step.personal_reminder}</div></section>)}</div>}
    <button type="button" className="douyin-primary sticky" onClick={onOpenFull}>查看完整排版与全部依据</button>
  </div>;
}

export function DouyinFeedPage() {
  const navigate = useNavigate();
  const profile = useAppStore((state) => state.profile);
  const scrollerRef = useRef<HTMLDivElement>(null);
  const videoRefs = useRef(new Map<string, HTMLVideoElement>());
  const mountedRef = useRef(true);
  const [activeIndex, setActiveIndex] = useState(0);
  const [soundEnabled, setSoundEnabled] = useState(false);
  const [paused, setPaused] = useState(false);
  const [sheet, setSheet] = useState<SheetState>(null);
  const [liked, setLiked] = useState<Record<string, boolean>>({});
  const [saved, setSaved] = useState<Record<string, boolean>>({});
  const [progress, setProgress] = useState<Record<string, number>>({});
  const [comments, setComments] = useState<Record<string, string[]>>(() => Object.fromEntries(feedVideos.map((video) => [video.id, video.comments])));
  const [commentText, setCommentText] = useState("");
  const [analysis, setAnalysis] = useState<Record<string, AnalysisState>>({});

  const activeVideo = feedVideos[activeIndex];
  const sheetVideo = sheet ? feedVideos.find((video) => video.id === sheet.videoId) || activeVideo : activeVideo;
  const sheetAnalysis = analysis[sheetVideo.id] || idleAnalysis;

  useEffect(() => () => { mountedRef.current = false; }, []);

  useEffect(() => {
    const root = scrollerRef.current;
    if (!root) return;
    const observer = new IntersectionObserver((entries) => {
      const visible = entries.filter((entry) => entry.isIntersecting).sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
      if (!visible) return;
      const index = Number((visible.target as HTMLElement).dataset.index);
      if (Number.isFinite(index)) { setActiveIndex(index); setPaused(false); }
    }, { root, threshold: [0.55, 0.72, 0.9] });
    root.querySelectorAll<HTMLElement>(".douyin-slide").forEach((element) => observer.observe(element));
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    videoRefs.current.forEach((video, id) => {
      const isActive = id === activeVideo.id && !sheet;
      video.muted = !soundEnabled;
      if (isActive && !paused) void video.play().catch(() => undefined);
      else video.pause();
    });
  }, [activeVideo.id, paused, sheet, soundEnabled]);

  const startWithSound = useCallback(() => {
    setSoundEnabled(true);
    setPaused(false);
    const video = videoRefs.current.get(activeVideo.id);
    if (video) { video.muted = false; void video.play().catch(() => undefined); }
  }, [activeVideo.id]);

  const runAnalysis = useCallback(async (video: FeedVideo) => {
    setSheet({ videoId: video.id, tab: "ai" });
    if (!profile.completed) {
      setAnalysis((current) => ({ ...current, [video.id]: { status: "failed", progress: 0, stageText: "需要宝宝档案", error: "请先完成宝宝档案，AI 才能给出个性化宝宝版本。" } }));
      return;
    }
    const existing = analysis[video.id];
    if (existing?.status === "running" || existing?.status === "completed") return;
    setAnalysis((current) => ({ ...current, [video.id]: { status: "running", progress: 4, stageText: video.mockFixtureId ? "正在读取示例分析…" : "正在理解视频…" } }));
    try {
      const created = await createCatalogAnalysisJob(video.id, profile);
      if (!mountedRef.current) return;
      setAnalysis((current) => ({ ...current, [video.id]: { ...(current[video.id] || idleAnalysis), status: "running", progress: created.status === "completed" ? 96 : 8, stageText: created.status === "completed" ? "正在整理结果…" : "视频已进入分析队列", jobId: created.jobId } }));
      if (created.status !== "completed") {
        for (;;) {
          await new Promise((resolve) => setTimeout(resolve, 1200));
          if (!mountedRef.current) return;
          const job = await getAnalysisJob(created.jobId);
          setAnalysis((current) => ({ ...current, [video.id]: { ...(current[video.id] || idleAnalysis), status: job.status === "failed" ? "failed" : "running", progress: job.progress, stageText: job.stageText, jobId: created.jobId, error: job.error || undefined } }));
          if (job.status === "failed") throw new Error(job.error || "分析失败");
          if (job.status === "completed") break;
        }
      }
      const result = await getAnalysisResult(created.jobId);
      if (!mountedRef.current) return;
      sessionStorage.setItem("baobao:last-analysis-job", created.jobId);
      setAnalysis((current) => ({ ...current, [video.id]: { status: "completed", progress: 100, stageText: "分析完成", jobId: created.jobId, result } }));
    } catch (error) {
      if (!mountedRef.current) return;
      setAnalysis((current) => ({ ...current, [video.id]: { ...(current[video.id] || idleAnalysis), status: "failed", progress: 0, stageText: "分析失败", error: error instanceof Error ? error.message : "分析失败，请重试" } }));
    }
  }, [analysis, profile]);

  const togglePlay = (video: FeedVideo) => {
    if (!soundEnabled) { startWithSound(); return; }
    const element = videoRefs.current.get(video.id);
    if (!element) return;
    if (element.paused) { setPaused(false); void element.play(); } else { setPaused(true); element.pause(); }
  };

  const shareVideo = async (video: FeedVideo) => {
    const shareData = { title: video.title, text: `${video.title}｜宝宝饱饱辅食视频`, url: location.href };
    if (navigator.share) await navigator.share(shareData).catch(() => undefined);
    else await navigator.clipboard?.writeText(location.href);
  };

  const submitComment = (event: FormEvent) => {
    event.preventDefault();
    const value = commentText.trim();
    if (!value) return;
    setComments((current) => ({ ...current, [sheetVideo.id]: [value, ...(current[sheetVideo.id] || [])] }));
    setCommentText("");
  };

  return <div className="douyin-page">
    <header className="douyin-topbar"><button type="button" onClick={() => navigate("/home")} aria-label="返回首页"><ChevronDown size={24} /></button><div><span>关注</span><strong>推荐</strong></div><button type="button" onClick={() => setSoundEnabled((value) => !value)} aria-label={soundEnabled ? "关闭声音" : "打开声音"}>{soundEnabled ? <Volume2 size={22} /> : <VolumeX size={22} />}</button></header>
    <div className="douyin-scroller" ref={scrollerRef}>{feedVideos.map((video, index) => <article className="douyin-slide" data-index={index} key={video.id}>
      <video ref={(element) => { if (element) videoRefs.current.set(video.id, element); else videoRefs.current.delete(video.id); }} src={video.videoSrc} poster={video.image} loop playsInline muted={!soundEnabled} preload={Math.abs(index - activeIndex) <= 1 ? "auto" : "metadata"} onClick={() => togglePlay(video)} onTimeUpdate={(event) => { const element = event.currentTarget; setProgress((current) => ({ ...current, [video.id]: element.duration ? element.currentTime / element.duration * 100 : 0 })); }} />
      <div className="douyin-shade" />
      <AnimatePresence>{activeIndex === index && paused && <motion.button type="button" className="douyin-play-state" initial={{ scale: .8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ opacity: 0 }} onClick={() => togglePlay(video)}><Play fill="currentColor" size={34} /></motion.button>}</AnimatePresence>
      <div className="douyin-copy"><strong>@{video.creator}</strong><p>{video.caption}</p><span>♫ 原声 · {video.title}</span></div>
      <aside className="douyin-rail"><div className="douyin-avatar"><UserRound size={25} /><i>+</i></div><ActionButton label={compactNumber(video.likes + (liked[video.id] ? 1 : 0))} active={liked[video.id]} onClick={() => setLiked((current) => ({ ...current, [video.id]: !current[video.id] }))}><Heart fill={liked[video.id] ? "currentColor" : "none"} /></ActionButton><ActionButton label={String(comments[video.id]?.length || 0)} onClick={() => setSheet({ videoId: video.id, tab: "comments" })}><MessageCircle fill="currentColor" /></ActionButton><ActionButton label="收藏" active={saved[video.id]} onClick={() => setSaved((current) => ({ ...current, [video.id]: !current[video.id] }))}><Bookmark fill={saved[video.id] ? "currentColor" : "none"} /></ActionButton><ActionButton label="分享" onClick={() => void shareVideo(video)}><Share2 /></ActionButton><button type="button" className={`douyin-ai-orb${analysis[video.id]?.status === "running" ? " working" : ""}`} onClick={() => void runAnalysis(video)} aria-label={`AI 分析${video.title}`}><Snowflake size={28} /><span>AI</span></button></aside>
      <div className="douyin-video-progress"><i style={{ width: `${progress[video.id] || 0}%` }} /></div>
    </article>)}</div>
    {!soundEnabled && <button type="button" className="douyin-sound-gate" onClick={startWithSound}><span><Volume2 size={28} /></span><strong>点一下，开启声音开始刷</strong><small>上下滑动切换 6 个测试视频</small></button>}
    <nav className="douyin-bottom"><button type="button" className="active"><Home size={20} />首页</button><button type="button">朋友</button><button type="button" className="create">+</button><button type="button">消息</button><button type="button" onClick={() => navigate("/baby")}>我</button></nav>
    <AnimatePresence>{sheet && <><motion.button type="button" className="douyin-sheet-mask" aria-label="关闭" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setSheet(null)} /><motion.section className="douyin-sheet" initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }} transition={{ type: "spring", damping: 28, stiffness: 320 }}>
      <div className="douyin-sheet-head"><div role="tablist"><button type="button" role="tab" aria-selected={sheet.tab === "comments"} className={sheet.tab === "comments" ? "active" : ""} onClick={() => setSheet({ ...sheet, tab: "comments" })}>评论 {comments[sheetVideo.id]?.length || 0}</button><button type="button" role="tab" aria-selected={sheet.tab === "ai"} className={sheet.tab === "ai" ? "active" : ""} onClick={() => setSheet({ ...sheet, tab: "ai" })}><Snowflake size={19} />AI</button></div><button type="button" aria-label="关闭" onClick={() => setSheet(null)}><X size={24} /></button></div>
      {sheet.tab === "comments" ? <div className="douyin-comments"><div className="douyin-comments-list">{(comments[sheetVideo.id] || []).map((comment, index) => <article key={`${comment}-${index}`}><span><UserRound size={20} /></span><div><small>{index === 0 ? "乐乐妈妈" : index === 1 ? "辅食研究员" : "小月龄成长记"}</small><p>{comment}</p><em>刚刚 · 回复</em></div><Heart size={18} /></article>)}</div><form onSubmit={submitComment}><input value={commentText} onChange={(event) => setCommentText(event.target.value)} placeholder="善语结善缘，写下你的评论" /><button type="submit">发送</button></form></div> : <div className="douyin-ai-scroll"><AnalysisPreview state={sheetAnalysis} onRetry={() => void runAnalysis(sheetVideo)} onOpenFull={() => sheetAnalysis.jobId && navigate(`/result/analysis/${sheetAnalysis.jobId}`, { state: { back: "/douyin" } })} /></div>}
    </motion.section></>}</AnimatePresence>
  </div>;
}
