"use client";

import { useState } from "react";
import Link from "next/link";
import {
  AuthCard,
  ErrorSummary,
  LegalNote,
  PasswordField,
  SubmitButton,
  useAuthForm,
} from "@/components/auth/form-kit";
import { Input } from "@/components/ui/input";
import { signUpAction } from "@/modules/auth/actions";
import { passwordStrength, validatePassword } from "@/modules/auth/password";

const STRENGTH_COLORS = ["bg-danger", "bg-danger", "bg-warning", "bg-success", "bg-success"];

export function SignupForm({ next }: { next?: string }) {
  const [state, formAction, pending] = useAuthForm(signUpAction);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [touched, setTouched] = useState<{ password?: boolean }>({});
  const strength = passwordStrength(password);
  const issues = validatePassword(password, email);
  const showPasswordIssues = touched.password && issues.length > 0;

  return (
    <AuthCard title="Create an account">
      <form action={formAction} className="space-y-4" noValidate>
        <input type="hidden" name="next" value={next} />
        <ErrorSummary state={state} />
        <div>
          <label htmlFor="name" className="block text-sm text-inkSoft">
            Name
          </label>
          <Input id="name" name="name" autoComplete="name" required className="mt-1" />
        </div>
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
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="mt-1"
          />
        </div>
        <div>
          <PasswordField
            id="password"
            label="Password"
            autoComplete="new-password"
            value={password}
            onChange={setPassword}
            onBlur={() => setTouched({ password: true })}
            error={showPasswordIssues ? issues[0]!.message : state?.fieldErrors?.password}
          />
          {password.length > 0 ? (
            <div className="mt-2" aria-live="polite">
              <div className="flex gap-1">
                {[0, 1, 2, 3].map((i) => (
                  <span
                    key={i}
                    className={`h-1 flex-1 rounded-badge ${i < strength.score ? STRENGTH_COLORS[strength.score] : "bg-sunken"}`}
                  />
                ))}
              </div>
              <p className="mt-1 text-sm text-inkSoft">{strength.label}</p>
            </div>
          ) : null}
          <p className="mt-1 text-sm text-inkMuted">At least 10 characters, not a common password.</p>
        </div>
        <label className="flex min-h-11 items-start gap-2 text-sm text-inkSoft">
          <input
            type="checkbox"
            name="ageConfirmed"
            required
            className="mt-0.5 h-5 w-5 shrink-0 accent-[#0F4C4A]"
          />
          <span>I am 16 or older.</span>
        </label>
        <SubmitButton pending={pending}>Create account</SubmitButton>
        <p className="text-sm text-inkSoft">
          Already have an account?{" "}
          <Link href="/login" className="text-brandLink underline underline-offset-4">
            Sign in
          </Link>
        </p>
        <LegalNote />
      </form>
    </AuthCard>
  );
}
