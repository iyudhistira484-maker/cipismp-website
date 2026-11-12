import type { ReactElement } from "react";

const ACCENT_HEX: Record<string, string> = {
  star: "#a63771",
  milk: "#8c526f",
  pop: "#a63771",
  cute: "#694a96",
  iron: "#5c5e68",
  gold: "#8f5b18",
  diamond: "#2f7777",
  amber: "#a63771",
};

/** Token accent produk → warna hex untuk render OG. */
export function accentHex(token: string | null | undefined): string {
  return ACCENT_HEX[token ?? "amber"] ?? ACCENT_HEX.amber!;
}

export const OG_SIZE = { width: 1200, height: 630 };
export const OG_CONTENT_TYPE = "image/png";

interface ProductOgInput {
  name: string;
  type: "RANK" | "KIT";
  tagline: string | null;
  priceLabel: string;
  accent: string;
  seasonLabel: string;
  perks: string[];
}

/** Elemen OG bersama untuk halaman detail rank & kit (dipakai ImageResponse). */
export function productOgElement({ name, type, tagline, priceLabel, accent, seasonLabel, perks }: ProductOgInput): ReactElement {
  const eyebrow = type === "RANK" ? "RANK" : "KIT";
  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        background: "#fefbfd",
        padding: "64px 72px",
        color: "#342732",
        fontFamily: "sans-serif",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <div
            style={{
              width: 52,
              height: 52,
              borderRadius: 13,
              border: `3px solid ${accent}`,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: accent,
              fontSize: 24,
              fontWeight: 700,
            }}
          >
            C
          </div>
          <div style={{ fontSize: 24, letterSpacing: 2, color: "#695865" }}>CIPISMP.MY.ID</div>
        </div>
        <div
          style={{
            padding: "10px 20px",
            borderRadius: 999,
            border: `2px solid ${accent}`,
            color: accent,
            fontSize: 20,
            letterSpacing: 3,
          }}
        >
          {eyebrow}
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
        <div style={{ fontSize: 84, fontWeight: 700, lineHeight: 1.02, letterSpacing: -2 }}>{name}</div>
        <div style={{ fontSize: 30, color: "#695865", lineHeight: 1.35, maxWidth: 900 }}>
          {tagline ?? "Berlaku sepanjang season, tanpa perpanjangan."}
        </div>
        {perks.length > 0 ? (
          <div style={{ display: "flex", gap: 14, flexWrap: "wrap", marginTop: 6 }}>
            {perks.slice(0, 3).map((perk) => (
              <div
                key={perk}
                style={{
                  padding: "10px 18px",
                  borderRadius: 10,
                  background: "#fff7fb",
                  border: "1px solid #eddde7",
                  color: "#695865",
                  fontSize: 22,
                }}
              >
                {perk}
              </div>
            ))}
          </div>
        ) : null}
      </div>

      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <div style={{ fontSize: 20, color: "#85727f", letterSpacing: 1 }}>MULAI DARI</div>
          <div style={{ fontSize: 46, fontWeight: 700, color: accent }}>{priceLabel}</div>
        </div>
        <div style={{ fontSize: 22, color: "#695865", textAlign: "right" }}>{seasonLabel}</div>
      </div>
    </div>
  );
}

export function fallbackOgElement(title: string): ReactElement {
  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        gap: 18,
        background: "#fefbfd",
        padding: "72px 80px",
        color: "#342732",
        fontFamily: "sans-serif",
      }}
    >
      <div style={{ fontSize: 24, letterSpacing: 2, color: "#695865" }}>CIPISMP.MY.ID</div>
      <div style={{ fontSize: 76, fontWeight: 700, lineHeight: 1.05 }}>{title}</div>
      <div style={{ fontSize: 28, color: "#695865" }}>Rank dan kit per season · Java & Bedrock</div>
    </div>
  );
}
