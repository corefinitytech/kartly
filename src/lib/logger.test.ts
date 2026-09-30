import { Writable } from "node:stream";
import { describe, expect, it } from "vitest";
import { createRequestLogger } from "./logger";

function capture() {
  const lines: string[] = [];
  const stream = new Writable({
    write(chunk, _enc, done) {
      lines.push(String(chunk));
      done();
    },
  });
  return { lines, stream };
}

// AC-11: log output never contains email, name, address, phone, token or card data.
describe("logger PII redaction", () => {
  it("redacts personal fields at the top level and one level down", () => {
    const { lines, stream } = capture();
    const log = createRequestLogger("req-1", stream);
    log.info(
      {
        email: "jane@example.com",
        name: "Jane Doe",
        phone: "+15551234567",
        address: "1 Main St",
        password: "hunter2hunter2",
        token: "tok_secret",
        user: { email: "jane@example.com", name: "Jane Doe" },
        payment: { card: "4242424242424242", cvc: "123" },
        orderId: "0190f5b2-7c3e-7d4a-9b1c-2d3e4f5a6b7c",
      },
      "checkout step",
    );
    const out = lines.join("");
    for (const secret of ["jane@example.com", "Jane Doe", "+15551234567", "1 Main St", "hunter2hunter2", "tok_secret", "4242424242424242"]) {
      expect(out).not.toContain(secret);
    }
    expect(out).toContain("[redacted]");
    expect(out).toContain("0190f5b2-7c3e-7d4a-9b1c-2d3e4f5a6b7c"); // ids are fine
    expect(out).toContain("req-1");
  });
});
