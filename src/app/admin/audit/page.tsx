import { toIso } from "@/lib/dates";
import Link from "next/link";
import { ScrollText } from "lucide-react";
import { AdminEmpty, PageHeader, Pager, formatDateTime } from "@/components/admin/ui";
import { requireStaffPage } from "@/modules/admin/guard";
import { AUDIT_PAGE_SIZE, auditActionPrefixes, listAudit } from "@/modules/admin/repo";
import { auditListSchema } from "@/modules/admin/schemas";

export const metadata = { title: "Audit log" };

const ENTITY_TYPES = ["order", "product", "variant", "user", "address", "consent"];

/** Link an audit entity to its admin page when there is one. */
function entityHref(type: string, id: string): string | null {
  if (type === "product") return `/admin/products/${id}`;
  return null;
}

function metaSummary(json: string): string {
  try {
    const meta = JSON.parse(json) as Record<string, unknown>;
    return Object.entries(meta)
      .map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(", ") : typeof v === "object" && v !== null ? JSON.stringify(v) : String(v)}`)
      .join(" · ");
  } catch {
    return "";
  }
}

export default async function AuditPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  await requireStaffPage("audit.view", "/admin/audit");
  const filters = auditListSchema.parse(await searchParams);
  const [rows, prefixes] = await Promise.all([listAudit(filters), auditActionPrefixes()]);
  const hasNext = rows.length > AUDIT_PAGE_SIZE;
  const entries = rows.slice(0, AUDIT_PAGE_SIZE);
  const filtered = Boolean(filters.action || filters.entityType || filters.entityId || filters.actorId);

  const href = (next: Partial<typeof filters>) => {
    const merged = { ...filters, ...next };
    const params = new URLSearchParams();
    for (const key of ["action", "entityType", "entityId", "actorId"] as const) if (merged[key]) params.set(key, merged[key]);
    if (merged.page > 1) params.set("page", String(merged.page));
    const qs = params.toString();
    return `/admin/audit${qs ? `?${qs}` : ""}`;
  };

  const control =
    "h-11 w-full rounded-btn border border-lineStrong bg-surface px-3 text-base text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand";

  return (
    <div>
      <PageHeader
        title="Audit log"
        description="Append only: entries cannot be edited or deleted, and are kept for 12 months. IP addresses are stored as salted hashes."
      />
      <form action="/admin/audit" method="get" className="mb-4 grid gap-3 rounded-card border border-line bg-surface p-4 sm:grid-cols-2 lg:grid-cols-[1fr_1fr_1fr_auto] lg:items-end">
        <div>
          <label htmlFor="action" className="block text-sm text-inkSoft">Action</label>
          <select id="action" name="action" defaultValue={filters.action} className={`mt-1 ${control}`}>
            <option value="">Any action</option>
            {prefixes.map((p) => (
              <option key={p.prefix} value={`${p.prefix}.`}>
                {p.prefix}.*
              </option>
            ))}
            {filters.action && !prefixes.some((p) => `${p.prefix}.` === filters.action) ? (
              <option value={filters.action}>{filters.action}</option>
            ) : null}
          </select>
        </div>
        <div>
          <label htmlFor="entityType" className="block text-sm text-inkSoft">Entity</label>
          <select id="entityType" name="entityType" defaultValue={filters.entityType} className={`mt-1 ${control}`}>
            <option value="">Any entity</option>
            {ENTITY_TYPES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="entityId" className="block text-sm text-inkSoft">Entity ID</label>
          <input id="entityId" name="entityId" defaultValue={filters.entityId} autoComplete="off" className={`mt-1 ${control}`} />
        </div>
        {filters.actorId ? <input type="hidden" name="actorId" value={filters.actorId} /> : null}
        <div className="flex gap-2">
          <button type="submit" className="min-h-11 rounded-btn bg-brand px-4 text-base font-medium text-white hover:bg-brandDeep focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand">
            Filter
          </button>
          {filtered ? (
            <Link href="/admin/audit" className="flex min-h-11 items-center px-2 text-brandLink underline underline-offset-4">
              Clear
            </Link>
          ) : null}
        </div>
      </form>
      {filters.actorId ? (
        <p className="mb-3 text-sm text-inkSoft">
          Showing one actor only.{" "}
          <Link href={href({ actorId: "", page: 1 })} className="text-brandLink underline underline-offset-4">
            Show everyone
          </Link>
        </p>
      ) : null}

      {entries.length === 0 ? (
        <AdminEmpty icon={ScrollText} title={filtered ? "No matching entries" : "No entries yet"} description={filtered ? "Try fewer filters." : "Actions across the store will be recorded here."} />
      ) : (
        <ol className="divide-y divide-line overflow-hidden rounded-card border border-line bg-surface">
          {entries.map((e) => {
            const link = entityHref(e.entity_type, e.entity_id);
            const meta = metaSummary(e.meta_json);
            return (
              <li key={e.id} className="grid gap-1 p-3 text-sm sm:grid-cols-[180px_1fr] sm:gap-4 sm:p-4">
                <time dateTime={toIso(e.created_at)} className="text-inkSoft">
                  {formatDateTime(toIso(e.created_at))}
                </time>
                <div className="min-w-0">
                  <p>
                    <span className="font-mono font-medium">{e.action}</span>{" "}
                    <span className="text-inkSoft">on {e.entity_type} </span>
                    {link ? (
                      <Link href={link} className="break-all font-mono text-xs text-brandLink underline-offset-4 hover:underline">
                        {e.entity_id}
                      </Link>
                    ) : (
                      <Link href={href({ entityType: e.entity_type, entityId: e.entity_id, page: 1 })} className="break-all font-mono text-xs text-brandLink underline-offset-4 hover:underline" title="Show all entries for this record">
                        {e.entity_id}
                      </Link>
                    )}
                  </p>
                  <p className="mt-0.5 text-inkSoft">
                    By{" "}
                    {e.actor_id ? (
                      <Link href={href({ actorId: e.actor_id, page: 1 })} className="text-brandLink underline-offset-4 hover:underline">
                        {e.actor_name ?? `${e.actor_role ?? "user"} ${e.actor_id.slice(0, 8)}`}
                      </Link>
                    ) : (
                      "system or guest"
                    )}
                    {e.actor_role && e.actor_name ? ` (${e.actor_role})` : ""}
                    {e.ip_hash ? <span className="text-inkMuted"> · IP #{e.ip_hash.slice(0, 10)}</span> : null}
                  </p>
                  {meta ? <p className="mt-0.5 break-words text-xs text-inkMuted">{meta}</p> : null}
                </div>
              </li>
            );
          })}
        </ol>
      )}
      <Pager page={filters.page} hasNext={hasNext} href={(page) => href({ page })} />
    </div>
  );
}
