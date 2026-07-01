import {
  Bell,
  ClipboardList,
  Heart,
  LayoutDashboard,
  MapPin,
  Package,
  Settings,
  ShieldCheck,
  ShoppingBag,
  Store,
  type LucideIcon,
} from "lucide-react";
import type { AuthUser } from "@/lib/auth-store";
import type { Dict } from "@/lib/i18n";

/** The three role-scoped dashboards, all rendered through one shared shell. */
export type DashboardRole = "operator" | "vendor" | "buyer";

export type DashNavItem = {
  href: string;
  key: keyof Dict;
  icon: LucideIcon;
  /** When true the link is active only on an exact path match. */
  exact?: boolean;
};

export type DashboardDef = {
  role: DashboardRole;
  /** Landing route + the base the sidebar anchors to. */
  home: string;
  titleKey: keyof Dict;
  subtitleKey: keyof Dict;
  icon: LucideIcon;
  nav: DashNavItem[];
  /** Does this signed-in user have access to this dashboard? */
  can: (user: AuthUser) => boolean;
};

export const DASHBOARDS: Record<DashboardRole, DashboardDef> = {
  operator: {
    role: "operator",
    home: "/admin",
    titleKey: "storeAdmin",
    subtitleKey: "storeAdminSub",
    icon: ShieldCheck,
    can: (u) => !!u.isOperator,
    nav: [
      { href: "/admin", key: "adminNavSettings", icon: Settings, exact: true },
      { href: "/admin/vendors", key: "adminNavVendors", icon: Store },
      { href: "/admin/products", key: "adminNavProducts", icon: Package },
      { href: "/admin/orders", key: "adminNavOrders", icon: ClipboardList },
    ],
  },
  vendor: {
    role: "vendor",
    home: "/vendor",
    titleKey: "vendorDashboard",
    subtitleKey: "vendorDashboardSub",
    icon: Store,
    can: (u) => !!u.isVendor,
    nav: [
      { href: "/vendor", key: "vendorNavOverview", icon: LayoutDashboard, exact: true },
      { href: "/vendor/products", key: "vendorNavProducts", icon: Package },
      { href: "/vendor/orders", key: "vendorNavOrders", icon: ShoppingBag },
      { href: "/vendor/settings", key: "vendorNavSettings", icon: Settings },
    ],
  },
  buyer: {
    role: "buyer",
    home: "/account",
    titleKey: "buyerDashboard",
    subtitleKey: "buyerDashboardSub",
    icon: LayoutDashboard,
    // Any signed-in user is a buyer.
    can: () => true,
    nav: [
      { href: "/account", key: "buyerNavOverview", icon: LayoutDashboard, exact: true },
      { href: "/account/orders", key: "myOrders", icon: Package },
      { href: "/wishlist", key: "wishlist", icon: Heart },
      { href: "/account/addresses", key: "addresses", icon: MapPin },
      { href: "/account/notifications", key: "notifications", icon: Bell },
    ],
  },
};

/** Priority when auto-routing a multi-role account to its "main" dashboard. */
const ROLE_PRIORITY: DashboardRole[] = ["operator", "vendor", "buyer"];

/** Every dashboard this user may enter, in priority order. */
export function dashboardsFor(user: AuthUser | null): DashboardDef[] {
  if (!user) return [];
  return ROLE_PRIORITY.map((r) => DASHBOARDS[r]).filter((d) => d.can(user));
}

/** The single best landing route for the user (used by the /dashboard router). */
export function primaryDashboard(user: AuthUser | null): string | null {
  return dashboardsFor(user)[0]?.home ?? null;
}
