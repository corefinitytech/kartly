import { requireUser } from "@/modules/auth/session";
import { listAddresses } from "@/modules/addresses/service";
import { AddressesView } from "./view";

export const dynamic = "force-dynamic";

export default async function AddressesPage() {
  const user = await requireUser();
  const addresses = await listAddresses(user.id);
  return <AddressesView addresses={addresses} />;
}
