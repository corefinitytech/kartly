"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import type { CartView } from "@/modules/cart/service";

export interface AddResult {
  appliedQuantity: number;
  clamped: boolean;
  reason?: string;
  cartCount: number;
}

interface CartContextValue {
  count: number | null;
  view: CartView | null;
  loaded: boolean;
  loading: boolean;
  error: boolean;
  announce: (message: string) => void;
  refresh: () => Promise<void>;
  add: (variantId: string, title: string, quantity: number) => Promise<AddResult | null>;
  setQuantity: (variantId: string, quantity: number) => Promise<void>;
  remove: (variantId: string) => Promise<void>;
  undoRemove: () => Promise<void>;
  setCountry: (country: string) => Promise<void>;
}

const CartContext = createContext<CartContextValue | null>(null);

export function useCart(): CartContextValue {
  const context = useContext(CartContext);
  if (!context) throw new Error("useCart must be used within CartProvider");
  return context;
}

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [count, setCount] = useState<number | null>(null);
  const [view, setView] = useState<CartView | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const [announcement, setAnnouncement] = useState("");
  const sequence = useRef(0);
  const lastRemoved = useRef<{ variantId: string; quantity: number; title: string } | null>(null);

  const announce = useCallback((message: string) => setAnnouncement(message), []);

  const applyResponse = useCallback(async (response: Response, seq: number) => {
    if (!response.ok) throw new Error("cart request failed");
    const body = (await response.json()) as { data?: { count?: number; cart?: CartView | null } };
    if (seq !== sequence.current) return;
    if (typeof body.data?.count === "number") setCount(body.data.count);
    else if (body.data?.cart !== undefined) setCount(body.data.cart?.count ?? 0);
    if (body.data?.cart !== undefined) setView(body.data.cart);
    setLoaded(true);
    setError(false);
  }, []);

  const refresh = useCallback(async () => {
    sequence.current += 1;
    const seq = sequence.current;
    setLoading(true);
    try {
      // One request: the cart view carries its own count.
      const response = await fetch("/api/cart", { cache: "no-store" });
      if (!response.ok) throw new Error("cart request failed");
      const body = (await response.json()) as { data?: { cart?: CartView | null } };
      if (seq !== sequence.current) return;
      const cart = body.data?.cart ?? null;
      setView(cart);
      setCount(cart?.count ?? 0);
      setLoaded(true);
      setError(false);
    } catch {
      if (seq === sequence.current) setError(true);
    } finally {
      if (seq === sequence.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const mutate = useCallback(
    async (url: string, method: string, body: unknown) => {
      sequence.current += 1;
      const seq = sequence.current;
      const response = await fetch(url, {
        method,
        headers: { "content-type": "application/json" },
        body: body === undefined ? undefined : JSON.stringify(body),
      });
      return { response, seq };
    },
    [],
  );

  const add = useCallback(
    async (variantId: string, title: string, quantity: number): Promise<AddResult | null> => {
      // Optimistic: the badge moves on click; the server's answer corrects it.
      const before = count;
      setCount((c) => (c ?? 0) + quantity);
      try {
        const { response, seq } = await mutate("/api/cart/items", "POST", { variantId, quantity });
        if (!response.ok) throw new Error("add failed");
        const body = (await response.json()) as { data: AddResult & { cart?: CartView | null } };
        if (seq !== sequence.current) return body.data;
        setCount(body.data.cartCount);
        if (body.data.cart !== undefined) setView(body.data.cart);
        setLoaded(true);
        setError(false);
        return body.data;
      } catch {
        setCount(before);
        setError(true);
        return null;
      }
    },
    [count, mutate],
  );

  const setQuantity = useCallback(
    async (variantId: string, quantity: number) => {
      const previous = view;
      // Optimistic: show the new quantity now; the server's cart replaces it.
      if (previous) {
        const lines = previous.lines.map((l) => (l.variantId === variantId ? { ...l, quantity } : l));
        setView({ ...previous, lines });
        setCount(lines.reduce((sum, l) => sum + (l.unavailable ? 0 : l.quantity), 0));
      }
      try {
        const { response, seq } = await mutate(`/api/cart/items/${variantId}`, "PATCH", { quantity });
        if (!response.ok) throw new Error("quantity failed");
        await applyResponse(response, seq);
        announce(`Quantity updated to ${quantity}`);
      } catch {
        setView(previous);
        setCount(previous?.count ?? null);
        setError(true);
      }
    },
    [announce, applyResponse, mutate, view],
  );

  const remove = useCallback(
    async (variantId: string) => {
      const line = view?.lines.find((l) => l.variantId === variantId);
      const previous = view;
      if (line) {
        setView({
          ...(previous as CartView),
          lines: previous!.lines.filter((l) => l.variantId !== variantId),
        });
        setCount((c) => (c === null ? null : Math.max(0, c - line.quantity)));
      }
      lastRemoved.current = line
        ? { variantId, quantity: line.quantity, title: line.title }
        : null;
      try {
        const { response, seq } = await mutate(`/api/cart/items/${variantId}`, "DELETE", undefined);
        if (!response.ok) throw new Error("remove failed");
        await applyResponse(response, seq);
        announce("Removed");
      } catch {
        setView(previous);
        setError(true);
      }
    },
    [announce, applyResponse, mutate, view],
  );

  const undoRemove = useCallback(async () => {
    const removed = lastRemoved.current;
    if (!removed) return;
    lastRemoved.current = null;
    try {
      const { response } = await mutate("/api/cart/items", "POST", {
        variantId: removed.variantId,
        quantity: removed.quantity,
      });
      if (!response.ok) throw new Error("undo failed");
      const body = (await response.json()) as { data: AddResult & { cart?: CartView | null } };
      if (body.data.cart !== undefined) setView(body.data.cart);
      setCount(body.data.cartCount);
      announce(`${removed.title} restored`);
    } catch {
      setError(true);
    }
  }, [announce, mutate]);

  const setCountry = useCallback(
    async (country: string) => {
      try {
        const { response, seq } = await mutate("/api/cart/estimate", "PATCH", { country });
        if (!response.ok) throw new Error("estimate failed");
        await applyResponse(response, seq);
      } catch {
        setError(true);
      }
    },
    [applyResponse, mutate],
  );

  const value = useMemo<CartContextValue>(
    () => ({
      count,
      view,
      loaded,
      loading,
      error,
      announce,
      refresh,
      add,
      setQuantity,
      remove,
      undoRemove,
      setCountry,
    }),
    [add, announce, count, error, loaded, loading, refresh, remove, setCountry, setQuantity, undoRemove, view],
  );

  return (
    <CartContext.Provider value={value}>
      {children}
      <span aria-live="polite" role="status" className="sr-only">
        {announcement}
      </span>
    </CartContext.Provider>
  );
}
