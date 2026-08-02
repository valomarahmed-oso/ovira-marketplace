import { Ionicons } from "@expo/vector-icons";
import { useRef, useState } from "react";
import { Pressable, ScrollView, TextInput, View } from "react-native";

import { dict, formatDate } from "../i18n";
import { useTheme } from "../theme-context";
import { Row, Txt, VStack } from "./ui";

/** The shape both channels agree on: support tickets and vendor threads. */
export type ChatMessage = {
  id: string;
  body: string;
  sender_name: string;
  mine: boolean;
  date: string;
};

/**
 * A conversation.
 *
 * `mine` decides the side and the colour, and it comes from the server rather
 * than from comparing names here — the same person can hold two roles (an
 * operator who also buys), and deciding "is this me" on the client is how a
 * thread ends up with both sides drawn on the right.
 */
export function ChatThread({ messages }: { messages: ChatMessage[] }) {
  const { c, space, radius } = useTheme();
  const scroller = useRef<ScrollView>(null);

  return (
    <ScrollView
      ref={scroller}
      showsVerticalScrollIndicator={false}
      contentContainerStyle={{ gap: space.md, paddingVertical: space.md }}
      // The newest message is the one being read; starting at the top of a long
      // thread means scrolling past everything already answered.
      onContentSizeChange={() => scroller.current?.scrollToEnd({ animated: false })}
    >
      {messages.map((message) => (
        <View
          key={message.id}
          style={{
            alignSelf: message.mine ? "flex-end" : "flex-start",
            maxWidth: "85%",
            backgroundColor: message.mine ? c.blue : c.surface,
            borderWidth: message.mine ? 0 : 1,
            borderColor: c.line,
            borderRadius: radius.lg,
            padding: space.md,
            gap: space.xs,
          }}
        >
          {!message.mine && (
            <Txt variant="caption" tone="blue">
              {message.sender_name}
            </Txt>
          )}
          <Txt variant="body" tone={message.mine ? "onBlue" : "ink"}>
            {message.body}
          </Txt>
          <Txt variant="caption" tone={message.mine ? "onBlue" : "faint"} style={{ opacity: 0.75 }}>
            {formatDate(message.date)}
          </Txt>
        </View>
      ))}
    </ScrollView>
  );
}

/**
 * The box you type into.
 *
 * Clears only after the send resolves. Clearing optimistically loses what
 * someone wrote when the network drops, and a long message typed on a phone is
 * not something to ask them to type again.
 */
export function ChatComposer({
  onSend,
  disabled = false,
  placeholder,
}: {
  onSend: (body: string) => Promise<void>;
  disabled?: boolean;
  placeholder?: string;
}) {
  const { c, space, radius } = useTheme();
  const t = dict();
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);

  const send = async () => {
    const text = body.trim();
    if (!text || busy) return;
    setBusy(true);
    try {
      await onSend(text);
      setBody("");
    } catch {
      /* the caller surfaces the reason; the text stays put */
    } finally {
      setBusy(false);
    }
  };

  if (disabled) {
    return (
      <VStack gap="xs" style={{ paddingVertical: space.md }}>
        <Txt variant="caption" tone="faint" style={{ textAlign: "center" }}>
          {t.chatClosed}
        </Txt>
      </VStack>
    );
  }

  return (
    <Row gap="sm" align="flex-end" style={{ paddingVertical: space.sm }}>
      <View
        style={{
          flex: 1,
          backgroundColor: c.surface,
          borderWidth: 1,
          borderColor: c.line,
          borderRadius: radius.lg,
          paddingHorizontal: space.md,
          paddingVertical: space.sm,
        }}
      >
        <TextInput
          value={body}
          onChangeText={setBody}
          placeholder={placeholder ?? t.chatPlaceholder}
          placeholderTextColor={c.ink400}
          multiline
          style={{
            color: c.ink,
            fontSize: 15,
            maxHeight: 110,
            textAlign: "right",
            writingDirection: "rtl",
            paddingVertical: 0,
          }}
        />
      </View>
      <Pressable
        onPress={() => void send()}
        disabled={!body.trim() || busy}
        style={{
          width: 44,
          height: 44,
          borderRadius: radius.pill,
          backgroundColor: body.trim() && !busy ? c.blue : c.line,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {/* Points the way a message travels, which under RTL is leftwards. */}
        <Ionicons name="send" size={18} color="#ffffff" style={{ transform: [{ scaleX: -1 }] }} />
      </Pressable>
    </Row>
  );
}
