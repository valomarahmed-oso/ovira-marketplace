import {
  getMyProduct,
  listCategories,
  upsertProduct,
  type Category,
  type PriceTier,
  type ProductInput,
} from "@ovira/core";
import { Ionicons } from "@expo/vector-icons";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { Pressable, View } from "react-native";

import { Field, PrimaryButton } from "../../../src/components/form";
import { Loading } from "../../../src/components/states";
import { Card, Row, Screen, Txt, VStack } from "../../../src/components/ui";
import { dict, num } from "../../../src/i18n";
import { useTheme } from "../../../src/theme-context";

/** Values the doctype stores; the Arabic is only ever a label. */
const CONDITIONS = ["New", "Used", "Refurbished"] as const;

/**
 * Create or edit one product.
 *
 * One screen for both, because `upsert_product` is one endpoint — and because
 * a separate "edit" screen is how the two drift until one of them forgets a
 * field. Arriving with `?name=` loads the product and the same form saves it.
 *
 * Saving always sends the product back for review. That is the controller's
 * rule, not this screen's, and the notice says so plainly rather than letting a
 * seller discover it when their live product disappears from the shop.
 */
export default function ProductFormScreen() {
  const { name } = useLocalSearchParams<{ name?: string }>();
  const editing = !!name;
  const t = dict();
  const { c, space, radius } = useTheme();
  const router = useRouter();

  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(editing);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [title, setTitle] = useState("");
  const [price, setPrice] = useState("");
  const [compareAt, setCompareAt] = useState("");
  const [stock, setStock] = useState("");
  const [brand, setBrand] = useState("");
  const [category, setCategory] = useState<string | null>(null);
  const [condition, setCondition] = useState<string>("New");
  const [shortDescription, setShortDescription] = useState("");
  const [description, setDescription] = useState("");
  const [tiers, setTiers] = useState<PriceTier[]>([]);

  useEffect(() => {
    void listCategories().then(setCategories);
  }, []);

  useEffect(() => {
    if (!editing) return;
    let alive = true;
    void getMyProduct(String(name)).then((doc) => {
      if (!alive || !doc) {
        setLoading(false);
        return;
      }
      setTitle(doc.title ?? "");
      setPrice(String(doc.price ?? ""));
      setCompareAt(doc.compare_at_price ? String(doc.compare_at_price) : "");
      setStock(String(doc.stock_qty ?? 0));
      setBrand(doc.brand ?? "");
      setCategory(doc.category ?? null);
      setCondition(doc.condition ?? "New");
      setShortDescription(doc.short_description ?? "");
      setDescription(doc.description ?? "");
      setTiers(doc.price_tiers ?? []);
      setLoading(false);
    });
    return () => {
      alive = false;
    };
  }, [editing, name]);

  const save = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      const input: ProductInput = {
        name: editing ? String(name) : undefined,
        title: title.trim(),
        price: Number(price) || 0,
        compare_at_price: compareAt.trim() ? Number(compareAt) : null,
        stock_qty: Number(stock) || 0,
        brand: brand.trim() || null,
        category,
        condition,
        short_description: shortDescription.trim() || null,
        description: description.trim() || null,
        // Anything below qty 2 is not a bulk tier, and the server drops it
        // silently — filtering here means the seller sees what will be kept.
        price_tiers: tiers.filter((tier) => tier.min_qty >= 2 && tier.price > 0),
      };
      await upsertProduct(input);
      router.replace("/vendor/products");
    } catch (err) {
      setError((err as Error)?.message ?? t.loadFailed);
    } finally {
      setBusy(false);
    }
  }, [
    editing,
    name,
    title,
    price,
    compareAt,
    stock,
    brand,
    category,
    condition,
    shortDescription,
    description,
    tiers,
    router,
    t.loadFailed,
  ]);

  if (loading) {
    return (
      <>
        <Stack.Screen options={{ title: editing ? t.vpEdit : t.vpNew }} />
        <Screen scroll={false}>
          <Loading />
        </Screen>
      </>
    );
  }

  const chip = (on: boolean) => ({
    borderWidth: 1,
    borderColor: on ? c.blue : c.line,
    backgroundColor: on ? c.blue050 : c.surface,
    borderRadius: radius.pill,
    paddingHorizontal: space.md,
    paddingVertical: space.xs,
  });

  return (
    <>
      <Stack.Screen options={{ title: editing ? t.vpEdit : t.vpNew }} />
      <Screen>
        <VStack gap="lg" style={{ paddingBottom: space.xxl }}>
          <Card>
            <VStack gap="md">
              <Field label={t.vpName} value={title} onChange={setTitle} placeholder={t.vpNameHint} />
              <Row gap="md">
                <View style={{ flex: 1 }}>
                  <Field
                    label={t.vpPrice}
                    value={price}
                    onChange={setPrice}
                    keyboardType="numeric"
                    placeholder="0"
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Field
                    label={t.vpCompareAt}
                    value={compareAt}
                    onChange={setCompareAt}
                    keyboardType="numeric"
                    placeholder={t.vpOptional}
                  />
                </View>
              </Row>
              <Field
                label={t.vpStock}
                value={stock}
                onChange={setStock}
                keyboardType="numeric"
                placeholder="0"
              />
              <Field
                label={t.vpBrand}
                value={brand}
                onChange={setBrand}
                placeholder={t.vpOptional}
                autoCapitalize="words"
              />
            </VStack>
          </Card>

          <Card>
            <VStack gap="md">
              <Txt variant="caption" tone="faint">
                {t.categories}
              </Txt>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space.sm }}>
                {categories.map((option) => (
                  <Pressable
                    key={option.name}
                    onPress={() => setCategory(category === option.name ? null : option.name)}
                    style={chip(category === option.name)}
                  >
                    <Txt variant="caption" tone={category === option.name ? "blue" : "muted"}>
                      {option.category_name}
                    </Txt>
                  </Pressable>
                ))}
              </View>

              <Txt variant="caption" tone="faint">
                {t.vpCondition}
              </Txt>
              <Row gap="sm">
                {CONDITIONS.map((option) => (
                  <Pressable
                    key={option}
                    onPress={() => setCondition(option)}
                    style={chip(condition === option)}
                  >
                    <Txt variant="caption" tone={condition === option ? "blue" : "muted"}>
                      {t.vpConditions[option]}
                    </Txt>
                  </Pressable>
                ))}
              </Row>
            </VStack>
          </Card>

          <Card>
            <VStack gap="md">
              <Field
                label={t.vpShortDescription}
                value={shortDescription}
                onChange={setShortDescription}
                placeholder={t.vpOptional}
              />
              <Field
                label={t.vpDescription}
                value={description}
                onChange={setDescription}
                placeholder={t.vpOptional}
                multiline
              />
            </VStack>
          </Card>

          <BulkTiers tiers={tiers} onChange={setTiers} />

          {/* Said before saving, not discovered afterwards. */}
          <Card style={{ borderColor: c.blue }}>
            <Row gap="sm" align="flex-start">
              <Ionicons name="information-circle-outline" size={17} color={c.blue} />
              <Txt variant="caption" tone="muted" style={{ flex: 1 }}>
                {t.vpReviewNotice}
              </Txt>
            </Row>
          </Card>

          {!!error && (
            <Txt variant="caption" tone="coral">
              {error}
            </Txt>
          )}

          <PrimaryButton
            label={t.save}
            icon="save-outline"
            busy={busy}
            disabled={!title.trim() || !price.trim()}
            onPress={() => void save()}
          />
        </VStack>
      </Screen>
    </>
  );
}

/**
 * Bulk pricing.
 *
 * The rule the server enforces — never below qty 2, cheapest reached tier wins
 * — is stated here rather than left for a seller to infer from a row that
 * vanished on save.
 */
function BulkTiers({
  tiers,
  onChange,
}: {
  tiers: PriceTier[];
  onChange: (tiers: PriceTier[]) => void;
}) {
  const t = dict();
  const { c, space } = useTheme();

  const update = (index: number, patch: Partial<PriceTier>) =>
    onChange(tiers.map((tier, i) => (i === index ? { ...tier, ...patch } : tier)));

  return (
    <Card>
      <VStack gap="md">
        <Row justify="space-between">
          <Txt variant="label">{t.bulkPricing}</Txt>
          <Pressable onPress={() => onChange([...tiers, { min_qty: 2, price: 0 }])} hitSlop={8}>
            <Row gap="xs">
              <Ionicons name="add-circle-outline" size={16} color={c.blue} />
              <Txt variant="caption" tone="blue">
                {t.vpAddTier}
              </Txt>
            </Row>
          </Pressable>
        </Row>

        <Txt variant="caption" tone="faint">
          {t.vpTierRule}
        </Txt>

        {tiers.map((tier, index) => (
          <Row key={index} gap="sm" align="flex-end">
            <View style={{ flex: 1 }}>
              <Field
                label={t.vpTierQty}
                value={String(tier.min_qty || "")}
                onChange={(value) => update(index, { min_qty: Number(value) || 0 })}
                keyboardType="numeric"
                placeholder="2"
              />
            </View>
            <View style={{ flex: 1 }}>
              <Field
                label={t.vpTierPrice}
                value={String(tier.price || "")}
                onChange={(value) => update(index, { price: Number(value) || 0 })}
                keyboardType="numeric"
                placeholder="0"
              />
            </View>
            <Pressable
              onPress={() => onChange(tiers.filter((_, i) => i !== index))}
              hitSlop={8}
              style={{ paddingBottom: space.md }}
            >
              <Ionicons name="close-circle" size={20} color={c.ink400} />
            </Pressable>
          </Row>
        ))}

        {tiers.length === 0 && (
          <Txt variant="caption" tone="faint">
            {t.vpNoTiers}
          </Txt>
        )}
      </VStack>
    </Card>
  );
}
