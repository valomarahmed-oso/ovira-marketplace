import type { ProductCard, ProductQuery } from "@ovira/core";
import { decodeSlug, listProducts, resolveCategory } from "@ovira/core";
import { Stack, useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { Pressable, ScrollView, View } from "react-native";

import { ProductGrid } from "../../src/components/product-grid";
import { Empty, Loading } from "../../src/components/states";
import { Row, Screen, Txt, VStack } from "../../src/components/ui";
import { dict, num } from "../../src/i18n";
import { useTheme } from "../../src/theme-context";

const PAGE = 24;

type Sort = NonNullable<ProductQuery["sort"]>;

export default function CategoryScreen() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const { c, space, radius } = useTheme();
  const t = dict();

  const [rows, setRows] = useState<ProductCard[]>([]);
  const [title, setTitle] = useState("");
  const [sort, setSort] = useState<Sort>("latest");
  const [inStockOnly, setInStockOnly] = useState(false);
  const [state, setState] = useState<"loading" | "ready">("loading");
  const [more, setMore] = useState(false);
  const [exhausted, setExhausted] = useState(false);

  // The route param arrives percent-encoded — an Arabic category slug is a long
  // run of %D8%A7… and looking it up unencoded is how the web store used to 404
  // its own categories.
  const category = decodeSlug(String(slug ?? ""));

  const load = useCallback(
    async (start: number) => {
      const page = await listProducts({
        category,
        sort,
        in_stock: inStockOnly ? 1 : undefined,
        limit: PAGE,
        start,
      });
      setExhausted(page.length < PAGE);
      return page;
    },
    [category, sort, inStockOnly],
  );

  useEffect(() => {
    let alive = true;
    setState("loading");
    void load(0).then((page) => {
      if (!alive) return;
      setRows(page);
      setState("ready");
    });
    return () => {
      alive = false;
    };
  }, [load]);

  /**
   * The heading comes from the category itself, not from the first product in
   * it. A category can be legitimately empty, and titling the screen from a row
   * that isn't there is how the web store came to show shoppers a raw
   * "alkmbywtr-w-mstlzmath" where its name belonged.
   */
  useEffect(() => {
    let alive = true;
    void resolveCategory(category).then((found) => {
      if (alive && found) setTitle(found.category_name);
    });
    return () => {
      alive = false;
    };
  }, [category]);

  const loadMore = useCallback(async () => {
    if (more || exhausted) return;
    setMore(true);
    const page = await load(rows.length);
    setRows((current) => [...current, ...page]);
    setMore(false);
  }, [more, exhausted, load, rows.length]);

  const sorts: Array<{ key: Sort; label: string }> = [
    { key: "latest", label: t.sortLatest },
    { key: "price_asc", label: t.sortPriceAsc },
    { key: "price_desc", label: t.sortPriceDesc },
    { key: "rating", label: t.sortRating },
  ];

  return (
    <>
      <Stack.Screen options={{ title: title || t.categories }} />
      <Screen scroll={false}>
        <VStack gap="md" style={{ flex: 1 }}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ gap: space.sm, paddingVertical: space.xs }}
          >
            {sorts.map((option) => {
              const on = sort === option.key;
              return (
                <Pressable
                  key={option.key}
                  onPress={() => setSort(option.key)}
                  style={{
                    backgroundColor: on ? c.blue : c.surface,
                    borderColor: on ? c.blue : c.line,
                    borderWidth: 1,
                    borderRadius: radius.pill,
                    paddingHorizontal: space.lg,
                    paddingVertical: space.sm,
                  }}
                >
                  <Txt variant="caption" tone={on ? "onBlue" : "muted"}>
                    {option.label}
                  </Txt>
                </Pressable>
              );
            })}
            <Pressable
              onPress={() => setInStockOnly((v) => !v)}
              style={{
                backgroundColor: inStockOnly ? c.blue : c.surface,
                borderColor: inStockOnly ? c.blue : c.line,
                borderWidth: 1,
                borderRadius: radius.pill,
                paddingHorizontal: space.lg,
                paddingVertical: space.sm,
              }}
            >
              <Txt variant="caption" tone={inStockOnly ? "onBlue" : "muted"}>
                {t.inStockOnly}
              </Txt>
            </Pressable>
          </ScrollView>

          {state === "loading" ? (
            <Loading />
          ) : rows.length === 0 ? (
            <Empty icon="cube-outline" title={t.emptyCategory} />
          ) : (
            <ScrollView
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{ gap: space.lg, paddingBottom: space.xxl }}
              onScroll={({ nativeEvent: e }) => {
                const nearBottom =
                  e.layoutMeasurement.height + e.contentOffset.y >= e.contentSize.height - 600;
                if (nearBottom) void loadMore();
              }}
              scrollEventThrottle={200}
            >
              <Row>
                <Txt variant="label" tone="faint">
                  {num(rows.length)} {t.results}
                </Txt>
              </Row>
              <ProductGrid products={rows} />
              {more && <Loading pad={16} />}
              {!exhausted && !more && (
                <Pressable onPress={() => void loadMore()} style={{ alignItems: "center" }}>
                  <View
                    style={{
                      borderWidth: 1,
                      borderColor: c.blue,
                      borderRadius: radius.pill,
                      paddingHorizontal: space.xl,
                      paddingVertical: space.sm,
                    }}
                  >
                    <Txt variant="label" tone="blue">
                      {t.loadMore}
                    </Txt>
                  </View>
                </Pressable>
              )}
            </ScrollView>
          )}
        </VStack>
      </Screen>
    </>
  );
}
