import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "Footgolf";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OgImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          background: "linear-gradient(160deg, #031014 0%, #06241f 55%, #052a3a 100%)",
          fontFamily: "sans-serif",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 20,
            padding: "10px 26px",
            borderRadius: 999,
            border: "2px solid rgba(52,211,153,0.4)",
            background: "rgba(16,185,129,0.12)",
            color: "#6ee7b7",
            fontSize: 26,
            fontWeight: 700,
            letterSpacing: 4,
            textTransform: "uppercase",
          }}
        >
          ⛳ Arkádový golf
        </div>
        <div
          style={{
            marginTop: 34,
            fontSize: 148,
            fontWeight: 900,
            letterSpacing: -4,
            backgroundImage: "linear-gradient(90deg, #6ee7b7 0%, #99f6e4 45%, #7dd3fc 100%)",
            backgroundClip: "text",
            color: "transparent",
            display: "flex",
          }}
        >
          Footgolf
        </div>
        <div style={{ marginTop: 18, fontSize: 32, color: "rgba(255,255,255,0.75)", display: "flex" }}>
          Realistická fyzika · kopce · voda · tri jamky
        </div>
      </div>
    ),
    { ...size }
  );
}
