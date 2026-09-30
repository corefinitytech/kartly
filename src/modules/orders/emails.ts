const wrap = (body: string) => `<!doctype html>
<html lang="en">
<body style="margin:0;padding:24px;background:#F6F4EF;font-family:Georgia,'Times New Roman',serif;color:#1B1F1E;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
    <tr><td align="center">
      <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;background:#FFFFFF;border:1px solid #DDD8CE;border-radius:8px;">
        <tr><td style="padding:32px 40px 8px;font-size:24px;font-weight:700;">kartly<span style="color:#C2410C;">.</span></td></tr>
        <tr><td style="padding:8px 40px 32px;font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.5;color:#4F5754;">
${body}
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

export interface OrderEmailData {
  number: string;
  contactEmail: string;
  totalCents: number;
  lines: { title: string; quantity: number; unitPriceCents: number }[];
  shippingMethod: string | null;
  orderUrl: string;
}

const money = (cents: number) => `$${(cents / 100).toFixed(2)}`;

export function orderConfirmationEmail(order: OrderEmailData): { subject: string; html: string; text: string } {
  const itemRows = order.lines
    .map(
      (line) =>
        `<tr><td style="padding:4px 0;">${escapeHtml(line.title)} × ${line.quantity}</td><td align="right" style="padding:4px 0;">${money(line.unitPriceCents * line.quantity)}</td></tr>`,
    )
    .join("");
  const body = `<p>Thank you for your order.</p>
<p><strong>Order ${escapeHtml(order.number)}</strong></p>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0">${itemRows}
<tr><td style="padding:8px 0;border-top:1px solid #DDD8CE;"><strong>Total</strong></td><td align="right" style="padding:8px 0;border-top:1px solid #DDD8CE;"><strong>${money(order.totalCents)}</strong></td></tr></table>
<p>Shipping: ${escapeHtml(order.shippingMethod ?? "Standard")}</p>
<p style="margin:24px 0;">
  <a href="${order.orderUrl}" style="display:inline-block;padding:12px 24px;background:#C2410C;color:#FFFFFF;text-decoration:none;border-radius:6px;font-weight:600;">View your order</a>
</p>
<p style="font-size:13px;color:#5F6663;">Or paste this link into your browser: <br>${order.orderUrl}</p>`;
  const text = `Thank you for your order.\n\nOrder ${order.number}\n${order.lines
    .map((l) => `${l.title} x ${l.quantity} - ${money(l.unitPriceCents * l.quantity)}`)
    .join("\n")}\nTotal: ${money(order.totalCents)}\nShipping: ${order.shippingMethod ?? "Standard"}\n\n${order.orderUrl}`;
  return { subject: `Order ${order.number} confirmed`, html: wrap(body), text };
}

export type OrderUpdateKind = "shipped" | "delivered" | "cancelled" | "refunded";

export interface OrderUpdateEmailData {
  number: string;
  orderUrl: string;
  carrier?: string;
  trackingNumber?: string;
  amountCents?: number;
  reason?: string;
}

/** Status emails for FR-NTF-02: order number, what changed, a link. No address or card data. */
export function orderUpdateEmail(kind: OrderUpdateKind, data: OrderUpdateEmailData): { subject: string; html: string; text: string } {
  const n = escapeHtml(data.number);
  const lines: Record<OrderUpdateKind, { subject: string; body: string[] }> = {
    shipped: {
      subject: `Order ${data.number} has shipped`,
      body: [
        `Your order ${n} is on its way.`,
        `Carrier: ${escapeHtml(data.carrier ?? "")}. Tracking number: ${escapeHtml(data.trackingNumber ?? "")}.`,
      ],
    },
    delivered: {
      subject: `Order ${data.number} was delivered`,
      body: [`Your order ${n} has been delivered.`, "If anything is wrong with it, reply through the contact page."],
    },
    cancelled: {
      subject: `Order ${data.number} was cancelled`,
      body: [
        `Your order ${n} has been cancelled${data.reason ? `: ${escapeHtml(data.reason)}` : "."}`,
        "If you were charged, the full amount is being refunded to your card. Refunds usually appear within 5 to 10 business days.",
      ],
    },
    refunded: {
      subject: `Refund for order ${data.number}`,
      body: [
        `We have refunded ${money(data.amountCents ?? 0)} for order ${n}.`,
        "It usually appears on your card statement within 5 to 10 business days.",
      ],
    },
  };
  const { subject, body } = lines[kind];
  const html = `${body.map((p) => `<p>${p}</p>`).join("\n")}
<p style="margin:24px 0;">
  <a href="${data.orderUrl}" style="display:inline-block;padding:12px 24px;background:#0F4C4A;color:#FFFFFF;text-decoration:none;border-radius:6px;font-weight:600;">View your order</a>
</p>`;
  const text = `${body.map((p) => p.replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"')).join("\n\n")}\n\n${data.orderUrl}`;
  return { subject, html: wrap(html), text };
}

function escapeHtml(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
