import type { Metadata } from "next";
import { LegalPage } from "@/components/legal-page";

export const metadata: Metadata = { title: "FAQ" };

export default function Page() {
  return (
    <LegalPage title="FAQ">
      <h2 className="text-lg font-semibold">Do I need an account to buy?</h2>
      <p>No. Guest checkout opens with the cart. An account is only needed to track orders and save addresses.</p>
      <h2 className="text-lg font-semibold">When do I see the full price?</h2>
      <p>
        In the cart, before you check out. The total always includes shipping and tax, so there are no surprises at
        the payment step.
      </p>
      <h2 className="text-lg font-semibold">Are any results sponsored?</h2>
      <p>No. Nothing in search or categories is a paid placement, and there are no ads on Kartly.</p>
      <h2 className="text-lg font-semibold">What cookies do you use?</h2>
      <p>
        Only necessary ones until you allow more. Optional categories are off by default and can be withdrawn at any
        time from the footer.
      </p>
      <h2 className="text-lg font-semibold">Can I delete my data?</h2>
      <p>Yes, completely, once accounts open. Order records are kept in anonymized form for 7 years for tax law.</p>
    </LegalPage>
  );
}
