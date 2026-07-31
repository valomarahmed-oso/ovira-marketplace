import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { useState } from "react";
import { KeyboardAvoidingView, Platform, Pressable } from "react-native";

import { Field, PrimaryButton } from "../../src/components/form";
import { Logo } from "../../src/components/logo";
import { Row, Screen, Txt, VStack } from "../../src/components/ui";
import { dict } from "../../src/i18n";
import { useSession } from "../../src/session";

export default function SignInScreen() {
  const router = useRouter();
  const { next } = useLocalSearchParams<{ next?: string }>();
  const logIn = useSession((s) => s.logIn);
  const t = dict();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setError("");
    setBusy(true);
    try {
      await logIn(email, password);
      // `replace`, not `push`: a shopper who taps back after signing in should
      // land where they were going, not back on the sign-in form.
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
      <Stack.Screen options={{ title: t.signIn }} />
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={{ flex: 1 }}
      >
        <Screen>
          <VStack gap="xl">
            <VStack gap="md" style={{ alignItems: "center" }}>
              <Logo size={56} />
              <Txt variant="body" tone="faint" style={{ textAlign: "center" }}>
                {t.signInBenefit}
              </Txt>
            </VStack>

            <VStack gap="lg">
              <Field
                label={t.email}
                value={email}
                onChange={setEmail}
                keyboardType="email-address"
                placeholder="name@example.com"
              />
              <Field label={t.password} value={password} onChange={setPassword} secure />
              {!!error && (
                <Txt variant="caption" tone="coral">
                  {error}
                </Txt>
              )}
              <PrimaryButton
                label={t.signIn}
                onPress={() => void submit()}
                busy={busy}
                disabled={!email.trim() || !password}
              />
            </VStack>

            <Row gap="xs" justify="center">
              <Txt variant="body" tone="faint">
                {t.noAccount}
              </Txt>
              <Pressable
                onPress={() =>
                  router.replace({ pathname: "/auth/register", params: next ? { next } : {} })
                }
              >
                <Txt variant="label" tone="blue">
                  {t.register}
                </Txt>
              </Pressable>
            </Row>
          </VStack>
        </Screen>
      </KeyboardAvoidingView>
    </>
  );
}
