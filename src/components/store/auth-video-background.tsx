"use client";

import { useEffect, useRef, useState } from "react";

const VIDEO_URL = "https://motionbgs.com/media/2978/minecraft-sunset.960x540.mp4";

/** Decorative video with a local fallback; no video is loaded for reduced motion. */
export function AuthVideoBackground() {
  const video = useRef<HTMLVideoElement>(null);
  const [enabled, setEnabled] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const syncMotion = () => setEnabled(!motion.matches);
    syncMotion();
    motion.addEventListener("change", syncMotion);
    return () => motion.removeEventListener("change", syncMotion);
  }, []);

  useEffect(() => {
    const element = video.current;
    if (!element) return;
    const syncVisibility = () => {
      if (document.hidden) element.pause();
      else void element.play().catch(() => { /* Autoplay may be blocked; keep the visual fallback. */ });
    };
    syncVisibility();
    document.addEventListener("visibilitychange", syncVisibility);
    return () => document.removeEventListener("visibilitychange", syncVisibility);
  }, [enabled, failed]);

  return (
    <div className="auth-scene" aria-hidden="true">
      <div className="auth-scene__visual">
        {enabled && !failed ? (
          <video
            ref={video}
            className="auth-scene__video"
            src={VIDEO_URL}
            autoPlay
            loop
            muted
            playsInline
            preload="metadata"
            onError={() => setFailed(true)}
          />
        ) : null}
      </div>
      <div className="auth-scene__shade" />
    </div>
  );
}
