import {
  createTicket,
  myTickets,
  TICKET_CATEGORIES,
  type Ticket,
  type TicketCategory,
} from "@ovira/core";
import { Ionicons } from "@expo/vector-icons";
import { Stack, useFocusEffect, useRouter } from "expo-router";
import { useCallback, useState } from "react";
import { Pressable, View } from "react-native";

import { Field, PrimaryButton } from "../../src/components/form";
import { Empty, Loading } from "../../src/components/states";
import { ticketCategoryLabel, TicketStatusPill } from "../../src/components/ticket-status";
import { Card, Row, Screen, Txt, VStack } from "../../src/components/ui";
import { dict, formatDate, num } from "../../src/i18n";
import { useSession } from "../../src/session";
import { useTheme } from "../../src/theme-context";

/**
 * The buyer ↔ store channel.
 *
 * Not the same thing as the seller chat, and the difference matters: a question
 * about a payment or a refund has no vendor to address, and sending it down the
 * per-order channel means the only person who can answer never sees it.
 */
export default function SupportScreen() {
  const t = dict();
  const { c, space } = useTheme();
  const router = useRouter();
  const user = useSession((s) => s.user);

  const [rows, setRows] = useState<Ticket[]>([]);
  const [state, setState] = useState<"loading" | "ready">("loading");
  const [composing, setComposing] = useState(false);

  const load = useCallback(async () => {
    if (!user) {
      setRows([]);
      setState("ready");
      return;
    }
    setRows(await myTickets());
    setState("ready");
  }, [user]);

  // Re-read on focus: coming back from a thread should show it as read, and
  // with the reply that was just sent as its last line.
  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  return (
    <>
      <Stack.Screen options={{ title: t.support }} />
      <Screen>
        {state === "loading" ? (
          <Loading />
        ) : !user ? (
          <Empty icon="chatbubbles-outline" title={t.signInFirst} body={t.supportSignIn} />
        ) : (
          <VStack gap="lg" style={{ paddingBottom: space.xxl }}>
            {composing ? (
              <NewTicket
                onCancel={() => setComposing(false)}
                onCreated={(ticket) => {
                  setComposing(false);
                  router.push({ pathname: "/support/[name]", params: { name: ticket.name } });
                }}
              />
            ) : (
              <PrimaryButton
                label={t.supportNew}
                icon="add-circle-outline"
                onPress={() => setComposing(true)}
              />
            )}

            {rows.length === 0 && !composing ? (
              <Empty icon="chatbubbles-outline" title={t.supportEmpty} body={t.supportEmptyBody} />
            ) : (
              <VStack gap="md">
                {rows.map((ticket) => (
                  <Pressable
                    key={ticket.name}
                    onPress={() =>
                      router.push({ pathname: "/support/[name]", params: { name: ticket.name } })
                    }
                  >
                    <Card>
                      <VStack gap="sm">
                        <Row justify="space-between" align="flex-start">
                          <Txt variant="label" style={{ flex: 1 }} numberOfLines={2}>
                            {ticket.subject}
                          </Txt>
                          {ticket.unread > 0 && (
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
                                {num(ticket.unread)}
                              </Txt>
                            </View>
                          )}
                        </Row>
                        <Row justify="space-between">
                          <Row gap="sm">
                            <TicketStatusPill status={ticket.status} />
                            <Txt variant="caption" tone="faint">
                              {ticketCategoryLabel(ticket.category)}
                            </Txt>
                          </Row>
                          <Txt variant="caption" tone="faint">
                            {formatDate(ticket.last_activity)}
                          </Txt>
                        </Row>
                      </VStack>
                    </Card>
                  </Pressable>
                ))}
              </VStack>
            )}
          </VStack>
        )}
      </Screen>
    </>
  );
}

function NewTicket({
  onCancel,
  onCreated,
}: {
  onCancel: () => void;
  onCreated: (ticket: Ticket) => void;
}) {
  const t = dict();
  const { c, space, radius } = useTheme();

  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [category, setCategory] = useState<TicketCategory>("Other");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      onCreated(await createTicket({ subject: subject.trim(), body: body.trim(), category }));
    } catch (err) {
      setError((err as Error)?.message ?? t.loadFailed);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card>
      <VStack gap="md">
        <Txt variant="label">{t.supportNew}</Txt>

        <VStack gap="sm">
          <Txt variant="caption" tone="faint">
            {t.supportCategory}
          </Txt>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space.sm }}>
            {TICKET_CATEGORIES.map((option) => (
              <Pressable
                key={option}
                onPress={() => setCategory(option)}
                style={{
                  borderWidth: 1,
                  borderColor: category === option ? c.blue : c.line,
                  backgroundColor: category === option ? c.blue050 : c.surface,
                  borderRadius: radius.pill,
                  paddingHorizontal: space.md,
                  paddingVertical: space.xs,
                }}
              >
                <Txt variant="caption" tone={category === option ? "blue" : "muted"}>
                  {ticketCategoryLabel(option)}
                </Txt>
              </Pressable>
            ))}
          </View>
        </VStack>

        <Field
          label={t.supportSubject}
          value={subject}
          onChange={setSubject}
          placeholder={t.supportSubjectHint}
        />
        <Field
          label={t.supportBody}
          value={body}
          onChange={setBody}
          placeholder={t.supportBodyHint}
          multiline
        />

        {!!error && (
          <Txt variant="caption" tone="coral">
            {error}
          </Txt>
        )}

        <PrimaryButton
          label={t.supportSend}
          icon="paper-plane-outline"
          busy={busy}
          disabled={!subject.trim() || !body.trim()}
          onPress={() => void submit()}
        />
        <Pressable onPress={onCancel} style={{ alignItems: "center" }}>
          <Txt variant="label" tone="faint">
            {t.cancel}
          </Txt>
        </Pressable>
      </VStack>
    </Card>
  );
}
