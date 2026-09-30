"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Check, ChevronDown, Lock, Menu, Search, ShoppingCart, User, X } from "lucide-react";
import { usePathname } from "next/navigation";
import { Logo } from "@/components/logo";
import { categoryDisplayName } from "@/modules/catalog/category-names";
import type { CategoryWithCount } from "@/modules/catalog/service";
import { useBump } from "@/components/use-bump";
import { useCart } from "@/components/cart/cart-store";
import { useSession } from "@/lib/auth-client";
import { NotificationBell } from "@/components/notifications/bell";
import { cn } from "@/lib/utils";

interface Suggestion {
  slug: string;
  title: string;
}

function SearchField({ categories, idSuffix }: { categories: CategoryWithCount[]; idSuffix: string }) {
  const [q, setQ] = useState("");
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);

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
      action="/search"
      role="search"
      className="relative flex h-11 w-full items-stretch rounded-btn border border-lineStrong bg-surface transition-theme focus-within:border-brand"
      onSubmit={() => setOpen(false)}
    >
      <label htmlFor={`search-category-${idSuffix}`} className="sr-only">
        Search in category
      </label>
      <select
        id={`search-category-${idSuffix}`}
        name="category"
        className="h-full max-w-28 shrink-0 rounded-l-btn border-r border-lineStrong bg-surface px-2 text-sm text-inkSoft"
        defaultValue=""
      >
        <option value="">All</option>
        {categories.map((c) => (
          <option key={c.slug} value={c.slug}>
            {categoryDisplayName(c.slug)}
          </option>
        ))}
      </select>
      <label htmlFor={`search-q-${idSuffix}`} className="sr-only">
        Search products
      </label>
      <input
        id={`search-q-${idSuffix}`}
        name="q"
        type="search"
        autoComplete="off"
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
        className="flex w-11 shrink-0 items-center justify-center rounded-r-btn bg-brand text-white hover:bg-brandDeep"
      >
        <Search strokeWidth={1.75} className="h-5 w-5" />
      </button>

      {open && suggestions.length > 0 ? (
        <ul
          role="listbox"
          className="anim-dropdown-in absolute left-0 right-0 top-full z-50 mt-1 overflow-hidden rounded-btn border border-line bg-surface shadow-pop"
        >
          {suggestions.map((s, i) => (
            <li key={s.slug} role="option" aria-selected={i === activeIndex}>
              <Link
                href={`/p/${s.slug}`}
                onClick={() => setOpen(false)}
                onMouseEnter={() => setActiveIndex(i)}
                className={cn(
                  "flex items-center gap-2 px-3 py-2 text-sm transition-theme",
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

function CategoryStripLink({
  category,
  current,
}: {
  category: CategoryWithCount;
  current: string;
}) {
  const isCurrent = current === category.slug;
  return (
    <Link
      href={`/c/${category.slug}`}
      aria-current={isCurrent ? "page" : undefined}
      className={cn(
        "relative shrink-0 py-2 text-sm text-inkSoft underline-offset-4 hover:text-ink",
        "after:absolute after:inset-x-0 after:bottom-0 after:h-[2px] after:origin-left after:scale-x-0 after:bg-brand after:content-[''] after:transition-transform after:duration-[180ms] after:ease-[cubic-bezier(0.2,0,0,1)] hover:after:scale-x-100",
        isCurrent && "font-medium text-brand after:scale-x-100",
      )}
    >
      {categoryDisplayName(category.slug)}
    </Link>
  );
}

function CategoryStrip({ categories }: { categories: CategoryWithCount[] }) {
  const pathname = usePathname();
  const currentCategory = pathname.startsWith("/c/")
    ? decodeURIComponent(pathname.split("/")[2] ?? "")
    : "";
  const [moreOpen, setMoreOpen] = useState(false);
  const visible = categories.slice(0, 8);
  const rest = categories.slice(8);

  return (
    <nav aria-label="Categories" className="hidden border-b border-line bg-canvas lg:block">
      <div className="mx-auto flex max-w-7xl items-center gap-6 px-6">
        <div className="flex flex-1 items-center gap-6 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {visible.map((c) => (
            <CategoryStripLink key={c.slug} category={c} current={currentCategory} />
          ))}
        </div>
        {rest.length > 0 ? (
          <div className="relative shrink-0">
            <button
              type="button"
              aria-expanded={moreOpen}
              onClick={() => setMoreOpen((v) => !v)}
              className="relative z-10 flex min-h-11 items-center gap-1 py-2 text-sm text-inkSoft hover:text-ink"
            >
              More
              <ChevronDown strokeWidth={1.75} className="h-4 w-4" />
            </button>
            {moreOpen ? (
              <ul
                onBlur={(e) => {
                  if (!e.currentTarget.contains(e.relatedTarget as Node)) setMoreOpen(false);
                }}
                className="anim-dropdown-in absolute right-0 top-full z-50 mt-1 w-56 overflow-hidden rounded-btn border border-line bg-surface py-1 shadow-pop"
              >
                {rest.map((c) => (
                  <li key={c.slug}>
                    <Link
                      href={`/c/${c.slug}`}
                      onClick={() => setMoreOpen(false)}
                      className="block px-3 py-2 text-sm text-inkSoft hover:bg-brandTint hover:text-ink"
                    >
                      {categoryDisplayName(c.slug)}
                    </Link>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        ) : null}
      </div>
    </nav>
  );
}

export function SiteHeader({ categories }: { categories: CategoryWithCount[] }) {
  const { data: sessionData } = useSession();
  const session = sessionData ?? null;
  const [menuOpen, setMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const pathname = usePathname();
  const menuRef = useRef<HTMLDivElement>(null);
  const { count: cartCount } = useCart();
  const bumping = useBump(cartCount ?? 0);

  const isCheckout = pathname.startsWith("/checkout");

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => setMenuOpen(false), [pathname]);

  useEffect(() => {
    if (!menuOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMenuOpen(false);
    };
    document.addEventListener("keydown", onKeyDown);
    menuRef.current?.querySelector<HTMLElement>("a, button")?.focus();
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [menuOpen]);

  if (isCheckout) {
    return (
      <header className="sticky top-0 z-40 border-b border-line bg-brandDeep text-white">
        <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4 lg:px-6">
          <Link href="/">
            <Logo onDark />
          </Link>
          <p className="flex items-center gap-1.5 text-sm">
            <Lock strokeWidth={1.75} className="h-4 w-4" aria-hidden="true" />
            Secure checkout
          </p>
          <Link href="/cart" className="text-sm text-white underline underline-offset-4">
            Cart
          </Link>
        </div>
      </header>
    );
  }

  return (
    <header
      className={cn(
        "sticky top-0 z-40 transition-shadow duration-[180ms] ease-[cubic-bezier(0.2,0,0,1)]",
        scrolled && "shadow-[0_1px_0_0_#DDD8CE]",
      )}
    >
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
            <NotificationBell />
            <Link
              href="/cart"
              aria-label={`Cart, ${cartCount} items`}
              className="relative flex h-11 w-11 items-center justify-center rounded-btn hover:bg-brand"
            >
              <ShoppingCart strokeWidth={1.75} className="h-5 w-5" />
              {cartCount !== null && cartCount > 0 ? (
                <span
                  className={cn(
                    "absolute right-1 top-1 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-accent px-1 text-xs font-semibold text-white",
                    bumping && "anim-bump",
                  )}
                >
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
              <SearchField categories={categories} idSuffix="d" />
            </div>
            <nav aria-label="Account and cart" className="ml-auto flex shrink-0 items-center gap-1">
              <Link
                href={session ? "/account" : "/login"}
                className="flex h-11 w-[110px] items-center justify-center gap-1.5 rounded-btn px-3 text-sm text-white hover:bg-brand"
              >
                <User strokeWidth={1.75} className="h-5 w-5" />
                {session === undefined ? "" : session ? session.user.name.split(" ")[0] ?? "Account" : "Sign in"}
              </Link>
              <NotificationBell />
              <Link
                href="/cart"
                aria-label={`Cart, ${cartCount} items`}
                className="relative flex h-11 items-center gap-1.5 rounded-btn px-3 text-sm text-white hover:bg-brand"
              >
                <ShoppingCart strokeWidth={1.75} className="h-5 w-5" />
                Cart
                {cartCount !== null && cartCount > 0 ? (
                  <span
                    className={cn(
                      "inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-accent px-1 text-xs font-semibold text-white",
                      bumping && "anim-bump",
                    )}
                  >
                    {cartCount}
                  </span>
                ) : null}
              </Link>
            </nav>
          </div>
        </div>

        <div className="px-4 pb-3 lg:hidden">
          <SearchField categories={categories} idSuffix="m" />
        </div>
      </div>

      <CategoryStrip categories={categories} />

      <div className="relative border-b border-line bg-canvas lg:hidden">
        <div className="flex items-center gap-5 overflow-x-auto px-4 py-2 [scrollbar-width:none] [mask-image:linear-gradient(to_right,black_calc(100%-24px),transparent)] [&::-webkit-scrollbar]:hidden">
          {categories.map((c) => (
            <CategoryStripLink key={c.slug} category={c} current="" />
          ))}
        </div>
      </div>

      {menuOpen ? (
        <div
          ref={menuRef}
          className="anim-sheet-in safe-bottom fixed inset-0 top-0 z-50 flex h-full flex-col bg-canvas lg:hidden"
        >
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
            <Link
              href={session ? "/account" : "/login"}
              className="mb-4 flex min-h-11 items-center rounded-btn bg-brandTint px-3 text-base font-medium text-ink"
            >
              {session ? session.user.name.split(" ")[0] ?? "Account" : "Sign in"}
            </Link>
            <p className="label-caps mb-2 text-inkMuted">Categories</p>
            <ul className="divide-y divide-line">
              {categories.map((c) => (
                <li key={c.slug}>
                  <Link href={`/c/${c.slug}`} className="flex min-h-11 items-center text-base text-ink">
                    {categoryDisplayName(c.slug)}
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
