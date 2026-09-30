import { describe, expect, it } from "vitest";
import { passwordChangedEmail, passwordResetEmail, verifyEmailEmail } from "./emails";

const URL = "https://kartly.example.com/verify-email?token=abc123";

describe("email templates", () => {
  it("verify email contains the link and the first name only", () => {
    const mail = verifyEmailEmail("Maarij Bukhari", URL);
    expect(mail.html).toContain(URL);
    expect(mail.text).toContain(URL);
    expect(mail.html).toContain("Hi Maarij,");
    expect(mail.html).not.toContain("Bukhari");
  });

  it("reset email contains the link and no extra personal data", () => {
    const mail = passwordResetEmail("Jane Doe", "https://kartly.example.com/reset-password?token=t");
    expect(mail.text).toContain("https://kartly.example.com/reset-password?token=t");
    expect(mail.html).toContain("Hi Jane,");
    expect(mail.html).not.toContain("Doe");
  });

  it("password changed email has no links to guess accounts", () => {
    const mail = passwordChangedEmail("Jane Doe");
    expect(mail.html).not.toMatch(/https?:\/\/[^"]*token/);
  });
});
