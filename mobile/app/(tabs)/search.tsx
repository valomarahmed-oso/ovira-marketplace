import type { Category, ProductCard, SuggestedProduct } from "@ovira/core";
import { listProducts, searchSuggestions } from "@ovira/core";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { Pressable, ScrollView, View } from "react-native";

import { ProductGrid, SuggestionRow } from "../../src/components/product-grid";
import { SearchBar } from "../../src/components/search-bar";
import { Empty, Loading } from "../../src/components/states";
import { Row, Screen, Txt, VStack } from "../../src/components/ui";
import { dict, num } from "../../src/i18n";
import { useTheme } from "../../src/theme-context";

/** Long enough that typing a word doesn't fire five queries, short enough to feel live. */
const DEBOUNCE_MS = 280;
const MIN_TERM = 2;

export default function SearchScreen() {
  const { c, space, radius } = useTheme();
  const router = useRouter();
  const t = dict();

  const [query, setQuery] = useState("");
  const [hints, setHints] = useState<{
    products: SuggestedProduct[];
    categories: Category[];
  } | null>(null);
  const [results, setResults] = useState<ProductCard[] | null>(null);
  const [busy, setBusy] = useState(false);

  /**
   * Every keystroke aborts the request the previous one started. Without it a
   * slow answer for "لاب" can land after the answer for "لابتوب" and replace it
   * — the list then shows results for a word the shopper has already typed
   * past, which reads as the search being broken.
   */
  const inflight = useRef<AbortController | null>(null);

  useEffect(() => {
    const term = query.trim();
    inflight.current?.abort();

    if (term.length < MIN_TERM) {
      setHints(null);
      setBusy(false);
      return;
    }

    const controller = new AbortController();
    inflight.current = controller;
    setBusy(true);

    const timer = setTimeout(async () => {
      const found = await searchSuggestions(term, controller.signal);
      if (controller.signal.aborted) return;
      setHints(found);
      setBusy(false);
    }, DEBOUNCE_MS);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [query]);

  /** The full, faceted listing — what pressing "search" or "see all" gets you. */
  const runFullSearch = useCallback(async () => {
    const term = query.trim();
    if (term.length < MIN_TERM) return;
    setBusy(true);
    setResults(await listProducts({ search: term, limit: 24 }));
    setBusy(false);
  }, [query]);

  const short = query.trim().length < MIN_TERM;
  const nothing = !short && !busy && !results?.length && !hints?.products.length;

  return (
    <Screen scroll={false}>
      <VStack gap="lg" style={{ flex: 1 }}>
        <SearchBar
          value={query}
          onChange={(text) => {
            setQuery(text);
            // A new term invalidates the previous full result set; leaving it on
            // screen under a different query is the same stale-answer problem.
            setResults(null);
          }}
          onSubmit={() => void runFullSearch()}
          autoFocus
        />

        {short ? (
          <Empty icon="search-outline" title={t.searchHint} />
        ) : (
          <ScrollView
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{ gap: space.lg, paddingBottom: space.xxl }}
          >
            {!!hints?.categories.length && (
              <VStack gap="sm">
                <Txt variant="label" tone="faint">
                  {t.categories}
                </Txt>
                <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space.sm }}>
                  {hints.categories.map((cat) => (
                    <Pressable
                      key={cat.slug}
                      onPress={() => router.push({ pathname: "/category/[slug]", params: { slug: cat.slug } })}
                      style={{
                        flexDirection: "row",
                        alignItems: "center",
                        gap: space.xs,
                        backgroundColor: c.blue050,
                        borderRadius: radius.pill,
                        paddingHorizontal: space.md,
                        paddingVertical: space.sm,
                      }}
                    >
                      <Ionicons name="pricetag-outline" size={13} color={c.blue} />
                      <Txt variant="caption" tone="blue">
                        {cat.category_name}
                      </Txt>
                    </Pressable>
                  ))}
                </View>
              </VStack>
            )}

            {busy && !hints && !results && <Loading />}

            {results ? (
              <VStack gap="md">
                <Txt variant="label" tone="faint">
                  {num(results.length)} {t.results}
                </Txt>
                <ProductGrid products={results} />
              </VStack>
            ) : (
              !!hints?.products.length && (
                <VStack gap="sm">
                  <Row justify="space-between">
                    <Txt variant="label" tone="faint">
                      {num(hints.products.length)} {t.results}
                    </Txt>
                    <Pressable onPress={() => void runFullSearch()}>
                      <Txt variant="label" tone="blue">
                        {t.seeAll}
                      </Txt>
                    </Pressable>
                  </Row>
                  {hints.products.map((p) => (
                    <SuggestionRow key={p.slug} product={p} />
                  ))}
                </VStack>
              )
            )}

            {nothing && <Empty icon="search-outline" title={t.noResults} body={t.noResultsBody} />}
          </ScrollView>
        )}
      </VStack>
    </Screen>
  );
}
