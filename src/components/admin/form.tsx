"use client";

import { useActionState, useState } from "react";
import { AlertCircle, Check } from "lucide-react";
import { Button, type ButtonProps } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import type { AdminFormState } from "@/modules/admin/schemas";

export type AdminAction = (prev: AdminFormState | undefined, formData: FormData) => Promise<AdminFormState>;

export function useAdminForm(action: AdminAction) {
  return useActionState(action, undefined);
}

/** The typed value after a failed submit, else the stored one. */
export function valueOf(state: AdminFormState | undefined, name: string, fallback: string | number | null | undefined): string {
  return state?.values?.[name] ?? (fallback == null ? "" : String(fallback));
}

const control =
  "w-full rounded-btn border border-lineStrong bg-surface px-3 text-base text-ink placeholder:text-inkMuted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand disabled:opacity-50";

interface FieldProps {
  id: string;
  label: string;
  error?: string;
  hint?: string;
  className?: string;
  children: React.ReactNode;
}

export function Field({ id, label, error, hint, className, children }: FieldProps) {
  return (
    <div className={className}>
      <label htmlFor={id} className="block text-sm text-inkSoft">
        {label}
      </label>
      <div className="mt-1">{children}</div>
      {error ? (
        <p id={`${id}-error`} className="mt-1 text-sm text-danger">
          {error}
        </p>
      ) : hint ? (
        <p id={`${id}-hint`} className="mt-1 text-sm text-inkMuted">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

type TextFieldProps = Omit<React.ComponentProps<"input">, "id" | "name"> & {
  id: string;
  name: string;
  label: string;
  state: AdminFormState | undefined;
  hint?: string;
  fieldClassName?: string;
};

export function TextField({ id, name, label, state, hint, fieldClassName, defaultValue, ...rest }: TextFieldProps) {
  const error = state?.fieldErrors?.[name];
  return (
    <Field id={id} label={label} error={error} hint={hint} className={fieldClassName}>
      <Input
        id={id}
        name={name}
        defaultValue={valueOf(state, name, defaultValue as string | undefined)}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${id}-error` : hint ? `${id}-hint` : undefined}
        {...rest}
      />
    </Field>
  );
}

type SelectFieldProps = Omit<React.ComponentProps<"select">, "id" | "name"> & {
  id: string;
  name: string;
  label: string;
  state: AdminFormState | undefined;
  options: { value: string; label: string }[];
  hint?: string;
  fieldClassName?: string;
};

export function SelectField({ id, name, label, state, options, hint, fieldClassName, defaultValue, className, ...rest }: SelectFieldProps) {
  const error = state?.fieldErrors?.[name];
  return (
    <Field id={id} label={label} error={error} hint={hint} className={fieldClassName}>
      <select
        id={id}
        name={name}
        defaultValue={valueOf(state, name, defaultValue as string | undefined)}
        aria-invalid={error ? true : undefined}
        className={cn(control, "h-11", className)}
        {...rest}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </Field>
  );
}

type TextareaFieldProps = Omit<React.ComponentProps<"textarea">, "id" | "name"> & {
  id: string;
  name: string;
  label: string;
  state: AdminFormState | undefined;
  hint?: string;
  fieldClassName?: string;
};

export function TextareaField({ id, name, label, state, hint, fieldClassName, defaultValue, className, ...rest }: TextareaFieldProps) {
  const error = state?.fieldErrors?.[name];
  return (
    <Field id={id} label={label} error={error} hint={hint} className={fieldClassName}>
      <textarea
        id={id}
        name={name}
        defaultValue={valueOf(state, name, defaultValue as string | undefined)}
        aria-invalid={error ? true : undefined}
        className={cn(control, "min-h-32 py-2", className)}
        {...rest}
      />
    </Field>
  );
}

/** Whole-form error or success line. Field errors show next to their fields. */
export function FormMessage({ state, className }: { state: AdminFormState | undefined; className?: string }) {
  if (state?.error) {
    return (
      <p role="alert" className={cn("anim-fade-in flex items-start gap-2 rounded-badge bg-dangerTint px-3 py-2 text-sm text-danger", className)}>
        <AlertCircle strokeWidth={1.75} className="mt-0.5 h-4 w-4 shrink-0" />
        {state.error}
      </p>
    );
  }
  if (state?.fieldErrors && Object.keys(state.fieldErrors).length > 0) {
    return (
      <p role="alert" className={cn("anim-fade-in flex items-start gap-2 rounded-badge bg-dangerTint px-3 py-2 text-sm text-danger", className)}>
        <AlertCircle strokeWidth={1.75} className="mt-0.5 h-4 w-4 shrink-0" />
        Check the highlighted fields.
      </p>
    );
  }
  if (state?.notice) {
    return (
      <p role="status" className={cn("anim-fade-in flex items-start gap-2 rounded-badge bg-brandTint px-3 py-2 text-sm text-ink", className)}>
        <Check strokeWidth={1.75} className="mt-0.5 h-4 w-4 shrink-0 text-success" />
        {state.notice}
      </p>
    );
  }
  return null;
}

export function Submit({ pending, children, pendingLabel = "Saving", ...rest }: ButtonProps & { pending: boolean; pendingLabel?: string }) {
  return (
    <Button type="submit" variant="secondary" disabled={pending} aria-busy={pending || undefined} {...rest}>
      {pending ? pendingLabel : children}
    </Button>
  );
}

/**
 * Two-step submit for destructive actions: the first click asks, the second
 * submits. No modal, so it works the same with a keyboard or on a phone.
 */
export function ConfirmSubmit({
  pending,
  label,
  confirmLabel,
  question,
}: {
  pending: boolean;
  label: string;
  confirmLabel: string;
  question: string;
}) {
  const [asking, setAsking] = useState(false);
  if (!asking) {
    return (
      <Button type="button" variant="tertiary" onClick={() => setAsking(true)} className="text-danger">
        {label}
      </Button>
    );
  }
  return (
    <div role="group" aria-label={question} className="anim-fade-in flex flex-wrap items-center gap-2">
      <span className="text-sm text-ink">{question}</span>
      <Button type="submit" variant="tertiary" disabled={pending} className="border-danger text-danger" autoFocus>
        {pending ? "Working" : confirmLabel}
      </Button>
      <Button type="button" variant="text" onClick={() => setAsking(false)} disabled={pending}>
        Keep it
      </Button>
    </div>
  );
}
