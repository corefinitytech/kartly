import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { PageHeader } from "@/components/admin/ui";
import { requireStaffPage } from "@/modules/admin/guard";
import { listCategoryOptions } from "@/modules/admin/repo";
import { NewProductForm } from "../product-forms";

export const metadata = { title: "New product" };

export default async function NewProductPage() {
  await requireStaffPage("products.manage", "/admin/products/new");
  const categories = await listCategoryOptions();
  return (
    <div className="max-w-3xl">
      <Link href="/admin/products" className="mb-3 inline-flex min-h-11 items-center gap-1 text-sm text-brandLink underline-offset-4 hover:underline">
        <ArrowLeft aria-hidden="true" strokeWidth={1.75} className="h-4 w-4" />
        All products
      </Link>
      <PageHeader title="New product" description="It starts as a draft with no stock. Publish it when it is ready." />
      <NewProductForm categories={categories} />
    </div>
  );
}
