"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Overlay } from "@/components/ui/overlay";
import type { CategoryBooleans } from "./shared";

const CATEGORY_LABELS: { key: keyof Omit<CategoryBooleans, "necessary">; label: string; help: string }[] = [
  { key: "functional", label: "Functional", help: "Remembers choices like your last search filters." },
  { key: "analytics", label: "Analytics", help: "Anonymous counts of page views so we can fix what is slow or broken." },
  { key: "marketing", label: "Marketing", help: "Lets us measure campaigns. No profiles are sold or shared." },
];

export function CustomizeDialog({
  initial,
  onClose,
  onSaved,
}: {
  initial: CategoryBooleans | null;
  onClose: () => void;
  onSaved: (categories: CategoryBooleans) => void;
}) {
  const [functional, setFunctional] = useState(initial?.functional ?? false);
  const [analytics, setAnalytics] = useState(initial?.analytics ?? false);
  const [marketing, setMarketing] = useState(initial?.marketing ?? false);

  const save = (categories: CategoryBooleans) => {
    onSaved(categories);
    onClose();
  };

  return (
    <Overlay open onClose={onClose} variant="dialog" label="Cookie settings">
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
        <Button
          variant="tertiary"
          onClick={() => save({ necessary: true, functional: false, analytics: false, marketing: false })}
        >
          Reject all
        </Button>
      </div>
    </Overlay>
  );
}
