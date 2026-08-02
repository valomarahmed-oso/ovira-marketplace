import { myStore, updateMyStore, type VendorStore } from "@ovira/core";
import { Ionicons } from "@expo/vector-icons";
import { Stack } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { Pressable, View } from "react-native";

import { Field, PrimaryButton } from "../../src/components/form";
import { Empty, Loading } from "../../src/components/states";
import { Card, Row, Screen, Txt, VStack } from "../../src/components/ui";
import { dict } from "../../src/i18n";
import { useStoreConfig } from "../../src/store-config";
import { useTheme } from "../../src/theme-context";
import { useVendorAccess } from "../../src/vendor-access";

type ShippingType = "Flat" | "Free Over" | "Always Free";
const SHIPPING_TYPES: ShippingType[] = ["Flat", "Free Over", "Always Free"];

/**
 * The store's own profile, and — in Per-Vendor mode — what it charges to ship.
 *
 * The shipping block is hidden entirely when the operator owns the rate table,
 * because in Operator mode these fields exist on the doctype but decide
 * nothing. Showing a seller a fee they can type into that will never be
 * charged is worse than not offering it.
 */
export default function VendorSettingsScreen() {
  const t = dict();
  const { c, space, radius } = useTheme();
  const access = useVendorAccess();
  const config = useStoreConfig();

  const [store, setStore] = useState<VendorStore | null>(null);
  const [state, setState] = useState<"loading" | "ready">("loading");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [description, setDescription] = useState("");
  const [returnPolicy, setReturnPolicy] = useState("");
  const [shippingPolicy, setShippingPolicy] = useState("");
  const [shippingType, setShippingType] = useState<ShippingType>("Flat");
  const [shippingFee, setShippingFee] = useState("");
  const [freeOver, setFreeOver] = useState("");

  const load = useCallback(async () => {
    if (!access.show) {
      setState(access.reason === "loading" ? "loading" : "ready");
      return;
    }
    const found = await myStore();
    if (found) {
      setStore(found);
      setName(found.vendor_name ?? "");
      setPhone(found.phone ?? "");
      setDescription(found.description ?? "");
      setReturnPolicy(found.return_policy ?? "");
      setShippingPolicy(found.shipping_policy ?? "");
      setShippingType((found.shipping_type as ShippingType) || "Flat");
      setShippingFee(String(found.shipping_fee || ""));
      setFreeOver(String(found.shipping_free_over || ""));
    }
    setState("ready");
  }, [access]);

  useEffect(() => {
    void load();
  }, [load]);

  const perVendorShipping = config?.shippingMode === "Per Vendor";

  const save = async () => {
    setBusy(true);
    setError(null);
    setSaved(false);
    try {
      await updateMyStore({
        vendor_name: name.trim(),
        phone: phone.trim() || null,
        description: description.trim() || null,
        return_policy: returnPolicy.trim() || null,
        shipping_policy: shippingPolicy.trim() || null,
        // Only sent when this store actually sets its own rates.
        ...(perVendorShipping
          ? {
              shipping_type: shippingType,
              shipping_fee: shippingType === "Always Free" ? 0 : Number(shippingFee) || 0,
              shipping_free_over: shippingType === "Free Over" ? Number(freeOver) || 0 : 0,
            }
          : {}),
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (err) {
      setError((err as Error)?.message ?? t.loadFailed);
    } finally {
      setBusy(false);
    }
  };

  if (!access.show) {
    return (
      <>
        <Stack.Screen options={{ title: t.vstTitle }} />
        <Screen scroll={false}>
          {access.reason === "loading" ? (
            <Loading />
          ) : (
            <Empty icon="settings-outline" title={t.vendorNotSeller} />
          )}
        </Screen>
      </>
    );
  }

  if (state === "loading") {
    return (
      <>
        <Stack.Screen options={{ title: t.vstTitle }} />
        <Screen scroll={false}>
          <Loading />
        </Screen>
      </>
    );
  }

  return (
    <>
      <Stack.Screen options={{ title: t.vstTitle }} />
      <Screen>
        <VStack gap="lg" style={{ paddingBottom: space.xxl }}>
          <Card>
            <VStack gap="md">
              <Txt variant="label">{t.vstProfile}</Txt>
              <Field label={t.vstName} value={name} onChange={setName} autoCapitalize="words" />
              <Field
                label={t.phone}
                value={phone}
                onChange={setPhone}
                keyboardType="phone-pad"
                placeholder="01xxxxxxxxx"
              />
              <Field
                label={t.vstAbout}
                value={description}
                onChange={setDescription}
                placeholder={t.vpOptional}
                multiline
              />
            </VStack>
          </Card>

          <Card>
            <VStack gap="md">
              <Txt variant="label">{t.vstPolicies}</Txt>
              <Field
                label={t.shippingPolicy}
                value={shippingPolicy}
                onChange={setShippingPolicy}
                placeholder={t.vstShippingPolicyHint}
                multiline
              />
              <Field
                label={t.returnPolicy}
                value={returnPolicy}
                onChange={setReturnPolicy}
                placeholder={t.vstReturnPolicyHint}
                multiline
              />
            </VStack>
          </Card>

          {perVendorShipping ? (
            <Card>
              <VStack gap="md">
                <Txt variant="label">{t.vstShipping}</Txt>
                <Txt variant="caption" tone="faint">
                  {t.vstShippingHint}
                </Txt>

                <Row gap="sm">
                  {SHIPPING_TYPES.map((option) => (
                    <Pressable
                      key={option}
                      onPress={() => setShippingType(option)}
                      style={{
                        flex: 1,
                        alignItems: "center",
                        borderWidth: 1,
                        borderColor: shippingType === option ? c.blue : c.line,
                        backgroundColor: shippingType === option ? c.blue050 : c.surface,
                        borderRadius: radius.pill,
                        paddingVertical: space.sm,
                      }}
                    >
                      <Txt
                        variant="caption"
                        tone={shippingType === option ? "blue" : "muted"}
                        numberOfLines={1}
                      >
                        {t.vstShippingTypes[option] ?? option}
                      </Txt>
                    </Pressable>
                  ))}
                </Row>

                {shippingType !== "Always Free" && (
                  <Field
                    label={t.vstFee}
                    value={shippingFee}
                    onChange={setShippingFee}
                    keyboardType="numeric"
                    placeholder="0"
                  />
                )}
                {shippingType === "Free Over" && (
                  <Field
                    label={t.vstFreeOver}
                    value={freeOver}
                    onChange={setFreeOver}
                    keyboardType="numeric"
                    placeholder="0"
                  />
                )}
              </VStack>
            </Card>
          ) : (
            <Card>
              <Row gap="sm" align="flex-start">
                <Ionicons name="information-circle-outline" size={17} color={c.ink400} />
                <Txt variant="caption" tone="faint" style={{ flex: 1 }}>
                  {t.vstOperatorShipping}
                </Txt>
              </Row>
            </Card>
          )}

          {!!store?.commission_rate && (
            <Row justify="space-between">
              <Txt variant="caption" tone="faint">
                {t.vendorCommission}
              </Txt>
              <Txt variant="caption" tone="faint">
                {store.commission_rate}%
              </Txt>
            </Row>
          )}

          {!!error && (
            <Txt variant="caption" tone="coral">
              {error}
            </Txt>
          )}
          {saved && (
            <Txt variant="caption" tone="mint" style={{ textAlign: "center" }}>
              {t.vstSaved}
            </Txt>
          )}

          <PrimaryButton
            label={t.save}
            icon="save-outline"
            busy={busy}
            disabled={!name.trim()}
            onPress={() => void save()}
          />

          {/* The logo and banner are uploads, and there is no image picker in
              this build. Said plainly rather than shown as fields that do
              nothing. */}
          <View style={{ alignItems: "center" }}>
            <Txt variant="caption" tone="faint" style={{ textAlign: "center" }}>
              {t.vstMediaOnWeb}
            </Txt>
          </View>
        </VStack>
      </Screen>
    </>
  );
}
