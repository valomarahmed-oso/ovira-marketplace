import {
  exportMyProductsCsv,
  importProductsCsv,
  importTemplate,
  type ImportResult,
} from "@ovira/core";
import { Ionicons } from "@expo/vector-icons";
import * as Clipboard from "expo-clipboard";
import { Stack, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { Pressable, ScrollView, TextInput, View } from "react-native";

import { PrimaryButton } from "../../../src/components/form";
import { Card, Pill, Row, Screen, Txt, VStack } from "../../../src/components/ui";
import { dict, num } from "../../../src/i18n";
import { useTheme } from "../../../src/theme-context";

const TONES: Record<string, "blue" | "mint" | "coral"> = {
  ok: "blue",
  created: "mint",
  updated: "mint",
  error: "coral",
};

/**
 * Bulk price and stock changes, by CSV.
 *
 * A phone has no file picker worth building this on, so the CSV is pasted —
 * which is also how a seller actually gets one onto a phone: exported from
 * here, mailed to themselves, edited, pasted back.
 *
 * **The preview is not a nicety.** A wrong column mapping silently rewriting
 * forty prices is the failure this endpoint's `dry_run` exists to prevent, so
 * the destructive run is only reachable *after* a preview has been read.
 */
export default function ImportScreen() {
  const t = dict();
  const { c, space, radius } = useTheme();
  const router = useRouter();

  const [columns, setColumns] = useState<string[]>([]);
  const [csv, setCsv] = useState("");
  const [preview, setPreview] = useState<ImportResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    void importTemplate().then(setColumns);
  }, []);

  const run = async (dryRun: boolean) => {
    setBusy(true);
    setError(null);
    try {
      const result = await importProductsCsv(csv, dryRun);
      setPreview(result);
      if (!dryRun) {
        setNotice(t.viImported);
        // Straight back to the shelf: the numbers on it are the real
        // confirmation, not a message about them.
        setTimeout(() => router.replace("/vendor/products"), 1200);
      }
    } catch (err) {
      setError((err as Error)?.message ?? t.loadFailed);
    } finally {
      setBusy(false);
    }
  };

  const copyTemplate = async () => {
    await Clipboard.setStringAsync(columns.join(","));
    setNotice(t.viCopied);
    setTimeout(() => setNotice(null), 1600);
  };

  const exportMine = async () => {
    setBusy(true);
    try {
      const { csv: text, count } = await exportMyProductsCsv();
      setCsv(text);
      setPreview(null);
      setNotice(`${t.viExported} (${num(count)})`);
      setTimeout(() => setNotice(null), 1600);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <Stack.Screen options={{ title: t.viTitle }} />
      <Screen>
        <VStack gap="lg" style={{ paddingBottom: space.xxl }}>
          <Txt variant="body" tone="muted">
            {t.viIntro}
          </Txt>

          <Card>
            <VStack gap="md">
              <Txt variant="label">{t.viColumns}</Txt>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <Txt variant="caption" tone="faint">
                  {columns.join(" · ")}
                </Txt>
              </ScrollView>
              <Row gap="md">
                <Pressable onPress={() => void copyTemplate()} hitSlop={6}>
                  <Row gap="xs">
                    <Ionicons name="copy-outline" size={15} color={c.blue} />
                    <Txt variant="caption" tone="blue">
                      {t.viCopyTemplate}
                    </Txt>
                  </Row>
                </Pressable>
                <Pressable onPress={() => void exportMine()} hitSlop={6}>
                  <Row gap="xs">
                    <Ionicons name="download-outline" size={15} color={c.blue} />
                    <Txt variant="caption" tone="blue">
                      {t.viExportMine}
                    </Txt>
                  </Row>
                </Pressable>
              </Row>
            </VStack>
          </Card>

          <VStack gap="sm">
            <Txt variant="caption" tone="faint">
              {t.viPaste}
            </Txt>
            <View
              style={{
                backgroundColor: c.surface,
                borderWidth: 1,
                borderColor: c.line,
                borderRadius: radius.lg,
                padding: space.md,
              }}
            >
              <TextInput
                value={csv}
                onChangeText={(value) => {
                  setCsv(value);
                  // Any edit invalidates the preview — approving a run against
                  // a report of different text is the whole risk here.
                  setPreview(null);
                }}
                multiline
                placeholder="title,price,stock_qty…"
                placeholderTextColor={c.ink400}
                style={{
                  color: c.ink,
                  fontSize: 13,
                  minHeight: 140,
                  // CSV is not prose: left-to-right, and monospaced where the
                  // platform has one, or the columns cannot be read at all.
                  textAlign: "left",
                  writingDirection: "ltr",
                  fontFamily: "monospace",
                  paddingVertical: 0,
                }}
              />
            </View>
          </VStack>

          {!!error && (
            <Txt variant="caption" tone="coral">
              {error}
            </Txt>
          )}
          {!!notice && (
            <Txt variant="caption" tone="mint">
              {notice}
            </Txt>
          )}

          <PrimaryButton
            label={t.viPreview}
            icon="eye-outline"
            busy={busy}
            disabled={!csv.trim()}
            onPress={() => void run(true)}
          />

          {preview && <ImportReport result={preview} />}

          {/* Only after a preview, and only when it found something to do. */}
          {preview?.dry_run && preview.created + preview.updated > 0 && (
            <PrimaryButton
              label={t.viApply}
              icon="cloud-upload-outline"
              tone="mint"
              busy={busy}
              onPress={() => void run(false)}
            />
          )}
        </VStack>
      </Screen>
    </>
  );
}

function ImportReport({ result }: { result: ImportResult }) {
  const t = dict();
  const { space } = useTheme();

  return (
    <Card>
      <VStack gap="md">
        <Row gap="sm" style={{ flexWrap: "wrap" }}>
          <Pill label={`${t.viCreated} ${num(result.created)}`} tone="mint" />
          <Pill label={`${t.viUpdated} ${num(result.updated)}`} tone="blue" />
          {result.errors > 0 && (
            <Pill label={`${t.viErrors} ${num(result.errors)}`} tone="coral" />
          )}
        </Row>

        <VStack gap="sm" style={{ marginTop: space.xs }}>
          {result.results.map((row) => (
            <Row key={row.row} gap="sm" align="flex-start">
              <Txt variant="caption" tone="faint">
                {num(row.row)}
              </Txt>
              <VStack gap="xs" style={{ flex: 1 }}>
                <Txt variant="caption" numberOfLines={1}>
                  {row.title || "—"}
                </Txt>
                {!!row.message && (
                  <Txt variant="caption" tone="coral">
                    {row.message}
                  </Txt>
                )}
              </VStack>
              <Pill label={t.viStatus[row.status] ?? row.status} tone={TONES[row.status] ?? "blue"} />
            </Row>
          ))}
        </VStack>
      </VStack>
    </Card>
  );
}
