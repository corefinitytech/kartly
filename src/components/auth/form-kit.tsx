"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { AlertCircle, Check, Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { FormState } from "@/modules/auth/actions";

export function AuthCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mx-auto w-full max-w-[420px] px-4 py-10">
      <div className="rounded-card border border-line bg-surface p-6">
        <h1 className="text-2xl font-bold">{title}</h1>
        <div className="mt-4">{children}</div>
      </div>
    </div>
  );
}

export function PasswordField({
  id,
  label,
  autoComplete,
  value,
  onChange,
  onBlur,
  error,
  describedBy,
}: {
  id: string;
  label: string;
  autoComplete: string;
  value: string;
  onChange: (value: string) => void;
  onBlur?: () => void;
  error?: string;
  describedBy?: string;
}) {
  const [visible, setVisible] = useState(false);
  return (
    <div>
      <label htmlFor={id} className="block text-sm text-inkSoft">
        {label}
      </label>
      <div className="relative mt-1">
        <Input
          id={id}
          name={id}
          type={visible ? "text" : "password"}
          autoComplete={autoComplete}
          required
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onBlur={onBlur}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          className="pr-12"
        />
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          aria-label={visible ? "Hide password" : "Show password"}
          className="absolute right-1 top-1 flex h-9 w-10 items-center justify-center rounded-btn text-inkSoft hover:bg-sunken"
        >
          {visible ? <EyeOff strokeWidth={1.75} className="h-5 w-5" /> : <Eye strokeWidth={1.75} className="h-5 w-5" />}
        </button>
      </div>
      {error ? <p className="mt-1 text-sm text-danger">{error}</p> : null}
    </div>
  );
}

export function ErrorSummary({ state }: { state: FormState | undefined }) {
  if (!state?.error && !state?.fieldErrors) return null;
  const messages = [
    ...(state.error ? [state.error] : []),
    ...Object.values(state.fieldErrors ?? {}).filter(Boolean),
  ];
  if (messages.length === 0) return null;
  return (
    <div
      role="alert"
      tabIndex={-1}
      ref={(el) => el?.focus()}
      className="anim-fade-in mb-4 flex items-start gap-2 rounded-badge bg-dangerTint px-3 py-2 text-sm text-danger"
    >
      <AlertCircle strokeWidth={1.75} className="mt-0.5 h-4 w-4 shrink-0" />
      <ul className="space-y-1">
        {messages.map((message) => (
          <li key={message}>{message}</li>
        ))}
      </ul>
    </div>
  );
}

export function NoticeBanner({ state }: { state: FormState | undefined }) {
  if (!state?.notice) return null;
  return (
    <div
      role="status"
      className="anim-fade-in mb-4 flex items-start gap-2 rounded-badge bg-brandTint px-3 py-2 text-sm text-ink"
    >
      <Check strokeWidth={1.75} className="mt-0.5 h-4 w-4 shrink-0 text-success" />
      {state.notice}
    </div>
  );
}

export function SubmitButton({ pending, children }: { pending: boolean; children: React.ReactNode }) {
  return (
    <Button type="submit" variant="buy" disabled={pending} className="w-full">
      {pending ? "Please wait" : children}
    </Button>
  );
}

export function useAuthForm(action: (prev: FormState | undefined, formData: FormData) => Promise<FormState>) {
  return useActionState(action, undefined);
}

export function LegalNote() {
  return (
    <p className="mt-4 text-sm text-inkMuted">
      By continuing you agree to our{" "}
      <Link href="/terms" className="text-brandLink underline underline-offset-4">
        Terms
      </Link>{" "}
      and{" "}
      <Link href="/privacy" className="text-brandLink underline underline-offset-4">
        Privacy policy
      </Link>
      .
    </p>
  );
}
