"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import {
  CONSENT_COOKIE_MAX_AGE,
  CONSENT_COOKIE_NAME,
  isCompleteConsent,
  parseConsentCookie,
  serializeConsentCookie,
} from "@/lib/consent-cookie";
import type { CategoryBooleans } from "./consent/shared";
import { CURRENT_CONSENT_POLICY_VERSION, type ConsentCategory } from "@/lib/consent";
import { Button } from "@/components/ui/button";

const CustomizeDialog = dynamic(
  () => import("./consent/customize-dialog").then((m) => m.CustomizeDialog),
  { ssr: false },
);

interface ConsentContextValue {
  consent: ReturnType<typeof parseConsentCookie>;
  granted: (category: ConsentCategory) => boolean;
  openSettings: () => void;
}

const ConsentContext = createContext<ConsentContextValue | null>(null);

export function useConsent(): ConsentContextValue {
  const context = useContext(ConsentContext);
  if (!context) throw new Error("useConsent must be used within ConsentProvider");
  return context;
}

export function ConsentGate({
  category,
  children,
  fallback = null,
}: {
  category: Exclude<ConsentCategory, "necessary">;
  children: React.ReactNode;
  fallback?: React.ReactNode;
}) {
  const { granted } = useConsent();
  return granted(category) ? <>{children}</> : <>{fallback}</>;
}

function newAnonId(): string {
  return crypto.randomUUID();
}

function writeCookie(categories: CategoryBooleans, anonId: string) {
  document.cookie = `${CONSENT_COOKIE_NAME}=${encodeURIComponent(
    serializeConsentCookie({ categories }, anonId),
  )}; max-age=${CONSENT_COOKIE_MAX_AGE}; path=/; samesite=lax`;
}

function saveDecision(categories: CategoryBooleans, anonId: string, source: string) {
  writeCookie(categories, anonId);
  void fetch("/api/privacy/consent", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ categories, anonId, source, policyVersion: CURRENT_CONSENT_POLICY_VERSION }),
  }).catch(() => undefined);
}

export function ConsentProvider({ children }: { children: React.ReactNode }) {
  const [consent, setConsent] = useState<ReturnType<typeof parseConsentCookie>>(null);
  const [ready, setReady] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [anonId, setAnonId] = useState<string | null>(null);

  useEffect(() => {
    const parsed = parseConsentCookie(
      document.cookie
        .split("; ")
        .find((row) => row.startsWith(`${CONSENT_COOKIE_NAME}=`))
        ?.split("=")
        .slice(1)
        .join("="),
    );
    // FR-GDPR-04: a choice made under an older policy version no longer counts;
    // the banner asks again (keeping the same anon id) and nothing optional runs meanwhile.
    setConsent(parsed && isCompleteConsent(parsed) ? parsed : null);
    setAnonId(parsed?.anonId ?? newAnonId());
    setReady(true);
  }, []);

  const openSettings = useCallback(() => setDialogOpen(true), []);

  const decide = (categories: CategoryBooleans, source: string) => {
    if (!anonId) return;
    saveDecision(categories, anonId, source);
    setConsent({ categories, policyVersion: CURRENT_CONSENT_POLICY_VERSION, anonId });
  };

  const value = useMemo<ConsentContextValue>(
    () => ({
      consent,
      granted: (category) => (category === "necessary" ? true : consent?.categories[category] === true),
      openSettings,
    }),
    [consent, openSettings],
  );

  return (
    <ConsentContext.Provider value={value}>
      {children}
      {ready && !consent ? (
        <div className="safe-bottom fixed inset-x-0 bottom-0 z-50 border-t border-line bg-surface p-4 shadow-pop sm:inset-x-auto sm:bottom-4 sm:left-4 sm:m-4 sm:w-[440px] sm:rounded-card sm:border">
          <h2 className="text-lg font-semibold">Cookies, kept small</h2>
          <p className="mt-1 text-sm text-inkSoft">
            We use necessary cookies for the cart and login. Optional ones are off unless you allow them. You can
            change this at any time from the footer.
          </p>
          <div className="mt-4 flex flex-col gap-2 sm:flex-row">
            <Button
              variant="tertiary"
              onClick={() => decide({ necessary: true, functional: false, analytics: false, marketing: false }, "banner")}
              className="sm:flex-1"
            >
              Reject all
            </Button>
            <Button
              variant="tertiary"
              onClick={() => {
                setDialogOpen(true);
              }}
              className="sm:flex-1"
            >
              Customize
            </Button>
            <Button
              variant="secondary"
              onClick={() => decide({ necessary: true, functional: true, analytics: true, marketing: true }, "banner")}
              className="sm:flex-1"
            >
              Accept all
            </Button>
          </div>
        </div>
      ) : null}
      {dialogOpen ? (
        <CustomizeDialog
          initial={consent?.categories ?? null}
          onClose={() => setDialogOpen(false)}
          onSaved={(categories: CategoryBooleans) => { if (anonId) decide(categories, "customize"); }}
        />
      ) : null}
    </ConsentContext.Provider>
  );
}
