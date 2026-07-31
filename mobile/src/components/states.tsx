import { Ionicons } from "@expo/vector-icons";
import { ActivityIndicator, Pressable, View } from "react-native";

import { dict } from "../i18n";
import { useTheme } from "../theme-context";
import { Txt, VStack } from "./ui";

export function Loading({ pad = 48 }: { pad?: number }) {
  const { c } = useTheme();
  return <ActivityIndicator color={c.blue} style={{ marginVertical: pad }} />;
}

/**
 * Nothing to show — and which kind of nothing.
 *
 * "No results" and "the request failed" look identical if you render an empty
 * list for both, and this store has already paid for that confusion once: a
 * support queue that threw on every request showed a calm "no tickets" for
 * days. A failure gets its own words and a retry; an empty result gets neither.
 */
export function Empty({
  icon = "cube-outline",
  title,
  body,
  onRetry,
}: {
  icon?: keyof typeof Ionicons.glyphMap;
  title: string;
  body?: string;
  onRetry?: () => void;
}) {
  const { c, space, radius } = useTheme();
  const t = dict();

  return (
    <VStack gap="md" style={{ alignItems: "center", paddingVertical: space.xxl }}>
      <View
        style={{
          width: 64,
          height: 64,
          borderRadius: radius.xl,
          backgroundColor: c.blue050,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Ionicons name={icon} size={28} color={c.ink400} />
      </View>
      <Txt variant="heading" style={{ textAlign: "center" }}>
        {title}
      </Txt>
      {body && (
        <Txt variant="body" tone="faint" style={{ textAlign: "center", maxWidth: 280 }}>
          {body}
        </Txt>
      )}
      {onRetry && (
        <Pressable
          onPress={onRetry}
          style={{
            marginTop: space.xs,
            borderRadius: radius.pill,
            borderWidth: 1,
            borderColor: c.blue,
            paddingHorizontal: space.xl,
            paddingVertical: space.sm,
          }}
        >
          <Txt variant="label" tone="blue">
            {t.retry}
          </Txt>
        </Pressable>
      )}
    </VStack>
  );
}

/** The read failed. Says so, and offers the only useful action. */
export function Failed({ onRetry }: { onRetry?: () => void }) {
  const t = dict();
  return <Empty icon="cloud-offline-outline" title={t.loadFailed} onRetry={onRetry} />;
}
