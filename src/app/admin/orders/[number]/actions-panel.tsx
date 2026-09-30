"use client";

import { ConfirmSubmit, FormMessage, Submit, TextField, useAdminForm } from "@/components/admin/form";
import { Section } from "@/components/admin/ui";
import { formatCents } from "@/lib/money";
import { advanceOrderAction, cancelOrderAction, refundOrderAction } from "@/modules/admin/actions";
import { centsToInput } from "@/modules/admin/rules";

interface Props {
  orderId: string;
  status: string;
  next: "processing" | "shipped" | "delivered" | null;
  canCancel: boolean;
  canRefund: boolean;
  refundableCents: number;
}

export function OrderActions({ orderId, status, next, canCancel, canRefund, refundableCents }: Props) {
  if (!next && !canCancel && !canRefund) {
    return (
      <Section title="Next step" id="next-step">
        <p className="text-sm text-inkSoft">
          {status === "pending_payment"
            ? "Waiting for the customer to pay. Unpaid orders cancel themselves after 30 minutes."
            : "Nothing left to do on this order."}
        </p>
      </Section>
    );
  }
  return (
    <>
      {next ? <AdvanceForm orderId={orderId} next={next} /> : null}
      {canRefund ? <RefundForm orderId={orderId} refundableCents={refundableCents} /> : null}
      {canCancel ? <CancelForm orderId={orderId} status={status} /> : null}
    </>
  );
}

const ADVANCE_COPY = {
  processing: { button: "Start processing", help: "Payment is confirmed. Start picking and packing." },
  shipped: { button: "Mark as shipped", help: "The customer is emailed the carrier and tracking number." },
  delivered: { button: "Mark as delivered", help: "Use once the carrier confirms delivery." },
} as const;

function AdvanceForm({ orderId, next }: { orderId: string; next: "processing" | "shipped" | "delivered" }) {
  const [state, action, pending] = useAdminForm(advanceOrderAction);
  const copy = ADVANCE_COPY[next];
  return (
    <Section title="Next step" id="next-step">
      <form action={action} className="space-y-3" noValidate>
        <input type="hidden" name="orderId" value={orderId} />
        <input type="hidden" name="to" value={next} />
        <p className="text-sm text-inkSoft">{copy.help}</p>
        {next === "shipped" ? (
          <>
            <TextField id="carrier" name="carrier" label="Carrier" state={state} autoComplete="off" placeholder="UPS, DHL, USPS" required />
            <TextField id="trackingNumber" name="trackingNumber" label="Tracking number" state={state} autoComplete="off" required inputMode="text" />
          </>
        ) : (
          <>
            <input type="hidden" name="carrier" value="" />
            <input type="hidden" name="trackingNumber" value="" />
          </>
        )}
        <FormMessage state={state} />
        <Submit pending={pending} pendingLabel="Updating" className="w-full">
          {copy.button}
        </Submit>
      </form>
    </Section>
  );
}

function RefundForm({ orderId, refundableCents }: { orderId: string; refundableCents: number }) {
  const [state, action, pending] = useAdminForm(refundOrderAction);
  return (
    <Section title="Refund" id="refund">
      <form action={action} className="space-y-3" noValidate>
        <input type="hidden" name="orderId" value={orderId} />
        <p className="text-sm text-inkSoft">
          Up to <span className="price text-ink">{formatCents(refundableCents)}</span> can be refunded to the card.
        </p>
        <TextField
          id="refund-amount"
          name="amount"
          label="Amount (USD)"
          state={state}
          defaultValue={centsToInput(refundableCents)}
          inputMode="decimal"
          autoComplete="off"
          required
        />
        <TextField id="refund-reason" name="reason" label="Reason (shown in the order history)" state={state} maxLength={200} required />
        <FormMessage state={state} />
        <ConfirmSubmit pending={pending} label="Issue refund" confirmLabel="Refund now" question="Refund this amount to the card?" />
      </form>
    </Section>
  );
}

function CancelForm({ orderId, status }: { orderId: string; status: string }) {
  const [state, action, pending] = useAdminForm(cancelOrderAction);
  const paid = status === "paid" || status === "processing";
  return (
    <Section title="Cancel order" id="cancel">
      <form action={action} className="space-y-3" noValidate>
        <input type="hidden" name="orderId" value={orderId} />
        <p className="text-sm text-inkSoft">
          Stock goes back on sale.{" "}
          {paid ? "The full payment is refunded and the customer is emailed." : "The pending payment is cancelled."}
        </p>
        <TextField id="cancel-reason" name="reason" label="Reason (shown to the customer)" state={state} maxLength={200} required />
        <FormMessage state={state} />
        <ConfirmSubmit pending={pending} label="Cancel order" confirmLabel="Yes, cancel" question="Cancel this order?" />
      </form>
    </Section>
  );
}
