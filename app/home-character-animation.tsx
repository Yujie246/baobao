"use client";

import { DotLottieReact, setWasmUrl, type DotLottie } from "@lottiefiles/dotlottie-react";
import { useReducedMotion } from "motion/react";
import { useEffect, useState } from "react";
import { CharacterIllustration } from "./character-illustrations";

setWasmUrl("/vendor/dotlottie-player.wasm");

export function HomeCharacterAnimation() {
  const reduceMotion = useReducedMotion();
  const [player, setPlayer] = useState<DotLottie | null>(null);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!player) return;
    const handleLoad = () => setReady(true);
    const handleError = () => setFailed(true);
    if (player.isLoaded) handleLoad();
    player.addEventListener("load", handleLoad);
    player.addEventListener("loadError", handleError);
    player.addEventListener("renderError", handleError);
    return () => {
      player.removeEventListener("load", handleLoad);
      player.removeEventListener("loadError", handleError);
      player.removeEventListener("renderError", handleError);
    };
  }, [player]);

  return (
    <span className={`home-character-motion ${ready && !failed ? "is-ready" : ""}`}>
      <CharacterIllustration intent="welcome" size="support" animate={false} priority className="home-character-poster" />
      {!reduceMotion && !failed && <DotLottieReact className="home-character-canvas" src="/illustrations/ip/v2/home-chick.json" autoplay loop useFrameInterpolation={false} renderConfig={{ autoResize: true }} dotLottieRefCallback={setPlayer} aria-hidden="true" />}
    </span>
  );
}
