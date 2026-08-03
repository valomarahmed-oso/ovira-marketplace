import { answerQuestion, askQuestion, listQuestions, type Question } from "@ovira/core";
import { Ionicons } from "@expo/vector-icons";
import { useCallback, useEffect, useState } from "react";
import { Pressable, View } from "react-native";

import { dict, formatDate } from "../i18n";
import { useSession } from "../session";
import { useTheme } from "../theme-context";
import { PrimaryButton } from "./form";
import { TextArea } from "./reviews";
import { Card, Row, Txt, VStack } from "./ui";

/**
 * Questions about a product, and their answers.
 *
 * `canAnswer` turns the same component into the seller's side. It is passed in
 * rather than derived here, because "may I answer this" is a question about the
 * *product's* vendor and only the screen holding the product knows that — the
 * server enforces it either way, so a wrong guess here would only produce a
 * button that fails.
 */
export function QuestionsSection({
  product,
  canAnswer = false,
}: {
  product: string;
  canAnswer?: boolean;
}) {
  const t = dict();
  const { c, space } = useTheme();
  const user = useSession((s) => s.user);

  const [rows, setRows] = useState<Question[]>([]);
  const [asking, setAsking] = useState(false);
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setRows(await listQuestions(product));
  }, [product]);

  useEffect(() => {
    void load();
  }, [load]);

  const ask = async () => {
    setBusy(true);
    setError(null);
    try {
      await askQuestion(product, body.trim());
      setBody("");
      setAsking(false);
      await load();
    } catch (err) {
      setError((err as Error)?.message ?? t.loadFailed);
    } finally {
      setBusy(false);
    }
  };

  return (
    <VStack gap="md">
      <Txt variant="heading">{t.qaTitle}</Txt>

      {rows.length === 0 && (
        <Txt variant="body" tone="faint">
          {t.qaEmpty}
        </Txt>
      )}

      {rows.map((question) => (
        <QuestionRow key={question.id} question={question} canAnswer={canAnswer} onAnswered={load} />
      ))}

      {user ? (
        asking ? (
          <Card>
            <VStack gap="md">
              <Txt variant="label">{t.qaAsk}</Txt>
              <TextArea value={body} onChange={setBody} placeholder={t.qaAskHint} />
              {!!error && (
                <Txt variant="caption" tone="coral">
                  {error}
                </Txt>
              )}
              <PrimaryButton
                label={t.qaSend}
                icon="help-circle-outline"
                busy={busy}
                disabled={!body.trim()}
                onPress={() => void ask()}
              />
              <Pressable onPress={() => setAsking(false)} style={{ alignItems: "center" }}>
                <Txt variant="label" tone="faint">
                  {t.cancel}
                </Txt>
              </Pressable>
            </VStack>
          </Card>
        ) : (
          <Pressable onPress={() => setAsking(true)} style={{ alignSelf: "flex-start" }}>
            <Row gap="xs">
              <Ionicons name="help-circle-outline" size={16} color={c.blue} />
              <Txt variant="label" tone="blue">
                {t.qaAsk}
              </Txt>
            </Row>
          </Pressable>
        )
      ) : (
        <Txt variant="caption" tone="faint" style={{ marginTop: space.xs }}>
          {t.qaSignIn}
        </Txt>
      )}
    </VStack>
  );
}

function QuestionRow({
  question,
  canAnswer,
  onAnswered,
}: {
  question: Question;
  canAnswer: boolean;
  onAnswered: () => Promise<void>;
}) {
  const t = dict();
  const { c, space } = useTheme();
  const [open, setOpen] = useState(false);
  const [answer, setAnswer] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const send = async () => {
    setBusy(true);
    setError(null);
    try {
      await answerQuestion(question.id, answer.trim());
      setOpen(false);
      setAnswer("");
      await onAnswered();
    } catch (err) {
      setError((err as Error)?.message ?? t.loadFailed);
    } finally {
      setBusy(false);
    }
  };

  return (
    <VStack gap="sm">
      <Row gap="sm" align="flex-start">
        <Ionicons name="help-circle" size={16} color={c.blue} style={{ marginTop: 3 }} />
        <VStack gap="xs" style={{ flex: 1 }}>
          <Txt variant="body">{question.body}</Txt>
          <Txt variant="caption" tone="faint">
            {question.author} · {formatDate(question.date)}
          </Txt>
        </VStack>
      </Row>

      {question.answer ? (
        <Row gap="sm" align="flex-start" style={{ paddingStart: space.xl }}>
          <Ionicons name="chatbubble" size={14} color={c.mint} style={{ marginTop: 3 }} />
          <VStack gap="xs" style={{ flex: 1 }}>
            <Txt variant="body" tone="muted">
              {question.answer}
            </Txt>
            {!!question.answered_by && (
              <Txt variant="caption" tone="mint">
                {question.answered_by}
              </Txt>
            )}
          </VStack>
        </Row>
      ) : canAnswer ? (
        <View style={{ paddingStart: space.xl }}>
          {open ? (
            <VStack gap="sm">
              <TextArea
                value={answer}
                onChange={setAnswer}
                placeholder={t.qaAnswerHint}
                minHeight={56}
              />
              {!!error && (
                <Txt variant="caption" tone="coral">
                  {error}
                </Txt>
              )}
              <PrimaryButton
                label={t.qaAnswerSend}
                small
                busy={busy}
                disabled={!answer.trim()}
                onPress={() => void send()}
              />
            </VStack>
          ) : (
            <Pressable onPress={() => setOpen(true)}>
              <Txt variant="caption" tone="blue">
                {t.qaAnswer}
              </Txt>
            </Pressable>
          )}
        </View>
      ) : (
        <Txt variant="caption" tone="faint" style={{ paddingStart: space.xl }}>
          {t.qaUnanswered}
        </Txt>
      )}
    </VStack>
  );
}
