/**
 * `@ovira/core` — everything the web storefront and the mobile app agree about.
 *
 * The rule that makes a second client affordable for one developer: **types,
 * API calls and money maths live here; only the UI is written twice.** A fix to
 * a price calculation or an endpoint is made once and both clients get it.
 *
 * A host wires itself up at start-up and then stops caring which platform it is:
 *
 * ```ts
 * configure({
 *   baseUrl: process.env.EXPO_PUBLIC_FRAPPE_URL!,
 *   getAuthHeaders: async () => ({ "X-Frappe-CSRF-Token": await token() }),
 *   useCookies: false,           // true in the browser
 *   onError: reportToSentry,
 * });
 * ```
 */

export { configure, fileUrl, getConfig, isConfigured, methodUrl } from "./config.js";
export type { AuthHeaders, CoreConfig } from "./config.js";

export { errorMessage, get, post } from "./http.js";

export * from "./types.js";

export {
  cartTotals,
  goodsTotal,
  lineTotal,
  lineUnitPrice,
  nextTier,
  splitTax,
  subtotal,
  tierUnitRate,
  walletToSpend,
} from "./pricing.js";
export type { CartTotals } from "./pricing.js";

export {
  catalogFacets,
  decodeSlug,
  getProduct,
  listCategories,
  listProducts,
  relatedProducts,
  resolveCategory,
  searchSuggestions,
} from "./catalog.js";
export type {
  Facets,
  ProductQuery,
  ResolvedCategory,
  SearchSuggestions,
  SuggestedProduct,
} from "./catalog.js";

export {
  checkoutAttemptKey,
  placeOrder,
  resetCheckoutAttempt,
  shippingPreview,
  storeConfig,
  validateCoupon,
} from "./checkout.js";
export type { CustomerInfo, PlacedOrder } from "./checkout.js";

export { cancelOrder, getOrder, myOrders, reorderItems, trackOrder } from "./orders.js";

export { registerDevice, unregisterDevice } from "./push.js";
export type { DeviceInfo } from "./push.js";

export { me, register, signIn, signOut } from "./auth.js";
export type { Session } from "./auth.js";

export {
  deleteAddress,
  getWallet,
  myAddresses,
  myPoints,
  redeemPoints,
  saveAddress,
  setDefaultAddress,
} from "./account.js";
export type {
  AddressInput,
  BuyerAddress,
  LoyaltyAccount,
  LoyaltyEntry,
  Wallet,
  WalletEntry,
} from "./account.js";

export {
  GOVERNORATES,
  listCarriers,
  listShippingMethods,
  orderTracking,
  shippingQuote,
} from "./shipping.js";
export type { Carrier, Shipment, ShipmentEvent, ShippingMethod, ShippingQuote } from "./shipping.js";
