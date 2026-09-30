import { env } from "./env";
import type { StockStateDto } from "@/modules/catalog/types";

export function absoluteUrl(path: string): string {
  const base = env.APP_URL.replace(/\/$/, "");
  return `${base}${path.startsWith("/") ? path : `/${path}`}`;
}

export function buildCanonical(path: string): string {
  return absoluteUrl(path);
}

export function truncateAtWord(text: string, maxLength: number): string {
  const clean = text.replace(/\s+/g, " ").trim();
  if (clean.length <= maxLength) return clean;
  const cut = clean.slice(0, maxLength);
  const lastSpace = cut.lastIndexOf(" ");
  return (lastSpace > 0 ? cut.slice(0, lastSpace) : cut).trimEnd();
}

export function toSchemaAvailability(stockKind: StockStateDto): string {
  switch (stockKind) {
    case "in":
      return "https://schema.org/InStock";
    case "low":
      return "https://schema.org/LimitedAvailability";
    default:
      return "https://schema.org/OutOfStock";
  }
}

export function escapeJsonLd(value: string): string {
  return value.replace(/</g, "\\u003c");
}
