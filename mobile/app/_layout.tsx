import {
  DarkTheme,
  DefaultTheme,
  Stack,
  ThemeProvider as NavigationThemeProvider,
} from "expo-router";
import * as Notifications from "expo-notifications";
import { useRouter } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { AppLock } from "../src/app-lock";
import { routeFor } from "../src/deep-links";
import { dict } from "../src/i18n";
import { urlFromNotification } from "../src/notifications";
import { configureOvira } from "../src/ovira";
import { ensureRtl } from "../src/rtl";
import { useSession } from "../src/session";
import { ThemeProvider, useTheme } from "../src/theme-context";
import { usePush } from "../src/use-push";

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
          {/* Outside the navigator on purpose: the lock must cover whatever
              screen the app was left on, including a half-finished checkout. */}
          <AppLock>
            <Shell />
          </AppLock>
        </ThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

function Shell() {
  const { c, scheme } = useTheme();
  const t = dict();

  const refreshSession = useSession((s) => s.refresh);
  const router = useRouter();

  // Registers this phone for order updates once someone is signed in, and
  // releases it when they sign out.
  usePush();

  useEffect(() => {
    // Ask who is signed in before the splash goes, so no screen has to render a
    // guest state it is about to replace.
    void refreshSession().finally(() => {
      SplashScreen.hideAsync().catch(() => {});
    });
  }, [refreshSession]);

  /**
   * A tapped notification must land on the thing it was about.
   *
   * Two cases, and missing either one is a dead end: the app was already
   * running (the listener fires), or the tap is what launched it — then there
   * is no event to hear, and the response has to be asked for.
   */
  useEffect(() => {
    const go = (url: string | null) => {
      if (!url) return;
      router.push(routeFor(url) as never);
    };

    void Notifications.getLastNotificationResponseAsync().then((response) => {
      go(urlFromNotification(response));
    });

    const sub = Notifications.addNotificationResponseReceivedListener((response) => {
      go(urlFromNotification(response));
    });
    return () => sub.remove();
  }, [router]);

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
        {/* Checkout is a modal-ish push: it is a task with a beginning and an
            end, not a place in the app you browse to and stay. */}
        <Stack.Screen name="checkout" options={{ title: t.checkout }} />
        <Stack.Screen name="scan" options={{ title: t.scan }} />
        <Stack.Screen name="+not-found" options={{ title: t.notFound }} />
      </Stack>
    </NavigationThemeProvider>
  );
}
