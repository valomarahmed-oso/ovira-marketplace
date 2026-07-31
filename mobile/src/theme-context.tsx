import { createContext, useContext, useMemo, type ReactNode } from "react";
import { useColorScheme } from "react-native";

import { cardShadow, dark, light, radius, space, typography, type Palette } from "./theme";

export type Theme = {
  scheme: "light" | "dark";
  c: Palette;
  space: typeof space;
  radius: typeof radius;
  typography: typeof typography;
  shadow: (level?: 1 | 2) => ReturnType<typeof cardShadow>;
};

const ThemeContext = createContext<Theme | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  // The device decides. An e-commerce app that ignores the system setting looks
  // broken at night next to every other app on the phone.
  const scheme = useColorScheme() === "dark" ? "dark" : "light";
  const value = useMemo<Theme>(() => {
    const c = scheme === "dark" ? dark : light;
    return { scheme, c, space, radius, typography, shadow: (level = 1) => cardShadow(c, level) };
  }, [scheme]);
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): Theme {
  const value = useContext(ThemeContext);
  if (!value) throw new Error("useTheme must be used inside <ThemeProvider>");
  return value;
}
