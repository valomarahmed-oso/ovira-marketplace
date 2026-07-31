import { Ionicons } from "@expo/vector-icons";
import { Tabs } from "expo-router";
import { Platform } from "react-native";

import { cartCount, useCart } from "../../src/cart-store";
import { dict, num } from "../../src/i18n";
import { useTheme } from "../../src/theme-context";

/**
 * Four tabs, in the order the storefront's header reads them.
 *
 * Declaration order is left alone deliberately: React Native reverses a row
 * when the app is RTL, so writing them backwards here to "fix" the order would
 * put them backwards again the moment the native RTL flag is on. See `src/rtl.ts`.
 */
export default function TabsLayout() {
  const { c, typography } = useTheme();
  const t = dict();
  const units = useCart((s) => cartCount(s.lines));

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: c.blue,
        tabBarInactiveTintColor: c.ink400,
        tabBarStyle: {
          backgroundColor: c.surface,
          borderTopColor: c.line,
          // A hairline is 0.5–1px depending on density; RN's 1 is too heavy here.
          borderTopWidth: Platform.OS === "web" ? 1 : 0.5,
          height: Platform.OS === "ios" ? 88 : 62,
          paddingTop: 6,
        },
        tabBarLabelStyle: {
          fontSize: typography.caption.fontSize,
          fontWeight: "600",
          // Arabic labels clip on their descenders at the default line height.
          lineHeight: 16,
        },
        tabBarItemStyle: { paddingVertical: 2 },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: t.tabHome,
          tabBarIcon: ({ color, focused, size }) => (
            <Ionicons name={focused ? "home" : "home-outline"} color={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="search"
        options={{
          title: t.tabSearch,
          tabBarIcon: ({ color, focused, size }) => (
            <Ionicons name={focused ? "search" : "search-outline"} color={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="cart"
        options={{
          title: t.tabCart,
          // Zero is deliberately no badge rather than a badge reading "0" — an
          // empty cart should look empty at a glance.
          tabBarBadge: units > 0 ? num(units) : undefined,
          tabBarBadgeStyle: { backgroundColor: c.coral, color: "#ffffff", fontSize: 10 },
          tabBarIcon: ({ color, focused, size }) => (
            <Ionicons name={focused ? "cart" : "cart-outline"} color={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="account"
        options={{
          title: t.tabAccount,
          tabBarIcon: ({ color, focused, size }) => (
            <Ionicons name={focused ? "person" : "person-outline"} color={color} size={size} />
          ),
        }}
      />
    </Tabs>
  );
}
