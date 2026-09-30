import { NextResponse, type NextRequest } from "next/server";

export function middleware(request: NextRequest) {
  const nonce = Buffer.from(crypto.randomUUID()).toString("base64");
  const isDev = process.env.NODE_ENV === "development";
  const isCheckout = new URL(request.url).pathname.startsWith("/checkout");
  const stripeSources = isCheckout
    ? [
        "https://js.stripe.com",
      ]
    : [];

  const csp = [
    `default-src 'self'`,
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic' ${isDev ? "'unsafe-eval'" : ""} ${stripeSources.join(" ")}`.trim(),
    `style-src 'self' 'unsafe-inline'`,
    `img-src 'self' data: blob: https:`,
    `font-src 'self'`,
    `connect-src 'self' ${isDev ? "ws: wss:" : ""} ${isCheckout ? "https://api.stripe.com" : ""}`.trim(),
    `frame-src ${isCheckout ? "https://js.stripe.com https://hooks.stripe.com" : "'none'"}`,
    `frame-ancestors 'none'`,
    `object-src 'none'`,
    `base-uri 'self'`,
    `form-action 'self'`,
  ].join("; ");

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);

  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set("Content-Security-Policy", csp);
  return response;
}

export const config = {
  matcher: [
    "/search",
    "/cart",
    "/account/:path*",
    "/admin/:path*",
    "/checkout/:path*",
    "/signup",
    "/login",
    "/forgot-password",
    "/reset-password",
    "/verify-email",
    "/api/:path*",
  ],
};
