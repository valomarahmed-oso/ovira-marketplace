import {
  getHomepage,
  listCategories,
  listProducts,
  recommendedForYou,
  type Category,
  type Homepage,
  type ProductCard,
} from "@ovira/core";
import { Ionicons } from "@expo/vector-icons";
import { Link, useRouter } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { Pressable, RefreshControl, ScrollView, View } from "react-native";

import { HeroBanner, PromoBanner } from "../../src/components/banner";
import { Logo } from "../../src/components/logo";
import { ProductTile } from "../../src/components/product-card";
import { ProductGrid } from "../../src/components/product-grid";
import { SearchBar } from "../../src/components/search-bar";
import { Failed, Loading } from "../../src/components/states";
import { Row, Screen, Txt, VStack } from "../../src/components/ui";
import { dict } from "../../src/i18n";
import { categoryIcon } from "../../src/icons";
import { useRecentlyViewed } from "../../src/recently-viewed";
import { useStoreConfig } from "../../src/store-config";
import { useTheme } from "../../src/theme-context";

type Feed = {
  categories: Category[];
  offers: ProductCard[];
  topRated: ProductCard[];
  latest: ProductCard[];
  home: Homepage;
  forYou: ProductCard[];
};

const EMPTY: Feed = {
  categories: [],
  offers: [],
  topRated: [],
  latest: [],
  home: { hero: [], promos: [], deal: null, sections: [] },
  forYou: [],
};

export default function HomeScreen() {
  const { c, space } = useTheme();
  const router = useRouter();
  const t = dict();

  const [feed, setFeed] = useState<Feed>(EMPTY);
  const [state, setState] = useState<"loading" | "ready" | "failed">("loading");
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    const [categories, latest, topRated, home, forYou] = await Promise.all([
      listCategories(),
      listProducts({ sort: "latest", limit: 12 }),
      listProducts({ sort: "rating", limit: 10 }),
      // The operator's own homepage: banners, a featured deal, and whatever
      // rails they curated. Everything in it is optional, so the hand-built
      // rails below stay as the floor rather than being replaced by it.
      getHomepage(),
      // Guest-safe: the endpoint gives personalised picks with a session and
      // popular ones without, so it is called either way.
      recommendedForYou(10),
    ]);

    // The store has no dedicated "deals" endpoint, and inventing one for a rail
    // would mean a round trip that returns the same rows. A genuine discount is
    // a compare-at price above the price — the same test the tile's badge uses,
    // so a product can never appear here without showing why.
    const offers = latest.filter((p) => (p.compare_at_price ?? 0) > p.price).slice(0, 10);

    setFeed({ categories, offers, topRated, latest, home, forYou });
    // Categories can legitimately be empty on a new store; products failing to
    // load at all is the signal that something is actually wrong.
    setState(latest.length || categories.length ? "ready" : "failed");
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  // Whether the operator has curated the homepage themselves.
  const curated = feed.home.sections.length > 0;

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
            {/* The operator's banners come first because that is what they are
                for — a scheduled campaign that nobody sees is not a campaign. */}
            {feed.home.hero.length > 0 && (
              <VStack gap="md">
                {feed.home.hero.map((banner) => (
                  <HeroBanner key={banner.name} banner={banner} />
                ))}
              </VStack>
            )}

            {feed.categories.length > 0 && (
              <VStack gap="md">
                <SectionHead title={t.categories} href="/categories" />
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

            {feed.home.promos.length > 0 && (
              <Row gap="md" align="flex-start">
                {feed.home.promos.slice(0, 2).map((banner) => (
                  <PromoBanner key={banner.name} banner={banner} />
                ))}
              </Row>
            )}

            {/* One product the operator (or the deepest markdown) put forward. */}
            {feed.home.deal && (
              <VStack gap="md">
                <Row gap="sm">
                  <Ionicons name="flash" size={16} color={c.coral} />
                  <Txt variant="heading">{t.homeDeal}</Txt>
                </Row>
                <ProductGrid products={[feed.home.deal]} />
              </VStack>
            )}

            {/* The app's own rails are a *guess* at what a store would want —
                derived from a discount field and a sort order. The moment an
                operator curates real sections, that guess is noise, and on this
                store it was literally duplicate: they had curated "أقوى
                العروض" and "وصل حديثًا" of their own. A human's choice wins. */}
            {!curated && feed.offers.length > 0 && (
              <Rail title={t.offers} products={feed.offers} href="/deals" accent />
            )}

            {feed.home.sections.map((section) => (
              <Rail key={section.heading} title={section.heading} products={section.products} />
            ))}

            {feed.forYou.length > 0 && <Rail title={t.homeForYou} products={feed.forYou} />}

            <RecentlyViewedRail />

            {!curated && feed.topRated.length > 0 && (
              <Rail title={t.topRated} products={feed.topRated} />
            )}

            <StoresLink />

            {/* Always last, always present: the way into the full catalogue.
                Titled "all products" when the operator already has a "new
                arrivals" rail, so the same phrase never appears twice. */}
            <VStack gap="md">
              <SectionHead title={curated ? t.allProducts : t.newArrivals} href="/products" />
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
  href,
  accent = false,
}: {
  title: string;
  products: ProductCard[];
  href?: string;
  accent?: boolean;
}) {
  const { c, space } = useTheme();
  const t = dict();
  return (
    <VStack gap="md">
      <Row justify="space-between">
        <Row gap="sm">
          {accent && <Ionicons name="flame" size={16} color={c.coral} />}
          <Txt variant="heading">{title}</Txt>
        </Row>
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

/**
 * The way into the seller directory.
 *
 * A row rather than a rail: the stores are not merchandise, and a shopper who
 * wants one is looking for a name they already trust. Hidden in Single Company
 * mode — a "browse our sellers" invitation to a directory of one is noise.
 */
function StoresLink() {
  const { c, space, radius } = useTheme();
  const t = dict();
  const config = useStoreConfig();
  // Until the config lands, show nothing rather than a link that may be about
  // to vanish — a row that appears then disappears reads as a glitch.
  if (!config?.multiVendor) return null;

  return (
    <Link href="/stores" asChild>
      <Pressable
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: space.md,
          backgroundColor: c.surface,
          borderWidth: 1,
          borderColor: c.line,
          borderRadius: radius.lg,
          padding: space.lg,
        }}
      >
        <Ionicons name="storefront-outline" size={20} color={c.blue} />
        <Txt variant="body" style={{ flex: 1 }}>
          {t.storesBrowse}
        </Txt>
        <Ionicons name="chevron-back" size={18} color={c.ink400} />
      </Pressable>
    </Link>
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

/**
 * "Take me back to the one I was looking at."
 *
 * Reads from the device only — this is browsing history, and the least of it a
 * store keeps, the better. Hidden below two entries, because a rail of one is
 * not a rail.
 */
function RecentlyViewedRail() {
  const t = dict();
  const { c, space } = useTheme();
  const items = useRecentlyViewed((s) => s.items);
  const clear = useRecentlyViewed((s) => s.clear);

  if (items.length < 2) return null;

  return (
    <VStack gap="md">
      <Row justify="space-between">
        <Txt variant="heading">{t.homeRecent}</Txt>
        <Pressable onPress={clear} hitSlop={8}>
          <Txt variant="label" tone="faint">
            {t.clear}
          </Txt>
        </Pressable>
      </Row>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ gap: space.md, paddingBottom: space.xs }}
      >
        {items.map((p) => (
          <ProductTile key={p.slug} product={p} width={158} />
        ))}
      </ScrollView>
      <View style={{ height: 1, backgroundColor: c.line }} />
    </VStack>
  );
}
