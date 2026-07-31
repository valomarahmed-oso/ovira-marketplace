import { listProducts } from "@ovira/core";
import { Ionicons } from "@expo/vector-icons";
import { CameraView, useCameraPermissions } from "expo-camera";
import * as Haptics from "expo-haptics";
import { Stack, useRouter } from "expo-router";
import { useCallback, useRef, useState } from "react";
import { StyleSheet, View } from "react-native";

import { PrimaryButton } from "../src/components/form";
import { Empty, Loading } from "../src/components/states";
import { Screen, Txt, VStack } from "../src/components/ui";
import { dict } from "../src/i18n";
import { useTheme } from "../src/theme-context";

/**
 * Scan a barcode, land on the product.
 *
 * The genuinely native trick this app has that the website cannot: standing in
 * a shop, scanning the box, and seeing what it costs here. The catalogue has no
 * barcode index, so the code is put through the normal relevance search — a
 * seller who puts the EAN in the SKU, title or description gets a hit, and one
 * who doesn't gets an honest "no product with that barcode" instead of a
 * spinner that never ends.
 */
export default function ScanScreen() {
  const { c, space, radius } = useTheme();
  const router = useRouter();
  const t = dict();

  const [permission, requestPermission] = useCameraPermissions();
  const [busy, setBusy] = useState(false);
  const [missing, setMissing] = useState<string | null>(null);

  /**
   * The camera fires this many times a second while a code is in frame. Without
   * a latch the same barcode launches a dozen searches and a dozen navigations.
   */
  const handled = useRef(false);

  const onScan = useCallback(
    async ({ data }: { data: string }) => {
      const code = (data || "").trim();
      if (handled.current || !code) return;
      handled.current = true;
      setBusy(true);
      setMissing(null);

      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});

      const hits = await listProducts({ search: code, limit: 1 });
      const found = hits[0];
      setBusy(false);

      if (!found) {
        setMissing(code);
        return;
      }
      router.replace({ pathname: "/product/[slug]", params: { slug: found.slug } });
    },
    [router],
  );

  const rescan = () => {
    handled.current = false;
    setMissing(null);
  };

  if (!permission) {
    return (
      <>
        <Stack.Screen options={{ title: t.scan }} />
        <Screen scroll={false}>
          <Loading />
        </Screen>
      </>
    );
  }

  if (!permission.granted) {
    return (
      <>
        <Stack.Screen options={{ title: t.scan }} />
        <Screen scroll={false} style={{ justifyContent: "center" }}>
          <VStack gap="xl" style={{ alignItems: "center" }}>
            <Ionicons name="camera-outline" size={56} color={c.ink400} />
            <Txt variant="body" tone="faint" style={{ textAlign: "center", maxWidth: 280 }}>
              {t.scanPermission}
            </Txt>
            <View style={{ width: 220 }}>
              <PrimaryButton label={t.allowCamera} onPress={() => void requestPermission()} />
            </View>
          </VStack>
        </Screen>
      </>
    );
  }

  return (
    <>
      <Stack.Screen options={{ title: t.scan }} />
      <View style={{ flex: 1, backgroundColor: "#000" }}>
        <CameraView
          style={StyleSheet.absoluteFill}
          facing="back"
          barcodeScannerSettings={{
            // Retail codes only. Leaving QR on turns every poster and menu in
            // the shop into a false positive.
            barcodeTypes: ["ean13", "ean8", "upc_a", "upc_e", "code128", "code39", "itf14"],
          }}
          onBarcodeScanned={handled.current ? undefined : (event) => void onScan(event)}
        />

        {/* A window to aim through. Without one people hold the phone too far
            back and conclude the scanner is broken. */}
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
          <View
            style={{
              width: 260,
              height: 160,
              borderRadius: radius.lg,
              borderWidth: 2,
              borderColor: "rgba(255,255,255,0.85)",
            }}
          />
          <View style={{ height: space.lg }} />
          <Txt variant="label" tone="onBlue" style={{ textAlign: "center" }}>
            {t.scanHint}
          </Txt>
        </View>

        {(busy || missing) && (
          <View
            style={{
              position: "absolute",
              left: space.lg,
              right: space.lg,
              bottom: space.xxl,
              backgroundColor: c.surface,
              borderRadius: radius.lg,
              padding: space.lg,
            }}
          >
            {busy ? (
              <Loading pad={4} />
            ) : (
              <VStack gap="md">
                <Empty icon="barcode-outline" title={t.scanNothing} body={missing ?? undefined} />
                <PrimaryButton label={t.scanAgain} onPress={rescan} />
              </VStack>
            )}
          </View>
        )}
      </View>
    </>
  );
}
