"use client";

import { createContext, useContext } from "react";
import type { AppConfig } from "@/lib/api";

const ConfigContext = createContext<AppConfig | null>(null);

export function AppConfigProvider({
  config,
  children,
}: {
  config: AppConfig;
  children: React.ReactNode;
}) {
  return <ConfigContext.Provider value={config}>{children}</ConfigContext.Provider>;
}

export function useAppConfig(): AppConfig {
  return (
    useContext(ConfigContext) ?? { multiVendor: true, currency: "EGP", autoApproveVendors: false }
  );
}
