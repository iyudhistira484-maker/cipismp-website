import Image from "next/image";

export function BrandScene({ seasonName }: { seasonName?: string | null }) {
  return (
    <div className="brand-scene">
      <span className="brand-scene__glow" aria-hidden="true" />
      <span className="brand-scene__orbit brand-scene__orbit--one" aria-hidden="true" />
      <span className="brand-scene__orbit brand-scene__orbit--two" aria-hidden="true" />
      <div className="brand-scene__cube" aria-hidden="true">
        <span className="brand-scene__cube-face brand-scene__cube-face--front" />
        <span className="brand-scene__cube-face brand-scene__cube-face--side" />
        <span className="brand-scene__cube-face brand-scene__cube-face--top" />
      </div>

      <div className="brand-scene__card surface-card">
        <div className="brand-scene__logo-frame">
          <Image
            src="/images/cipismp-logo.jpeg"
            alt=""
            fill
            sizes="(min-width: 1024px) 104px, 88px"
            className="object-contain"
          />
        </div>
        <div className="brand-scene__copy">
          <p className="eyebrow">Toko resmi</p>
          <h2 className="mt-1 font-display text-2xl font-semibold leading-tight text-ink">CipiSMP</h2>
          <p className="mt-1 text-[13px] text-muted">Server survival · Java &amp; Bedrock</p>
          {seasonName ? (
            <span className="brand-scene__season">
              <span className="brand-scene__season-dot" aria-hidden="true" />
              {seasonName}
            </span>
          ) : null}
        </div>
      </div>
    </div>
  );
}
