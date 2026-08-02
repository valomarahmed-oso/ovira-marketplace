import { listDeals, type ProductCard } from "@ovira/core";
import { Ionicons } from "@expo/vector-icons";
import { Stack } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { RefreshControl, ScrollView, View } from "react-native";

import { Countdown } from "../src/components/countdown";
import { ProductTile } from "../src/components/product-card";
import { Empty, Loading } from "../src/components/states";
import { Row, Screen, Txt, VStack } from "../src/components/ui";
import { dict } from "../src/i18n";
import { useTheme } from "../src/theme-context";

/**
 * Live flash deals, soonest to expire first.
 *
 * Each card carries its own clock. A deals page without one is just a listing
 * with lower prices — the deadline is the reason the screen exists, and it is
 * also the honest part: when it hits zero the row drops out on the next read
 * rather than continuing to advertise a price the checkout will refuse.
 */
export default function DealsScreen() {
  const t = dict();
  const { c, space } = useTheme();

  const [rows, setRows] = useState<ProductCard[]>([]);
  const [state, setState] = useState<"loading" | "ready">("loading");
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    setRows(await listDeals(48));
    setState("ready");
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  return (
    <>
      <Stack.Screen options={{ title: t.deals }} />
      <Screen scroll={false}>
        {state === "loading" ? (
          <Loading />
        ) : (
          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ gap: space.lg, paddingBottom: space.xxl }}
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={c.blue} />
            }
          >
            {rows.length === 0 ? (
              <Empty
                icon="flame-outline"
                title={t.dealsEmpty}
                body={t.dealsEmptyBody}
                onRetry={() => void load()}
              />
            ) : (
              <>
                <Row gap="sm">
                  <Ionicons name="flame" size={18} color={c.coral} />
                  <Txt variant="heading">{t.dealsLive}</Txt>
                </Row>
                <View
                  style={{
                    flexDirection: "row",
                    flexWrap: "wrap",
                    gap: space.md,
                    justifyContent: "space-between",
                  }}
                >
                  {rows.map((product) => (
                    <VStack key={product.name} gap="xs" style={{ width: "48%" }}>
                      <ProductTile product={product} />
                      {/* `onExpire={load}`, not an arrow: a fresh closure each
                          render re-runs the expiry effect every tick, and a deal
                          that ended would refetch the list once a second until
                          the shopper navigated away. */}
                      {product.deal_ends_on && (
                        <Countdown endsOn={product.deal_ends_on} onExpire={load} />
                      )}
                    </VStack>
                  ))}
                </View>
              </>
            )}
          </ScrollView>
        )}
      </Screen>
    </>
  );
}
