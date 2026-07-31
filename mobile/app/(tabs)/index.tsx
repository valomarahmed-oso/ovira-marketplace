import { listProducts, storeConfig, type ProductCard, type StoreConfig } from "@ovira/core";
import { Image } from "expo-image";
import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, View } from "react-native";

import { Logo } from "../../src/components/logo";
import { Card, Pill, Row, Screen, Txt, VStack } from "../../src/components/ui";
import { dict, money, num } from "../../src/i18n";
import { SITE_LABEL } from "../../src/ovira";
import { useTheme } from "../../src/theme-context";

/**
 * Home, at shell stage.
 *
 * The screen a shopper eventually gets is slice 3's job. What this one has to
 * prove is that the whole chain works on a real device: `configure()` → core's
 * HTTP layer → the live Frappe site → the shared types → this theme. If a
 * product from the real store renders here with the right price, everything
 * underneath it is wired correctly, and slice 3 is only layout.
 */
export default function HomeScreen() {
  const { c, space, radius } = useTheme();
  const t = dict();

  const [config, setConfig] = useState<StoreConfig | null>(null);
  const [products, setProducts] = useState<ProductCard[]>([]);
  const [state, setState] = useState<"loading" | "ready" | "offline">("loading");
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    // Both reads degrade to a default rather than throwing, so "offline" is
    // inferred from an empty catalogue rather than from a caught error.
    const [cfg, rows] = await Promise.all([storeConfig(), listProducts({ limit: 8 })]);
    setConfig(cfg);
    setProducts(rows);
    setState(rows.length ? "ready" : "offline");
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  return (
    <Screen scroll={false}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={c.blue} />
        }
      >
        <VStack gap="xl">
          <Row gap="md">
            <Logo size={44} />
            <View style={{ flex: 1 }}>
              <Txt variant="title">{t.brand}</Txt>
              <Txt variant="label" tone="faint">
                {t.tagline}
              </Txt>
            </View>
          </Row>

          <ConnectionCard state={state} config={config} />

          {state === "loading" ? (
            <ActivityIndicator color={c.blue} style={{ marginTop: space.xl }} />
          ) : null}

          {products.length > 0 && (
            <VStack gap="md">
              <Txt variant="heading">من متجرك دلوقتي</Txt>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ gap: space.md, paddingBottom: space.xs }}
              >
                {products.map((p) => (
                  <Pressable key={p.name} style={{ width: 156 }}>
                    <Card padded={false}>
                      <Image
                        source={p.image}
                        style={{ width: "100%", height: 132, backgroundColor: c.blue050 }}
                        contentFit="cover"
                        transition={180}
                      />
                      <View style={{ padding: space.md, gap: space.xs }}>
                        <Txt variant="label" numberOfLines={2} style={{ minHeight: 40 }}>
                          {p.title}
                        </Txt>
                        <Txt variant="heading" tone="blue">
                          {money(p.price)}
                        </Txt>
                        {p.stock_qty <= 0 ? (
                          <Txt variant="caption" tone="coral">
                            نفدت الكمية
                          </Txt>
                        ) : (
                          <Txt variant="caption" tone="faint">
                            متاح {num(p.stock_qty)}
                          </Txt>
                        )}
                      </View>
                    </Card>
                  </Pressable>
                ))}
              </ScrollView>
            </VStack>
          )}

          <View
            style={{
              borderRadius: radius.lg,
              borderWidth: 1,
              borderColor: c.line,
              borderStyle: "dashed",
              padding: space.lg,
              gap: space.xs,
            }}
          >
            <Txt variant="label" tone="muted">
              الشرائح الجاية
            </Txt>
            <Txt variant="caption" tone="faint">
              شاشات التصفّح والمنتج · السلة والدفع · الإشعارات والبصمة والباركود
            </Txt>
          </View>
        </VStack>
      </ScrollView>
    </Screen>
  );
}

function ConnectionCard({
  state,
  config,
}: {
  state: "loading" | "ready" | "offline";
  config: StoreConfig | null;
}) {
  const { space } = useTheme();
  const t = dict();
  const label = state === "ready" ? t.connected : state === "loading" ? t.connecting : t.offline;

  return (
    <Card>
      <VStack gap="md">
        <Row justify="space-between">
          <Pill label={label} tone={state === "offline" ? "coral" : "mint"} />
          <Txt variant="caption" tone="faint">
            {SITE_LABEL}
          </Txt>
        </Row>
        {config && (
          <Row gap="lg" style={{ flexWrap: "wrap", rowGap: space.sm }}>
            <Fact label="الوضع" value={config.multiVendor ? "متعدّد البائعين" : "متجر فردي"} />
            <Fact label="العملة" value={config.currency} />
            <Fact
              label="الضريبة"
              // The figure the whole tax investigation turned on. Reading it off
              // the live site here means the app can never quietly disagree
              // with the invoice about whether VAT is already in the price.
              value={
                config.tax
                  ? `${config.tax.rate}% ${config.tax.inclusive ? "شاملة" : "مضافة"}`
                  : "بدون"
              }
            />
          </Row>
        )}
      </VStack>
    </Card>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ gap: 2 }}>
      <Txt variant="caption" tone="faint">
        {label}
      </Txt>
      <Txt variant="label">{value}</Txt>
    </View>
  );
}
