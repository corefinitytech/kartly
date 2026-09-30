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

const button = (url: string, label: string) => `<p style="margin:24px 0;">
  <a href="${url}" style="display:inline-block;padding:12px 24px;background:#C2410C;color:#FFFFFF;text-decoration:none;border-radius:6px;font-weight:600;">${label}</a>
</p>
<p style="font-size:13px;color:#5F6663;">Or paste this link into your browser: <br>${url}</p>`;

export interface RenderedEmail {
  subject: string;
  html: string;
  text: string;
}

export function verifyEmailEmail(name: string, url: string): RenderedEmail {
  const first = name.split(" ")[0] ?? name;
  return {
    subject: "Verify your email",
    html: wrap(`<p>Hi ${escapeHtml(first)},</p>
<p>Confirm your email address to finish setting up your Kartly account. Signing in and shopping work without it.</p>
${button(url, "Verify email")}`),
    text: `Hi ${first},\n\nConfirm your email address to finish setting up your Kartly account. Signing in and shopping work without it.\n\n${url}`,
  };
}

export function passwordResetEmail(name: string, url: string): RenderedEmail {
  const first = name.split(" ")[0] ?? name;
  return {
    subject: "Reset your password",
    html: wrap(`<p>Hi ${escapeHtml(first)},</p>
<p>We received a request to reset your Kartly password. This link works once and expires in 1 hour. If you did not request it, you can ignore this email.</p>
${button(url, "Reset password")}`),
    text: `Hi ${first},\n\nWe received a request to reset your Kartly password. This link works once and expires in 1 hour.\n\n${url}`,
  };
}

export function passwordChangedEmail(name: string): RenderedEmail {
  const first = name.split(" ")[0] ?? name;
  return {
    subject: "Your password was changed",
    html: wrap(`<p>Hi ${escapeHtml(first)},</p>
<p>Your Kartly password was just changed and all other sessions were signed out. If this was not you, reset your password straight away.</p>`),
    text: `Hi ${first},\n\nYour Kartly password was just changed and all other sessions were signed out. If this was not you, reset your password straight away.`,
  };
}

function escapeHtml(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
