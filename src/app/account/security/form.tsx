"use client";

import { useState } from "react";
import { ErrorSummary, NoticeBanner, PasswordField, SubmitButton, useAuthForm } from "@/components/auth/form-kit";
import { changePasswordAction } from "@/modules/auth/actions";

export function SecurityForm() {
  const [state, formAction, pending] = useAuthForm(changePasswordAction);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  return (
    <div className="max-w-md">
      <h1 className="text-2xl font-bold">Security</h1>
      <form action={formAction} className="mt-4 space-y-4" noValidate>
        <ErrorSummary state={state} />
        <NoticeBanner state={state} />
        <PasswordField
          id="currentPassword"
          label="Current password"
          autoComplete="current-password"
          value={currentPassword}
          onChange={setCurrentPassword}
          error={state?.fieldErrors?.currentPassword}
        />
        <PasswordField
          id="newPassword"
          label="New password"
          autoComplete="new-password"
          value={newPassword}
          onChange={setNewPassword}
          error={state?.fieldErrors?.newPassword}
        />
        <p className="text-sm text-inkMuted">At least 10 characters. Other sessions are signed out on change.</p>
        <SubmitButton pending={pending}>Change password</SubmitButton>
      </form>
    </div>
  );
}
