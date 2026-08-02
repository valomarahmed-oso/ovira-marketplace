import { decodeSlug, vendorStorefront, type StoreProfile } from "@ovira/core";
import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { Stack, useLocalSearchParams } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { View } from "react-native";

import { ProductBrowser } from "../../src/components/product-browser";
import { Empty, Loading } from "../../src/components/states";
import { Card, Row, Screen, Txt, VStack } from "../../src/components/ui";
import { dict, fill, num } from "../../src/i18n";
import { useTheme } from "../../src/theme-context";

/**
 * One seller's storefront: who they are, then what they sell.
 *
 * The shelf is the same `ProductBrowser` as a category — filtered by vendor
 * rather than by category — so sorting, the in-stock toggle and paging behave
 * identically wherever a shopper meets a list of products.
 */
export default function StoreScreen() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const t = dict();

  const storeSlug = decodeSlug(String(slug ?? ""));
  const [store, setStore] = useState<StoreProfile | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "missing">("loading");

  useEffect(() => {
    let alive = true;
    setState("loading");
    void vendorStorefront(storeSlug).then((found) => {
      if (!alive) return;
      setStore(found);
      setState(found ? "ready" : "missing");
    });
    return () => {
      alive = false;
    };
  }, [storeSlug]);

  // Filtering is by the vendor's *name* (the doctype key), not its slug — the
  // slug is only ever a URL.
  const filter = useMemo(() => ({ vendor: store?.name }), [store?.name]);

  return (
    <>
      <Stack.Screen options={{ title: store?.vendor_name || t.stores }} />
      <Screen scroll={false}>
        {state === "loading" && <Loading />}
        {state === "missing" && (
          <Empty icon="storefront-outline" title={t.storeMissing} body={t.storeMissingBody} />
        )}
        {state === "ready" && store && (
          <ProductBrowser
            filter={filter}
            emptyTitle={t.storeNoProducts}
            header={<StoreHeader store={store} />}
          />
        )}
      </Screen>
    </>
  );
}

function StoreHeader({ store }: { store: StoreProfile }) {
  const { c, space, radius } = useTheme();
  const t = dict();

  return (
    <VStack gap="md">
      {store.banner && (
        <Image
          source={store.banner}
          style={{
            width: "100%",
            height: 110,
            borderRadius: radius.lg,
            backgroundColor: c.blue050,
          }}
          contentFit="cover"
          transition={180}
        />
      )}

      <Row gap="md">
        {store.logo ? (
          <Image
            source={store.logo}
            style={{ width: 56, height: 56, borderRadius: radius.lg, backgroundColor: c.blue050 }}
            contentFit="cover"
            transition={150}
          />
        ) : (
          <View
            style={{
              width: 56,
              height: 56,
              borderRadius: radius.lg,
              backgroundColor: c.blue050,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Ionicons name="storefront" size={26} color={c.blue} />
          </View>
        )}
        <VStack gap="xs" style={{ flex: 1 }}>
          <Txt variant="title" numberOfLines={2}>
            {store.vendor_name}
          </Txt>
          <Row gap="md">
            {(store.ratings_count ?? 0) > 0 && (
              <Row gap="xs">
                <Ionicons name="star" size={13} color={c.gold} />
                <Txt variant="caption" tone="faint">
                  {fill(t.storeRating, {
                    r: num(store.rating ?? 0, { decimals: 1 }),
                    n: num(store.ratings_count ?? 0),
                  })}
                </Txt>
              </Row>
            )}
            <Txt variant="caption" tone="faint">
              {fill(t.storeProducts, { n: num(store.product_count) })}
            </Txt>
          </Row>
        </VStack>
      </Row>

      {!!store.description && (
        <Txt variant="body" tone="muted">
          {store.description}
        </Txt>
      )}

      {/* Policies are the seller's own commitment, and a shopper on a phone
          will not go looking for them on a website. Shown only when the seller
          actually wrote one — an empty card reads as "no policy". */}
      {(!!store.shipping_policy || !!store.return_policy) && (
        <Card>
          <VStack gap="md">
            {!!store.shipping_policy && (
              <Policy icon="cube-outline" title={t.shippingPolicy} body={store.shipping_policy} />
            )}
            {!!store.return_policy && (
              <Policy icon="refresh-outline" title={t.returnPolicy} body={store.return_policy} />
            )}
          </VStack>
        </Card>
      )}

      <View style={{ height: 1, backgroundColor: c.line, marginTop: space.xs }} />
    </VStack>
  );
}

function Policy({
  icon,
  title,
  body,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  body: string;
}) {
  const { c } = useTheme();
  return (
    <VStack gap="xs">
      <Row gap="sm">
        <Ionicons name={icon} size={15} color={c.blue} />
        <Txt variant="label">{title}</Txt>
      </Row>
      <Txt variant="caption" tone="muted">
        {body}
      </Txt>
    </VStack>
  );
}
