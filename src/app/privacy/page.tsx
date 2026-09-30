import type { Metadata } from "next";
import { LegalPage } from "@/components/legal-page";

export const metadata: Metadata = { title: "Privacy policy", description: "What Kartly stores, why, and the rights you have over your data." };

export default function Page() {
  return (
    <LegalPage title="Privacy policy">
      <p>
        We store what a shop needs to sell you things: your account details, addresses, orders and payment metadata.
        We never store full card numbers. We do not sell your data.
      </p>
      <h2 className="text-xl font-semibold">What we store and why</h2>
      <p>
        The full field-by-field table, including the legal basis and retention period for every field, is in our data
        map. You can request a copy of everything we hold about you from the Privacy Center once accounts open.
      </p>
      <h2 className="text-xl font-semibold">Cookies</h2>
      <p>
        Only strictly necessary cookies are set before you consent. Optional categories (functional, analytics,
        marketing) are off unless you allow them. You can change your choice at any time using the Cookie settings
        link in the footer.
      </p>
      <h2 className="text-xl font-semibold">Your rights</h2>
      <p>
        You can access, export, correct or delete your data, and object to optional processing. Requests are answered
        within 30 days. There are no solely automated decisions with legal effect.
      </p>
      <h2 className="text-xl font-semibold">Deleting your account</h2>
      <p>
        Deletion has a 7 day cooling off period. After that, personal data is deleted and order records are kept for 7
        years in anonymized form, as required by tax law.
      </p>
      <h2 className="text-xl font-semibold">Contact</h2>
      <p>Questions go to the contact address on our contact page.</p>
    </LegalPage>
  );
}
