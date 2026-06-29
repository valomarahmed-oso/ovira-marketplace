"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Globe, Moon, Sun } from "lucide-react";
import { LOCALE_COOKIE, THEME_COOKIE, type Locale } from "@/lib/i18n";
import { useI18n } from "@/components/i18n-provider";

function setCookie(name: string, value: string) {
  document.cookie = `${name}=${value};path=/;max-age=31536000;samesite=lax`;
}

export function PrefsToggle() {
  const router = useRouter();
  const { locale, t } = useI18n();
  const [isDark, setIsDark] = useState(false);

  // Reflect the class the server already set on <html>.
  useEffect(() => {
    setIsDark(document.documentElement.classList.contains("dark"));
  }, []);

  function toggleTheme() {
    const next = !isDark;
    setIsDark(next);
    document.documentElement.classList.toggle("dark", next);
    setCookie(THEME_COOKIE, next ? "dark" : "light");
  }

  function toggleLocale() {
    const next: Locale = locale === "ar" ? "en" : "ar";
    setCookie(LOCALE_COOKIE, next);
    // Instant feedback, then refresh so server components re-render localized.
    document.documentElement.lang = next;
    document.documentElement.dir = next === "ar" ? "rtl" : "ltr";
    router.refresh();
  }

  return (
    <div className="flex items-center gap-1">
      <button
        type="button"
        onClick={toggleLocale}
        className="flex items-center gap-1 rounded-xl px-2 py-2 text-sm text-ink-600 hover:bg-blue-50"
        aria-label={locale === "ar" ? t.switchToEnglish : t.switchToArabic}
      >
        <Globe className="h-4 w-4" />
        <span className="hidden sm:inline">{locale === "ar" ? "EN" : "ع"}</span>
      </button>
      <button
        type="button"
        onClick={toggleTheme}
        className="grid h-9 w-9 place-items-center rounded-xl text-ink-600 hover:bg-blue-50"
        aria-label={isDark ? t.lightMode : t.darkMode}
      >
        {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
      </button>
    </div>
  );
}
