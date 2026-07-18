import {
  Award,
  BarChart3,
  Bell,
  BellRing,
  ClipboardList,
  CreditCard,
  FileText,
  Gift,
  Heart,
  Images,
  Layers,
  LayoutDashboard,
  Mail,
  MapPin,
  Megaphone,
  Boxes,
  MessagesSquare,
  Package,
  RotateCcw,
  Settings,
  ShieldCheck,
  ShoppingBag,
  Store,
  Tag,
  Truck,
  Users,
  Wallet,
  Zap,
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
  /** Show a live count badge: unread chat, or an operator pending-review queue. */
  badge?: "messages" | "pending-products" | "pending-vendors";
  /** Visible to a content-editor-only account (not a full operator). */
  contentEditor?: boolean;
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
      { href: "/admin/analytics", key: "adminNavAnalytics", icon: BarChart3 },
      { href: "/admin/vendors", key: "adminNavVendors", icon: Store, badge: "pending-vendors" },
      { href: "/admin/products", key: "adminNavProducts", icon: Package, badge: "pending-products" },
      { href: "/admin/inventory", key: "adminNavInventory", icon: Boxes },
      { href: "/admin/categories", key: "adminNavCategories", icon: Layers },
      { href: "/admin/orders", key: "adminNavOrders", icon: ClipboardList },
      { href: "/admin/returns", key: "adminNavReturns", icon: RotateCcw },
      { href: "/admin/coupons", key: "adminNavCoupons", icon: Tag },
      { href: "/admin/deals", key: "adminNavDeals", icon: Zap },
      { href: "/admin/sponsored", key: "adminNavSponsored", icon: Megaphone },
      { href: "/admin/messages", key: "adminNavMessages", icon: MessagesSquare },
      { href: "/admin/wallets", key: "adminNavWallets", icon: Gift },
      { href: "/admin/payouts", key: "adminNavPayouts", icon: Wallet },
      { href: "/admin/payments", key: "adminNavPayments", icon: CreditCard },
      { href: "/admin/shipping", key: "adminNavShipping", icon: Truck },
      { href: "/admin/email", key: "adminNavEmail", icon: Mail },
      { href: "/admin/content", key: "adminNavContent", icon: FileText, contentEditor: true },
      { href: "/admin/banners", key: "adminNavBanners", icon: Images, contentEditor: true },
      { href: "/admin/team", key: "adminNavTeam", icon: Users },
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
      { href: "/vendor/analytics", key: "vendorNavAnalytics", icon: BarChart3 },
      { href: "/vendor/products", key: "vendorNavProducts", icon: Package },
      { href: "/vendor/orders", key: "vendorNavOrders", icon: ShoppingBag },
      { href: "/vendor/messages", key: "vendorNavMessages", icon: MessagesSquare, badge: "messages" },
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
      { href: "/account/returns", key: "buyerNavReturns", icon: RotateCcw },
      { href: "/account/messages", key: "messagesNav", icon: MessagesSquare, badge: "messages" },
      { href: "/account/wallet", key: "walletNav", icon: Wallet },
      { href: "/account/loyalty", key: "loyaltyNav", icon: Award },
      { href: "/wishlist", key: "wishlist", icon: Heart },
      { href: "/account/alerts", key: "alertsNav", icon: BellRing },
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
