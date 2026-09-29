"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Check, Menu, Search, ShoppingCart, User, X } from "lucide-react";
import { usePathname } from "next/navigation";
import { Logo } from "@/components/logo";
import type { CategoryNode } from "@/modules/catalog/types";
import { cn } from "@/lib/utils";

interface Suggestion {
  slug: string;
  title: string;
}

function SearchField({ categories, autoFocus }: { categories: CategoryNode[]; autoFocus?: boolean }) {
  const [q, setQ] = useState("");
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const containerRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (q.trim().length < 2) {
      setSuggestions([]);
      setOpen(false);
      return;
    }
    const timer = setTimeout(async () => {
      try {
        const response = await fetch(`/api/search/suggest?q=${encodeURIComponent(q.trim())}`);
        if (!response.ok) return;
        const body = (await response.json()) as { data?: Suggestion[] };
        setSuggestions(body.data ?? []);
        setOpen(true);
        setActiveIndex(-1);
      } catch {
        setSuggestions([]);
      }
    }, 200);
    return () => clearTimeout(timer);
  }, [q]);

  return (
    <form
      ref={containerRef}
      action="/search"
      role="search"
      className="relative flex h-11 w-full items-stretch rounded-btn border border-lineStrong bg-surface"
      onSubmit={() => setOpen(false)}
    >
      <label htmlFor={`search-category${autoFocus ? "-m" : ""}`} className="sr-only">
        Search in category
      </label>
      <select
        id={`search-category${autoFocus ? "-m" : ""}`}
        name="category"
        className="h-full max-w-28 shrink-0 rounded-l-btn border-r border-lineStrong bg-surface px-2 text-sm text-inkSoft"
        defaultValue=""
      >
        <option value="">All</option>
        {categories.map((c) => (
          <option key={c.slug} value={c.slug}>
            {c.name}
          </option>
        ))}
      </select>
      <label htmlFor={`search-q${autoFocus ? "-m" : ""}`} className="sr-only">
        Search products
      </label>
      <input
        id={`search-q${autoFocus ? "-m" : ""}`}
        name="q"
        type="search"
        autoComplete="off"
        autoFocus={autoFocus}
        value={q}
        onChange={(e) => setQ(e.target.value)}
        onKeyDown={(e) => {
          if (!open || suggestions.length === 0) return;
          if (e.key === "ArrowDown") {
            e.preventDefault();
            setActiveIndex((i) => Math.min(i + 1, suggestions.length - 1));
          } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setActiveIndex((i) => Math.max(i - 1, -1));
          } else if (e.key === "Escape") {
            setOpen(false);
          }
        }}
        placeholder="Search products"
        className="h-full min-w-0 flex-1 bg-surface px-3 text-base text-ink placeholder:text-inkMuted focus-visible:outline-none"
        aria-autocomplete="list"
      />
      <button
        type="submit"
        aria-label="Search"
        className="flex w-11 shrink-0 items-center justify-center rounded-r-btn bg-brand text-white transition-colors duration-150 hover:bg-brandDeep"
      >
        <Search strokeWidth={1.75} className="h-5 w-5" />
      </button>

      {open && suggestions.length > 0 ? (
        <ul
          role="listbox"
          className="absolute left-0 right-0 top-full z-50 mt-1 overflow-hidden rounded-btn border border-line bg-surface shadow-pop"
        >
          {suggestions.map((s, i) => (
            <li key={s.slug} role="option" aria-selected={i === activeIndex}>
              <Link
                href={`/p/${s.slug}`}
                onClick={() => setOpen(false)}
                onMouseEnter={() => setActiveIndex(i)}
                className={cn(
                  "flex items-center gap-2 px-3 py-2 text-sm",
                  i === activeIndex ? "bg-brandTint text-ink" : "text-inkSoft",
                )}
              >
                {i === activeIndex ? (
                  <Check strokeWidth={1.75} className="h-4 w-4 shrink-0" />
                ) : (
                  <Search strokeWidth={1.75} className="h-4 w-4 shrink-0 text-inkMuted" />
                )}
                <span className="truncate">{s.title}</span>
              </Link>
            </li>
          ))}
        </ul>
      ) : null}
    </form>
  );
}

export function SiteHeader({ categories, cartCount = 0 }: { categories: CategoryNode[]; cartCount?: number }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const pathname = usePathname();

  const currentCategory = pathname.startsWith("/c/")
    ? decodeURIComponent(pathname.split("/")[2] ?? "")
    : "";

  return (
    <header className="sticky top-0 z-40">
      <div className="bg-brandDeep text-white">
        <div className="mx-auto flex max-w-7xl items-center gap-3 px-4 lg:px-6">
          <div className="flex h-14 w-full items-center gap-3 lg:hidden">
            <button
              type="button"
              className="flex h-11 w-11 items-center justify-center rounded-btn hover:bg-brand"
              aria-expanded={menuOpen}
              aria-label={menuOpen ? "Close menu" : "Open menu"}
              onClick={() => setMenuOpen((v) => !v)}
            >
              {menuOpen ? <X strokeWidth={1.75} className="h-5 w-5" /> : <Menu strokeWidth={1.75} className="h-5 w-5" />}
            </button>
            <Link href="/" className="mx-auto">
              <Logo onDark />
            </Link>
            <Link href="/cart" aria-label={`Cart, ${cartCount} items`} className="relative flex h-11 w-11 items-center justify-center rounded-btn hover:bg-brand">
              <ShoppingCart strokeWidth={1.75} className="h-5 w-5" />
              {cartCount > 0 ? (
                <span className="absolute right-1 top-1 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-accent px-1 text-xs font-semibold text-white">
                  {cartCount}
                </span>
              ) : null}
            </Link>
          </div>

          <div className="hidden w-full items-center gap-4 py-2 lg:flex">
            <Link href="/" className="shrink-0">
              <Logo onDark />
            </Link>
            <div className="max-w-2xl flex-1">
              <SearchField categories={categories} />
            </div>
            <nav aria-label="Account and cart" className="ml-auto flex shrink-0 items-center gap-1">
              <Link href="/account" className="flex h-11 items-center gap-1.5 rounded-btn px-3 text-sm text-white hover:bg-brand">
                <User strokeWidth={1.75} className="h-5 w-5" />
                Account
              </Link>
              <Link
                href="/cart"
                aria-label={`Cart, ${cartCount} items`}
                className="relative flex h-11 items-center gap-1.5 rounded-btn px-3 text-sm text-white hover:bg-brand"
              >
                <ShoppingCart strokeWidth={1.75} className="h-5 w-5" />
                Cart
                {cartCount > 0 ? (
                  <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-accent px-1 text-xs font-semibold text-white">
                    {cartCount}
                  </span>
                ) : null}
              </Link>
            </nav>
          </div>
        </div>

        <div className="px-4 pb-3 lg:hidden">
          <SearchField categories={categories} />
        </div>
      </div>

      <nav aria-label="Categories" className="hidden border-b border-line bg-canvas lg:block">
        <ul className="mx-auto flex max-w-7xl items-center gap-6 px-6 py-2">
          {categories.slice(0, 10).map((c) => (
            <li key={c.slug}>
              <Link
                href={`/c/${c.slug}`}
                className={cn(
                  "py-1 text-sm text-inkSoft underline-offset-4 hover:text-ink hover:underline",
                  currentCategory === c.slug && "font-medium text-brand underline",
                )}
              >
                {c.name}
              </Link>
            </li>
          ))}
        </ul>
      </nav>

      {menuOpen ? (
        <div className="fixed inset-0 top-0 z-50 flex h-full flex-col bg-canvas lg:hidden">
          <div className="flex items-center justify-between border-b border-line bg-brandDeep px-4 py-1.5 text-white">
            <Logo onDark />
            <button
              type="button"
              onClick={() => setMenuOpen(false)}
              aria-label="Close menu"
              className="flex h-11 w-11 items-center justify-center rounded-btn hover:bg-brand"
            >
              <X strokeWidth={1.75} className="h-5 w-5" />
            </button>
          </div>
          <nav aria-label="All categories" className="flex-1 overflow-y-auto p-4">
            <p className="label-caps mb-2 text-inkMuted">Categories</p>
            <ul className="divide-y divide-line">
              {categories.map((c) => (
                <li key={c.slug}>
                  <Link
                    href={`/c/${c.slug}`}
                    onClick={() => setMenuOpen(false)}
                    className="flex min-h-11 items-center text-base text-ink"
                  >
                    {c.name}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        </div>
      ) : null}
    </header>
  );
}

export { SearchField };
