import { buyerThreads, type ThreadSummary } from "@ovira/core";
import { Stack, useFocusEffect, useRouter } from "expo-router";
import { useCallback, useState } from "react";
import { Pressable, View } from "react-native";

import { Empty, Loading } from "../../src/components/states";
import { Card, Row, Screen, Txt, VStack } from "../../src/components/ui";
import { dict, formatDate, num } from "../../src/i18n";
import { useSession } from "../../src/session";
import { useTheme } from "../../src/theme-context";

/**
 * Conversations with sellers, one per (order, seller).
 *
 * Scoped that way because that is what there is to talk about: an order from
 * three vendors is three conversations, and merging them would put a question
 * about one parcel in front of two sellers who cannot answer it.
 */
export default function MessagesScreen() {
  const t = dict();
  const { c, space } = useTheme();
  const router = useRouter();
  const user = useSession((s) => s.user);

  const [rows, setRows] = useState<ThreadSummary[]>([]);
  const [state, setState] = useState<"loading" | "ready">("loading");

  const load = useCallback(async () => {
    if (!user) {
      setRows([]);
      setState("ready");
      return;
    }
    setRows(await buyerThreads());
    setState("ready");
  }, [user]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  return (
    <>
      <Stack.Screen options={{ title: t.messages }} />
      <Screen>
        {state === "loading" ? (
          <Loading />
        ) : !user ? (
          <Empty icon="chatbubble-ellipses-outline" title={t.signInFirst} body={t.messagesSignIn} />
        ) : rows.length === 0 ? (
          <Empty
            icon="chatbubble-ellipses-outline"
            title={t.messagesEmpty}
            body={t.messagesEmptyBody}
          />
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
                          {thread.vendor_name || thread.vendor}
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
