import { Ionicons } from "@expo/vector-icons";
import { Stack, useRouter } from "expo-router";
import { Pressable, View } from "react-native";

import { ProductGrid } from "../src/components/product-grid";
import { Empty } from "../src/components/states";
import { Row, Screen, Txt, VStack } from "../src/components/ui";
import { dict, num } from "../src/i18n";
import { useTheme } from "../src/theme-context";
import { useWishlist } from "../src/wishlist-store";

/** Saved items. Reads straight from the device — nothing to load, nothing to fail. */
export default function WishlistScreen() {
  const t = dict();
  const { c, space, radius } = useTheme();
  const router = useRouter();

  const items = useWishlist((s) => s.items);
  const clear = useWishlist((s) => s.clear);

  return (
    <>
      <Stack.Screen options={{ title: t.wishlist }} />
      <Screen>
        {items.length === 0 ? (
          <Empty
            icon="heart-outline"
            title={t.wishEmpty}
            body={t.wishEmptyBody}
            onRetry={() => router.push("/products")}
            actionLabel={t.wishBrowse}
          />
        ) : (
          <VStack gap="lg" style={{ paddingBottom: space.xxl }}>
            <Row justify="space-between">
              <Txt variant="label" tone="faint">
                {num(items.length)} {t.wishSaved}
              </Txt>
              <Pressable onPress={clear} hitSlop={8}>
                <Row gap="xs">
                  <Ionicons name="trash-outline" size={14} color={c.ink400} />
                  <Txt variant="label" tone="faint">
                    {t.clearAll}
                  </Txt>
                </Row>
              </Pressable>
            </Row>

            <ProductGrid products={items} />

            <Pressable onPress={() => router.push("/compare")} style={{ alignItems: "center" }}>
              <View
                style={{
                  borderWidth: 1,
                  borderColor: c.blue,
                  borderRadius: radius.pill,
                  paddingHorizontal: space.xl,
                  paddingVertical: space.sm,
                }}
              >
                <Txt variant="label" tone="blue">
                  {t.compareOpen}
                </Txt>
              </View>
            </Pressable>
          </VStack>
        )}
      </Screen>
    </>
  );
}
