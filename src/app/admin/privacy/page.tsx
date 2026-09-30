import { ShieldCheck } from "lucide-react";
import { AdminEmpty, FilterTabs, PageHeader, formatDateTime } from "@/components/admin/ui";
import { requireStaffPage } from "@/modules/admin/guard";
import { listDsarRequests } from "@/modules/privacy/dsar-service";
import { slaDaysLeft } from "@/modules/privacy/rules";
import { DsarRow } from "./row";

export const metadata = { title: "Privacy requests" };

const TYPE_LABELS: Record<string, string> = { export: "Export", erasure: "Erasure", access: "Access", rectification: "Rectification", restriction: "Restriction", objection: "Objection" };

export default async function AdminPrivacyPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  await requireStaffPage("privacy.manage", "/admin/privacy");
  const status = (await searchParams).status === "all" ? "all" : "open";
  const rows = await listDsarRequests({ status });
  return (
    <div>
      <PageHeader
        title="Privacy requests"
        description="Data subject requests must be answered within 30 days. Exports are self-service; erasures run automatically after the 7 day cool off."
      />
      <FilterTabs
        label="Request status"
        items={[
          { href: "/admin/privacy", label: "Open", current: status === "open" },
          { href: "/admin/privacy?status=all", label: "All", current: status === "all" },
        ]}
      />
      {rows.length === 0 ? (
        <AdminEmpty icon={ShieldCheck} title={status === "open" ? "No open requests" : "No requests yet"} description="Requests from the Privacy Centre appear here with their deadline." />
      ) : (
        <ul className="space-y-3">
          {rows.map((r) => {
            const open = !r.completedAt;
            const left = slaDaysLeft(new Date(r.dueAt));
            return (
              <li key={r.id} className="rounded-card border border-line bg-surface p-4">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <p className="font-medium">
                    {TYPE_LABELS[r.type] ?? r.type}
                    <span className="ml-2 text-sm font-normal text-inkSoft">{r.requesterEmail ?? "Account deleted"}</span>
                  </p>
                  <p className={`text-sm ${open && left <= 5 ? "font-medium text-danger" : "text-inkSoft"}`}>
                    {open ? (left >= 0 ? `${left} days left (due ${formatDateTime(r.dueAt)})` : `Overdue by ${-left} days`) : `Closed ${formatDateTime(r.completedAt!)}`}
                  </p>
                </div>
                <p className="mt-1 text-xs text-inkMuted">Received {formatDateTime(r.createdAt)} · request {r.id.slice(0, 8)}</p>
                <DsarRow id={r.id} status={r.status} notes={r.notes ?? ""} />
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
