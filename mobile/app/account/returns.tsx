import { myReturns, type ReturnRequest } from "@ovira/core";
import { Ionicons } from "@expo/vector-icons";
import { Stack, useRouter } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { Pressable } from "react-native";

import { returnReasonLabel, ReturnStatusPill } from "../../src/components/return-status";
import { Empty, Loading } from "../../src/components/states";
import { Card, Row, Screen, Txt, VStack } from "../../src/components/ui";
import { dict, formatDate, money } from "../../src/i18n";
import { useSession } from "../../src/session";
import { useTheme } from "../../src/theme-context";

/**
 * Every return this shopper has asked for, and where each one got to.
 *
 * The refund figure only appears once there is one. Showing "٠ ج.م" against a
 * request still under review reads as a decision that has been made, and the
 * whole reason someone opens this screen is to find out whether it has.
 */
export default function ReturnsScreen() {
  const t = dict();
  const { space } = useTheme();
  const user = useSession((s) => s.user);

  const [rows, setRows] = useState<ReturnRequest[]>([]);
  const [state, setState] = useState<"loading" | "ready">("loading");

  const load = useCallback(async () => {
    if (!user) {
      setRows([]);
      setState("ready");
      return;
    }
    setRows(await myReturns());
    setState("ready");
  }, [user]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <>
      <Stack.Screen options={{ title: t.returns }} />
      <Screen>
        {state === "loading" ? (
          <Loading />
        ) : !user ? (
          <Empty icon="refresh-outline" title={t.signInFirst} body={t.returnsSignIn} />
        ) : rows.length === 0 ? (
          <Empty icon="refresh-outline" title={t.returnsEmpty} body={t.returnsEmptyBody} />
        ) : (
          <VStack gap="md" style={{ paddingBottom: space.xxl }}>
            {rows.map((request) => (
              <ReturnCard key={request.name} request={request} />
            ))}
          </VStack>
        )}
      </Screen>
    </>
  );
}

function ReturnCard({ request }: { request: ReturnRequest }) {
  const t = dict();
  const { c } = useTheme();
  const router = useRouter();

  return (
    <Card>
      <VStack gap="md">
        <Row justify="space-between">
          <VStack gap="xs">
            <Txt variant="label">{request.order}</Txt>
            {!!request.date && (
              <Txt variant="caption" tone="faint">
                {formatDate(request.date)}
              </Txt>
            )}
          </VStack>
          <ReturnStatusPill status={request.status} />
        </Row>

        <VStack gap="xs">
          <Txt variant="caption" tone="faint">
            {t.returnReason}
          </Txt>
          <Txt variant="body">{returnReasonLabel(request.reason)}</Txt>
          {!!request.details && (
            <Txt variant="caption" tone="muted">
              {request.details}
            </Txt>
          )}
        </VStack>

        {/* The operator's decision, in their words. A rejection with no reason
            attached is the thing that generates a support ticket. */}
        {!!request.operator_note && (
          <VStack gap="xs">
            <Txt variant="caption" tone="faint">
              {t.returnNote}
            </Txt>
            <Txt variant="body" tone="muted">
              {request.operator_note}
            </Txt>
          </VStack>
        )}

        {!!request.refund_amount && request.refund_amount > 0 && (
          <Row justify="space-between">
            <Txt variant="label" tone="muted">
              {t.returnRefunded}
            </Txt>
            <Txt variant="label" tone="mint">
              {money(request.refund_amount)}
            </Txt>
          </Row>
        )}

        <Pressable
          onPress={() =>
            router.push({ pathname: "/order/[name]", params: { name: request.order } })
          }
        >
          <Row gap="xs">
            <Ionicons name="receipt-outline" size={14} color={c.blue} />
            <Txt variant="label" tone="blue">
              {t.returnViewOrder}
            </Txt>
          </Row>
        </Pressable>
      </VStack>
    </Card>
  );
}
