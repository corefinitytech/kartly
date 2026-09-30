"use client";

import { useState } from "react";
import Link from "next/link";
import { AuthCard, ErrorSummary, PasswordField, SubmitButton, useAuthForm } from "@/components/auth/form-kit";
import { Input } from "@/components/ui/input";
import { signInAction } from "@/modules/auth/actions";

export function LoginForm({
  next,
  notice,
  prefill,
}: {
  next?: string;
  notice?: string;
  prefill?: { email: string; password: string };
}) {
  const [state, formAction, pending] = useAuthForm(signInAction);
  const [password, setPassword] = useState(prefill?.password ?? "");

  return (
    <AuthCard title="Sign in">
      <form action={formAction} className="space-y-4" noValidate>
        <input type="hidden" name="next" value={next} />
        {notice === "reset" ? (
          <div role="status" className="mb-4 rounded-badge bg-brandTint px-3 py-2 text-sm text-ink">
            Password changed. Sign in with your new password.
          </div>
        ) : null}
        <ErrorSummary state={state} />
        {prefill ? (
          <div role="status" className="rounded-badge bg-sunken px-3 py-2 text-sm text-inkSoft">
            Store admin sign in. The demo admin account is filled in.
          </div>
        ) : null}
        <div>
          <label htmlFor="email" className="block text-sm text-inkSoft">
            Email
          </label>
          <Input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            required
            defaultValue={prefill?.email}
            className="mt-1"
          />
        </div>
        <PasswordField
          id="password"
          label="Password"
          autoComplete="current-password"
          value={password}
          onChange={setPassword}
          error={state?.fieldErrors?.password}
        />
        <SubmitButton pending={pending}>Sign in</SubmitButton>
        <div className="flex flex-col gap-1 text-sm">
          <Link href="/forgot-password" className="text-brandLink underline underline-offset-4">
            Forgot your password?
          </Link>
          <span className="text-inkSoft">
            New here?{" "}
            <Link href="/signup" className="text-brandLink underline underline-offset-4">
              Create an account
            </Link>
          </span>
        </div>
      </form>
    </AuthCard>
  );
}
