import { listCategories, listProducts, type Category, type ProductCard } from "@ovira/core";
import { Ionicons } from "@expo/vector-icons";
import { Link, useRouter } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { Pressable, RefreshControl, ScrollView, View } from "react-native";

import { Logo } from "../../src/components/logo";
import { ProductTile } from "../../src/components/product-card";
import { ProductGrid } from "../../src/components/product-grid";
import { SearchBar } from "../../src/components/search-bar";
import { Failed, Loading } from "../../src/components/states";
import { Row, Screen, Txt, VStack } from "../../src/components/ui";
import { dict } from "../../src/i18n";
import { categoryIcon } from "../../src/icons";
import { useTheme } from "../../src/theme-context";

type Feed = {
  categories: Category[];
  offers: ProductCard[];
  topRated: ProductCard[];
  latest: ProductCard[];
};

const EMPTY: Feed = { categories: [], offers: [], topRated: [], latest: [] };

export default function HomeScreen() {
  const { c, space } = useTheme();
  const router = useRouter();
  const t = dict();

  const [feed, setFeed] = useState<Feed>(EMPTY);
  const [state, setState] = useState<"loading" | "ready" | "failed">("loading");
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    const [categories, latest, topRated] = await Promise.all([
      listCategories(),
      listProducts({ sort: "latest", limit: 12 }),
      listProducts({ sort: "rating", limit: 10 }),
    ]);

    // The store has no dedicated "deals" endpoint, and inventing one for a rail
    // would mean a round trip that returns the same rows. A genuine discount is
    // a compare-at price above the price — the same test the tile's badge uses,
    // so a product can never appear here without showing why.
    const offers = latest.filter((p) => (p.compare_at_price ?? 0) > p.price).slice(0, 10);

    setFeed({ categories, offers, topRated, latest });
    // Categories can legitimately be empty on a new store; products failing to
    // load at all is the signal that something is actually wrong.
    setState(latest.length || categories.length ? "ready" : "failed");
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
      <VStack gap="lg" style={{ paddingBottom: space.md }}>
        <Row gap="md">
          <Logo size={40} />
          <View style={{ flex: 1 }}>
            <Txt variant="heading">{t.brand}</Txt>
            <Txt variant="caption" tone="faint">
              {t.tagline}
            </Txt>
          </View>
        </Row>
        <SearchBar readOnly onPress={() => router.push("/search")} />
      </VStack>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: space.xxl, gap: space.xl }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={c.blue} />
        }
      >
        {state === "loading" && <Loading />}
        {state === "failed" && <Failed onRetry={() => void load()} />}

        {state === "ready" && (
          <>
            {feed.categories.length > 0 && (
              <VStack gap="md">
                <SectionHead title={t.categories} />
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={{ gap: space.md }}
                >
                  {feed.categories.map((cat) => (
                    <CategoryChip key={cat.name} category={cat} />
                  ))}
                </ScrollView>
              </VStack>
            )}

            {feed.offers.length > 0 && (
              <Rail title={t.offers} products={feed.offers} accent />
            )}

            {feed.topRated.length > 0 && <Rail title={t.topRated} products={feed.topRated} />}

            <VStack gap="md">
              <SectionHead title={t.newArrivals} />
              <ProductGrid products={feed.latest} />
            </VStack>
          </>
        )}
      </ScrollView>
    </Screen>
  );
}

function SectionHead({ title, href }: { title: string; href?: string }) {
  const t = dict();
  return (
    <Row justify="space-between">
      <Txt variant="heading">{title}</Txt>
      {href && (
        <Link href={href as never} asChild>
          <Pressable>
            <Txt variant="label" tone="blue">
              {t.seeAll}
            </Txt>
          </Pressable>
        </Link>
      )}
    </Row>
  );
}

function Rail({
  title,
  products,
  accent = false,
}: {
  title: string;
  products: ProductCard[];
  accent?: boolean;
}) {
  const { c, space } = useTheme();
  return (
    <VStack gap="md">
      <Row gap="sm">
        {accent && <Ionicons name="flame" size={16} color={c.coral} />}
        <Txt variant="heading">{title}</Txt>
      </Row>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ gap: space.md, paddingBottom: space.xs }}
      >
        {products.map((p) => (
          <ProductTile key={p.name} product={p} width={158} />
        ))}
      </ScrollView>
    </VStack>
  );
}

function CategoryChip({ category }: { category: Category }) {
  const { c, space, radius } = useTheme();
  return (
    <Link href={{ pathname: "/category/[slug]", params: { slug: category.slug } }} asChild>
      <Pressable style={{ alignItems: "center", width: 76, gap: space.xs }}>
        <View
          style={{
            width: 60,
            height: 60,
            borderRadius: radius.xl,
            backgroundColor: c.blue050,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Ionicons name={categoryIcon(category.icon)} size={26} color={c.blue} />
        </View>
        <Txt variant="caption" numberOfLines={2} style={{ textAlign: "center" }}>
          {category.category_name}
        </Txt>
      </Pressable>
    </Link>
  );
}
