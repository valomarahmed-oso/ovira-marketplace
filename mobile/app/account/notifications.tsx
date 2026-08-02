import {
  markAllNotificationsRead,
  markNotificationRead,
  myNotifications,
  type Notification,
} from "@ovira/core";
import { Ionicons } from "@expo/vector-icons";
import { Stack, useRouter } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { Pressable, RefreshControl, ScrollView, View } from "react-native";

import { Empty, Loading } from "../../src/components/states";
import { Card, Row, Screen, Txt, VStack } from "../../src/components/ui";
import { routeForNotification } from "../../src/deep-links";
import { dict, formatDate } from "../../src/i18n";
import { useSession } from "../../src/session";
import { useTheme } from "../../src/theme-context";

/** Icons by notification kind. An unknown kind still gets a bell, not a gap. */
const ICONS: Record<string, keyof typeof Ionicons.glyphMap> = {
  order: "receipt-outline",
  shipment: "cube-outline",
  return: "refresh-outline",
  payout: "wallet-outline",
  message: "chatbubble-ellipses-outline",
  support: "chatbubbles-outline",
  stock: "notifications-outline",
  review: "star-outline",
};

export default function NotificationsScreen() {
  const t = dict();
  const { c, space } = useTheme();
  const router = useRouter();
  const user = useSession((s) => s.user);

  const [rows, setRows] = useState<Notification[]>([]);
  const [state, setState] = useState<"loading" | "ready">("loading");
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (!user) {
      setRows([]);
      setState("ready");
      return;
    }
    setRows(await myNotifications());
    setState("ready");
  }, [user]);

  useEffect(() => {
    void load();
  }, [load]);

  const open = useCallback(
    async (notification: Notification) => {
      // Marked read locally first: the row should stop looking new the instant
      // it is tapped, not after a round trip that may be about to navigate away.
      if (!notification.is_read) {
        setRows((current) =>
          current.map((n) => (n.name === notification.name ? { ...n, is_read: 1 } : n)),
        );
        void markNotificationRead(notification.name).catch(() => {});
      }
      const route = routeForNotification(
        notification.reference_doctype,
        notification.reference_name,
      );
      if (route) router.push(route as never);
    },
    [router],
  );

  const markAll = useCallback(async () => {
    setRows((current) => current.map((n) => ({ ...n, is_read: 1 as const })));
    try {
      await markAllNotificationsRead();
    } catch {
      await load();
    }
  }, [load]);

  const unread = rows.filter((n) => !n.is_read).length;

  return (
    <>
      <Stack.Screen options={{ title: t.notifications }} />
      <Screen scroll={false}>
        {state === "loading" ? (
          <Loading />
        ) : !user ? (
          <Empty icon="notifications-outline" title={t.signInFirst} body={t.notificationsSignIn} />
        ) : (
          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ gap: space.md, paddingBottom: space.xxl }}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={async () => {
                  setRefreshing(true);
                  await load();
                  setRefreshing(false);
                }}
                tintColor={c.blue}
              />
            }
          >
            {unread > 0 && (
              <Pressable onPress={() => void markAll()} style={{ alignSelf: "flex-start" }}>
                <Txt variant="label" tone="blue">
                  {t.notificationsMarkAll}
                </Txt>
              </Pressable>
            )}

            {rows.length === 0 ? (
              <Empty
                icon="notifications-outline"
                title={t.notificationsEmpty}
                body={t.notificationsEmptyBody}
              />
            ) : (
              rows.map((notification) => (
                <Pressable key={notification.name} onPress={() => void open(notification)}>
                  <Card
                    style={
                      notification.is_read ? undefined : { borderColor: c.blue, borderWidth: 1.5 }
                    }
                  >
                    <Row gap="md" align="flex-start">
                      <View
                        style={{
                          width: 36,
                          height: 36,
                          borderRadius: 18,
                          backgroundColor: c.blue050,
                          alignItems: "center",
                          justifyContent: "center",
                        }}
                      >
                        <Ionicons
                          name={ICONS[notification.kind] ?? "notifications-outline"}
                          size={18}
                          color={c.blue}
                        />
                      </View>
                      <VStack gap="xs" style={{ flex: 1 }}>
                        <Txt variant="label">{notification.title}</Txt>
                        {!!notification.message && (
                          <Txt variant="caption" tone="muted">
                            {notification.message}
                          </Txt>
                        )}
                        <Txt variant="caption" tone="faint">
                          {formatDate(notification.creation)}
                        </Txt>
                      </VStack>
                      {!notification.is_read && (
                        <View
                          style={{
                            width: 8,
                            height: 8,
                            borderRadius: 4,
                            backgroundColor: c.blue,
                            marginTop: 6,
                          }}
                        />
                      )}
                    </Row>
                  </Card>
                </Pressable>
              ))
            )}
          </ScrollView>
        )}
      </Screen>
    </>
  );
}
