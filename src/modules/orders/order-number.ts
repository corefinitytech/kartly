import { randomInt } from "node:crypto";

const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export function orderNumberRandomPart(length = 5): string {
  return Array.from({ length }, () => ALPHABET[randomInt(ALPHABET.length)]).join("");
}

export function generateOrderNumber(date = new Date()): string {
  const day = date.toISOString().slice(0, 10).replace(/-/g, "");
  return `KT-${day}-${orderNumberRandomPart()}`;
}
