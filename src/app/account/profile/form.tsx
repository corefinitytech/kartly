"use client";

import { ErrorSummary, NoticeBanner, SubmitButton, useAuthForm } from "@/components/auth/form-kit";
import { Input } from "@/components/ui/input";
import { updateProfileAction } from "@/modules/auth/actions";

export function ProfileForm({
  initialName,
  initialPhone,
  email,
}: {
  initialName: string;
  initialPhone: string;
  email: string;
}) {
  const [state, formAction, pending] = useAuthForm(updateProfileAction);
  return (
    <div className="max-w-md">
      <h1 className="text-2xl font-bold">Profile</h1>
      <form action={formAction} className="mt-4 space-y-4" noValidate>
        <ErrorSummary state={state} />
        <NoticeBanner state={state} />
        <div>
          <label htmlFor="name" className="block text-sm text-inkSoft">
            Name
          </label>
          <Input id="name" name="name" autoComplete="name" defaultValue={initialName} required className="mt-1" />
        </div>
        <div>
          <label htmlFor="email" className="block text-sm text-inkSoft">
            Email
          </label>
          <Input id="email" value={email} readOnly aria-readonly className="mt-1 bg-sunken text-inkSoft" />
          <p className="mt-1 text-sm text-inkMuted">Changing your email arrives with the privacy centre.</p>
        </div>
        <div>
          <label htmlFor="phone" className="block text-sm text-inkSoft">
            Phone (optional)
          </label>
          <Input
            id="phone"
            name="phone"
            type="tel"
            autoComplete="tel"
            defaultValue={initialPhone}
            className="mt-1"
          />
        </div>
        <SubmitButton pending={pending}>Save profile</SubmitButton>
      </form>
    </div>
  );
}
