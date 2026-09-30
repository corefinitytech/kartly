"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

type ToastVariant = "default" | "success" | "error";

interface ToastAction {
  label: string;
  onAction: () => void;
}

interface ToastItem {
  id: number;
  title: string;
  description?: string;
  variant: ToastVariant;
  action?: ToastAction;
  leaving: boolean;
}

const ToastContext = React.createContext<{
  toast: (t: ToastOptions) => void;
} | null>(null);

export interface ToastOptions {
  title: string;
  description?: string;
  variant?: ToastVariant;
  actionLabel?: string;
  onAction?: () => void;
}

export function useToast() {
  const context = React.useContext(ToastContext);
  if (!context) throw new Error("useToast must be used within a ToastProvider");
  return context;
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = React.useState<ToastItem[]>([]);

  const toast = React.useCallback(
    ({ title, description, variant = "default", actionLabel, onAction }: ToastOptions) => {
      const id = Date.now() + Math.random();
      const action = actionLabel && onAction ? { label: actionLabel, onAction } : undefined;
      setItems((prev) => [...prev, { id, title, description, variant, action, leaving: false }]);
      setTimeout(() => {
        setItems((prev) => prev.map((i) => (i.id === id ? { ...i, leaving: true } : i)));
        setTimeout(() => setItems((prev) => prev.filter((i) => i.id !== id)), 180);
      }, 4000);
    },
    [],
  );

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      <div
        aria-live="polite"
        aria-atomic="true"
        className="pointer-events-none safe-bottom fixed inset-x-0 bottom-4 z-[65] flex flex-col items-center gap-2 px-4 sm:inset-x-auto sm:bottom-4 sm:right-4 sm:items-end"
      >
        {items.map((item) => (
          <div
            key={item.id}
            role="status"
            className={cn(
              "pointer-events-auto w-full max-w-sm rounded-card border border-line bg-surface p-4 shadow-pop",
              item.variant === "error" && "border-danger",
              item.variant === "success" && "border-success",
              item.leaving ? "opacity-0" : "anim-toast-in",
              "transition-opacity duration-[180ms] ease-[cubic-bezier(0.2,0,0,1)]",
            )}
          >
            <p className="text-sm font-medium">{item.title}</p>
            {item.description ? (
              <p className="mt-1 text-sm text-inkSoft">{item.description}</p>
            ) : null}
            {item.action ? (
              <button
                type="button"
                onClick={item.action.onAction}
                className="mt-2 text-sm text-brandLink underline underline-offset-4"
              >
                {item.action.label}
              </button>
            ) : null}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
