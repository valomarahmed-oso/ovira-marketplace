import { Ionicons } from "@expo/vector-icons";
import { View } from "react-native";

import { dict } from "../i18n";
import { useTheme } from "../theme-context";
import { Pill, Screen, Txt, VStack } from "./ui";

/**
 * A tab that exists but isn't built yet.
 *
 * It says so plainly instead of showing an empty list, because an empty list is
 * indistinguishable from a broken one — the same confusion that made a failed
 * API read look like "no results" on the storefront for days.
 */
export function Soon({
  icon,
  title,
  detail,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  detail?: string;
}) {
  const { c, space, radius } = useTheme();
  const t = dict();

  return (
    <Screen scroll={false} style={{ alignItems: "center", justifyContent: "center" }}>
      <VStack gap="lg" style={{ alignItems: "center", maxWidth: 320 }}>
        <View
          style={{
            width: 76,
            height: 76,
            borderRadius: radius.xl,
            backgroundColor: c.blue050,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Ionicons name={icon} size={34} color={c.blue} />
        </View>
        <VStack gap="xs" style={{ alignItems: "center" }}>
          <Txt variant="title" style={{ textAlign: "center" }}>
            {title}
          </Txt>
          <Txt variant="body" tone="faint" style={{ textAlign: "center" }}>
            {detail ?? t.soonBody}
          </Txt>
        </VStack>
        <View style={{ marginTop: space.xs }}>
          <Pill label={t.soon} />
        </View>
      </VStack>
    </Screen>
  );
}
