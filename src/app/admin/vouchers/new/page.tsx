import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { PageHeader } from "@/components/admin/ui";
import { requireStaffPage } from "@/modules/admin/guard";
import { categoryOptions } from "@/modules/vouchers/service";
import { categoryDisplayName } from "@/modules/catalog/category-names";
import { NewVoucherForm } from "../voucher-forms";

export const metadata = { title: "New voucher" };

export default async function NewVoucherPage() {
  await requireStaffPage("vouchers.manage", "/admin/vouchers/new");
  const categories = await categoryOptions();
  return (
    <div className="max-w-3xl">
      <Link href="/admin/vouchers" className="inline-flex min-h-11 items-center gap-1 text-sm text-brandLink underline-offset-4 hover:underline">
        <ArrowLeft aria-hidden="true" strokeWidth={1.75} className="h-4 w-4" />
        All vouchers
      </Link>
      <PageHeader title="New voucher" description="Shoppers enter the code at checkout. If it does not apply, they are told why." />
      <NewVoucherForm categories={categories.map((c) => ({ id: c.id, label: categoryDisplayName(c.slug) }))} />
    </div>
  );
}
