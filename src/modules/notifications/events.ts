// In-app notification templates (PRD 5.11). Versioned in code: rows store only
// the event key and a small payload (ids, order numbers), never personal data,
// and the words are rendered at read time.
import { formatCents } from "@/lib/money";

export const NOTIFICATION_EVENTS = [
  "order.placed",
  "order.shipped",
  "order.delivered",
  "order.cancelled",
  "refund.issued",
] as const;
export type NotificationEvent = (typeof NOTIFICATION_EVENTS)[number];

export interface NotificationPayload {
  orderNumber?: string;
  reason?: "payment_expired" | "cancelled_by_store";
  amountCents?: number;
  carrier?: string;
}

export interface RenderedNotification {
  title: string;
  body: string;
  href: string | null;
}

export function isNotificationEvent(key: string): key is NotificationEvent {
  return (NOTIFICATION_EVENTS as readonly string[]).includes(key);
}

/** Keep payloads to known, non-personal fields so nothing else is ever stored. */
export function cleanPayload(payload: NotificationPayload): NotificationPayload {
  const out: NotificationPayload = {};
  if (payload.orderNumber && /^[A-Z0-9-]{4,40}$/.test(payload.orderNumber)) out.orderNumber = payload.orderNumber;
  if (payload.reason === "payment_expired" || payload.reason === "cancelled_by_store") out.reason = payload.reason;
  if (typeof payload.amountCents === "number" && Number.isInteger(payload.amountCents) && payload.amountCents >= 0) {
    out.amountCents = payload.amountCents;
  }
  if (payload.carrier) out.carrier = payload.carrier.slice(0, 40);
  return out;
}

export function parsePayload(json: string): NotificationPayload {
  try {
    const raw = JSON.parse(json) as NotificationPayload;
    return raw && typeof raw === "object" ? cleanPayload(raw) : {};
  } catch {
    return {};
  }
}

export function renderNotification(eventKey: string, payload: NotificationPayload): RenderedNotification {
  const order = payload.orderNumber ? `Order ${payload.orderNumber}` : "Your order";
  const href = payload.orderNumber ? `/orders/${payload.orderNumber}` : null;
  switch (eventKey) {
    case "order.placed":
      return { title: `${order} is confirmed`, body: "Payment received. We will let you know when it ships.", href };
    case "order.shipped":
      return {
        title: `${order} has shipped`,
        body: payload.carrier ? `On its way with ${payload.carrier}. Tracking is on the order page.` : "On its way. Tracking is on the order page.",
        href,
      };
    case "order.delivered":
      return { title: `${order} was delivered`, body: "You can now review what you bought.", href };
    case "order.cancelled":
      return {
        title: `${order} was cancelled`,
        body:
          payload.reason === "payment_expired"
            ? "Payment was not completed in time, so nothing was charged."
            : "Any payment is refunded to your card.",
        href,
      };
    case "refund.issued":
      return {
        title: `Refund for ${order.toLowerCase().startsWith("your") ? "your order" : order}`,
        body:
          payload.amountCents !== undefined
            ? `${formatCents(payload.amountCents)} is on its way back to your card. Banks take 5 to 10 days.`
            : "A refund is on its way back to your card. Banks take 5 to 10 days.",
        href,
      };
    default:
      return { title: "Update", body: "Something changed on your account.", href: null };
  }
}
