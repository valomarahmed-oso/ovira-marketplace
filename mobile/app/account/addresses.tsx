import type { BuyerAddress } from "@ovira/core";
import {
  GOVERNORATES,
  deleteAddress,
  myAddresses,
  saveAddress,
  setDefaultAddress,
} from "@ovira/core";
import { Ionicons } from "@expo/vector-icons";
import { Stack } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { Alert, KeyboardAvoidingView, Platform, Pressable, View } from "react-native";

import { ChoiceRow, Field, PrimaryButton } from "../../src/components/form";
import { Empty, Loading } from "../../src/components/states";
import { Card, Pill, Row, Screen, Txt, VStack } from "../../src/components/ui";
import { dict } from "../../src/i18n";
import { useTheme } from "../../src/theme-context";

export default function AddressesScreen() {
  const { c, space } = useTheme();
  const t = dict();

  const [rows, setRows] = useState<BuyerAddress[]>([]);
  const [state, setState] = useState<"loading" | "ready">("loading");
  const [editing, setEditing] = useState<BuyerAddress | "new" | null>(null);

  const load = useCallback(async () => {
    setRows(await myAddresses());
    setState("ready");
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const remove = (row: BuyerAddress) => {
    Alert.alert(t.remove, t.deleteConfirm, [
      { text: t.cancel, style: "cancel" },
      {
        text: t.remove,
        style: "destructive",
        onPress: async () => {
          await deleteAddress(row.name).catch(() => {});
          await load();
        },
      },
    ]);
  };

  return (
    <>
      <Stack.Screen options={{ title: t.addresses }} />
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={{ flex: 1 }}
      >
        <Screen>
          {state === "loading" ? (
            <Loading />
          ) : (
            <VStack gap="lg">
              {editing ? (
                <AddressForm
                  initial={editing === "new" ? null : editing}
                  onCancel={() => setEditing(null)}
                  onSaved={async () => {
                    setEditing(null);
                    await load();
                  }}
                />
              ) : (
                <>
                  {rows.length === 0 ? (
                    <Empty icon="location-outline" title={t.addresses} body={t.addressHint} />
                  ) : (
                    rows.map((row) => (
                      <Card key={row.name}>
                        <VStack gap="sm">
                          <Row justify="space-between">
                            <Txt variant="label">{row.full_name}</Txt>
                            {row.is_default && <Pill label={t.defaultAddress} tone="mint" />}
                          </Row>
                          <Txt variant="body" tone="muted">
                            {row.governorate} · {row.address}
                          </Txt>
                          {!!row.phone && (
                            <Txt variant="caption" tone="faint">
                              {row.phone}
                            </Txt>
                          )}
                          <Row gap="lg" style={{ marginTop: space.xs }}>
                            <Pressable onPress={() => setEditing(row)}>
                              <Txt variant="caption" tone="blue">
                                {t.save}
                              </Txt>
                            </Pressable>
                            {!row.is_default && (
                              <Pressable
                                onPress={async () => {
                                  await setDefaultAddress(row.name).catch(() => {});
                                  await load();
                                }}
                              >
                                <Txt variant="caption" tone="blue">
                                  {t.setDefault}
                                </Txt>
                              </Pressable>
                            )}
                            <Pressable onPress={() => remove(row)}>
                              <Txt variant="caption" tone="coral">
                                {t.remove}
                              </Txt>
                            </Pressable>
                          </Row>
                        </VStack>
                      </Card>
                    ))
                  )}

                  <Pressable
                    onPress={() => setEditing("new")}
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: space.sm,
                      paddingVertical: space.md,
                    }}
                  >
                    <Ionicons name="add-circle-outline" size={18} color={c.blue} />
                    <Txt variant="label" tone="blue">
                      {t.newAddress}
                    </Txt>
                  </Pressable>
                </>
              )}
            </VStack>
          )}
        </Screen>
      </KeyboardAvoidingView>
    </>
  );
}

function AddressForm({
  initial,
  onCancel,
  onSaved,
}: {
  initial: BuyerAddress | null;
  onCancel: () => void;
  onSaved: () => void | Promise<void>;
}) {
  const { space } = useTheme();
  const t = dict();

  const [fullName, setFullName] = useState(initial?.full_name ?? "");
  const [phone, setPhone] = useState(initial?.phone ?? "");
  const [gov, setGov] = useState<string | null>(initial?.governorate ?? null);
  const [address, setAddress] = useState(initial?.address ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const submit = async () => {
    if (!fullName.trim() || !gov || !address.trim()) {
      setError(t.requiredFields);
      return;
    }
    setBusy(true);
    setError("");
    try {
      await saveAddress({
        name: initial?.name,
        full_name: fullName.trim(),
        phone: phone.trim() || undefined,
        governorate: gov,
        address: address.trim(),
      });
      await onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : t.loadFailed);
    } finally {
      setBusy(false);
    }
  };

  return (
    <VStack gap="lg">
      <Field label={t.fullName} value={fullName} onChange={setFullName} autoCapitalize="words" />
      <Field label={t.phone} value={phone} onChange={setPhone} keyboardType="phone-pad" />
      <VStack gap="xs">
        <Txt variant="label" tone="muted">
          {t.governorate}
        </Txt>
        <ChoiceRow
          options={GOVERNORATES.map((g) => ({ value: g, label: g }))}
          value={gov}
          onChange={setGov}
        />
      </VStack>
      <Field
        label={t.address}
        value={address}
        onChange={setAddress}
        placeholder={t.addressHint}
        multiline
      />
      {!!error && (
        <Txt variant="caption" tone="coral">
          {error}
        </Txt>
      )}
      <PrimaryButton label={t.save} onPress={() => void submit()} busy={busy} />
      <Pressable onPress={onCancel} style={{ alignItems: "center", paddingVertical: space.sm }}>
        <Txt variant="label" tone="faint">
          {t.cancel}
        </Txt>
      </Pressable>
    </VStack>
  );
}
