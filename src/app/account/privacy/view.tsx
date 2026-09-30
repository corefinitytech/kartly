"use client";

import { useActionState, useState } from "react";
import { AlertCircle, Check, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PasswordField } from "@/components/auth/form-kit";
import { useConsent } from "@/components/consent-provider";
import type { PrivacyOverview } from "@/modules/privacy/dsar-service";
import {
  cancelDeletionAction,
  requestDeletionAction,
  requestExportAction,
  type PrivacyFormState,
} from "@/modules/privacy/actions";

const TYPE_LABELS: Record<string, string> = { export: "Download my data", erasure: "Delete my account", access: "Access", rectification: "Correction", restriction: "Restriction", objection: "Objection" };
const STATUS_LABELS: Record<string, string> = { received: "Received", verifying: "Verifying", in_progress: "In progress", completed: "Completed", rejected: "Closed" };

const fmt = (iso: string) => new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

function Message({ state }: { state: PrivacyFormState | undefined }) {
  if (state?.error) {
    return (
      <p role="alert" className="flex items-start gap-2 rounded-badge bg-dangerTint px-3 py-2 text-sm text-danger">
        <AlertCircle strokeWidth={1.75} className="mt-0.5 h-4 w-4 shrink-0" />
        {state.error}
      </p>
    );
  }
  if (state?.notice) {
    return (
      <p role="status" className="flex items-start gap-2 rounded-badge bg-brandTint px-3 py-2 text-sm">
        <Check strokeWidth={1.75} className="mt-0.5 h-4 w-4 shrink-0 text-success" />
        {state.notice}
      </p>
    );
  }
  return null;
}

function Section({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  return (
    <section aria-labelledby={id} className="rounded-card border border-line bg-surface p-5">
      <h2 id={id} className="text-lg font-semibold">
        {title}
      </h2>
      <div className="mt-2 space-y-3 text-sm text-inkSoft">{children}</div>
    </section>
  );
}

export function PrivacyCentre({ overview, email, name }: { overview: PrivacyOverview; email: string; name: string }) {
  const { openSettings } = useConsent();
  const c = overview.counts;
  return (
    <div className="max-w-3xl space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Privacy</h1>
        <p className="mt-1 text-sm text-inkSoft">What we store about you, and your controls over it.</p>
      </div>

      <Section id="stored" title="What we store about you">
        <ul className="grid gap-x-6 gap-y-1 sm:grid-cols-2">
          <li><span className="text-ink">Profile:</span> {name}, {email}, phone if you added one (encrypted)</li>
          <li><span className="text-ink">Addresses:</span> {c.addresses} (street and phone encrypted)</li>
          <li><span className="text-ink">Orders:</span> {c.orders}, kept 7 years for tax, anonymized if you delete your account</li>
          <li><span className="text-ink">Signed-in sessions:</span> {c.sessions} (IP stored only as a hash)</li>
          <li><span className="text-ink">Items in your cart:</span> {c.cartItems}</li>
          <li><span className="text-ink">Consent records:</span> {c.consents}</li>
        </ul>
        <p>Card numbers never reach us; Stripe holds them. We do not sell data or run ads. Edit your name, phone and addresses in Profile and Addresses.</p>
      </Section>

      <Section id="cookies" title="Cookies">
        <p>Necessary cookies keep you signed in and hold your cart. Everything else is off unless you allow it.</p>
        <Button variant="tertiary" onClick={openSettings}>
          Change cookie settings
        </Button>
      </Section>

      <ExportSection hasActive={Boolean(overview.activeExport)} />

      <DeleteSection scheduledAt={overview.deletionScheduledAt} blockingOrders={overview.blockingOrders} />

      <Section id="requests" title="Your requests">
        {overview.requests.length === 0 ? (
          <p>No privacy requests yet.</p>
        ) : (
          <ul className="divide-y divide-line">
            {overview.requests.map((r) => (
              <li key={r.id} className="flex flex-wrap items-baseline justify-between gap-2 py-2">
                <span className="text-ink">{TYPE_LABELS[r.type] ?? r.type}</span>
                <span>
                  {STATUS_LABELS[r.status] ?? r.status} · {r.completedAt ? `done ${fmt(r.completedAt)}` : `due by ${fmt(r.dueAt)}`}
                </span>
              </li>
            ))}
          </ul>
        )}
        <p>We answer every request within 30 days. Questions: see the Contact page for our data protection contact.</p>
      </Section>
    </div>
  );
}

function ExportSection({ hasActive }: { hasActive: boolean }) {
  const [state, action, pending] = useActionState(requestExportAction, undefined);
  const [password, setPassword] = useState("");
  return (
    <Section id="export" title="Download my data">
      <p>A ZIP with your profile, addresses, orders, consents and requests as JSON and CSV. Confirm your password first. The link works for 24 hours.</p>
      {hasActive && !state?.downloadUrl ? <p>You already have a link from the last 24 hours in your email.</p> : null}
      <form action={action} className="space-y-3" noValidate>
        <Message state={state} />
        {state?.downloadUrl ? (
          <a
            href={state.downloadUrl}
            className="inline-flex min-h-11 items-center gap-2 rounded-btn bg-brand px-4 text-base font-medium text-white hover:bg-brandDeep"
          >
            <Download aria-hidden="true" strokeWidth={1.75} className="h-5 w-5" />
            Download ZIP
          </a>
        ) : (
          <>
            <div className="max-w-sm">
              <PasswordField id="export-password" label="Password" autoComplete="current-password" value={password} onChange={setPassword} error={state?.fieldErrors?.password} />
              <input type="hidden" name="password" value={password} />
            </div>
            <Button type="submit" variant="secondary" disabled={pending}>
              {pending ? "Preparing" : "Prepare my data"}
            </Button>
          </>
        )}
      </form>
    </Section>
  );
}

function DeleteSection({ scheduledAt, blockingOrders }: { scheduledAt: string | null; blockingOrders: string[] }) {
  const [state, action, pending] = useActionState(requestDeletionAction, undefined);
  const [cancelState, cancelAction, cancelling] = useActionState(async () => cancelDeletionAction(), undefined);
  const [password, setPassword] = useState("");

  if (scheduledAt) {
    return (
      <Section id="delete" title="Delete my account">
        <p className="rounded-badge bg-warningTint px-3 py-2 text-warning">
          Your account is scheduled for deletion on {fmt(scheduledAt)}. You can still sign in and cancel until then.
        </p>
        <form action={cancelAction} className="space-y-3">
          <Message state={cancelState} />
          <Button type="submit" variant="secondary" disabled={cancelling}>
            {cancelling ? "Cancelling" : "Keep my account"}
          </Button>
        </form>
      </Section>
    );
  }

  return (
    <Section id="delete" title="Delete my account">
      <p>
        After a 7 day wait, we delete your profile, addresses, cart, sessions and consent records. Orders are kept for 7 years for tax,
        with your name, email and address removed. Any store credit or gift card balance is lost.
      </p>
      {blockingOrders.length > 0 ? (
        <p className="rounded-badge bg-sunken px-3 py-2 text-ink">
          You can delete your account once these orders are delivered or cancelled: {blockingOrders.join(", ")}.
        </p>
      ) : (
        <form action={action} className="space-y-3" noValidate>
          <Message state={state} />
          <div className="max-w-sm">
            <PasswordField id="delete-password" label="Password" autoComplete="current-password" value={password} onChange={setPassword} error={state?.fieldErrors?.password} />
            <input type="hidden" name="password" value={password} />
          </div>
          <label className="flex items-start gap-2 text-ink">
            <input type="checkbox" name="confirm" className="mt-1 h-4 w-4 accent-[var(--color-brand)]" />
            <span>I understand my account will be deleted in 7 days and this cannot be undone after that.</span>
          </label>
          {state?.fieldErrors?.confirm ? <p className="text-danger">{state.fieldErrors.confirm}</p> : null}
          <Button type="submit" variant="tertiary" disabled={pending} className="border-danger text-danger">
            {pending ? "Scheduling" : "Delete my account"}
          </Button>
        </form>
      )}
    </Section>
  );
}
