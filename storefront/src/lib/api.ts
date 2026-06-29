export type Product = {
  name: string;
  title: string;
  slug: string;
  price: number;
  compare_at_price?: number;
  currency: string;
  vendor: string;
  vendor_name?: string;
  category?: string;
  brand?: string;
  stock_qty: number;
  image?: string;
  rating?: number;
  reviews?: number;
  short_description?: string;
  description?: string;
  media?: { image: string; alt_text?: string }[];
  attributes?: { attribute: string; value: string }[];
};

export type Category = {
  name: string;
  category_name: string;
  slug: string;
  icon?: string;
  image?: string;
};

const BASE = process.env.NEXT_PUBLIC_FRAPPE_URL?.replace(/\/$/, "") ?? "";

async function callMethod<T>(method: string, params: Record<string, string> = {}): Promise<T | null> {
  if (!BASE) return null;
  const qs = new URLSearchParams(params).toString();
  try {
    const res = await fetch(`${BASE}/api/method/${method}${qs ? `?${qs}` : ""}`, {
      headers: { Accept: "application/json" },
      next: { revalidate: 60 },
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data.message as T;
  } catch {
    return null;
  }
}

export async function getProducts(params: { category?: string; search?: string; limit?: number } = {}) {
  const live = await callMethod<Product[]>("ovira_marketplace.api.catalog.list_products", {
    ...(params.category ? { category: params.category } : {}),
    ...(params.search ? { search: params.search } : {}),
    limit: String(params.limit ?? 12),
  });
  if (live && live.length) return live;

  let list = MOCK_PRODUCTS;
  if (params.category) {
    const cat = MOCK_CATEGORIES.find((c) => c.slug === params.category);
    if (cat) list = list.filter((p) => p.category === cat.category_name);
  }
  if (params.search) {
    list = list.filter((p) => p.title.includes(params.search!));
  }
  return list.slice(0, params.limit ?? list.length);
}

export async function getProduct(slug: string): Promise<Product | null> {
  const live = await callMethod<Product>("ovira_marketplace.api.catalog.get_product", { slug });
  if (live) return live;
  return mockDetail(slug);
}

function mockDetail(slug: string): Product | null {
  const base = MOCK_PRODUCTS.find((p) => p.slug === slug);
  if (!base) return null;
  return {
    ...base,
    short_description: "منتج أصلي بضمان البائع، جاهز للشحن خلال ٢٤ ساعة.",
    description:
      "وصف تفصيلي للمنتج يوضّح أهم المزايا والمواصفات وطريقة الاستخدام. تصميم عصري " +
      "وخامات عالية الجودة تناسب الاستخدام اليومي، مع ضمان من البائع وخدمة ما بعد البيع.",
    media: [base.image ?? "", ...[1, 2, 3].map((i) => `https://picsum.photos/seed/${slug}-${i}/800/800`)]
      .filter(Boolean)
      .map((image) => ({ image })),
    attributes: [
      { attribute: "الماركة", value: base.brand ?? "Ovira" },
      { attribute: "الحالة", value: "جديد" },
      { attribute: "الضمان", value: "سنة واحدة" },
      { attribute: "التوفّر", value: base.stock_qty > 0 ? "متوفر" : "غير متوفر" },
    ],
  };
}

export async function getCategories() {
  const live = await callMethod<Category[]>("ovira_marketplace.api.catalog.list_categories");
  return live && live.length ? live : MOCK_CATEGORIES;
}

export type CheckoutPayload = {
  items: { slug: string; qty: number }[];
  customer: { name: string; phone: string; email?: string; gov: string; address: string };
  payment_method: string;
};

export async function placeOrder(payload: CheckoutPayload): Promise<{ name: string } | null> {
  if (!BASE) return null;
  try {
    const res = await fetch(`${BASE}/api/method/ovira_marketplace.api.checkout.place_order`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      credentials: "include",
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data.message ?? null;
  } catch {
    return null;
  }
}

export async function initiatePayment(
  order: string,
  returnUrl: string,
): Promise<{ method?: string; redirect_url?: string } | null> {
  if (!BASE) return null;
  try {
    const res = await fetch(`${BASE}/api/method/ovira_marketplace.api.payment.create_payment`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ order, return_url: returnUrl }),
      credentials: "include",
    });
    if (!res.ok) return null;
    return (await res.json()).message ?? null;
  } catch {
    return null;
  }
}

export const MOCK_CATEGORIES: Category[] = [
  { name: "c1", category_name: "إلكترونيات", slug: "electronics", icon: "smartphone" },
  { name: "c2", category_name: "موضة", slug: "fashion", icon: "shirt" },
  { name: "c3", category_name: "المنزل والمطبخ", slug: "home", icon: "lamp" },
  { name: "c4", category_name: "الجمال", slug: "beauty", icon: "sparkles" },
  { name: "c5", category_name: "ألعاب", slug: "toys", icon: "gamepad-2" },
  { name: "c6", category_name: "رياضة", slug: "sports", icon: "dumbbell" },
  { name: "c7", category_name: "كتب", slug: "books", icon: "book-open" },
  { name: "c8", category_name: "بقالة", slug: "grocery", icon: "shopping-basket" },
];

export const MOCK_PRODUCTS: Product[] = [
  {
    name: "p1", title: "سماعات لاسلكية بخاصية عزل الضوضاء", slug: "wireless-anc-headphones",
    price: 2499, compare_at_price: 3200, currency: "EGP", vendor: "v1", vendor_name: "ساوند هَب",
    category: "إلكترونيات", brand: "Aurex", stock_qty: 42, rating: 4.7, reviews: 318,
    image: "https://picsum.photos/seed/ovira-headphones/600/600",
  },
  {
    name: "p2", title: "ساعة ذكية بشاشة AMOLED ومقاومة للماء", slug: "amoled-smartwatch",
    price: 1899, compare_at_price: 2400, currency: "EGP", vendor: "v2", vendor_name: "تك بوينت",
    category: "إلكترونيات", brand: "Pulse", stock_qty: 17, rating: 4.5, reviews: 204,
    image: "https://picsum.photos/seed/ovira-watch/600/600",
  },
  {
    name: "p3", title: "حذاء جري خفيف للرجال", slug: "mens-running-shoes",
    price: 1290, currency: "EGP", vendor: "v3", vendor_name: "أكتيف ستور",
    category: "رياضة", brand: "StrDe", stock_qty: 60, rating: 4.6, reviews: 142,
    image: "https://picsum.photos/seed/ovira-shoes/600/600",
  },
  {
    name: "p4", title: "ماكينة تحضير قهوة إسبريسو منزلية", slug: "home-espresso-machine",
    price: 4750, compare_at_price: 5600, currency: "EGP", vendor: "v4", vendor_name: "كيتشن لاب",
    category: "المنزل والمطبخ", brand: "Brewly", stock_qty: 9, rating: 4.8, reviews: 87,
    image: "https://picsum.photos/seed/ovira-espresso/600/600",
  },
  {
    name: "p5", title: "حقيبة ظهر مقاومة للماء بمنفذ USB", slug: "anti-theft-backpack",
    price: 690, compare_at_price: 950, currency: "EGP", vendor: "v3", vendor_name: "أكتيف ستور",
    category: "موضة", brand: "Nomad", stock_qty: 120, rating: 4.4, reviews: 511,
    image: "https://picsum.photos/seed/ovira-backpack/600/600",
  },
  {
    name: "p6", title: "مجموعة العناية بالبشرة بفيتامين سي", slug: "vitamin-c-skincare-set",
    price: 845, compare_at_price: 1100, currency: "EGP", vendor: "v5", vendor_name: "جلو بيوتي",
    category: "الجمال", brand: "Lumea", stock_qty: 33, rating: 4.6, reviews: 263,
    image: "https://picsum.photos/seed/ovira-skincare/600/600",
  },
  {
    name: "p7", title: "لوحة مفاتيح ميكانيكية للألعاب RGB", slug: "rgb-mechanical-keyboard",
    price: 1650, currency: "EGP", vendor: "v1", vendor_name: "ساوند هَب",
    category: "إلكترونيات", brand: "Keyon", stock_qty: 0, rating: 4.5, reviews: 96,
    image: "https://picsum.photos/seed/ovira-keyboard/600/600",
  },
  {
    name: "p8", title: "مصباح مكتب LED قابل للتعتيم", slug: "dimmable-led-desk-lamp",
    price: 540, compare_at_price: 720, currency: "EGP", vendor: "v4", vendor_name: "كيتشن لاب",
    category: "المنزل والمطبخ", brand: "Lite", stock_qty: 75, rating: 4.3, reviews: 58,
    image: "https://picsum.photos/seed/ovira-lamp/600/600",
  },
];
