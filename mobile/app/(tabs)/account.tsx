import { getWallet, myPoints } from "@ovira/core";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useState } from "react";
import { Pressable, View } from "react-native";

import { PrimaryButton } from "../../src/components/form";
import { Logo } from "../../src/components/logo";
import { Card, Row, Screen, Txt, VStack } from "../../src/components/ui";
import { useGuestOrders } from "../../src/guest-orders";
import { dict, fill, money, num } from "../../src/i18n";
import { useSession } from "../../src/session";
import { useTheme } from "../../src/theme-context";
import { useVendorAccess } from "../../src/vendor-access";

export default function AccountScreen() {
  const { c, space, radius } = useTheme();
  const router = useRouter();
  const t = dict();

  const user = useSession((s) => s.user);
  const ready = useSession((s) => s.ready);
  const logOut = useSession((s) => s.logOut);
  const guestCount = useGuestOrders((s) => Object.keys(s.tokens).length);
  const vendorAccess = useVendorAccess();

  const [balance, setBalance] = useState<number | null>(null);
  const [points, setPoints] = useState<number | null>(null);

  /**
   * Re-read on focus, not just on mount.
   *
   * Store credit and points change as a side effect of things done elsewhere in
   * the app — a refund, a redemption, an order that earned points. A tab that
   * only loads once shows a balance that was true when the app started.
   */
  useFocusEffect(
    useCallback(() => {
      if (!user) {
        setBalance(null);
        setPoints(null);
        return;
      }
      let alive = true;
      void (async () => {
        const [purse, loyalty] = await Promise.all([getWallet(1), myPoints(1)]);
        if (!alive) return;
        setBalance(purse?.balance ?? null);
        setPoints(loyalty?.enabled ? loyalty.balance : null);
      })();
      return () => {
        alive = false;
      };
    }, [user]),
  );

  if (!ready) return <Screen scroll={false} />;

  if (!user) {
    return (
      <Screen scroll={false} style={{ justifyContent: "center" }}>
        <VStack gap="xl" style={{ alignItems: "center" }}>
          <Logo size={64} />
          <Txt variant="body" tone="faint" style={{ textAlign: "center", maxWidth: 280 }}>
            {t.signInBenefit}
          </Txt>
          <View style={{ width: "100%", gap: space.md }}>
            <PrimaryButton
              label={t.signIn}
              icon="log-in-outline"
              onPress={() => router.push("/auth/sign-in")}
            />
            <Pressable
              onPress={() => router.push("/auth/register")}
              style={{ alignItems: "center", paddingVertical: space.sm }}
            >
              <Txt variant="label" tone="blue">
                {t.register}
              </Txt>
            </Pressable>
            {/* Someone who checked out as a guest still has orders to follow.
                Hiding the list behind a login would strand them. */}
            {guestCount > 0 && (
              <Pressable
                onPress={() => router.push("/account/orders")}
                style={{ alignItems: "center", paddingVertical: space.sm }}
              >
                <Txt variant="label" tone="muted">
                  {t.myOrders} ({num(guestCount)})
                </Txt>
              </Pressable>
            )}
          </View>
        </VStack>
      </Screen>
    );
  }

  return (
    <Screen>
      <VStack gap="xl">
        <Row gap="md">
          <View
            style={{
              width: 52,
              height: 52,
              borderRadius: radius.pill,
              backgroundColor: c.blue050,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Ionicons name="person" size={24} color={c.blue} />
          </View>
          <VStack gap="xs" style={{ flex: 1 }}>
            <Txt variant="heading">{user.name}</Txt>
            <Txt variant="caption" tone="faint">
              {user.email}
            </Txt>
          </VStack>
        </Row>

        <Row gap="md">
          <Stat
            label={t.wallet}
            value={balance == null ? t.walletUnknown : money(balance)}
            icon="wallet-outline"
            onPress={() => router.push("/account/wallet")}
          />
          <Stat
            label={t.points}
            value={points == null ? "—" : fill(t.pointsBalance, { n: num(points) })}
            icon="star-outline"
            onPress={() => router.push("/account/points")}
          />
        </Row>

        <VStack gap="sm">
          {/* Only for an actual seller, and only when the store runs as a
              marketplace — in Single Company mode there are no vendors and
              offering "my store" invents one. */}
          {vendorAccess.show && (
            <MenuItem
              icon="storefront-outline"
              label={t.vendorArea}
              onPress={() => router.push("/vendor")}
            />
          )}
          <MenuItem
            icon="receipt-outline"
            label={t.myOrders}
            onPress={() => router.push("/account/orders")}
          />
          <MenuItem
            icon="location-outline"
            label={t.addresses}
            onPress={() => router.push("/account/addresses")}
          />
          <MenuItem
            icon="settings-outline"
            label={t.settings}
            onPress={() => router.push("/account/settings")}
          />
        </VStack>

        <Pressable onPress={() => void logOut()} style={{ alignItems: "center", paddingTop: space.lg }}>
          <Txt variant="label" tone="coral">
            {t.signOut}
          </Txt>
        </Pressable>
      </VStack>
    </Screen>
  );
}

function Stat({
  label,
  value,
  icon,
  onPress,
}: {
  label: string;
  value: string;
  icon: keyof typeof Ionicons.glyphMap;
  onPress: () => void;
}) {
  const { c, space } = useTheme();
  return (
    <Pressable onPress={onPress} style={{ flex: 1 }}>
      <Card>
        <VStack gap="xs">
          <Row gap="xs">
            <Ionicons name={icon} size={15} color={c.ink400} />
            <Txt variant="caption" tone="faint">
              {label}
            </Txt>
          </Row>
          <Txt variant="heading" tone="blue" numberOfLines={1} style={{ marginTop: space.xs }}>
            {value}
          </Txt>
        </VStack>
      </Card>
    </Pressable>
  );
}

function MenuItem({
  icon,
  label,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
}) {
  const { c, space, radius } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: space.md,
        backgroundColor: c.surface,
        borderWidth: 1,
        borderColor: c.line,
        borderRadius: radius.lg,
        padding: space.lg,
      }}
    >
      <Ionicons name={icon} size={20} color={c.blue} />
      <Txt variant="body" style={{ flex: 1 }}>
        {label}
      </Txt>
      {/* Points the way the app moves, which under RTL is leftwards. */}
      <Ionicons name="chevron-back" size={18} color={c.ink400} />
    </Pressable>
  );
}
