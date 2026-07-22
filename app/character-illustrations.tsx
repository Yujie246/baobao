"use client";

import { motion, useReducedMotion } from "motion/react";
import { useState, type ReactNode } from "react";

export const characterIntents = [
  "neutral", "welcome", "link", "inspect", "plan", "explore",
  "confirm", "question", "paused", "prepare", "mix", "serve",
] as const;

export type CharacterIntent = (typeof characterIntents)[number];
export type CookingActionKind = "prepare" | "mix" | "heat" | "timer" | "add" | "check_texture" | "cool" | "serve" | "generic";

const actionIntent: Record<CookingActionKind, CharacterIntent> = {
  prepare: "prepare", mix: "mix", heat: "mix", timer: "plan", add: "prepare",
  check_texture: "inspect", cool: "paused", serve: "serve", generic: "prepare",
};

export function resolveCookingIntent(action?: string): CharacterIntent {
  return action && action in actionIntent ? actionIntent[action as CookingActionKind] : "prepare";
}

export function resolveResultIntent(result?: string): CharacterIntent {
  switch (result) {
    case "direct": return "serve";
    case "adapted": return "explore";
    case "needs-info": return "question";
    case "not-recommended": return "paused";
    default: return "inspect";
  }
}

export function CharacterIllustration({ intent = "neutral", size = "support", alt = "", className = "", fallback = null, animate = true, priority = false }: {
  intent?: CharacterIntent;
  size?: "avatar" | "card" | "support" | "hero";
  alt?: string;
  className?: string;
  fallback?: ReactNode;
  animate?: boolean;
  priority?: boolean;
}) {
  const [failed, setFailed] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const reduceMotion = useReducedMotion();
  if (failed) return fallback;
  const base = `/illustrations/ip/v1/${intent}`;
  return (
    <motion.span
      className={`character-illustration character-${size} ${loaded ? "is-loaded" : ""} ${className}`.trim()}
      aria-hidden={alt ? undefined : true}
      initial={animate && !reduceMotion ? { opacity: 0, y: 7, scale: .97 } : false}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: .32, ease: [0.22, 1, 0.36, 1] }}
    >
      <picture>
        <source type="image/webp" srcSet={`${base}-160.webp 160w, ${base}-320.webp 320w`} sizes={size === "hero" ? "128px" : size === "avatar" ? "44px" : "88px"} />
        <img src={`${base}-320.png`} width="320" height="320" alt={alt} loading={priority ? "eager" : undefined} fetchPriority={priority ? "high" : undefined} decoding={priority ? "sync" : "async"} onLoad={() => setLoaded(true)} onError={() => setFailed(true)} />
      </picture>
    </motion.span>
  );
}
