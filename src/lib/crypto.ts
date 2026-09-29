import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import { env } from "./env";

const KEY_ID = "v1";

function key(): Buffer {
  return Buffer.from(env.PII_ENC_KEY, "base64");
}

export function encryptPii(plaintext: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(), iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [
    KEY_ID,
    iv.toString("base64url"),
    tag.toString("base64url"),
    encrypted.toString("base64url"),
  ].join(".");
}

export function decryptPii(sealed: string): string {
  const parts = sealed.split(".");
  if (parts.length !== 4) throw new Error("Invalid sealed value");
  const keyId = parts[0]!;
  const ivPart = parts[1]!;
  const tagPart = parts[2]!;
  const dataPart = parts[3]!;
  if (keyId !== KEY_ID) {
    throw new Error(`Unknown PII key version: ${keyId}`);
  }
  const decipher = createDecipheriv(
    "aes-256-gcm",
    key(),
    Buffer.from(ivPart, "base64url"),
  );
  decipher.setAuthTag(Buffer.from(tagPart, "base64url"));
  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(dataPart, "base64url")),
    decipher.final(),
  ]);
  return decrypted.toString("utf8");
}
