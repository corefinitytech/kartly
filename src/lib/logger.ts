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

export const LOGGER_OPTIONS = { redact: { paths: PII_REDACTION_PATHS, censor: "[redacted]" } } as const;

export function createRequestLogger(requestId: string, destination?: pino.DestinationStream) {
  return pino({ ...LOGGER_OPTIONS, base: { requestId } }, destination as pino.DestinationStream);
}

export const logger = pino(LOGGER_OPTIONS);
