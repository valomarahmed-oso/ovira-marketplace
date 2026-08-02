import { registerVendor } from "@ovira/core";
import { Ionicons } from "@expo/vector-icons";
import { Stack, useRouter } from "expo-router";
import { useState } from "react";
import { View } from "react-native";

import { Field, PrimaryButton } from "../src/components/form";
import { Empty } from "../src/components/states";
import { Card, Row, Screen, Txt, VStack } from "../src/components/ui";
import { dict } from "../src/i18n";
import { useSession } from "../src/session";
import { useStoreConfig } from "../src/store-config";
import { useTheme } from "../src/theme-context";

/**
 * Open a store.
 *
 * Three ways this screen can be wrong to show, and all three are checked
 * before the form: the marketplace may be running as a single company (there
 * are no vendors to become), the visitor may not be signed in (the vendor is
 * attached to a user, and the server refuses a guest), or they may already
 * have a store. Each gets its own answer rather than a form that fails on
 * submit.
 */
export default function SellScreen() {
  const t = dict();
  const { c, space, radius } = useTheme();
  const router = useRouter();

  const user = useSession((s) => s.user);
  const config = useStoreConfig();

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [about, setAbout] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      const store = await registerVendor({
        vendor_name: name.trim(),
        phone: phone.trim() || undefined,
        description: about.trim() || undefined,
      });
      setDone(store.status);
    } catch (err) {
      setError((err as Error)?.message ?? t.loadFailed);
    } finally {
      setBusy(false);
    }
  };

  const body = () => {
    // Single Company mode: there is no such thing as a vendor here.
    if (config && !config.multiVendor) {
      return <Empty icon="storefront-outline" title={t.sellClosed} body={t.sellClosedBody} />;
    }

    if (done) {
      return (
        <Empty
          icon="checkmark-circle-outline"
          title={t.sellSubmitted}
          body={done === "Active" ? t.sellActive : t.sellPending}
          onRetry={() => router.replace("/vendor")}
          actionLabel={t.vendorArea}
        />
      );
    }

    if (!user) {
      return (
        <Empty
          icon="log-in-outline"
          title={t.signInFirst}
          body={t.sellSignIn}
          onRetry={() => router.push("/auth/sign-in")}
          actionLabel={t.signIn}
        />
      );
    }

    // Already a seller — send them to the store rather than letting them file
    // a second application the server would reject.
    if (user.isVendor) {
      return (
        <Empty
          icon="storefront-outline"
          title={t.sellAlready}
          onRetry={() => router.replace("/vendor")}
          actionLabel={t.vendorArea}
        />
      );
    }

    return (
      <VStack gap="lg">
        <Card>
          <VStack gap="md">
            <Field
              label={t.sellStoreName}
              value={name}
              onChange={setName}
              placeholder={t.sellStoreNameHint}
              autoCapitalize="words"
            />
            <Field
              label={t.phone}
              value={phone}
              onChange={setPhone}
              placeholder="01xxxxxxxxx"
              keyboardType="phone-pad"
            />
            <Field
              label={t.sellAbout}
              value={about}
              onChange={setAbout}
              placeholder={t.sellAboutHint}
              multiline
            />
            {!!error && (
              <Txt variant="caption" tone="coral">
                {error}
              </Txt>
            )}
            <PrimaryButton
              label={t.sellSubmit}
              icon="storefront-outline"
              busy={busy}
              disabled={!name.trim()}
              onPress={() => void submit()}
            />
          </VStack>
        </Card>

        <Card>
          <VStack gap="md">
            <Txt variant="label">{t.sellWhy}</Txt>
            <Benefit icon="cash-outline" text={t.sellWhy1} />
            <Benefit icon="stats-chart-outline" text={t.sellWhy2} />
            <Benefit icon="cube-outline" text={t.sellWhy3} />
          </VStack>
        </Card>
      </VStack>
    );
  };

  return (
    <>
      <Stack.Screen options={{ title: t.sell }} />
      <Screen>
        <VStack gap="xl" style={{ paddingBottom: space.xxl }}>
          <VStack gap="sm" style={{ alignItems: "center" }}>
            <View
              style={{
                width: 56,
                height: 56,
                borderRadius: radius.xl,
                backgroundColor: c.blue050,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Ionicons name="storefront" size={26} color={c.blue} />
            </View>
            <Txt variant="title">{t.sell}</Txt>
            <Txt variant="body" tone="faint" style={{ textAlign: "center", maxWidth: 300 }}>
              {t.sellSubtitle}
            </Txt>
          </VStack>

          {body()}
        </VStack>
      </Screen>
    </>
  );
}

function Benefit({ icon, text }: { icon: keyof typeof Ionicons.glyphMap; text: string }) {
  const { c } = useTheme();
  return (
    <Row gap="md" align="flex-start">
      <Ionicons name={icon} size={18} color={c.blue} />
      <Txt variant="body" tone="muted" style={{ flex: 1 }}>
        {text}
      </Txt>
    </Row>
  );
}
