import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { useState } from "react";
import { KeyboardAvoidingView, Platform, Pressable } from "react-native";

import { Field, PrimaryButton } from "../../src/components/form";
import { Logo } from "../../src/components/logo";
import { Row, Screen, Txt, VStack } from "../../src/components/ui";
import { dict } from "../../src/i18n";
import { useSession } from "../../src/session";

export default function RegisterScreen() {
  const router = useRouter();
  const { next } = useLocalSearchParams<{ next?: string }>();
  const signUp = useSession((s) => s.signUp);
  const t = dict();

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setError("");
    setBusy(true);
    try {
      // `register` signs in straight afterwards, so the shopper never has to
      // type the same password twice to reach the screen they wanted.
      await signUp({ fullName, email, password, phone: phone || undefined });
      if (next === "checkout") router.replace("/checkout");
      else router.back();
    } catch (err) {
      setError(err instanceof Error ? err.message : t.loadFailed);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <Stack.Screen options={{ title: t.register }} />
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={{ flex: 1 }}
      >
        <Screen>
          <VStack gap="xl">
            <VStack gap="md" style={{ alignItems: "center" }}>
              <Logo size={56} />
            </VStack>

            <VStack gap="lg">
              <Field
                label={t.fullName}
                value={fullName}
                onChange={setFullName}
                autoCapitalize="words"
              />
              <Field
                label={t.email}
                value={email}
                onChange={setEmail}
                keyboardType="email-address"
                placeholder="name@example.com"
              />
              <Field
                label={t.phone}
                value={phone}
                onChange={setPhone}
                keyboardType="phone-pad"
                placeholder="01xxxxxxxxx"
              />
              <Field label={t.password} value={password} onChange={setPassword} secure />
              {!!error && (
                <Txt variant="caption" tone="coral">
                  {error}
                </Txt>
              )}
              <PrimaryButton
                label={t.register}
                onPress={() => void submit()}
                busy={busy}
                disabled={!fullName.trim() || !email.trim() || password.length < 6}
              />
            </VStack>

            <Row gap="xs" justify="center">
              <Txt variant="body" tone="faint">
                {t.haveAccount}
              </Txt>
              <Pressable
                onPress={() =>
                  router.replace({ pathname: "/auth/sign-in", params: next ? { next } : {} })
                }
              >
                <Txt variant="label" tone="blue">
                  {t.signIn}
                </Txt>
              </Pressable>
            </Row>
          </VStack>
        </Screen>
      </KeyboardAvoidingView>
    </>
  );
}
