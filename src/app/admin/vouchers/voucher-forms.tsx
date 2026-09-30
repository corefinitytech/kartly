"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { FormMessage, SelectField, Submit, TextField, TextareaField, useAdminForm, valueOf } from "@/components/admin/form";
import type { AdminFormState } from "@/modules/admin/schemas";
import { createVoucherAction, setVoucherActiveAction, updateVoucherAction } from "@/modules/vouchers/actions";

export interface VoucherValues {
  id: string;
  code: string;
  type: "percent" | "fixed_amount" | "free_shipping";
  value: string;
  minSpend: string;
  perUserLimit: string;
  globalLimit: string;
  firstOrderOnly: boolean;
  startsAt: string;
  endsAt: string;
  isActive: boolean;
  note: string;
  categoryIds: string[];
  productSlugs: string;
  usedCount: number;
}

export interface CategoryOption {
  id: string;
  label: string;
}

const TYPE_OPTIONS = [
  { value: "percent", label: "Percent off the order" },
  { value: "fixed_amount", label: "Amount off the order" },
  { value: "free_shipping", label: "Free shipping" },
];

function Checkbox({ name, label, hint, defaultChecked }: { name: string; label: string; hint?: string; defaultChecked: boolean }) {
  return (
    <label className="flex min-h-11 cursor-pointer items-start gap-3 rounded-btn border border-line p-3">
      <input type="checkbox" name={name} defaultChecked={defaultChecked} className="mt-0.5 h-5 w-5 shrink-0 accent-[#0F4C4A]" />
      <span>
        <span className="block text-sm font-medium text-ink">{label}</span>
        {hint ? <span className="block text-sm text-inkSoft">{hint}</span> : null}
      </span>
    </label>
  );
}

function VoucherFields({
  state,
  voucher,
  categories,
}: {
  state: AdminFormState | undefined;
  voucher?: VoucherValues;
  categories: CategoryOption[];
}) {
  const [type, setType] = useState<string>(valueOf(state, "type", voucher?.type ?? "percent"));
  const locked = (voucher?.usedCount ?? 0) > 0;
  // Checkboxes cannot echo through defaultValue; a failed submit keeps what was sent.
  const checked = (name: string, fallback: boolean) => (state?.values ? state.values[name] === "on" : fallback);
  const selectedCategories = state?.values ? (state.values.categoryIds ?? "").split(",").filter(Boolean) : (voucher?.categoryIds ?? []);
  const categoryError = state?.fieldErrors?.categoryIds;

  return (
    <div className="space-y-6">
      <fieldset className="rounded-card border border-line bg-surface p-4 sm:p-5">
        <legend className="px-1 text-lg font-semibold">Code and discount</legend>
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField
            id="code"
            name="code"
            label="Code"
            state={state}
            defaultValue={voucher?.code}
            required
            maxLength={32}
            autoComplete="off"
            readOnly={locked}
            className="uppercase"
            hint={locked ? "Used already, so the code is fixed." : "Letters, numbers, dashes. Shoppers can type it in any case."}
          />
          <SelectField
            id="type"
            name="type"
            label="Discount"
            state={state}
            defaultValue={voucher?.type ?? "percent"}
            options={locked ? TYPE_OPTIONS.filter((o) => o.value === voucher?.type) : TYPE_OPTIONS}
            onChange={(e) => setType(e.target.value)}
          />
          {type === "free_shipping" ? (
            <input type="hidden" name="value" value="0" />
          ) : (
            <TextField
              key={type}
              id="value"
              name="value"
              label={type === "percent" ? "Percent off (1 to 100)" : "Amount off (USD)"}
              state={state}
              defaultValue={voucher?.type === type ? voucher.value : ""}
              inputMode={type === "percent" ? "numeric" : "decimal"}
              placeholder={type === "percent" ? "10" : "5.00"}
              required
              autoComplete="off"
            />
          )}
          <TextField
            id="minSpend"
            name="minSpend"
            label="Minimum spend (USD, optional)"
            state={state}
            defaultValue={voucher?.minSpend}
            inputMode="decimal"
            placeholder="25.00"
            autoComplete="off"
            hint="Checked on the cart subtotal before the code."
          />
        </div>
      </fieldset>

      <fieldset className="rounded-card border border-line bg-surface p-4 sm:p-5">
        <legend className="px-1 text-lg font-semibold">Limits and dates</legend>
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField
            id="perUserLimit"
            name="perUserLimit"
            label="Uses per customer (optional)"
            state={state}
            defaultValue={voucher?.perUserLimit}
            inputMode="numeric"
            autoComplete="off"
            hint="Set this and shoppers must sign in to use the code."
          />
          <TextField
            id="globalLimit"
            name="globalLimit"
            label="Total uses (optional)"
            state={state}
            defaultValue={voucher?.globalLimit}
            inputMode="numeric"
            autoComplete="off"
            hint={voucher ? `Used ${voucher.usedCount} times so far.` : "Leave empty for no limit."}
          />
          <TextField id="startsAt" name="startsAt" type="datetime-local" label="Starts (UTC, optional)" state={state} defaultValue={voucher?.startsAt} />
          <TextField id="endsAt" name="endsAt" type="datetime-local" label="Ends (UTC, optional)" state={state} defaultValue={voucher?.endsAt} />
          <div className="sm:col-span-2">
            <Checkbox
              name="firstOrderOnly"
              label="First order only"
              hint="Only for signed-in customers with no earlier orders."
              defaultChecked={checked("firstOrderOnly", voucher?.firstOrderOnly ?? false)}
            />
          </div>
        </div>
      </fieldset>

      <fieldset className="rounded-card border border-line bg-surface p-4 sm:p-5">
        <legend className="px-1 text-lg font-semibold">Applies to</legend>
        <p className="mb-3 text-sm text-inkSoft">Leave both empty to apply to the whole cart. Otherwise only matching items are discounted.</p>
        <div className="grid gap-4">
          <div>
            <p id="categoryIds-label" className="text-sm text-inkSoft">
              Categories
            </p>
            <div
              role="group"
              aria-labelledby="categoryIds-label"
              className="mt-1 grid max-h-56 gap-1 overflow-y-auto rounded-btn border border-lineStrong p-2 sm:grid-cols-2"
            >
              {categories.map((c) => (
                <label key={c.id} className="flex min-h-9 cursor-pointer items-center gap-2 rounded-badge px-2 text-sm hover:bg-sunken">
                  <input
                    type="checkbox"
                    name="categoryIds"
                    value={c.id}
                    defaultChecked={selectedCategories.includes(c.id)}
                    className="h-4 w-4 accent-[#0F4C4A]"
                  />
                  {c.label}
                </label>
              ))}
            </div>
            {categoryError ? <p className="mt-1 text-sm text-danger">{categoryError}</p> : null}
          </div>
          <TextareaField
            id="productSlugs"
            name="productSlugs"
            label="Products (URL slugs, comma separated)"
            state={state}
            defaultValue={voucher?.productSlugs}
            className="min-h-20"
            hint="The part after /p/ in a product link."
          />
        </div>
      </fieldset>

      <fieldset className="rounded-card border border-line bg-surface p-4 sm:p-5">
        <legend className="px-1 text-lg font-semibold">Status</legend>
        <div className="grid gap-4">
          <Checkbox
            name="isActive"
            label="Active"
            hint="Inactive codes are refused at checkout."
            defaultChecked={checked("isActive", voucher?.isActive ?? true)}
          />
          <TextField id="note" name="note" label="Internal note (optional)" state={state} defaultValue={voucher?.note} maxLength={200} autoComplete="off" />
        </div>
      </fieldset>
    </div>
  );
}

export function NewVoucherForm({ categories }: { categories: CategoryOption[] }) {
  const [state, action, pending] = useAdminForm(createVoucherAction);
  return (
    <form action={action} className="space-y-6" noValidate>
      <VoucherFields state={state} categories={categories} />
      <FormMessage state={state} />
      <Submit pending={pending} pendingLabel="Creating">
        Create voucher
      </Submit>
    </form>
  );
}

export function EditVoucherForm({ voucher, categories }: { voucher: VoucherValues; categories: CategoryOption[] }) {
  const [state, action, pending] = useAdminForm(updateVoucherAction);
  return (
    <form action={action} className="space-y-6" noValidate>
      <input type="hidden" name="voucherId" value={voucher.id} />
      <VoucherFields state={state} voucher={voucher} categories={categories} />
      <FormMessage state={state} />
      <Submit pending={pending}>Save voucher</Submit>
    </form>
  );
}

export function ActiveToggleForm({ voucherId, isActive }: { voucherId: string; isActive: boolean }) {
  const [state, action, pending] = useAdminForm(setVoucherActiveAction);
  return (
    <form action={action} className="space-y-2">
      <input type="hidden" name="voucherId" value={voucherId} />
      <input type="hidden" name="isActive" value={isActive ? "false" : "true"} />
      <Button type="submit" variant={isActive ? "tertiary" : "secondary"} disabled={pending} className="w-full">
        {pending ? "Saving" : isActive ? "Deactivate" : "Activate"}
      </Button>
      <FormMessage state={state} />
    </form>
  );
}
