"use client";

import { useState } from "react";
import Link from "next/link";
import { AuthCard, ErrorSummary, PasswordField, SubmitButton, useAuthForm } from "@/components/auth/form-kit";
import { resetPasswordAction } from "@/modules/auth/actions";
import { passwordStrength } from "@/modules/auth/password";

export function ResetForm({ token }: { token: string }) {
  const [state, formAction, pending] = useAuthForm(resetPasswordAction);
  const [password, setPassword] = useState("");
  const strength = passwordStrength(password);

  return (
    <AuthCard title="Choose a new password">
      <form action={formAction} className="space-y-4" noValidate>
        <input type="hidden" name="token" value={token} />
        <ErrorSummary state={state} />
        <PasswordField
          id="password"
          label="New password"
          autoComplete="new-password"
          value={password}
          onChange={setPassword}
          error={state?.fieldErrors?.password}
        />
        {password.length > 0 ? <p className="text-sm text-inkSoft">{strength.label}</p> : null}
        <SubmitButton pending={pending}>Set new password</SubmitButton>
        <p className="text-sm text-inkSoft">
          <Link href="/forgot-password" className="text-brandLink underline underline-offset-4">
            Request a new link
          </Link>
        </p>
      </form>
    </AuthCard>
  );
}
