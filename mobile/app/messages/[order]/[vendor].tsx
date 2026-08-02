import { messageThread, postMessage, type Message } from "@ovira/core";
import { Stack, useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { KeyboardAvoidingView, Platform, View } from "react-native";

import { ChatComposer, ChatThread } from "../../../src/components/chat";
import { Loading } from "../../../src/components/states";
import { Row, Screen, Txt, VStack } from "../../../src/components/ui";
import { dict } from "../../../src/i18n";
import { useTheme } from "../../../src/theme-context";

/**
 * One conversation with one seller about one order.
 *
 * Both ids come from the route because the thread is identified by the pair —
 * the same seller on a different order is a different conversation, and the
 * server's read-marking is keyed the same way.
 */
export default function VendorThreadScreen() {
  const { order, vendor } = useLocalSearchParams<{ order: string; vendor: string }>();
  const t = dict();
  const { c, space } = useTheme();

  const [messages, setMessages] = useState<Message[]>([]);
  const [state, setState] = useState<"loading" | "ready">("loading");

  const load = useCallback(async () => {
    setMessages(await messageThread(String(order ?? ""), String(vendor ?? "")));
    setState("ready");
  }, [order, vendor]);

  useEffect(() => {
    void load();
  }, [load]);

  const send = useCallback(
    async (body: string) => {
      await postMessage(String(order), String(vendor), body);
      await load();
    },
    [order, vendor, load],
  );

  return (
    <>
      <Stack.Screen options={{ title: t.messages }} />
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <Screen scroll={false}>
          <VStack gap="sm" style={{ flex: 1 }}>
            <Row>
              <Txt variant="caption" tone="faint">
                {t.orderNumber} {String(order)}
              </Txt>
            </Row>
            <View style={{ height: 1, backgroundColor: c.line, marginTop: space.xs }} />

            <View style={{ flex: 1 }}>
              {state === "loading" ? <Loading /> : <ChatThread messages={messages} />}
            </View>

            <ChatComposer onSend={send} />
          </VStack>
        </Screen>
      </KeyboardAvoidingView>
    </>
  );
}
