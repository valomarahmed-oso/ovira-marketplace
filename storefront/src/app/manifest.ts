import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "أوفيرا ماركت بليس",
    short_name: "أوفيرا",
    description: "تسوّق أذكى من بائعين تثق فيهم — آلاف المنتجات وشحن سريع لكل مصر.",
    id: "/shop",
    start_url: "/shop",
    scope: "/shop",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#0e8bff",
    dir: "rtl",
    lang: "ar",
    orientation: "portrait",
    categories: ["shopping", "business"],
    icons: [
      { src: "/shop/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/shop/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/shop/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    // Long-press the installed icon. Three destinations, chosen because they
    // are the ones a returning shopper opens the store *for* — not the ones
    // that happen to be one tap from home anyway.
    shortcuts: [
      {
        name: "طلباتي",
        short_name: "طلباتي",
        description: "تابع حالة طلباتك وشحناتك",
        url: "/shop/account/orders",
        icons: [{ src: "/shop/icons/icon-192.png", sizes: "192x192", type: "image/png" }],
      },
      {
        name: "سلة التسوّق",
        short_name: "السلة",
        description: "أكمل اللي كنت بتشتريه",
        url: "/shop/cart",
        icons: [{ src: "/shop/icons/icon-192.png", sizes: "192x192", type: "image/png" }],
      },
      {
        name: "العروض",
        short_name: "العروض",
        description: "أقوى الخصومات دلوقتي",
        url: "/shop/deals",
        icons: [{ src: "/shop/icons/icon-192.png", sizes: "192x192", type: "image/png" }],
      },
    ],
  };
}
