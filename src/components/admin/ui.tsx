import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { Inbox } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { STATUS_LABELS, isOrderStatus } from "@/modules/orders/state-machine";

export function PageHeader({ title, description, actions }: { title: string; description?: string; actions?: React.ReactNode }) {
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-2xl font-bold">{title}</h1>
        {description ? <p className="mt-1 text-sm text-inkSoft">{description}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
    </div>
  );
}

export function Section({ title, id, children, className, actions }: { title: string; id: string; children: React.ReactNode; className?: string; actions?: React.ReactNode }) {
  return (
    <section aria-labelledby={id} className={cn("rounded-card border border-line bg-surface p-4 sm:p-5", className)}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id={id} className="text-lg font-semibold">
          {title}
        </h2>
        {actions}
      </div>
      <div className="mt-3">{children}</div>
    </section>
  );
}

const STATUS_TONE: Record<string, string> = {
  paid: "bg-warningTint text-warning", // needs action
  processing: "bg-brandTint text-brand",
  shipped: "bg-brandTint text-brand",
  delivered: "bg-surface text-success border border-line",
  cancelled: "bg-sunken text-inkSoft",
  refunded: "bg-sunken text-inkSoft",
  partially_refunded: "bg-dangerTint text-danger",
  payment_failed: "bg-dangerTint text-danger",
  pending_payment: "bg-sunken text-inkSoft",
};

export function OrderStatusBadge({ status }: { status: string }) {
  return (
    <span className={cn("inline-flex w-fit items-center rounded-badge px-2 py-0.5 text-xs font-medium", STATUS_TONE[status] ?? "bg-sunken text-inkSoft")}>
      {isOrderStatus(status) ? STATUS_LABELS[status] : status}
    </span>
  );
}

export function StockBadge({ qty, threshold }: { qty: number; threshold: number }) {
  if (qty === 0) return <Badge variant="outOfStock">Out of stock</Badge>;
  if (qty <= threshold) return <Badge variant="lowStock">Low: {qty}</Badge>;
  return <span className="text-sm tabular-nums text-inkSoft">{qty}</span>;
}

export function AdminEmpty({ icon: Icon = Inbox, title, description, action }: { icon?: LucideIcon; title: string; description: string; action?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 rounded-card border border-line bg-surface px-6 py-14 text-center">
      <Icon aria-hidden="true" strokeWidth={1.75} className="h-6 w-6 text-inkMuted" />
      <h2 className="text-lg font-semibold">{title}</h2>
      <p className="max-w-sm text-sm text-inkSoft">{description}</p>
      {action ? <div className="mt-2">{action}</div> : null}
    </div>
  );
}

/** Link-based tabs (URL state), horizontally scrollable on phones. */
export function FilterTabs({ label, items }: { label: string; items: { href: string; label: string; count?: number; current: boolean }[] }) {
  return (
    <nav aria-label={label} className="-mx-4 mb-4 overflow-x-auto px-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      <ul className="flex gap-1 border-b border-line">
        {items.map((item) => (
          <li key={item.href} className="shrink-0">
            <Link
              href={item.href}
              aria-current={item.current ? "page" : undefined}
              className={cn(
                "-mb-px flex min-h-11 items-center gap-1.5 border-b-2 px-3 text-sm text-inkSoft hover:text-ink",
                item.current ? "border-brand font-medium text-ink" : "border-transparent",
              )}
            >
              {item.label}
              {item.count !== undefined ? (
                <span className="rounded-full bg-sunken px-1.5 text-xs tabular-nums text-inkSoft">{item.count}</span>
              ) : null}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}

export function Pager({ page, hasNext, href, total }: { page: number; hasNext: boolean; href: (page: number) => string; total?: number }) {
  if (page === 1 && !hasNext) return null;
  const linkClass = "flex min-h-11 items-center rounded-btn border border-lineStrong bg-surface px-4 text-sm hover:bg-sunken";
  return (
    <nav aria-label="Pages" className="mt-4 flex items-center justify-between gap-2">
      {page > 1 ? (
        <Link href={href(page - 1)} className={linkClass} rel="prev">
          Previous
        </Link>
      ) : (
        <span />
      )}
      <span className="text-sm text-inkSoft">
        Page {page}
        {total !== undefined ? ` · ${total} total` : ""}
      </span>
      {hasNext ? (
        <Link href={href(page + 1)} className={linkClass} rel="next">
          Next
        </Link>
      ) : (
        <span />
      )}
    </nav>
  );
}

/** GET search form: works without JavaScript, keeps other filters as hidden fields. */
export function SearchForm({ action, name, defaultValue, placeholder, label, hidden = {} }: { action: string; name: string; defaultValue: string; placeholder: string; label: string; hidden?: Record<string, string> }) {
  return (
    <form action={action} method="get" role="search" className="mb-4 flex gap-2">
      {Object.entries(hidden).map(([k, v]) => (
        <input key={k} type="hidden" name={k} value={v} />
      ))}
      <label htmlFor={`${name}-search`} className="sr-only">
        {label}
      </label>
      <input
        id={`${name}-search`}
        name={name}
        type="search"
        defaultValue={defaultValue}
        placeholder={placeholder}
        className="h-11 w-full max-w-md rounded-btn border border-lineStrong bg-surface px-3 text-base text-ink placeholder:text-inkMuted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
      />
      <button type="submit" className="min-h-11 rounded-btn bg-brand px-4 text-base font-medium text-white hover:bg-brandDeep focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand">
        Search
      </button>
    </form>
  );
}

export function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit", timeZone: "UTC" }) + " UTC";
}
