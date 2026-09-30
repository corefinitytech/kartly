"use client";

import { FormMessage, SelectField, Submit, TextField, useAdminForm } from "@/components/admin/form";
import { updateDsarAction } from "@/modules/privacy/admin-actions";

const STATUS_OPTIONS = [
  { value: "received", label: "Received" },
  { value: "verifying", label: "Verifying identity" },
  { value: "in_progress", label: "In progress" },
  { value: "completed", label: "Completed" },
  { value: "rejected", label: "Rejected or withdrawn" },
];

export function DsarRow({ id, status, notes }: { id: string; status: string; notes: string }) {
  const [state, action, pending] = useAdminForm(updateDsarAction);
  return (
    <form action={action} className="mt-3 grid gap-3 sm:grid-cols-[200px_1fr_auto] sm:items-end" noValidate>
      <input type="hidden" name="requestId" value={id} />
      <SelectField id={`status-${id}`} name="status" label="Status" state={state} defaultValue={status} options={STATUS_OPTIONS} />
      <TextField id={`notes-${id}`} name="notes" label="Notes (no personal data)" state={state} defaultValue={notes} maxLength={500} autoComplete="off" />
      <Submit pending={pending}>Save</Submit>
      <FormMessage state={state} className="sm:col-span-3" />
    </form>
  );
}
