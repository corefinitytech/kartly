"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

type ToastVariant = "default" | "success" | "error";

interface ToastItem {
  id: number;
  title: string;
  description?: string;
  variant: ToastVariant;
}

const ToastContext = React.createContext<{
  toast: (t: { title: string; description?: string; variant?: ToastVariant }) => void;
} | null>(null);

export function useToast() {
  const context = React.useContext(ToastContext);
  if (!context) throw new Error("useToast must be used within a ToastProvider");
  return context;
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = React.useState<ToastItem[]>([]);

  const toast = React.useCallback(
    ({ title, description, variant = "default" }: { title: string; description?: string; variant?: ToastVariant }) => {
      const id = Date.now() + Math.random();
      setItems((prev) => [...prev, { id, title, description, variant }]);
      setTimeout(() => setItems((prev) => prev.filter((i) => i.id !== id)), 4000);
    },
    [],
  );

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      <div
        aria-live="polite"
        aria-atomic="true"
        className="pointer-events-none fixed inset-x-0 bottom-4 z-50 flex flex-col items-center gap-2 px-4"
      >
        {items.map((item) => (
          <div
            key={item.id}
            role="status"
            className={cn(
              "pointer-events-auto w-full max-w-sm rounded-card border border-line bg-surface p-4 shadow-pop",
              item.variant === "error" && "border-danger",
              item.variant === "success" && "border-success",
            )}
          >
            <p className="text-sm font-medium">{item.title}</p>
            {item.description ? (
              <p className="mt-1 text-sm text-muted-foreground">{item.description}</p>
            ) : null}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
