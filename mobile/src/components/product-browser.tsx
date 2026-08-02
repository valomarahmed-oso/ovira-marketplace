import type { ProductCard, ProductQuery } from "@ovira/core";
import { listProducts } from "@ovira/core";
import { type ReactNode, useCallback, useEffect, useMemo, useState } from "react";
import { Pressable, ScrollView, View } from "react-native";

import { dict, num } from "../i18n";
import { useTheme } from "../theme-context";
import { ProductGrid } from "./product-grid";
import { Empty, Loading } from "./states";
import { Row, Txt, VStack } from "./ui";

const PAGE = 24;

type Sort = NonNullable<ProductQuery["sort"]>;

/** What the caller fixes; sorting and the stock filter belong to the shopper. */
export type BrowseFilter = Omit<ProductQuery, "sort" | "in_stock" | "limit" | "start">;

/**
 * A filtered product listing with sorting, an in-stock toggle and paging.
 *
 * Three screens are this screen with one field changed — all products, one
 * category, one seller's shelf — and they were briefly three copies. The copies
 * are the problem: paging and the "empty vs failed" distinction are both easy
 * to get subtly wrong, and getting them right in one of three places is how a
 * store ends up with a category that silently stops at 24 items.
 */
export function ProductBrowser({
  filter,
  emptyTitle,
  header,
}: {
  filter: BrowseFilter;
  emptyTitle: string;
  /** Scrolls with the list rather than sitting above it — a store's profile. */
  header?: ReactNode;
}) {
  const { c, space, radius } = useTheme();
  const t = dict();

  const [rows, setRows] = useState<ProductCard[]>([]);
  const [sort, setSort] = useState<Sort>("latest");
  const [inStockOnly, setInStockOnly] = useState(false);
  const [state, setState] = useState<"loading" | "ready">("loading");
  const [more, setMore] = useState(false);
  const [exhausted, setExhausted] = useState(false);

  // Callers build this object inline, so its identity changes on every render.
  // Depending on it directly re-runs the effect forever; depending on its
  // *contents* re-runs it when the filter actually changes.
  const key = JSON.stringify(filter);
  const stable = useMemo(() => JSON.parse(key) as BrowseFilter, [key]);

  const load = useCallback(
    async (start: number) => {
      const page = await listProducts({
        ...stable,
        sort,
        in_stock: inStockOnly ? 1 : undefined,
        limit: PAGE,
        start,
      });
      setExhausted(page.length < PAGE);
      return page;
    },
    [stable, sort, inStockOnly],
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

  const chip = (on: boolean) => ({
    backgroundColor: on ? c.blue : c.surface,
    borderColor: on ? c.blue : c.line,
    borderWidth: 1,
    borderRadius: radius.pill,
    paddingHorizontal: space.lg,
    paddingVertical: space.sm,
  });

  return (
    <VStack gap="md" style={{ flex: 1 }}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ gap: space.sm, paddingVertical: space.xs }}
      >
        {sorts.map((option) => (
          <Pressable key={option.key} onPress={() => setSort(option.key)} style={chip(sort === option.key)}>
            <Txt variant="caption" tone={sort === option.key ? "onBlue" : "muted"}>
              {option.label}
            </Txt>
          </Pressable>
        ))}
        <Pressable onPress={() => setInStockOnly((v) => !v)} style={chip(inStockOnly)}>
          <Txt variant="caption" tone={inStockOnly ? "onBlue" : "muted"}>
            {t.inStockOnly}
          </Txt>
        </Pressable>
      </ScrollView>

      {state === "loading" ? (
        <Loading />
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
          {header}
          {rows.length === 0 ? (
            <Empty icon="cube-outline" title={emptyTitle} />
          ) : (
            <>
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
            </>
          )}
        </ScrollView>
      )}
    </VStack>
  );
}
