import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "أوفيرا ماركت بليس",
    short_name: "أوفيرا",
    description: "تسوّق أذكى من بائعين تثق فيهم — آلاف المنتجات وشحن سريع لكل مصر.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#0e8bff",
    dir: "rtl",
    lang: "ar",
    orientation: "portrait",
    categories: ["shopping", "business"],
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
