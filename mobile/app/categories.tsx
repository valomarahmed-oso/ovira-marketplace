import { listCategories, type Category } from "@ovira/core";
import { Ionicons } from "@expo/vector-icons";
import { Link, Stack } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { Pressable, View } from "react-native";

import { Failed, Loading } from "../src/components/states";
import { Row, Screen, Txt, VStack } from "../src/components/ui";
import { dict } from "../src/i18n";
import { categoryIcon } from "../src/icons";
import { useTheme } from "../src/theme-context";

/** The full department list — the home strip only has room for the first few. */
export default function CategoriesScreen() {
  const t = dict();
  const { space } = useTheme();

  const [rows, setRows] = useState<Category[]>([]);
  const [state, setState] = useState<"loading" | "ready" | "failed">("loading");

  const load = useCallback(async () => {
    setState("loading");
    const found = await listCategories();
    setRows(found);
    // A store with no categories at all is far more likely to be a failed read
    // than a real answer, and the two must not look the same.
    setState(found.length ? "ready" : "failed");
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <>
      <Stack.Screen options={{ title: t.allCategories }} />
      <Screen>
        {state === "loading" && <Loading />}
        {state === "failed" && <Failed onRetry={() => void load()} />}
        {state === "ready" && (
          <VStack gap="sm" style={{ paddingBottom: space.xxl }}>
            {rows.map((category) => (
              <CategoryRow key={category.name} category={category} />
            ))}
          </VStack>
        )}
      </Screen>
    </>
  );
}

function CategoryRow({ category }: { category: Category }) {
  const { c, space, radius } = useTheme();
  return (
    <Link href={{ pathname: "/category/[slug]", params: { slug: category.slug } }} asChild>
      <Pressable
        style={{
          backgroundColor: c.surface,
          borderWidth: 1,
          borderColor: c.line,
          borderRadius: radius.lg,
          padding: space.md,
        }}
      >
        <Row gap="md">
          <View
            style={{
              width: 44,
              height: 44,
              borderRadius: radius.lg,
              backgroundColor: c.blue050,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Ionicons name={categoryIcon(category.icon)} size={22} color={c.blue} />
          </View>
          <Txt variant="body" style={{ flex: 1 }} numberOfLines={2}>
            {category.category_name}
          </Txt>
          {/* Points the way the app moves, which under RTL is leftwards. */}
          <Ionicons name="chevron-back" size={18} color={c.ink400} />
        </Row>
      </Pressable>
    </Link>
  );
}
