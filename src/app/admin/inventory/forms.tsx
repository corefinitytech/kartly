"use client";

import { FormMessage, SelectField, Submit, TextField, useAdminForm } from "@/components/admin/form";
import { adjustStockAction, setThresholdAction } from "@/modules/admin/actions";

const REASONS = [
  { value: "restock", label: "Restock (delivery arrived)" },
  { value: "correction", label: "Count correction" },
  { value: "damaged", label: "Damaged" },
  { value: "lost", label: "Lost or stolen" },
  { value: "returned", label: "Customer return" },
];

export function AdjustStockForm({ variantId, current }: { variantId: string; current: number }) {
  const [state, action, pending] = useAdminForm(adjustStockAction);
  const p = `adj-${variantId}`;
  return (
    <form action={action} className="space-y-2" noValidate>
      <input type="hidden" name="variantId" value={variantId} />
      <div className="grid gap-3 sm:grid-cols-[120px_1fr_1fr_auto] sm:items-end">
        <TextField
          id={`${p}-delta`}
          name="delta"
          label="Change"
          state={state}
          inputMode="numeric"
          placeholder="+10 or -2"
          autoComplete="off"
          required
          aria-describedby={`${p}-help`}
        />
        <SelectField id={`${p}-reason`} name="reason" label="Reason" state={state} defaultValue="restock" options={REASONS} />
        <TextField id={`${p}-note`} name="note" label="Note (optional)" state={state} maxLength={200} autoComplete="off" />
        <Submit pending={pending} className="sm:mb-0">
          Save
        </Submit>
      </div>
      <p id={`${p}-help`} className="text-xs text-inkMuted">
        Positive adds stock, negative removes it. Now {current}; stock cannot go below 0.
      </p>
      <FormMessage state={state} />
    </form>
  );
}

export function ThresholdForm({ variantId, threshold }: { variantId: string; threshold: number }) {
  const [state, action, pending] = useAdminForm(setThresholdAction);
  return (
    <form action={action} className="space-y-2" noValidate>
      <input type="hidden" name="variantId" value={variantId} />
      <div className="flex items-end gap-2">
        <TextField
          id={`th-${variantId}`}
          name="lowStockThreshold"
          label="Low stock at"
          state={state}
          defaultValue={threshold}
          inputMode="numeric"
          autoComplete="off"
          fieldClassName="flex-1"
        />
        <Submit pending={pending} variant="tertiary">
          Set
        </Submit>
      </div>
      <FormMessage state={state} />
    </form>
  );
}
