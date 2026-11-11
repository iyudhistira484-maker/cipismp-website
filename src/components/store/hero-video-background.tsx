"use client";

import { useEffect, useState } from "react";

const VIDEO_URL = "https://motionbgs.com/media/9360/minecraft-northern-light.960x540.mp4";

/** Decorative landing hero video; don't download or animate it for reduced-motion users. */
export function HeroVideoBackground() {
  const [shouldPlay, setShouldPlay] = useState(false);

  useEffect(() => {
    const preference = window.matchMedia("(prefers-reduced-motion: reduce)");
    const syncPreference = () => setShouldPlay(!preference.matches);
    syncPreference();
    preference.addEventListener("change", syncPreference);
    return () => preference.removeEventListener("change", syncPreference);
  }, []);

  return (
    <div className="landing-hero__media" aria-hidden="true">
      {shouldPlay ? (
        <video
          className="landing-hero__video"
          autoPlay
          muted
          loop
          playsInline
          preload="metadata"
          tabIndex={-1}
          onError={() => setShouldPlay(false)}
        >
          <source src={VIDEO_URL} type="video/mp4" />
        </video>
      ) : null}
    </div>
  );
}
