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
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: "#0E3F3D",
          color: "#FFFFFF",
          fontSize: 110,
          fontWeight: 700,
        }}
      >
        <div style={{ display: "flex", alignItems: "center" }}>
          k
          <div style={{ width: 14, height: 14, backgroundColor: "#C2410C", marginLeft: 4, marginTop: 40 }} />
        </div>
      </div>
    ),
    size,
  );
}
