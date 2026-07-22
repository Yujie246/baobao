"use client";

import {
  AlertCircle,
  ArrowLeft,
  Baby,
  Bell,
  BookmarkCheck,
  BookOpen,
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronRight,
  Clock3,
  Edit3,
  Download,
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
  Send,
  ShoppingBasket,
  Settings,
  Share2,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Timer,
  Trash2,
  UtensilsCrossed,
  Volume2,
  WifiOff,
  X,
} from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import {
  createContext,
  FormEvent,
  ReactNode,
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
import { CharacterIllustration, resolveCookingIntent, resolveResultIntent, type CharacterIntent } from "./character-illustrations";
import { FoodIllustration, type FoodId } from "./food-illustrations";
import { loadLocalState, saveLocalState } from "./local-db";
import {
  demoLink,
  shrimpNoodleRecipe,
  suitabilityCopy,
  tomatoRiceAnalysis,
} from "./mock-data";
import { selectPersistedState, useAppStore } from "./store";
import { childVoiceTts } from "./tts-gateway";
import type { CookingStep, FeedingSignal, FeedingStage, Feedback, Ingredient, Suitability } from "./types";

const stageLabels = {
  puree: "细腻泥糊",
  "thick-puree": "稠泥与小颗粒",
  "soft-lumps": "软颗粒",
  "finger-food": "软手指食物",
};

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
  const [months, setMonths] = useState(profile.months ? String(profile.months) : "");
  const [correctedMonths, setCorrectedMonths] = useState(profile.correctedMonths === null ? "" : String(profile.correctedMonths));
  const selectedAge = Number(months);
  const correctedAge = correctedMonths === "" ? null : Number(correctedMonths);
  const ageValid = selectedAge >= 4 && selectedAge <= 36;
  const correctedValid = !profile.premature || correctedAge === null || (correctedAge >= 0 && correctedAge <= selectedAge);
  const continueToAvoid = () => {
    setProfile({ months: selectedAge, correctedMonths: profile.premature ? correctedAge : null, ageConfirmed: true });
    navigate("/onboarding/avoid");
  };
  return (
    <Screen className="onboarding-screen">
      <TopBar title="建立宝宝档案" eyebrow="1 / 3" />
      <ProgressSteps current={1} />
      <section className="onboarding-card">
        <div className="question-icon yellow"><Baby size={26} /></div>
        <span className="question-kicker">先确认基础月龄</span>
        <h1>宝宝现在多大了？</h1>
        <p>填写实际月龄。月龄只参与判断，不代表宝宝必须达到某个进食阶段。</p>
        <span className="field-label age-field-label">宝宝月龄</span>
        <MonthPicker id="baby-age" label="宝宝月龄" min={4} value={months} onChange={setMonths} />
        <div className="age-shortcuts" aria-label="常用月龄">{ageChoices.map((age) => <button type="button" key={age} aria-pressed={selectedAge === age} className={cx(selectedAge === age && "selected")} onClick={() => setMonths(String(age))}>{age} 月</button>)}</div>
        {months && !ageValid && <p className="field-error"><AlertCircle size={14} />当前支持填写 4—36 个月</p>}
        <div className="onboarding-subquestion">
          <div><strong>宝宝是早产出生吗？</strong><small>用于判断是否需要参考纠正月龄</small></div>
          <div className="binary-choice"><button type="button" className={cx(!profile.premature && "selected")} aria-pressed={!profile.premature} onClick={() => { setProfile({ premature: false }); setCorrectedMonths(""); }}>不是</button><button type="button" className={cx(profile.premature && "selected")} aria-pressed={profile.premature} onClick={() => setProfile({ premature: true })}>是</button></div>
        </div>
        {profile.premature && <div className="corrected-age-panel"><div><strong>纠正月龄（可选）</strong><small>不确定可以先留空，之后再补充</small></div><MonthPicker id="corrected-age" label="纠正月龄" min={0} max={selectedAge || 36} value={correctedMonths} onChange={setCorrectedMonths} />{!correctedValid && <p className="field-error"><AlertCircle size={14} />纠正月龄不能大于实际月龄</p>}</div>}
      </section>
      <div className="screen-actions"><Button full disabled={!ageValid || !correctedValid} onClick={continueToAvoid}>继续填写不能吃的食材</Button><p>下一步只记录已经明确要避开的食材</p></div>
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
        <div className="question-icon pink"><ShieldAlert size={25} /></div>
        <span className="question-kicker">会直接影响适配结论</span>
        <h1>有哪些食材需要避开？</h1>
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
        <div className="question-icon mint"><UtensilsCrossed size={25} /></div>
        <span className="question-kicker">按真实表现来选</span>
        <h1>宝宝现在能稳定吃什么？</h1>
        <p>不要按月龄推测。选择宝宝多数时候能顺利处理的最高阶段；介于两项之间时选前一项。</p>
        <div className="stage-list">
          {stageOptions.map((option, index) => (
            <button type="button" key={option.value} aria-pressed={profile.stageConfirmed && profile.stage === option.value} className={cx("stage-choice", profile.stageConfirmed && profile.stage === option.value && "selected")} onClick={() => chooseStage(option.value)}>
              <span className="texture-sample">{index + 1}</span>
              <span><strong>{option.title}</strong><small>{option.desc}</small></span>
              <span className="radio-dot">{profile.stageConfirmed && profile.stage === option.value && <i />}</span>
            </button>
          ))}
        </div>
        <div className="feeding-followup"><div><strong>最近常出现这些情况吗？</strong><small>可多选；用于让后续质地建议更保守</small></div><div className="signal-grid">{feedingSignalOptions.map((option) => <button type="button" key={option.value} aria-pressed={profile.feedingSignals.includes(option.value)} className={cx(profile.feedingSignals.includes(option.value) && "selected")} onClick={() => toggleSignal(option.value)}>{profile.feedingSignals.includes(option.value) && <Check size={14} />}{option.label}</button>)}<button type="button" className={cx(profile.feedingSignalsConfirmed && profile.feedingSignals.length === 0 && "selected safe")} aria-pressed={profile.feedingSignalsConfirmed && profile.feedingSignals.length === 0} onClick={() => setProfile({ feedingSignals: [], feedingSignalsConfirmed: true })}>{profile.feedingSignalsConfirmed && profile.feedingSignals.length === 0 && <Check size={14} />}暂时没有以上情况</button></div><label htmlFor="feeding-note">还有什么想补充？<span>可选</span></label><textarea id="feeding-note" value={profile.feedingNote} placeholder="例如：偶尔能吃颗粒，累的时候会吐出来" onChange={(event) => setProfile({ feedingNote: event.target.value.slice(0, 120) })} /></div>
        {profile.feedingSignals.includes("swallowing-difficulty") && <div className="info-note risk-note"><ShieldAlert size={17} /><span>已记下吞咽费力。后续建议会优先采用更保守的质地；若持续出现或伴随其他异常，应咨询专业人员。</span></div>}
      </section>
      <div className="screen-actions"><Button full disabled={!complete} onClick={() => { finish(); navigate("/home"); }}>完成宝宝档案</Button><p>{!profile.stageConfirmed ? "请先选择宝宝稳定能处理的阶段" : !profile.feedingSignalsConfirmed ? "请确认最近是否有进食困难" : "之后可以在宝宝档案中随时修改"}</p></div>
    </Screen>
  );
}

// FRONTEND PLACEHOLDER DATA: 推荐服务接入前，只用于验证首页信息架构；不作为食物安全结论。
const homeInspirationIdeas = [
  { id: "pumpkin-rice", title: "南瓜鸡肉软饭", time: "约 15 分钟", foodId: "pumpkin" as FoodId, note: "软烂处理，匹配当前质地" },
  { id: "broccoli-egg", title: "西兰花蒸蛋", time: "约 12 分钟", foodId: "broccoli" as FoodId, note: "熟悉食材，做法简单" },
  { id: "carrot-tofu", title: "胡萝卜豆腐软饭", time: "约 18 分钟", foodId: "carrot" as FoodId, note: "容易压软，方便调整颗粒" },
  { id: "banana-oat", title: "香蕉燕麦软饼", time: "约 10 分钟", foodId: "banana" as FoodId, note: "加餐灵感，质地仍需确认" },
] as const;

function HomePage() {
  const navigate = useNavigate();
  const profile = useAppStore((state) => state.profile);
  const history = useAppStore((state) => state.history);
  const cookPrepared = useAppStore((state) => state.cookPrepared);
  const cookStep = useAppStore((state) => state.cookStep);
  const riskInterrupted = useAppStore((state) => state.riskInterrupted);
  const completedSteps = useAppStore((state) => state.completedSteps);
  const cookConversation = useAppStore((state) => state.cookConversation);
  const [url, setUrl] = useState("");
  const [error, setError] = useState("");
  const [ideaOffset, setIdeaOffset] = useState(0);
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
  const submit = (event?: FormEvent) => {
    event?.preventDefault();
    if (!/^https?:\/\//.test(url.trim())) {
      setError("请粘贴以 http:// 或 https:// 开头的视频链接");
      return;
    }
    navigate("/analysis/shrimp-noodle-demo");
  };
  const hasCookingSession = cookPrepared || completedSteps.length > 0 || cookConversation.length > 0 || riskInterrupted;
  const pendingObservation = history.find((item) => item.progress === "completed" && item.feedback && !item.feedback.observed);
  const inspirationIdeas = Array.from({ length: 3 }, (_, index) => homeInspirationIdeas[(ideaOffset + index) % homeInspirationIdeas.length]);
  const hasNextTask = hasCookingSession || Boolean(pendingObservation);
  const openNextTask = () => {
    if (hasCookingSession) return navigate("/cook/shrimp-noodle-demo/session");
    if (pendingObservation) navigate(`/feedback/${pendingObservation.id}/later`);
  };
  return (
    <Screen className="home-screen has-bottom-nav">
      <div className="home-hero">
        <header className="home-header">
          <div><span>宝宝饱饱</span><h1>今天给{profile.name}做什么？</h1></div>
          <button className="baby-avatar" onClick={() => navigate("/baby")} aria-label="查看宝宝档案"><CharacterIllustration intent="link" size="avatar" animate={false} /></button>
        </header>
        <div className="profile-pill"><Baby size={15} /><span>{profile.name} · {profile.months} 个月 · {stageLabels[profile.stage]}</span><ChevronRight size={15} /></div>
        {hasNextTask && <button className={cx("home-next-task", riskInterrupted && "risk")} onClick={openNextTask}>
          <CharacterIllustration intent={riskInterrupted ? "paused" : hasCookingSession ? "prepare" : "plan"} size="avatar" animate={false} />
          <span className="home-next-task-copy"><small>{riskInterrupted ? "需要先确认" : hasCookingSession ? "继续制作" : "今天需要观察"}</small><strong>{hasCookingSession ? "宝宝虾滑面" : pendingObservation?.recipeTitle}</strong><em>{riskInterrupted ? "陪做已暂停，请先查看风险提示" : hasCookingSession ? `当前第 ${cookStep} / 5 步 · 还剩 ${Math.max(5 - completedSteps.length, 1)} 个动作` : "完成后可补充后续观察"}</em>{hasCookingSession && pendingObservation && <b>另有 1 项待观察</b>}</span>
          <ChevronRight size={18} />
        </button>}
        <form className="paste-card home-import-card" onSubmit={submit}>
          <div className="home-primary-head"><div className="paste-icon"><Link2 size={21} /></div><div><h2>导入辅食内容</h2><p>当前支持视频链接</p></div><span>链接分析</span></div>
          <label htmlFor="video-url" className="sr-only">视频链接</label>
          <div className={cx("url-field", error && "invalid")}><input id="video-url" value={url} placeholder="粘贴辅食视频链接" onChange={(e) => { setUrl(e.target.value); setError(""); }} /><button type="button" onClick={pasteLink}>粘贴</button></div>
          {error && <p className="field-error"><AlertCircle size={14} />{error}</p>}
          <Button full type="submit" icon={<Sparkles size={17} />}>开始分析</Button>
          <button className="home-example-link" type="button" onClick={() => { setUrl(demoLink); setError(""); }}><Play size={12} />没有链接？试试宝宝虾滑面示例</button>
        </form>
      </div>
      <section className="home-inspiration-section">
        <div className="home-section-heading"><div><span>灵感示例</span><h2>今日辅食灵感</h2><p>加入前仍需结合档案和实际食材记录确认</p></div><button onClick={() => setIdeaOffset((current) => (current + 1) % homeInspirationIdeas.length)}>换一换</button></div>
        <div className="home-inspiration-track">
          {inspirationIdeas.map((idea) => <article className="home-idea-card" key={idea.id}><div className="home-idea-visual"><FoodIllustration foodId={idea.foodId} alt="" /></div><span>{idea.time}</span><h3>{idea.title}</h3><p>{idea.note}</p><button onClick={() => navigate("/plan")}>去安排<ChevronRight size={13} /></button></article>)}
        </div>
      </section>
      <section className="home-dashboard-grid" aria-label="计划与探索">
        <button className="home-dashboard-card plan" onClick={() => navigate("/plan/week")}><span className="home-dashboard-icon"><CalendarDays size={19} /></span><small>本周辅食计划</small><strong>已安排 {weeklyMeals.length} 天</strong><p>今天：南瓜鸡肉软饭</p><em>查看计划 <ChevronRight size={12} /></em></button>
        <button className="home-dashboard-card food-map" onClick={() => navigate("/food-map")}><span className="home-dashboard-icon"><Map size={19} /></span><small>食物探索地图</small><strong>已记录 {profile.triedFoods.length} 种</strong><p>继续积累真实尝试</p><em>继续探索 <ChevronRight size={12} /></em></button>
      </section>
      {!hasNextTask && <section className="home-calm-note"><CharacterIllustration intent="neutral" size="avatar" animate={false} /><div><strong>今天没有待处理任务</strong><p>小鸡仔可以休息一下，或者从一条辅食内容开始。</p></div></section>}
    </Screen>
  );
}

// FRONTEND PLACEHOLDER DATA: AI 接入后由计划生成与视频检索服务替换。
const weeklyMeals = [
  { day: "周一", title: "南瓜鸡肉软饭", note: "熟悉食材 · 约 20 分钟", tone: "familiar" },
  { day: "周二", title: "宝宝虾滑面", note: "计划尝试鲜虾 · 约 25 分钟", tone: "new" },
  { day: "周四", title: "番茄牛肉碎碎面", note: "补充肉类变化 · 约 20 分钟", tone: "familiar" },
  { day: "周六", title: "山药蛋黄小饼", note: "可提前备好 · 约 25 分钟", tone: "prep" },
  { day: "周日", title: "胡萝卜鸡肉粥", note: "熟悉口味收尾 · 约 25 分钟", tone: "familiar" },
];

const foodJourneyStages = [
  {
    age: "6 月龄", title: "第一次认识食物", note: "从少量、单一记录开始", state: "completed",
    foods: [
      { id: "millet-porridge", name: "小米粥", fallback: "粥", state: "recorded" },
      { id: "pumpkin", name: "南瓜", fallback: "南", state: "recorded" },
      { id: "potato", name: "土豆", fallback: "土", state: "recorded" },
      { id: "broccoli", name: "西兰花", fallback: "西", state: "recorded" },
    ],
  },
  {
    age: "7—8 月龄", title: "慢慢丰富味道", note: "留下接受程度和质地记录", state: "completed",
    foods: [
      { id: "egg", name: "鸡蛋", fallback: "蛋", state: "recorded" },
      { id: "carrot", name: "胡萝卜", fallback: "胡", state: "recorded" },
      { id: "banana", name: "香蕉", fallback: "蕉", state: "recorded" },
      { id: "pear", name: "梨", fallback: "梨", state: "recorded" },
    ],
  },
  {
    age: "9—10 月龄", title: "满满现在在这里", note: "软颗粒阶段 · 本站已点亮 5 / 5", state: "current",
    foods: [
      { id: "tofu", name: "豆腐", fallback: "豆", state: "recorded" },
      { id: "corn", name: "玉米", fallback: "玉", state: "recorded" },
      { id: "spinach", name: "菠菜", fallback: "菠", state: "recorded" },
      { id: "apple", name: "苹果", fallback: "苹", state: "recorded" },
      { id: "sweet-potato", name: "红薯", fallback: "薯", state: "recorded" },
    ],
  },
  {
    age: "11—12 月龄", title: "继续认识新朋友", note: "一次安排一种新食材并留下记录", state: "future",
    foods: [
      { id: "salmon", name: "三文鱼", fallback: "鱼", state: "planned" },
    ],
  },
  {
    age: "13—18 月龄", title: "练习更多口感", note: "根据实际能力继续展开，不预设进度", state: "future",
    foods: [
      { id: "avocado", name: "牛油果", fallback: "果", state: "future" },
    ],
  },
  {
    age: "19—24 月龄", title: "建立自己的食物世界", note: "新食物素材完成后再加入，不重复冒充", state: "future",
    foods: [],
  },
] as const;

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
    <section className="week-section"><div className="week-heading"><div><h2>本周菜单</h2></div><button onClick={() => navigate("/plan")}>调整</button></div><div className="meal-list">{weeklyMeals.map((meal) => <article key={meal.day}><span>{meal.day}</span><div><strong>{meal.title}</strong><small>{meal.note}</small></div>{meal.title === "宝宝虾滑面" ? <button onClick={() => navigate("/result/adapted")}>宝宝版本</button> : <ChevronRight size={17} />}</article>)}</div></section>
    <section className="week-section prep-overview"><div className="week-heading"><div><h2>采购与备菜</h2></div></div><div><p><ShoppingBasket size={17} /><span><strong>集中采购</strong><small>鸡胸、牛肉、鲜虾、南瓜、番茄、山药</small></span></p><p><ListChecks size={17} /><span><strong>提前处理</strong><small>肉类分装；南瓜、山药蒸熟冷藏</small></span></p></div></section>
    <p className="plan-boundary"><Info size={14} />方案会根据实际进食反馈调整；食材记录不等同于医学判断。</p>
  </Screen>;
}

function FoodMapPage() {
  const navigate = useNavigate();
  return <Screen className="food-map-screen collapsible-title-screen"><TopBar title="宝宝食物地图" back="/home" />
    <section className="food-map-hero journey-hero"><div><span>满满 · 10 个月</span><h1>食物成长路线</h1><p>已经认识 13 种食物，现在走到第 3 站。</p></div><CharacterIllustration intent="explore" size="card" /></section>
    <div className="journey-summary"><span><strong>13</strong><small>已记录</small></span><i /><span><strong>3 / 6</strong><small>当前站</small></span><i /><span><strong>三文鱼</strong><small>下一种</small></span></div>
    <section className="food-journey" aria-label="满满的食物成长路线">
      {foodJourneyStages.map((stage) => <article key={stage.age} className={cx("journey-stage", stage.state)}>
        <header><span>{stage.state === "completed" ? <Check size={14} /> : stage.state === "current" ? <Sparkles size={14} /> : <LockKeyhole size={13} />}</span><div><small>{stage.age}</small><h2>{stage.title}</h2><p>{stage.note}</p></div>{stage.state === "current" && <b>当前</b>}</header>
        <div className="food-path-track">
          {stage.foods.map((food, foodIndex) => {
            const side = pathSides[foodIndex % pathSides.length];
            const nextSide = pathSides[(foodIndex + 1) % pathSides.length];
            const interactive = food.state === "planned";
            return <div key={food.id} className={cx("food-path-row", side)}>
              {foodIndex < stage.foods.length - 1 && <svg className="food-path-connector" viewBox="0 0 320 168" preserveAspectRatio="none" aria-hidden="true"><path d={foodConnectorPath(side, nextSide)} /></svg>}
              <button className={cx("food-path-node", food.state)} disabled={food.state === "future"} onClick={() => interactive && navigate(`/food-map/${food.id}`)} aria-label={`${food.name}，${food.state === "recorded" ? "已有记录" : food.state === "planned" ? "下一种计划尝试" : "尚未探索"}`}>
                <span className="food-character-slot" data-food-image={food.id}><FoodIllustration foodId={food.id as FoodId} alt={food.name} fallback={<small>{food.fallback}</small>} />{food.state === "recorded" && <i><Check size={11} /></i>}{food.state === "future" && <i><LockKeyhole size={10} /></i>}</span>
                <strong>{food.name}</strong>
                <small>{food.state === "recorded" ? "已点亮" : food.state === "planned" ? "下一种" : "待探索"}</small>
              </button>
            </div>;
          })}
        </div>
      </article>)}
    </section>
    <p className="journey-boundary"><Info size={14} />路线按月龄整理记录和计划，不代表食材只能在对应月龄尝试；具体仍以宝宝能力和专业建议为准。</p>
  </Screen>;
}

function FoodDetailPage() {
  const navigate = useNavigate();
  const [added, setAdded] = useState(false);
  return <Screen className="food-detail-screen collapsible-title-screen"><TopBar title="食材详情" back="/food-map" />
    <section className="food-detail-hero"><FoodIllustration foodId="salmon" alt="三文鱼" /><div><small>计划尝试</small><h1>三文鱼</h1><p>路线中的下一位食物朋友</p></div></section>
    <section className="food-detail-card"><header><span>为什么现在安排</span><ShieldCheck size={18} /></header><p>当前路线里的 13 种食物已有记录，这次只新增三文鱼，更容易看清实际接受情况。</p></section>
    <section className="explore-plan"><div className="week-heading"><div><span>记录事实，不替代判断</span><h2>分 3 次完成一次探索</h2></div></div>{[["01", "准备并制作", "选择宝宝版本，记录实际使用的食材。"], ["02", "记录吃了多少", "完成后记录接受程度和即时情况。"], ["03", "稍后补充观察", "回到记录页补充后续情况；如有异常先停止尝试并寻求专业帮助。"]].map(([id, title, detail]) => <article key={id}><span>{id}</span><div><strong>{title}</strong><p>{detail}</p></div></article>)}</section>
    <div className="related-recipe"><span><UtensilsCrossed size={19} /></span><div><small>加入后再生成宝宝版本</small><strong>三文鱼南瓜软饭</strong><p>实际用量和质地仍需结合本次记录</p></div></div>
    <div className="food-detail-actions"><Button full onClick={() => setAdded(true)}>{added ? "已加入本周计划" : "加入本周计划"}</Button><button onClick={() => navigate("/food-map")}>暂不尝试</button></div>
  </Screen>;
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

function AnalysisPage() {
  const navigate = useNavigate();
  const profile = useAppStore((state) => state.profile);
  const { scenario } = useContext(ScenarioContext);
  const [progress, setProgress] = useState<AnalysisProgress>({ stage: "reading", percent: 8, label: "准备读取视频…" });
  const [failed, setFailed] = useState(false);
  const started = useRef(false);
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    createAiGateway(scenario).analyzeVideo(demoLink, profile, setProgress)
      .then(() => navigate(`/result/${resultRoutes[scenario]}`))
      .catch(() => setFailed(true));
  }, [navigate, profile, scenario]);
  if (failed) return <AnalysisFailure />;
  return (
    <Screen className="analysis-screen">
      <TopBar title="正在整理视频" back="/home" />
      <section className="analysis-visual">
        <div className="analysis-orbit"><div className="analysis-center"><CharacterIllustration intent={progress.stage === "reading" ? "link" : progress.stage === "checking" ? "question" : "inspect"} size="hero" /></div><i /><i /><i /></div>
        <h1>宝宝虾滑面</h1>
        <AnimatePresence mode="wait" initial={false}><motion.p key={progress.label} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }} transition={{ duration: .16 }}>{progress.label}</motion.p></AnimatePresence>
        <div className="analysis-progress"><span style={{ width: `${progress.percent}%` }} /></div>
        <strong>{progress.percent}%</strong>
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
      <p className="analysis-footnote">视频信息不足时会暂停并提问，不会为了生成完整菜谱而猜测。</p>
    </Screen>
  );
}

function AnalysisFailure() {
  const navigate = useNavigate();
  return (
    <Screen className="centered-state">
      <TopBar title="视频分析" back="/home" />
      <div className="state-icon muted"><Link2 size={28} /></div>
      <h1>这条链接暂时无法读取</h1>
      <p>链接可能已失效、需要登录，或当前页面无法访问视频内容。</p>
      <Button full onClick={() => navigate("/home")}>重新粘贴链接</Button>
    </Screen>
  );
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
          <span className="eyebrow">给满满的适配结论</span>
          <h2>{copy.label}</h2>
          <h3>{copy.title}</h3>
          <p>{resultSummary(scenario)}</p>
          <div className="profile-evidence"><Baby size={16} /><span>依据：满满 · 10 个月 · 软颗粒阶段</span></div>
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
        await navigator.share({ title: "满满的宝宝虾滑面", text: "已按 10 月龄软颗粒阶段整理的宝宝版本", files: [file] });
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
  return id === tomatoRiceAnalysis.id ? <TomatoRiceConversationPage /> : <ShrimpCookSessionPage />;
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
  const [voiceMode, setVoiceMode] = useState(false);
  const [recording, setRecording] = useState(false);
  const [timerEndAt, setTimerEndAt] = useState<number | null>(null);
  const timelineRef = useRef<HTMLDivElement>(null);
  const phase = tomatoRiceAnalysis.phases[stepIndex];
  const progress = ((completed.length + .35) / tomatoRiceAnalysis.phases.length) * 100;
  const speak = (text: string) => {
    void childVoiceTts.speak(text);
  };
  useEffect(() => {
    timelineRef.current?.scrollTo({ top: timelineRef.current.scrollHeight, behavior: "smooth" });
  }, [stepIndex, messages.length]);
  useEffect(() => {
    if (voiceMode) speak(`${phase.title}。${phase.action}。完成状态：${phase.check}`);
    // Only read the newly active action.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stepIndex]);
  const toggleVoice = () => {
    const next = !voiceMode;
    setVoiceMode(next);
    if (next) speak(`${phase.title}。${phase.action}。完成状态：${phase.check}`);
    else childVoiceTts.cancel();
  };
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
    if (voiceMode) window.setTimeout(() => speak(answer), 80);
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
      <button className={cx("voice-mode", voiceMode && "active")} onClick={toggleVoice}><Volume2 size={16} />{voiceMode ? childVoiceTts.isNeuralConfigured ? "宝宝音色中" : "柔和语音中" : childVoiceTts.isNeuralConfigured ? "开启宝宝音色" : "开启柔和语音"}</button>
    </header>
    <div className="session-context"><span>{tomatoRiceAnalysis.title}</span></div>
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
      <div className={cx("session-composer", recording && "recording")}><IconButton label="语音输入" onClick={simulateVoice}><Mic size={19} /></IconButton><input value={recording ? "正在听…" : input} disabled={recording} placeholder={voiceMode ? "直接说，或在这里输入" : "问问当前这一步"} onChange={(event) => setInput(event.target.value)} onKeyDown={(event) => event.key === "Enter" && answerQuestion()} /><IconButton className="composer-send" label="发送" disabled={!input.trim()} onClick={() => answerQuestion()}><Send size={18} /></IconButton></div>
    </div>
  </Screen>;
}

function ShrimpCookSessionPage() {
  const navigate = useNavigate();
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
  const [voiceMode, setVoiceMode] = useState(false);
  const timelineRef = useRef<HTMLDivElement>(null);
  const gateway = useMemo(() => createAiGateway(), []);
  const speak = (text: string) => {
    void childVoiceTts.speak(text);
  };
  useEffect(() => {
    timelineRef.current?.scrollTo({ top: timelineRef.current.scrollHeight, behavior: "smooth" });
  }, [cookPrepared, cookConversation.length, stepNumber, thinking, riskInterrupted]);
  useEffect(() => {
    if (!voiceMode || riskInterrupted) return;
    speak(cookPrepared
      ? `${step.title}。${step.instruction}。完成状态：${step.check}`
      : "开始前，我们先确认食材是否齐全。你可以直接说出缺少的食材。");
    // Voice output follows the active cooking action only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stepNumber, voiceMode, cookPrepared, riskInterrupted]);
  const addMessage = (role: "user" | "assistant", text: string) => appendCookMessage({ id: `${Date.now()}-${Math.random()}`, role, text, phase: cookPrepared ? "cook" : "prep", step: stepNumber });
  const answerWith = (text: string) => {
    addMessage("assistant", text);
    if (voiceMode) speak(text);
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
      window.setTimeout(() => { answerWith("可以，已经换成满满吃过的胡萝卜，蔬菜总量和后续步骤也一起调整好了。其他食材都齐了吗？"); setThinking(false); }, 320);
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
  const toggleVoiceMode = async () => {
    const next = !voiceMode;
    setVoiceMode(next);
    if (!next) {
      childVoiceTts.cancel();
      return;
    }
    try {
      const nav = navigator as Navigator & { wakeLock?: { request: (type: "screen") => Promise<unknown> } };
      if (nav.wakeLock) await nav.wakeLock.request("screen");
    } catch { /* Voice mode remains available without Wake Lock. */ }
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
      <button className={cx("voice-mode", voiceMode && "active")} onClick={toggleVoiceMode}><Volume2 size={16} />{voiceMode ? childVoiceTts.isNeuralConfigured ? "宝宝音色中" : "柔和语音中" : childVoiceTts.isNeuralConfigured ? "开启宝宝音色" : "开启柔和语音"}</button>
    </header>
    <div className="session-context"><span>宝宝虾滑面</span></div>
    <div className="conversation-timeline" ref={timelineRef} aria-live="polite">
      <AssistantMessage><p>我们一起把满满的宝宝虾滑面做好。开始前先确认一下食材，缺什么直接告诉我，我会同步调整后面的做法。</p></AssistantMessage>
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
      {riskInterrupted && <AssistantMessage tone="risk"><div className="risk-copy"><ShieldAlert size={20} /><div><strong>普通陪做已经暂停</strong><p>先停止喂食并观察满满的情况。若症状明显、快速加重或影响呼吸，请立即寻求专业帮助。</p></div></div></AssistantMessage>}
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
        <input value={recording ? "正在听…" : input} disabled={recording || riskInterrupted} placeholder={voiceMode ? "直接说，或在这里输入…" : "说说现在遇到的情况…"} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => e.key === "Enter" && sendMessage()} />
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
  const recipeTitle = isTomatoRecipe ? tomatoRiceAnalysis.title : "宝宝虾滑面";
  const babyName = isTomatoRecipe ? tomatoRiceAnalysis.baby.name : "满满";
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
  const noteSuggestions = isTomatoRecipe ? ["米饭可以再软些", "肉末可以再细些", "宝宝愿意再吃"] : ["面条可以再软些", "虾滑可以再小些", "宝宝愿意再吃"];
  return <Screen className="post-meal-feedback-screen"><TopBar title="用餐反馈" back={isTomatoRecipe ? "/home" : "/cook/shrimp-noodle-demo/complete"} />
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
  const recipeTitle = id === tomatoRiceAnalysis.id ? tomatoRiceAnalysis.title : "宝宝虾滑面";
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
  const item = history.find((entry) => entry.id === id) || history[0];
  return <Screen className="detail-screen"><TopBar title="记录详情" back="/history" /><section className="detail-hero"><span className="status-chip soft">{item?.date || "今天"}</span><h1>{item?.recipeTitle || "宝宝虾滑面"}</h1><p>{item?.progress === "completed" ? "这次制作和反馈已经保存" : "已保存，尚未开始制作"}</p></section><section className="detail-card"><h2>适配结论</h2><div className="detail-result"><ShieldCheck size={21} /><span><strong>{item ? suitabilityCopy[item.conclusion].label : "调整后可以做"}</strong><small>按满满 10 个月、软颗粒阶段生成</small></span></div></section><section className="detail-card"><h2>实际反馈</h2>{item?.feedback ? <div className="feedback-summary"><span><small>吃了多少</small><strong>{feedbackLabel(item.feedback.amount)}</strong></span><span><small>接受程度</small><strong>{feedbackLabel(item.feedback.acceptance)}</strong></span><span><small>吞咽情况</small><strong>{feedbackLabel(item.feedback.swallowing)}</strong></span></div> : <p className="empty-copy">还没有记录这次反馈。</p>}</section><section className="detail-card"><h2>食材状态变化</h2><div className="food-change"><span className="food-icon">虾</span><div><strong>鲜虾仁</strong><small>尚未尝试 → 已尝试待观察</small></div></div><p className="boundary-copy"><Info size={15} />一次反馈不会直接将食材标记为“安全”。</p></section><div className="screen-actions static"><Button full onClick={() => navigate("/result/adapted")}>再次查看宝宝版本</Button></div></Screen>;
}

function feedbackLabel(value?: string) {
  const labels: Record<string, string> = { most: "大部分", half: "一半左右", few: "几口", none: "几乎没吃", liked: "愿意继续吃", neutral: "反应一般", refused: "明显拒绝", smooth: "过程顺利", difficulty: "有些困难", unusual: "疑似异常" };
  return value ? labels[value] || value : "未记录";
}

function BabyPage() {
  const navigate = useNavigate();
  const profile = useAppStore((state) => state.profile);
  return <Screen className="baby-screen has-bottom-nav"><TopBar title="宝宝档案" action={<IconButton label="设置" onClick={() => navigate("/settings")}><Settings size={20} /></IconButton>} /><section className="baby-hero"><div className="large-avatar"><CharacterIllustration intent="link" size="support" animate={false} /></div><div><span className="eyebrow">当前宝宝</span><h1>{profile.name}</h1><p>{profile.months} 个月 · {stageLabels[profile.stage]}</p></div><IconButton label="编辑档案" onClick={() => navigate("/baby/edit")}><Edit3 size={18} /></IconButton></section><section className="profile-summary"><div><span><Baby size={19} /></span><p><small>月龄</small><strong>{profile.months} 个月</strong></p></div><div><span><UtensilsCrossed size={19} /></span><p><small>进食阶段</small><strong>{stageLabels[profile.stage]}</strong></p></div><div><span><ShieldCheck size={19} /></span><p><small>明确回避</small><strong>{profile.avoidFoods.length ? profile.avoidFoods.join("、") : "暂无"}</strong></p></div></section><section className="baby-section"><div className="section-heading"><div><span className="eyebrow">食材尝试</span><h2>让适配更有依据</h2></div><button onClick={() => navigate("/baby/foods")}>全部食材</button></div><div className="food-status-grid"><div><span className="food-icon">蛋</span><strong>鸡蛋</strong><small className="green-text">已尝试</small></div><div><span className="food-icon">虾</span><strong>鲜虾</strong><small className="orange-text">待观察</small></div><div><span className="food-icon">胡</span><strong>胡萝卜</strong><small className="green-text">已尝试</small></div><div><span className="food-icon">西</span><strong>西蓝花</strong><small className="green-text">已尝试</small></div></div></section><section className="baby-section"><button className="profile-link" onClick={() => navigate("/history")}><span><History size={18} /><span><strong>制作与反馈记录</strong><small>3 条本机记录</small></span></span><ChevronRight size={18} /></button><button className="profile-link" onClick={() => navigate("/settings")}><span><LockKeyhole size={18} /><span><strong>数据与隐私</strong><small>只保存在当前浏览器</small></span></span><ChevronRight size={18} /></button></section></Screen>;
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
  return <Screen className="settings-screen"><TopBar title="设置" back="/baby" /><section className="settings-group"><span className="group-label">数据</span><div className="settings-row"><span><LockKeyhole size={19} /><span><strong>存储位置</strong><small>只保存在当前浏览器</small></span></span><span className="value">本机</span></div></section><section className="settings-group"><span className="group-label">关于</span><div className="settings-row"><span><Info size={19} /><span><strong>产品边界</strong><small>不构成真实喂养或医疗建议</small></span></span></div></section><section className="settings-group"><span className="group-label">重置</span><button className="settings-row danger-row" onClick={() => setConfirm(true)}><span><Trash2 size={19} /><span><strong>清除本机数据</strong><small>重新进入三步建档</small></span></span><ChevronRight size={18} /></button></section><AnimatePresence>{confirm && <Sheet title="清除所有本机数据？" onClose={() => setConfirm(false)}><div className="sheet-content"><p>满满的档案、历史菜谱、陪做进度和反馈都会被清除。这个操作无法撤销。</p><Button full variant="danger" onClick={() => { reset(); setConfirm(false); navigate("/onboarding/age"); }}>清除并重新开始</Button><Button full variant="ghost" onClick={() => setConfirm(false)}>取消</Button></div></Sheet>}</AnimatePresence></Screen>;
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
              <Route path="/plan" element={<PlanSetupPage />} />
              <Route path="/plan/week" element={<WeeklyPlanPage />} />
              <Route path="/food-map" element={<FoodMapPage />} />
              <Route path="/food-map/:food" element={<FoodDetailPage />} />
              <Route path="/analysis/:id" element={<AnalysisPage />} />
              <Route path="/analysis-error" element={<AnalysisFailure />} />
              <Route path="/result/:conclusion" element={<RecipeResultPage />} />
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
