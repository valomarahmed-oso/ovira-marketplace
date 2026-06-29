"use client";

import { useEffect, useState } from "react";

/** True only after the first client render — guards persisted (localStorage) state
 * from causing SSR/CSR hydration mismatches. */
export function useHydrated() {
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => setHydrated(true), []);
  return hydrated;
}
