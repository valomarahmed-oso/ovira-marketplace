import { Ionicons } from "@expo/vector-icons";
import { View } from "react-native";

import { num } from "../i18n";
import { useTheme } from "../theme-context";
import { Txt } from "./ui";

/**
 * Five stars and a number.
 *
 * The half-star matters: a 4.2 shown as four full stars and a 4.4 shown the same
 * way makes the whole scale look invented. `vendor_trust_score` on this store is
 * a blended figure to two decimals, so rounding it to whole stars would throw
 * away most of what it says.
 */
export function Rating({
  value,
  count,
  size = 13,
  showValue = true,
}: {
  value?: number | null;
  count?: number | null;
  size?: number;
  showValue?: boolean;
}) {
  const { c, space } = useTheme();
  const score = Math.max(0, Math.min(5, Number(value) || 0));

  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: space.xs }}>
      <View style={{ flexDirection: "row", gap: 1 }}>
        {[0, 1, 2, 3, 4].map((i) => {
          const filled = score - i;
          const name = filled >= 0.75 ? "star" : filled >= 0.25 ? "star-half" : "star-outline";
          return <Ionicons key={i} name={name} size={size} color={c.gold} />;
        })}
      </View>
      {showValue && score > 0 && (
        <Txt variant="caption" tone="muted">
          {num(score, { decimals: 1 })}
        </Txt>
      )}
      {count != null && count > 0 && (
        <Txt variant="caption" tone="faint">
          ({num(count)})
        </Txt>
      )}
    </View>
  );
}
