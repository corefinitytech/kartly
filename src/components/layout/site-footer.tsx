"use client";

import Link from "next/link";
import { Logo } from "@/components/logo";
import { useConsent } from "@/components/consent-provider";
import { categoryDisplayName } from "@/modules/catalog/category-names";

const HELP_LINKS = [
  { href: "/faq", label: "FAQ" },
  { href: "/contact", label: "Contact" },
  { href: "/returns", label: "Returns policy" },
];

const LEGAL_LINKS = [
  { href: "/terms", label: "Terms" },
  { href: "/privacy", label: "Privacy policy" },
  { href: "/cookies", label: "Cookie policy" },
];

function FooterColumn({ title, links }: { title: string; links: { href: string; label: string }[] }) {
  return (
    <div>
      <h2 className="label-caps mb-3 text-white/70">{title}</h2>
      <ul className="space-y-1">
        {links.map((link) => (
          <li key={`${title}-${link.href}-${link.label}`}>
            <Link href={link.href} className="inline-block py-1 text-sm text-white underline-offset-4 hover:underline">
              {link.label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function SiteFooter({ categories }: { categories: { slug: string }[] }) {
  const { openSettings } = useConsent();

  return (
    <footer className="mt-16 bg-brandDeep text-white">
      <div className="mx-auto max-w-7xl px-4 py-10 lg:px-6">
        <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
          <div>
            <Logo onDark />
            <p className="mt-3 max-w-xs text-sm text-white/80">
              Prices are shown in full, including shipping and tax, before you check out. There are no sponsored
              results.
            </p>
          </div>
          <FooterColumn
            title="Shop"
            links={[
              { href: "/search", label: "All products" },
              ...categories.slice(0, 5).map((c) => ({
                href: `/c/${c.slug}`,
                label: categoryDisplayName(c.slug),
              })),
            ]}
          />
          <div className="grid gap-8">
            <FooterColumn title="Help" links={HELP_LINKS} />
            <div>
              <h2 className="label-caps mb-3 text-white/70">Legal</h2>
              <ul className="space-y-1">
                {LEGAL_LINKS.map((link) => (
                  <li key={link.href}>
                    <Link href={link.href} className="inline-block py-1 text-sm text-white underline-offset-4 hover:underline">
                      {link.label}
                    </Link>
                  </li>
                ))}
                <li>
                  <button
                    type="button"
                    onClick={openSettings}
                    className="py-1 text-sm text-white underline underline-offset-4"
                  >
                    Cookie settings
                  </button>
                </li>
              </ul>
            </div>
          </div>
        </div>
        <div className="mt-10 border-t border-white/20 pt-4 text-center text-xs text-white/70">
          Kartly. GDPR ready by design.
        </div>
      </div>
    </footer>
  );
}
