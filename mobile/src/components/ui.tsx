import type { ReactNode } from "react";
import {
  ScrollView,
  Text,
  View,
  type StyleProp,
  type TextStyle,
  type ViewStyle,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import type { typography } from "../theme";
import { useTheme } from "../theme-context";

type Variant = keyof typeof typography;
type Tone = "ink" | "muted" | "faint" | "blue" | "coral" | "mint" | "onBlue";

/**
 * Themed text.
 *
 * Every string in the app goes through here rather than through raw `<Text>`,
 * because two things must be true of all of them and are easy to forget one at
 * a time: the colour has to come from the palette (or dark mode renders black
 * on black), and Arabic has to be told it is Arabic — React Native will
 * otherwise align a mixed Arabic/Latin line by its first strong character, so
 * a product title starting with "iPhone" jumps to the left of a right-aligned
 * column.
 */
export function Txt({
  children,
  variant = "body",
  tone = "ink",
  style,
  numberOfLines,
}: {
  children: ReactNode;
  variant?: Variant;
  tone?: Tone;
  style?: StyleProp<TextStyle>;
  numberOfLines?: number;
}) {
  const { c, typography: scale } = useTheme();
  const colors: Record<Tone, string> = {
    ink: c.ink,
    muted: c.ink600,
    faint: c.ink400,
    blue: c.blue,
    coral: c.coral,
    mint: c.mint,
    onBlue: "#ffffff",
  };
  const t = scale[variant];
  return (
    <Text
      numberOfLines={numberOfLines}
      style={[
        {
          fontSize: t.fontSize,
          lineHeight: t.lineHeight,
          fontWeight: t.fontWeight,
          color: colors[tone],
          textAlign: "right",
          writingDirection: "rtl",
        },
        style,
      ]}
    >
      {children}
    </Text>
  );
}

/** A page. Handles the notch, the canvas colour and the tab bar's shadow line. */
export function Screen({
  children,
  scroll = true,
  style,
}: {
  children?: ReactNode;
  scroll?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const { c, space } = useTheme();
  const insets = useSafeAreaInsets();
  const padding = {
    paddingTop: insets.top + space.md,
    paddingHorizontal: space.lg,
    // The tab bar floats over the content; without this the last card is
    // permanently half-hidden behind it.
    paddingBottom: space.xxl,
  };

  if (!scroll) {
    return <View style={[{ flex: 1, backgroundColor: c.canvas }, padding, style]}>{children}</View>;
  }
  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: c.canvas }}
      contentContainerStyle={[padding, style]}
      showsVerticalScrollIndicator={false}
    >
      {children}
    </ScrollView>
  );
}

/** The surface every piece of content sits on. */
export function Card({
  children,
  style,
  padded = true,
}: {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  padded?: boolean;
}) {
  const { c, radius, space, shadow } = useTheme();
  return (
    <View
      style={[
        {
          backgroundColor: c.surface,
          borderRadius: radius.lg,
          borderWidth: 1,
          borderColor: c.line,
          padding: padded ? space.lg : 0,
          overflow: "hidden",
        },
        shadow(1),
        style,
      ]}
    >
      {children}
    </View>
  );
}

/** A small status word — "متصل", "قريبًا", a stock warning. */
export function Pill({ label, tone = "blue" }: { label: string; tone?: "blue" | "mint" | "coral" }) {
  const { c, radius, space } = useTheme();
  const bg = { blue: c.blue050, mint: c.blue050, coral: c.coral050 }[tone];
  const fg = { blue: c.blue, mint: c.mint, coral: c.coral }[tone];
  return (
    <View
      style={{
        alignSelf: "flex-start",
        backgroundColor: bg,
        borderRadius: radius.pill,
        paddingHorizontal: space.md,
        paddingVertical: space.xs,
      }}
    >
      <Text style={{ color: fg, fontSize: 11, fontWeight: "600", writingDirection: "rtl" }}>
        {label}
      </Text>
    </View>
  );
}

/** Vertical rhythm without a `marginBottom` on every child. */
export function VStack({
  children,
  gap = "lg",
  style,
}: {
  children: ReactNode;
  gap?: keyof ReturnType<typeof useTheme>["space"];
  style?: StyleProp<ViewStyle>;
}) {
  const { space } = useTheme();
  return <View style={[{ gap: space[gap] }, style]}>{children}</View>;
}

/** A row that flips with the app's direction rather than against it. */
export function Row({
  children,
  gap = "md",
  align = "center",
  justify = "flex-start",
  style,
}: {
  children: ReactNode;
  gap?: keyof ReturnType<typeof useTheme>["space"];
  align?: ViewStyle["alignItems"];
  justify?: ViewStyle["justifyContent"];
  style?: StyleProp<ViewStyle>;
}) {
  const { space } = useTheme();
  return (
    <View
      style={[
        { flexDirection: "row", alignItems: align, justifyContent: justify, gap: space[gap] },
        style,
      ]}
    >
      {children}
    </View>
  );
}
