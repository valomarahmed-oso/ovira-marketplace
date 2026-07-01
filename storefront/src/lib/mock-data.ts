// Development-only fallback catalog. Used by the API layer when the backend is
// unreachable *in dev* so the storefront still renders. Gated behind
// `process.env.NODE_ENV !== "production"` at the call sites, so this module is
// tree-shaken out of the production bundle — real shoppers never see mock data.

import type { Category, Homepage, Product, ProductQuery } from "@/lib/api";

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

/** Client-side filtering of the mock catalog — dev/offline only. */
export function mockProducts(params: ProductQuery): Product[] {
  let list = MOCK_PRODUCTS;
  if (params.category) {
    const cat = MOCK_CATEGORIES.find((c) => c.slug === params.category);
    if (cat) list = list.filter((p) => p.category === cat.category_name);
  }
  if (params.search) list = list.filter((p) => p.title.includes(params.search!));
  if (params.brand) {
    const brands = params.brand.split(",");
    list = list.filter((p) => p.brand && brands.includes(p.brand));
  }
  if (params.minPrice != null) list = list.filter((p) => p.price >= params.minPrice!);
  if (params.maxPrice != null) list = list.filter((p) => p.price <= params.maxPrice!);
  if (params.inStock) list = list.filter((p) => p.stock_qty > 0);
  if (params.sort === "price_asc") list = [...list].sort((a, b) => a.price - b.price);
  if (params.sort === "price_desc") list = [...list].sort((a, b) => b.price - a.price);
  return list.slice(0, params.limit ?? list.length);
}

export function mockDetail(slug: string): Product | null {
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

export function mockHomepage(): Homepage {
  return {
    hero: [
      {
        title: "تسوّق أذكى، من بائعين تثق فيهم.",
        subtitle: "آلاف المنتجات، أسعار تنافسية، وشحن سريع لكل مصر — كل ده في مكان واحد.",
        link: "/products",
        cta_label: "تسوّق دلوقتي",
        tone: "Blue",
        placement: "Hero",
      },
    ],
    promos: [
      { title: "إلكترونيات بأسعار لا تُقاوم", subtitle: "خصومات تصل إلى ٤٠٪", link: "/category/electronics", tone: "Blue", placement: "Promo" },
      { title: "تجهيزات المنزل والمطبخ", subtitle: "كل اللي بيتك محتاجه", link: "/category/home", tone: "Coral", placement: "Promo" },
      { title: "أزياء الموسم الجديد", subtitle: "وصل حديثًا", link: "/category/fashion", tone: "Light Blue", placement: "Promo" },
    ],
    deal: MOCK_PRODUCTS[3],
    sections: [
      { heading: "وصل حديثًا", link: "/products", products: MOCK_PRODUCTS.slice(0, 8) },
      { heading: "الأكثر مبيعًا", link: "/products", products: [...MOCK_PRODUCTS].reverse().slice(0, 8) },
    ],
  };
}
