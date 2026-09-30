"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

export function AdminNav({ links, name, role }: { links: { href: string; label: string }[]; name: string; role: string }) {
  const pathname = usePathname();
  return (
    <nav aria-label="Admin" className="min-w-0">
      <p className="text-lg font-semibold">Store admin</p>
      <p className="mb-3 text-sm text-inkSoft">
        {name} · {role === "admin" ? "Admin" : "Support"}
      </p>
      <ul className="flex gap-2 overflow-x-auto pb-2 lg:flex-col lg:overflow-visible lg:pb-0 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {links.map((link) => {
          const current = pathname === link.href || pathname.startsWith(`${link.href}/`);
          return (
            <li key={link.href} className="shrink-0">
              <Link
                href={link.href}
                aria-current={current ? "page" : undefined}
                className={cn(
                  "flex min-h-11 items-center rounded-btn px-3 text-base text-inkSoft underline-offset-4 hover:bg-sunken hover:text-ink hover:underline",
                  current && "bg-brandTint font-medium text-ink",
                )}
              >
                {link.label}
              </Link>
            </li>
          );
        })}
        <li className="shrink-0 lg:mt-4 lg:border-t lg:border-line lg:pt-4">
          <Link href="/" className="flex min-h-11 items-center rounded-btn px-3 text-base text-brandLink underline underline-offset-4">
            Back to store
          </Link>
        </li>
      </ul>
    </nav>
  );
}
