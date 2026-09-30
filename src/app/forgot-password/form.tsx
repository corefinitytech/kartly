"use client";

import Link from "next/link";
import { AuthCard, ErrorSummary, NoticeBanner, SubmitButton, useAuthForm } from "@/components/auth/form-kit";
import { Input } from "@/components/ui/input";
import { forgotPasswordAction } from "@/modules/auth/actions";

export function ForgotForm() {
  const [state, formAction, pending] = useAuthForm(forgotPasswordAction);

  return (
    <AuthCard title="Reset your password">
      <form action={formAction} className="space-y-4" noValidate>
        <ErrorSummary state={state} />
        <NoticeBanner state={state} />
        <div>
          <label htmlFor="email" className="block text-sm text-inkSoft">
            Email
          </label>
          <Input id="email" name="email" type="email" autoComplete="email" required className="mt-1" />
        </div>
        <SubmitButton pending={pending}>Send reset link</SubmitButton>
        <p className="text-sm text-inkSoft">
          <Link href="/login" className="text-brandLink underline underline-offset-4">
            Back to sign in
          </Link>
        </p>
      </form>
    </AuthCard>
  );
}
