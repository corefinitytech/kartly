"use client";

import { createContext, useCallback, useContext, useMemo, useState } from "react";
import { CONSENT_COOKIE_MAX_AGE, CONSENT_COOKIE_NAME, serializeConsentCookie } from "@/lib/consent-cookie";
import type { ConsentCookie } from "@/lib/consent-cookie";
import { CURRENT_CONSENT_POLICY_VERSION, type ConsentCategory } from "@/lib/consent";
import { Button } from "@/components/ui/button";

interface ConsentContextValue {
  consent: ConsentCookie | null;
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

type CategoryBooleans = ConsentCookie["categories"];

const CATEGORY_LABELS: { key: Exclude<ConsentCategory, "necessary">; label: string; help: string }[] = [
  { key: "functional", label: "Functional", help: "Remembers choices like your last search filters." },
  { key: "analytics", label: "Analytics", help: "Anonymous counts of page views so we can fix what is slow or broken." },
  { key: "marketing", label: "Marketing", help: "Lets us measure campaigns. No profiles are sold or shared." },
];

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

function CustomizeDialog({
  anonId,
  initial,
  onClose,
  onSaved,
}: {
  anonId: string;
  initial: CategoryBooleans | null;
  onClose: () => void;
  onSaved: (categories: CategoryBooleans) => void;
}) {
  const [functional, setFunctional] = useState(initial?.functional ?? false);
  const [analytics, setAnalytics] = useState(initial?.analytics ?? false);
  const [marketing, setMarketing] = useState(initial?.marketing ?? false);

  const save = (categories: CategoryBooleans) => {
    saveDecision(categories, anonId, "customize");
    onSaved(categories);
    onClose();
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Cookie settings"
      className="fixed inset-0 z-[60] flex items-end justify-center bg-ink/40 p-0 sm:items-center sm:p-6"
    >
      <div className="w-full max-w-md rounded-t-card border border-line bg-surface p-6 sm:rounded-card">
        <h2 className="text-xl font-semibold">Cookie settings</h2>
        <p className="mt-2 text-sm text-inkSoft">
          You can change these at any time from the footer. Necessary cookies keep the cart and login working and
          cannot be turned off.
        </p>
        <ul className="mt-4 space-y-3">
          <li className="rounded-btn border border-line bg-sunken p-3">
            <p className="text-sm font-medium">Necessary</p>
            <p className="text-sm text-inkSoft">Cart, login and security. Always on.</p>
          </li>
          {CATEGORY_LABELS.map((c) => {
            const checked = c.key === "functional" ? functional : c.key === "analytics" ? analytics : marketing;
            const toggle = () =>
              c.key === "functional"
                ? setFunctional((v) => !v)
                : c.key === "analytics"
                  ? setAnalytics((v) => !v)
                  : setMarketing((v) => !v);
            return (
              <li key={c.key} className="rounded-btn border border-line p-3">
                <label className="flex min-h-11 cursor-pointer items-center justify-between gap-3">
                  <span>
                    <span className="text-sm font-medium">{c.label}</span>
                    <span className="block text-sm text-inkSoft">{c.help}</span>
                  </span>
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={toggle}
                    className="h-5 w-5 shrink-0 accent-[#0F4C4A]"
                  />
                </label>
              </li>
            );
          })}
        </ul>
        <div className="mt-5 flex flex-col gap-2 sm:flex-row-reverse">
          <Button variant="buy" onClick={() => save({ necessary: true, functional, analytics, marketing })}>
            Save choices
          </Button>
          <Button variant="tertiary" onClick={() => save({ necessary: true, functional: false, analytics: false, marketing: false })}>
            Reject all
          </Button>
        </div>
      </div>
    </div>
  );
}

export function ConsentProvider({
  initial,
  children,
}: {
  initial: ConsentCookie | null;
  children: React.ReactNode;
}) {
  const [consent, setConsent] = useState<ConsentCookie | null>(initial);
  const [bannerOpen, setBannerOpen] = useState(initial === null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [anonId] = useState(() => initial?.anonId ?? newAnonId());

  const openSettings = useCallback(() => setDialogOpen(true), []);

  const decide = (categories: CategoryBooleans, source: string) => {
    saveDecision(categories, anonId, source);
    setConsent({
      categories,
      policyVersion: CURRENT_CONSENT_POLICY_VERSION,
      anonId,
    });
    setBannerOpen(false);
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
      {bannerOpen ? (
        <div className="fixed inset-x-0 bottom-0 z-50 border-t border-line bg-surface p-4 shadow-pop sm:inset-x-4 sm:bottom-4 sm:mx-auto sm:max-w-2xl sm:rounded-card sm:border sm:p-6">
          <h2 className="text-lg font-semibold">Cookies, kept small</h2>
          <p className="mt-1 text-sm text-inkSoft">
            We use necessary cookies for the cart and login. Optional ones are off unless you allow them. You can
            change this at any time from the footer.
          </p>
          <div className="mt-4 flex flex-col gap-2 sm:flex-row">
            <Button variant="tertiary" onClick={() => decide({ necessary: true, functional: false, analytics: false, marketing: false }, "banner")} className="sm:flex-1">
              Reject all
            </Button>
            <Button
              variant="tertiary"
              onClick={() => {
                setBannerOpen(false);
                setDialogOpen(true);
              }}
              className="sm:flex-1"
            >
              Customize
            </Button>
            <Button variant="secondary" onClick={() => decide({ necessary: true, functional: true, analytics: true, marketing: true }, "banner")} className="sm:flex-1">
              Accept all
            </Button>
          </div>
        </div>
      ) : null}
      {dialogOpen ? (
        <CustomizeDialog
          anonId={anonId}
          initial={consent?.categories ?? null}
          onClose={() => setDialogOpen(false)}
          onSaved={(categories) => setConsent({ categories, policyVersion: CURRENT_CONSENT_POLICY_VERSION, anonId })}
        />
      ) : null}
    </ConsentContext.Provider>
  );
}
