import { ImageResponse } from "next/og";

export const alt = "Kartly: plain prices, no sponsored results";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          alignItems: "flex-start",
          padding: "80px",
          backgroundColor: "#F6F4EF",
          color: "#1B1F1E",
        }}
      >
        <div style={{ display: "flex", alignItems: "flex-end", fontSize: 120, fontWeight: 700, lineHeight: 1 }}>
          kartly
          <div style={{ width: 18, height: 18, backgroundColor: "#C2410C", marginLeft: 8, marginBottom: 18 }} />
        </div>
        <div style={{ fontSize: 44, color: "#4F5754", marginTop: 32 }}>
          Plain prices. No sponsored results.
        </div>
        <div style={{ width: 240, height: 8, backgroundColor: "#0F4C4A", marginTop: 48 }} />
      </div>
    ),
    size,
  );
}
