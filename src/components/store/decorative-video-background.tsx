"use client";

import { useEffect, useRef, useState } from "react";

/** Decorative video with a local fallback; never loaded when reduced motion is requested. */
export function DecorativeVideoBackground({
  src,
  poster,
  className,
  overlayClassName,
}: {
  src: string;
  poster: string;
  className: string;
  overlayClassName: string;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [enabled, setEnabled] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setEnabled(!motion.matches);
    update();
    motion.addEventListener("change", update);
    return () => motion.removeEventListener("change", update);
  }, []);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    let visible = true;
    const sync = () => {
      if (document.hidden || !visible) video.pause();
      else void video.play().catch(() => { /* The poster remains if autoplay is blocked. */ });
    };
    const observer = new IntersectionObserver(([entry]) => {
      visible = Boolean(entry?.isIntersecting);
      sync();
    });
    observer.observe(video);
    document.addEventListener("visibilitychange", sync);
    sync();
    return () => {
      observer.disconnect();
      document.removeEventListener("visibilitychange", sync);
      video.pause();
    };
  }, [enabled, failed]);

  return (
    <div className={className} aria-hidden="true">
      {enabled && !failed ? (
        <video ref={videoRef} className="absolute inset-0 size-full object-cover" src={src} poster={poster} autoPlay muted loop playsInline preload="metadata" onError={() => setFailed(true)} />
      ) : null}
      <div className={overlayClassName} />
    </div>
  );
}
