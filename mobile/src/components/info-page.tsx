import { getSiteContent, localizeSiteContent, type SiteContent } from "@ovira/core";
import { Stack } from "expo-router";
import { useEffect, useState } from "react";

import { DEFAULT_LOCALE } from "../i18n";
import { useTheme } from "../theme-context";
import { RichText } from "./rich-text";
import { Loading } from "./states";
import { Screen, Txt, VStack } from "./ui";

/** Which of the four pages this is. Keys match the CMS field names. */
export type InfoKey = "about_content" | "careers_content" | "terms_content" | "privacy_content";

/**
 * One of the operator's content pages.
 *
 * The content is optional on purpose — a new store has none of it filled in,
 * and the server says so by returning empty fields. The fallback is the same
 * copy the website falls back to, so a shopper reading "من نحن" in the app is
 * not told less than one reading it on the site.
 */
export function InfoPage({
  title,
  subtitle,
  contentKey,
  fallback,
}: {
  title: string;
  subtitle: string;
  contentKey: InfoKey;
  /** Shown when the operator has not written this page. */
  fallback: string;
}) {
  const { space } = useTheme();
  const [content, setContent] = useState<SiteContent | null>(null);

  useEffect(() => {
    let alive = true;
    void getSiteContent().then((raw) => {
      if (alive) setContent(localizeSiteContent(raw, DEFAULT_LOCALE));
    });
    return () => {
      alive = false;
    };
  }, []);

  const written = content?.[contentKey];

  return (
    <>
      <Stack.Screen options={{ title }} />
      <Screen>
        <VStack gap="lg" style={{ paddingBottom: space.xxl }}>
          <VStack gap="xs">
            <Txt variant="title">{title}</Txt>
            <Txt variant="body" tone="faint">
              {subtitle}
            </Txt>
          </VStack>

          {content === null ? <Loading /> : <RichText html={written?.trim() ? written : fallback} />}
        </VStack>
      </Screen>
    </>
  );
}
