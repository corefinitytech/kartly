import type { Metadata } from "next";
import { Source_Serif_4, Public_Sans } from "next/font/google";
import { cookies } from "next/headers";
import "./globals.css";
import { SiteHeader } from "@/components/layout/site-header";
import { SiteFooter } from "@/components/layout/site-footer";
import { ConsentProvider } from "@/components/consent-provider";
import { ToastProvider } from "@/components/ui/toast";
import { getTopLevelCategories } from "@/modules/catalog/service";
import { CONSENT_COOKIE_NAME, parseConsentCookie } from "@/lib/consent-cookie";

const sourceSerif = Source_Serif_4({
  subsets: ["latin"],
  weight: ["600", "700"],
  variable: "--font-source-serif",
  display: "swap",
});

const publicSans = Public_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-public-sans",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "Kartly",
    template: "%s · Kartly",
  },
  description: "A fast, transparent, privacy first online store.",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const [categories, cookieStore] = await Promise.all([getTopLevelCategories(), cookies()]);
  const consent = parseConsentCookie(cookieStore.get(CONSENT_COOKIE_NAME)?.value);

  return (
    <html lang="en" className={`${sourceSerif.variable} ${publicSans.variable}`}>
      <body className="flex min-h-screen flex-col">
        <ToastProvider>
          <ConsentProvider initial={consent}>
            <SiteHeader categories={categories} cartCount={0} />
            <main className="flex-1">{children}</main>
            <SiteFooter />
          </ConsentProvider>
        </ToastProvider>
      </body>
    </html>
  );
}
