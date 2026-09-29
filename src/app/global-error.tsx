"use client";

export default function GlobalError({ reset }: { error: Error; reset: () => void }) {
  return (
    <html lang="en">
      <body
        style={{
          fontFamily: "system-ui, sans-serif",
          display: "flex",
          minHeight: "100vh",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: "1rem",
          margin: 0,
          background: "#F6F4EF",
          color: "#1B1F1E",
        }}
      >
        <h1 style={{ fontSize: "1.5rem", fontWeight: 600 }}>Kartly is unavailable</h1>
        <p style={{ color: "#4F5754" }}>An unexpected error occurred. Please try again.</p>
        <button
          type="button"
          onClick={reset}
          style={{
            padding: "0.5rem 1rem",
            minHeight: "44px",
            borderRadius: "6px",
            background: "#0F4C4A",
            color: "#fff",
            fontSize: "1rem",
            border: "none",
            cursor: "pointer",
          }}
        >
          Try again
        </button>
      </body>
    </html>
  );
}
