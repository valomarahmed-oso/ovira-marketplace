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
  walletApplied: "رصيد المتجر",
  paidWithWallet: "مدفوع من رصيد المتجر",
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

  // content pages. The fallbacks mirror the storefront's, so a store that has
  // not filled the CMS in still says the same thing on both clients.
  more: "المزيد",
  pgAbout: "من نحن",
  pgAboutSub: "سوق مصري متعدد البائعين",
  pgAboutFallback:
    "<p>أوفيرا ماركت بليس مصري متعدد البائعين، بيجمع آلاف المنتجات من بائعين موثوقين في مكان واحد: إلكترونيات، موضة، مستلزمات المنزل، الجمال، وأكتر.</p>" +
    "<h3>ليه أوفيرا؟</h3>" +
    "<ul><li>بائعون مراجَعون ومعتمدون قبل ما ينشروا منتجاتهم.</li>" +
    "<li>دفع آمن: كاش عند الاستلام أو دفع إلكتروني عبر بوابات معتمدة.</li>" +
    "<li>إرجاع سهل وخدمة عملاء بتساعدك فعلاً.</li></ul>" +
    "<h3>للبائعين</h3>" +
    "<p>لو عندك منتجات وعايز توصل لعملاء أكتر، افتح متجرك على أوفيرا في دقائق من صفحة «ابدأ البيع».</p>",

  pgCareers: "وظائف",
  pgCareersSub: "اشتغل معانا",
  pgCareersFallback:
    "<p>إحنا بنبني سوقًا مصريًا من الصفر، وبندوّر على ناس بتهتم بالتفاصيل.</p>" +
    "<p>لو مهتم، ابعتلنا سيرتك الذاتية على support@ovira.cloud واكتب في العنوان الوظيفة اللي بتدوّر عليها.</p>",

  pgTerms: "الشروط والأحكام",
  pgTermsSub: "شروط استخدام المنصّة",
  pgTermsFallback:
    "<p>باستخدامك أوفيرا فإنك توافق على الشروط دي.</p>" +
    "<h3>الطلبات والأسعار</h3>" +
    "<p>كل الأسعار بالجنيه المصري وبتشمل أو بتضاف عليها الضريبة حسب المعروض في صفحة المنتج. المتجر بيراجع كل طلب قبل التنفيذ.</p>" +
    "<h3>الإرجاع</h3>" +
    "<p>تقدر تطلب إرجاع أي طلب اتسلّم من صفحة الطلب، وبتتراجع كل حالة على حدة.</p>" +
    "<h3>الحسابات</h3>" +
    "<p>إنت مسؤول عن الحفاظ على بيانات دخولك، وعن أي نشاط بيتم من حسابك.</p>",

  pgPrivacy: "سياسة الخصوصية",
  pgPrivacySub: "إزاي بنتعامل مع بياناتك",
  pgPrivacyFallback:
    "<p>بنجمع الحد الأدنى من البيانات اللازم لتنفيذ طلبك: الاسم، رقم الموبايل، العنوان، والإيميل.</p>" +
    "<h3>مع مين بنشاركها</h3>" +
    "<p>بنشارك بيانات التوصيل مع شركة الشحن والبائع المسؤول عن طلبك، وبس.</p>" +
    "<h3>الدفع</h3>" +
    "<p>بيانات البطاقة بتروح مباشرة لبوابة الدفع، وإحنا مابنخزّنش أرقام البطاقات على سيرفراتنا إطلاقًا.</p>" +
    "<h3>حقوقك</h3>" +
    "<p>تقدر تطلب حذف حسابك أو نسخة من بياناتك في أي وقت على support@ovira.cloud.</p>",

  // become a seller
  sell: "ابدأ البيع",
  sellSubtitle: "افتح متجرك على أوفيرا ووصّل منتجاتك لعملاء أكتر.",
  sellStoreName: "اسم المتجر",
  sellStoreNameHint: "الاسم اللي هيظهر للعملاء",
  sellAbout: "نبذة عن متجرك",
  sellAboutHint: "بتبيع إيه؟ (اختياري)",
  sellSubmit: "افتح المتجر",
  sellSubmitted: "طلبك وصلنا",
  sellPending: "متجرك تحت المراجعة، وهنبلّغك أول ما يتفعّل.",
  sellActive: "متجرك اتفعّل — تقدر تبدأ ترفع منتجاتك دلوقتي.",
  sellSignIn: "لازم تسجّل دخولك الأول عشان نربط المتجر بحسابك.",
  sellAlready: "عندك متجر بالفعل",
  sellClosed: "التسجيل كبائع مقفول",
  sellClosedBody: "المتجر ده شغّال كشركة واحدة، مش سوق متعدد البائعين.",
  sellWhy: "ليه تبيع على أوفيرا؟",
  sellWhy1: "بتقبض مستحقاتك أول بأول، وكشف حساب واضح بالعمولة.",
  sellWhy2: "لوحة تحكّم بتوريك مبيعاتك وأكتر منتجاتك مبيعًا.",
  sellWhy3: "إحنا بنتولّى الشحن والتحصيل — إنت بس جهّز الطلب.",

  // conversations
  chatPlaceholder: "اكتب رسالتك…",
  chatClosed: "المحادثة دي مقفولة",

  support: "الدعم",
  supportSignIn: "سجّل دخولك عشان تتكلّم مع الدعم.",
  supportNew: "تذكرة جديدة",
  supportEmpty: "مفيش تذاكر",
  supportEmptyBody: "لو عندك مشكلة أو استفسار، افتح تذكرة وهنرد عليك.",
  supportCategory: "نوع المشكلة",
  supportSubject: "الموضوع",
  supportSubjectHint: "اختصر المشكلة في سطر",
  supportBody: "التفاصيل",
  supportBodyHint: "اشرح المشكلة بالتفصيل",
  supportSend: "ابعت",
  ticketMissing: "التذكرة مش موجودة",
  ticketClose: "اقفل التذكرة",

  messages: "رسايل البائعين",
  messagesSignIn: "سجّل دخولك عشان تشوف محادثاتك.",
  messagesEmpty: "مفيش محادثات",
  messagesEmptyBody: "تقدر تكلّم البائع من صفحة أي طلب.",
  contactSeller: "كلّم {name}",
  contactSellerOne: "كلّم البائع",

  notificationsSignIn: "سجّل دخولك عشان تشوف إشعاراتك.",
  notificationsEmpty: "مفيش إشعارات",
  notificationsEmptyBody: "هنبلّغك هنا بأي جديد في طلباتك.",
  notificationsMarkAll: "علّم الكل كمقروء",

  // buyer report
  reports: "ملخّص مشترياتي",
  reportsSignIn: "سجّل دخولك عشان تشوف ملخّص مشترياتك.",
  reportOrders: "عدد الطلبات",
  reportPaid: "المدفوعة",
  reportSpent: "إجمالي الإنفاق",
  reportAov: "متوسط الطلب",
  reportByStatus: "حسب الحالة",
  reportTopProducts: "أكتر منتجات اشتريتها",

  // seller: the shelf
  vendorNotSeller: "المنطقة دي للبائعين بس",
  inStockShort: "متاح",
  vpTitle: "منتجاتي",
  vpNew: "منتج جديد",
  vpEdit: "تعديل",
  vpCount: "منتج",
  vpEmpty: "مفيش منتجات لسه",
  vpEmptyBody: "ضيف أول منتج، أو استورد ملف CSV دفعة واحدة.",
  vpUnpublished: "غير منشور",
  vpDeleteConfirm: "هيتشال من متجرك نهائي. متأكد؟",
  vpName: "اسم المنتج",
  vpNameHint: "الاسم اللي هيشوفه المشتري",
  vpPrice: "السعر",
  vpCompareAt: "السعر قبل الخصم",
  vpStock: "الكمية المتاحة",
  vpBrand: "الماركة",
  vpOptional: "اختياري",
  vpCondition: "الحالة",
  vpConditions: { New: "جديد", Used: "مستعمل", Refurbished: "مجدّد" } as Record<string, string>,
  vpShortDescription: "وصف مختصر",
  vpDescription: "الوصف الكامل",
  vpReviewNotice: "أي تعديل بيرجّع المنتج لمراجعة الإدارة قبل ما يظهر تاني في المتجر.",
  vpAddTier: "أضف شريحة",
  vpTierRule: "الشريحة بتبدأ من كمية ٢ فأكتر، وأرخص شريحة توصلها هي اللي بتتحسب.",
  vpTierQty: "من كمية",
  vpTierPrice: "سعر القطعة",
  vpNoTiers: "مفيش أسعار جملة",

  // seller: bulk import
  viTitle: "استيراد وتصدير",
  viIntro:
    "عدّل أسعارك وكمياتك دفعة واحدة: صدّر منتجاتك، عدّل الملف، والصقه هنا. راجع المعاينة الأول قبل ما تنفّذ.",
  viColumns: "أعمدة الملف",
  viCopyTemplate: "انسخ العناوين",
  viExportMine: "صدّر منتجاتي",
  viPaste: "الصق محتوى الملف",
  viPreview: "معاينة",
  viApply: "نفّذ الاستيراد",
  viCreated: "جديد",
  viUpdated: "تحديث",
  viErrors: "أخطاء",
  viCopied: "اتنسخ",
  viExported: "اتصدّرت منتجاتك",
  viImported: "تم الاستيراد",
  viStatus: {
    ok: "هيتنفّذ",
    created: "اتضاف",
    updated: "اتحدّث",
    error: "خطأ",
  } as Record<string, string>,

  // seller: fulfilment
  vsTitle: "الشحنات",
  vsTodo: "محتاج شحن",
  vsShipped: "اتشحن",
  vsAll: "الكل",
  vsNeedsShipping: "محتاج شحن",
  vsAllDone: "مفيش حاجة مستنية شحن",
  vsNone: "مفيش شحنات",
  vsCarrierHint: "بوسطة، أرامكس، مندوبك…",
  vsHandedOver: "سلّمته بنفسي",

  // seller: waybill
  vlTitle: "بوليصة الشحن",
  vlMissing: "الشحنة مش موجودة",
  vlPrint: "اطبع أو شارك PDF",
  vlShipment: "رقم الشحنة",
  vlCod: "تحصيل عند الاستلام",
  vlTo: "المرسل إليه",
  vlFrom: "المرسِل",
  vlContents: "محتويات الشحنة",

  // seller: coupons
  vcTitle: "كوبوناتي",
  vcNew: "كوبون جديد",
  vcEmpty: "مفيش كوبونات",
  vcEmptyBody: "اعمل كود خصم لعملائك وتابع استخدامه من هنا.",
  vcFundedNotice: "الخصم ده بيتخصم من مستحقاتك إنت، مش من عمولة السوق.",
  vcDeleteConfirm: "الكود ده هيبطل يشتغل فورًا. متأكد؟",
  vcActive: "شغّال",
  vcInactive: "موقوف",
  vcActiveLabel: "الكوبون شغّال",
  vcCode: "الكود",
  vcType: "نوع الخصم",
  vcPercent: "نسبة %",
  vcFixed: "مبلغ ثابت",
  vcValuePercent: "نسبة الخصم %",
  vcValueFixed: "قيمة الخصم",
  vcMaxLabel: "أقصى خصم",
  vcMinLabel: "أقل قيمة للطلب",
  vcLimitLabel: "أقصى عدد استخدام",
  vcDescription: "وصف الكوبون",
  vcUnlimited: "بدون حد",
  vcMin: "أقل طلب",
  vcMax: "أقصى خصم",
  vcExpires: "ينتهي",
  vcUsed: "اتستخدم",

  // seller: analytics
  vaTitle: "تحليلات المتجر",
  vaRevenue: "الإيراد",
  vaTrend: "المبيعات اليومية",
  vaPeak: "أعلى يوم",
  vaLifetime: "من بداية المتجر",
  vaAov: "متوسط الطلب",
  vaTopProducts: "أكتر المنتجات مبيعًا",

  // seller: benchmarks
  viwTitle: "مقارنة بالسوق",
  viwIntro: "أرقامك مقارنة بمتوسط {n} بائع بيبيعوا نفس نوع منتجاتك.",
  viwMine: "متجرك",
  viwPeerMedian: "متوسط المنافسين",
  viwPercentile: "أحسن من {n}% من المنافسين",
  viwNoPeers: "لسه مفيش مقارنة",
  viwNoPeersBody: "محتاجين {need} بائع على الأقل في نفس أقسامك، ولسه فيه {have}.",
  viwMetrics: {
    orders: "عدد الطلبات",
    gross: "إجمالي المبيعات",
    aov: "متوسط الطلب",
    trust_score: "تقييم الثقة",
    return_rate: "نسبة المرتجع",
  } as Record<string, string>,
  viwStanding: {
    ahead: "متقدّم",
    typical: "في المتوسط",
    behind: "متأخّر",
    unknown: "—",
  } as Record<string, string>,

  // seller: statement
  vrTitle: "تقارير المتجر",
  vrLowStock: "منتجات كميتها خلصت تقريبًا",

  // seller: inbox
  vmTitle: "رسايل العملاء",
  vmEmpty: "مفيش رسايل",
  vmEmptyBody: "لما عميل يسأل عن طلب من متجرك هتلاقي رسالته هنا.",
  vmBuyer: "عميل",

  // seller: store settings
  vstTitle: "إعدادات المتجر",
  vstProfile: "بيانات المتجر",
  vstName: "اسم المتجر",
  vstAbout: "نبذة عن المتجر",
  vstPolicies: "سياسات المتجر",
  vstShippingPolicyHint: "بتشحن خلال كام يوم؟ لأي محافظات؟",
  vstReturnPolicyHint: "بتقبل إرجاع خلال كام يوم؟ وإيه الشروط؟",
  vstShipping: "شحن متجرك",
  vstShippingHint: "السوق شغّال بنظام إن كل بائع بيحدد شحنه بنفسه.",
  vstShippingTypes: {
    Flat: "سعر ثابت",
    "Free Over": "مجاني فوق مبلغ",
    "Always Free": "مجاني دايمًا",
  } as Record<string, string>,
  vstFee: "سعر الشحن",
  vstFreeOver: "مجاني لو الطلب فوق",
  vstOperatorShipping: "أسعار الشحن بيحددها السوق مركزيًا، مش متجرك.",
  vstSaved: "اتحفظ",
  vstMedia: "صور المتجر",
  vstLogo: "لوجو المتجر",
  vstBanner: "بانر المتجر",

  // uploads
  uplTitle: "الصور",
  uplImages: "صور المنتج",
  uplAdd: "أضف",
  uplReplace: "غيّر",
  uplPrimary: "الرئيسية",
  uplPrimaryHint: "أول صورة هي اللي بتظهر للمشتري في القوائم — رتّبهم بالأسهم.",
  uplFull: "وصلت للحد الأقصى للصور.",
  uplTooBig: "الصورة كبيرة — الحد الأقصى ٥ ميجابايت.",
  uplPermission: "محتاجين إذن الوصول لصورك عشان ترفعها.",
  uplFailed: "تعذّر رفع الصورة، حاول تاني.",

  // reviews
  rvTitle: "تقييمات المشترين",
  rvStoreTitle: "تقييمات المتجر",
  rvEmpty: "لسه محدش قيّم المنتج ده — كن أول واحد.",
  rvStoreEmpty: "لسه محدش قيّم المتجر ده.",
  rvVerified: "شراء موثّق",
  rvWrite: "اكتب تقييمك",
  rvEdit: "عدّل تقييمك",
  rvYour: "تقييمك",
  rvBodyHint: "إيه رأيك في المنتج؟ (اختياري)",
  rvSend: "ابعت التقييم",
  rvThanks: "شكرًا — تقييمك اتسجّل.",
  rvSignIn: "سجّل دخولك عشان تقدر تقيّم.",

  // questions & answers
  qaTitle: "أسئلة المشترين",
  qaEmpty: "مفيش أسئلة لسه — اسأل اللي محتاج تعرفه.",
  qaAsk: "اسأل عن المنتج",
  qaAskHint: "اكتب سؤالك عن المنتج",
  qaSend: "ابعت السؤال",
  qaSignIn: "سجّل دخولك عشان تسأل.",
  qaUnanswered: "لسه مفيش إجابة",
  qaAnswer: "أجب على السؤال",
  qaAnswerHint: "اكتب إجابتك",
  qaAnswerSend: "ابعت الإجابة",

  // home & discovery
  homeDeal: "صفقة اليوم",
  homeForYou: "مختار ليك",
  homeRecent: "شوفتهم قبل كده",
  homeBoughtTogether: "اشتروهم مع بعض",

  // filters
  filters: "فلترة",
  filtersClear: "امسح الفلاتر",
  filterBrand: "الماركة",
  filterPrice: "نطاق السعر",
  filterFrom: "من",
  filterTo: "إلى",
  filterRating: "التقييم",

  // seller: variants & branches
  vvTitle: "المنتج له خيارات (مقاسات/ألوان)",
  vvHint: "لو المنتج بيتباع بأكتر من شكل، فعّل ده وضيف كل خيار بسعره وكميته.",
  vvOptionName: "اسم الخيار",
  vvOptionHint: "المقاس، اللون…",
  vvOptionName2: "خيار تاني",
  vvValue: "الخيار",
  vvValueHint: "لارج، أحمر…",
  vvSamePrice: "نفس السعر",
  vvAdd: "أضف خيار",
  vlocTitle: "مخزون الفروع",
  vlocHint: "لو بتشحن من أكتر من فرع، حدّد كمية كل فرع والمحافظة بتاعته.",
  vlocAdd: "أضف فرع",

  // seller: funnel
  vfTitle: "رحلة المنتج",
  vfIntro: "مين شاف المنتج، مين ضافه للسلة، ومين اشتراه فعلًا.",
  vfViews: "مشاهدة",
  vfCarted: "في السلة",
  vfSold: "اتباع",
  vfEmpty: "مفيش بيانات كفاية",
  vfEmptyBody: "لسه مافيش زيارات مسجّلة على منتجاتك في الفترة دي.",
  vfDiagnosis: {
    healthy: "تمام",
    no_data: "مفيش بيانات",
    unpublished: "مش منشور",
    unseen: "محدش شايفه",
    not_tempting: "بيشوفوه ومابيضفوهوش",
    abandoned: "بيضيفوه ومابيشتروش",
  } as Record<string, string>,
  vrExport: "انسخ الطلبات CSV",
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
  walletApplied: "Store credit",
  paidWithWallet: "Paid with store credit",
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

  more: "More",
  pgAbout: "About us",
  pgAboutSub: "An Egyptian multi-vendor marketplace",
  pgAboutFallback:
    "<p>Ovira is an Egyptian multi-vendor marketplace bringing thousands of products from trusted sellers into one place: electronics, fashion, home, beauty and more.</p>" +
    "<h3>Why Ovira?</h3>" +
    "<ul><li>Sellers are reviewed and approved before they can publish.</li>" +
    "<li>Secure payment: cash on delivery or a licensed online gateway.</li>" +
    "<li>Easy returns and support that actually helps.</li></ul>" +
    "<h3>For sellers</h3>" +
    "<p>If you have products and want to reach more customers, open your store in minutes from “Start selling”.</p>",

  pgCareers: "Careers",
  pgCareersSub: "Work with us",
  pgCareersFallback:
    "<p>We are building an Egyptian marketplace from scratch, and we look for people who care about the details.</p>" +
    "<p>If that sounds like you, send your CV to support@ovira.cloud with the role in the subject line.</p>",

  pgTerms: "Terms & conditions",
  pgTermsSub: "Terms of use",
  pgTermsFallback:
    "<p>By using Ovira you agree to these terms.</p>" +
    "<h3>Orders and prices</h3>" +
    "<p>All prices are in Egyptian pounds and either include or add tax as stated on the product page. Every order is reviewed before fulfilment.</p>" +
    "<h3>Returns</h3>" +
    "<p>You can request a return on any delivered order from the order page; each case is reviewed individually.</p>" +
    "<h3>Accounts</h3>" +
    "<p>You are responsible for keeping your sign-in details safe and for activity on your account.</p>",

  pgPrivacy: "Privacy policy",
  pgPrivacySub: "How we handle your data",
  pgPrivacyFallback:
    "<p>We collect the minimum needed to fulfil your order: name, phone, address and email.</p>" +
    "<h3>Who we share it with</h3>" +
    "<p>Delivery details go to the courier and to the seller handling your order, and no further.</p>" +
    "<h3>Payment</h3>" +
    "<p>Card details go straight to the payment gateway. We never store card numbers on our servers.</p>" +
    "<h3>Your rights</h3>" +
    "<p>You can ask us to delete your account, or send you a copy of your data, at support@ovira.cloud.</p>",

  sell: "Start selling",
  sellSubtitle: "Open your store on Ovira and reach more customers.",
  sellStoreName: "Store name",
  sellStoreNameHint: "The name customers will see",
  sellAbout: "About your store",
  sellAboutHint: "What do you sell? (optional)",
  sellSubmit: "Open my store",
  sellSubmitted: "We've got your application",
  sellPending: "Your store is under review — we'll let you know as soon as it's live.",
  sellActive: "Your store is live — you can start listing products now.",
  sellSignIn: "Sign in first so we can attach the store to your account.",
  sellAlready: "You already have a store",
  sellClosed: "Seller registration is closed",
  sellClosedBody: "This store runs as a single company, not a multi-vendor marketplace.",
  sellWhy: "Why sell on Ovira?",
  sellWhy1: "Regular payouts, with a clear statement of what commission was taken.",
  sellWhy2: "A dashboard showing your sales and your best-selling products.",
  sellWhy3: "We handle shipping and collection — you just pack the order.",

  chatPlaceholder: "Write a message…",
  chatClosed: "This conversation is closed",

  support: "Support",
  supportSignIn: "Sign in to talk to support.",
  supportNew: "New ticket",
  supportEmpty: "No tickets",
  supportEmptyBody: "If something's wrong or you have a question, open a ticket and we'll reply.",
  supportCategory: "What is it about?",
  supportSubject: "Subject",
  supportSubjectHint: "Sum it up in one line",
  supportBody: "Details",
  supportBodyHint: "Tell us what happened",
  supportSend: "Send",
  ticketMissing: "Ticket not found",
  ticketClose: "Close ticket",

  messages: "Seller messages",
  messagesSignIn: "Sign in to see your conversations.",
  messagesEmpty: "No conversations",
  messagesEmptyBody: "You can message a seller from any order.",
  contactSeller: "Message {name}",
  contactSellerOne: "Message the seller",

  notificationsSignIn: "Sign in to see your notifications.",
  notificationsEmpty: "No notifications",
  notificationsEmptyBody: "We'll tell you here when something changes on your orders.",
  notificationsMarkAll: "Mark all read",

  reports: "My purchases",
  reportsSignIn: "Sign in to see your purchase summary.",
  reportOrders: "Orders",
  reportPaid: "Paid",
  reportSpent: "Total spent",
  reportAov: "Average order",
  reportByStatus: "By status",
  reportTopProducts: "What you bought most",

  vendorNotSeller: "This area is for sellers",
  inStockShort: "In stock",
  vpTitle: "My products",
  vpNew: "New product",
  vpEdit: "Edit",
  vpCount: "products",
  vpEmpty: "No products yet",
  vpEmptyBody: "Add your first product, or import a CSV in one go.",
  vpUnpublished: "Unpublished",
  vpDeleteConfirm: "This removes it from your store for good. Sure?",
  vpName: "Product name",
  vpNameHint: "What the shopper will see",
  vpPrice: "Price",
  vpCompareAt: "Was",
  vpStock: "Stock",
  vpBrand: "Brand",
  vpOptional: "Optional",
  vpCondition: "Condition",
  vpConditions: {
    New: "New",
    Used: "Used",
    Refurbished: "Refurbished",
  } as Record<string, string>,
  vpShortDescription: "Short description",
  vpDescription: "Full description",
  vpReviewNotice: "Any edit sends the product back for review before it reappears in the store.",
  vpAddTier: "Add tier",
  vpTierRule: "Tiers start at quantity 2, and the cheapest tier reached is the one that applies.",
  vpTierQty: "From qty",
  vpTierPrice: "Unit price",
  vpNoTiers: "No bulk pricing",

  viTitle: "Import & export",
  viIntro:
    "Change prices and stock in bulk: export your products, edit the file, paste it back. Preview before you apply.",
  viColumns: "File columns",
  viCopyTemplate: "Copy headers",
  viExportMine: "Export mine",
  viPaste: "Paste the file contents",
  viPreview: "Preview",
  viApply: "Run the import",
  viCreated: "New",
  viUpdated: "Updated",
  viErrors: "Errors",
  viCopied: "Copied",
  viExported: "Exported",
  viImported: "Imported",
  viStatus: {
    ok: "Will apply",
    created: "Created",
    updated: "Updated",
    error: "Error",
  } as Record<string, string>,

  vsTitle: "Shipments",
  vsTodo: "To ship",
  vsShipped: "Shipped",
  vsAll: "All",
  vsNeedsShipping: "Needs shipping",
  vsAllDone: "Nothing waiting to ship",
  vsNone: "No shipments",
  vsCarrierHint: "Bosta, Aramex, your own courier…",
  vsHandedOver: "I delivered it myself",

  vlTitle: "Waybill",
  vlMissing: "Shipment not found",
  vlPrint: "Print or share as PDF",
  vlShipment: "Shipment",
  vlCod: "Collect on delivery",
  vlTo: "Deliver to",
  vlFrom: "From",
  vlContents: "Contents",

  vcTitle: "My coupons",
  vcNew: "New coupon",
  vcEmpty: "No coupons",
  vcEmptyBody: "Create a discount code for your customers and track its use here.",
  vcFundedNotice: "This discount comes out of your payout, not the marketplace's commission.",
  vcDeleteConfirm: "The code stops working immediately. Sure?",
  vcActive: "Active",
  vcInactive: "Paused",
  vcActiveLabel: "Coupon is active",
  vcCode: "Code",
  vcType: "Discount type",
  vcPercent: "Percentage",
  vcFixed: "Fixed amount",
  vcValuePercent: "Discount %",
  vcValueFixed: "Discount amount",
  vcMaxLabel: "Maximum discount",
  vcMinLabel: "Minimum order",
  vcLimitLabel: "Usage limit",
  vcDescription: "Description",
  vcUnlimited: "No limit",
  vcMin: "Min order",
  vcMax: "Max discount",
  vcExpires: "Expires",
  vcUsed: "Used",

  vaTitle: "Analytics",
  vaRevenue: "Revenue",
  vaTrend: "Daily sales",
  vaPeak: "Best day",
  vaLifetime: "Since you opened",
  vaAov: "Average order",
  vaTopProducts: "Best sellers",

  viwTitle: "How you compare",
  viwIntro: "Your numbers against the median of {n} sellers in your categories.",
  viwMine: "You",
  viwPeerMedian: "Peer median",
  viwPercentile: "Ahead of {n}% of your peers",
  viwNoPeers: "Not enough to compare yet",
  viwNoPeersBody: "We need at least {need} sellers in your categories, and there are {have}.",
  viwMetrics: {
    orders: "Orders",
    gross: "Gross sales",
    aov: "Average order",
    trust_score: "Trust score",
    return_rate: "Return rate",
  } as Record<string, string>,
  viwStanding: {
    ahead: "Ahead",
    typical: "Typical",
    behind: "Behind",
    unknown: "—",
  } as Record<string, string>,

  vrTitle: "Reports",
  vrLowStock: "Running low",

  vmTitle: "Customer messages",
  vmEmpty: "No messages",
  vmEmptyBody: "When a customer asks about an order from your store, it appears here.",
  vmBuyer: "Customer",

  vstTitle: "Store settings",
  vstProfile: "Store details",
  vstName: "Store name",
  vstAbout: "About the store",
  vstPolicies: "Store policies",
  vstShippingPolicyHint: "How many days do you ship in? To which governorates?",
  vstReturnPolicyHint: "How long do you accept returns, and on what terms?",
  vstShipping: "Your shipping",
  vstShippingHint: "This marketplace lets each seller set their own shipping.",
  vstShippingTypes: {
    Flat: "Flat rate",
    "Free Over": "Free over",
    "Always Free": "Always free",
  } as Record<string, string>,
  vstFee: "Shipping fee",
  vstFreeOver: "Free when the order is over",
  vstOperatorShipping: "Shipping rates are set centrally by the marketplace, not by your store.",
  vstSaved: "Saved",
  vstMedia: "Store images",
  vstLogo: "Store logo",
  vstBanner: "Store banner",

  uplTitle: "Images",
  uplImages: "Product photos",
  uplAdd: "Add",
  uplReplace: "Replace",
  uplPrimary: "Main",
  uplPrimaryHint: "The first photo is the one shoppers see in listings — reorder with the arrows.",
  uplFull: "You've reached the image limit.",
  uplTooBig: "That image is too large — 5 MB maximum.",
  uplPermission: "We need access to your photos to upload them.",
  uplFailed: "Couldn't upload that image, try again.",

  rvTitle: "Customer reviews",
  rvStoreTitle: "Store reviews",
  rvEmpty: "Nobody has reviewed this yet — be the first.",
  rvStoreEmpty: "Nobody has reviewed this store yet.",
  rvVerified: "Verified purchase",
  rvWrite: "Write a review",
  rvEdit: "Edit your review",
  rvYour: "Your review",
  rvBodyHint: "What did you think? (optional)",
  rvSend: "Post review",
  rvThanks: "Thanks — your review is in.",
  rvSignIn: "Sign in to leave a review.",

  qaTitle: "Customer questions",
  qaEmpty: "No questions yet — ask what you need to know.",
  qaAsk: "Ask about this product",
  qaAskHint: "What would you like to know?",
  qaSend: "Post question",
  qaSignIn: "Sign in to ask a question.",
  qaUnanswered: "Not answered yet",
  qaAnswer: "Answer this",
  qaAnswerHint: "Write your answer",
  qaAnswerSend: "Post answer",

  homeDeal: "Deal of the day",
  homeForYou: "Picked for you",
  homeRecent: "Recently viewed",
  homeBoughtTogether: "Bought together",

  filters: "Filters",
  filtersClear: "Clear filters",
  filterBrand: "Brand",
  filterPrice: "Price range",
  filterFrom: "From",
  filterTo: "To",
  filterRating: "Rating",

  vvTitle: "This product has options (sizes/colours)",
  vvHint: "If it sells in more than one form, turn this on and add each with its own price and stock.",
  vvOptionName: "Option name",
  vvOptionHint: "Size, colour…",
  vvOptionName2: "Second option",
  vvValue: "Option",
  vvValueHint: "Large, red…",
  vvSamePrice: "Same price",
  vvAdd: "Add option",
  vlocTitle: "Branch stock",
  vlocHint: "If you ship from more than one branch, set each one's stock and governorate.",
  vlocAdd: "Add branch",

  vfTitle: "Product funnel",
  vfIntro: "Who saw it, who added it, and who actually bought it.",
  vfViews: "Views",
  vfCarted: "In cart",
  vfSold: "Sold",
  vfEmpty: "Not enough data",
  vfEmptyBody: "No visits recorded on your products in this period.",
  vfDiagnosis: {
    healthy: "Healthy",
    no_data: "No data",
    unpublished: "Unpublished",
    unseen: "Nobody sees it",
    not_tempting: "Seen, not added",
    abandoned: "Added, not bought",
  } as Record<string, string>,
  vrExport: "Copy orders as CSV",
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
