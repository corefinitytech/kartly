import type { Metadata, Viewport } from "next";
import { Source_Serif_4, Public_Sans } from "next/font/google";
import "./globals.css";
import { SiteHeader } from "@/components/layout/site-header";
import { SiteFooter } from "@/components/layout/site-footer";
import { ConsentProvider } from "@/components/consent-provider";
import { CartProvider } from "@/components/cart/cart-store";
import { ToastProvider } from "@/components/ui/toast";
import { getTopLevelCategories } from "@/modules/catalog/service";
import { env } from "@/lib/env";

const sourceSerif = Source_Serif_4({
  subsets: ["latin"],
  weight: ["600", "700"],
  variable: "--font-source-serif",
  display: "swap",
});

const publicSans = Public_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-public-sans",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(env.APP_URL),
  title: {
    default: "Kartly: plain prices, no sponsored results",
    template: "%s | Kartly",
  },
  description:
    "A transparent online store: search, compare and buy with the full cost, shipping and tax included, shown before you check out. No ads, no sponsored results.",
  applicationName: "Kartly",
  icons: {
    icon: [{ url: "/icon.svg", type: "image/svg+xml" }],
    apple: [{ url: "/apple-icon", type: "image/png" }],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: { "max-image-preview": "large", index: true, follow: true },
  },
  openGraph: {
    siteName: "Kartly",
    locale: "en_US",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
  },
};

export const viewport: Viewport = {
  themeColor: "#0E3F3D",
  width: "device-width",
  initialScale: 1,
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const categories = await getTopLevelCategories();

  return (
    <html lang="en" className={`${sourceSerif.variable} ${publicSans.variable}`}>
      <head>
        <link rel="preconnect" href="https://cdn.dummyjson.com" />
      </head>
      <body className="flex min-h-screen flex-col">
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-[70] focus:rounded-btn focus:bg-surface focus:px-4 focus:py-2 focus:text-base focus:text-ink"
        >
          Skip to content
        </a>
        <ToastProvider>
          <CartProvider>
            <ConsentProvider>
              <SiteHeader categories={categories} />
              <main id="main-content" className="flex-1">
                {children}
              </main>
              <SiteFooter categories={categories} />
            </ConsentProvider>
          </CartProvider>
        </ToastProvider>
      </body>
    </html>
  );
}
