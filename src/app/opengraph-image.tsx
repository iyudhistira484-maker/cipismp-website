import { ImageResponse } from "next/og";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = "Toko resmi CipiSMP — rank dan kit survival untuk Java dan Bedrock";

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
          background: "#fefbfd",
          padding: "68px 80px",
          color: "#342732",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <div
            style={{
              width: 54,
              height: 54,
              borderRadius: 14,
              border: "2px solid #eddde7",
              background: "#fff7fb",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#a02b64",
              fontSize: 25,
              fontWeight: 700,
            }}
          >
            C
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
            <span style={{ fontSize: 25, fontWeight: 700 }}>CipiSMP Store</span>
            <span style={{ fontSize: 15, color: "#695865", letterSpacing: 1 }}>TOKO RESMI SERVER SURVIVAL</span>
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          <div style={{ fontSize: 70, fontWeight: 700, lineHeight: 1.06, letterSpacing: -1.2 }}>
            Rank dan kit untuk server survival CipiSMP.
          </div>
          <div style={{ fontSize: 27, color: "#695865", lineHeight: 1.35 }}>
            Informasi harga, masa aktif, dan isi tersedia sebelum checkout.
          </div>
        </div>

        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            borderTop: "1px solid #eddde7",
            paddingTop: 20,
            fontSize: 20,
            color: "#695865",
          }}
        >
          <span>Java Edition · Bedrock Edition</span>
          <span style={{ color: "#a02b64", fontWeight: 600 }}>cipismp.my.id</span>
        </div>
      </div>
    ),
    size,
  );
}
