import {
  deleteMyCoupon,
  myCoupons,
  upsertMyCoupon,
  type Coupon,
  type DiscountType,
} from "@ovira/core";
import { Ionicons } from "@expo/vector-icons";
import { Stack } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { Alert, Pressable, View } from "react-native";

import { Field, PrimaryButton } from "../../src/components/form";
import { Empty, Loading } from "../../src/components/states";
import { Card, Pill, Row, Screen, Txt, VStack } from "../../src/components/ui";
import { dict, formatDate, money, num } from "../../src/i18n";
import { useTheme } from "../../src/theme-context";
import { useVendorAccess } from "../../src/vendor-access";

/**
 * The seller's own discount codes.
 *
 * These are vendor-funded — the discount comes off what this seller is paid,
 * not off the operator's commission — so the screen says so once, plainly.
 * A seller who thinks the marketplace is paying for their 20% is a seller who
 * finds out at settlement.
 */
export default function VendorCouponsScreen() {
  const t = dict();
  const { c, space } = useTheme();
  const access = useVendorAccess();

  const [rows, setRows] = useState<Coupon[]>([]);
  const [state, setState] = useState<"loading" | "ready">("loading");
  const [editing, setEditing] = useState<Coupon | "new" | null>(null);

  const load = useCallback(async () => {
    if (!access.show) {
      setState(access.reason === "loading" ? "loading" : "ready");
      return;
    }
    setRows(await myCoupons());
    setState("ready");
  }, [access]);

  useEffect(() => {
    void load();
  }, [load]);

  const remove = useCallback(
    (coupon: Coupon) => {
      Alert.alert(coupon.code, t.vcDeleteConfirm, [
        { text: t.cancel, style: "cancel" },
        {
          text: t.remove,
          style: "destructive",
          onPress: async () => {
            try {
              await deleteMyCoupon(coupon.code);
              await load();
            } catch (err) {
              Alert.alert(t.loadFailed, err instanceof Error ? err.message : "");
            }
          },
        },
      ]);
    },
    [load, t],
  );

  if (!access.show) {
    return (
      <>
        <Stack.Screen options={{ title: t.vcTitle }} />
        <Screen scroll={false}>
          {access.reason === "loading" ? (
            <Loading />
          ) : (
            <Empty icon="pricetag-outline" title={t.vendorNotSeller} />
          )}
        </Screen>
      </>
    );
  }

  return (
    <>
      <Stack.Screen options={{ title: t.vcTitle }} />
      <Screen>
        <VStack gap="lg" style={{ paddingBottom: space.xxl }}>
          <Card style={{ borderColor: c.blue }}>
            <Row gap="sm" align="flex-start">
              <Ionicons name="information-circle-outline" size={17} color={c.blue} />
              <Txt variant="caption" tone="muted" style={{ flex: 1 }}>
                {t.vcFundedNotice}
              </Txt>
            </Row>
          </Card>

          {editing ? (
            <CouponForm
              coupon={editing === "new" ? null : editing}
              onDone={async () => {
                setEditing(null);
                await load();
              }}
              onCancel={() => setEditing(null)}
            />
          ) : (
            <PrimaryButton
              label={t.vcNew}
              icon="add-circle-outline"
              onPress={() => setEditing("new")}
            />
          )}

          {state === "loading" ? (
            <Loading />
          ) : rows.length === 0 && !editing ? (
            <Empty icon="pricetag-outline" title={t.vcEmpty} body={t.vcEmptyBody} />
          ) : (
            <VStack gap="md">
              {rows.map((coupon) => (
                <Card key={coupon.code}>
                  <VStack gap="sm">
                    <Row justify="space-between" align="flex-start">
                      <VStack gap="xs" style={{ flex: 1 }}>
                        <Txt variant="heading">{coupon.code}</Txt>
                        <Txt variant="caption" tone="blue">
                          {coupon.discount_type === "Percentage"
                            ? `${num(coupon.discount_value)}%`
                            : money(coupon.discount_value)}
                        </Txt>
                      </VStack>
                      <Pill
                        label={coupon.active ? t.vcActive : t.vcInactive}
                        tone={coupon.active ? "mint" : "coral"}
                      />
                    </Row>

                    {!!coupon.description && (
                      <Txt variant="caption" tone="muted">
                        {coupon.description}
                      </Txt>
                    )}

                    <Row gap="lg" style={{ flexWrap: "wrap" }}>
                      {!!coupon.min_subtotal && coupon.min_subtotal > 0 && (
                        <Txt variant="caption" tone="faint">
                          {t.vcMin} {money(coupon.min_subtotal)}
                        </Txt>
                      )}
                      {!!coupon.max_discount && coupon.max_discount > 0 && (
                        <Txt variant="caption" tone="faint">
                          {t.vcMax} {money(coupon.max_discount)}
                        </Txt>
                      )}
                      {!!coupon.expires_on && (
                        <Txt variant="caption" tone="faint">
                          {t.vcExpires} {formatDate(coupon.expires_on)}
                        </Txt>
                      )}
                    </Row>

                    <Txt variant="caption" tone="faint">
                      {/* Both numbers, because "used 40 times" means something
                          different against a limit of 40 than against none. */}
                      {t.vcUsed} {num(coupon.used_count ?? 0)}
                      {coupon.usage_limit ? ` / ${num(coupon.usage_limit)}` : ""}
                    </Txt>

                    <Row gap="lg" justify="flex-end">
                      <Pressable onPress={() => setEditing(coupon)} hitSlop={6}>
                        <Row gap="xs">
                          <Ionicons name="create-outline" size={15} color={c.blue} />
                          <Txt variant="caption" tone="blue">
                            {t.vpEdit}
                          </Txt>
                        </Row>
                      </Pressable>
                      <Pressable onPress={() => remove(coupon)} hitSlop={6}>
                        <Row gap="xs">
                          <Ionicons name="trash-outline" size={15} color={c.coral} />
                          <Txt variant="caption" tone="coral">
                            {t.remove}
                          </Txt>
                        </Row>
                      </Pressable>
                    </Row>
                  </VStack>
                </Card>
              ))}
            </VStack>
          )}
        </VStack>
      </Screen>
    </>
  );
}

function CouponForm({
  coupon,
  onDone,
  onCancel,
}: {
  coupon: Coupon | null;
  onDone: () => Promise<void>;
  onCancel: () => void;
}) {
  const t = dict();
  const { c, space, radius } = useTheme();

  const [code, setCode] = useState(coupon?.code ?? "");
  const [type, setType] = useState<DiscountType>(coupon?.discount_type ?? "Percentage");
  const [value, setValue] = useState(String(coupon?.discount_value ?? ""));
  const [description, setDescription] = useState(coupon?.description ?? "");
  const [minSubtotal, setMinSubtotal] = useState(String(coupon?.min_subtotal || ""));
  const [maxDiscount, setMaxDiscount] = useState(String(coupon?.max_discount || ""));
  const [usageLimit, setUsageLimit] = useState(String(coupon?.usage_limit || ""));
  const [active, setActive] = useState((coupon?.active ?? 1) === 1);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const save = async () => {
    setBusy(true);
    setError(null);
    try {
      await upsertMyCoupon({
        code: code.trim().toUpperCase(),
        discount_type: type,
        discount_value: Number(value) || 0,
        description: description.trim() || null,
        min_subtotal: Number(minSubtotal) || 0,
        // A cap only means anything on a percentage; sending one with a fixed
        // amount would be a number nobody can explain later.
        max_discount: type === "Percentage" ? Number(maxDiscount) || 0 : 0,
        usage_limit: Number(usageLimit) || 0,
        active: active ? 1 : 0,
      });
      await onDone();
    } catch (err) {
      setError((err as Error)?.message ?? t.loadFailed);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card>
      <VStack gap="md">
        <Txt variant="label">{coupon ? t.vpEdit : t.vcNew}</Txt>

        <Field
          label={t.vcCode}
          value={code}
          onChange={setCode}
          placeholder="SALE20"
          autoCapitalize="none"
        />

        <VStack gap="sm">
          <Txt variant="caption" tone="faint">
            {t.vcType}
          </Txt>
          <Row gap="sm">
            {(["Percentage", "Fixed"] as DiscountType[]).map((option) => (
              <Pressable
                key={option}
                onPress={() => setType(option)}
                style={{
                  flex: 1,
                  alignItems: "center",
                  borderWidth: 1,
                  borderColor: type === option ? c.blue : c.line,
                  backgroundColor: type === option ? c.blue050 : c.surface,
                  borderRadius: radius.pill,
                  paddingVertical: space.sm,
                }}
              >
                <Txt variant="caption" tone={type === option ? "blue" : "muted"}>
                  {option === "Percentage" ? t.vcPercent : t.vcFixed}
                </Txt>
              </Pressable>
            ))}
          </Row>
        </VStack>

        <Field
          label={type === "Percentage" ? t.vcValuePercent : t.vcValueFixed}
          value={value}
          onChange={setValue}
          keyboardType="numeric"
          placeholder="0"
        />

        {type === "Percentage" && (
          <Field
            label={t.vcMaxLabel}
            value={maxDiscount}
            onChange={setMaxDiscount}
            keyboardType="numeric"
            placeholder={t.vcUnlimited}
          />
        )}

        <Field
          label={t.vcMinLabel}
          value={minSubtotal}
          onChange={setMinSubtotal}
          keyboardType="numeric"
          placeholder="0"
        />
        <Field
          label={t.vcLimitLabel}
          value={usageLimit}
          onChange={setUsageLimit}
          keyboardType="numeric"
          placeholder={t.vcUnlimited}
        />
        <Field
          label={t.vcDescription}
          value={description}
          onChange={setDescription}
          placeholder={t.vpOptional}
        />

        <Pressable onPress={() => setActive((v) => !v)}>
          <Row gap="sm">
            <Ionicons
              name={active ? "checkbox" : "square-outline"}
              size={20}
              color={active ? c.blue : c.ink400}
            />
            <Txt variant="body">{t.vcActiveLabel}</Txt>
          </Row>
        </Pressable>

        {!!error && (
          <Txt variant="caption" tone="coral">
            {error}
          </Txt>
        )}

        <PrimaryButton
          label={t.save}
          icon="save-outline"
          busy={busy}
          disabled={!code.trim() || !value.trim()}
          onPress={() => void save()}
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
