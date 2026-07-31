import { View } from "react-native";

import { dict, fill, money, num } from "../i18n";
import { useTheme } from "../theme-context";
import { Txt } from "./ui";

/**
 * A price, with its strike-through and discount badge.
 *
 * `compare_at_price` is only shown when it is genuinely higher than the price —
 * a seller who leaves it equal (or lower) should get a plain price, not a "0%
 * off" badge that makes the whole store look like it is faking discounts.
 */
export function Price({
  price,
  compareAt,
  size = "heading",
}: {
  price: number;
  compareAt?: number | null;
  size?: "heading" | "title" | "label";
}) {
  const { c, space, radius } = useTheme();
  const t = dict();
  const was = Number(compareAt) || 0;
  const discount = was > price ? Math.round(((was - price) / was) * 100) : 0;

  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: space.sm, flexWrap: "wrap" }}>
      <Txt variant={size} tone="blue">
        {money(price)}
      </Txt>
      {discount > 0 && (
        <>
          <Txt
            variant="caption"
            tone="faint"
            style={{ textDecorationLine: "line-through" }}
          >
            {money(was)}
          </Txt>
          <View
            style={{
              backgroundColor: c.coral050,
              borderRadius: radius.sm,
              paddingHorizontal: space.sm,
              paddingVertical: 1,
            }}
          >
            <Txt variant="caption" tone="coral">
              {fill(t.off, { n: num(discount) })}
            </Txt>
          </View>
        </>
      )}
    </View>
  );
}
