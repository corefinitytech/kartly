import type { Metadata } from "next";
import { LegalPage } from "@/components/legal-page";

export const metadata: Metadata = { title: "Contact" };

export default function Page() {
  return (
    <LegalPage title="Contact">
      <p>For order questions, account help or privacy requests, email support@kartly.example.</p>
      <h2 className="text-xl font-semibold">Data protection</h2>
      <p>
        Privacy and data subject requests (access, export, correction, deletion) go to privacy@kartly.example. We
        answer within 30 days and track every request.
      </p>
      <h2 className="text-xl font-semibold">Response times</h2>
      <p>Orders and account issues: within 1 business day. Privacy requests: within 30 days as required by law.</p>
    </LegalPage>
  );
}
