"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";

export function RouteProgress() {
  const [active, setActive] = useState(false);
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const doneRef = useRef(() => {});

  doneRef.current = () => setActive(false);

  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      const target = (event.target as HTMLElement).closest("a");
      if (!target) return;
      const href = target.getAttribute("href");
      if (!href || href.startsWith("http") || href.startsWith("#") || href.startsWith("mailto:")) return;
      const url = new URL(href, window.location.href);
      if (url.pathname === window.location.pathname && url.search === window.location.search) return;
      setActive(true);
    };
    document.addEventListener("click", onClick);
    return () => document.removeEventListener("click", onClick);
  }, []);

  useEffect(() => {
    doneRef.current();
  }, [pathname, searchParams]);

  if (!active) return null;

  return (
    <div aria-hidden="true" className="fixed inset-x-0 top-0 z-[80] h-[2px] bg-brand">
      <div className="anim-indeterminate h-full w-full bg-brand" />
    </div>
  );
}
