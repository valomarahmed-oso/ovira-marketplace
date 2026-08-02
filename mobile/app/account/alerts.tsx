import { myAlerts, unsubscribeStockAlert, type StockAlert } from "@ovira/core";
import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { Stack, useRouter } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { Pressable, View } from "react-native";

import { Empty, Loading } from "../../src/components/states";
import { Card, Pill, Row, Screen, Txt, VStack } from "../../src/components/ui";
import { dict, money } from "../../src/i18n";
import { useSession } from "../../src/session";
import { useTheme } from "../../src/theme-context";

/**
 * "Tell me when it's back."
 *
 * Two states per row and they are not the same thing: still waiting, or back
 * on the shelf. An alert that has fired keeps its row rather than vanishing —
 * the shopper asked to be told, and the answer is the point.
 */
export default function AlertsScreen() {
  const t = dict();
  const { space } = useTheme();
  const user = useSession((s) => s.user);

  const [rows, setRows] = useState<StockAlert[]>([]);
  const [state, setState] = useState<"loading" | "ready">("loading");

  const load = useCallback(async () => {
    if (!user) {
      setRows([]);
      setState("ready");
      return;
    }
    setRows(await myAlerts());
    setState("ready");
  }, [user]);

  useEffect(() => {
    void load();
  }, [load]);

  const drop = useCallback(async (slug: string) => {
    // Optimistic: the row goes now. The server call is a formality the shopper
    // should not have to watch, and a failed unsubscribe re-appears on reload.
    setRows((current) => current.filter((a) => a.slug !== slug));
    try {
      await unsubscribeStockAlert(slug);
    } catch {
      /* the next read is the source of truth */
    }
  }, []);

  return (
    <>
      <Stack.Screen options={{ title: t.alerts }} />
      <Screen>
        {state === "loading" ? (
          <Loading />
        ) : !user ? (
          <Empty icon="notifications-outline" title={t.signInFirst} body={t.alertsSignIn} />
        ) : rows.length === 0 ? (
          <Empty icon="notifications-outline" title={t.alertsEmpty} body={t.alertsEmptyBody} />
        ) : (
          <VStack gap="md" style={{ paddingBottom: space.xxl }}>
            {rows.map((alert) => (
              <AlertRow key={alert.alert} alert={alert} onRemove={() => void drop(alert.slug)} />
            ))}
          </VStack>
        )}
      </Screen>
    </>
  );
}

function AlertRow({ alert, onRemove }: { alert: StockAlert; onRemove: () => void }) {
  const t = dict();
  const { c, space, radius } = useTheme();
  const router = useRouter();

  return (
    <Card>
      <Row gap="md" align="flex-start">
        <Pressable
          onPress={() => router.push({ pathname: "/product/[slug]", params: { slug: alert.slug } })}
        >
          {alert.image ? (
            <Image
              source={alert.image}
              style={{ width: 56, height: 56, borderRadius: radius.md, backgroundColor: c.blue050 }}
              contentFit="cover"
              transition={150}
            />
          ) : (
            <View
              style={{
                width: 56,
                height: 56,
                borderRadius: radius.md,
                backgroundColor: c.blue050,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Ionicons name="cube-outline" size={22} color={c.blue} />
            </View>
          )}
        </Pressable>

        <VStack gap="xs" style={{ flex: 1 }}>
          <Pressable
            onPress={() =>
              router.push({ pathname: "/product/[slug]", params: { slug: alert.slug } })
            }
          >
            <Txt variant="label" numberOfLines={2}>
              {alert.title}
            </Txt>
          </Pressable>
          <Txt variant="caption" tone="blue">
            {money(alert.price)}
          </Txt>
          <View style={{ marginTop: space.xs }}>
            <Pill
              label={alert.available ? t.alertBack : t.alertWaiting}
              tone={alert.available ? "mint" : "blue"}
            />
          </View>
        </VStack>

        <Pressable onPress={onRemove} hitSlop={8}>
          <Ionicons name="close" size={18} color={c.ink400} />
        </Pressable>
      </Row>
    </Card>
  );
}
