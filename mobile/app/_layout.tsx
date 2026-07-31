import {
  DarkTheme,
  DefaultTheme,
  Stack,
  ThemeProvider as NavigationThemeProvider,
} from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { dict } from "../src/i18n";
import { configureOvira } from "../src/ovira";
import { ensureRtl } from "../src/rtl";
import { ThemeProvider, useTheme } from "../src/theme-context";

// Both of these decide how the first frame is drawn, so they run while the
// module loads rather than in an effect — an effect is already too late.
ensureRtl();
configureOvira();

SplashScreen.preventAutoHideAsync().catch(() => {
  /* already hidden, or the module isn't available on web */
});

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <ThemeProvider>
          <Shell />
        </ThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

function Shell() {
  const { c, scheme } = useTheme();
  const t = dict();

  useEffect(() => {
    SplashScreen.hideAsync().catch(() => {});
  }, []);

  /**
   * React Navigation paints the frame *around* our screens — the space behind a
   * push animation, the gap under a short screen — from its own theme, not
   * ours. Left at its default it stayed light grey (#f2f2f2) behind a dark app,
   * which shows as a pale flash on every transition.
   */
  const base = scheme === "dark" ? DarkTheme : DefaultTheme;
  const navTheme = {
    ...base,
    colors: {
      ...base.colors,
      primary: c.blue,
      background: c.canvas,
      card: c.surface,
      text: c.ink,
      border: c.line,
    },
  };

  return (
    <NavigationThemeProvider value={navTheme}>
      {/* Dark canvas needs light glyphs in the status bar and vice versa;
          getting this backwards makes the clock invisible, not merely ugly. */}
      <StatusBar style={scheme === "dark" ? "light" : "dark"} />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: c.surface },
          headerTintColor: c.ink,
          headerTitleStyle: { fontWeight: "600" },
          contentStyle: { backgroundColor: c.canvas },
        }}
      >
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="+not-found" options={{ title: t.notFound }} />
      </Stack>
    </NavigationThemeProvider>
  );
}
