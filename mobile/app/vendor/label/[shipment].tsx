import { shipmentLabel, type ShipmentLabel } from "@ovira/core";
import { Ionicons } from "@expo/vector-icons";
import * as Print from "expo-print";
import * as Sharing from "expo-sharing";
import { Stack, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { Pressable, View } from "react-native";

import { Empty, Loading } from "../../../src/components/states";
import { Card, Pill, Row, Screen, Txt, VStack } from "../../../src/components/ui";
import { dict, money, num } from "../../../src/i18n";
import { labelHtml } from "../../../src/label-html";
import { shipmentStatusLabel, shipmentStatusTone } from "../../../src/shipment-status";
import { useTheme } from "../../../src/theme-context";

/**
 * The waybill that goes on the box.
 *
 * On the web this is a print stylesheet. Here it renders a PDF and hands it to
 * the share sheet — which on a phone means AirDrop to a laptop, a print
 * service, or WhatsApp to whoever has the printer. The screen version exists
 * because a seller often just needs to *read* the address aloud to a courier.
 */
export default function ShipmentLabelScreen() {
  const { shipment } = useLocalSearchParams<{ shipment: string }>();
  const t = dict();
  const { c, space } = useTheme();

  const [label, setLabel] = useState<ShipmentLabel | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "missing">("loading");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let alive = true;
    void shipmentLabel(String(shipment ?? "")).then((found) => {
      if (!alive) return;
      setLabel(found);
      setState(found ? "ready" : "missing");
    });
    return () => {
      alive = false;
    };
  }, [shipment]);

  const share = async () => {
    if (!label) return;
    setBusy(true);
    try {
      const { uri } = await Print.printToFileAsync({ html: labelHtml(label) });
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(uri, { mimeType: "application/pdf", UTI: "com.adobe.pdf" });
      } else {
        await Print.printAsync({ html: labelHtml(label) });
      }
    } catch {
      /* cancelled, or there is nowhere to send it */
    } finally {
      setBusy(false);
    }
  };

  if (state === "loading") {
    return (
      <Screen scroll={false}>
        <Loading />
      </Screen>
    );
  }

  if (state === "missing" || !label) {
    return (
      <>
        <Stack.Screen options={{ title: t.vlTitle }} />
        <Screen scroll={false}>
          <Empty icon="pricetag-outline" title={t.vlMissing} />
        </Screen>
      </>
    );
  }

  return (
    <>
      <Stack.Screen options={{ title: t.vlTitle }} />
      <Screen>
        <VStack gap="lg" style={{ paddingBottom: space.xxl }}>
          <Pressable onPress={() => void share()} disabled={busy}>
            <Card>
              <Row gap="sm" justify="center">
                <Ionicons name="print-outline" size={17} color={c.blue} />
                <Txt variant="label" tone="blue">
                  {busy ? t.invoiceBuilding : t.vlPrint}
                </Txt>
              </Row>
            </Card>
          </Pressable>

          <Card>
            <VStack gap="lg">
              <Row justify="space-between" align="flex-start">
                <VStack gap="xs">
                  <Txt variant="caption" tone="faint">
                    {t.vlShipment}
                  </Txt>
                  <Txt variant="heading">{label.shipment}</Txt>
                </VStack>
                <Pill
                  label={shipmentStatusLabel(label.status)}
                  tone={shipmentStatusTone(label.status)}
                />
              </Row>

              {/* Cash on delivery is the single most consequential thing on a
                  waybill in Egypt — a courier who misses it hands the parcel
                  over for nothing. It gets its own block, not a line. */}
              {label.cod && (
                <View
                  style={{
                    backgroundColor: c.coral050,
                    borderWidth: 1,
                    borderColor: c.coral,
                    borderRadius: 12,
                    padding: space.md,
                    alignItems: "center",
                    gap: 2,
                  }}
                >
                  <Txt variant="caption" tone="coral">
                    {t.vlCod}
                  </Txt>
                  <Txt variant="title" tone="coral">
                    {money(label.cod_amount)}
                  </Txt>
                </View>
              )}

              <Divider />

              <Block title={t.vlTo}>
                <Txt variant="body">{label.recipient_name || "—"}</Txt>
                {!!label.recipient_phone && (
                  <Txt variant="body" tone="muted">
                    {label.recipient_phone}
                  </Txt>
                )}
                <Txt variant="body" tone="muted">
                  {label.address || "—"}
                  {label.governorate ? `، ${label.governorate}` : ""}
                </Txt>
              </Block>

              <Block title={t.vlFrom}>
                <Txt variant="body">{label.vendor_name || "—"}</Txt>
                {!!label.vendor_phone && (
                  <Txt variant="body" tone="muted">
                    {label.vendor_phone}
                  </Txt>
                )}
              </Block>

              <Block title={t.vendorCarrier}>
                <Txt variant="body">{label.carrier || label.provider || "—"}</Txt>
                {!!label.tracking_number && (
                  <Txt variant="body" tone="muted">
                    {label.tracking_number}
                  </Txt>
                )}
              </Block>

              <Divider />

              <Block title={t.vlContents}>
                {label.items.map((item, index) => (
                  <Row key={`${item.title}-${index}`} justify="space-between">
                    <Txt variant="body" tone="muted" style={{ flex: 1 }} numberOfLines={2}>
                      {item.title}
                    </Txt>
                    <Txt variant="label">×{num(item.qty)}</Txt>
                  </Row>
                ))}
              </Block>

              {!!label.order && (
                <Txt variant="caption" tone="faint" style={{ textAlign: "center" }}>
                  {label.order}
                </Txt>
              )}
            </VStack>
          </Card>
        </VStack>
      </Screen>
    </>
  );
}

function Divider() {
  const { c } = useTheme();
  return <View style={{ height: 1, backgroundColor: c.line }} />;
}

function Block({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <VStack gap="xs">
      <Txt variant="caption" tone="faint">
        {title}
      </Txt>
      {children}
    </VStack>
  );
}
