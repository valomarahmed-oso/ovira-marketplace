import type { ProductMedia } from "@ovira/core";
import { Image } from "expo-image";
import { useState } from "react";
import { ScrollView, useWindowDimensions, View } from "react-native";

import { useTheme } from "../theme-context";

/**
 * Product images, paged.
 *
 * The dots only appear from the second image on. A single dot under a single
 * photo suggests there is more to swipe to, and a shopper who swipes and finds
 * nothing concludes the page is broken rather than that the seller uploaded one
 * picture.
 */
export function Gallery({ images }: { images: ProductMedia[] }) {
  const { c, space, radius } = useTheme();
  const { width } = useWindowDimensions();
  const [page, setPage] = useState(0);

  const frame = width - space.lg * 2;
  if (!images.length) {
    return (
      <View
        style={{
          width: frame,
          height: frame,
          borderRadius: radius.lg,
          backgroundColor: c.blue050,
        }}
      />
    );
  }

  return (
    <View style={{ gap: space.md }}>
      <ScrollView
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={({ nativeEvent: e }) =>
          setPage(Math.round(e.contentOffset.x / Math.max(1, e.layoutMeasurement.width)))
        }
        style={{ borderRadius: radius.lg, overflow: "hidden" }}
      >
        {images.map((media, i) => (
          <Image
            key={`${media.image}-${i}`}
            source={media.image}
            accessibilityLabel={media.alt_text ?? undefined}
            style={{ width: frame, height: frame, backgroundColor: c.blue050 }}
            contentFit="cover"
            transition={200}
          />
        ))}
      </ScrollView>

      {images.length > 1 && (
        <View style={{ flexDirection: "row", justifyContent: "center", gap: 6 }}>
          {images.map((_, i) => (
            <View
              key={i}
              style={{
                width: i === page ? 18 : 6,
                height: 6,
                borderRadius: 3,
                backgroundColor: i === page ? c.blue : c.line,
              }}
            />
          ))}
        </View>
      )}
    </View>
  );
}
