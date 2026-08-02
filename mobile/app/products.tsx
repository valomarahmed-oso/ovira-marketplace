import { Stack } from "expo-router";
import { useMemo } from "react";

import { ProductBrowser } from "../src/components/product-browser";
import { Screen } from "../src/components/ui";
import { dict } from "../src/i18n";

/** Everything on the shelf, unfiltered — the entry point for "شوف الكل". */
export default function ProductsScreen() {
  const t = dict();
  const filter = useMemo(() => ({}), []);

  return (
    <>
      <Stack.Screen options={{ title: t.allProducts }} />
      <Screen scroll={false}>
        <ProductBrowser filter={filter} emptyTitle={t.noResults} />
      </Screen>
    </>
  );
}
