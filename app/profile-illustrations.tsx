"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useState, type ReactNode } from "react";
import type { FeedingStage } from "./types";

export const profileAssetIds = [
  "age-default", "age-04-06", "age-07-08", "age-09-10", "age-11-12", "age-13-18", "age-19-36",
  "avoid-unanswered", "avoid-none", "avoid-has-items",
  "texture-puree", "texture-thick-puree", "texture-soft-lumps", "texture-finger-food",
] as const;

export type ProfileAssetId = (typeof profileAssetIds)[number];
export type AvoidIllustrationStatus = "unanswered" | "none" | "has" | null;

export function resolveAgeProfileAsset(months?: number): ProfileAssetId {
  if (!months || months < 4 || months > 36) return "age-default";
  if (months <= 6) return "age-04-06";
  if (months <= 8) return "age-07-08";
  if (months <= 10) return "age-09-10";
  if (months <= 12) return "age-11-12";
  if (months <= 18) return "age-13-18";
  return "age-19-36";
}

export function resolveAvoidProfileAsset(status: AvoidIllustrationStatus): ProfileAssetId {
  if (status === "none") return "avoid-none";
  if (status === "has") return "avoid-has-items";
  return "avoid-unanswered";
}

export function resolveTextureProfileAsset(stage: FeedingStage): ProfileAssetId {
  const assets: Record<FeedingStage, ProfileAssetId> = {
    puree: "texture-puree",
    "thick-puree": "texture-thick-puree",
    "soft-lumps": "texture-soft-lumps",
    "finger-food": "texture-finger-food",
  };
  return assets[stage];
}

export function ProfileIllustration({ assetId, size, fallback = null, priority = false }: {
  assetId: ProfileAssetId;
  size: "hero" | "state" | "texture";
  fallback?: ReactNode;
  priority?: boolean;
}) {
  const [failedAssetId, setFailedAssetId] = useState<ProfileAssetId | null>(null);
  const reduceMotion = useReducedMotion();
  if (failedAssetId === assetId) return fallback;

  const isTextureAsset = assetId.startsWith("texture-");
  const large = isTextureAsset ? 320 : 640;
  const small = isTextureAsset ? 160 : 320;
  const base = `/illustrations/profile/v1/${assetId}`;
  const displaySize = size === "hero" ? "156px" : size === "state" ? "104px" : "56px";

  return <span className={`profile-illustration profile-${size}`} aria-hidden="true">
    <AnimatePresence initial={false}>
      <motion.picture
        key={assetId}
        initial={reduceMotion ? { opacity: 1 } : { opacity: 0, scale: .985 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={reduceMotion ? { opacity: 0 } : { opacity: 0, scale: .985 }}
        transition={{ duration: reduceMotion ? 0 : .28, ease: "easeInOut" }}
      >
        <source type="image/webp" srcSet={`${base}-${small}.webp ${small}w, ${base}-${large}.webp ${large}w`} sizes={displaySize} />
        {/* Generated transparent assets need a deterministic PNG fallback and custom srcSet. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={`${base}-${large}.png`} width={large} height={large} alt="" loading={priority ? "eager" : "lazy"} fetchPriority={priority ? "high" : undefined} decoding="async" onError={() => setFailedAssetId(assetId)} />
      </motion.picture>
    </AnimatePresence>
  </span>;
}
