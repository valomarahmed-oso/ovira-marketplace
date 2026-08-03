import { bannerText, type Banner } from "@ovira/core";
import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import { Pressable, View } from "react-native";

import { routeFor, isExternal } from "../deep-links";
import { DEFAULT_LOCALE } from "../i18n";
import { useTheme } from "../theme-context";
import { Row, Txt, VStack } from "./ui";

/**
 * An operator-scheduled banner.
 *
 * Its `link` is a storefront path written for the website, so it goes through
 * the same `routeFor` a notification does rather than being parsed here. That
 * means a banner pointing at `/shop/deals` opens the deals screen, and one
 * pointing at the operator console opens a browser instead of dead-ending.
 *
 * The text is drawn over the image with a scrim, not beside it: a banner
 * without one is unreadable over half the photos an operator will upload, and
 * that is not something they can be expected to test for.
 */
export function HeroBanner({ banner, height = 150 }: { banner: Banner; height?: number }) {
  const { c, space, radius } = useTheme();
  const router = useRouter();
  const text = bannerText(banner, DEFAULT_LOCALE);

  const open = () => {
    if (!banner.link) return;
    const route = routeFor(banner.link);
    if (isExternal(route)) return;
    router.push(route as never);
  };

  return (
    <Pressable onPress={open} disabled={!banner.link}>
      <View
        style={{
          height,
          borderRadius: radius.lg,
          overflow: "hidden",
          backgroundColor: c.blue050,
          justifyContent: "flex-end",
        }}
      >
        {!!banner.image && (
          <Image
            source={banner.image}
            style={{ position: "absolute", top: 0, bottom: 0, left: 0, right: 0 }}
            contentFit="cover"
            transition={200}
          />
        )}

        {(!!text.title || !!text.subtitle) && (
          <View
            style={{
              backgroundColor: "rgba(11,31,56,0.55)",
              padding: space.md,
              gap: 2,
            }}
          >
            {!!text.title && (
              <Txt variant="heading" tone="onBlue" numberOfLines={1}>
                {text.title}
              </Txt>
            )}
            {!!text.subtitle && (
              <Txt variant="caption" tone="onBlue" numberOfLines={2}>
                {text.subtitle}
              </Txt>
            )}
            {!!text.cta && !!banner.link && (
              <Row gap="xs" style={{ marginTop: space.xs }}>
                <Txt variant="label" tone="onBlue">
                  {text.cta}
                </Txt>
                <Ionicons name="chevron-back" size={14} color="#ffffff" />
              </Row>
            )}
          </View>
        )}
      </View>
    </Pressable>
  );
}

/** A smaller promo tile — two across, under the hero. */
export function PromoBanner({ banner }: { banner: Banner }) {
  const { c, space, radius } = useTheme();
  const router = useRouter();
  const text = bannerText(banner, DEFAULT_LOCALE);

  const open = () => {
    if (!banner.link) return;
    const route = routeFor(banner.link);
    if (isExternal(route)) return;
    router.push(route as never);
  };

  return (
    <Pressable onPress={open} disabled={!banner.link} style={{ flex: 1 }}>
      <VStack gap="xs">
        <View
          style={{
            height: 84,
            borderRadius: radius.md,
            overflow: "hidden",
            backgroundColor: c.blue050,
          }}
        >
          {!!banner.image && (
            <Image
              source={banner.image}
              style={{ width: "100%", height: "100%" }}
              contentFit="cover"
              transition={180}
            />
          )}
        </View>
        {!!text.title && (
          <Txt variant="caption" numberOfLines={2} style={{ paddingHorizontal: space.xs }}>
            {text.title}
          </Txt>
        )}
      </VStack>
    </Pressable>
  );
}
