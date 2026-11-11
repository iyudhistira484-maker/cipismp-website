import { ImageResponse } from "next/og";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = "CipiSMP Store — rank dan kit per season";

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          background: "#15130f",
          padding: "72px 80px",
          color: "#f5f2ec",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
          <div
            style={{
              width: 56,
              height: 56,
              borderRadius: 14,
              border: "3px solid #e0a34a",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#e0a34a",
              fontSize: 26,
              fontWeight: 700,
            }}
          >
            C
          </div>
          <div style={{ fontSize: 26, letterSpacing: 2, color: "#a69e8f" }}>CIPISMP.MY.ID</div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <div style={{ fontSize: 78, fontWeight: 700, lineHeight: 1.05, letterSpacing: -1.5 }}>
            Rank dan kit yang berlaku sepanjang season.
          </div>
          <div style={{ fontSize: 30, color: "#a69e8f", lineHeight: 1.4 }}>
            Bayar sekali, tanpa langganan, tanpa perpanjangan. Season baru berarti mulai baru.
          </div>
        </div>

        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 24, color: "#a69e8f" }}>
          <span>Java · Bedrock</span>
          <span style={{ color: "#e0a34a" }}>Store resmi CipiSMP</span>
        </div>
      </div>
    ),
    size,
  );
}
