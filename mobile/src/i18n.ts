/**
 * Shell strings.
 *
 * The storefront's dictionary is ~1,600 keys covering screens this app doesn't
 * have yet, so it isn't imported wholesale. Only what the shell renders lives
 * here; screen strings arrive with their screens. The shape stays
 * key-parallel between `ar` and `en` for the same reason it does on the web —
 * a missing key must be a type error, not a blank label in production.
 */

export type Locale = "ar" | "en";

const ar = {
  tabHome: "الرئيسية",
  tabSearch: "البحث",
  tabCart: "السلة",
  tabAccount: "حسابي",

  brand: "أوفيرا",
  tagline: "سوق مصر الأول",

  soon: "قريبًا",
  soonBody: "الشاشة دي تحت التطوير وهتشتغل في التحديث الجاي.",

  connected: "متصل بالمتجر",
  connecting: "بيتصل بالمتجر…",
  offline: "تعذّر الاتصال بالمتجر",
  retry: "أعد المحاولة",

  notFound: "الصفحة غير موجودة",
  backHome: "ارجع للرئيسية",

  currency: "ج.م",

  // browsing
  searchPlaceholder: "دوّر على أي حاجة…",
  categories: "الأقسام",
  allCategories: "كل الأقسام",
  seeAll: "شوف الكل",
  newArrivals: "وصل حديثًا",
  topRated: "الأعلى تقييمًا",
  offers: "أقوى العروض",
  results: "نتيجة",
  noResults: "مفيش نتايج",
  noResultsBody: "جرّب كلمة تانية أو شيل بعض الفلاتر.",
  emptyCategory: "القسم ده لسه فاضي",
  loadFailed: "تعذّر تحميل البيانات",
  loadMore: "حمّل المزيد",
  searchHint: "اكتب اسم منتج أو قسم عشان تبدأ",
  recentSearches: "عمليات بحث سابقة",
  clear: "مسح",

  // sorting
  sort: "ترتيب",
  sortLatest: "الأحدث",
  sortPriceAsc: "الأرخص أولًا",
  sortPriceDesc: "الأغلى أولًا",
  sortRating: "الأعلى تقييمًا",
  inStockOnly: "المتاح فقط",

  // product
  outOfStock: "نفدت الكمية",
  lowStock: "باقي {n} بس",
  inStock: "متاح {n}",
  off: "خصم {n}%",
  qty: "الكمية",
  addToCart: "أضف للسلة",
  added: "اتضاف للسلة",
  buyNow: "اشترِ الآن",
  bulkPricing: "أسعار الجملة",
  bulkFrom: "من {n} قطعة",
  bulkHint: "خُد {n} قطعة والسعر يبقى {price} للقطعة",
  chooseOption: "اختر {option}",
  chooseFirst: "اختر أولًا",
  specs: "المواصفات",
  aboutProduct: "عن المنتج",
  soldBy: "البائع",
  trustScore: "تقييم البائع",
  relatedProducts: "منتجات مشابهة",
  reviewsCount: "{n} تقييم",
  noReviews: "لا توجد تقييمات بعد",
  taxIncluded: "شامل ضريبة {label}",
  taxAdded: "يُضاف {label}",
  taxInclusiveShort: "شاملة",
  taxExclusiveShort: "مضافة",
  productMissing: "المنتج غير متاح",
  productMissingBody: "يمكن يكون اتشال أو البائع وقف البيع.",

  // cart
  cartEmpty: "السلة فاضية",
  cartEmptyBody: "ابدأ التسوّق وضيف اللي عاجبك.",
  startShopping: "ابدأ التسوّق",
  subtotal: "الإجمالي الفرعي",
  shipping: "الشحن",
  shippingAtCheckout: "يُحسب عند الدفع",
  tax: "الضريبة",
  discountLabel: "الخصم",
  total: "الإجمالي",
  remove: "حذف",
  checkout: "إتمام الطلب",

  // identity
  signIn: "تسجيل الدخول",
  signOut: "تسجيل الخروج",
  register: "حساب جديد",
  email: "البريد الإلكتروني",
  password: "كلمة المرور",
  fullName: "الاسم بالكامل",
  phone: "رقم الموبايل",
  noAccount: "معندكش حساب؟",
  haveAccount: "عندك حساب؟",
  signInToContinue: "سجّل دخولك عشان تكمّل",
  guestCheckout: "أكمل كضيف",
  signInBenefit: "سجّل دخولك عشان تتابع طلباتك وتستخدم رصيدك ونقاطك.",

  // checkout
  deliveryDetails: "بيانات التوصيل",
  governorate: "المحافظة",
  address: "العنوان بالتفصيل",
  addressHint: "الشارع والمبنى والدور والشقة",
  savedAddresses: "عناوينك المحفوظة",
  newAddress: "عنوان جديد",
  saveAddress: "احفظ العنوان ده",
  deliveryMethod: "طريقة التوصيل",
  etaDays: "خلال {min}–{max} يوم",
  etaOneDay: "خلال يوم واحد",
  preferredCarrier: "شركة الشحن المفضّلة",
  carrierNote: "طلب مش إلزام — البائع بيحجز الشحنة.",
  noPreference: "من غير تفضيل",
  paymentMethod: "طريقة الدفع",
  cod: "الدفع عند الاستلام",
  card: "بطاقة إلكترونية",
  cardUnavailable: "الدفع الإلكتروني مش مفعّل حاليًا",
  couponCode: "كود الخصم",
  apply: "تفعيل",
  couponApplied: "الكود اتفعّل",
  useWallet: "استخدم رصيد المحفظة",
  walletBalance: "رصيدك: {amount}",
  placeOrder: "تأكيد الطلب",
  placing: "بنأكّد الطلب…",
  orderPlaced: "تم استلام طلبك",
  orderNumber: "رقم الطلب",
  viewOrder: "تفاصيل الطلب",
  keepShopping: "كمّل تسوّق",
  requiredFields: "اكتب الاسم والموبايل والمحافظة والعنوان.",
  invalidPhone: "رقم الموبايل مش مظبوط.",

  // orders
  myOrders: "طلباتي",
  noOrders: "مفيش طلبات لسه",
  noOrdersBody: "أول ما تطلب حاجة هتلاقيها هنا.",
  orderItems: "{n} منتج",
  cancelOrder: "إلغاء الطلب",
  cancelConfirm: "متأكد إنك عايز تلغي الطلب؟",
  reorder: "اطلب تاني",
  reordered: "اتضافوا للسلة",
  reorderNothing: "مفيش حاجة من الطلب ده لسه متاحة للبيع.",
  guestOrderHint: "طلبت كضيف. سجّل دخولك عشان تقدر تلغي الطلب أو تطلبه تاني.",

  // device
  settings: "الإعدادات",
  notifications: "الإشعارات",
  notificationsHint: "تحديثات طلبك وشحنتك تيجي على تليفونك.",
  notificationsDenied: "الإشعارات متمنوعة من إعدادات التليفون. افتح الإعدادات لو عايز تفعّلها.",
  notificationsNoDevice: "الإشعارات بتشتغل على تليفون حقيقي بس.",
  notificationsUnbuilt: "الإشعارات هتشتغل بعد أول نسخة مبنيّة من التطبيق.",
  notificationsOn: "التليفون ده مسجّل للإشعارات",
  appLock: "قفل التطبيق",
  appLockHint: "اطلب البصمة أو الوجه قبل فتح حسابك.",
  appLockUnavailable: "التليفون ده مافيهوش بصمة أو وجه مسجّل.",
  locked: "التطبيق مقفول",
  unlock: "افتح بالبصمة",
  unlockPrompt: "أكّد شخصيتك عشان تفتح أوفيرا",

  // scanner
  scan: "امسح باركود",
  scanHint: "صوّب الكاميرا على الباركود بتاع المنتج.",
  scanPermission: "محتاجين إذن الكاميرا عشان نمسح الباركود.",
  allowCamera: "اسمح بالكاميرا",
  scanNothing: "مفيش منتج بالباركود ده",
  scanAgain: "امسح تاني",

  // vendor
  vendorArea: "متجري",
  vendorOrders: "طلبات متجري",
  vendorPending: "محتاج تجهيز",
  vendorToday: "النهاردة",
  vendorNetEarnings: "صافي أرباحك",
  vendorGross: "إجمالي المبيعات",
  vendorCommission: "العمولة",
  vendorUnits: "قطعة مباعة",
  vendorOrdersCount: "طلب",
  vendorNoOrders: "مفيش طلبات لسه",
  vendorNoOrdersBody: "أول ما حد يطلب من متجرك هيظهر هنا.",
  vendorMyShare: "نصيبك من الطلب",
  vendorShip: "سجّل الشحنة",
  vendorShipped: "اتشحن",
  vendorCarrier: "شركة الشحن",
  vendorTracking: "رقم التتبّع",
  vendorShipDone: "الشحنة اتسجّلت",
  vendorPeriod: "آخر {n} يوم",
  vendorFullConsole: "لوحة التحكّم الكاملة على الموقع",
  vendorSuspended: "متجرك موقوف حاليًا — كلّم إدارة السوق.",
  vendorPendingApproval: "متجرك تحت المراجعة.",
  tracking: "تتبّع الشحنة",
  noTracking: "لسه مفيش شحنة مسجّلة",
  paymentStatus: "حالة الدفع",
  orderDate: "تاريخ الطلب",

  // account
  account: "حسابي",
  addresses: "العناوين",
  wallet: "المحفظة",
  points: "نقاط الولاء",
  pointsBalance: "{n} نقطة",
  pointsWorth: "قيمتها {amount}",
  redeem: "استبدال",
  redeemAll: "استبدل الكل",
  pointsMin: "أقل عدد للاستبدال {n} نقطة",
  pointsExpiring: "{n} نقطة هتنتهي في {date}",
  pointsOff: "برنامج النقاط مش مفعّل حاليًا",
  pointsRedeemed: "تم إضافة {amount} لرصيد محفظتك",
  walletUnknown: "تعذّر قراءة الرصيد",
  walletBalanceLabel: "الرصيد المتاح",
  noEntries: "مفيش حركات",
  setDefault: "اجعله الافتراضي",
  defaultAddress: "افتراضي",
  save: "حفظ",
  cancel: "إلغاء",
  deleteConfirm: "متأكد؟",

  // browse — all products, departments, deals
  allProducts: "كل المنتجات",
  deals: "العروض",
  dealsLive: "عروض شغّالة دلوقتي",
  dealsEmpty: "مفيش عروض دلوقتي",
  dealsEmptyBody: "تعالى بصّ تاني قريب — العروض بتتجدّد.",

  // sellers
  stores: "المتاجر",
  storesBrowse: "تصفّح متاجر البائعين",
  storesSearch: "دوّر على متجر…",
  storesEmpty: "مفيش متاجر مطابقة",
  storeProducts: "{n} منتج",
  storeRating: "{r} ({n} تقييم)",
  storeMissing: "المتجر ده مش موجود",
  storeMissingBody: "يمكن يكون اتقفل أو الرابط قديم.",
  storeNoProducts: "المتجر ده لسه مانزلش منتجات",
  shippingPolicy: "سياسة الشحن",
  returnPolicy: "سياسة الإرجاع",

  // saved: wishlist, compare, back-in-stock
  wishlist: "المفضّلة",
  wishEmpty: "مفيش حاجة في المفضّلة",
  wishEmptyBody: "دوس على القلب في أي منتج عشان تحفظه هنا.",
  wishSaved: "منتج محفوظ",
  wishBrowse: "تصفّح المنتجات",
  wishAdded: "اتحفظ في المفضّلة",
  clearAll: "امسح الكل",

  compare: "مقارنة",
  compareOpen: "قارن المحفوظات",
  compareEmpty: "مفيش منتجات للمقارنة",
  compareEmptyBody: "ضيف حتى ٤ منتجات وقارنهم جنب بعض.",
  compareFull: "أقصى عدد للمقارنة ٤ منتجات",
  compareAdd: "أضف للمقارنة",
  compareProduct: "المنتج",
  comparePrice: "السعر",
  compareRating: "التقييم",
  compareSeller: "البائع",
  compareStock: "التوفّر",
  compareInStock: "متاح",
  compareChoose: "اختر الخيارات",

  alerts: "تنبيهات التوفّر",
  alertsEmpty: "مفيش تنبيهات",
  alertsEmptyBody: "لما تلاقي منتج مش متاح، اطلب نبّهك أول ما يرجع.",
  alertsSignIn: "سجّل دخولك عشان تتابع تنبيهاتك.",
  alertBack: "رجع متاح",
  alertWaiting: "في انتظار التوفّر",
  notifyMe: "نبّهني لما يتوفّر",
  notifyOn: "هنبّهك أول ما يتوفّر",
  signInFirst: "محتاج تسجّل دخولك",

  // returns
  returns: "المرتجعات",
  returnsEmpty: "مفيش مرتجعات",
  returnsEmptyBody: "لو في طلب وصلك وفيه مشكلة، تقدر تطلب إرجاعه من صفحة الطلب.",
  returnsSignIn: "سجّل دخولك عشان تشوف طلبات الإرجاع.",
  returnRequest: "اطلب إرجاع",
  returnRequested: "طلب إرجاع",
  returnReason: "سبب الإرجاع",
  returnDetails: "تفاصيل إضافية",
  returnDetailsHint: "اكتب اللي حصل بالظبط (اختياري)",
  returnSend: "ابعت الطلب",
  returnNote: "رد الإدارة",
  returnRefunded: "المبلغ المسترد",
  returnViewOrder: "شوف الطلب",

  // public tracking
  track: "تتبّع طلبك",
  trackSubtitle: "اكتب رقم الطلب ورقم الموبايل أو الإيميل اللي طلبت بيه.",
  trackOrderNo: "رقم الطلب",
  trackProof: "الموبايل أو الإيميل",
  trackProofHint: "01xxxxxxxxx أو you@example.com",
  trackLookup: "دوّر على الطلب",
  trackNotFound: "مالقيناش طلب بالبيانات دي.",
  trackDelivery: "عنوان التوصيل",
  trackDeliveredOn: "اتسلّم في {date}",

  // invoice
  invoice: "الفاتورة",
  invoiceShare: "احفظ أو شارك PDF",
  invoiceBuilding: "بنجهّز الفاتورة…",
  invoiceVoid: "الفاتورة دي ملغية — تم استرداد الطلب",
  invoiceBillTo: "الفاتورة باسم",
  invoiceDetails: "بيانات الطلب",
  invoiceNet: "الإجمالي قبل الضريبة",
  invoiceTax: "ضريبة القيمة المضافة {rate}%",
  invoiceColProduct: "المنتج",
  invoiceColUnit: "سعر الوحدة",
  invoiceThanks: "شكرًا لتسوّقك من {brand}",
  orderStatus: "حالة الطلب",
  orderMissing: "الطلب مش موجود",
  free: "مجاني",
};

export type Dict = typeof ar;

const en: Dict = {
  tabHome: "Home",
  tabSearch: "Search",
  tabCart: "Cart",
  tabAccount: "Account",

  brand: "Ovira",
  tagline: "Egypt's marketplace",

  soon: "Coming soon",
  soonBody: "This screen is being built and lands in the next update.",

  connected: "Connected to the store",
  connecting: "Connecting to the store…",
  offline: "Could not reach the store",
  retry: "Try again",

  notFound: "Page not found",
  backHome: "Back to home",

  currency: "EGP",

  searchPlaceholder: "Search for anything…",
  categories: "Categories",
  allCategories: "All categories",
  seeAll: "See all",
  newArrivals: "New arrivals",
  topRated: "Top rated",
  offers: "Best offers",
  results: "results",
  noResults: "No results",
  noResultsBody: "Try another word, or clear some filters.",
  emptyCategory: "This category is still empty",
  loadFailed: "Could not load",
  loadMore: "Load more",
  searchHint: "Type a product or category name to start",
  recentSearches: "Recent searches",
  clear: "Clear",

  sort: "Sort",
  sortLatest: "Newest",
  sortPriceAsc: "Price: low to high",
  sortPriceDesc: "Price: high to low",
  sortRating: "Top rated",
  inStockOnly: "In stock only",

  outOfStock: "Out of stock",
  lowStock: "Only {n} left",
  inStock: "{n} available",
  off: "{n}% off",
  qty: "Quantity",
  addToCart: "Add to cart",
  added: "Added to cart",
  buyNow: "Buy now",
  bulkPricing: "Bulk pricing",
  bulkFrom: "From {n} units",
  bulkHint: "Take {n} and pay {price} each",
  chooseOption: "Choose {option}",
  chooseFirst: "Choose one first",
  specs: "Specifications",
  aboutProduct: "About this product",
  soldBy: "Sold by",
  trustScore: "Seller rating",
  relatedProducts: "Related products",
  reviewsCount: "{n} reviews",
  noReviews: "No reviews yet",
  taxIncluded: "{label} included",
  taxAdded: "{label} added at checkout",
  taxInclusiveShort: "included",
  taxExclusiveShort: "added",
  productMissing: "Product unavailable",
  productMissingBody: "It may have been removed, or the seller stopped selling it.",

  cartEmpty: "Your cart is empty",
  cartEmptyBody: "Start browsing and add what you like.",
  startShopping: "Start shopping",
  subtotal: "Subtotal",
  shipping: "Shipping",
  shippingAtCheckout: "Calculated at checkout",
  tax: "Tax",
  discountLabel: "Discount",
  total: "Total",
  remove: "Remove",
  checkout: "Checkout",

  signIn: "Sign in",
  signOut: "Sign out",
  register: "Create account",
  email: "Email",
  password: "Password",
  fullName: "Full name",
  phone: "Mobile number",
  noAccount: "No account yet?",
  haveAccount: "Already registered?",
  signInToContinue: "Sign in to continue",
  guestCheckout: "Continue as guest",
  signInBenefit: "Sign in to track orders and use your credit and points.",

  deliveryDetails: "Delivery details",
  governorate: "Governorate",
  address: "Full address",
  addressHint: "Street, building, floor, flat",
  savedAddresses: "Saved addresses",
  newAddress: "New address",
  saveAddress: "Save this address",
  deliveryMethod: "Delivery method",
  etaDays: "In {min}–{max} days",
  etaOneDay: "Next day",
  preferredCarrier: "Preferred courier",
  carrierNote: "A request, not a guarantee — the seller books the shipment.",
  noPreference: "No preference",
  paymentMethod: "Payment method",
  cod: "Cash on delivery",
  card: "Card",
  cardUnavailable: "Card payment is not enabled yet",
  couponCode: "Coupon code",
  apply: "Apply",
  couponApplied: "Coupon applied",
  useWallet: "Use store credit",
  walletBalance: "Balance: {amount}",
  placeOrder: "Place order",
  placing: "Placing your order…",
  orderPlaced: "Order received",
  orderNumber: "Order number",
  viewOrder: "Order details",
  keepShopping: "Keep shopping",
  requiredFields: "Name, mobile, governorate and address are required.",
  invalidPhone: "That mobile number doesn't look right.",

  myOrders: "My orders",
  noOrders: "No orders yet",
  noOrdersBody: "Anything you order will show up here.",
  orderItems: "{n} items",
  cancelOrder: "Cancel order",
  cancelConfirm: "Cancel this order?",
  reorder: "Order again",
  reordered: "Added to cart",
  reorderNothing: "Nothing from this order is still on sale.",
  guestOrderHint: "You ordered as a guest. Sign in to cancel or re-order.",

  settings: "Settings",
  notifications: "Notifications",
  notificationsHint: "Order and delivery updates arrive on your phone.",
  notificationsDenied: "Notifications are blocked in your phone's settings.",
  notificationsNoDevice: "Notifications only work on a real device.",
  notificationsUnbuilt: "Notifications start working from the first built release.",
  notificationsOn: "This device is registered for notifications",
  appLock: "App lock",
  appLockHint: "Ask for fingerprint or face before opening your account.",
  appLockUnavailable: "This phone has no fingerprint or face enrolled.",
  locked: "App locked",
  unlock: "Unlock",
  unlockPrompt: "Confirm it's you to open Ovira",

  scan: "Scan barcode",
  scanHint: "Point the camera at the product's barcode.",
  scanPermission: "Camera access is needed to scan.",
  allowCamera: "Allow camera",
  scanNothing: "No product with that barcode",
  scanAgain: "Scan again",

  vendorArea: "My store",
  vendorOrders: "Store orders",
  vendorPending: "Needs packing",
  vendorToday: "Today",
  vendorNetEarnings: "Net earnings",
  vendorGross: "Gross sales",
  vendorCommission: "Commission",
  vendorUnits: "units sold",
  vendorOrdersCount: "orders",
  vendorNoOrders: "No orders yet",
  vendorNoOrdersBody: "Orders from your store will appear here.",
  vendorMyShare: "Your share",
  vendorShip: "Record shipment",
  vendorShipped: "Shipped",
  vendorCarrier: "Courier",
  vendorTracking: "Tracking number",
  vendorShipDone: "Shipment recorded",
  vendorPeriod: "Last {n} days",
  vendorFullConsole: "Full dashboard on the web",
  vendorSuspended: "Your store is suspended — contact the marketplace.",
  vendorPendingApproval: "Your store is under review.",
  tracking: "Tracking",
  noTracking: "No shipment recorded yet",
  paymentStatus: "Payment",
  orderDate: "Ordered on",

  account: "Account",
  addresses: "Addresses",
  wallet: "Store credit",
  points: "Loyalty points",
  pointsBalance: "{n} points",
  pointsWorth: "Worth {amount}",
  redeem: "Redeem",
  redeemAll: "Redeem all",
  pointsMin: "Minimum redemption is {n} points",
  pointsExpiring: "{n} points expire on {date}",
  pointsOff: "The points programme is switched off",
  pointsRedeemed: "{amount} added to your store credit",
  walletUnknown: "Could not read your balance",
  walletBalanceLabel: "Available balance",
  noEntries: "No activity",
  setDefault: "Make default",
  defaultAddress: "Default",
  save: "Save",
  cancel: "Cancel",
  deleteConfirm: "Are you sure?",

  allProducts: "All products",
  deals: "Deals",
  dealsLive: "Live right now",
  dealsEmpty: "No deals right now",
  dealsEmptyBody: "Check back soon — deals refresh often.",

  stores: "Stores",
  storesBrowse: "Browse seller stores",
  storesSearch: "Search for a store…",
  storesEmpty: "No matching stores",
  storeProducts: "{n} products",
  storeRating: "{r} ({n} ratings)",
  storeMissing: "That store isn't here",
  storeMissingBody: "It may have closed, or the link is out of date.",
  storeNoProducts: "This store hasn't listed anything yet",
  shippingPolicy: "Shipping policy",
  returnPolicy: "Returns policy",

  wishlist: "Wishlist",
  wishEmpty: "Nothing saved yet",
  wishEmptyBody: "Tap the heart on any product to keep it here.",
  wishSaved: "saved",
  wishBrowse: "Browse products",
  wishAdded: "Saved to your wishlist",
  clearAll: "Clear all",

  compare: "Compare",
  compareOpen: "Compare saved items",
  compareEmpty: "Nothing to compare",
  compareEmptyBody: "Add up to 4 products and see them side by side.",
  compareFull: "You can compare up to 4 products",
  compareAdd: "Add to compare",
  compareProduct: "Product",
  comparePrice: "Price",
  compareRating: "Rating",
  compareSeller: "Seller",
  compareStock: "Availability",
  compareInStock: "In stock",
  compareChoose: "Choose options",

  alerts: "Stock alerts",
  alertsEmpty: "No alerts",
  alertsEmptyBody: "When something is out of stock, ask us to tell you when it returns.",
  alertsSignIn: "Sign in to see your alerts.",
  alertBack: "Back in stock",
  alertWaiting: "Waiting",
  notifyMe: "Notify me when available",
  notifyOn: "We'll tell you when it's back",
  signInFirst: "Sign in first",

  returns: "Returns",
  returnsEmpty: "No returns",
  returnsEmptyBody: "If something arrives and isn't right, you can request a return from the order.",
  returnsSignIn: "Sign in to see your return requests.",
  returnRequest: "Request a return",
  returnRequested: "Return request",
  returnReason: "Reason",
  returnDetails: "More detail",
  returnDetailsHint: "Tell us what happened (optional)",
  returnSend: "Send request",
  returnNote: "Our reply",
  returnRefunded: "Refunded",
  returnViewOrder: "View order",

  track: "Track your order",
  trackSubtitle: "Enter the order number and the phone or email you ordered with.",
  trackOrderNo: "Order number",
  trackProof: "Phone or email",
  trackProofHint: "01xxxxxxxxx or you@example.com",
  trackLookup: "Find my order",
  trackNotFound: "We couldn't find an order matching those details.",
  trackDelivery: "Delivery address",
  trackDeliveredOn: "Delivered on {date}",

  invoice: "Invoice",
  invoiceShare: "Save or share as PDF",
  invoiceBuilding: "Preparing the invoice…",
  invoiceVoid: "This invoice is void — the order was refunded",
  invoiceBillTo: "Billed to",
  invoiceDetails: "Order details",
  invoiceNet: "Net of tax",
  invoiceTax: "VAT {rate}%",
  invoiceColProduct: "Product",
  invoiceColUnit: "Unit price",
  invoiceThanks: "Thank you for shopping with {brand}",
  orderStatus: "Order status",
  orderMissing: "Order not found",
  free: "Free",
};

const dicts: Record<Locale, Dict> = { ar, en };

export const DEFAULT_LOCALE: Locale = "ar";

export function dict(locale: Locale = DEFAULT_LOCALE): Dict {
  return dicts[locale] ?? ar;
}

/**
 * Fill `{name}` slots in a string.
 *
 * Arabic and English put the number in different places in a sentence, which is
 * why the placeholder is named rather than positional — "باقي {n} بس" and
 * "Only {n} left" can each keep their own word order.
 */
export function fill(template: string, values: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (whole, key: string) =>
    key in values ? String(values[key]) : whole,
  );
}

/**
 * Arabic-Indic digits are what a customer here expects to read, but the value
 * itself must stay parseable, so this only ever touches display strings.
 *
 * Every number the shopper sees goes through here, not just prices. Formatting
 * the price and leaving the quantity beside it in Latin digits puts two
 * numbering systems in one line, which reads as a bug.
 */
export function num(
  value: number,
  options: { locale?: Locale; decimals?: number } = {},
): string {
  const { locale = DEFAULT_LOCALE, decimals } = options;
  const n = Number.isFinite(value) ? value : 0;
  // Money wants two decimals or none — 250 not 250.00, 135.09 not 135.1. A
  // rating wants exactly one, so 4.2 doesn't render as "4.20" and read like a
  // price.
  const places = decimals ?? (n % 1 === 0 ? 0 : 2);
  return new Intl.NumberFormat(locale === "ar" ? "ar-EG" : "en-EG", {
    minimumFractionDigits: places,
    maximumFractionDigits: places,
  }).format(n);
}

export function money(amount: number, locale: Locale = DEFAULT_LOCALE): string {
  return `${num(amount, { locale })} ${dict(locale).currency}`;
}

/**
 * A Frappe timestamp as a readable date.
 *
 * Frappe sends "2026-07-31 01:05:03.951728", which is not ISO-8601: passing it
 * to `new Date()` is read as local time by some engines and as invalid by
 * others. The date part is therefore split out and rebuilt by hand — an order
 * dated a day off, or "Invalid Date", is worse than a plain string.
 */
export function formatDate(value?: string | null, locale: Locale = DEFAULT_LOCALE): string {
  if (!value) return "";
  const [date] = value.split(" ");
  const [y, m, d] = (date ?? "").split("-");
  if (!y || !m || !d) return date ?? "";
  return new Intl.DateTimeFormat(locale === "ar" ? "ar-EG" : "en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date(Number(y), Number(m) - 1, Number(d)));
}
