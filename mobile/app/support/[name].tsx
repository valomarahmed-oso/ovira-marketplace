import { replyToTicket, setTicketStatus, ticketThread, type TicketThread } from "@ovira/core";
import { Stack, useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { KeyboardAvoidingView, Platform, Pressable, View } from "react-native";

import { ChatComposer, ChatThread } from "../../src/components/chat";
import { Empty, Loading } from "../../src/components/states";
import { ticketCategoryLabel, TicketStatusPill } from "../../src/components/ticket-status";
import { Row, Screen, Txt, VStack } from "../../src/components/ui";
import { dict } from "../../src/i18n";
import { useTheme } from "../../src/theme-context";

/** One support conversation. Opening it marks the store's replies as read. */
export default function TicketScreen() {
  const { name } = useLocalSearchParams<{ name: string }>();
  const t = dict();
  const { c, space } = useTheme();

  const [thread, setThread] = useState<TicketThread | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "missing">("loading");

  const load = useCallback(async () => {
    const found = await ticketThread(String(name ?? ""));
    setThread(found);
    setState(found ? "ready" : "missing");
  }, [name]);

  useEffect(() => {
    void load();
  }, [load]);

  const send = useCallback(
    async (body: string) => {
      await replyToTicket(String(name), body);
      await load();
    },
    [name, load],
  );

  const close = useCallback(async () => {
    try {
      await setTicketStatus(String(name), "Closed");
      await load();
    } catch {
      /* the status line still shows the truth after the reload */
    }
  }, [name, load]);

  if (state === "loading") {
    return (
      <Screen scroll={false}>
        <Loading />
      </Screen>
    );
  }

  if (state === "missing" || !thread) {
    return (
      <>
        <Stack.Screen options={{ title: t.support }} />
        <Screen scroll={false}>
          <Empty icon="chatbubbles-outline" title={t.ticketMissing} />
        </Screen>
      </>
    );
  }

  // A resolved or closed ticket is a record, not a conversation. Replying to
  // one silently reopens it server-side, so the composer goes away instead.
  const closed = thread.ticket.status === "Closed" || thread.ticket.status === "Resolved";

  return (
    <>
      <Stack.Screen options={{ title: thread.ticket.subject }} />
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <Screen scroll={false}>
          <VStack gap="sm" style={{ flex: 1 }}>
            <Row justify="space-between">
              <Row gap="sm">
                <TicketStatusPill status={thread.ticket.status} />
                <Txt variant="caption" tone="faint">
                  {ticketCategoryLabel(thread.ticket.category)}
                </Txt>
              </Row>
              {thread.can_close && !closed && (
                <Pressable onPress={() => void close()} hitSlop={8}>
                  <Txt variant="caption" tone="faint">
                    {t.ticketClose}
                  </Txt>
                </Pressable>
              )}
            </Row>

            <View style={{ height: 1, backgroundColor: c.line, marginTop: space.xs }} />

            <View style={{ flex: 1 }}>
              <ChatThread messages={thread.messages} />
            </View>

            <ChatComposer onSend={send} disabled={closed} />
          </VStack>
        </Screen>
      </KeyboardAvoidingView>
    </>
  );
}
