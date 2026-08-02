import { getOrder, type Order } from "@ovira/core";
import { Ionicons } from "@expo/vector-icons";
import * as Print from "expo-print";
import * as Sharing from "expo-sharing";
import { Stack, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { Pressable, View } from "react-native";

import { statusLabel } from "../../src/components/order-status";
import { Empty, Loading } from "../../src/components/states";
import { Card, Row, Screen, Txt, VStack } from "../../src/components/ui";
import { dict, fill, formatDate, money, num } from "../../src/i18n";
import { invoiceHtml } from "../../src/invoice-html";
import { useTheme } from "../../src/theme-context";

/**
 * The itemised bill for one order.
 *
 * The web version's action is "print"; a phone has no printer, so the same
 * button produces a PDF and hands it to the share sheet — mail it, save it to
 * Files, send it to an accountant. The layout on screen and the layout in the
 * PDF are generated from the same order, but not from the same code: React
 * Native cannot be rendered to paper, so the PDF is built as HTML.
 */
export default function InvoiceScreen() {
  const { name } = useLocalSearchParams<{ name: string }>();
  const t = dict();
  const { c, space } = useTheme();

  const [order, setOrder] = useState<Order | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "missing">("loading");
  const [sharing, setSharing] = useState(false);

  useEffect(() => {
    let alive = true;
    void getOrder(String(name ?? "")).then((found) => {
      if (!alive) return;
      setOrder(found);
      setState(found ? "ready" : "missing");
    });
    return () => {
      alive = false;
    };
  }, [name]);

  const share = async () => {
    if (!order) return;
    setSharing(true);
    try {
      const { uri } = await Print.printToFileAsync({ html: invoiceHtml(order) });
      // `isAvailableAsync` is false on web and on a simulator without a share
      // target; printing directly is the sensible fallback rather than a
      // silent no-op.
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(uri, { mimeType: "application/pdf", UTI: "com.adobe.pdf" });
      } else {
        await Print.printAsync({ html: invoiceHtml(order) });
      }
    } catch {
      /* the shopper cancelled the sheet, or there is nowhere to send it */
    } finally {
      setSharing(false);
    }
  };

  if (state === "loading") {
    return (
      <Screen scroll={false}>
        <Loading />
      </Screen>
    );
  }

  if (state === "missing" || !order) {
    return (
      <>
        <Stack.Screen options={{ title: t.invoice }} />
        <Screen scroll={false}>
          <Empty icon="receipt-outline" title={t.orderMissing} />
        </Screen>
      </>
    );
  }

  // A completed return means this invoice no longer describes money anyone
  // owes. Saying so on the document is the whole point — a stale invoice in
  // someone's downloads folder is a claim.
  const voided = order.return_status === "Completed";

  return (
    <>
      <Stack.Screen options={{ title: t.invoice }} />
      <Screen>
        <VStack gap="lg" style={{ paddingBottom: space.xxl }}>
          {voided ? (
            <Card style={{ borderColor: c.coral, backgroundColor: c.coral050 }}>
              <Txt variant="label" tone="coral" style={{ textAlign: "center" }}>
                {t.invoiceVoid}
              </Txt>
            </Card>
          ) : (
            <Pressable onPress={() => void share()} disabled={sharing}>
              <Card>
                <Row gap="sm" justify="center">
                  <Ionicons name="share-outline" size={17} color={c.blue} />
                  <Txt variant="label" tone="blue">
                    {sharing ? t.invoiceBuilding : t.invoiceShare}
                  </Txt>
                </Row>
              </Card>
            </Pressable>
          )}

          <Card>
            <VStack gap="lg">
              <Row justify="space-between" align="flex-start">
                <VStack gap="xs">
                  <Txt variant="heading">{t.brand}</Txt>
                  <Txt variant="caption" tone="faint">
                    demo.ovira.cloud
                  </Txt>
                </VStack>
                <VStack gap="xs" style={{ alignItems: "flex-start" }}>
                  <Txt variant="label">{t.invoice}</Txt>
                  <Txt variant="caption" tone="muted">
                    {order.name}
                  </Txt>
                  <Txt variant="caption" tone="faint">
                    {formatDate(order.creation)}
                  </Txt>
                </VStack>
              </Row>

              <Divider />

              <VStack gap="xs">
                <Txt variant="caption" tone="faint">
                  {t.invoiceBillTo}
                </Txt>
                <Txt variant="body">{order.customer_name || "—"}</Txt>
                {!!order.shipping_address && (
                  <Txt variant="caption" tone="muted">
                    {order.shipping_address}
                    {order.governorate ? `، ${order.governorate}` : ""}
                  </Txt>
                )}
              </VStack>

              <VStack gap="xs">
                <Txt variant="caption" tone="faint">
                  {t.invoiceDetails}
                </Txt>
                <Row justify="space-between">
                  <Txt variant="caption" tone="muted">
                    {t.orderStatus}
                  </Txt>
                  <Txt variant="caption">{statusLabel(order.status)}</Txt>
                </Row>
                <Row justify="space-between">
                  <Txt variant="caption" tone="muted">
                    {t.paymentStatus}
                  </Txt>
                  <Txt variant="caption">{order.payment_status || "—"}</Txt>
                </Row>
              </VStack>

              <Divider />

              <VStack gap="sm">
                {(order.items ?? []).map((item, index) => (
                  <Row key={`${item.title}-${index}`} justify="space-between" align="flex-start">
                    <VStack gap="xs" style={{ flex: 1 }}>
                      <Txt variant="body" numberOfLines={2}>
                        {item.title}
                      </Txt>
                      <Txt variant="caption" tone="faint">
                        {num(item.qty)} × {money(item.rate)}
                      </Txt>
                    </VStack>
                    <Txt variant="label">{money(item.amount)}</Txt>
                  </Row>
                ))}
              </VStack>

              <Divider />

              <VStack gap="sm">
                <Line label={t.subtotal} value={money(order.subtotal)} />
                <Line
                  label={t.shipping}
                  value={order.shipping_amount === 0 ? t.free : money(order.shipping_amount)}
                />
                {!!order.discount_amount && order.discount_amount > 0 && (
                  <Line
                    label={`${t.discountLabel}${order.coupon_code ? ` (${order.coupon_code})` : ""}`}
                    value={`−${money(order.discount_amount)}`}
                  />
                )}
                {/* An Egyptian invoice must state the tax base and the tax,
                    whether or not the displayed prices already contain it. */}
                {!!order.tax_amount && order.tax_amount > 0 && (
                  <>
                    {!!order.tax_inclusive && (
                      <Line label={t.invoiceNet} value={money(order.net_total ?? 0)} />
                    )}
                    <Line
                      label={fill(t.invoiceTax, { rate: String(order.tax_rate ?? "") })}
                      value={money(order.tax_amount)}
                    />
                  </>
                )}
                <Divider />
                <Row justify="space-between">
                  <Txt variant="heading">{t.total}</Txt>
                  <Txt variant="heading" tone="blue">
                    {money(order.total)}
                  </Txt>
                </Row>
              </VStack>

              <Txt variant="caption" tone="faint" style={{ textAlign: "center" }}>
                {fill(t.invoiceThanks, { brand: t.brand })}
              </Txt>
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

function Line({ label, value }: { label: string; value: string }) {
  return (
    <Row justify="space-between">
      <Txt variant="body" tone="muted">
        {label}
      </Txt>
      <Txt variant="body">{value}</Txt>
    </Row>
  );
}
