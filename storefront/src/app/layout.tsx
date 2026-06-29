import type { Metadata, Viewport } from "next";
import { Readex_Pro, Space_Grotesk } from "next/font/google";
import "./globals.css";
import { Header } from "@/components/header";
import { Footer } from "@/components/footer";
import { PwaRegister } from "@/components/pwa-register";

const readex = Readex_Pro({
  subsets: ["arabic", "latin"],
  variable: "--font-readex",
  display: "swap",
});

const grotesk = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-grotesk",
  display: "swap",
});

export const metadata: Metadata = {
  title: "أوفيرا | تسوّق أذكى من بائعين تثق فيهم",
  description:
    "أوفيرا ماركت بليس — آلاف المنتجات من بائعين موثوقين، أسعار تنافسية وشحن سريع لكل مصر.",
  applicationName: "أوفيرا",
  appleWebApp: { capable: true, statusBarStyle: "default", title: "أوفيرا" },
  icons: {
    icon: "/icons/icon-192.png",
    apple: "/icons/apple-touch-icon.png",
  },
};

export const viewport: Viewport = {
  themeColor: "#0e8bff",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ar" dir="rtl" className={`${readex.variable} ${grotesk.variable}`}>
      <body className="min-h-screen">
        <PwaRegister />
        <Header />
        <main>{children}</main>
        <Footer />
      </body>
    </html>
  );
}
