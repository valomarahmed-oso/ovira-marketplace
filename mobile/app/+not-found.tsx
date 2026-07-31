import { Ionicons } from "@expo/vector-icons";
import { Link } from "expo-router";
import { Pressable, View } from "react-native";

import { Row, Screen, Txt, VStack } from "../src/components/ui";
import { dict } from "../src/i18n";
import { useTheme } from "../src/theme-context";

/**
 * Reached by a deep link to something that no longer exists — the mobile
 * equivalent of the category 404 on the web, which is exactly why it offers a
 * way out instead of a dead end.
 */
export default function NotFoundScreen() {
  const { c, space, radius } = useTheme();
  const t = dict();

  return (
    <Screen scroll={false} style={{ alignItems: "center", justifyContent: "center" }}>
      <VStack gap="lg" style={{ alignItems: "center" }}>
        <Ionicons name="compass-outline" size={56} color={c.ink400} />
        <Txt variant="title">{t.notFound}</Txt>
        <Link href="/" asChild>
          <Pressable
            style={{
              backgroundColor: c.blue,
              borderRadius: radius.pill,
              paddingHorizontal: space.xl,
              paddingVertical: space.md,
            }}
          >
            <Row gap="sm">
              <Ionicons name="arrow-back" size={16} color="#ffffff" />
              <Txt variant="label" tone="onBlue">
                {t.backHome}
              </Txt>
            </Row>
          </Pressable>
        </Link>
        <View />
      </VStack>
    </Screen>
  );
}
