"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

export function useDismissable(open: boolean, onClose: () => void, exitMs: number) {
  const [mounted, setMounted] = useState(open);
  const [closing, setClosing] = useState(false);

  useEffect(() => {
    if (open) {
      setMounted(true);
      setClosing(false);
    } else if (mounted) {
      setClosing(true);
      const timer = setTimeout(() => {
        setMounted(false);
        setClosing(false);
      }, exitMs);
      return () => clearTimeout(timer);
    }
  }, [open, exitMs, mounted]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  return { mounted, closing };
}

export function useFocusTrap(open: boolean) {
  const ref = useRef<HTMLDivElement>(null);
  const restoreRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!open) return;
    restoreRef.current = document.activeElement as HTMLElement | null;
    const container = ref.current;
    const focusables = () => Array.from(container?.querySelectorAll<HTMLElement>(FOCUSABLE) ?? []);
    focusables()[0]?.focus();

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Tab") return;
      const items = focusables();
      if (items.length === 0) return;
      const first = items[0]!;
      const last = items[items.length - 1]!;
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    container?.addEventListener("keydown", onKeyDown);
    return () => {
      container?.removeEventListener("keydown", onKeyDown);
      restoreRef.current?.focus();
    };
  }, [open]);

  return ref;
}

export function Overlay({
  open,
  onClose,
  variant,
  label,
  children,
  className,
}: {
  open: boolean;
  onClose: () => void;
  variant: "dialog" | "sheet" | "drawer";
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  const { mounted, closing } = useDismissable(open, onClose, 240);
  const trapRef = useFocusTrap(open && mounted && !closing);

  const handleClose = useCallback(() => onClose(), [onClose]);

  if (!mounted) return null;

  const enter =
    variant === "dialog"
      ? "anim-fade-slide-up"
      : variant === "drawer"
        ? "anim-sheet-in sm:[animation:drawer-in_240ms_cubic-bezier(0.2,0,0,1)]"
        : "anim-sheet-in";
  const exit =
    variant === "dialog"
      ? "translate-y-2 opacity-0"
      : variant === "drawer"
        ? "max-sm:translate-y-full sm:translate-x-full"
        : "translate-y-full";

  return (
    <div
      className={cn(
        "fixed inset-0 z-[60] bg-ink/40",
        variant === "dialog" ? "flex items-center justify-center p-0 sm:p-6" : "flex items-end sm:items-stretch sm:justify-end",
        closing ? "opacity-0" : "anim-fade-in",
        "transition-opacity duration-[180ms] ease-[cubic-bezier(0.2,0,0,1)]",
      )}
      onClick={handleClose}
    >
      <div
        ref={trapRef}
        role="dialog"
        aria-modal="true"
        aria-label={label}
        onClick={(e) => e.stopPropagation()}
        className={cn(
          variant === "dialog" && "safe-bottom w-full max-w-md rounded-card border border-line bg-surface p-6 shadow-pop",
          variant === "sheet" && "safe-bottom max-h-[85vh] w-full overflow-y-auto rounded-t-card border border-line bg-surface shadow-pop",
          variant === "drawer" &&
            "safe-bottom max-h-[85vh] w-full overflow-y-auto rounded-t-card border border-line bg-surface shadow-pop sm:max-h-none sm:w-[420px] sm:rounded-none sm:rounded-l-card",
          !closing && enter,
          closing && cn("transition-transform duration-[240ms] ease-[cubic-bezier(0.2,0,0,1)]", exit),
          className,
        )}
      >
        {children}
      </div>
    </div>
  );
}
