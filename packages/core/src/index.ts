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

export { listStores, vendorStorefront } from "./stores.js";

export { listDeals } from "./deals.js";

export { getServerWishlist, mergeWishlists, saveServerWishlist } from "./wishlist.js";

export {
  createTicket,
  myTickets,
  replyToTicket,
  setTicketStatus,
  supportUnreadTotal,
  ticketThread,
  TICKET_CATEGORIES,
} from "./support.js";
export type {
  Ticket,
  TicketCategory,
  TicketMessage,
  TicketStatus,
  TicketThread,
} from "./support.js";

export {
  buyerThreads,
  messagesUnreadTotal,
  messageThread,
  orderVendors,
  postMessage,
  vendorThreads,
} from "./messaging.js";
export type { Message, MessageRole, ThreadSummary } from "./messaging.js";

export {
  markAllNotificationsRead,
  markNotificationRead,
  myNotifications,
  notificationsUnread,
} from "./notifications.js";
export type { Notification } from "./notifications.js";

export { buyerReport, reportDate, vendorReport } from "./reports.js";
export type { BuyerReport, StatusCount, VendorReport } from "./reports.js";

export { getSiteContent, localizeSiteContent, registerVendor } from "./cms.js";
export type { SiteContent, VendorRegistration } from "./cms.js";

export { myReturns, orderReturn, requestReturn, RETURN_REASONS } from "./returns.js";
export type { ReturnReason, ReturnRequest, ReturnStatus } from "./returns.js";

export {
  alertStatus,
  myAlerts,
  subscribeStockAlert,
  unsubscribeStockAlert,
} from "./alerts.js";
export type { AlertStatus, StockAlert } from "./alerts.js";

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

export {
  myStore,
  shipVendorOrder,
  updateMyStore,
  vendorAnalytics,
  vendorOrders,
  vendorShipmentStatuses,
} from "./vendor.js";
export type {
  VendorAnalytics,
  VendorOrder,
  VendorStore,
  VendorStoreInput,
  VendorTotals,
} from "./vendor.js";

export { myBenchmarks } from "./benchmarks.js";
export type { Benchmarks, BenchmarkMetric, Comparison, VendorMetrics } from "./benchmarks.js";

export {
  deleteProduct,
  exportMyProductsCsv,
  getMyProduct,
  importProductsCsv,
  importTemplate,
  myProducts,
  upsertProduct,
} from "./vendor-products.js";
export type {
  ApprovalStatus,
  ImportResult,
  ImportRowResult,
  ProductInput,
  VendorProduct,
  VendorProductDetail,
} from "./vendor-products.js";

export {
  createMyShipment,
  myOrderShipments,
  shipmentLabel,
  updateMyShipment,
  SHIPMENT_STATUSES,
} from "./vendor-shipping.js";
export type { ShipmentLabel, ShipmentStatus } from "./vendor-shipping.js";

export { deleteMyCoupon, myCoupons, upsertMyCoupon } from "./vendor-coupons.js";
export type { Coupon, CouponInput, DiscountType } from "./vendor-coupons.js";

export {
  addReview,
  addVendorReview,
  answerQuestion,
  askQuestion,
  listQuestions,
  listReviews,
  listVendorReviews,
} from "./reviews.js";
export type { Question, Review, ReviewSummary } from "./reviews.js";

export { MAX_IMAGE_BYTES, uploadImage } from "./uploads.js";
export type { UploadFile } from "./uploads.js";

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
