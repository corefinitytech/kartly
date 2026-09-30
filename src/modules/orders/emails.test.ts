import { describe, expect, it } from "vitest";
import { orderUpdateEmail } from "./emails";

const base = { number: "KT-20260930-ABCDE", orderUrl: "https://kartly.test/orders/KT-20260930-ABCDE" };

describe("orderUpdateEmail", () => {
  it("includes carrier and tracking when shipped", () => {
    const mail = orderUpdateEmail("shipped", { ...base, carrier: "DHL", trackingNumber: "JD0146" });
    expect(mail.subject).toBe("Order KT-20260930-ABCDE has shipped");
    expect(mail.html).toContain("DHL");
    expect(mail.text).toContain("JD0146");
  });

  it("formats refund amounts from cents", () => {
    expect(orderUpdateEmail("refunded", { ...base, amountCents: 1999 }).text).toContain("$19.99");
  });

  it("escapes admin-entered text in HTML", () => {
    const mail = orderUpdateEmail("cancelled", { ...base, reason: "<script>x</script>" });
    expect(mail.html).not.toContain("<script>");
    expect(mail.html).toContain("&lt;script&gt;");
    expect(mail.text).toContain("<script>x</script>"); // plain text is not HTML
  });
});
