import { deleteProduct, myProducts, type VendorProduct } from "@ovira/core";
import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { Stack, useFocusEffect, useRouter } from "expo-router";
import { useCallback, useState } from "react";
import { Alert, Pressable, View } from "react-native";

import { PrimaryButton } from "../../src/components/form";
import { Empty, Loading } from "../../src/components/states";
import { Card, Pill, Row, Screen, Txt, VStack } from "../../src/components/ui";
import { dict, money, num } from "../../src/i18n";
import { useTheme } from "../../src/theme-context";
import { useVendorAccess } from "../../src/vendor-access";

/** Approval state in the seller's words, with a colour that means something. */
const APPROVAL: Record<string, { label: string; tone: "blue" | "mint" | "coral" }> = {
  Pending: { label: "تحت المراجعة", tone: "blue" },
  Approved: { label: "معتمد", tone: "mint" },
  Rejected: { label: "مرفوض", tone: "coral" },
};

/**
 * The seller's shelf.
 *
 * Approval and publication are two different facts and the list shows both: an
 * approved product that is unpublished is invisible to shoppers, and a seller
 * looking at a green "معتمد" badge wondering why nothing sells is exactly the
 * confusion worth spending a second pill on.
 */
export default function VendorProductsScreen() {
  const t = dict();
  const { c, space, radius } = useTheme();
  const router = useRouter();
  const access = useVendorAccess();

  const [rows, setRows] = useState<VendorProduct[]>([]);
  const [state, setState] = useState<"loading" | "ready">("loading");

  const load = useCallback(async () => {
    if (!access.show) {
      setState(access.reason === "loading" ? "loading" : "ready");
      return;
    }
    setRows(await myProducts());
    setState("ready");
  }, [access]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const remove = useCallback(
    (product: VendorProduct) => {
      Alert.alert(product.title, t.vpDeleteConfirm, [
        { text: t.cancel, style: "cancel" },
        {
          text: t.remove,
          style: "destructive",
          onPress: async () => {
            try {
              await deleteProduct(product.name);
              await load();
            } catch (err) {
              Alert.alert(t.loadFailed, err instanceof Error ? err.message : "");
            }
          },
        },
      ]);
    },
    [load, t],
  );

  if (!access.show) {
    return (
      <>
        <Stack.Screen options={{ title: t.vpTitle }} />
        <Screen scroll={false}>
          {access.reason === "loading" ? (
            <Loading />
          ) : (
            <Empty icon="storefront-outline" title={t.vendorNotSeller} />
          )}
        </Screen>
      </>
    );
  }

  return (
    <>
      <Stack.Screen options={{ title: t.vpTitle }} />
      <Screen>
        <VStack gap="lg" style={{ paddingBottom: space.xxl }}>
          <Row gap="sm">
            <View style={{ flex: 1 }}>
              <PrimaryButton
                label={t.vpNew}
                icon="add-circle-outline"
                onPress={() => router.push("/vendor/products/new")}
              />
            </View>
            <Pressable
              onPress={() => router.push("/vendor/products/import")}
              style={{
                borderWidth: 1,
                borderColor: c.line,
                borderRadius: radius.pill,
                paddingHorizontal: space.lg,
                justifyContent: "center",
                minHeight: 48,
              }}
            >
              <Ionicons name="document-text-outline" size={19} color={c.blue} />
            </Pressable>
          </Row>

          {state === "loading" ? (
            <Loading />
          ) : rows.length === 0 ? (
            <Empty icon="cube-outline" title={t.vpEmpty} body={t.vpEmptyBody} />
          ) : (
            <VStack gap="md">
              <Txt variant="caption" tone="faint">
                {num(rows.length)} {t.vpCount}
              </Txt>
              {rows.map((product) => (
                <Card key={product.name}>
                  <Row gap="md" align="flex-start">
                    <Image
                      source={product.image}
                      style={{
                        width: 56,
                        height: 56,
                        borderRadius: radius.md,
                        backgroundColor: c.blue050,
                      }}
                      contentFit="cover"
                      transition={150}
                    />
                    <VStack gap="xs" style={{ flex: 1 }}>
                      <Txt variant="label" numberOfLines={2}>
                        {product.title}
                      </Txt>
                      <Row justify="space-between">
                        <Txt variant="caption" tone="blue">
                          {money(product.price)}
                        </Txt>
                        <Txt variant="caption" tone={product.stock_qty > 0 ? "faint" : "coral"}>
                          {product.stock_qty > 0
                            ? `${t.inStockShort} ${num(product.stock_qty)}`
                            : t.outOfStock}
                        </Txt>
                      </Row>
                      <Row gap="sm" style={{ flexWrap: "wrap" }}>
                        <Pill
                          label={APPROVAL[product.approval_status]?.label ?? product.approval_status}
                          tone={APPROVAL[product.approval_status]?.tone ?? "blue"}
                        />
                        {/* Approved but unpublished is invisible to shoppers,
                            and nothing else on the row would say so. */}
                        {!product.published && <Pill label={t.vpUnpublished} tone="coral" />}
                      </Row>
                    </VStack>
                  </Row>

                  <Row gap="lg" justify="flex-end" style={{ marginTop: space.md }}>
                    <Pressable
                      onPress={() =>
                        router.push({
                          pathname: "/vendor/products/new",
                          params: { name: product.name },
                        })
                      }
                      hitSlop={6}
                    >
                      <Row gap="xs">
                        <Ionicons name="create-outline" size={15} color={c.blue} />
                        <Txt variant="caption" tone="blue">
                          {t.vpEdit}
                        </Txt>
                      </Row>
                    </Pressable>
                    <Pressable onPress={() => remove(product)} hitSlop={6}>
                      <Row gap="xs">
                        <Ionicons name="trash-outline" size={15} color={c.coral} />
                        <Txt variant="caption" tone="coral">
                          {t.remove}
                        </Txt>
                      </Row>
                    </Pressable>
                  </Row>
                </Card>
              ))}
            </VStack>
          )}
        </VStack>
      </Screen>
    </>
  );
}
