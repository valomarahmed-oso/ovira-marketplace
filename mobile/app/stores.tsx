import { listStores, type StoreCard } from "@ovira/core";
import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { Link, Stack } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { Pressable, View } from "react-native";

import { SearchBar } from "../src/components/search-bar";
import { Empty, Loading } from "../src/components/states";
import { Card, Row, Screen, Txt, VStack } from "../src/components/ui";
import { dict, fill, num } from "../src/i18n";
import { useTheme } from "../src/theme-context";

/** The seller directory. Best-established first, as the server orders them. */
export default function StoresScreen() {
  const t = dict();
  const { space } = useTheme();

  const [rows, setRows] = useState<StoreCard[]>([]);
  const [search, setSearch] = useState("");
  const [state, setState] = useState<"loading" | "ready">("loading");

  const load = useCallback(async (q: string) => {
    setState("loading");
    setRows(await listStores({ search: q.trim() || undefined }));
    setState("ready");
  }, []);

  useEffect(() => {
    // Debounced: the directory is a full table scan server-side, and firing it
    // on every keystroke is how a search box becomes the slowest screen.
    const id = setTimeout(() => void load(search), search ? 300 : 0);
    return () => clearTimeout(id);
  }, [search, load]);

  return (
    <>
      <Stack.Screen options={{ title: t.stores }} />
      <Screen>
        <VStack gap="lg" style={{ paddingBottom: space.xxl }}>
          <SearchBar value={search} onChange={setSearch} placeholder={t.storesSearch} />

          {state === "loading" ? (
            <Loading />
          ) : rows.length === 0 ? (
            <Empty icon="storefront-outline" title={t.storesEmpty} />
          ) : (
            <VStack gap="md">
              {rows.map((store) => (
                <StoreRow key={store.name} store={store} />
              ))}
            </VStack>
          )}
        </VStack>
      </Screen>
    </>
  );
}

function StoreRow({ store }: { store: StoreCard }) {
  const { c, space, radius } = useTheme();
  const t = dict();

  return (
    <Link href={{ pathname: "/store/[slug]", params: { slug: store.slug } }} asChild>
      <Pressable>
        <Card>
          <Row gap="md">
            {store.logo ? (
              <Image
                source={store.logo}
                style={{ width: 52, height: 52, borderRadius: radius.lg, backgroundColor: c.blue050 }}
                contentFit="cover"
                transition={150}
              />
            ) : (
              <View
                style={{
                  width: 52,
                  height: 52,
                  borderRadius: radius.lg,
                  backgroundColor: c.blue050,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Ionicons name="storefront" size={24} color={c.blue} />
              </View>
            )}

            <VStack gap="xs" style={{ flex: 1 }}>
              <Txt variant="label" numberOfLines={1}>
                {store.vendor_name}
              </Txt>
              <Row gap="sm">
                {(store.ratings_count ?? 0) > 0 && (
                  <Row gap="xs">
                    <Ionicons name="star" size={12} color={c.gold} />
                    <Txt variant="caption" tone="faint">
                      {num(store.rating ?? 0, { decimals: 1 })}
                    </Txt>
                  </Row>
                )}
                <Txt variant="caption" tone="faint">
                  {fill(t.storeProducts, { n: num(store.product_count) })}
                </Txt>
              </Row>
            </VStack>

            <Ionicons name="chevron-back" size={18} color={c.ink400} />
          </Row>
        </Card>
      </Pressable>
    </Link>
  );
}
