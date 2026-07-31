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
  total: "الإجمالي",
  remove: "حذف",
  checkoutSoon: "الدفع من التطبيق جاي في التحديث الجاي — دلوقتي كمّل من الموقع.",
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
  productMissing: "Product unavailable",
  productMissingBody: "It may have been removed, or the seller stopped selling it.",

  cartEmpty: "Your cart is empty",
  cartEmptyBody: "Start browsing and add what you like.",
  startShopping: "Start shopping",
  subtotal: "Subtotal",
  shipping: "Shipping",
  shippingAtCheckout: "Calculated at checkout",
  tax: "Tax",
  total: "Total",
  remove: "Remove",
  checkoutSoon: "In-app checkout arrives in the next update — finish on the website for now.",
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
