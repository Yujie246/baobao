"use client";

import {
  AlertCircle,
  ArrowLeft,
  Award,
  Baby,
  Bell,
  BookmarkCheck,
  BookOpen,
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Clock3,
  Edit3,
  Download,
  File as FileIcon,
  FileQuestion,
  History,
  Home,
  Info,
  Link2,
  ListChecks,
  LockKeyhole,
  MessageCircle,
  Map,
  Mic,
  Minus,
  Pause,
  Play,
  Plus,
  RefreshCw,
  Search,
  Send,
  ShoppingBasket,
  Settings,
  Share2,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Timer,
  Trash2,
  Upload,
  UtensilsCrossed,
  Volume2,
  WifiOff,
  X,
} from "lucide-react";
import confetti from "canvas-confetti";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import {
  createContext,
  ChangeEvent,
  CSSProperties,
  FormEvent,
  lazy,
  ReactNode,
  Suspense,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import {
  BrowserRouter,
  Navigate,
  NavLink,
  Route,
  Routes,
  useLocation,
  useNavigate,
  useNavigationType,
  useParams,
} from "react-router-dom";
import { createAiGateway, type AnalysisProgress } from "./ai-gateway";
import { streamBabyAgent } from "./agent/client";
import { createAnalysisJob, createCatalogAnalysisJob, createUrlAnalysisJob, getAnalysisJob, getAnalysisResult, retryAnalysisJob } from "./analysis/client";
import type { AnalysisJobStatus, AnalysisResult } from "./analysis/schemas";
import { cookingStepTimerSeconds } from "./analysis/timing";
import { isUrgentCookingQuestion } from "./cooking/prompt";
import { getUnifiedAnalysisPlan } from "./analysis/unified";
import { CharacterIllustration, resolveCookingIntent, resolveResultIntent, type CharacterIntent } from "./character-illustrations";
import { FoodIllustration, type FoodId } from "./food-illustrations";
import { FoodMapScenery } from "./food-map-scenery";
import {
  foodJourneyFoods,
  foodJourneyStages,
  foodObservationCheckpoints,
  getFoodJourneyFood,
  possibleAllergySigns,
  urgentAllergySigns,
  type FoodJourneyFood,
} from "./food-journey";
import { ProfileIllustration, resolveAgeProfileAsset, resolveAvoidProfileAsset, resolveTextureProfileAsset } from "./profile-illustrations";
import { validateImportFiles } from "./import-validation";
import { loadLocalState, saveLocalState } from "./local-db";
import {
  demoLink,
  shrimpNoodleRecipe,
  suitabilityCopy,
  tomatoRiceAnalysis,
} from "./mock-data";
import { selectPersistedState, useAppStore } from "./store";
import { childVoiceTts, type VoiceEngine } from "./tts-gateway";
import type { CookingStep, FeedingSignal, FeedingStage, Feedback, Ingredient, Suitability } from "./types";

const stageLabels = {
  puree: "细腻泥糊",
  "thick-puree": "稠泥与小颗粒",
  "soft-lumps": "软颗粒",
  "finger-food": "软手指食物",
};

const HomeCharacterAnimation = lazy(() => import("./home-character-animation").then((module) => ({ default: module.HomeCharacterAnimation })));

const resultRoutes: Record<Suitability, string> = {
  direct: "direct",
  adapted: "adapted",
  "needs-info": "needs-info",
  "not-recommended": "not-recommended",
  uncertain: "uncertain",
};

const routeResults = Object.fromEntries(
  Object.entries(resultRoutes).map(([key, value]) => [value, key]),
) as Record<string, Suitability>;

interface ScenarioContextValue {
  scenario: Suitability;
  setScenario: (scenario: Suitability) => void;
}

const ScenarioContext = createContext<ScenarioContextValue>({
  scenario: "adapted",
  setScenario: () => undefined,
});

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

function parentFriendly(value: string) {
  return value
    .replace(/thick-puree/gi, "稠泥糊")
    .replace(/fine-puree/gi, "细泥糊")
    .replace(/soft-particles?/gi, "软颗粒")
    .replace(/soft[-_ ]lumps?/gi, "软颗粒")
    .replace(/stage\s*(?:为|是|：|:)?/gi, "当前进食阶段为")
    .replace(/triedFoods/gi, "已尝试食材记录")
    .replace(/avoidFoods/gi, "需要避开的食材记录")
    .replace(/feedingSignals/gi, "进食表现记录")
    .replace(/texture-refusal/gi, "对颗粒口感比较抗拒")
    .replace(/note\s*(?:为|是|：|:)?\s*为空/gi, "没有补充备注")
    .replace(/视频事实[：:]/g, "从视频看：")
    .replace(/宝宝档案[：:]/g, "结合宝宝档案：")
    .replace(/匹配当前阶段/g, "更符合宝宝现在能接受的软硬粗细")
    .replace(/引入状态/g, "以前是否吃过")
    .replace(/新引入/g, "第一次吃")
    .replace(/引入原则/g, "尝试顺序")
    .replace(/违反单一尝试顺序/g, "不方便判断是哪一种食材带来的反应")
    .replace(/\bA\d+\b/g, "视频中的对应步骤")
    .replace(/E-[A-Z]+-\d+/g, "相关辅食依据")
    .replace(/WS\/T\s*\d+[—-]\d+/g, "婴幼儿辅食指导")
    .replace(/中国婴幼儿喂养指南（2022）/g, "婴幼儿喂养建议");
}

function useCookingVoice(announcement: string, paused = false) {
  const [voiceMode, setVoiceMode] = useState(false);
  const [voiceEngine, setVoiceEngine] = useState<VoiceEngine | null>(null);
  const [voiceError, setVoiceError] = useState("");
  const speak = useCallback(async (text: string) => {
    const engine = await childVoiceTts.speak(text);
    setVoiceEngine(engine);
    if (engine === "unavailable") {
      setVoiceMode(false);
      setVoiceError("当前设备无法播放语音，可继续使用文字陪做。");
    } else {
      setVoiceError("");
    }
    return engine;
  }, []);
  useEffect(() => {
    if (!voiceMode || paused) return;
    const timeout = window.setTimeout(() => void speak(announcement), 0);
    return () => window.clearTimeout(timeout);
  }, [announcement, paused, speak, voiceMode]);
  useEffect(() => () => childVoiceTts.cancel(), []);
  const toggleVoice = async () => {
    if (voiceMode) {
      setVoiceMode(false);
      setVoiceEngine(null);
      setVoiceError("");
      childVoiceTts.cancel();
      return;
    }
    setVoiceMode(true);
    setVoiceError("");
    try {
      const nav = navigator as Navigator & { wakeLock?: { request: (type: "screen") => Promise<unknown> } };
      if (nav.wakeLock) await nav.wakeLock.request("screen");
    } catch { /* Voice remains available when Wake Lock is unavailable. */ }
  };
  return {
    voiceMode,
    voiceEngine,
    voiceError,
    speak,
    toggleVoice,
    label: voiceMode ? voiceEngine === "system" ? "设备语音中" : "语音陪伴中" : "保持语音",
  };
}

function VoiceStatus({ engine, error }: { engine: VoiceEngine | null; error: string }) {
  if (!error && engine !== "system") return null;
  return <p className={cx("session-voice-status", error && "error")} role="status">{error || "宝宝音色暂不可用，已切换为设备语音。"}</p>;
}

function Button({
  children,
  variant = "primary",
  full = false,
  icon,
  className,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost" | "danger" | "dark";
  full?: boolean;
  icon?: ReactNode;
}) {
  return (
    <button
      className={cx("button", `button-${variant}`, full && "button-full", className)}
      {...props}
    >
      {icon}
      <span>{children}</span>
    </button>
  );
}

function IconButton({ label, children, className, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement> & { label: string }) {
  return (
    <button className={cx("icon-button", className)} aria-label={label} title={label} {...props}>
      {children}
    </button>
  );
}

function Screen({ children, className }: { children: ReactNode; className?: string }) {
  const handleScroll = (event: React.UIEvent<HTMLElement>) => {
    const target = event.currentTarget;
    const progress = Math.min(target.scrollTop / 56, 1);
    target.style.setProperty("--scroll-progress", String(progress));
    target.style.setProperty("--scroll-title-offset", `${Math.round((1 - progress) * 7)}px`);
    target.style.setProperty("--scroll-hero-opacity", String(1 - progress * .22));
    target.dataset.scrolled = progress > .12 ? "true" : "false";
  };
  return <main className={cx("screen", className)} onScroll={handleScroll}>{children}</main>;
}

function TopBar({
  title,
  back,
  action,
  eyebrow,
}: {
  title: string;
  back?: string | (() => void);
  action?: ReactNode;
  eyebrow?: string;
}) {
  const navigate = useNavigate();
  return (
    <header className="topbar">
      <div className="topbar-side">
        {back ? (
          <IconButton className="back-button" label="返回" onClick={() => {
            if (typeof back === "function") return back();
            const canGoBack = typeof window !== "undefined" && (window.history.state?.idx ?? 0) > 0;
            return canGoBack ? navigate(-1) : navigate(back, { replace: true, state: { transition: "back" } });
          }}>
            <ArrowLeft size={20} />
          </IconButton>
        ) : <span />}
      </div>
      <div className="topbar-title">
        {eyebrow && <span>{eyebrow}</span>}
        <strong>{title}</strong>
      </div>
      <div className="topbar-side topbar-action">{action}</div>
    </header>
  );
}

function BottomNav() {
  const location = useLocation();
  const items = [
    { to: "/home", label: "首页", icon: Home },
    { to: "/history", label: "记录", icon: History },
    { to: "/baby", label: "宝宝", icon: Baby },
  ];
  const currentIndex = location.pathname.startsWith("/history")
    ? 1
    : location.pathname.startsWith("/baby")
      ? 2
      : 0;
  return (
    <nav className="bottom-nav" aria-label="主导航">
      {items.map(({ to, label, icon: Icon }, index) => (
        <NavLink
          key={to}
          to={to}
          data-no-ripple="true"
          state={{ transition: "tab", direction: Math.sign(index - currentIndex) }}
          className={({ isActive }) => cx("bottom-nav-item", isActive && "active")}
        >
          <span className="bottom-nav-icon" aria-hidden="true"><Icon size={21} strokeWidth={2} /></span>
          <span className="bottom-nav-label">{label}</span>
        </NavLink>
      ))}
    </nav>
  );
}

function Toast({ children, onClose }: { children: ReactNode; onClose?: () => void }) {
  useEffect(() => {
    if (!onClose) return;
    const timer = window.setTimeout(onClose, 2600);
    return () => window.clearTimeout(timer);
  }, [onClose]);
  return (
    <motion.div className="toast" initial={{ y: 18, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 10, opacity: 0 }}>
      <CheckCircle2 size={18} /> {children}
    </motion.div>
  );
}

function Sheet({ title, children, onClose }: { title: string; children: ReactNode; onClose: () => void }) {
  useEffect(() => {
    const handler = (event: KeyboardEvent) => event.key === "Escape" && onClose();
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);
  return (
    <motion.div className="sheet-backdrop" role="presentation" onMouseDown={onClose} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      <motion.section
        className="sheet"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onMouseDown={(event) => event.stopPropagation()}
        initial={{ y: "100%" }}
        animate={{ y: 0 }}
        exit={{ y: "100%" }}
        transition={{ type: "spring", stiffness: 380, damping: 34 }}
      >
        <div className="sheet-handle" />
        <div className="sheet-header">
          <h2>{title}</h2>
          <IconButton label="关闭" onClick={onClose}><X size={20} /></IconButton>
        </div>
        {children}
      </motion.section>
    </motion.div>
  );
}

function OnlineNotice() {
  const [online, setOnline] = useState(true);
  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    update();
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);
  if (online) return null;
  return <div className="offline-notice"><WifiOff size={15} /> 网络不可用，已保存的步骤仍可继续</div>;
}

function AppFrame({ children }: { children: ReactNode }) {
  const viewportRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    const press = (event: PointerEvent) => {
      const origin = event.target instanceof Element ? event.target : null;
      const target = origin?.closest("button, .bottom-nav-item");
      if (!(target instanceof HTMLElement) || target.matches(":disabled") || target.dataset.noRipple === "true") return;
      const bounds = target.getBoundingClientRect();
      const diameter = Math.max(bounds.width, bounds.height) * 2.1;
      const ripple = document.createElement("span");
      ripple.className = "tap-ripple";
      ripple.style.width = `${diameter}px`;
      ripple.style.height = `${diameter}px`;
      ripple.style.left = `${event.clientX - bounds.left - diameter / 2}px`;
      ripple.style.top = `${event.clientY - bounds.top - diameter / 2}px`;
      target.appendChild(ripple);
      ripple.addEventListener("animationend", () => ripple.remove(), { once: true });
    };
    viewport.addEventListener("pointerdown", press);
    return () => viewport.removeEventListener("pointerdown", press);
  }, []);
  return (
    <div className="app-stage">
      <div className="phone-device">
        <div className="phone-canvas">
          <div className="dynamic-island" aria-hidden="true"><i /></div>
          <div className="phone-viewport" ref={viewportRef}>
            <OnlineNotice />
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}

function StartRoute() {
  const hydrated = useAppStore((state) => state.hydrated);
  const completed = useAppStore((state) => state.profile.completed);
  if (!hydrated) return <LoadingScreen />;
  return <Navigate to={completed ? "/home" : "/onboarding/age"} replace />;
}

function LoadingScreen() {
  return (
    <Screen className="skeleton-screen">
      <h1 className="sr-only">宝宝饱饱正在加载</h1>
      <div className="skeleton-header"><i /><i /></div>
      <div className="skeleton-line title" />
      <div className="skeleton-line pill" />
      <div className="skeleton-card"><i /><span /><span /><b /></div>
      <div className="skeleton-grid"><i /><i /></div>
    </Screen>
  );
}

const ageChoices = [6, 8, 10, 12, 18, 24];

function MonthPicker({ id, label, value, onChange, min = 0, max = 36 }: { id: string; label: string; value: string; onChange: (value: string) => void; min?: number; max?: number }) {
  const numericValue = Number(value);
  const update = (next: number) => onChange(String(Math.min(max, Math.max(min, next))));
  return (
    <div className="month-picker">
      <button type="button" aria-label={`${label}减 1 个月`} disabled={!value || numericValue <= min} onClick={() => update(numericValue - 1)}><Minus size={18} /></button>
      <label htmlFor={id}><input id={id} aria-label={label} inputMode="numeric" value={value} placeholder="—" onChange={(event) => onChange(event.target.value.replace(/\D/g, "").slice(0, 2))} /><span>个月</span></label>
      <button type="button" aria-label={`${label}加 1 个月`} disabled={numericValue >= max} onClick={() => update((numericValue || min) + 1)}><Plus size={18} /></button>
    </div>
  );
}

function OnboardingAge() {
  const navigate = useNavigate();
  const profile = useAppStore((state) => state.profile);
  const setProfile = useAppStore((state) => state.setProfile);
  const [name, setName] = useState(profile.name);
  const [months, setMonths] = useState(profile.months ? String(profile.months) : "");
  const [correctedMonths, setCorrectedMonths] = useState(profile.correctedMonths === null ? "" : String(profile.correctedMonths));
  const selectedAge = Number(months);
  const correctedAge = correctedMonths === "" ? null : Number(correctedMonths);
  const normalizedName = name.trim();
  const nameValid = normalizedName.length >= 1 && normalizedName.length <= 8;
  const ageValid = selectedAge >= 4 && selectedAge <= 36;
  const correctedValid = !profile.premature || correctedAge === null || (correctedAge >= 0 && correctedAge <= selectedAge);
  const continueToAvoid = () => {
    setProfile({ name: normalizedName, months: selectedAge, correctedMonths: profile.premature ? correctedAge : null, ageConfirmed: true });
    navigate("/onboarding/avoid");
  };
  return (
    <Screen className="onboarding-screen">
      <TopBar title="建立宝宝档案" eyebrow="1 / 3" />
      <ProgressSteps current={1} />
      <section className="onboarding-card">
        <ProfileIllustration assetId={resolveAgeProfileAsset(ageValid ? selectedAge : undefined)} size="hero" priority fallback={<div className="question-icon yellow"><Baby size={26} /></div>} />
        <h1>先认识一下宝宝</h1>
        <label className="field-label name-field-label" htmlFor="baby-name">平时怎么称呼宝宝？</label>
        <input className="onboarding-name-input" id="baby-name" value={name} maxLength={8} autoComplete="off" placeholder="例如：满满" onChange={(event) => setName(event.target.value)} />
        <span className="field-label age-field-label">宝宝现在多大了？</span>
        <small className="age-field-help">填写实际月龄。月龄只参与判断，不代表宝宝必须达到某个进食阶段。</small>
        <MonthPicker id="baby-age" label="宝宝月龄" min={4} value={months} onChange={setMonths} />
        <div className="age-shortcuts" aria-label="常用月龄">{ageChoices.map((age) => <button type="button" key={age} aria-pressed={selectedAge === age} className={cx(selectedAge === age && "selected")} onClick={() => setMonths(String(age))}>{age} 月</button>)}</div>
        {months && !ageValid && <p className="field-error"><AlertCircle size={14} />当前支持填写 4—36 个月</p>}
        <div className="onboarding-subquestion">
          <div><strong>宝宝是早产出生吗？</strong><small>用于判断是否需要参考纠正月龄</small></div>
          <div className="binary-choice"><button type="button" className={cx(!profile.premature && "selected")} aria-pressed={!profile.premature} onClick={() => { setProfile({ premature: false }); setCorrectedMonths(""); }}>不是</button><button type="button" className={cx(profile.premature && "selected")} aria-pressed={profile.premature} onClick={() => setProfile({ premature: true })}>是</button></div>
        </div>
        {profile.premature && <div className="corrected-age-panel"><div><strong>纠正月龄（可选）</strong><small>不确定可以先留空，之后再补充</small></div><MonthPicker id="corrected-age" label="纠正月龄" min={0} max={selectedAge || 36} value={correctedMonths} onChange={setCorrectedMonths} />{!correctedValid && <p className="field-error"><AlertCircle size={14} />纠正月龄不能大于实际月龄</p>}</div>}
      </section>
      <div className="screen-actions"><Button full disabled={!nameValid || !ageValid || !correctedValid} onClick={continueToAvoid}>继续填写不能吃的食材</Button><p>{!nameValid ? "请先填写宝宝的称呼" : "下一步只记录已经明确要避开的食材"}</p></div>
    </Screen>
  );
}

function ProgressSteps({ current }: { current: number }) {
  return (
    <div className="progress-steps" aria-label={`建档进度，第 ${current} 步，共 3 步`}>
      {[1, 2, 3].map((step) => <span key={step} className={cx(step <= current && "active")} />)}
    </div>
  );
}

const avoidOptions = ["牛奶", "鸡蛋", "花生", "坚果", "小麦", "大豆", "鱼", "虾蟹"];

function OnboardingAvoid() {
  const navigate = useNavigate();
  const profile = useAppStore((state) => state.profile);
  const setProfile = useAppStore((state) => state.setProfile);
  const [custom, setCustom] = useState("");
  const [confirmClear, setConfirmClear] = useState(false);
  const mode = profile.avoidStatus;
  const toggle = (food: string) => {
    const nextFoods = profile.avoidFoods.includes(food) ? profile.avoidFoods.filter((item) => item !== food) : [...profile.avoidFoods, food];
    setProfile({ avoidStatus: "has", avoidFoods: nextFoods });
  };
  const addCustom = () => {
    const value = custom.trim();
    if (value && !profile.avoidFoods.includes(value)) setProfile({ avoidStatus: "has", avoidFoods: [...profile.avoidFoods, value] });
    setCustom("");
  };
  const chooseNone = () => profile.avoidFoods.length ? setConfirmClear(true) : setProfile({ avoidStatus: "none", avoidFoods: [] });
  const avoidComplete = mode === "none" || (mode === "has" && profile.avoidFoods.length > 0);
  return (
    <Screen className="onboarding-screen">
      <TopBar title="建立宝宝档案" eyebrow="2 / 3" back="/onboarding/age" />
      <ProgressSteps current={2} />
      <section className="onboarding-card">
        <ProfileIllustration assetId={resolveAvoidProfileAsset(mode)} size="hero" priority fallback={<div className="question-icon pink"><ShieldAlert size={25} /></div>} />
        <h1>{profile.name}有哪些食材需要避开？</h1>
        <p>这里只记录已确认过敏、医生要求或家庭正在主动回避的食材。</p>
        <div className="avoid-mode-grid"><button type="button" className={cx(mode === "none" && "selected safe")} aria-pressed={mode === "none"} onClick={chooseNone}><CheckCircle2 size={20} /><span><strong>目前没有</strong><small>没有明确需要避开的食材</small></span></button><button type="button" className={cx(mode === "has" && "selected danger")} aria-pressed={mode === "has"} onClick={() => setProfile({ avoidStatus: "has" })}><ShieldAlert size={20} /><span><strong>有，需要填写</strong><small>选择或补充具体食材</small></span></button></div>
        {mode === "has" && <div className="avoid-details"><span className="field-label">常见食材</span><div className="choice-grid food-grid">{avoidOptions.map((food) => <button type="button" key={food} aria-pressed={profile.avoidFoods.includes(food)} className={cx("choice-chip", profile.avoidFoods.includes(food) && "selected-danger")} onClick={() => toggle(food)}>{food}</button>)}</div><label className="field-label" htmlFor="custom-avoid">其他需要避开的食材</label><div className="inline-input"><input id="custom-avoid" value={custom} placeholder="输入食材名称" onChange={(e) => setCustom(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addCustom(); } }} /><button type="button" disabled={!custom.trim()} onClick={addCustom}>添加</button></div>{profile.avoidFoods.length > 0 && <div className="selected-tags">{profile.avoidFoods.map((food) => <span key={food}>{food}<button type="button" aria-label={`移除${food}`} onClick={() => toggle(food)}><X size={13} /></button></span>)}</div>}{profile.avoidFoods.length === 0 && <p className="selection-hint">至少选择或添加一种食材，才能继续。</p>}</div>}
        <div className="info-note explain-note"><Info size={16} /><span><strong>“没吃过”不等于“不能吃”</strong>尚未尝试的食材会在分析具体视频时单独确认，不需要在这里全部填写。</span></div>
      </section>
      <div className="screen-actions"><Button full disabled={!avoidComplete} onClick={() => navigate("/onboarding/stage")}>继续选择进食能力</Button><p>疾病或医生要求请始终以专业意见为准</p></div>
      <AnimatePresence>{confirmClear && <Sheet title="清除已选食材？" onClose={() => setConfirmClear(false)}><div className="sheet-content"><p>选择“目前没有”会清除已选的 {profile.avoidFoods.join("、")}。</p><Button full variant="danger" onClick={() => { setProfile({ avoidStatus: "none", avoidFoods: [] }); setConfirmClear(false); }}>清除并选择“目前没有”</Button><Button full variant="ghost" onClick={() => setConfirmClear(false)}>保留已选食材</Button></div></Sheet>}</AnimatePresence>
    </Screen>
  );
}

const stageOptions = [
  { value: "puree" as const, title: "刚开始吃辅食", desc: "目前稳定吃顺滑、没有颗粒的泥糊" },
  { value: "thick-puree" as const, title: "能吃稠泥和细碎食物", desc: "可以稳定处理较稠泥糊和很细软的小碎末" },
  { value: "soft-lumps" as const, title: "能吃压软的小颗粒", desc: "可以用牙龈压碎软颗粒和较软碎食" },
  { value: "finger-food" as const, title: "能吃软手指食物", desc: "可以抓握并处理一捏就软、容易压碎的食物" },
];

const feedingSignalOptions: Array<{ value: FeedingSignal; label: string }> = [
  { value: "gagging", label: "经常干呕" },
  { value: "spitting", label: "常把食物顶出或吐出来" },
  { value: "texture-refusal", label: "明显抗拒颗粒" },
  { value: "swallowing-difficulty", label: "吞咽看起来费力" },
];

function OnboardingStage() {
  const navigate = useNavigate();
  const profile = useAppStore((state) => state.profile);
  const setProfile = useAppStore((state) => state.setProfile);
  const finish = useAppStore((state) => state.finishOnboarding);
  const chooseStage = (stage: FeedingStage) => setProfile({ stage, stageConfirmed: true });
  const toggleSignal = (signal: FeedingSignal) => {
    const next = profile.feedingSignals.includes(signal) ? profile.feedingSignals.filter((item) => item !== signal) : [...profile.feedingSignals, signal];
    setProfile({ feedingSignals: next, feedingSignalsConfirmed: true });
  };
  const complete = profile.stageConfirmed && profile.feedingSignalsConfirmed;
  return (
    <Screen className="onboarding-screen">
      <TopBar title="建立宝宝档案" eyebrow="3 / 3" back="/onboarding/avoid" />
      <ProgressSteps current={3} />
      <section className="onboarding-card">
        <ProfileIllustration assetId={profile.stageConfirmed ? resolveTextureProfileAsset(profile.stage) : "age-default"} size="hero" priority fallback={<div className="question-icon mint"><UtensilsCrossed size={25} /></div>} />
        <h1>{profile.name}现在能稳定吃什么？</h1>
        <p>不要按月龄推测。选择宝宝多数时候能顺利处理的最高阶段；介于两项之间时选前一项。</p>
        <div className="stage-list">
          {stageOptions.map((option) => (
            <button type="button" key={option.value} aria-pressed={profile.stageConfirmed && profile.stage === option.value} className={cx("stage-choice", profile.stageConfirmed && profile.stage === option.value && "selected")} onClick={() => chooseStage(option.value)}>
              <span className="stage-choice-copy"><strong>{option.title}</strong><small>{option.desc}</small></span>
              <span className="radio-dot">{profile.stageConfirmed && profile.stage === option.value && <i />}</span>
            </button>
          ))}
        </div>
        <div className="feeding-followup"><div><strong>最近常出现这些情况吗？</strong><small>可多选；用于让后续质地建议更保守</small></div><div className="signal-grid">{feedingSignalOptions.map((option) => <button type="button" key={option.value} aria-pressed={profile.feedingSignals.includes(option.value)} className={cx(profile.feedingSignals.includes(option.value) && "selected")} onClick={() => toggleSignal(option.value)}>{profile.feedingSignals.includes(option.value) && <Check size={14} />}{option.label}</button>)}<button type="button" className={cx(profile.feedingSignalsConfirmed && profile.feedingSignals.length === 0 && "selected safe")} aria-pressed={profile.feedingSignalsConfirmed && profile.feedingSignals.length === 0} onClick={() => setProfile({ feedingSignals: [], feedingSignalsConfirmed: true })}>{profile.feedingSignalsConfirmed && profile.feedingSignals.length === 0 && <Check size={14} />}暂时没有以上情况</button></div><label htmlFor="feeding-note">还有什么想补充？<span>可选</span></label><textarea id="feeding-note" value={profile.feedingNote} placeholder="例如：偶尔能吃颗粒，累的时候会吐出来" onChange={(event) => setProfile({ feedingNote: event.target.value.slice(0, 120) })} /></div>
        {profile.feedingSignals.includes("swallowing-difficulty") && <div className="info-note risk-note"><ShieldAlert size={17} /><span>已记下吞咽费力。后续建议会优先采用更保守的质地；若持续出现或伴随其他异常，应咨询专业人员。</span></div>}
      </section>
      <div className="screen-actions"><Button full disabled={!complete} onClick={() => { finish(); navigate("/home"); }}>完成{profile.name}的档案</Button><p>{!profile.stageConfirmed ? `请先选择${profile.name}稳定能处理的阶段` : !profile.feedingSignalsConfirmed ? "请确认最近是否有进食困难" : "之后可以在宝宝档案中随时修改"}</p></div>
    </Screen>
  );
}

// FRONTEND PLACEHOLDER DATA: 推荐服务接入前，只用于验证首页信息架构；不作为食物安全结论。
const homeInspirationIdeas = [
  { id: "tomato-pork-greens-rice", title: "番茄肉酱青菜焖饭", time: "约 20 分钟", duration: "1:28", source: "测试视频 1", image: "/home/inspiration/tomato-pork-greens-rice.webp", foodId: "carrot" as FoodId, note: "肉酱拌进软饭，青菜最后加入", ingredients: "米饭、番茄、猪肉、青菜", steps: [
    { actionKind: "prepare", timing: "准备", title: "处理番茄、肉和青菜", instruction: "番茄去皮切碎，猪肉处理成细肉末，青菜焯软后切细。", check: "肉末没有明显筋膜，青菜没有长梗。" },
    { actionKind: "heat", timing: "约 15 分钟", title: "煮成软烂肉酱饭", instruction: "肉末炒散后加入番茄和米饭，加适量水焖至软烂。", check: "猪肉完全熟透，米粒能被勺背轻松压开。" },
    { actionKind: "serve", timing: "约 2 分钟", title: "拌入青菜并放凉", instruction: "拌入青菜碎，按宝宝当前能力压散大块并放凉。", check: "整碗没有肉团或硬块，温度适宜。" },
  ] },
  { id: "pumpkin-beef-rice", title: "南瓜牛肉焖饭", time: "约 20 分钟", duration: "0:26", source: "测试视频 2", image: "/home/inspiration/pumpkin-beef-rice.webp", foodId: "pumpkin" as FoodId, note: "南瓜软甜，牛肉切细后焖熟", ingredients: "胚芽米、南瓜、牛肉、西兰花", steps: [
    { actionKind: "prepare", timing: "准备", title: "切细牛肉和南瓜", instruction: "牛肉切成细末，南瓜切小丁，西兰花焯软后切细。", check: "牛肉没有明显筋膜，南瓜块大小接近。" },
    { actionKind: "heat", timing: "约 16 分钟", title: "把食材和米饭焖软", instruction: "牛肉炒散后加入南瓜和米，按视频做法加水焖至软烂。", check: "牛肉完全熟透，南瓜和米粒都能轻松压开。" },
    { actionKind: "serve", timing: "约 2 分钟", title: "拌入西兰花并检查", instruction: "拌入西兰花碎，调整稠度并放凉。", check: "没有硬块或肉团，温度适宜。" },
  ] },
  { id: "tomato-potato-beef-rice", title: "番茄土豆牛肉焖饭", time: "约 25 分钟", duration: "0:54", source: "测试视频 3", image: "/home/inspiration/tomato-potato-beef-rice.webp", foodId: "potato" as FoodId, note: "一锅焖出菜、肉和主食", ingredients: "大米、土豆、番茄、西葫芦、牛肉", steps: [
    { actionKind: "prepare", timing: "准备", title: "切好蔬菜和牛肉", instruction: "土豆、番茄和西葫芦切成适合宝宝的小丁，牛肉切细。", check: "食材大小接近，牛肉没有明显筋膜。" },
    { actionKind: "mix", timing: "约 2 分钟", title: "食材放入锅中拌匀", instruction: "把大米、蔬菜和牛肉放入锅中，加适量水和少量油拌匀。", check: "牛肉已经分散，没有结成大团。" },
    { actionKind: "heat", timing: "约 20 分钟", title: "焖熟并检查软度", instruction: "焖至米饭和食材完全熟透，出锅前充分翻拌。", check: "牛肉中心熟透，土豆和米粒都能轻松压开。" },
  ] },
  { id: "black-sesame-egg-custard", title: "黑芝麻红枣蒸蛋", time: "约 25 分钟", duration: "0:48", source: "测试视频 4", image: "/home/inspiration/black-sesame-egg-custard.webp", foodId: "egg" as FoodId, note: "细腻蒸蛋搭配黑芝麻米糊", ingredients: "鸡蛋、黑芝麻、胚芽米、红枣", steps: [
    { actionKind: "prepare", timing: "准备", title: "打好黑芝麻红枣米糊", instruction: "黑芝麻、胚芽米和去皮去核红枣加水打细。", check: "米糊细腻，没有明显硬颗粒和枣核。" },
    { actionKind: "mix", timing: "约 3 分钟", title: "调好蛋液", instruction: "鸡蛋打散后加入适量温水或配方奶，轻轻混匀。", check: "蛋液均匀，没有大块蛋白。" },
    { actionKind: "heat", timing: "约 20 分钟", title: "蒸熟后加入米糊", instruction: "蛋液加盖蒸至完全凝固，再把黑芝麻米糊铺在表面。", check: "蒸蛋中心完全凝固，放凉后再入口。" },
  ] },
  { id: "spinach-vegetable-egg-custard", title: "菠菜时蔬蛋羹", time: "约 15 分钟", duration: "0:35", source: "测试视频 5", image: "/home/inspiration/spinach-vegetable-egg-custard.webp", foodId: "spinach" as FoodId, note: "菠菜和胡萝卜藏进软嫩蛋羹", ingredients: "鸡蛋、菠菜、胡萝卜", steps: [
    { actionKind: "prepare", timing: "准备", title: "焯软蔬菜并切细", instruction: "菠菜和胡萝卜焯熟，分别切成细碎。", check: "菠菜没有长纤维，胡萝卜已经变软。" },
    { actionKind: "mix", timing: "约 2 分钟", title: "蔬菜拌入蛋液", instruction: "鸡蛋充分打散，加入蔬菜碎拌匀后倒入耐热容器。", check: "蔬菜分布均匀，没有成团。" },
    { actionKind: "heat", timing: "约 10 分钟", title: "蒸熟并切成软条", instruction: "加盖蒸至中心完全凝固，放凉后切成适合抓握的软条。", check: "中心没有流动蛋液，手指能轻松压碎。" },
  ] },
  { id: "potato-apple-cake", title: "土豆苹果饼", time: "约 15 分钟", duration: "0:48", source: "测试视频 6", image: "/home/inspiration/potato-apple-cake.webp", foodId: "apple" as FoodId, note: "软糯小饼，掰开能看见苹果丁", ingredients: "土豆、苹果、黑芝麻", steps: [
    { actionKind: "prepare", timing: "准备", title: "蒸软土豆并切苹果", instruction: "土豆切片蒸至软透后压成泥，苹果去皮切成细小丁。", check: "土豆泥没有硬块，苹果丁大小均匀。" },
    { actionKind: "mix", timing: "约 3 分钟", title: "包入苹果丁并整形", instruction: "土豆泥分成小份，包入苹果丁后压成薄而均匀的小饼。", check: "小饼厚薄接近，边缘没有裂开。" },
    { actionKind: "heat", timing: "约 8 分钟", title: "小火煎熟两面", instruction: "表面撒少量黑芝麻，小火煎至两面定型并熟透。", check: "掰开后内部热透，小饼能用手指轻松压扁。" },
  ] },
] as const;

function inspirationIdeaById(id?: string) {
  return homeInspirationIdeas.find((idea) => idea.id === id);
}

function recipeTitleById(id: string) {
  return id === tomatoRiceAnalysis.id ? tomatoRiceAnalysis.title : inspirationIdeaById(id)?.title || "宝宝虾滑面";
}

function formatImportFileSize(bytes: number) {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / 1024 / 1024).toFixed(bytes >= 10 * 1024 * 1024 ? 0 : 1)} MB`;
}

function LocalVideoPreview({ file }: { file: File }) {
  const previewUrl = useMemo(() => URL.createObjectURL(file), [file]);
  const [failedUrl, setFailedUrl] = useState("");
  const previewFailed = failedUrl === previewUrl;
  useEffect(() => () => URL.revokeObjectURL(previewUrl), [previewUrl]);
  return <div className="home-file-preview-player">
    {!previewFailed ? <video src={previewUrl} controls playsInline preload="metadata" aria-label={`${file.name} 视频预览`} onError={() => setFailedUrl(previewUrl)}>你的浏览器暂不支持视频预览。</video> : <div className="home-file-preview-fallback"><FileQuestion size={24} /><strong>当前浏览器无法预览这个视频</strong><span>文件仍可继续上传分析</span></div>}
  </div>;
}

function HomePage() {
  const navigate = useNavigate();
  const profile = useAppStore((state) => state.profile);
  const history = useAppStore((state) => state.history);
  const cookPrepared = useAppStore((state) => state.cookPrepared);
  const riskInterrupted = useAppStore((state) => state.riskInterrupted);
  const completedSteps = useAppStore((state) => state.completedSteps);
  const cookConversation = useAppStore((state) => state.cookConversation);
  const [url, setUrl] = useState("");
  const [error, setError] = useState("");
  const [importMode, setImportMode] = useState<"link" | "file">("link");
  const [importFiles, setImportFiles] = useState<File[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [startingInspirationId, setStartingInspirationId] = useState("");
  const [inspirationError, setInspirationError] = useState("");
  const [uploadPercent, setUploadPercent] = useState(0);
  const [agentPull, setAgentPull] = useState(0);
  const agentPullTriggerDistance = 240;
  const agentPullMaxDistance = 340;
  const agentGesture = useRef({ active: false, startY: 0 });
  const inspirationDrag = useRef({ active: false, startX: 0, scrollLeft: 0, moved: false });
  const suppressInspirationClick = useRef(false);
  const agentPullProgress = Math.min(agentPull / agentPullTriggerDistance, 1);
  const startAgentPull = (event: React.PointerEvent<HTMLDivElement>) => {
    if ((event.target as HTMLElement).closest(".profile-pill, .home-scroll-cue")) return;
    if (event.pointerType === "mouse" && event.button !== 0) return;
    agentGesture.current = { active: true, startY: event.clientY };
    event.currentTarget.setPointerCapture(event.pointerId);
  };
  const updateAgentPull = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!agentGesture.current.active) return;
    const distance = Math.max(0, Math.min(agentPullMaxDistance, event.clientY - agentGesture.current.startY));
    setAgentPull(distance);
  };
  const finishAgentPull = () => {
    if (!agentGesture.current.active) return;
    agentGesture.current.active = false;
    if (agentPull >= agentPullTriggerDistance) {
      navigate("/agent", { state: { transition: "agent" } });
      return;
    }
    setAgentPull(0);
  };
  const startInspirationDrag = (event: React.PointerEvent<HTMLDivElement>) => {
    if (event.pointerType !== "mouse" || event.button !== 0) return;
    if ((event.target as HTMLElement).closest("button, a, input")) return;
    inspirationDrag.current = { active: true, startX: event.clientX, scrollLeft: event.currentTarget.scrollLeft, moved: false };
    event.currentTarget.setPointerCapture(event.pointerId);
    event.currentTarget.dataset.dragging = "true";
  };
  const moveInspirationDrag = (event: React.PointerEvent<HTMLDivElement>) => {
    const drag = inspirationDrag.current;
    if (!drag.active) return;
    const distance = event.clientX - drag.startX;
    if (Math.abs(distance) > 5) drag.moved = true;
    if (!drag.moved) return;
    event.preventDefault();
    event.currentTarget.scrollLeft = drag.scrollLeft - distance;
  };
  const finishInspirationDrag = (event: React.PointerEvent<HTMLDivElement>) => {
    const drag = inspirationDrag.current;
    if (!drag.active) return;
    drag.active = false;
    delete event.currentTarget.dataset.dragging;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    if (!drag.moved) return;
    suppressInspirationClick.current = true;
    window.setTimeout(() => { suppressInspirationClick.current = false; }, 0);
  };
  const preventClickAfterInspirationDrag = (event: React.MouseEvent<HTMLDivElement>) => {
    if (!suppressInspirationClick.current) return;
    event.preventDefault();
    event.stopPropagation();
    suppressInspirationClick.current = false;
  };
  const pasteLink = async () => {
    try {
      const value = await navigator.clipboard.readText();
      if (!value.trim()) {
        setError("剪贴板里没有链接");
        return;
      }
      setUrl(value.trim());
      setError("");
    } catch {
      setError("无法读取剪贴板，请长按输入框粘贴");
    }
  };
  const chooseImportFiles = (event: ChangeEvent<HTMLInputElement>) => {
    const selected = Array.from(event.currentTarget.files ?? []);
    event.currentTarget.value = "";
    if (!selected.length) return;
    const validationError = validateImportFiles(selected);
    if (validationError) return setError(validationError);
    setImportFiles(selected);
    setError("");
  };
  const beginTestVideoExample = async () => {
    if (submitting) return;
    if (!profile.completed) {
      setError("请先完成宝宝档案，再生成个性化宝宝版本");
      return;
    }
    try {
      setSubmitting(true);
      setError("");
      const job = await createCatalogAnalysisJob("tomato-pork-greens-rice", profile);
      sessionStorage.setItem("baobao:last-analysis-job", job.jobId);
      navigate(`/analysis/${job.jobId}`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "无法加载测试视频 1");
      setSubmitting(false);
    }
  };
  const submit = async (event?: FormEvent) => {
    event?.preventDefault();
    if (submitting) return;
    if (!profile.completed) {
      setError("请先完成宝宝档案，再生成个性化宝宝版本");
      return;
    }
    if (importMode === "file") {
      const file = importFiles[0];
      if (!file) {
        setError("请先选择一个 MP4 或 MOV 视频");
        return;
      }
      try {
        setSubmitting(true);
        const job = await createAnalysisJob(file, profile, setUploadPercent);
        sessionStorage.setItem("baobao:last-analysis-job", job.jobId);
        navigate(`/analysis/${job.jobId}`);
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : "创建分析任务失败");
        setSubmitting(false);
      }
      return;
    }
    if (!/https?:\/\//.test(url.trim())) {
      setError("请粘贴包含 http:// 或 https:// 链接的分享内容");
      return;
    }
    try {
      setSubmitting(true);
      const job = await createUrlAnalysisJob(url.trim(), profile);
      sessionStorage.setItem("baobao:last-analysis-job", job.jobId);
      navigate(`/analysis/${job.jobId}`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "创建分析任务失败");
      setSubmitting(false);
    }
  };
  const beginInspirationAnalysis = async (idea: (typeof homeInspirationIdeas)[number]) => {
    if (startingInspirationId) return;
    if (!profile.completed) {
      navigate("/baby");
      return;
    }
    try {
      setStartingInspirationId(idea.id);
      setInspirationError("");
      const job = await createCatalogAnalysisJob(idea.id, profile);
      sessionStorage.setItem("baobao:last-analysis-job", job.jobId);
      navigate(`/analysis/${job.jobId}`);
    } catch (cause) {
      setInspirationError(cause instanceof Error ? cause.message : "无法读取这条视频的分析结果");
      setStartingInspirationId("");
    }
  };
  const hasCookingSession = cookPrepared || completedSteps.length > 0 || cookConversation.length > 0 || riskInterrupted;
  const pendingObservation = history.find((item) => item.progress === "completed" && item.feedback && !item.feedback.observed);
  const hasNextTask = hasCookingSession || Boolean(pendingObservation);
  return (
    <Screen className="home-screen has-bottom-nav">
      <div
        className={cx("home-hero", agentPull > 0 && "is-agent-pulling", agentPullProgress >= 1 && "is-agent-ready")}
        style={{ "--agent-pull": `${agentPull}px`, "--agent-progress": agentPullProgress, paddingBottom: 20 + agentPull * .34 } as CSSProperties}
        onPointerDown={startAgentPull}
        onPointerMove={updateAgentPull}
        onPointerUp={finishAgentPull}
        onPointerCancel={() => { agentGesture.current.active = false; setAgentPull(0); }}
      >
        <div className="agent-pull-cue" aria-hidden="true"><MessageCircle size={13} /><span>{agentPullProgress >= 1 ? `松开，和${profile.name}聊聊` : agentPullProgress >= .55 ? "继续下拉，再一点点" : `下拉，和${profile.name}聊聊`}</span><i /></div>
        <header className="home-header">
          <div><h1>今天给{profile.name}做什么？</h1></div>
        </header>
        <button type="button" className="baby-avatar" style={{ right: `calc(3px + ${agentPullProgress * 36}%)`, bottom: `${-7 + agentPullProgress * 43}px`, transform: `scale(${1 + agentPullProgress * .5})` }} onClick={() => navigate("/agent")} aria-label={`和${profile.name}的辅食小助手对话`}><Suspense fallback={<span className="home-character-motion is-fallback"><picture className="home-character-poster"><img src="/illustrations/ip/v2/home-chick-poster.png" width="256" height="256" alt="" decoding="sync" /></picture></span>}><HomeCharacterAnimation /></Suspense></button>
        <button type="button" className="profile-pill" onClick={() => navigate("/baby")} aria-label={`查看${profile.name}的宝宝档案`}><Baby size={15} /><span>{profile.name} · {profile.months} 个月 · {stageLabels[profile.stage]}</span><ChevronRight size={15} /></button>
        <button type="button" className="home-scroll-cue" data-no-ripple="true" aria-label="向下浏览首页内容" onClick={(event) => event.currentTarget.closest("main")?.scrollBy({ top: 320, behavior: "smooth" })}><ChevronDown size={20} strokeWidth={2.4} /></button>
      </div>
      <section className="home-dashboard-grid home-dashboard-grid-top" aria-label="计划与探索">
        <button className="home-dashboard-card plan" onClick={() => navigate("/plan")}>
          <span className="home-dashboard-icon"><CalendarDays size={19} /></span>
          <small>计划参考</small>
          <strong>看看 {weeklyMeals.length} 天搭配</strong>
          <em>开始安排 <ChevronRight size={13} /></em>
          <img className="home-dashboard-decoration" src="/illustrations/ip/v1/plan-160.webp" alt="" aria-hidden="true" />
        </button>
        <button className="home-dashboard-card food-map" onClick={() => navigate("/food-map")}>
          <span className="home-dashboard-icon"><Map size={19} /></span>
          <small>食物探索地图</small>
          <strong>已记录 {profile.triedFoods.length} 种</strong>
          <em>继续探索 <ChevronRight size={13} /></em>
          <img className="home-dashboard-decoration" src="/illustrations/ip/v1/explore-160.webp" alt="" aria-hidden="true" />
        </button>
      </section>
      <section className="home-primary-flow" aria-label="内容导入">
        <div className="home-section-heading home-import-heading"><div><h2>导入辅食视频</h2></div></div>
        <form className="paste-card home-import-card" onSubmit={submit}>
          <div className="home-import-tabs" role="tablist" aria-label="内容导入方式"><button type="button" role="tab" aria-selected={importMode === "link"} className={cx(importMode === "link" && "active")} onClick={() => { setImportMode("link"); setError(""); }}><Link2 size={15} />粘贴链接</button><button type="button" role="tab" aria-selected={importMode === "file"} className={cx(importMode === "file" && "active")} onClick={() => { setImportMode("file"); setError(""); }}><Upload size={15} />选择文件</button></div>
          <div className={cx("home-import-body", importMode === "file" && importFiles.length > 0 && "has-preview")}>
            {importMode === "link" ? <><label htmlFor="video-url" className="sr-only">视频链接</label><div className={cx("url-field", error && "invalid")}><input id="video-url" value={url} placeholder="粘贴抖音分享链接或视频直链" onChange={(e) => { setUrl(e.target.value); setError(""); }} /><button type="button" onClick={pasteLink}>粘贴</button></div><button className="home-example-link" type="button" disabled={submitting} onClick={() => void beginTestVideoExample()}><Play size={12} />没有链接？试试测试视频 1 示例</button></> : <div className="home-file-import"><input className="sr-only" id="home-content-files" type="file" accept=".mp4,.mov,video/mp4,video/quicktime" onChange={chooseImportFiles} />{importFiles.length === 0 ? <label className={cx("home-file-picker", error && "invalid")} htmlFor="home-content-files"><Upload size={19} /><span><strong>选择本地视频</strong><small>MP4 / MOV · 最大 200MB</small></span></label> : <div className="home-file-preview" aria-live="polite">{importFiles.map((file, index) => <article key={`${file.name}-${file.size}-${index}`}><div className="home-file-preview-media"><LocalVideoPreview file={file} /><button type="button" aria-label={`移除 ${file.name}`} onClick={() => setImportFiles((files) => files.filter((_, fileIndex) => fileIndex !== index))}><Trash2 size={16} /></button></div><div className="home-file-preview-info"><span><FileIcon size={17} /></span><div><strong>{file.name}</strong><small>本地视频 · {formatImportFileSize(file.size)}</small></div></div></article>)}<label htmlFor="home-content-files"><RefreshCw size={14} />重新选择</label></div>}<button className="home-example-link" type="button" disabled={submitting} onClick={() => void beginTestVideoExample()}><Play size={12} />没有文件？试试测试视频 1 示例</button></div>}
            {error && <p className="field-error"><AlertCircle size={14} />{error}</p>}
          </div>
          <Button className="home-analysis-button" full type="submit" disabled={submitting} variant="primary" icon={<Sparkles size={17} />}>{submitting ? uploadPercent > 0 && uploadPercent < 100 ? `上传中 ${uploadPercent}%` : "正在创建任务…" : "开始分析"}</Button>
        </form>
      </section>
      <section className="home-inspiration-section">
        <div className="home-section-heading home-inspiration-heading"><div><h2>今日辅食灵感</h2></div></div>
        <div className="home-inspiration-track" role="region" aria-label="辅食灵感列表" tabIndex={0} onPointerDown={startInspirationDrag} onPointerMove={moveInspirationDrag} onPointerUp={finishInspirationDrag} onPointerCancel={finishInspirationDrag} onClickCapture={preventClickAfterInspirationDrag}>
          {homeInspirationIdeas.map((idea, index) => <article className="home-idea-card" key={idea.id}>
            <div className="home-idea-media">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={idea.image} width="640" height="400" alt={`${idea.title}成品`} loading={index === 0 ? "eager" : "lazy"} decoding="async" draggable={false} />
              <span className="home-idea-source">{idea.source}</span><span className="home-idea-duration"><Play size={10} fill="currentColor" />{idea.duration}</span>
            </div>
            <div className="home-idea-copy"><h3>{idea.title}</h3><p>{idea.note}</p><span className="home-idea-time"><Clock3 size={12} />{idea.time}</span></div>
            <button aria-label={`开始制作${idea.title}`} disabled={Boolean(startingInspirationId)} onClick={() => void beginInspirationAnalysis(idea)}><Play size={12} fill="currentColor" />{startingInspirationId === idea.id ? "正在准备分析…" : "开始制作"}</button>
          </article>)}
        </div>
        {inspirationError && <p className="field-error" role="alert"><AlertCircle size={14} />{inspirationError}</p>}
      </section>
      {!hasNextTask && <section className="home-calm-note"><CharacterIllustration intent="neutral" size="avatar" animate={false} /><div><strong>今天没有待处理任务</strong><p>小鸡仔可以休息一下，或者从一条辅食内容开始。</p></div></section>}
    </Screen>
  );
}

type AgentChatMessage = { id: string; role: "assistant" | "user"; text: string; tone?: "risk" };

function BabyAgentPage() {
  const navigate = useNavigate();
  const profile = useAppStore((state) => state.profile);
  const [input, setInput] = useState("");
  const [thinking, setThinking] = useState(false);
  const [agentError, setAgentError] = useState("");
  const [failedQuestion, setFailedQuestion] = useState("");
  const [messages, setMessages] = useState<AgentChatMessage[]>([
    { id: "welcome", role: "assistant", text: "你可以问我今天吃什么、食物质地，或把正在担心的情况直接告诉我。" },
  ]);
  const timelineRef = useRef<HTMLDivElement>(null);
  const requestRef = useRef<AbortController | null>(null);
  const suggestions = ["今天吃什么？", "现在适合什么质地？", `${profile.name}吃过哪些食材？`];

  useEffect(() => {
    timelineRef.current?.scrollTo({ top: timelineRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, thinking]);
  useEffect(() => () => requestRef.current?.abort(), []);

  const ask = async (value = input) => {
    const question = value.trim();
    if (!question || thinking) return;
    const userMessage: AgentChatMessage = { id: crypto.randomUUID(), role: "user", text: question };
    const requestMessages = [...messages, userMessage].slice(-12).map(({ role, text }) => ({ role, text }));
    setMessages((current) => [...current, userMessage]);
    setInput("");
    setAgentError("");
    setFailedQuestion("");
    setThinking(true);
    const controller = new AbortController();
    requestRef.current = controller;
    const assistantId = crypto.randomUUID();
    let started = false;
    try {
      const answer = await streamBabyAgent(requestMessages, profile, (delta) => {
        if (!started) {
          started = true;
          setThinking(false);
          setMessages((current) => [...current, { id: assistantId, role: "assistant", text: delta }]);
          return;
        }
        setMessages((current) => current.map((message) => message.id === assistantId ? { ...message, text: message.text + delta } : message));
      }, controller.signal);
      if (/呼吸困难|明显肿胀|紧急医疗|立即就医|急救/.test(answer)) {
        setMessages((current) => current.map((message) => message.id === assistantId ? { ...message, tone: "risk" } : message));
      }
    } catch (error) {
      if (controller.signal.aborted) return;
      setAgentError(error instanceof Error ? error.message : "暂时无法连接，请稍后重试");
      setFailedQuestion(question);
    } finally {
      setThinking(false);
      if (requestRef.current === controller) requestRef.current = null;
    }
  };

  return <Screen className="baby-agent-screen">
    <header className="agent-topbar"><IconButton label="返回首页" onClick={() => navigate("/home", { state: { transition: "back" } })}><ArrowLeft size={20} /></IconButton><div><strong>{profile.name}的辅食小助手</strong></div><IconButton label="查看宝宝档案" onClick={() => navigate("/baby")}><Baby size={19} /></IconButton></header>
    <section className="agent-identity" aria-label={`${profile.name}的辅食小助手`}>
      <div className="agent-character"><Suspense fallback={<img /* eslint-disable-line @next/next/no-img-element */ src="/illustrations/ip/v2/home-chick-poster.png" width="256" height="256" alt="" />}><HomeCharacterAnimation /></Suspense></div>
      <div><h1>想问我什么？</h1><p>我会结合宝宝档案回答，不替代医生判断</p><div className="agent-profile-strip"><b>{profile.months} 个月</b><i /><b>{stageLabels[profile.stage]}</b><i /><b>已记录 {profile.triedFoods.length} 种食材</b></div></div>
    </section>
    <div className="agent-conversation" ref={timelineRef} aria-live="polite">
      {messages.map((message) => message.role === "user" ? <UserMessage key={message.id}>{message.text}</UserMessage> : <AssistantMessage key={message.id} tone={message.tone === "risk" ? "risk" : undefined} intent={message.tone === "risk" ? "paused" : "welcome"}><p>{message.text}</p></AssistantMessage>)}
      {thinking && <AssistantMessage><div className="conversation-thinking"><i /><i /><i /></div></AssistantMessage>}
    </div>
    <div className="agent-dock">
      {agentError && <div className="agent-error" role="alert"><WifiOff size={14} /><span>{agentError}</span>{failedQuestion && <button type="button" onClick={() => void ask(failedQuestion)}>重试</button>}</div>}
      {messages.length <= 1 && <div className="agent-suggestions">{suggestions.map((suggestion) => <button type="button" key={suggestion} onClick={() => void ask(suggestion)}>{suggestion}</button>)}</div>}
      <form className="agent-composer" onSubmit={(event) => { event.preventDefault(); void ask(); }}><input value={input} onChange={(event) => setInput(event.target.value)} placeholder={thinking ? "正在回答…" : `问问${profile.name}的辅食助手…`} maxLength={300} aria-label="输入问题" /><button type="submit" disabled={!input.trim() || thinking} aria-label="发送"><Send size={18} /></button></form>
      <p>涉及呼吸困难、明显肿胀或持续呕吐，请立即寻求专业帮助</p>
    </div>
  </Screen>;
}

// FRONTEND PLACEHOLDER DATA: AI 接入后由计划生成与视频检索服务替换。
const weeklyMeals = [
  { id: "pumpkin-soft-rice", day: "周一", title: "南瓜牛肉软饭", note: "熟悉食材 · 约 20 分钟", searchQuery: "南瓜 牛肉 软饭" },
  { id: "vegetable-custard", day: "周二", title: "菠菜时蔬蛋羹", note: "软嫩快手 · 约 15 分钟", searchQuery: "菠菜 鸡蛋 蛋羹" },
  { id: "tomato-beef-rice", day: "周四", title: "番茄牛肉焖饭", note: "补充肉类变化 · 约 20 分钟", searchQuery: "番茄 牛肉 焖饭" },
  { id: "apple-finger-food", day: "周六", title: "土豆苹果软饼", note: "可提前备好 · 约 15 分钟", searchQuery: "土豆 苹果 软饼" },
  { id: "pork-greens-rice", day: "周日", title: "番茄肉酱青菜软饭", note: "熟悉口味收尾 · 约 20 分钟", searchQuery: "番茄 猪肉 青菜 软饭" },
];

function weeklyMealById(id?: string) {
  return weeklyMeals.find((meal) => meal.id === id);
}

const pathSides = ["left", "right", "right", "left"] as const;

function foodConnectorPath(from: "left" | "right", to: "left" | "right") {
  const startX = from === "left" ? 102 : 218;
  const endX = to === "left" ? 102 : 218;
  const controlX = from === to ? (from === "left" ? 166 : 154) : 160;
  return `M ${startX} 43 C ${controlX} 58, ${controlX} 142, ${endX} 158`;
}

function PlanSetupPage() {
  const navigate = useNavigate();
  const profile = useAppStore((state) => state.profile);
  const [horizon, setHorizon] = useState("7days");
  const [meals, setMeals] = useState("5");
  const [rhythm, setRhythm] = useState("mixed");
  const [newFood, setNewFood] = useState("one");
  const horizons = [{ id: "today", label: "今天", detail: "解决这一顿" }, { id: "7days", label: "未来 7 天", detail: "最适合日常安排", recommend: true }, { id: "4weeks", label: "未来 4 周", detail: "看方向，不排满每天" }];
  const label = horizon === "today" ? "生成今天方案" : horizon === "4weeks" ? "生成 4 周方向" : "生成 7 天方案";
  return <Screen className="planning-screen collapsible-title-screen"><TopBar title="安排辅食" back="/home" />
    <section className="planning-intro"><h1>安排多远？</h1><p>按{profile.name}的档案和家里的节奏生成。</p></section>
    <section className="profile-source"><Baby size={18} /><div><strong>{profile.name} · {profile.months} 个月</strong><small>{stageLabels[profile.stage]} · 当前无已确认回避</small></div><button onClick={() => navigate("/baby")}>查看</button></section>
    <section className="planning-block"><header><div><h2>计划范围</h2></div></header><div className="horizon-options">{horizons.map((item) => <button key={item.id} className={cx(horizon === item.id && "selected")} onClick={() => setHorizon(item.id)}><span>{item.recommend && "推荐"}</span><strong>{item.label}</strong><small>{item.detail}</small></button>)}</div></section>
    <section className="planning-block compact"><header><div><h2>做饭方式</h2></div></header><ChoiceRow title="安排几顿" value={meals} setValue={setMeals} options={[["3", "3 顿"], ["5", "5 顿"], ["7", "每天"]]} /><ChoiceRow title="备菜节奏" value={rhythm} setValue={setRhythm} options={[["daily", "每天现做"], ["mixed", "混合"], ["batch", "集中备菜"]]} /><ChoiceRow title="新食材" value={newFood} setValue={setNewFood} options={[["none", "不安排"], ["one", "1 种"], ["auto", "按记录推荐"]]} /></section>
    <div className="planning-bottom-spacer" /><div className="planning-submit"><div><small>将生成</small><strong>{horizon === "today" ? "1 顿可执行方案" : horizon === "4weeks" ? "4 周方向与每周重点" : `${meals} 顿本周方案`}</strong></div><Button onClick={() => navigate("/plan/week")}>{label}</Button></div>
  </Screen>;
}

function ChoiceRow({ title, value, setValue, options }: { title: string; value: string; setValue: (value: string) => void; options: string[][] }) {
  return <div className="choice-row"><strong>{title}</strong><div>{options.map(([id, label]) => <button key={id} className={cx(value === id && "selected")} onClick={() => setValue(id)}>{label}</button>)}</div></div>;
}

function WeeklyPlanPage() {
  const navigate = useNavigate();
  return <Screen className="weekly-plan-screen collapsible-title-screen"><TopBar title="本周辅食方案" back="/plan" />
    <section className="week-summary"><div><h1>本周 5 顿</h1><p>1 种新食材，留两天空档。</p></div><CalendarDays size={28} /></section>
    <section className="week-section"><div className="week-heading"><div><h2>本周菜单</h2><span>每一顿都可先找视频，再判断是否适合</span></div><button onClick={() => navigate("/plan")}>调整</button></div><div className="meal-list">{weeklyMeals.map((meal) => <article key={meal.id}><span>{meal.day}</span><div><strong>{meal.title}</strong><small>{meal.note}</small></div><button onClick={() => navigate(`/plan/meal/${meal.id}/videos`)}>找视频</button></article>)}</div></section>
    <section className="week-section prep-overview"><div className="week-heading"><div><h2>采购与备菜</h2></div></div><div><p><ShoppingBasket size={17} /><span><strong>集中采购</strong><small>鸡胸、牛肉、鲜虾、南瓜、番茄、山药</small></span></p><p><ListChecks size={17} /><span><strong>提前处理</strong><small>肉类分装；南瓜、山药蒸熟冷藏</small></span></p></div></section>
    <p className="plan-boundary"><Info size={14} />方案会根据实际进食反馈调整；食材记录不等同于医学判断。</p>
  </Screen>;
}

type PlanVideoResult = {
  id: string;
  title: string;
  sourceLabel: string;
  duration: string;
  image: string;
  ingredients: string[];
  formats: string[];
  note: string;
  matchReasons: string[];
};

function PlanVideoSearchPage() {
  const navigate = useNavigate();
  const { mealId = "" } = useParams();
  const meal = weeklyMealById(mealId);
  const profile = useAppStore((state) => state.profile);
  const [query, setQuery] = useState(meal?.searchQuery ?? "");
  const [submittedQuery, setSubmittedQuery] = useState(meal?.searchQuery ?? "");
  const [searchVersion, setSearchVersion] = useState(0);
  const [results, setResults] = useState<PlanVideoResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [startingId, setStartingId] = useState("");
  const [link, setLink] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    fetch(`/api/plan-videos?q=${encodeURIComponent(submittedQuery)}`, { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error("候选视频暂时无法加载");
        return response.json() as Promise<{ results: PlanVideoResult[] }>;
      })
      .then((payload) => setResults(payload.results))
      .catch((cause) => { if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : "搜索失败"); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [submittedQuery, searchVersion]);

  const beginCatalogAnalysis = async (candidate: PlanVideoResult) => {
    if (startingId) return;
    if (!profile.completed) return navigate("/baby");
    try {
      setStartingId(candidate.id);
      setError("");
      const job = await createCatalogAnalysisJob(candidate.id, profile);
      sessionStorage.setItem("baobao:last-analysis-job", job.jobId);
      navigate(`/analysis/${job.jobId}`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "创建分析任务失败");
      setStartingId("");
    }
  };

  const beginLinkAnalysis = async (event: FormEvent) => {
    event.preventDefault();
    const value = link.trim();
    if (!/https:\/\//.test(value)) return setError("请粘贴包含 https:// 链接的分享内容");
    if (!profile.completed) return navigate("/baby");
    try {
      setStartingId("link");
      setError("");
      const job = await createUrlAnalysisJob(value, profile);
      sessionStorage.setItem("baobao:last-analysis-job", job.jobId);
      navigate(`/analysis/${job.jobId}`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "创建分析任务失败");
      setStartingId("");
    }
  };

  if (!meal) return <NotFound />;
  return <Screen className="plan-video-search-screen collapsible-title-screen"><TopBar title="为这顿找视频" back="/plan/week" />
    <section className="plan-video-brief"><small>{meal.day} · 计划方向</small><h1>{meal.title}</h1><p>{meal.note}。先看候选是否匹配计划，再进入宝宝专属分析。</p></section>
    <form className="plan-video-search" onSubmit={(event) => { event.preventDefault(); setLoading(true); setError(""); setSubmittedQuery(query.trim()); setSearchVersion((version) => version + 1); }}><Search size={17} /><input value={query} onChange={(event) => setQuery(event.target.value)} aria-label="搜索候选视频" placeholder="搜食材、质地或做法" /><button type="submit">搜索</button></form>
    <div className="plan-video-source-state"><span>当前来源</span><strong>已导入候选库</strong><p>检索接口已独立；接入有权限的抖音内容源后，可直接扩展结果，不改后续分析链路。</p></div>
    <section className="plan-video-results"><div className="week-heading"><div><h2>匹配视频</h2><span>{loading ? "正在搜索" : `${results.length} 条候选`}</span></div></div>
      {loading ? <div className="plan-video-loading"><i /><i /><i /></div> : results.length > 0 ? <div className="plan-video-grid">{results.map((candidate) => <article key={candidate.id}>
        <div className="plan-video-cover">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={candidate.image} alt={`${candidate.title}成品`} /><span><Play size={10} fill="currentColor" />{candidate.duration}</span>
        </div>
        <div className="plan-video-copy"><small>{candidate.sourceLabel}</small><h3>{candidate.title}</h3><p>{candidate.note}</p><div>{candidate.matchReasons.map((reason) => <span key={reason}><Check size={10} />{reason}</span>)}</div></div>
        <button disabled={Boolean(startingId)} onClick={() => void beginCatalogAnalysis(candidate)}>{startingId === candidate.id ? "正在创建分析…" : "检查是否适合宝宝"}<ChevronRight size={15} /></button>
      </article>)}</div> : <div className="plan-video-empty"><Search size={24} /><strong>候选库里暂时没有匹配视频</strong><p>换一个食材或做法关键词，或者粘贴你已经找到的视频。</p></div>}
    </section>
    <section className="plan-video-own"><div><Link2 size={18} /><span><strong>已经在抖音找到一条？</strong><small>粘贴分享链接，继续走同一套分析链路</small></span></div><form onSubmit={beginLinkAnalysis}><input value={link} onChange={(event) => setLink(event.target.value)} placeholder="https://…" aria-label="粘贴自己找到的视频地址" /><Button type="submit" disabled={Boolean(startingId)}>{startingId === "link" ? "正在创建…" : "分析这条"}</Button></form><p>支持公开的抖音分享链接；私密、已删除或地区受限内容无法读取。</p></section>
    {error && <p className="plan-video-error" role="alert"><AlertCircle size={14} />{error}</p>}
    <p className="plan-boundary"><Info size={14} />候选匹配只说明“与计划方向相近”，不代表视频已经适合宝宝；必须完成下一步分析。</p>
  </Screen>;
}

function FoodMapPage() {
  const navigate = useNavigate();
  const profile = useAppStore((state) => state.profile);
  const progress = useAppStore((state) => state.foodJourneyProgress);
  const completedCount = foodJourneyFoods.filter((food) => progress[food.id]?.status === "completed").length;
  const currentFood = foodJourneyFoods.find((food) => progress[food.id]?.status !== "completed");
  return <Screen className="food-map-screen collapsible-title-screen"><TopBar title="宝宝食物地图" back="/home" />
    <section className="food-map-hero journey-hero"><div><span>{profile.name}{profile.months > 0 ? ` · ${profile.months} 个月` : ""}</span><h1>食物成长路线</h1><p>{completedCount === 0 ? "所有食物从灰色开始，完成观察后一个个点亮。" : `已收集 ${completedCount} 枚食物徽章，继续下一关。`}</p></div><CharacterIllustration intent="explore" size="card" /></section>
    <div className="journey-summary"><span><strong>{completedCount}</strong><small>已获徽章</small></span><i /><span><strong>{completedCount} / {foodJourneyFoods.length}</strong><small>路线进度</small></span><i /><span><strong>{currentFood?.name ?? "全部完成"}</strong><small>{currentFood ? "当前关卡" : "太棒了"}</small></span></div>
    <div className="food-journey-scene">
      <FoodMapScenery />
      <section className="food-journey" aria-label={`${profile.name}的食物成长路线`}>
        {foodJourneyStages.map((stage) => {
          const foods = stage.foodIds.map((foodId) => getFoodJourneyFood(foodId)).filter((food): food is FoodJourneyFood => Boolean(food));
          const stageCompleted = foods.every((food) => progress[food.id]?.status === "completed");
          const stageCurrent = foods.some((food) => food.id === currentFood?.id);
          const stageState = stageCompleted ? "completed" : stageCurrent ? "current" : "future";
          const stageDone = foods.filter((food) => progress[food.id]?.status === "completed").length;
          return <article key={stage.kicker} className={cx("journey-stage", stageState)}>
        <header><span>{stageState === "completed" ? <Award size={14} /> : stageState === "current" ? <Sparkles size={14} /> : <LockKeyhole size={13} />}</span><div><small>{stage.kicker}</small><h2>{stage.title}</h2><p>{stageState === "future" ? "完成上一站后解锁" : `${stage.note} · ${stageDone} / ${foods.length}`}</p></div>{stageState === "current" && <b>当前</b>}</header>
        <div className="food-path-track">
          {foods.map((food, foodIndex) => {
            const side = pathSides[foodIndex % pathSides.length];
            const nextSide = pathSides[(foodIndex + 1) % pathSides.length];
            const foodProgress = progress[food.id];
            const completed = foodProgress?.status === "completed";
            const available = food.id === currentFood?.id;
            const interactive = completed || available;
            const nodeState = completed ? "recorded" : available ? "available" : "future";
            const statusLabel = completed ? "徽章已获得" : foodProgress?.status === "paused" ? "已暂停" : foodProgress?.status === "active" ? `观察中 ${foodProgress.completedCheckpoints.length} / 3` : available ? "开始探索" : "待解锁";
            return <div key={food.id} className={cx("food-path-row", side)}>
              {foodIndex < foods.length - 1 && <svg className="food-path-connector" viewBox="0 0 320 168" preserveAspectRatio="none" aria-hidden="true"><path d={foodConnectorPath(side, nextSide)} /></svg>}
              <button className={cx("food-path-node", nodeState, foodProgress?.status === "active" && "in-progress", foodProgress?.status === "paused" && "paused")} disabled={!interactive} onClick={() => interactive && navigate(`/food-map/${food.id}`)} aria-label={`${food.name}，${statusLabel}`}>
                <span className="food-character-slot" data-food-image={food.id}><FoodIllustration foodId={food.id} alt={food.name} fallback={<small>{food.fallback}</small>} />{completed && <i><Award size={11} /></i>}{!completed && available && <i>{foodProgress?.status === "paused" ? <Pause size={10} /> : <Sparkles size={10} />}</i>}{!available && !completed && <i><LockKeyhole size={10} /></i>}</span>
                <strong>{food.name}</strong>
                <small>{statusLabel}</small>
              </button>
            </div>;
          })}
        </div>
        </article>;})}
      </section>
    </div>
    <p className="journey-boundary"><Info size={14} />徽章只代表完成了本次尝试和 3—5 天观察记录，不代表医学上已排除过敏。</p>
  </Screen>;
}

function FoodDetailPage() {
  const navigate = useNavigate();
  const { food: foodId = "" } = useParams();
  const food = getFoodJourneyFood(foodId);
  const progress = useAppStore((state) => state.foodJourneyProgress);
  const startFoodJourney = useAppStore((state) => state.startFoodJourney);
  const recordFoodCheckpoint = useAppStore((state) => state.recordFoodCheckpoint);
  const pauseFoodJourney = useAppStore((state) => state.pauseFoodJourney);
  const [rewardFood, setRewardFood] = useState<FoodJourneyFood | null>(null);
  const currentFood = foodJourneyFoods.find((item) => progress[item.id]?.status !== "completed");
  const foodProgress = progress[foodId];
  const locked = currentFood?.id !== foodId && foodProgress?.status !== "completed";
  const completed = foodProgress?.status === "completed";
  const paused = foodProgress?.status === "paused";
  const nextCheckpoint = (foodProgress?.completedCheckpoints.length ?? 0) + 1;
  if (!food) return <NotFound />;
  const primaryAction = () => {
    if (!foodProgress) {
      startFoodJourney(food.id);
      return;
    }
    const didComplete = recordFoodCheckpoint(food.id, nextCheckpoint);
    if (didComplete) setRewardFood(food);
  };
  return <Screen className="food-detail-screen collapsible-title-screen"><TopBar title="食材详情" back="/food-map" />
    <section className={cx("food-detail-hero", locked && "locked")}><FoodIllustration foodId={food.id} alt={food.name} /><div><small>{completed ? "徽章已获得" : paused ? "观察已暂停" : locked ? "尚未解锁" : foodProgress ? `观察进度 ${foodProgress.completedCheckpoints.length} / 3` : "当前可探索"}</small><h1>{food.name}</h1><p>{food.summary}</p></div></section>
    {locked ? <section className="food-locked-card"><LockKeyhole size={23} /><h2>这一关还没解锁</h2><p>先完成 {currentFood?.name ?? "当前食物"} 的观察记录，再来认识{food.name}。</p><Button full onClick={() => navigate("/food-map")}>回到成长路线</Button></section> : <>
      <div className="food-fact-grid"><article><span>观察周期</span><strong>3—5 天</strong></article><article><span>关注程度</span><strong className={food.allergenLevel}>{food.allergenLevel === "common" ? "重点关注" : "一般关注"}</strong></article></div>
      <section className="food-quick-guide"><header><span>吃前看两点</span><UtensilsCrossed size={18} /></header><div><small>怎么准备</small><p>{food.preparation}</p></div><div><small>营养亮点</small><div className="nutrition-tags">{food.nutrition.map((item) => <span key={item}>{item}</span>)}</div></div></section>
      <section className={cx("food-allergy-card", food.allergenLevel === "common" && "common")}><header><div><h2>{food.allergenLevel === "common" ? "首次少量，单独尝试" : "留意和平时不一样的变化"}</h2></div><ShieldAlert size={20} /></header><p>{food.allergenNote}</p><div className="allergy-sign-chips">{possibleAllergySigns.map((item) => <span key={item}>{item}</span>)}</div><div className="urgent-signs"><ShieldAlert size={15} /><span><strong>立即求助：</strong>{urgentAllergySigns.join("、")}</span></div></section>
      <section className="food-observation-plan"><div className="week-heading"><div><h2>三步完成探索</h2></div><b>{foodProgress?.completedCheckpoints.length ?? 0} / 3</b></div><div>{foodObservationCheckpoints.map((checkpoint) => { const done = Boolean(foodProgress?.completedCheckpoints.includes(checkpoint.id)); const active = !completed && !paused && checkpoint.id === nextCheckpoint; return <article key={checkpoint.id} className={cx(done && "done", active && "active")}><span>{done ? <Check size={14} /> : checkpoint.id}</span><div><small>{checkpoint.label}</small><strong>{checkpoint.title}</strong>{active && <p>{checkpoint.detail}</p>}</div></article>;})}</div></section>
      {paused && <section className="food-paused-card" role="alert"><ShieldAlert size={21} /><div><strong>本轮探索已暂停</strong><p>{foodProgress?.reaction === "urgent" ? "已记录紧急征象。请立即寻求急救，不要再次尝试。" : "已记录可疑反应。在获得专业建议前，不继续尝试。"}</p></div></section>}
      <details className="food-safety-details"><summary><Info size={14} />安全说明与资料来源<ChevronRight size={14} /></summary><div><p>这里记录尝试和观察，不提供过敏诊断或治疗建议。</p><a href="https://www.cdc.gov/infant-toddler-nutrition/foods-and-drinks/when-what-and-how-to-introduce-solid-foods.html" target="_blank" rel="noreferrer">CDC 引入原则</a><a href="https://www.nhs.uk/best-start-in-life/baby/weaning/safe-weaning/food-allergies/" target="_blank" rel="noreferrer">NHS 过敏指引</a></div></details>
      {!paused && <div className={cx("food-detail-actions", foodProgress && !completed && "has-secondary")}>{!completed && <><small className="food-action-hint">可随时继续记录；实际喂养请按建议周期观察。</small><Button full onClick={primaryAction}>{!foodProgress ? `开始${food.name}探索` : nextCheckpoint === 1 ? "完成首次尝试，继续" : nextCheckpoint === 2 ? "完成继续观察，下一步" : "完成记录，领取徽章"}</Button></>}{foodProgress && !completed && <button className="food-pause-action" onClick={() => pauseFoodJourney(food.id, "possible")}><ShieldAlert size={14} />发现异常，暂停探索</button>}{completed && <div className="earned-badge-inline"><span><FoodIllustration foodId={food.id} alt="" /></span><div><small>已收集</small><strong>{food.name}徽章</strong><p>继续规律提供已耐受的食物</p></div><Award size={20} /></div>}</div>}
    </>}
    <AnimatePresence>{rewardFood && <FoodBadgeCelebration food={rewardFood} onClose={() => { setRewardFood(null); navigate("/food-map"); }} />}</AnimatePresence>
  </Screen>;
}

function FoodBadgeCelebration({ food, onClose }: { food: FoodJourneyFood; onClose: () => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    if (!canvasRef.current) return;
    const fireworks = confetti.create(canvasRef.current, { resize: true, useWorker: true, disableForReducedMotion: true });
    const shared = { colors: ["#FFD35A", "#FFA691", "#8FB99A", "#FFFFFF"], shapes: ["circle", "star"] as confetti.Shape[], zIndex: 102 };
    void fireworks({ ...shared, particleCount: 72, angle: 62, spread: 64, startVelocity: 48, origin: { x: .05, y: .76 } });
    void fireworks({ ...shared, particleCount: 72, angle: 118, spread: 64, startVelocity: 48, origin: { x: .95, y: .76 } });
    window.setTimeout(() => void fireworks({ ...shared, particleCount: 54, spread: 110, startVelocity: 34, origin: { x: .5, y: .38 } }), 180);
  }, []);
  return <motion.div className="food-badge-celebration" initial={false} animate={{ opacity: 1 }} exit={{ opacity: 0 }} role="dialog" aria-modal="true" aria-label={`获得${food.name}徽章`}><canvas ref={canvasRef} /><motion.section initial={false} animate={{ opacity: 1, y: 0, scale: 1 }}><span className="badge-rays" aria-hidden="true" /><div className="food-badge-medal"><FoodIllustration foodId={food.id} alt={`${food.name}徽章`} /><i><Award size={18} /></i></div><small>新徽章已收藏</small><h2>{food.name}探索完成</h2><p>已完成尝试和 3—5 天观察记录，下一位食物朋友已解锁。</p><Button full onClick={onClose}>收下徽章，查看下一关</Button><em>徽章不代表医学上已排除过敏</em></motion.section></motion.div>;
}

function BowlVisual() {
  return (
    <div className="bowl-visual" aria-hidden="true">
      <span className="steam steam-one" /><span className="steam steam-two" />
      <div className="bowl-food"><i /><i /><i /><b /><b /></div>
      <div className="bowl-shape" />
    </div>
  );
}

function useSmoothProgress(target: number) {
  const reduceMotion = useReducedMotion();
  const valueRef = useRef(target);
  const [value, setValue] = useState(target);
  useEffect(() => {
    const start = valueRef.current;
    if (reduceMotion || target <= start) {
      valueRef.current = target;
      setValue(target);
      return;
    }
    const duration = target >= 100 ? 320 : target - start >= 8 ? 520 : 9_500;
    const startedAt = window.performance.now();
    let frame = 0;
    const animate = (now: number) => {
      const ratio = Math.min((now - startedAt) / duration, 1);
      const next = start + (target - start) * ratio;
      valueRef.current = next;
      setValue(next);
      if (ratio < 1) frame = window.requestAnimationFrame(animate);
    };
    frame = window.requestAnimationFrame(animate);
    return () => window.cancelAnimationFrame(frame);
  }, [reduceMotion, target]);
  return value;
}

function AnalysisPage() {
  const navigate = useNavigate();
  const { id = "" } = useParams();
  const profile = useAppStore((state) => state.profile);
  const { scenario } = useContext(ScenarioContext);
  const [progress, setProgress] = useState<AnalysisProgress>({ stage: "reading", percent: 8, label: "准备读取视频…" });
  const [insights, setInsights] = useState<string[]>(["正在建立视频分析任务", "只展示可核验的分析项目，不展示模型内部推理"]);
  const [failed, setFailed] = useState<string | null>(null);
  const [isTestVideoMock, setIsTestVideoMock] = useState(false);
  const smoothProgress = useSmoothProgress(progress.percent);
  useEffect(() => {
    if (id !== "shrimp-noodle-demo") {
      let cancelled = false;
      const timers: ReturnType<typeof setTimeout>[] = [];
      const poll = async () => {
        try {
          const job = await getAnalysisJob(id);
          if (cancelled) return;
          const stageMap: Record<AnalysisJobStatus["status"], AnalysisProgress["stage"]> = {
            queued: "reading", parsing_video: "reading", searching_knowledge: "extracting", generating_plan: "comparing", extracting_frames: "checking", completed: "done", failed: "checking",
          };
          setProgress({ stage: stageMap[job.status], percent: job.progress, label: job.stageText });
          if (job.insights?.length) setInsights(job.insights);
          if (job.status === "completed" && job.stageText.includes("测试视频 1")) {
            setIsTestVideoMock(true);
            const presentation = [
              { delay: 0, stage: "reading" as const, percent: 18, label: "正在读取测试视频 1…", insights: ["已载入测试视频 1", "正在核对画面、字幕和口播信息"] },
              { delay: 700, stage: "extracting" as const, percent: 46, label: "正在整理食材和制作步骤…", insights: ["已识别视频主题与主要食材", "正在按原始时间点整理制作动作"] },
              { delay: 1_450, stage: "comparing" as const, percent: 74, label: `正在与${profile.name}的档案逐项对照…`, insights: [`正在结合${profile.name}的月龄与进食能力`, "正在检查质地、熟度和调味"] },
              { delay: 2_200, stage: "checking" as const, percent: 94, label: "正在检查需要确认的信息…", insights: ["未在视频中说明的信息将保留为待确认", "宝宝版本已准备完成"] },
            ];
            for (const item of presentation) timers.push(setTimeout(() => {
              if (cancelled) return;
              setProgress({ stage: item.stage, percent: item.percent, label: item.label });
              setInsights(item.insights);
            }, item.delay));
            timers.push(setTimeout(() => { if (!cancelled) navigate(`/result/analysis/${id}`, { replace: true }); }, 3_000));
            return;
          }
          if (job.status === "completed") return navigate(`/result/analysis/${id}`, { replace: true });
          if (job.status === "failed") return setFailed(job.error || "分析失败，请重试");
          timers.push(setTimeout(poll, 1200));
        } catch (cause) {
          if (!cancelled) setFailed(cause instanceof Error ? cause.message : "无法读取任务状态");
        }
      };
      void poll();
      return () => { cancelled = true; timers.forEach(clearTimeout); };
    }
    createAiGateway(scenario).analyzeVideo(demoLink, profile, setProgress)
      .then(() => navigate(`/result/${resultRoutes[scenario]}`))
      .catch(() => setFailed("演示分析失败"));
  }, [id, navigate, profile, scenario]);
  if (failed) return <AnalysisFailure message={failed} retry={async () => { await retryAnalysisJob(id); location.reload(); }} />;
  return (
    <Screen className="analysis-screen">
      <TopBar title="正在整理视频" back="/home" />
      <section className="analysis-visual">
        <div className="analysis-orbit"><div className="analysis-center"><CharacterIllustration intent={progress.stage === "reading" ? "link" : progress.stage === "checking" ? "question" : "inspect"} size="hero" /></div><i /><i /><i /></div>
        <h1>{id === "shrimp-noodle-demo" ? "宝宝虾滑面" : isTestVideoMock ? "测试视频 1" : "正在生成宝宝版本"}</h1>
        <AnimatePresence mode="wait" initial={false}><motion.p key={progress.label} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }} transition={{ duration: .16 }}>{progress.label}</motion.p></AnimatePresence>
        <div className="analysis-progress" role="progressbar" aria-label="视频分析进度" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(smoothProgress)}><span style={{ width: `${smoothProgress}%` }} /></div>
        <strong>{Math.round(smoothProgress)}%</strong>
      </section>
      <section className="analysis-status-card" aria-live="polite">
        <header><Sparkles size={15} /><div><strong>分析动态</strong><small>展示正在核对的事实与依据</small></div></header>
        <AnimatePresence initial={false} mode="popLayout">{insights.map((insight) => <motion.p key={insight} initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }} transition={{ duration: .28 }}><CheckCircle2 size={13} />{insight}</motion.p>)}</AnimatePresence>
      </section>
      <div className="analysis-stages">
        {[
          ["reading", "读取视频信息"], ["extracting", "整理食材和步骤"], ["comparing", "与宝宝档案对照"], ["checking", "检查未知信息"],
        ].map(([key, label], index) => {
          const keys = ["reading", "extracting", "comparing", "checking", "done"];
          const done = keys.indexOf(progress.stage) > index;
          const active = progress.stage === key;
          return <div key={key} className={cx(done && "done", active && "active")}><span>{done ? <Check size={14} /> : index + 1}</span><p>{label}</p></div>;
        })}
      </div>
      <p className="analysis-footnote">这里展示可核验的分析摘要；视频信息不足时会保留为待确认，不会为了生成完整菜谱而猜测。</p>
    </Screen>
  );
}

function AnalysisFailure({ message = "链接可能已失效、需要登录，或当前页面无法访问视频内容。", retry }: { message?: string; retry?: () => void | Promise<void> }) {
  const navigate = useNavigate();
  const [retrying, setRetrying] = useState(false);
  const [retryError, setRetryError] = useState("");
  const handleRetry = async () => {
    if (!retry || retrying) return;
    setRetrying(true);
    setRetryError("");
    try { await retry(); } catch (cause) { setRetryError(cause instanceof Error ? cause.message : "重试失败，请稍后再试"); setRetrying(false); }
  };
  return (
    <Screen className="centered-state">
      <TopBar title="视频分析" back="/home" />
      <div className="state-icon muted"><Link2 size={28} /></div>
      <h1>这次分析没有完成</h1>
      <p>{message}</p>
      {retryError && <p className="form-error">{retryError}</p>}
      {retry && <Button full disabled={retrying} onClick={() => void handleRetry()}>{retrying ? "正在重新开始…" : "重试当前任务"}</Button>}
      <Button full variant="secondary" onClick={() => navigate("/home")}>重新选择视频</Button>
    </Screen>
  );
}

function AnalysisResultPage() {
  const navigate = useNavigate();
  const { jobId = "" } = useParams();
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [error, setError] = useState("");
  const [view, setView] = useState<"baby" | "steps">("baby");
  useEffect(() => {
    let cancelled = false;
    getAnalysisResult(jobId).then((value) => { if (!cancelled) setResult(value); }).catch((cause) => { if (!cancelled) setError(cause instanceof Error ? cause.message : "结果读取失败"); });
    return () => { cancelled = true; };
  }, [jobId]);
  if (error) return <AnalysisFailure message={error} retry={() => navigate(`/analysis/${jobId}`, { replace: true })} />;
  if (!result) return <Screen className="analysis-screen"><TopBar title="适配结果" back="/home" /><section className="analysis-visual"><div className="analysis-orbit"><div className="analysis-center"><CharacterIllustration intent="inspect" size="hero" /></div><i /><i /><i /></div><h1>正在读取结果</h1><p>马上就好</p></section></Screen>;
  const plan = getUnifiedAnalysisPlan(result);
  const evidence = result.视频解析.evidence ?? [];
  const babyName = plan.verdict.title.match(/^(.+?)版[：:]/)?.[1] || result.宝宝版本.title.match(/^(.+?)版[：:]/)?.[1] || "宝宝";
  const changes = plan.checks.filter((item) => item.impact !== "none");
  const preflight = [...new Set([...plan.checks.filter((item) => item.impact === "confirm" || item.impact === "block").map((item) => item.action), ...plan.serving_checks])];
  const citedEvidenceIds = [...new Set([...plan.checks.flatMap((item) => item.evidence_ids), ...plan.ingredients.flatMap((item) => item.evidence_ids)])];
  const recipeProfile = plan.source_summary.recipe_profile;
  const impactLabel = { none: "无需调整", change: "需要调整", confirm: "待确认", block: "先暂停" } as const;
  return <Screen className="result-screen generated-result-screen">
    <TopBar title="适配结果" back="/home" />
    <section className="generated-result-hero"><CharacterIllustration intent={plan.verdict.status === "暂不建议" ? "paused" : "confirm"} size="support" /><div><h1>{parentFriendly(plan.verdict.title)}</h1><p>{parentFriendly(plan.verdict.profile_summary)}</p></div></section>
    <section className={cx("generated-verdict", plan.verdict.status === "需要补充信息" && "pending", plan.verdict.status === "暂不建议" && "blocked")}><span className="generated-verdict-eyebrow">给{babyName}的结论</span><h2>{parentFriendly(plan.verdict.headline)}</h2><p>{parentFriendly(plan.verdict.summary)}</p></section>
    <div className="result-view-tabs generated-tabs generated-mode-tabs" role="tablist" aria-label="结果查看方式"><button role="tab" aria-selected={view === "baby"} className={cx(view === "baby" && "active")} onClick={() => setView("baby")}>宝宝版本</button><button role="tab" aria-selected={view === "steps"} className={cx(view === "steps" && "active")} onClick={() => setView("steps")}>步骤教程</button></div>
    <div className="generated-result-panel generated-unified-result">
      {view === "baby" && <>
      <section className="generated-source-overview"><header><div><h2>{parentFriendly(plan.source_summary.title)}</h2></div></header><p className="generated-source-summary">{parentFriendly(plan.source_summary.summary)}</p><details><summary>查看成品与喂法信息</summary><div className="generated-recipe-profile">{[["食物类型", recipeProfile.food_type], ["主体质地", recipeProfile.dominant_texture], ["颗粒组成", recipeProfile.particle_composition], ["食物形态", recipeProfile.food_form], ["喂养方式", recipeProfile.feeding_method], ["进食姿势", recipeProfile.feeding_posture], ["成品份量", recipeProfile.final_portion]].map(([label, value]) => <div key={label}><span>{label}</span><strong>{parentFriendly(value)}</strong></div>)}</div></details></section>
      <section><header><div><h2>关键调整</h2></div></header><div className="generated-change-list">{(changes.length ? changes : plan.checks.slice(0, 1)).map((item) => <article key={item.check_id}><div className="generated-card-heading"><strong>{parentFriendly(item.dimension)}</strong><span className={cx("generated-impact", item.impact)}>{impactLabel[item.impact]}</span><EvidenceDetails ids={item.evidence_ids} evidence={evidence} /></div><div className="generated-change-compare"><p><small>原视频</small>{parentFriendly(item.source_fact)}</p><ChevronRight size={15} /><p><small>{babyName}版</small>{parentFriendly(item.decision)}</p></div><div className="generated-change-action"><CheckCircle2 size={14} /><span>{parentFriendly(item.action)}</span></div></article>)}</div></section>
      <section><header><div><h2>最终食材</h2></div></header><div className="generated-unified-ingredients">{plan.ingredients.map((item, index) => <article key={`${item.name}-${index}`}><div className="generated-card-heading"><strong>{parentFriendly(item.name)}</strong><span className={cx("generated-ingredient-decision", item.decision)}>{item.decision}</span><EvidenceDetails ids={item.evidence_ids} evidence={evidence} /></div><div><p><small>原视频</small>{parentFriendly([item.source.amount, item.source.preparation].filter(Boolean).join(" · ") || "未说明")}</p><ChevronRight size={14} /><p><small>{babyName}版</small>{parentFriendly([item.baby.amount, item.baby.preparation].filter(Boolean).join(" · ") || "待确认")}</p></div></article>)}</div></section>
      <section className="generated-preflight"><header><div><h2>开做前确认</h2></div></header>{preflight.map((item, index) => <p key={`${item}-${index}`}><CheckCircle2 size={14} />{parentFriendly(item)}</p>)}</section>
      <details className="generated-audit"><summary><BookOpen size={16} /><div><strong>查看完整检查与依据</strong><span>8 项检查 · 原视频信息与宝宝调整分开保存</span></div><ChevronRight size={15} /></summary><div>{plan.checks.map((item) => <article key={item.check_id}><div className="generated-card-heading"><strong>{parentFriendly(item.dimension)}</strong><span className={cx("generated-impact", item.impact)}>{impactLabel[item.impact]}</span><EvidenceDetails ids={item.evidence_ids} evidence={evidence} /></div><p>{parentFriendly(item.decision)}</p><small>{parentFriendly(item.baby_context)}</small></article>)}</div></details>
      <KnowledgeLibrary evidence={evidence} citedEvidenceIds={citedEvidenceIds} />
      <p className="generated-disclaimer">本结果用于辅食个体化整理，不提供医疗诊断或治疗方案；出现严重过敏反应或吞咽困难时，请停止进食并及时寻求专业帮助。</p>
      </>}
      {view === "steps" &&
      <section><header><div><h2>宝宝版步骤</h2></div></header><div className="generated-steps">{plan.steps.map((step, index) => <article key={step.step_id}>{step.image_url ? <img /* eslint-disable-line @next/next/no-img-element */ src={step.image_url} alt={step.keyframe_description || step.title} /> : <div className="generated-frame-placeholder"><CharacterIllustration intent="prepare" size="avatar" /><span>这一步没有合适的视频截图</span></div>}<div><span>第 {index + 1} 步{step.timing ? ` · ${parentFriendly(step.timing)}` : ""}</span><h3>{parentFriendly(step.title)}</h3><p>{parentFriendly(step.instruction)}</p><strong>做到什么算完成？</strong><small>{parentFriendly(step.completion_check)}</small><em>{parentFriendly(step.personal_reminder)}</em><details><summary>查看视频对应位置</summary><p>{parentFriendly(step.mapping_note)}</p>{step.keyframe_description && <p>画面：{parentFriendly(step.keyframe_description)}</p>}</details></div></article>)}</div></section>
      }
    </div>
    <div className="generated-result-bottom"><Button full onClick={() => navigate(`/cook/${jobId}/session`)} icon={<MessageCircle size={18} />}>带着一起做</Button></div><div className="result-spacer" />
  </Screen>;
}

function EvidenceDetails({ ids, evidence }: { ids: string[]; evidence: AnalysisResult["视频解析"]["evidence"] }) {
  const matches = evidence.filter((item) => ids.includes(item.evidence_id));
  if (!matches.length) return null;
  return <details className="generated-evidence"><summary aria-label={`查看 ${matches.length} 条知识依据`}><span aria-hidden="true" />{matches.length}</summary><div className="generated-evidence-popover">{matches.map((item) => <article key={item.evidence_id}><strong>{item.evidence_id} · {item.source}</strong><small>{item.location}</small><p>{item.summary}</p><em>与本次判断的关系：{item.relationship}</em></article>)}</div></details>;
}

function KnowledgeLibrary({ evidence, citedEvidenceIds }: { evidence: AnalysisResult["视频解析"]["evidence"]; citedEvidenceIds: string[] }) {
  const [activeSource, setActiveSource] = useState<number | null>(null);
  const sources = [
    { title: "WS/T 678—2020《婴幼儿辅食添加营养指南》", match: "WS/T 678", scope: "用于判断辅食添加顺序、食材质地、调味、熟制和进食安全。" },
    { title: "《中国婴幼儿喂养指南（2022）》", match: "中国婴幼儿喂养指南", scope: "用于判断食物多样性、回应式喂养、进餐看护和过敏食物引入。" },
    { title: "《托育机构婴幼儿喂养与营养指南（试行）》", match: "托育机构婴幼儿喂养与营养指南", scope: "主要面向托育机构；家庭场景只参考其中的喂养、看护和质地原则。" },
    { title: "WS/T 821—2023《托育机构质量评估标准》", match: "WS/T 821", scope: "主要面向托育机构；本产品只参考过敏记录、个体差异和食物安全相关条目。" },
  ];
  const selectedSource = activeSource === null ? null : sources[activeSource];
  const citedIds = new Set(citedEvidenceIds);
  const selectedEvidence = selectedSource ? evidence.filter((item) => citedIds.has(item.evidence_id) && item.source.includes(selectedSource.match)) : [];
  return <>
    <details className="generated-knowledge-banner"><summary><BookOpen size={16} /><div><strong>中国婴幼儿辅食佐证库</strong><span>{evidence.length ? `4 份官方文件 · ${evidence.length} 条可追溯依据` : "这条旧结果没有保存结构化依据"}</span></div><ChevronRight size={15} /></summary><div className="generated-knowledge-sources">{sources.map((source, index) => <button type="button" key={source.title} onClick={() => setActiveSource(index)} aria-label={`查看${source.title}`}><b>{index + 1}</b><span>{source.title}</span><ChevronRight size={13} /></button>)}</div></details>
    <AnimatePresence>{selectedSource && <Sheet title={selectedSource.title} onClose={() => setActiveSource(null)}><div className="knowledge-document-sheet"><p>{selectedSource.scope}</p><div className="knowledge-document-meta"><BookOpen size={16} /><span>本次分析引用 {selectedEvidence.length} 条</span></div>{selectedEvidence.length > 0 ? <div className="knowledge-document-rules">{selectedEvidence.map((item) => <article key={item.evidence_id}><div><strong>{parentFriendly(item.dimension)}</strong><span>{parentFriendly(item.location)}</span></div><p>{parentFriendly(item.summary)}</p><small>{parentFriendly(item.relationship)}</small></article>)}</div> : <div className="knowledge-document-empty">本次分析没有引用这份文件中的具体条目。</div>}<p className="knowledge-document-note">这里只展示本次分析使用到的条目摘要和所在位置，不替代原文件全文。</p></div></Sheet>}</AnimatePresence>
  </>;
}

function RecipeResultPage() {
  const navigate = useNavigate();
  const { conclusion = "adapted" } = useParams();
  const { setScenario } = useContext(ScenarioContext);
  const scenario = routeResults[conclusion] || "adapted";
  const [view, setView] = useState<"baby" | "source">("baby");
  useEffect(() => setScenario(scenario), [scenario, setScenario]);
  const canCook = scenario === "adapted" || scenario === "direct";
  const showStructuredResult = canCook || scenario === "needs-info";
  return (
    <Screen className="result-screen result-architecture-screen">
      <TopBar title="适配结果" back="/home" />
      <section className="result-recipe-hero">
        <div className="result-recipe-mark"><CharacterIllustration intent={resolveResultIntent(scenario)} size="support" /></div>
        <div><span>{tomatoRiceAnalysis.source}</span><h1>{tomatoRiceAnalysis.title}</h1><p>约 {tomatoRiceAnalysis.timing.total} · 1 份</p></div>
      </section>
      {showStructuredResult ? (
        <section className={cx("result-verdict", canCook ? "ready" : "pending")}>
          <div className="result-verdict-icon">{canCook ? <ShieldCheck size={22} /> : <AlertCircle size={22} />}</div>
          <div><span>给{tomatoRiceAnalysis.baby.name}的适配结论</span><h2>{canCook ? "调整后可以做" : `还需确认 ${tomatoRiceAnalysis.blockers.length} 项`}</h2><p>{canCook ? "已把原视频的软颗粒调整到稠粥与软饭之间，制作时仍以现场质地检查为准。" : `原视频颗粒质地高于${tomatoRiceAnalysis.baby.name}当前档案阶段；补齐关键信息前只展示暂定方案。`}</p></div>
          <footer><Baby size={15} /><span>依据：{tomatoRiceAnalysis.baby.name} · {tomatoRiceAnalysis.baby.months} 个月 · {tomatoRiceAnalysis.baby.stage}</span></footer>
        </section>
      ) : (
        <section className={cx("conclusion-card", suitabilityCopy[scenario].className)}>
          <div className="conclusion-top"><span className="conclusion-icon">{scenario === "not-recommended" ? <ShieldAlert /> : <FileQuestion />}</span></div>
          <span className="eyebrow">给{tomatoRiceAnalysis.baby.name}的适配结论</span>
          <h2>{suitabilityCopy[scenario].label}</h2><h3>{suitabilityCopy[scenario].title}</h3><p>{resultSummary(scenario)}</p>
          <div className="profile-evidence"><Baby size={16} /><span>依据：{tomatoRiceAnalysis.baby.name} · {tomatoRiceAnalysis.baby.months} 个月 · {tomatoRiceAnalysis.baby.stage}</span></div>
        </section>
      )}
      {scenario === "needs-info" && <MissingInfoCard onResolve={() => navigate("/result/adapted")} />}
      {scenario === "not-recommended" && <BlockedReasonCard />}
      {scenario === "uncertain" && <UncertainCard />}
      {showStructuredResult && <>
        <div className="result-view-tabs" role="tablist" aria-label="结果视图">
          <button role="tab" aria-selected={view === "baby"} className={cx(view === "baby" && "active")} onClick={() => setView("baby")}>宝宝版本{!canCook && <small>暂定</small>}</button>
          <button role="tab" aria-selected={view === "source"} className={cx(view === "source" && "active")} onClick={() => setView("source")}>原视频解析</button>
        </div>
        <div role="tabpanel">{view === "baby" ? <BabyVersionResult provisional={!canCook} /> : <OriginalVideoResult />}</div>
        <div className="result-spacer" />
        <div className="result-primary-action">
          <Button full onClick={() => canCook ? navigate("/cook/tomato-meat-rice-demo/session") : document.querySelector(".missing-info-card")?.scrollIntoView({ behavior: "smooth", block: "center" })} icon={canCook ? <MessageCircle size={18} /> : <ListChecks size={18} />}>{canCook ? "进入对话陪做" : "补充关键信息"}</Button>
          <p>{canCook ? "陪做时一次只显示当前行动" : "确认前不会生成可直接执行的陪做步骤"}</p>
        </div>
      </>}
      {!showStructuredResult && <div className="blocked-actions"><Button full onClick={() => scenario === "uncertain" ? navigate("/home") : navigate("/baby")}>{scenario === "uncertain" ? "换一条视频" : "核对宝宝档案"}</Button><Button full variant="secondary" onClick={() => navigate("/home")}>返回首页</Button></div>}
    </Screen>
  );
}

function BabyVersionResult({ provisional }: { provisional: boolean }) {
  return <div className="baby-version-result">
    {provisional && <div className="provisional-note"><Info size={16} /><span><strong>这是暂定调整方案</strong>补齐上方信息后，食材、质地或结论都可能改变。</span></div>}
    <section className="result-content-section"><header><div><span>先看这三件事</span><h2>乐乐版关键调整</h2></div></header><div className="key-adjustment-list">{tomatoRiceAnalysis.adjustments.map((item, index) => <article key={item.title}><span>{index + 1}</span><div><strong>{item.title}</strong><p>{item.detail}</p></div></article>)}</div></section>
    <section className="result-content-section"><header><div><span>1 份用量</span><h2>调整后食材</h2></div></header><div className="analysis-ingredient-list">{tomatoRiceAnalysis.ingredients.map((item) => <article key={item.name}><div><strong>{item.name}</strong><span className={cx("fact-state", item.status)}>{item.status === "unknown" ? "待确认" : item.status === "adapted" ? "宝宝版调整" : item.source}</span></div><p>{item.amount}</p><small>{item.prep} · {item.source}</small></article>)}</div></section>
    <section className="result-content-section"><header><div><span>为什么要这样改</span><h2>原视频 → 乐乐版</h2></div></header><div className="difference-list">{tomatoRiceAnalysis.differences.map((item) => <article key={item.label}><strong>{item.label}</strong><div><span><small>原视频</small>{item.original}</span><ChevronRight size={16} /><span><small>乐乐版</small>{item.adapted}</span></div></article>)}</div></section>
    <section className="result-content-section cook-plan-preview"><header><div><span>进入陪做后一次只看一步</span><h2>70–75 分钟 · 6 个阶段</h2></div></header><div className="time-metrics"><div><span>实际操作</span><strong>{tomatoRiceAnalysis.timing.active}</strong></div><div><span>机器焖煮</span><strong>{tomatoRiceAnalysis.timing.machine}</strong></div><div><span>总耗时</span><strong>{tomatoRiceAnalysis.timing.total}</strong></div></div><div className="phase-timeline">{tomatoRiceAnalysis.phases.map((phase, index) => <article key={phase.title}><div className="phase-marker"><span>{index + 1}</span><i /></div><div><small>{phase.time}</small><strong>{phase.title}</strong><p>{phase.action}</p><em><CheckCircle2 size={13} />{phase.check}</em></div></article>)}</div></section>
    <section className="result-final-check"><h2>喂前检查</h2><p><CheckCircle2 size={15} />米粒可压开 · 肉末无团 · 青菜无长纤维 · 温度适宜 · 坐直看护</p><div><ShieldAlert size={15} /><span>若有新食材，不要在同一餐一次引入多种；喂食后记录接受、吞咽和身体反应。</span></div></section>
  </div>;
}

function OriginalVideoResult() {
  return <div className="source-result">
    <div className="source-boundary"><Info size={16} /><span>这里展示判断依据。标记“待确认”的内容没有被视频可靠说明，不会自动当作事实。</span></div>
    <section className="result-content-section"><header><div><span>画面与字幕整理</span><h2>原始方案</h2></div></header><p className="source-summary">{tomatoRiceAnalysis.summary}</p><div className="source-fact-list">{tomatoRiceAnalysis.originalFacts.map(([label, value]) => <div key={label}><span>{label}</span><strong>{value}</strong></div>)}</div></section>
    <section className="result-content-section"><header><div><span>与宝宝档案逐项对照</span><h2>适配评估</h2></div></header><div className="dimension-list">{tomatoRiceAnalysis.dimensions.map(([label, status]) => <div key={label}><span>{label}</span><strong className={cx(status.includes("适合") || status.includes("未发现") ? "safe" : status.includes("调整") ? "adjust" : "pending")}>{status}</strong></div>)}</div></section>
    <section className="result-content-section"><header><div><span>原视频默认宝宝已经具备</span><h2>所需进食能力</h2></div></header><ul className="capability-list">{tomatoRiceAnalysis.capabilities.map((item) => <li key={item}><Check size={14} />{item}</li>)}</ul></section>
  </div>;
}

function LegacyRecipeResultPage() {
  const navigate = useNavigate();
  const { conclusion = "adapted" } = useParams();
  const { setScenario } = useContext(ScenarioContext);
  const scenario = routeResults[conclusion] || "adapted";
  const copy = suitabilityCopy[scenario];
  const serving = useAppStore((state) => state.serving);
  const setServing = useAppStore((state) => state.setServing);
  const recipeAdjustments = useAppStore((state) => state.recipeAdjustments);
  const setRecipeAdjustments = useAppStore((state) => state.setRecipeAdjustments);
  const saveRecipe = useAppStore((state) => state.saveRecipe);
  const profile = useAppStore((state) => state.profile);
  const [sheet, setSheet] = useState<"serving" | "replace" | "share" | "saved-menu" | null>(null);
  const [saved, setSaved] = useState(false);
  useEffect(() => setScenario(scenario), [scenario, setScenario]);
  const canCook = scenario === "adapted" || scenario === "direct";
  const displayIngredients = shrimpNoodleRecipe.ingredients.map((ingredient) => resolveIngredient(ingredient, recipeAdjustments.broccoli));
  return (
    <Screen className="result-screen">
      <TopBar title="宝宝版本" back="/home" />
      <section className="video-card">
        <div className="video-visual"><BowlVisual /><button aria-label="播放原视频"><Play size={22} fill="currentColor" /></button><span>00:42</span></div>
        <div><h1>宝宝虾滑面</h1><p>约 25 分钟 <i /> 1 份 <i /> 10 月龄软颗粒</p></div>
      </section>
      {canCook ? (
        <section className={cx("compact-conclusion", copy.className)}>
          <div><span className="status-dot"><ShieldCheck size={15} /></span><strong>{copy.label}</strong></div>
          <p>{scenario === "direct" ? "开始前确认视频没有遗漏食材。" : "面条煮软剪短；不加未确认调味；虾为首次尝试食材。"}</p>
        </section>
      ) : (
        <section className={cx("conclusion-card", copy.className)}>
          <div className="conclusion-top"><span className="conclusion-icon">{scenario === "not-recommended" ? <ShieldAlert /> : scenario === "uncertain" ? <FileQuestion /> : <ShieldCheck />}</span></div>
          <span className="eyebrow">给{profile.name}的适配结论</span>
          <h2>{copy.label}</h2>
          <h3>{copy.title}</h3>
          <p>{resultSummary(scenario)}</p>
          <div className="profile-evidence"><Baby size={16} /><span>依据：{profile.name} · {profile.months} 个月 · {stageLabels[profile.stage]}</span></div>
        </section>
      )}
      {scenario === "needs-info" && <MissingInfoCard onResolve={() => navigate("/result/adapted")} />}
      {scenario === "not-recommended" && <BlockedReasonCard />}
      {scenario === "uncertain" && <UncertainCard />}
      {canCook && (
        <>
          <section className="compact-recipe-section ingredient-section">
            <div className="compact-section-heading"><h2>食材</h2><button className="text-button" onClick={() => setSheet("serving")}><Edit3 size={13} />{serving} 份 · 换算</button></div>
            <div className="compact-ingredient-list">
              {displayIngredients.map((ingredient) => <IngredientRow key={ingredient.id} ingredient={ingredient} serving={serving} onReplace={ingredient.id === "broccoli" ? () => setSheet("replace") : undefined} />)}
            </div>
          </section>
          <section className="compact-recipe-section">
            <div className="compact-section-heading"><h2>制作步骤</h2><span>5 步 · 约 25 分钟</span></div>
            <div className="compact-steps-list">
              {shrimpNoodleRecipe.steps.map((step) => {
                const instruction = step.id === 4 && recipeAdjustments.broccoli === "omit"
                  ? "放入宝宝面和胡萝卜，煮到面条能被勺背轻松压断。"
                  : step.id === 4 && recipeAdjustments.broccoli === "carrot"
                    ? "放入宝宝面和全部胡萝卜碎，煮到面条和胡萝卜都足够软。"
                    : step.instruction;
                const duration = (step.duration ?? 0) + (step.id === 4 ? recipeAdjustments.extraCookMinutes * 60 : 0);
                return <article key={step.id}><span>{step.id}</span><div><div className="step-title-line"><strong>{step.title}</strong>{duration > 0 && <small><Timer size={11} />{Math.round(duration / 60)} 分钟</small>}</div><p>{instruction}</p>{(step.id === 3 || step.id === 4) && <em>技巧：{step.tip}</em>}</div></article>;
              })}
            </div>
          </section>
          <section className="compact-feeding-section">
            <h2>喂前检查</h2>
            <p><CheckCircle2 size={14} />剪短 · 压软 · 熟透 · 放凉 · 坐直看护</p>
            <div><ShieldAlert size={14} /><span>虾尚未记录为已尝试，首次只喂少量并观察。</span></div>
          </section>
          <div className="result-spacer" />
          <div className="sticky-actions">
            <div className="recipe-utility-actions">
              <button onClick={() => setSheet("share")}><span><Share2 size={16} /></span><strong>分享卡片</strong><small>预览·保存图片</small></button>
              <button onClick={() => { saveRecipe(scenario); setSheet("saved-menu"); }}><span><BookmarkCheck size={16} /></span><strong>保存菜单</strong><small>存到本机记录</small></button>
            </div>
            <Button full onClick={() => navigate("/cook/shrimp-noodle-demo/session")} icon={<MessageCircle size={18} />}>进入对话陪做</Button>
          </div>
        </>
      )}
      {!canCook && <div className="blocked-actions"><Button full onClick={() => {
        if (scenario === "uncertain") navigate("/home");
        else if (scenario === "not-recommended") navigate("/baby");
        else document.querySelector(".resolution-card")?.scrollIntoView({ behavior: "smooth", block: "center" });
      }}>{scenario === "uncertain" ? "换一条视频" : scenario === "needs-info" ? "补充上方信息" : "核对宝宝档案"}</Button><Button full variant="secondary" onClick={() => navigate("/home")}>返回首页</Button></div>}
      <AnimatePresence>{sheet === "serving" && <ServingSheet serving={serving} setServing={setServing} onClose={() => setSheet(null)} />}</AnimatePresence>
      <AnimatePresence>{sheet === "replace" && <ReplaceSheet current={recipeAdjustments.broccoli} onApply={(broccoli) => { setRecipeAdjustments({ broccoli }); setSheet(null); setSaved(true); }} onClose={() => setSheet(null)} />}</AnimatePresence>
      <AnimatePresence>{sheet === "share" && <ShareCardSheet profileName={profile.name} serving={serving} ingredients={displayIngredients} onClose={() => setSheet(null)} />}</AnimatePresence>
      <AnimatePresence>{sheet === "saved-menu" && <SavedMenuSheet serving={serving} onClose={() => setSheet(null)} onView={() => navigate("/history")} />}</AnimatePresence>
      <AnimatePresence>{saved && <Toast onClose={() => setSaved(false)}>已保存到本机记录</Toast>}</AnimatePresence>
    </Screen>
  );
}

// 旧结果页暂时保留其分享卡片与份量换算演示，避免影响本分支之外仍在引用的交互资产。
void LegacyRecipeResultPage;

function resolveIngredient(ingredient: Ingredient, broccoli: "keep" | "omit" | "carrot") {
  if (ingredient.id !== "broccoli") return ingredient;
  if (broccoli === "omit") return { ...ingredient, amount: "本次不放", note: "已从后续步骤移除" };
  if (broccoli === "carrot") return { ...ingredient, name: "胡萝卜（替换）", amount: "8 g", note: "每份与原有胡萝卜合计 18 g" };
  return ingredient;
}

function resultSummary(scenario: Suitability) {
  if (scenario === "direct") return "视频中的食材和质地与当前档案没有明显冲突。开始前仍请确认视频里没有遗漏的食材。";
  if (scenario === "needs-info") return "还不知道宝宝以前是否吃过主要食材，补充后才能生成宝宝版本。";
  if (scenario === "not-recommended") return "视频中包含已经记录为需要回避的食材，当前页面不会生成普通陪做步骤。";
  return "主要食材或关键熟制步骤没有说明清楚。你可以补充信息，或换一条更完整的视频。";
}

function MissingInfoCard({ onResolve }: { onResolve: () => void }) {
  const [answers, setAnswers] = useState<Record<string, "safe" | "unclear">>({});
  const [checked, setChecked] = useState(false);
  const answered = tomatoRiceAnalysis.blockers.every((item) => answers[item.id]);
  const canResolve = answered && Object.values(answers).every((value) => value === "safe");
  const choices: Record<string, [string, string]> = {
    meatball: ["已核对完整配料", "暂时不清楚"],
    history: ["这些食材都吃过", "有没吃过的食材"],
    cooking: ["全熟且没有额外调味", "熟度或调味不明确"],
  };
  return <section className="missing-info-card">
    <header><span><ListChecks size={18} /></span><div><small>会改变最终判断</small><h2>开始前必须确认</h2></div></header>
    <div className="blocking-question-list">{tomatoRiceAnalysis.blockers.map((item, index) => <article key={item.id}><div><span>{index + 1}</span><p><strong>{item.title}</strong><small>{item.detail}</small></p></div><div className="blocking-options">{choices[item.id].map((label, optionIndex) => { const value = optionIndex === 0 ? "safe" : "unclear"; return <button type="button" key={label} aria-pressed={answers[item.id] === value} className={cx(answers[item.id] === value && "selected")} onClick={() => { setAnswers((current) => ({ ...current, [item.id]: value })); setChecked(false); }}>{answers[item.id] === value && <Check size={13} />}{label}</button>; })}</div></article>)}</div>
    {checked && !canResolve && <div className="blocking-result"><ShieldAlert size={17} /><span><strong>目前还不能进入陪做</strong>存在未确认或未尝试的食材，需要拆分尝试或换一道信息更完整的菜谱。</span></div>}
    <Button full disabled={!answered} onClick={() => canResolve ? onResolve() : setChecked(true)}>重新计算适配结论</Button>
  </section>;
}

function BlockedReasonCard() {
  return <section className="resolution-card danger-border"><span className="eyebrow">阻断原因</span><h2>档案中记录了需要回避的食材</h2><p>这不是简单替换就能继续的情况。请先核对档案；若记录无误，建议换一道不包含该食材的菜谱。</p><div className="attention-note"><ShieldAlert size={18} /><span>当前不会生成普通陪做步骤。</span></div></section>;
}

function UncertainCard() {
  return <section className="resolution-card"><span className="eyebrow">视频中缺失</span><h2>主要食材和熟制状态无法确认</h2><ul className="plain-list"><li>没有完整食材表</li><li>关键画面被遮挡</li><li>字幕没有说明熟制时间</li></ul></section>;
}

function IngredientRow({ ingredient, serving, onReplace }: { ingredient: Ingredient; serving: number; onReplace?: () => void }) {
  const amount = scaledIngredientAmount(ingredient.amount, serving);
  return <article className="compact-ingredient-row"><span className="compact-food-icon">{ingredient.icon}</span><div><strong>{ingredient.name}</strong>{ingredient.status === "untried" && <span>首次尝试</span>}{ingredient.optional && <small>可选</small>}</div><i /><strong>{amount}</strong>{onReplace && <button onClick={onReplace}>调整</button>}</article>;
}

function scaledIngredientAmount(amount: string, serving: number) {
  const numeric = Number.parseFloat(amount);
  return Number.isNaN(numeric) ? amount : amount.replace(String(numeric), String(Math.round(numeric * serving * 10) / 10));
}

function ShareCardSheet({ profileName, serving, ingredients, onClose }: { profileName: string; serving: number; ingredients: Ingredient[]; onClose: () => void }) {
  const [working, setWorking] = useState<"share" | "download" | null>(null);
  const [message, setMessage] = useState("");
  const createFile = () => generateShareCardFile(profileName, serving, ingredients);
  const download = async () => {
    setWorking("download");
    try {
      downloadShareFile(await createFile());
      setMessage("卡片已保存为 PNG 图片");
    } finally {
      setWorking(null);
    }
  };
  const share = async () => {
    setWorking("share");
    try {
      const file = await createFile();
      if (navigator.share && (!navigator.canShare || navigator.canShare({ files: [file] }))) {
        await navigator.share({ title: `${profileName}的宝宝虾滑面`, text: "已按宝宝档案整理的宝宝版本", files: [file] });
        setMessage("已打开系统分享");
      } else {
        downloadShareFile(file);
        setMessage("当前浏览器不支持系统分享，已保存图片");
      }
    } catch (error) {
      if (!(error instanceof DOMException && error.name === "AbortError")) setMessage("分享未完成，可以先保存图片");
    } finally {
      setWorking(null);
    }
  };
  return <Sheet title="分享宝宝版本" onClose={onClose}><div className="share-sheet-content">
    <p>分享的是精简后的宝宝版本，不包含宝宝档案中的其他信息。</p>
    <article className="share-card-preview">
      <header><span>宝宝饱饱</span><small>{profileName}的宝宝版本</small></header>
      <h2>宝宝虾滑面</h2>
      <div className="share-meta"><span>10 月龄</span><span>{serving} 份</span><span>约 25 分钟</span></div>
      <section><strong>调整后可以做</strong><p>面条煮软剪短 · 不加未确认调味 · 首次尝虾只喂少量</p></section>
      <div className="share-card-columns"><div><h3>食材</h3>{ingredients.map((ingredient) => <p key={ingredient.id}><span>{ingredient.name}</span><b>{scaledIngredientAmount(ingredient.amount, serving)}</b></p>)}</div><div><h3>关键做法</h3><p><i>1</i><span>虾滑完全熟透</span></p><p><i>2</i><span>面条煮软剪短</span></p><p><i>3</i><span>放凉后坐直看护</span></p></div></div>
      <footer>不替代专业喂养建议</footer>
    </article>
    {message && <div className="share-message"><CheckCircle2 size={15} />{message}</div>}
    <div className="share-sheet-actions"><Button full variant="secondary" onClick={download} disabled={working !== null} icon={<Download size={17} />}>{working === "download" ? "正在生成…" : "保存图片"}</Button><Button full onClick={share} disabled={working !== null} icon={<Share2 size={17} />}>{working === "share" ? "正在生成…" : "系统分享"}</Button></div>
  </div></Sheet>;
}

function SavedMenuSheet({ serving, onClose, onView }: { serving: number; onClose: () => void; onView: () => void }) {
  return <Sheet title="已保存到菜单" onClose={onClose}><div className="saved-menu-content">
    <div className="saved-menu-hero"><span><BookmarkCheck size={25} /></span><div><small>今天保存</small><h2>宝宝虾滑面</h2><p>10 月龄软颗粒 · {serving} 份 · 约 25 分钟</p></div></div>
    <section><h3>菜单中已保留</h3><div><span><Check size={14} />宝宝适配结论</span><span><Check size={14} />5 种食材与当前份量</span><span><Check size={14} />5 个制作步骤</span><span><Check size={14} />食材调整与喂前提醒</span></div></section>
    <p className="saved-menu-note">菜单保存在当前浏览器，稍后可从“记录”继续制作。</p>
    <Button full onClick={onView}>查看已保存菜单</Button><Button full variant="ghost" onClick={onClose}>继续留在这里</Button>
  </div></Sheet>;
}

async function generateShareCardFile(profileName: string, serving: number, ingredients: Ingredient[]) {
  const canvas = document.createElement("canvas");
  canvas.width = 1080;
  canvas.height = 1440;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Canvas is unavailable");
  const roundRect = (x: number, y: number, width: number, height: number, radius: number, fill: string) => {
    context.beginPath();
    context.roundRect(x, y, width, height, radius);
    context.fillStyle = fill;
    context.fill();
  };
  context.fillStyle = "#FBF6ED";
  context.fillRect(0, 0, canvas.width, canvas.height);
  roundRect(54, 54, 972, 1332, 52, "#FFFCF7");
  roundRect(54, 54, 972, 322, 52, "#FFF1B8");
  context.fillStyle = "#8D6A20";
  context.font = '700 34px "PingFang SC", sans-serif';
  context.fillText("宝宝饱饱", 112, 132);
  context.textAlign = "right";
  context.font = '500 27px "PingFang SC", sans-serif';
  context.fillText(`${profileName}的宝宝版本`, 968, 132);
  context.textAlign = "left";
  context.fillStyle = "#342E2A";
  context.font = '700 70px "PingFang SC", sans-serif';
  context.fillText("宝宝虾滑面", 112, 246);
  context.font = '500 28px "PingFang SC", sans-serif';
  context.fillStyle = "#665D56";
  context.fillText(`10 月龄软颗粒   ·   ${serving} 份   ·   约 25 分钟`, 112, 312);
  roundRect(92, 410, 896, 176, 30, "#FFE1D7");
  context.fillStyle = "#8A4F43";
  context.font = '700 34px "PingFang SC", sans-serif';
  context.fillText("调整后可以做", 132, 472);
  context.font = '500 26px "PingFang SC", sans-serif';
  context.fillStyle = "#665D56";
  context.fillText("面条煮软剪短 · 不加未确认调味", 132, 524);
  context.fillText("虾为首次尝试食材，首次只喂少量并观察", 132, 561);
  context.fillStyle = "#342E2A";
  context.font = '700 36px "PingFang SC", sans-serif';
  context.fillText("食材", 112, 666);
  context.fillText("关键做法", 590, 666);
  context.strokeStyle = "#E9DED0";
  context.lineWidth = 2;
  context.beginPath();
  context.moveTo(540, 638);
  context.lineTo(540, 1134);
  context.stroke();
  ingredients.forEach((ingredient, index) => {
    const y = 732 + index * 82;
    context.fillStyle = index === 0 ? "#FFF0EA" : "#F5ECDE";
    roundRect(112, y - 34, 54, 54, 15, context.fillStyle as string);
    context.fillStyle = "#735E4B";
    context.font = '700 20px "PingFang SC", sans-serif';
    context.textAlign = "center";
    context.fillText(ingredient.icon, 139, y + 1);
    context.textAlign = "left";
    context.fillStyle = "#342E2A";
    context.font = '600 28px "PingFang SC", sans-serif';
    context.fillText(ingredient.name, 186, y);
    context.textAlign = "right";
    context.font = '600 25px "PingFang SC", sans-serif';
    context.fillText(scaledIngredientAmount(ingredient.amount, serving), 480, y);
    context.textAlign = "left";
  });
  ["虾滑中心完全熟透", "面条煮软后剪短", "放凉并坐直看护"].forEach((text, index) => {
    const y = 738 + index * 118;
    roundRect(590, y - 40, 56, 56, 18, index === 1 ? "#FFF1B8" : "#FFE1D7");
    context.fillStyle = "#765149";
    context.font = '700 24px "PingFang SC", sans-serif';
    context.textAlign = "center";
    context.fillText(String(index + 1), 618, y - 3);
    context.textAlign = "left";
    context.fillStyle = "#342E2A";
    context.font = '600 28px "PingFang SC", sans-serif';
    context.fillText(text, 670, y - 2);
  });
  roundRect(92, 1188, 896, 104, 26, "#F5ECDE");
  context.fillStyle = "#665D56";
  context.font = '500 24px "PingFang SC", sans-serif';
  context.textAlign = "center";
  context.fillText("不替代专业喂养建议", 540, 1252);
  context.fillStyle = "#948A82";
  context.font = '500 22px "PingFang SC", sans-serif';
  context.fillText("分享自 宝宝饱饱", 540, 1340);
  const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob((value) => value ? resolve(value) : reject(new Error("Unable to create image")), "image/png", 0.96));
  return new File([blob], `宝宝虾滑面-${profileName}宝宝版本.png`, { type: "image/png" });
}

function downloadShareFile(file: File) {
  const url = URL.createObjectURL(file);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = file.name;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function ServingSheet({ serving, setServing, onClose }: { serving: number; setServing: (value: number) => void; onClose: () => void }) {
  return <Sheet title="调整这次的份量" onClose={onClose}><div className="sheet-content"><p className="sheet-question">这次准备做几份？</p><div className="stepper"><IconButton label="减少一份" disabled={serving <= 1} onClick={() => setServing(Math.max(1, serving - 1))}><Minus /></IconButton><strong>{serving}<small>份</small></strong><IconButton label="增加一份" disabled={serving >= 4} onClick={() => setServing(Math.min(4, serving + 1))}><Plus /></IconButton></div><div className="recalc-card"><Sparkles size={17} /><span>食材用量已按 {serving} 份重新计算；熟制状态仍要以实际质地为准。</span></div><Button full onClick={onClose}>使用这个份量</Button></div></Sheet>;
}

function ReplaceSheet({ current, onApply, onClose }: { current: "keep" | "omit" | "carrot"; onApply: (value: "keep" | "omit" | "carrot") => void; onClose: () => void }) {
  const [choice, setChoice] = useState<"keep" | "omit" | "carrot">(current === "keep" ? "omit" : current);
  return <Sheet title="没有西蓝花怎么办？" onClose={onClose}><div className="sheet-content"><p>西蓝花在这份菜谱里是可选蔬菜，不影响虾滑成形。</p><div className="radio-list"><button className={cx(choice === "omit" && "selected")} onClick={() => setChoice("omit")}><span><strong>这次不放西蓝花</strong><small>后续步骤会自动移除</small></span><CheckCircle2 /></button><button className={cx(choice === "carrot" && "selected")} onClick={() => setChoice("carrot")}><span><strong>换成已经尝试过的胡萝卜</strong><small>总量调整为 18 g</small></span><CheckCircle2 /></button><button className={cx(choice === "keep" && "selected")} onClick={() => setChoice("keep")}><span><strong>继续使用西蓝花</strong><small>保持原食材和步骤</small></span><CheckCircle2 /></button></div><Button full onClick={() => onApply(choice)}>更新食材和步骤</Button></div></Sheet>;
}

function CookSessionPage() {
  const { id } = useParams();
  if (id === tomatoRiceAnalysis.id) return <TomatoRiceConversationPage />;
  if (id === "shrimp-noodle-demo") return <ShrimpCookSessionPage />;
  const inspirationIdea = inspirationIdeaById(id);
  if (inspirationIdea) return <InspirationCookSession idea={inspirationIdea} />;
  return <GeneratedCookSession jobId={id || ""} />;
}

function InspirationCookSession({ idea }: { idea: (typeof homeInspirationIdeas)[number] }) {
  const navigate = useNavigate();
  const [stepIndex, setStepIndex] = useState(0);
  const [completed, setCompleted] = useState<number[]>([]);
  const [messages, setMessages] = useState<Array<{ id: string; role: "user" | "assistant"; text: string; step: number }>>([]);
  const [input, setInput] = useState("");
  const [recording, setRecording] = useState(false);
  const timelineRef = useRef<HTMLDivElement>(null);
  const step = idea.steps[stepIndex];
  const voice = useCookingVoice(`${step.title}。${step.instruction}。完成状态：${step.check}`);
  useEffect(() => { timelineRef.current?.scrollTo({ top: timelineRef.current.scrollHeight, behavior: "smooth" }); }, [stepIndex, messages.length]);
  const ask = (raw = input) => {
    const question = raw.trim();
    if (!question) return;
    const answer = /为什么|原因/.test(question)
      ? `这样处理是为了让成品质地更稳定。当前请以现场完成状态为准：${step.check}`
      : /多久|时间/.test(question)
        ? `这一步预计${step.timing}。时间只是提醒，真正完成时应达到：${step.check}`
        : `先不要急着进入下一步。请继续处理，直到达到这个状态：${step.check}`;
    setMessages((current) => [...current, { id: `${Date.now()}-u`, role: "user", text: question, step: stepIndex }, { id: `${Date.now()}-a`, role: "assistant", text: answer, step: stepIndex }]);
    setInput("");
    if (voice.voiceMode) window.setTimeout(() => void voice.speak(answer), 80);
  };
  const finishStep = () => {
    setCompleted((current) => [...current, stepIndex]);
    if (stepIndex === idea.steps.length - 1) {
      childVoiceTts.cancel();
      navigate(`/feedback/${idea.id}/now`);
      return;
    }
    setStepIndex((current) => current + 1);
  };
  return <Screen className="cook-session-screen inspiration-cook-session">
    <header className="session-header"><IconButton className="back-button" label="退出陪做" onClick={() => navigate("/home", { state: { transition: "back" } })}><ArrowLeft size={20} /></IconButton><div className="session-progress"><span style={{ width: `${((completed.length + .35) / idea.steps.length) * 100}%` }} /></div><button className={cx("voice-mode", voice.voiceMode && "active")} onClick={() => void voice.toggleVoice()}><Volume2 size={16} />{voice.label}</button></header>
    <div className="session-context"><span>{idea.title}</span></div>
    <VoiceStatus engine={voice.voiceEngine} error={voice.voiceError} />
    <div className="conversation-timeline" ref={timelineRef} aria-live="polite"><AssistantMessage><p>我们开始做{idea.title}。准备食材：{idea.ingredients}。接下来每次只完成当前行动，你可以随时语音或打字问我。</p></AssistantMessage>{completed.map((index) => <div className="conversation-pair completed" key={index}><AssistantMessage intent="confirm"><article className="conversation-step completed"><div className="conversation-step-head"><span>{idea.steps[index].timing}</span><CheckCircle2 size={16} /></div><h2>{idea.steps[index].title}</h2></article></AssistantMessage>{messages.filter((message) => message.step === index).map((message) => message.role === "user" ? <UserMessage key={message.id}>{message.text}</UserMessage> : <AssistantMessage key={message.id}><p>{message.text}</p></AssistantMessage>)}<UserMessage>已经达到这个状态</UserMessage></div>)}<AssistantMessage intent={resolveCookingIntent(step.actionKind)}><article className="conversation-step"><div className="conversation-step-head"><span>当前行动 {stepIndex + 1} · {step.timing}</span></div><h2>{step.title}</h2><p>{step.instruction}</p><div className="inline-check"><strong>做到什么算完成？</strong><span>{step.check}</span></div></article></AssistantMessage>{messages.filter((message) => message.step === stepIndex).map((message) => message.role === "user" ? <UserMessage key={message.id}>{message.text}</UserMessage> : <AssistantMessage key={message.id}><p>{message.text}</p></AssistantMessage>)}</div>
    <div className="session-dock"><div className="session-suggestions"><button className="primary-suggestion" onClick={finishStep}><CheckCircle2 size={14} />{stepIndex === idea.steps.length - 1 ? "完成并记录反馈" : "已经达到这个状态"}</button><button onClick={() => ask("这一步为什么要这样做？")}><MessageCircle size={14} />为什么这样做</button></div><div className="session-composer"><IconButton label="语音输入" onClick={() => { setRecording(true); window.setTimeout(() => { setRecording(false); setInput("这一步做到什么程度算完成？"); }, 700); }}><Mic size={19} /></IconButton><input value={recording ? "正在听…" : input} disabled={recording} placeholder={voice.voiceMode ? "直接说，或在这里输入…" : "说说现在遇到的情况…"} onChange={(event) => setInput(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") ask(); }} /><IconButton label="发送" disabled={!input.trim()} onClick={() => ask()}><Send size={19} /></IconButton></div><p className="session-boundary">实际熟制状态请以现场检查为准</p></div>
  </Screen>;
}

function GeneratedCookSession({ jobId }: { jobId: string }) {
  const navigate = useNavigate();
  const profile = useAppStore((state) => state.profile);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [stepIndex, setStepIndex] = useState(0);
  const [prepared, setPrepared] = useState(false);
  const [completed, setCompleted] = useState<number[]>([]);
  const [messages, setMessages] = useState<Array<{ id: string; role: "user" | "assistant"; text: string; step: number }>>([]);
  const [input, setInput] = useState("");
  const [recording, setRecording] = useState(false);
  const [riskInterrupted, setRiskInterrupted] = useState(false);
  const [timerEndAt, setTimerEndAt] = useState<number | null>(null);
  const [answering, setAnswering] = useState(false);
  const [questionError, setQuestionError] = useState("");
  const [failedQuestion, setFailedQuestion] = useState("");
  const timelineRef = useRef<HTMLDivElement>(null);
  const questionRequestRef = useRef<AbortController | null>(null);
  useEffect(() => { getAnalysisResult(jobId).then(setResult).catch(() => navigate(`/result/analysis/${jobId}`, { replace: true })); }, [jobId, navigate]);
  useEffect(() => () => questionRequestRef.current?.abort(), []);
  const steps = result?.陪做步骤 ?? [];
  const step = steps[Math.min(stepIndex, Math.max(steps.length - 1, 0))];
  const timerDuration = step ? cookingStepTimerSeconds(step) : null;
  const announcement = !prepared
    ? "开始前，我们先确认食材是否齐全。缺什么可以直接告诉我。"
    : step ? `${step.title}。${step.instruction}。完成标准：${step.completion_check}` : "";
  const voice = useCookingVoice(announcement, riskInterrupted || !result);
  useEffect(() => { timelineRef.current?.scrollTo({ top: timelineRef.current.scrollHeight, behavior: "smooth" }); }, [completed.length, messages.length, prepared, riskInterrupted, stepIndex]);
  if (!result || !step) return <Screen className="analysis-screen"><TopBar title="分步骤陪做" back={`/result/analysis/${jobId}`} /><section className="analysis-visual"><div className="analysis-orbit"><div className="analysis-center"><CharacterIllustration intent="prepare" size="hero" /></div><i /><i /><i /></div><h1>正在准备陪做步骤</h1></section></Screen>;
  const ask = async (raw = input, reuseLastUser = false) => {
    const question = raw.trim();
    if (!question || answering) return;
    const messageStep = prepared ? stepIndex : -1;
    const userMessage = { id: crypto.randomUUID(), role: "user" as const, text: question, step: messageStep };
    const requestMessages = (reuseLastUser ? messages : [...messages, userMessage]).slice(-12).map(({ role, text }) => ({ role, text }));
    if (!reuseLastUser) setMessages((items) => [...items, userMessage]);
    setInput("");
    setQuestionError("");
    setFailedQuestion("");
    if (isUrgentCookingQuestion(question)) {
      const answer = "普通陪做已暂停。请立即停止喂食；如果出现呼吸困难、明显肿胀、意识异常或症状快速加重，请立即寻求当地紧急医疗帮助。";
      setMessages((items) => [...items, { id: crypto.randomUUID(), role: "assistant", text: answer, step: messageStep }]);
      setRiskInterrupted(true);
      setTimerEndAt(null);
      return;
    }

    setAnswering(true);
    const controller = new AbortController();
    questionRequestRef.current = controller;
    const assistantId = crypto.randomUUID();
    let started = false;
    try {
      const answer = await streamBabyAgent(requestMessages, profile, (delta) => {
        if (!started) {
          started = true;
          setMessages((items) => [...items, { id: assistantId, role: "assistant", text: delta, step: messageStep }]);
          return;
        }
        setMessages((items) => items.map((message) => message.id === assistantId ? { ...message, text: message.text + delta } : message));
      }, controller.signal, {
        jobId,
        stepIndex,
        prepared,
        completedStepIds: completed.map((index) => steps[index]?.step_id).filter((id): id is string => Boolean(id)),
        timerDurationSeconds: timerDuration,
        timerRemainingSeconds: timerEndAt ? Math.max(0, Math.ceil((timerEndAt - Date.now()) / 1000)) : null,
      });
      if (voice.voiceMode) void voice.speak(answer);
    } catch (error) {
      if (controller.signal.aborted) return;
      setQuestionError(error instanceof Error ? error.message : "小助手暂时无法回答；你仍可按当前完成标准继续");
      setFailedQuestion(question);
    } finally {
      setAnswering(false);
      if (questionRequestRef.current === controller) questionRequestRef.current = null;
    }
  };
  const next = () => {
    setQuestionError("");
    setFailedQuestion("");
    if (stepIndex >= steps.length - 1) { childVoiceTts.cancel(); navigate(`/feedback/${jobId}/now`); return; }
    setTimerEndAt(null);
    setCompleted((items) => [...items, stepIndex]);
    setStepIndex((value) => value + 1);
  };
  const quickActions = step.quick_actions
    .filter((item) => !/已经|完成|异常/.test(item))
    .slice(0, 2);
  return <Screen className="cook-session-screen generated-cook-session">
    <header className="session-header"><IconButton className="back-button" label="退出陪做" onClick={() => navigate(`/result/analysis/${jobId}`)}><ArrowLeft size={20} /></IconButton><div className="session-progress"><span style={{ width: `${prepared ? ((completed.length + .35) / steps.length) * 100 : 5}%` }} /></div><button className={cx("voice-mode", voice.voiceMode && "active")} onClick={() => void voice.toggleVoice()}><Volume2 size={16} />{voice.label}</button></header>
    <div className="session-context"><span>{result.宝宝版本.title}</span></div>
    <VoiceStatus engine={voice.voiceEngine} error={voice.voiceError} />
    <div className="conversation-timeline" ref={timelineRef} aria-live="polite"><AssistantMessage><p>我们按宝宝版本来做。开始前先确认食材，之后每次只说当前行动；有变化随时问我。</p></AssistantMessage><AssistantMessage><div className="ingredient-message"><strong>这些食材都准备好了吗？</strong><ul>{result.宝宝版本.ingredients.map((ingredient) => <li key={ingredient.name}>{ingredient.name}{ingredient.amount ? ` ${ingredient.amount}` : ""}{ingredient.preparation ? ` · ${ingredient.preparation}` : ""}</li>)}</ul></div></AssistantMessage>{messages.filter((message) => message.step === -1).map((message) => message.role === "user" ? <UserMessage key={message.id}>{message.text}</UserMessage> : <AssistantMessage key={message.id}><p>{message.text}</p></AssistantMessage>)}{prepared && <><UserMessage>都准备好了</UserMessage><AssistantMessage><p>好，食材确认完成。接下来我每次只告诉你当前要做的事。</p></AssistantMessage></>}{prepared && completed.map((index) => { const done = steps[index]; return <div className="conversation-pair completed generated-completed-step" key={done.step_id}><AssistantMessage intent="confirm"><article className="conversation-step completed">{done.image_url && <img /* eslint-disable-line @next/next/no-img-element */ className="generated-cook-frame" src={done.image_url} alt={done.keyframe_description || done.title} />}<div className="conversation-step-head"><span>已完成 · {done.timing || `行动 ${index + 1}`}</span><CheckCircle2 size={16} /></div><h2>{done.title}</h2><p>{done.instruction}</p><div className="inline-check"><strong>完成状态</strong><span>{done.completion_check}</span></div><div className="inline-tip"><Info size={15} /><span>{done.personal_reminder}</span></div></article></AssistantMessage>{messages.filter((message) => message.step === index).map((message) => message.role === "user" ? <UserMessage key={message.id}>{message.text}</UserMessage> : <AssistantMessage key={message.id}><p>{message.text}</p></AssistantMessage>)}<UserMessage>已经达到这个状态</UserMessage></div>; })}{prepared && !riskInterrupted && <AssistantMessage intent="prepare"><article className="conversation-step">{step.image_url && <img /* eslint-disable-line @next/next/no-img-element */ className="generated-cook-frame" src={step.image_url} alt={step.keyframe_description || step.title} />}<div className="conversation-step-head"><span>当前行动 {stepIndex + 1}{step.timing ? ` · ${step.timing}` : ""}</span></div><h2>{step.title}</h2><p>{step.instruction}</p><div className="inline-check"><strong>做到什么算完成？</strong><span>{step.completion_check}</span></div><div className="inline-tip"><Info size={15} /><span>{step.personal_reminder}</span></div>{timerDuration && <CookingTimer duration={timerDuration} endAt={timerEndAt} setEndAt={setTimerEndAt} />}</article></AssistantMessage>}{prepared && messages.filter((message) => message.step === stepIndex).map((message) => message.role === "user" ? <UserMessage key={message.id}>{message.text}</UserMessage> : <AssistantMessage key={message.id}><p>{message.text}</p></AssistantMessage>)}{answering && <AssistantMessage><div className="conversation-thinking"><i /><i /><i /></div></AssistantMessage>}</div>
    <div className="session-dock">{questionError && <div className="agent-error" role="alert"><WifiOff size={14} /><span>{questionError}</span>{failedQuestion && <button type="button" onClick={() => void ask(failedQuestion, true)}>重试</button>}</div>}<div key={riskInterrupted ? "risk" : prepared ? `step-${stepIndex}` : "prepare"} className={cx("session-suggestions", prepared && "prepared")}>{riskInterrupted ? <button className="risk-suggestion" onClick={() => navigate(`/feedback/${jobId}/now`)}>停止陪做，记录异常</button> : !prepared ? <><button className="primary-suggestion" disabled={answering} onClick={() => setPrepared(true)}>都准备好了</button><button className="session-secondary-action" disabled={answering} onClick={() => setInput("有食材没准备好") }>有食材没准备好</button></> : <><button className="primary-suggestion" disabled={answering} onClick={next}><CheckCircle2 size={16} />{stepIndex === steps.length - 1 ? "完成并记录反馈" : "已经达到这个状态"}</button>{quickActions.map((item) => <button className="session-quick-action" type="button" disabled={answering} key={item} onClick={() => void ask(item)}>{item}</button>)}</>}</div><div className={cx("session-composer", recording && "recording")}><IconButton label="语音输入" disabled={answering || riskInterrupted} onClick={() => { setRecording(true); window.setTimeout(() => { setRecording(false); setInput(prepared ? "这一步做到什么程度算完成？" : "有食材没准备好"); }, 700); }}><Mic size={19} /></IconButton><input value={recording ? "正在听…" : input} disabled={recording || answering || riskInterrupted} onChange={(event) => setInput(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") void ask(); }} placeholder={answering ? "小助手正在结合当前步骤回答…" : voice.voiceMode ? "直接说，或在这里输入…" : "说说现在遇到的情况…"} /><IconButton label="发送" disabled={!input.trim() || answering || riskInterrupted} onClick={() => void ask()}><Send size={19} /></IconButton></div></div>
  </Screen>;
}

function LegacyTomatoRiceCookSessionPage() {
  const navigate = useNavigate();
  const [stepIndex, setStepIndex] = useState(0);
  const [timerEndAt, setTimerEndAt] = useState<number | null>(null);
  const [finished, setFinished] = useState(false);
  const phase = tomatoRiceAnalysis.phases[stepIndex];
  const progress = finished ? 100 : ((stepIndex + .35) / tomatoRiceAnalysis.phases.length) * 100;
  return <Screen className="cook-session-screen tomato-cook-session">
    <header className="session-header">
      <IconButton className="back-button" label="退出陪做" onClick={() => navigate("/result/adapted", { state: { transition: "back" } })}><ArrowLeft size={20} /></IconButton>
      <div className="session-progress"><span style={{ width: `${progress}%` }} /></div>
      <span className="tomato-session-count">{finished ? "完成" : `${stepIndex + 1} / ${tomatoRiceAnalysis.phases.length}`}</span>
    </header>
    <div className="session-context"><span>{tomatoRiceAnalysis.title}</span></div>
    <div className="conversation-timeline" aria-live="polite">
      <AssistantMessage><p>我们按乐乐版来做。我每次只给你当前行动；原视频里没有确认的食材和调味，不会自动加入。</p></AssistantMessage>
      {!finished ? <>
        <AssistantMessage intent={resolveCookingIntent(phase.actionKind)}><article className="conversation-step"><div className="conversation-step-head"><span>{phase.time}</span></div><h2>{phase.title}</h2><p>{phase.action}</p><div className="inline-check"><strong>做到什么算完成？</strong><span>{phase.check}</span></div>{stepIndex === 0 && <div className="parallel-prep-note"><ListChecks size={15} /><span>这四项可以并行准备，不需要等前一项完成再开始下一项。</span></div>}{stepIndex === 2 && <CookingTimer duration={3600} endAt={timerEndAt} setEndAt={setTimerEndAt} />}{stepIndex === 3 && <div className="inline-tip"><Bell size={15} /><span>这一步应该在焖煮剩余约 20 分钟时执行。</span></div>}</article></AssistantMessage>
      </> : <AssistantMessage><div className="tomato-cook-complete"><CheckCircle2 size={28} /><h2>这份软饭完成了</h2><p>喂之前再确认：米粒能压开、肉末没有结团、青菜没有粗梗或长纤维，温度适宜。</p></div></AssistantMessage>}
    </div>
    <div className="session-dock tomato-session-dock">
      {!finished ? <Button full onClick={() => { setTimerEndAt(null); if (stepIndex === tomatoRiceAnalysis.phases.length - 1) setFinished(true); else setStepIndex((current) => current + 1); }}>{stepIndex === tomatoRiceAnalysis.phases.length - 1 ? "完成制作" : "已经达到这个状态"}</Button> : <Button full onClick={() => navigate("/result/adapted")}>返回宝宝版本</Button>}
      <p className="session-boundary">实际熟制状态请以现场检查为准</p>
    </div>
  </Screen>;
}

void LegacyTomatoRiceCookSessionPage;

type TomatoCookMessage = { id: string; role: "user" | "assistant"; text: string; step: number };

function TomatoRiceConversationPage() {
  const navigate = useNavigate();
  const [stepIndex, setStepIndex] = useState(0);
  const [completed, setCompleted] = useState<number[]>([]);
  const [messages, setMessages] = useState<TomatoCookMessage[]>([]);
  const [input, setInput] = useState("");
  const [recording, setRecording] = useState(false);
  const [timerEndAt, setTimerEndAt] = useState<number | null>(null);
  const timelineRef = useRef<HTMLDivElement>(null);
  const phase = tomatoRiceAnalysis.phases[stepIndex];
  const progress = ((completed.length + .35) / tomatoRiceAnalysis.phases.length) * 100;
  const voice = useCookingVoice(`${phase.title}。${phase.action}。完成状态：${phase.check}`);
  useEffect(() => {
    timelineRef.current?.scrollTo({ top: timelineRef.current.scrollHeight, behavior: "smooth" });
  }, [stepIndex, messages.length]);
  const answerQuestion = (raw = input) => {
    const value = raw.trim();
    if (!value) return;
    const userMessage: TomatoCookMessage = { id: `${Date.now()}-user`, role: "user", text: value, step: stepIndex };
    const answer = /为什么|原因/.test(value)
      ? `这一步这样处理，是为了让成品质地更接近乐乐当前能稳定处理的范围。完成时请看实际状态：${phase.check}。`
      : /多久|时间|还要/.test(value)
        ? `当前阶段的时间提示是“${phase.time}”。计时只作提醒，是否完成仍要看：${phase.check}。`
        : /硬|大块|成团|纤维/.test(value)
          ? `先不要进入下一步。继续压细或软化，直到达到这个状态：${phase.check}。`
          : `我记下了。当前先完成“${phase.title}”，判断标准是：${phase.check}。`;
    setMessages((current) => [...current, userMessage, { id: `${Date.now()}-assistant`, role: "assistant", text: answer, step: stepIndex }]);
    setInput("");
    if (voice.voiceMode) window.setTimeout(() => void voice.speak(answer), 80);
  };
  const simulateVoice = () => {
    setRecording(true);
    window.setTimeout(() => { setRecording(false); setInput("这一步做到什么程度算完成？"); }, 900);
  };
  const finishStep = () => {
    const doneNumber = stepIndex;
    setCompleted((current) => [...current, doneNumber]);
    setMessages((current) => [...current, { id: `${Date.now()}-done`, role: "user", text: "已经达到这个状态", step: doneNumber }]);
    setTimerEndAt(null);
    if (stepIndex === tomatoRiceAnalysis.phases.length - 1) {
      childVoiceTts.cancel();
      navigate(`/feedback/${tomatoRiceAnalysis.id}/now`);
      return;
    }
    setStepIndex((current) => current + 1);
  };
  return <Screen className="cook-session-screen tomato-cook-session">
    <header className="session-header">
      <IconButton className="back-button" label="退出陪做" onClick={() => navigate("/result/adapted", { state: { transition: "back" } })}><ArrowLeft size={20} /></IconButton>
      <div className="session-progress"><span style={{ width: `${progress}%` }} /></div>
      <button className={cx("voice-mode", voice.voiceMode && "active")} onClick={() => void voice.toggleVoice()}><Volume2 size={16} />{voice.label}</button>
    </header>
    <div className="session-context"><span>{tomatoRiceAnalysis.title}</span></div>
    <VoiceStatus engine={voice.voiceEngine} error={voice.voiceError} />
    <div className="conversation-timeline" ref={timelineRef} aria-live="polite">
      <AssistantMessage><p>我们按乐乐版来做。接下来每次只说当前行动；你可以直接打字或用语音问我。</p></AssistantMessage>
      {completed.map((number) => {
        const done = tomatoRiceAnalysis.phases[number];
        return <div className="conversation-pair completed" key={number}><AssistantMessage intent="confirm"><article className="conversation-step completed"><div className="conversation-step-head"><span>{done.time}</span><CheckCircle2 size={16} /></div><h2>{done.title}</h2></article></AssistantMessage><UserMessage>已经达到这个状态</UserMessage></div>;
      })}
      <AssistantMessage intent={resolveCookingIntent(phase.actionKind)}><article className="conversation-step"><div className="conversation-step-head"><span>当前行动 {stepIndex + 1} · {phase.time}</span></div><h2>{phase.title}</h2><p>{phase.action}</p><div className="inline-check"><strong>做到什么算完成？</strong><span>{phase.check}</span></div>{stepIndex === 0 && <div className="parallel-prep-note"><ListChecks size={15} /><span>这四项可以同时准备，不需要等前一项完成。</span></div>}{stepIndex === 2 && <CookingTimer duration={3600} endAt={timerEndAt} setEndAt={setTimerEndAt} />}{stepIndex === 3 && <div className="inline-tip"><Bell size={15} /><span>焖煮剩余约 20 分钟时执行这一步。</span></div>}</article></AssistantMessage>
      {messages.filter((message) => message.step === stepIndex && !message.id.endsWith("-done")).map((message) => message.role === "user" ? <UserMessage key={message.id}>{message.text}</UserMessage> : <AssistantMessage key={message.id}><p>{message.text}</p></AssistantMessage>)}
    </div>
    <div className="session-dock tomato-conversation-dock">
      <p className="session-boundary"><Info size={12} />实际熟制状态请以现场检查为准</p>
      <div className="quick-action-heading"><strong>直接操作</strong><span>也可以在下方语音或打字提问</span></div>
      <div className="session-suggestions"><button className="primary-suggestion" onClick={finishStep}><CheckCircle2 size={14} />{stepIndex === tomatoRiceAnalysis.phases.length - 1 ? "完成并记录反馈" : "已经达到完成状态"}</button><button onClick={() => answerQuestion("这一步为什么要这样做？")}><MessageCircle size={14} />为什么这样做</button>{stepIndex === 4 && <button onClick={() => answerQuestion("米粒还是有点硬")}><Timer size={14} />米粒还硬</button>}</div>
      <div className={cx("session-composer", recording && "recording")}><IconButton label="语音输入" onClick={simulateVoice}><Mic size={19} /></IconButton><input value={recording ? "正在听…" : input} disabled={recording} placeholder={voice.voiceMode ? "直接说，或在这里输入" : "问问当前这一步"} onChange={(event) => setInput(event.target.value)} onKeyDown={(event) => event.key === "Enter" && answerQuestion()} /><IconButton className="composer-send" label="发送" disabled={!input.trim()} onClick={() => answerQuestion()}><Send size={18} /></IconButton></div>
    </div>
  </Screen>;
}

function ShrimpCookSessionPage() {
  const navigate = useNavigate();
  const profileName = useAppStore((state) => state.profile.name);
  const stepNumber = useAppStore((state) => state.cookStep);
  const cookPrepared = useAppStore((state) => state.cookPrepared);
  const setCookPrepared = useAppStore((state) => state.setCookPrepared);
  const cookIngredientBlocked = useAppStore((state) => state.cookIngredientBlocked);
  const setCookIngredientBlocked = useAppStore((state) => state.setCookIngredientBlocked);
  const cookConversation = useAppStore((state) => state.cookConversation);
  const appendCookMessage = useAppStore((state) => state.appendCookMessage);
  const baseStep = shrimpNoodleRecipe.steps[stepNumber - 1];
  const completedSteps = useAppStore((state) => state.completedSteps);
  const completeStep = useAppStore((state) => state.completeStep);
  const timerEndAt = useAppStore((state) => state.timerEndAt);
  const setTimerEndAt = useAppStore((state) => state.setTimerEndAt);
  const recipeAdjustments = useAppStore((state) => state.recipeAdjustments);
  const setRecipeAdjustments = useAppStore((state) => state.setRecipeAdjustments);
  const riskInterrupted = useAppStore((state) => state.riskInterrupted);
  const setRiskInterrupted = useAppStore((state) => state.setRiskInterrupted);
  const setFeedback = useAppStore((state) => state.setFeedback);
  const step = stepNumber === 4 ? {
    ...baseStep,
    instruction: recipeAdjustments.broccoli === "omit"
      ? "放入宝宝面和胡萝卜，继续煮到面条能被勺背轻松压断。"
      : recipeAdjustments.broccoli === "carrot"
        ? "放入宝宝面和全部胡萝卜碎，煮到面条和胡萝卜都足够软。"
        : baseStep.instruction,
    detail: `${baseStep.detail}${recipeAdjustments.extraCookMinutes ? ` 已根据现场反馈追加 ${recipeAdjustments.extraCookMinutes} 分钟。` : ""}`,
    duration: (baseStep.duration ?? 0) + recipeAdjustments.extraCookMinutes * 60,
  } : baseStep;
  const [input, setInput] = useState("");
  const [thinking, setThinking] = useState(false);
  const [recording, setRecording] = useState(false);
  const timelineRef = useRef<HTMLDivElement>(null);
  const gateway = useMemo(() => createAiGateway(), []);
  const voice = useCookingVoice(cookPrepared
    ? `${step.title}。${step.instruction}。完成状态：${step.check}`
    : "开始前，我们先确认食材是否齐全。你可以直接说出缺少的食材。", riskInterrupted);
  useEffect(() => {
    timelineRef.current?.scrollTo({ top: timelineRef.current.scrollHeight, behavior: "smooth" });
  }, [cookPrepared, cookConversation.length, stepNumber, thinking, riskInterrupted]);
  const addMessage = (role: "user" | "assistant", text: string) => appendCookMessage({ id: `${Date.now()}-${Math.random()}`, role, text, phase: cookPrepared ? "cook" : "prep", step: stepNumber });
  const answerWith = (text: string) => {
    addMessage("assistant", text);
    if (voice.voiceMode) void voice.speak(text);
  };
  const sendMessage = async (message = input) => {
    const value = message.trim();
    if (!value) return;
    if (!cookPrepared && /都.*(齐|准备)|准备好了/.test(value) && !cookIngredientBlocked) {
      setInput("");
      setCookPrepared(true);
      return;
    }
    if (cookPrepared && !riskInterrupted && /(已经.*状态|做好了|完成了)/.test(value)) {
      setInput("");
      completeStep(stepNumber);
      if (stepNumber === 5) navigate("/cook/shrimp-noodle-demo/complete");
      return;
    }
    addMessage("user", value);
    setInput(""); setThinking(true);
    if (/没有.*西蓝花|没有西蓝花/.test(value)) {
      setRecipeAdjustments({ broccoli: "omit" });
      window.setTimeout(() => { answerWith("西蓝花是可选蔬菜，这次可以不放。我已经把它从食材和后续煮面步骤里移除了。其他食材都齐了吗？"); setThinking(false); }, 320);
      return;
    }
    if (/换.*胡萝卜/.test(value)) {
      setRecipeAdjustments({ broccoli: "carrot" });
      window.setTimeout(() => { answerWith(`可以，已经换成${profileName}吃过的胡萝卜，蔬菜总量和后续步骤也一起调整好了。其他食材都齐了吗？`); setThinking(false); }, 320);
      return;
    }
    if (/没有.*虾|缺.*虾/.test(value)) {
      setCookIngredientBlocked(true);
      window.setTimeout(() => { answerWith("鲜虾是这道面的主要食材，直接换成鱼滑会改变过敏原和适配结论。今天先不要继续这份菜谱，换一道已有尝试记录的食材会更稳妥。"); setThinking(false); }, 320);
      return;
    }
    if (/硬|没熟|夹生/.test(value)) {
      setRecipeAdjustments({ extraCookMinutes: Math.min(3, recipeAdjustments.extraCookMinutes + 1) });
      if (timerEndAt) setTimerEndAt(timerEndAt + 60_000);
    }
    if (/红|肿|吐|喘|异常/.test(value)) setRiskInterrupted(true);
    const answer = await gateway.answerCookingQuestion(value, shrimpNoodleRecipe, stepNumber);
    answerWith(answer);
    setThinking(false);
  };
  const simulateVoice = () => {
    setRecording(true);
    window.setTimeout(() => { setRecording(false); setInput("家里没有西蓝花，可以换成胡萝卜吗？"); }, 1100);
  };
  const confirmPrepared = () => {
    setCookPrepared(true);
  };
  const finishCurrentAction = () => {
    completeStep(stepNumber);
    if (stepNumber === 5) navigate("/cook/shrimp-noodle-demo/complete");
  };
  const progress = cookPrepared ? Math.min(100, ((completedSteps.length + 0.35) / shrimpNoodleRecipe.steps.length) * 100) : 5;
  return <Screen className="cook-session-screen">
    <header className="session-header">
      <IconButton className="back-button" label="退出陪做" onClick={() => {
        const canGoBack = typeof window !== "undefined" && (window.history.state?.idx ?? 0) > 0;
        return canGoBack ? navigate(-1) : navigate("/result/adapted", { replace: true, state: { transition: "back" } });
      }}><ArrowLeft size={20} /></IconButton>
      <div className="session-progress"><span style={{ width: `${progress}%` }} /></div>
      <button className={cx("voice-mode", voice.voiceMode && "active")} onClick={() => void voice.toggleVoice()}><Volume2 size={16} />{voice.label}</button>
    </header>
    <div className="session-context"><span>宝宝虾滑面</span></div>
    <VoiceStatus engine={voice.voiceEngine} error={voice.voiceError} />
    <div className="conversation-timeline" ref={timelineRef} aria-live="polite">
      <AssistantMessage><p>我们一起把{profileName}的宝宝虾滑面做好。开始前先确认一下食材，缺什么直接告诉我，我会同步调整后面的做法。</p></AssistantMessage>
      <AssistantMessage>
        <div className="ingredient-message"><strong>这些食材都准备好了吗？</strong><ul><li>鲜虾仁 35 g</li><li>宝宝面 20 g</li><li>胡萝卜 10 g</li><li>{recipeAdjustments.broccoli === "omit" ? <del>西蓝花 8 g（这次不放）</del> : recipeAdjustments.broccoli === "carrot" ? "胡萝卜另加 8 g（已替换西蓝花）" : "西蓝花 8 g（可选）"}</li><li>蛋清 5 g（可选）</li></ul></div>
      </AssistantMessage>
      {cookConversation.filter((message) => message.phase === "prep").map((message) => message.role === "user" ? <UserMessage key={message.id}>{message.text}</UserMessage> : <AssistantMessage key={message.id}><p>{message.text}</p></AssistantMessage>)}
      {cookPrepared && <UserMessage>其他食材都准备好了</UserMessage>}
      {cookPrepared && <AssistantMessage><p>好，食材确认完成。接下来我每次只告诉你当前要做的事；有变化随时问我。</p></AssistantMessage>}
      {cookPrepared && completedSteps.map((number) => <div className="conversation-pair completed" key={number}><StepMessage step={shrimpNoodleRecipe.steps[number - 1]} number={number} completed />{cookConversation.filter((message) => message.phase === "cook" && message.step === number).map((message) => message.role === "user" ? <UserMessage key={message.id}>{message.text}</UserMessage> : <AssistantMessage key={message.id}><p>{message.text}</p></AssistantMessage>)}<UserMessage>已经达到这个状态</UserMessage></div>)}
      {cookPrepared && !riskInterrupted && <StepMessage step={step} number={stepNumber}>{step.duration && <CookingTimer duration={step.duration} endAt={timerEndAt} setEndAt={setTimerEndAt} />}</StepMessage>}
      {cookPrepared && cookConversation.filter((message) => message.phase === "cook" && message.step === stepNumber && !completedSteps.includes(stepNumber)).map((message) => message.role === "user" ? <UserMessage key={message.id}>{message.text}</UserMessage> : <AssistantMessage key={message.id}><p>{message.text}</p></AssistantMessage>)}
      {thinking && <AssistantMessage><div className="conversation-thinking"><i /><i /><i /></div></AssistantMessage>}
      {riskInterrupted && <AssistantMessage tone="risk"><div className="risk-copy"><ShieldAlert size={20} /><div><strong>普通陪做已经暂停</strong><p>先停止喂食并观察{profileName}的情况。若症状明显、快速加重或影响呼吸，请立即寻求专业帮助。</p></div></div></AssistantMessage>}
    </div>
    <div className="session-dock">
      <div className="session-suggestions">
        {!cookPrepared && cookIngredientBlocked ? <button className="risk-suggestion" onClick={() => navigate("/home")}>返回首页，换一道菜</button> : !cookPrepared ? <>
          <button onClick={confirmPrepared}>都准备好了</button>
          <button onClick={() => sendMessage("家里没有西蓝花")}>没有西蓝花</button>
          {recipeAdjustments.broccoli !== "keep" && <button onClick={() => sendMessage("换成胡萝卜")}>换成胡萝卜</button>}
          <button onClick={() => sendMessage("没有鲜虾")}>没有鲜虾</button>
        </> : !riskInterrupted ? <>
          <button className="primary-suggestion" onClick={finishCurrentAction}>{stepNumber === 5 ? "已经完成，可以盛出了" : "已经达到这个状态"}</button>
          {stepNumber === 4 && <button onClick={() => sendMessage("面条还是有点硬")}>面条还硬</button>}
          <button onClick={() => sendMessage("宝宝出现红肿异常")}>出现异常</button>
        </> : <button className="risk-suggestion" onClick={() => { setFeedback({ swallowing: "unusual" }); navigate("/feedback/shrimp-noodle-demo/now/3"); }}>停止陪做，记录异常</button>}
      </div>
      <div className={cx("session-composer", recording && "recording")}>
        <IconButton label="语音输入" onClick={simulateVoice}><Mic size={19} /></IconButton>
        <input value={recording ? "正在听…" : input} disabled={recording || riskInterrupted} placeholder={voice.voiceMode ? "直接说，或在这里输入…" : "说说现在遇到的情况…"} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => e.key === "Enter" && sendMessage()} />
        <IconButton label="发送" disabled={!input.trim() || riskInterrupted} onClick={() => sendMessage()}><Send size={19} /></IconButton>
      </div>
      <p className="session-boundary">实际熟制状态请以现场检查为准</p>
    </div>
  </Screen>;
}

function AssistantMessage({ children, tone, intent = "welcome" }: { children: ReactNode; tone?: "risk"; intent?: CharacterIntent }) {
  return <div className={cx("conversation-row assistant-row", tone === "risk" && "risk")}><span className="assistant-marker">{tone === "risk" ? <ShieldAlert size={17} /> : <CharacterIllustration intent={intent} size="avatar" animate={false} />}</span><div className="conversation-bubble assistant-bubble">{children}</div></div>;
}

function UserMessage({ children }: { children: ReactNode }) {
  return <div className="conversation-row user-row"><div className="conversation-bubble user-bubble">{children}</div></div>;
}

function StepMessage({ step, number, completed, children }: { step: CookingStep; number: number; completed?: boolean; children?: ReactNode }) {
  return <AssistantMessage intent={completed ? "confirm" : resolveCookingIntent(step.actionKind)}><article className={cx("conversation-step", completed && "completed")}><div className="conversation-step-head"><span>当前行动 {number}</span>{completed && <CheckCircle2 size={16} />}</div><h2>{step.title}</h2><p>{step.instruction}</p>{!completed && <><div className="inline-check"><strong>做到什么算完成？</strong><span>{step.check}</span></div>{number === 1 && <div className="size-reference"><span>切碎参考</span><div><i /><i /><i /></div><small>尽量细碎、大小均匀，更容易充分煮软</small></div>}{step.tip && <div className="inline-tip"><Sparkles size={15} /><span>{step.tip}</span></div>}{children}</>}</article></AssistantMessage>;
}

function CookingTimer({ duration, endAt, setEndAt }: { duration: number; endAt: number | null; setEndAt: (value: number | null) => void }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!endAt) return;
    const id = window.setInterval(() => setNow(Date.now()), 250);
    return () => window.clearInterval(id);
  }, [endAt]);
  const remaining = endAt ? Math.max(0, Math.ceil((endAt - now) / 1000)) : duration;
  const running = Boolean(endAt && remaining > 0);
  const minutes = Math.floor(remaining / 60).toString().padStart(2, "0");
  const seconds = (remaining % 60).toString().padStart(2, "0");
  return <div className={cx("timer-card", running && "running", Boolean(remaining === 0 && endAt) && "finished")}><div className="timer-top"><span><Timer size={18} /><strong>{remaining === 0 && endAt ? "计时结束，请检查实际状态" : "这一步需要计时"}</strong></span>{endAt && <button onClick={() => setEndAt(null)}>重置</button>}</div><div className="timer-display">{minutes}<i>:</i>{seconds}</div><div className="timer-actions">{!running ? <Button onClick={() => setEndAt(Date.now() + (remaining || duration) * 1000)} icon={<Play size={17} />}>{endAt && remaining === 0 ? "重新计时" : "开始计时"}</Button> : <Button variant="dark" onClick={() => { setEndAt(null); }} icon={<Pause size={17} />}>暂停并重置</Button>}<button onClick={() => setEndAt(Date.now() + (remaining + 60) * 1000)}>+ 1 分钟</button></div><p><Bell size={14} />切到后台后，返回页面会按目标结束时间继续计算。</p></div>;
}

function CompletePage() {
  const navigate = useNavigate();
  return <Screen className="complete-screen"><TopBar title="制作完成" back="/cook/shrimp-noodle-demo/session" /><div className="complete-visual"><div className="complete-ring"><CharacterIllustration intent="serve" size="hero" /><motion.span initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ delay: .25, type: "spring" }}><Check /></motion.span></div></div><h1>宝宝虾滑面做好了</h1><p>开始喂之前，再花 10 秒检查一次。</p><section className="final-checks"><div><span>01</span><p><strong>质地</strong><small>面条和虾滑都能用勺背压开</small></p></div><div><span>02</span><p><strong>大小</strong><small>面条已剪短，虾滑已分成小块</small></p></div><div><span>03</span><p><strong>温度与坐姿</strong><small>温度适宜，宝宝保持坐直</small></p></div></section><div className="screen-actions"><Button full onClick={() => navigate("/feedback/shrimp-noodle-demo/now")}>记录宝宝吃得怎么样</Button><Button full variant="ghost" onClick={() => navigate("/home")}>稍后再记录</Button></div></Screen>;
}

const feedbackGroups = [
  { key: "amount", title: "吃了多少", hint: "大概选择即可，不用称重", options: [["most", "大部分", "多"], ["half", "一半左右", "半"], ["few", "只尝几口", "少"], ["none", "几乎没吃", "0"]] },
  { key: "acceptance", title: "接受程度", hint: "只记录这一次的表现", options: [["liked", "愿意继续吃", "喜"], ["neutral", "反应一般", "还"], ["refused", "明显拒绝", "拒"]] },
  { key: "swallowing", title: "吞咽和即时情况", hint: "按刚才看到的情况选择", options: [["smooth", "过程顺利", "顺"], ["difficulty", "质地有点难", "难"], ["unusual", "疑似异常", "!"]] },
] as const;

function FeedbackPage() {
  const navigate = useNavigate();
  const { id = "shrimp-noodle-demo" } = useParams();
  const isTomatoRecipe = id === tomatoRiceAnalysis.id;
  const inspirationIdea = inspirationIdeaById(id);
  const profileName = useAppStore((state) => state.profile.name);
  const recipeTitle = recipeTitleById(id);
  const babyName = isTomatoRecipe ? tomatoRiceAnalysis.baby.name : profileName;
  const feedback = useAppStore((state) => state.feedback);
  const setFeedback = useAppStore((state) => state.setFeedback);
  const completeRecipe = useAppStore((state) => state.completeRecipe);
  const [note, setNote] = useState(feedback.note ?? "");
  const completedCount = [feedback.amount, feedback.acceptance, feedback.swallowing].filter(Boolean).length;
  const complete = completedCount === 3;
  const choose = (key: "amount" | "acceptance" | "swallowing", value: string) => setFeedback({ [key]: value } as Partial<Feedback>);
  const addNote = (value: string) => setNote((current) => current.includes(value) ? current : [current.trim(), value].filter(Boolean).join("；"));
  const submit = () => {
    setFeedback({ note });
    completeRecipe({ id, title: recipeTitle });
    navigate("/home", { replace: true });
  };
  const noteSuggestions = isTomatoRecipe
    ? ["米饭可以再软些", "肉末可以再细些", "宝宝愿意再吃"]
    : inspirationIdea
      ? ["质地可以再软些", "宝宝愿意继续吃", "下次份量少一点"]
      : ["面条可以再软些", "虾滑可以再小些", "宝宝愿意再吃"];
  const feedbackBack = isTomatoRecipe ? "/home" : inspirationIdea ? `/cook/${id}/session` : "/cook/shrimp-noodle-demo/complete";
  return <Screen className="post-meal-feedback-screen"><TopBar title="用餐反馈" back={feedbackBack} />
    <section className="feedback-meal-hero"><div className="feedback-bowl"><CharacterIllustration intent={feedback.swallowing === "unusual" ? "paused" : "plan"} size="support" /></div><div><span>{recipeTitle}</span><h1>{babyName}吃得怎么样？</h1><p>约 1 分钟完成，帮助下次更贴近宝宝。</p></div></section>
    <div className="feedback-completion"><span><i style={{ width: `${(completedCount / 3) * 100}%` }} /></span><strong>{completedCount} / 3 已选</strong></div>
    <div className="feedback-form-sections">
      {feedbackGroups.map((group) => {
        const selected = feedback[group.key];
        return <section key={group.key} className="feedback-form-card"><header><div><h2>{group.title}</h2><p>{group.hint}</p></div><span>必填</span></header><div className={cx("feedback-choice-grid", group.key === "amount" && "four-columns")}>{group.options.map(([value, label, symbol]) => <button key={value} className={cx(selected === value && "selected", value === "unusual" && "risk")} onClick={() => choose(group.key, value)} aria-pressed={selected === value}><span>{symbol}</span><strong>{label}</strong>{selected === value && <Check size={12} />}</button>)}</div></section>;
      })}
      {feedback.swallowing === "difficulty" && <div className="texture-followup"><Info size={16} /><span>已记下质地偏难。下次适配时会优先调整得更软、更小。</span></div>}
      {feedback.swallowing === "unusual" && <div className="risk-interruption feedback-risk"><ShieldAlert size={21} /><div><strong>先停止喂食并观察宝宝</strong><p>若出现呼吸困难、明显肿胀、精神状态异常或症状快速加重，请立即寻求紧急医疗帮助。</p></div></div>}
      <section className="feedback-form-card note-card"><header><div><h2>还想记下什么？</h2><p>可选，一句话就够了</p></div><span>可选</span></header><div className="note-suggestions">{noteSuggestions.map((value) => <button key={value} onClick={() => addNote(value)}>{value}</button>)}</div><textarea id="feedback-note" value={note} placeholder="例如：前几口很顺利，后面开始转头" onChange={(event) => setNote(event.target.value)} /></section>
    </div>
    <div className="feedback-form-spacer" /><div className="feedback-submit-bar"><div><span>{complete ? "已完成必填项" : `还差 ${3 - completedCount} 项`}</span><small>保存后返回首页；稍后观察会留在首页待办</small></div><Button disabled={!complete} onClick={submit}>保存并返回首页</Button></div>
  </Screen>;
}

function LaterFeedbackPage() {
  const navigate = useNavigate();
  const { id = "shrimp-noodle-demo" } = useParams();
  const recipeTitle = recipeTitleById(id);
  const saveObservation = useAppStore((state) => state.saveObservation);
  const [observed, setObserved] = useState("");
  const [saved, setSaved] = useState(false);
  const submit = () => { saveObservation(id, observed as "normal" | "unsure" | "unusual"); setSaved(true); window.setTimeout(() => navigate("/home", { replace: true }), 500); };
  return <Screen className="feedback-screen later-screen"><TopBar title="稍后观察" back="/home" /><section className="observation-hero"><span><Clock3 size={24} /></span><h1>{recipeTitle}还差一次观察记录</h1><p>即时反馈已经保存。稍后回来看一眼，帮助区分“接受程度”和“身体情况”。</p></section><section className="observation-card"><h2>之后有观察到什么吗？</h2><div className="feedback-options compact"><button className={cx(observed === "normal" && "selected")} onClick={() => setObserved("normal")}><span><strong>没有观察到异常</strong><small>状态和平时一样</small></span><span className="radio-dot">{observed === "normal" && <i />}</span></button><button className={cx(observed === "unsure" && "selected")} onClick={() => setObserved("unsure")}><span><strong>不太确定</strong><small>继续保留为待观察</small></span><span className="radio-dot">{observed === "unsure" && <i />}</span></button><button className={cx(observed === "unusual" && "selected", "risk")} onClick={() => setObserved("unusual")}><span><strong>出现疑似异常</strong><small>记录细节并查看下一步</small></span><span className="radio-dot">{observed === "unusual" && <i />}</span></button></div>{observed === "unusual" && <div className="risk-interruption"><ShieldAlert size={21} /><div><strong>这条记录不会自动把食材标记为安全</strong><p>请记录发生时间和表现；如症状明显或持续，请及时寻求专业帮助。</p></div></div>}</section><div className="screen-actions"><Button full disabled={!observed} onClick={submit}>保存观察结果</Button><Button full variant="ghost" onClick={() => navigate("/home")}>稍后再记录</Button></div><AnimatePresence>{saved && <Toast>观察结果已保存</Toast>}</AnimatePresence></Screen>;
}

function HistoryPage() {
  const history = useAppStore((state) => state.history);
  const navigate = useNavigate();
  const [filter, setFilter] = useState("all");
  const visible = history.filter((item) => filter === "all" || item.progress === filter);
  return (
    <Screen className="list-screen has-bottom-nav collapsible-title-screen">
      <TopBar title="制作记录" />
      <section className="list-intro"><span className="eyebrow">本机记录</span><h1>每次调整，都能成为下次的依据</h1><p>记录只保存在当前浏览器中。</p></section>
      <div className="filter-tabs"><button className={cx(filter === "all" && "active")} onClick={() => setFilter("all")}>全部</button><button className={cx(filter === "completed" && "active")} onClick={() => setFilter("completed")}>已完成</button><button className={cx(filter === "saved" && "active")} onClick={() => setFilter("saved")}>已保存</button></div>
      <AnimatePresence mode="wait" initial={false}>
        <motion.section key={filter} className="history-list" initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -5 }} transition={{ duration: .16 }}>
          {visible.length ? visible.map((item) => <button key={item.id} className="history-card" onClick={() => navigate(`/history/${item.id}`)}><span className="date-dot" /><div><small>{item.date}</small><strong>{item.recipeTitle}</strong><span className={cx("status-chip", item.conclusion === "direct" ? "green" : "soft")}>{suitabilityCopy[item.conclusion].label}</span><p>{item.progress === "completed" ? "已记录进食反馈" : "已保存，尚未制作"}</p></div><ChevronRight size={19} /></button>) : <EmptyState title="这里还没有记录" description="分析并保存一条视频后，会出现在这里。" action="去分析视频" onAction={() => navigate("/home")} />}
        </motion.section>
      </AnimatePresence>
    </Screen>
  );
}

function HistoryDetailPage() {
  const navigate = useNavigate();
  const { id } = useParams();
  const history = useAppStore((state) => state.history);
  const profile = useAppStore((state) => state.profile);
  const item = history.find((entry) => entry.id === id) || history[0];
  return <Screen className="detail-screen"><TopBar title="记录详情" back="/history" /><section className="detail-hero"><span className="status-chip soft">{item?.date || "今天"}</span><h1>{item?.recipeTitle || "宝宝虾滑面"}</h1><p>{item?.progress === "completed" ? "这次制作和反馈已经保存" : "已保存，尚未开始制作"}</p></section><section className="detail-card"><h2>适配结论</h2><div className="detail-result"><ShieldCheck size={21} /><span><strong>{item ? suitabilityCopy[item.conclusion].label : "调整后可以做"}</strong><small>按{profile.name} {profile.months} 个月、{stageLabels[profile.stage]}生成</small></span></div></section><section className="detail-card"><h2>实际反馈</h2>{item?.feedback ? <div className="feedback-summary"><span><small>吃了多少</small><strong>{feedbackLabel(item.feedback.amount)}</strong></span><span><small>接受程度</small><strong>{feedbackLabel(item.feedback.acceptance)}</strong></span><span><small>吞咽情况</small><strong>{feedbackLabel(item.feedback.swallowing)}</strong></span></div> : <p className="empty-copy">还没有记录这次反馈。</p>}</section><section className="detail-card"><h2>食材状态变化</h2><div className="food-change"><span className="food-icon">虾</span><div><strong>鲜虾仁</strong><small>尚未尝试 → 已尝试待观察</small></div></div><p className="boundary-copy"><Info size={15} />一次反馈不会直接将食材标记为“安全”。</p></section><div className="screen-actions static"><Button full onClick={() => navigate("/result/adapted")}>再次查看宝宝版本</Button></div></Screen>;
}

function feedbackLabel(value?: string) {
  const labels: Record<string, string> = { most: "大部分", half: "一半左右", few: "几口", none: "几乎没吃", liked: "愿意继续吃", neutral: "反应一般", refused: "明显拒绝", smooth: "过程顺利", difficulty: "有些困难", unusual: "疑似异常" };
  return value ? labels[value] || value : "未记录";
}

function BabyPage() {
  const navigate = useNavigate();
  const profile = useAppStore((state) => state.profile);
  const resetProfile = useAppStore((state) => state.resetProfile);
  const [confirmReset, setConfirmReset] = useState(false);
  return <Screen className="baby-screen has-bottom-nav"><TopBar title="宝宝档案" action={<IconButton label="设置" onClick={() => navigate("/settings")}><Settings size={20} /></IconButton>} /><section className="baby-hero"><div className="large-avatar"><CharacterIllustration intent="neutral" size="support" animate={false} /></div><div><h1>{profile.name}</h1><p>{profile.months} 个月 · {stageLabels[profile.stage]}</p></div><IconButton label="编辑档案" onClick={() => navigate("/baby/edit")}><Edit3 size={18} /></IconButton></section><section className="profile-summary"><div><span><Baby size={19} /></span><p><small>月龄</small><strong>{profile.months} 个月</strong></p></div><div><span><UtensilsCrossed size={19} /></span><p><small>进食阶段</small><strong>{stageLabels[profile.stage]}</strong></p></div><div><span><ShieldCheck size={19} /></span><p><small>明确回避</small><strong>{profile.avoidFoods.length ? profile.avoidFoods.join("、") : "暂无"}</strong></p></div></section><section className="baby-section"><div className="section-heading"><div><span className="eyebrow">食材尝试</span><h2>让适配更有依据</h2></div><button onClick={() => navigate("/baby/foods")}>全部食材</button></div><div className="food-status-grid"><div><span className="food-icon food-icon-illustrated"><FoodIllustration foodId="egg" alt="" /></span><strong>鸡蛋</strong><small className="green-text">已尝试</small></div><div><span className="food-icon">虾</span><strong>鲜虾</strong><small className="orange-text">待观察</small></div><div><span className="food-icon food-icon-illustrated"><FoodIllustration foodId="carrot" alt="" /></span><strong>胡萝卜</strong><small className="green-text">已尝试</small></div><div><span className="food-icon food-icon-illustrated"><FoodIllustration foodId="broccoli" alt="" /></span><strong>西蓝花</strong><small className="green-text">已尝试</small></div></div></section><section className="baby-section"><button className="profile-link" onClick={() => navigate("/history")}><span><History size={18} /><span><strong>制作与反馈记录</strong><small>3 条本机记录</small></span></span><ChevronRight size={18} /></button><button className="profile-link" onClick={() => navigate("/settings")}><span><LockKeyhole size={18} /><span><strong>数据与隐私</strong><small>只保存在当前浏览器</small></span></span><ChevronRight size={18} /></button><button className="profile-link profile-reset-link" onClick={() => setConfirmReset(true)}><span><Trash2 size={18} /><span><strong>重新填写宝宝档案</strong><small>从称呼和月龄开始，保留制作与反馈记录</small></span></span><ChevronRight size={18} /></button></section><AnimatePresence>{confirmReset && <Sheet title="重新填写宝宝档案？" onClose={() => setConfirmReset(false)}><div className="sheet-content"><p>将清空当前宝宝的称呼、月龄、忌口、进食能力和食材尝试信息，然后回到建档第一步。制作记录与反馈不会删除。</p><Button full variant="danger" onClick={() => { resetProfile(); setConfirmReset(false); navigate("/onboarding/age", { replace: true }); }}>重置档案并重新开始</Button><Button full variant="ghost" onClick={() => setConfirmReset(false)}>取消</Button></div></Sheet>}</AnimatePresence></Screen>;
}

function FoodsPage() {
  const foods = [{ name: "鸡蛋", icon: "蛋", status: "已尝试", detail: "最近：7 月 18 日 · 未记录异常", tone: "green" }, { name: "鲜虾", icon: "虾", status: "已尝试待观察", detail: "最近：今天 · 宝宝虾滑面", tone: "orange" }, { name: "胡萝卜", icon: "胡", status: "已尝试", detail: "最近：昨天 · 南瓜鸡肉软饭", tone: "green" }, { name: "西蓝花", icon: "西", status: "已尝试", detail: "最近：今天 · 宝宝虾滑面", tone: "green" }, { name: "花生", icon: "花", status: "尚未记录", detail: "没有尝试记录", tone: "gray" }];
  const [query, setQuery] = useState("");
  return <Screen className="list-screen"><TopBar title="食材尝试记录" back="/baby" /><div className="search-field"><input value={query} placeholder="搜索食材" onChange={(e) => setQuery(e.target.value)} /><span>搜索</span></div><section className="food-records">{foods.filter((food) => food.name.includes(query)).map((food) => <article key={food.name}><span className="food-icon">{food.icon}</span><div><strong>{food.name}</strong><small>{food.detail}</small></div><span className={`food-state ${food.tone}`}>{food.status}</span></article>)}</section><div className="info-note page-note"><Info size={16} /><span>“已尝试”只表示有过记录，不代表产品为食材作出安全保证。</span></div></Screen>;
}

function EditBabyPage() {
  const navigate = useNavigate();
  const profile = useAppStore((state) => state.profile);
  const setProfile = useAppStore((state) => state.setProfile);
  const [name, setName] = useState(profile.name);
  const [months, setMonths] = useState(String(profile.months));
  return <Screen className="form-screen"><TopBar title="编辑宝宝档案" back="/baby" /><section className="form-card"><label><span>宝宝称呼</span><input value={name} maxLength={8} onChange={(e) => setName(e.target.value)} /></label><label><span>月龄</span><div className="input-with-suffix"><input value={months} inputMode="numeric" onChange={(e) => setMonths(e.target.value.replace(/\D/g, "").slice(0,2))} /><span>个月</span></div></label><div><span className="field-label">进食阶段</span><div className="stage-list compact">{stageOptions.map((option) => <button key={option.value} className={cx("stage-choice", profile.stage === option.value && "selected")} onClick={() => setProfile({ stage: option.value })}><span><strong>{option.title}</strong><small>{option.desc}</small></span><span className="radio-dot">{profile.stage === option.value && <i />}</span></button>)}</div></div></section><div className="screen-actions"><Button full disabled={!name.trim() || Number(months) < 4} onClick={() => { setProfile({ name: name.trim(), months: Number(months) }); navigate("/baby"); }}>保存档案</Button></div></Screen>;
}

function SettingsPage() {
  const navigate = useNavigate();
  const reset = useAppStore((state) => state.resetDemo);
  const [confirm, setConfirm] = useState(false);
  const profileName = useAppStore((state) => state.profile.name);
  return <Screen className="settings-screen"><TopBar title="设置" back="/baby" /><section className="settings-group"><span className="group-label">数据</span><div className="settings-row"><span><LockKeyhole size={19} /><span><strong>存储位置</strong><small>只保存在当前浏览器</small></span></span><span className="value">本机</span></div></section><section className="settings-group"><span className="group-label">关于</span><div className="settings-row"><span><Info size={19} /><span><strong>产品边界</strong><small>不构成真实喂养或医疗建议</small></span></span></div></section><section className="settings-group"><span className="group-label">重置</span><button className="settings-row danger-row" onClick={() => setConfirm(true)}><span><Trash2 size={19} /><span><strong>清除本机数据</strong><small>重新进入三步建档</small></span></span><ChevronRight size={18} /></button></section><AnimatePresence>{confirm && <Sheet title="清除所有本机数据？" onClose={() => setConfirm(false)}><div className="sheet-content"><p>{profileName}的档案、历史菜谱、陪做进度和反馈都会被清除。这个操作无法撤销。</p><Button full variant="danger" onClick={() => { reset(); setConfirm(false); navigate("/onboarding/age"); }}>清除并重新开始</Button><Button full variant="ghost" onClick={() => setConfirm(false)}>取消</Button></div></Sheet>}</AnimatePresence></Screen>;
}

function EmptyState({ title, description, action, onAction }: { title: string; description: string; action: string; onAction: () => void }) {
  return <div className="empty-state"><span><BookOpen size={26} /></span><h2>{title}</h2><p>{description}</p><Button variant="secondary" onClick={onAction}>{action}</Button></div>;
}

function NotFound() {
  const navigate = useNavigate();
  return <Screen className="centered-state"><div className="state-icon muted"><FileQuestion size={28} /></div><h1>这个页面找不到了</h1><p>地址可能已经变化，已保存的数据不会受影响。</p><Button onClick={() => navigate("/home")}>回到首页</Button></Screen>;
}

type RouteMotion = { direction: number; mode: "stack" | "tab" | "none" };

const routeVariants = {
  enter: ({ direction, mode }: RouteMotion) => ({
    x: mode === "none" || mode === "tab" ? 0 : direction < 0 ? "-24%" : "100%",
    opacity: mode === "none" ? 1 : mode === "tab" ? .98 : 1,
  }),
  center: { x: 0, opacity: 1 },
  exit: ({ direction, mode }: RouteMotion) => ({
    x: mode === "none" || mode === "tab" ? 0 : direction < 0 ? "100%" : "-24%",
    opacity: mode === "none" ? 1 : mode === "tab" ? .98 : .96,
  }),
};

function AppRoutes() {
  const location = useLocation();
  const navigationType = useNavigationType();
  const reduceMotion = useReducedMotion();
  const transitionState = location.state as { transition?: "tab" | "back"; direction?: number } | null;
  const direction = transitionState?.transition === "back"
    ? -1
    : navigationType === "POP"
      ? -1
      : transitionState?.transition === "tab"
        ? Math.sign(transitionState.direction ?? 0)
        : navigationType === "REPLACE"
          ? 0
          : 1;
  const routeMotion: RouteMotion = reduceMotion || direction === 0
    ? { direction: 0, mode: "none" }
    : { direction, mode: transitionState?.transition === "tab" ? "tab" : "stack" };
  const showBottomNav = ["/home", "/history", "/baby"].includes(location.pathname);

  return (
    <AppFrame>
      <div className="route-stage">
        <AnimatePresence initial={false} mode="sync" custom={routeMotion}>
          <motion.div
            key={location.key}
            className="route-page"
            custom={routeMotion}
            variants={routeVariants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ duration: reduceMotion ? 0 : routeMotion.mode === "tab" ? .12 : .28, ease: [.22, 1, .36, 1] }}
          >
            <Routes location={location}>
              <Route path="/" element={<StartRoute />} />
              <Route path="/onboarding/age" element={<OnboardingAge />} />
              <Route path="/onboarding/avoid" element={<OnboardingAvoid />} />
              <Route path="/onboarding/stage" element={<OnboardingStage />} />
              <Route path="/home" element={<HomePage />} />
              <Route path="/agent" element={<BabyAgentPage />} />
              <Route path="/plan" element={<PlanSetupPage />} />
              <Route path="/plan/week" element={<WeeklyPlanPage />} />
              <Route path="/plan/meal/:mealId/videos" element={<PlanVideoSearchPage />} />
              <Route path="/food-map" element={<FoodMapPage />} />
              <Route path="/food-map/:food" element={<FoodDetailPage />} />
              <Route path="/analysis/:id" element={<AnalysisPage />} />
              <Route path="/analysis-error" element={<AnalysisFailure />} />
              <Route path="/result/:conclusion" element={<RecipeResultPage />} />
              <Route path="/result/analysis/:jobId" element={<AnalysisResultPage />} />
              <Route path="/cook/:id/session" element={<CookSessionPage />} />
              <Route path="/cook/:id/prep" element={<Navigate to="/cook/shrimp-noodle-demo/session" replace />} />
              <Route path="/cook/:id/step/:step" element={<Navigate to="/cook/shrimp-noodle-demo/session" replace />} />
              <Route path="/cook/:id/complete" element={<CompletePage />} />
              <Route path="/feedback/:id/now" element={<FeedbackPage />} />
              <Route path="/feedback/:id/now/:part" element={<FeedbackPage />} />
              <Route path="/feedback/:id/later" element={<LaterFeedbackPage />} />
              <Route path="/history" element={<HistoryPage />} />
              <Route path="/history/:id" element={<HistoryDetailPage />} />
              <Route path="/baby" element={<BabyPage />} />
              <Route path="/baby/foods" element={<FoodsPage />} />
              <Route path="/baby/edit" element={<EditBabyPage />} />
              <Route path="/settings" element={<SettingsPage />} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </motion.div>
        </AnimatePresence>
        {showBottomNav && <BottomNav />}
      </div>
    </AppFrame>
  );
}

export default function BabyBaoApp() {
  const [scenario, setScenario] = useState<Suitability>("adapted");
  const mounted = useSyncExternalStore(() => () => undefined, () => true, () => false);
  useEffect(() => {
    let active = true;
    loadLocalState()
      .then((state) => { if (active) useAppStore.getState().hydrate(state); })
      .catch(() => { if (active) useAppStore.getState().setHydrated(true); });
    const unsubscribe = useAppStore.subscribe((state) => {
      if (state.hydrated) void saveLocalState(selectPersistedState(state));
    });
    return () => { active = false; unsubscribe(); };
  }, []);
  if (!mounted) return <LoadingScreen />;
  return (
    <ScenarioContext.Provider value={{ scenario, setScenario }}>
      <BrowserRouter>
        <AppRoutes />
      </BrowserRouter>
    </ScenarioContext.Provider>
  );
}
