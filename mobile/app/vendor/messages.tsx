import { vendorThreads, type ThreadSummary } from "@ovira/core";
import { Stack, useFocusEffect, useRouter } from "expo-router";
import { useCallback, useState } from "react";
import { Pressable, View } from "react-native";

import { Empty, Loading } from "../../src/components/states";
import { Card, Row, Screen, Txt, VStack } from "../../src/components/ui";
import { dict, formatDate, num } from "../../src/i18n";
import { useTheme } from "../../src/theme-context";
import { useVendorAccess } from "../../src/vendor-access";

/**
 * The seller's inbox — buyers asking about their orders.
 *
 * The same thread the buyer sees from the other side, and the same screen
 * renders it; only the list differs, because a seller's list is grouped by who
 * is asking rather than by which shop they asked.
 */
export default function VendorMessagesScreen() {
  const t = dict();
  const { c, space } = useTheme();
  const router = useRouter();
  const access = useVendorAccess();

  const [rows, setRows] = useState<ThreadSummary[]>([]);
  const [state, setState] = useState<"loading" | "ready">("loading");

  const load = useCallback(async () => {
    if (!access.show) {
      setState(access.reason === "loading" ? "loading" : "ready");
      return;
    }
    setRows(await vendorThreads());
    setState("ready");
  }, [access]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  if (!access.show) {
    return (
      <>
        <Stack.Screen options={{ title: t.vmTitle }} />
        <Screen scroll={false}>
          {access.reason === "loading" ? (
            <Loading />
          ) : (
            <Empty icon="chatbubble-ellipses-outline" title={t.vendorNotSeller} />
          )}
        </Screen>
      </>
    );
  }

  return (
    <>
      <Stack.Screen options={{ title: t.vmTitle }} />
      <Screen>
        {state === "loading" ? (
          <Loading />
        ) : rows.length === 0 ? (
          <Empty icon="chatbubble-ellipses-outline" title={t.vmEmpty} body={t.vmEmptyBody} />
        ) : (
          <VStack gap="md" style={{ paddingBottom: space.xxl }}>
            {rows.map((thread) => (
              <Pressable
                key={`${thread.order}::${thread.vendor}`}
                onPress={() =>
                  router.push({
                    pathname: "/messages/[order]/[vendor]",
                    params: { order: thread.order, vendor: thread.vendor },
                  })
                }
              >
                <Card>
                  <VStack gap="sm">
                    <Row justify="space-between" align="flex-start">
                      <VStack gap="xs" style={{ flex: 1 }}>
                        <Txt variant="label" numberOfLines={1}>
                          {thread.buyer_name || t.vmBuyer}
                        </Txt>
                        <Txt variant="caption" tone="faint">
                          {thread.order}
                        </Txt>
                      </VStack>
                      {thread.unread > 0 && (
                        <View
                          style={{
                            minWidth: 20,
                            height: 20,
                            borderRadius: 10,
                            backgroundColor: c.coral,
                            alignItems: "center",
                            justifyContent: "center",
                            paddingHorizontal: 5,
                          }}
                        >
                          <Txt variant="caption" tone="onBlue">
                            {num(thread.unread)}
                          </Txt>
                        </View>
                      )}
                    </Row>
                    <Txt variant="caption" tone="muted" numberOfLines={2}>
                      {thread.last_body}
                    </Txt>
                    <Txt variant="caption" tone="faint">
                      {formatDate(thread.last_date)}
                    </Txt>
                  </VStack>
                </Card>
              </Pressable>
            ))}
          </VStack>
        )}
      </Screen>
    </>
  );
}
