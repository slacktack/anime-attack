import { ImageResponse } from "next/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          background: "linear-gradient(135deg, #ff2d6f 0%, #ff3d5f 55%, #ff8a3d 100%)",
        }}
      >
        <svg width="180" height="180" viewBox="0 0 64 64">
          <path d="M32 11 L50 52 H41.5 L32 29 L22.5 52 H14 Z" fill="#fff" />
          <path d="M17 43 L49 33 L47.5 38.5 L15.5 48.5 Z" fill="#0e0e10" fillOpacity={0.45} />
          <path d="M18.5 40.5 L47 31.5 L45.8 35.5 L17.3 44.5 Z" fill="#fff" />
          <path d="M50 8 l1.6 4.4 4.4 1.6 -4.4 1.6 -1.6 4.4 -1.6 -4.4 -4.4 -1.6 4.4 -1.6 z" fill="#fff" />
        </svg>
      </div>
    ),
    size,
  );
}
