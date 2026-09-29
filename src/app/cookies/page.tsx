import type { Metadata } from "next";
import { LegalPage } from "@/components/legal-page";

export const metadata: Metadata = { title: "Cookie policy" };

export default function Page() {
  return (
    <LegalPage title="Cookie policy">
      <p>
        We use a small number of first-party cookies. Nothing optional runs before you say so, and Reject all is as
        prominent as Accept all.
      </p>
      <h2 className="text-xl font-semibold">Necessary cookies</h2>
      <ul className="list-disc space-y-1 pl-6">
        <li>kt_consent: stores your cookie choices and an anonymous id. 180 days.</li>
        <li>cart_id: keeps your cart between visits. 30 days.</li>
        <li>Session cookie: keeps you logged in. 30 days sliding.</li>
      </ul>
      <h2 className="text-xl font-semibold">Optional categories</h2>
      <p>
        Functional, analytics and marketing cookies are only set after you allow them. Withdraw any category at any
        time from the Cookie settings link in the footer; the change takes effect immediately.
      </p>
      <h2 className="text-xl font-semibold">No third-party trackers</h2>
      <p>Fonts are self hosted, there are no ad pixels, and search results are never paid placements.</p>
    </LegalPage>
  );
}
