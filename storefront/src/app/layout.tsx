import type { Metadata, Viewport } from "next";
import { Readex_Pro, Space_Grotesk } from "next/font/google";
import "./globals.css";
import { Header } from "@/components/header";
import { Footer } from "@/components/footer";
import { PwaRegister } from "@/components/pwa-register";
import { SessionSync } from "@/components/session-sync";
import { I18nProvider } from "@/components/i18n-provider";
import { getLocale, getTheme } from "@/lib/locale";

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

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const [locale, theme] = await Promise.all([getLocale(), getTheme()]);
  const dir = locale === "ar" ? "rtl" : "ltr";

  return (
    <html
      lang={locale}
      dir={dir}
      className={`${readex.variable} ${grotesk.variable}${theme === "dark" ? " dark" : ""}`}
    >
      <body className="min-h-screen">
        <I18nProvider locale={locale}>
          <PwaRegister />
          <SessionSync />
          <Header />
          <main>{children}</main>
          <Footer />
        </I18nProvider>
      </body>
    </html>
  );
}
