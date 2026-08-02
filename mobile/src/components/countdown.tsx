import { useEffect, useState } from "react";
import { Text, View } from "react-native";

import { useTheme } from "../theme-context";

/** Parse a Frappe datetime ("YYYY-MM-DD HH:mm:ss", site-local) into a timestamp. */
function parse(ends: string): number {
  const t = Date.parse(ends.includes("T") ? ends : ends.replace(" ", "T"));
  return Number.isNaN(t) ? 0 : t;
}

function pad(n: number) {
  return String(n).padStart(2, "0");
}

/**
 * Ticking time-remaining until `endsOn`. Calls `onExpire` once it reaches zero.
 *
 * Rendered as one left-to-right string rather than a flipped row of cells.
 * A clock is not a sentence: under RTL, React Native would reverse
 * `hh : mm : ss` into `ss : mm : hh` and a shopper would read four minutes left
 * on a deal that has four hours.
 */
export function Countdown({ endsOn, onExpire }: { endsOn: string; onExpire?: () => void }) {
  const { c, space, radius } = useTheme();
  const target = parse(endsOn);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const remaining = Math.max(0, target - now);
  useEffect(() => {
    if (target && remaining <= 0) onExpire?.();
  }, [remaining, target, onExpire]);

  const totalSec = Math.floor(remaining / 1000);
  const days = Math.floor(totalSec / 86400);
  const hours = Math.floor((totalSec % 86400) / 3600);
  const mins = Math.floor((totalSec % 3600) / 60);
  const secs = totalSec % 60;

  const clock = `${pad(hours)}:${pad(mins)}:${pad(secs)}`;

  return (
    <View
      style={{
        alignSelf: "flex-start",
        flexDirection: "row",
        alignItems: "center",
        gap: space.xs,
        // Not `c.ink`: the palette inverts it in dark mode, and white-on-white
        // is how a countdown disappears for half the users.
        backgroundColor: c.coral,
        borderRadius: radius.md,
        paddingHorizontal: space.sm,
        paddingVertical: 2,
      }}
    >
      <Text
        style={{
          color: "#ffffff",
          fontSize: 12,
          fontWeight: "700",
          fontVariant: ["tabular-nums"],
          writingDirection: "ltr",
        }}
      >
        {days > 0 ? `${days}ي ${clock}` : clock}
      </Text>
    </View>
  );
}
