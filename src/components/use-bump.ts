"use client";

import { useEffect, useRef, useState } from "react";

export function useBump(value: number): boolean {
  const [bumping, setBumping] = useState(false);
  const previous = useRef(value);

  useEffect(() => {
    if (previous.current !== value) {
      previous.current = value;
      setBumping(true);
      const timer = setTimeout(() => setBumping(false), 200);
      return () => clearTimeout(timer);
    }
  }, [value]);

  return bumping;
}
