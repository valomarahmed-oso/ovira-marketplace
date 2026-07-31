import { View } from "react-native";
import Svg, { Path, Rect } from "react-native-svg";

import { useTheme } from "../theme-context";

/**
 * The same mark as `storefront/src/components/logo.tsx`: an open ring with
 * three bars reading out of it. Redrawn in react-native-svg rather than shipped
 * as a PNG so it stays crisp at every density and can take the theme's blue.
 */
export function Logo({ size = 36 }: { size?: number }) {
  const { c, radius } = useTheme();
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: radius.md,
        backgroundColor: c.blue,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Svg width={size * 0.56} height={size * 0.56} viewBox="0 0 32 32" fill="none">
        <Path
          d="M16 4a12 12 0 1 0 0 24 12 12 0 0 0 11-7.2"
          stroke="#ffffff"
          strokeWidth={3.4}
          strokeLinecap="round"
        />
        <Rect x={20.5} y={11} width={8.5} height={2.4} rx={1.2} fill="#ffffff" />
        <Rect x={20.5} y={14.8} width={8.5} height={2.4} rx={1.2} fill="#ffffff" />
        <Rect x={20.5} y={18.6} width={8.5} height={2.4} rx={1.2} fill="#ffffff" />
      </Svg>
    </View>
  );
}
