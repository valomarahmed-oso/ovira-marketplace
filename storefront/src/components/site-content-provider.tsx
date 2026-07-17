"use client";

import { createContext, useContext } from "react";
import type { SiteContent } from "@/lib/api";

const SiteContentContext = createContext<SiteContent>({});

export function SiteContentProvider({
  content,
  children,
}: {
  content: SiteContent;
  children: React.ReactNode;
}) {
  return <SiteContentContext.Provider value={content}>{children}</SiteContentContext.Provider>;
}

export function useSiteContent(): SiteContent {
  return useContext(SiteContentContext);
}

/** The operator-set brand name, or the built-in default. */
export function useBrand(): string {
  return useSiteContent().brand_name || "أوفيرا";
}
