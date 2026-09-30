import { Resend } from "resend";
import { env } from "./env";
import { logger } from "./logger";

export interface MailPayload {
  to: string;
  subject: string;
  html: string;
  text: string;
}

export interface MailResult {
  success: boolean;
}

export async function sendMail(payload: MailPayload): Promise<MailResult> {
  if (!env.RESEND_API_KEY || !env.EMAIL_FROM) {
    logger.warn({ to: "redacted", subject: payload.subject }, "email skipped: Resend not configured");
    return { success: false };
  }
  try {
    const resend = new Resend(env.RESEND_API_KEY);
    const result = await resend.emails.send({
      from: env.EMAIL_FROM,
      to: payload.to,
      subject: payload.subject,
      html: payload.html,
      text: payload.text,
    });
    if (result.error) {
      // Resend's error name (e.g. validation_error) says why; its message can contain addresses, so it is not logged.
      logger.error({ subject: payload.subject, reason: result.error.name }, "email send failed");
      return { success: false };
    }
    return { success: true };
  } catch {
    logger.error({ subject: payload.subject }, "email send threw");
    return { success: false };
  }
}
