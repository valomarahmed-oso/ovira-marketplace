import type { Facets, ProductCard, ProductQuery } from "@ovira/core";
import { catalogFacets, listProducts } from "@ovira/core";
import { Ionicons } from "@expo/vector-icons";
import { type ReactNode, useCallback, useEffect, useMemo, useState } from "react";
import { Pressable, ScrollView, TextInput, View } from "react-native";

import { dict, money, num } from "../i18n";
import { useTheme } from "../theme-context";
import { ProductGrid } from "./product-grid";
import { SponsoredStrip } from "./sponsored-strip";
import { Empty, Loading } from "./states";
import { Row, Txt, VStack } from "./ui";

const PAGE = 24;

type Sort = NonNullable<ProductQuery["sort"]>;

/** What the caller fixes; everything else belongs to the shopper. */
export type BrowseFilter = Omit<
  ProductQuery,
  "sort" | "in_stock" | "limit" | "start" | "brand" | "min_price" | "max_price" | "min_rating"
>;

/** The shopper's own choices, all of which the server applies. */
type Chosen = {
  sort: Sort;
  inStock: boolean;
  brand: string | null;
  minPrice: string;
  maxPrice: string;
  minRating: number | null;
};

const NONE: Chosen = {
  sort: "latest",
  inStock: false,
  brand: null,
  minPrice: "",
  maxPrice: "",
  minRating: null,
};

/** How many filters are on — the number on the button, so it is never a mystery. */
function activeCount(chosen: Chosen): number {
  return (
    (chosen.inStock ? 1 : 0) +
    (chosen.brand ? 1 : 0) +
    (chosen.minPrice ? 1 : 0) +
    (chosen.maxPrice ? 1 : 0) +
    (chosen.minRating ? 1 : 0)
  );
}

/**
 * A filtered product listing with sorting, filters and paging.
 *
 * Three screens are this screen with one field changed — all products, one
 * category, one seller's shelf — and they were briefly three copies. The copies
 * are the problem: paging and the "empty vs failed" distinction are both easy
 * to get subtly wrong, and getting them right in one of three places is how a
 * store ends up with a category that silently stops at 24 items.
 *
 * Every filter is a server query parameter, not a pass over the loaded page.
 * Filtering 24 rows on the device and calling it "under 500 ج.م" would be a
 * lie about the other 900 products.
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
  const [chosen, setChosen] = useState<Chosen>(NONE);
  const [showFilters, setShowFilters] = useState(false);
  const [facets, setFacets] = useState<Facets>({ brands: [], price_min: 0, price_max: 0 });
  const [state, setState] = useState<"loading" | "ready">("loading");
  const [more, setMore] = useState(false);
  const [exhausted, setExhausted] = useState(false);

  // Callers build this object inline, so its identity changes on every render.
  // Depending on it directly re-runs the effect forever; depending on its
  // *contents* re-runs it when the filter actually changes.
  const key = JSON.stringify(filter);
  const stable = useMemo(() => JSON.parse(key) as BrowseFilter, [key]);

  /**
   * `catalog_facets` scopes by category and search, but has no vendor
   * parameter. On a seller's shelf it would therefore offer every brand in the
   * marketplace, most of which that store does not carry — so there the brand
   * list is derived from the rows actually loaded instead. Narrower than the
   * truth, but never wrong in a way that returns nothing.
   */
  const vendorScoped = !!stable.vendor;

  useEffect(() => {
    if (vendorScoped) return;
    let alive = true;
    void catalogFacets({ category: stable.category, search: stable.search }).then((found) => {
      if (alive) setFacets(found);
    });
    return () => {
      alive = false;
    };
  }, [stable.category, stable.search, vendorScoped]);

  const brands = useMemo(() => {
    if (!vendorScoped) return facets.brands;
    return [...new Set(rows.map((r) => r.brand).filter((b): b is string => !!b))].sort();
  }, [vendorScoped, facets.brands, rows]);

  const load = useCallback(
    async (start: number) => {
      const page = await listProducts({
        ...stable,
        sort: chosen.sort,
        in_stock: chosen.inStock ? 1 : undefined,
        brand: chosen.brand ?? undefined,
        min_price: chosen.minPrice ? Number(chosen.minPrice) : undefined,
        max_price: chosen.maxPrice ? Number(chosen.maxPrice) : undefined,
        min_rating: chosen.minRating ?? undefined,
        limit: PAGE,
        start,
      });
      setExhausted(page.length < PAGE);
      return page;
    },
    [stable, chosen],
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

  const active = activeCount(chosen);

  return (
    <VStack gap="md" style={{ flex: 1 }}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ gap: space.sm, paddingVertical: space.xs }}
      >
        <Pressable onPress={() => setShowFilters((v) => !v)} style={chip(active > 0)}>
          <Row gap="xs">
            <Ionicons
              name="options-outline"
              size={14}
              color={active > 0 ? "#ffffff" : c.ink600}
            />
            <Txt variant="caption" tone={active > 0 ? "onBlue" : "muted"}>
              {t.filters}
              {active > 0 ? ` (${num(active)})` : ""}
            </Txt>
          </Row>
        </Pressable>

        {sorts.map((option) => (
          <Pressable
            key={option.key}
            onPress={() => setChosen((s) => ({ ...s, sort: option.key }))}
            style={chip(chosen.sort === option.key)}
          >
            <Txt variant="caption" tone={chosen.sort === option.key ? "onBlue" : "muted"}>
              {option.label}
            </Txt>
          </Pressable>
        ))}
        <Pressable
          onPress={() => setChosen((s) => ({ ...s, inStock: !s.inStock }))}
          style={chip(chosen.inStock)}
        >
          <Txt variant="caption" tone={chosen.inStock ? "onBlue" : "muted"}>
            {t.inStockOnly}
          </Txt>
        </Pressable>
      </ScrollView>

      {showFilters && (
        <FilterPanel
          chosen={chosen}
          onChange={setChosen}
          brands={brands}
          facets={facets}
          onClear={() => setChosen({ ...NONE, sort: chosen.sort })}
        />
      )}

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
          {/* Above the results, as on the web: a paid position is only worth
              paying for if it is seen, and it is labelled so nobody is misled. */}
          <SponsoredStrip category={stable.category} />
          {rows.length === 0 ? (
            <Empty
              icon="cube-outline"
              title={active > 0 ? t.noResults : emptyTitle}
              // A filtered empty is not the same as an empty shelf, and the
              // useful action differs: clear the filters, not "come back later".
              body={active > 0 ? t.noResultsBody : undefined}
              onRetry={active > 0 ? () => setChosen({ ...NONE, sort: chosen.sort }) : undefined}
              actionLabel={t.filtersClear}
            />
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

function FilterPanel({
  chosen,
  onChange,
  brands,
  facets,
  onClear,
}: {
  chosen: Chosen;
  onChange: (next: Chosen) => void;
  brands: string[];
  facets: Facets;
  onClear: () => void;
}) {
  const t = dict();
  const { c, space, radius } = useTheme();

  const smallChip = (on: boolean) => ({
    borderWidth: 1,
    borderColor: on ? c.blue : c.line,
    backgroundColor: on ? c.blue050 : c.surface,
    borderRadius: radius.pill,
    paddingHorizontal: space.md,
    paddingVertical: space.xs,
  });

  return (
    <View
      style={{
        backgroundColor: c.surface,
        borderWidth: 1,
        borderColor: c.line,
        borderRadius: radius.lg,
        padding: space.lg,
        gap: space.lg,
      }}
    >
      {brands.length > 0 && (
        <VStack gap="sm">
          <Txt variant="caption" tone="faint">
            {t.filterBrand}
          </Txt>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space.sm }}>
            {brands.map((brand) => {
              const on = chosen.brand === brand;
              return (
                <Pressable
                  key={brand}
                  onPress={() => onChange({ ...chosen, brand: on ? null : brand })}
                  style={smallChip(on)}
                >
                  <Txt variant="caption" tone={on ? "blue" : "muted"}>
                    {brand}
                  </Txt>
                </Pressable>
              );
            })}
          </View>
        </VStack>
      )}

      <VStack gap="sm">
        <Row justify="space-between">
          <Txt variant="caption" tone="faint">
            {t.filterPrice}
          </Txt>
          {facets.price_max > 0 && (
            <Txt variant="caption" tone="faint">
              {money(facets.price_min)} — {money(facets.price_max)}
            </Txt>
          )}
        </Row>
        <Row gap="sm">
          <PriceBox
            value={chosen.minPrice}
            onChange={(v) => onChange({ ...chosen, minPrice: v })}
            placeholder={t.filterFrom}
          />
          <PriceBox
            value={chosen.maxPrice}
            onChange={(v) => onChange({ ...chosen, maxPrice: v })}
            placeholder={t.filterTo}
          />
        </Row>
      </VStack>

      <VStack gap="sm">
        <Txt variant="caption" tone="faint">
          {t.filterRating}
        </Txt>
        <Row gap="sm">
          {[4, 3, 2].map((stars) => {
            const on = chosen.minRating === stars;
            return (
              <Pressable
                key={stars}
                onPress={() => onChange({ ...chosen, minRating: on ? null : stars })}
                style={smallChip(on)}
              >
                <Row gap="xs">
                  <Ionicons name="star" size={11} color={on ? c.blue : c.gold} />
                  <Txt variant="caption" tone={on ? "blue" : "muted"}>
                    {num(stars)}+
                  </Txt>
                </Row>
              </Pressable>
            );
          })}
        </Row>
      </VStack>

      <Pressable onPress={onClear} style={{ alignSelf: "flex-start" }}>
        <Txt variant="caption" tone="coral">
          {t.filtersClear}
        </Txt>
      </Pressable>
    </View>
  );
}

function PriceBox({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
}) {
  const { c, space, radius } = useTheme();
  return (
    <View
      style={{
        flex: 1,
        backgroundColor: c.canvas,
        borderWidth: 1,
        borderColor: c.line,
        borderRadius: radius.md,
        paddingHorizontal: space.md,
        height: 40,
        justifyContent: "center",
      }}
    >
      <TextInput
        value={value}
        // Digits only: the field goes straight into a numeric query parameter,
        // and a stray character would silently drop the whole filter.
        onChangeText={(text) => onChange(text.replace(/[^0-9]/g, ""))}
        placeholder={placeholder}
        placeholderTextColor={c.ink400}
        keyboardType="numeric"
        style={{
          color: c.ink,
          fontSize: 14,
          textAlign: "right",
          writingDirection: "rtl",
          paddingVertical: 0,
        }}
      />
    </View>
  );
}
