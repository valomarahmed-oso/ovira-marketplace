import { decodeSlug, resolveCategory } from "@ovira/core";
import { Stack, useLocalSearchParams } from "expo-router";
import { useEffect, useMemo, useState } from "react";

import { ProductBrowser } from "../../src/components/product-browser";
import { Screen } from "../../src/components/ui";
import { dict } from "../../src/i18n";

export default function CategoryScreen() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const t = dict();
  const [title, setTitle] = useState("");

  // The route param arrives percent-encoded — an Arabic category slug is a long
  // run of %D8%A7… and looking it up unencoded is how the web store used to 404
  // its own categories.
  const category = decodeSlug(String(slug ?? ""));
  const filter = useMemo(() => ({ category }), [category]);

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

  return (
    <>
      <Stack.Screen options={{ title: title || t.categories }} />
      <Screen scroll={false}>
        <ProductBrowser filter={filter} emptyTitle={t.emptyCategory} />
      </Screen>
    </>
  );
}
