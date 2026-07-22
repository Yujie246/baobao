"use client";

import { useState, type ReactNode } from "react";

export const foodIds = [
  "avocado", "carrot", "banana", "broccoli", "pumpkin",
  "sweet-potato", "apple", "pear", "corn", "egg",
  "salmon", "tofu", "spinach", "potato", "millet-porridge",
] as const;

export type FoodId = (typeof foodIds)[number];

export function FoodIllustration({ foodId, alt, fallback = null, className = "" }: {
  foodId: FoodId;
  alt: string;
  fallback?: ReactNode;
  className?: string;
}) {
  const [failed, setFailed] = useState(false);
  if (failed) return fallback;
  const base = `/illustrations/foods/v1/${foodId}`;
  return <span className={`food-illustration ${className}`.trim()}>
    <picture>
      <source type="image/webp" srcSet={`${base}-96.webp 96w, ${base}-192.webp 192w`} sizes="84px" />
      <img src={`${base}-192.png`} width="192" height="192" alt={alt} loading="lazy" decoding="async" onError={() => setFailed(true)} />
    </picture>
  </span>;
}
