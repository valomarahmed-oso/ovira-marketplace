import type { Order } from "@ovira/core";
import { myOrders } from "@ovira/core";
import { Link, Stack } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { Pressable, RefreshControl, ScrollView } from "react-native";

import { OrderStatusPill } from "../../src/components/order-status";
import { Empty, Loading } from "../../src/components/states";
import { Card, Row, Screen, Txt, VStack } from "../../src/components/ui";
import { dict, fill, formatDate, money, num } from "../../src/i18n";
import { useTheme } from "../../src/theme-context";

export default function OrdersScreen() {
  const { c, space } = useTheme();
  const t = dict();

  const [orders, setOrders] = useState<Order[]>([]);
  const [state, setState] = useState<"loading" | "ready">("loading");
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    setOrders(await myOrders());
    setState("ready");
  }, []);

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
