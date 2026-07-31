import type { Order } from "@ovira/core";
import { myOrders, trackOrder } from "@ovira/core";
import { Link, Stack } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { Pressable, RefreshControl, ScrollView } from "react-native";

import { OrderStatusPill } from "../../src/components/order-status";
import { Empty, Loading } from "../../src/components/states";
import { Card, Row, Screen, Txt, VStack } from "../../src/components/ui";
import { guestOrderNames, useGuestOrders } from "../../src/guest-orders";
import { dict, fill, formatDate, money, num } from "../../src/i18n";
import { useSession } from "../../src/session";
import { useTheme } from "../../src/theme-context";

export default function OrdersScreen() {
  const { c, space } = useTheme();
  const user = useSession((s) => s.user);
  const tokens = useGuestOrders((s) => s.tokens);
  const t = dict();

  const [orders, setOrders] = useState<Order[]>([]);
  const [state, setState] = useState<"loading" | "ready">("loading");
  const [refreshing, setRefreshing] = useState(false);

  /**
   * Signed in, the server lists your orders. Signed out, it can't — a guest has
   * no identity to list by — so the app looks up each order it holds a token
   * for. Otherwise someone who checked out as a guest has no way back to the
   * delivery they are waiting for.
   */
  const load = useCallback(async () => {
    if (user) {
      setOrders(await myOrders());
    } else {
      const found = await Promise.all(
        guestOrderNames(tokens).map((name) => trackOrder({ name, token: tokens[name] })),
      );
      setOrders(found.filter((o): o is Order => !!o));
    }
    setState("ready");
  }, [user, tokens]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <>
      <Stack.Screen options={{ title: t.myOrders }} />
      <Screen scroll={false}>
        {state === "loading" ? (
          <Loading />
        ) : orders.length === 0 ? (
          <Empty icon="receipt-outline" title={t.noOrders} body={t.noOrdersBody} />
        ) : (
          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ gap: space.md, paddingBottom: space.xxl }}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                tintColor={c.blue}
                onRefresh={async () => {
                  setRefreshing(true);
                  await load();
                  setRefreshing(false);
                }}
              />
            }
          >
            {orders.map((order) => (
              <Link
                key={order.name}
                href={{ pathname: "/order/[name]", params: { name: order.name } }}
                asChild
              >
                <Pressable>
                  <Card>
                    <VStack gap="sm">
                      <Row justify="space-between">
                        <Txt variant="label">{order.name}</Txt>
                        <OrderStatusPill status={order.status} />
                      </Row>
                      <Row justify="space-between">
                        <Txt variant="caption" tone="faint">
                          {formatDate(order.creation)}
                        </Txt>
                        <Txt variant="heading" tone="blue">
                          {money(order.total)}
                        </Txt>
                      </Row>
                      {!!order.items?.length && (
                        <Txt variant="caption" tone="faint">
                          {fill(t.orderItems, { n: num(order.items.length) })}
                        </Txt>
                      )}
                    </VStack>
                  </Card>
                </Pressable>
              </Link>
            ))}
          </ScrollView>
        )}
      </Screen>
    </>
  );
}
