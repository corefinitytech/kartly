import pino from "pino";
import { randomUUID } from "node:crypto";

export function newRequestId(): string {
  return randomUUID();
}

export const PII_REDACTION_PATHS = [
  "email",
  "*.email",
  "name",
  "*.name",
  "phone",
  "*.phone",
  "address",
  "*.address",
  "password",
  "*.password",
  "token",
  "*.token",
  "card",
  "*.card",
  "cardNumber",
  "*.cardNumber",
  "cvc",
  "*.cvc",
];

export function createRequestLogger(requestId: string) {
  return pino({
    redact: { paths: PII_REDACTION_PATHS, censor: "[redacted]" },
    base: { requestId },
  });
}

export const logger = pino({
  redact: { paths: PII_REDACTION_PATHS, censor: "[redacted]" },
});
