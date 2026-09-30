import { requireUser } from "@/modules/auth/session";
import { SecurityForm } from "./form";

export const dynamic = "force-dynamic";

export default async function SecurityPage() {
  await requireUser();
  return <SecurityForm />;
}
