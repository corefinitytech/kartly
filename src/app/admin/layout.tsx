import type { Metadata } from "next";
import { requireStaffPage } from "@/modules/admin/guard";
import { can } from "@/modules/admin/permissions";
import { AdminNav } from "./nav";

export const metadata: Metadata = {
  title: { default: "Admin", template: "%s · Admin" },
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const staff = await requireStaffPage("orders.view");
  const links = [
    { href: "/admin/orders", label: "Orders", show: can(staff.role, "orders.view") },
    { href: "/admin/products", label: "Products", show: can(staff.role, "products.manage") },
    { href: "/admin/inventory", label: "Inventory", show: can(staff.role, "inventory.manage") },
    { href: "/admin/vouchers", label: "Vouchers", show: can(staff.role, "vouchers.manage") },
    { href: "/admin/privacy", label: "Privacy requests", show: can(staff.role, "privacy.manage") },
    { href: "/admin/audit", label: "Audit log", show: can(staff.role, "audit.view") },
  ]
    .filter((l) => l.show)
    .map(({ href, label }) => ({ href, label }));

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 lg:px-6">
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[200px_1fr]">
        <AdminNav links={links} name={staff.name.split(" ")[0] ?? staff.name} role={staff.role} />
        <div className="min-w-0">{children}</div>
      </div>
    </div>
  );
}
